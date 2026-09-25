import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, FindOptionsWhere, In, SelectQueryBuilder } from 'typeorm';
import { ORDER_STATUSES, type OrderStatus, type Paginated } from '@eventia/shared';
import { ConflictError, NotFoundError, ValidationError } from '../common/app-error.js';
import { Notification } from '../entities/notification.entity.js';
import { Order } from '../entities/order.entity.js';
import { Payment } from '../entities/payment.entity.js';
import { Ticket } from '../entities/ticket.entity.js';
import { TicketType } from '../entities/ticket-type.entity.js';
import { OrderQueryDto } from './dto/order-query.dto.js';
import { OrderDetailView, OrderWithRelations, serializeOrder } from './order.serializer.js';

const ORDER_RELATIONS = {
  items: { event: { venue: true }, ticketType: true, tickets: true },
  payments: true,
} as const;

@Injectable()
export class OrdersService {
  constructor(private readonly dataSource: DataSource) {}

  async listForUser(userId: string, query: OrderQueryDto): Promise<Paginated<OrderDetailView>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: FindOptionsWhere<Order> = { userId };
    if (query.status) where.status = query.status;

    const [orders, total] = await this.dataSource.getRepository(Order).findAndCount({
      where,
      relations: ORDER_RELATIONS,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: orders.map((o) => serializeOrder(o as OrderWithRelations)),
      page,
      limit,
      total,
    };
  }

  async detailForUser(userId: string, orderId: string): Promise<OrderDetailView> {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId, userId },
      relations: ORDER_RELATIONS,
    });
    if (!order) throw new NotFoundError('ORDER_NOT_FOUND', 'Order not found');
    return serializeOrder(order as OrderWithRelations);
  }

  async listAdmin(query: OrderQueryDto): Promise<Paginated<OrderDetailView>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const qb = this.adminQuery(query);

    const countQb = qb.clone();
    const total = await countQb.select('o.id').getCount();
    const idsRows = await qb.select('o.id', 'id').skip((page - 1) * limit).take(limit).getRawMany<{ id: string }>();

    if (idsRows.length === 0) {
      return { data: [], page, limit, total };
    }

    const orders = await this.dataSource.getRepository(Order).find({
      where: { id: In(idsRows.map((r) => r.id)) },
      relations: ORDER_RELATIONS,
      order: { createdAt: 'DESC' },
    });
    return {
      data: orders.map((o) => serializeOrder(o as OrderWithRelations)),
      page,
      limit,
      total,
    };
  }

  async exportCsv(query: OrderQueryDto): Promise<string> {
    const qb = this.adminQuery(query);
    const idsRows = await qb.select('o.id', 'id').getRawMany<{ id: string }>();

    if (idsRows.length === 0) return this.toCsv([]);

    const orders = await this.dataSource.getRepository(Order).find({
      where: { id: In(idsRows.map((r) => r.id)) },
      relations: { ...ORDER_RELATIONS, user: true },
      order: { createdAt: 'DESC' },
    });
    return this.toCsv(orders as OrderWithRelations[]);
  }

  private adminQuery(query: OrderQueryDto): SelectQueryBuilder<Order> {
    const qb = this.dataSource
      .getRepository(Order)
      .createQueryBuilder('o')
      .leftJoin('o.user', 'u')
      .orderBy('o.createdAt', 'DESC');

    if (query.status) qb.andWhere('o.status = :status', { status: query.status });
    if (query.from) {
      const from = new Date(query.from);
      if (!Number.isNaN(from.getTime())) qb.andWhere('o.createdAt >= :from', { from });
    }
    if (query.to) {
      const to = new Date(query.to);
      if (!Number.isNaN(to.getTime())) qb.andWhere('o.createdAt <= :to', { to });
    }
    if (query.q) {
      qb.andWhere(
        '(o.orderNumber ILIKE :q OR u.email ILIKE :q OR u.name ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }

    return qb;
  }

  private toCsv(orders: OrderWithRelations[]): string {
    const header = [
      'orderNumber',
      'createdAt',
      'customerName',
      'customerEmail',
      'status',
      'totalCents',
      'itemsCount',
      'paymentStatus',
    ];
    const rows = orders.map((o) => {
      const itemsCount = (o.items ?? []).reduce((sum, it) => sum + it.quantity, 0);
      const paymentStatus = o.payments?.[0]?.status ?? '';
      return [
        o.orderNumber,
        o.createdAt.toISOString(),
        o.user?.name ?? '',
        o.user?.email ?? '',
        o.status,
        String(o.totalCents),
        String(itemsCount),
        paymentStatus,
      ];
    });
    const all = [header, ...rows];
    return all
      .map((cols) => cols.map((c) => this.csvCell(c)).join(','))
      .join('\r\n');
  }

  private csvCell(value: string): string {
    const escaped = /^[=+\-@]/.test(value) ? `'${value}` : value;
    return /[",\r\n]/.test(escaped) ? `"${escaped.replace(/"/g, '""')}"` : escaped;
  }

  async setStatus(orderId: string, status: OrderStatus): Promise<OrderDetailView> {
    if (![...ORDER_STATUSES].includes(status)) {
      throw new ValidationError(`Invalid status: ${status}`);
    }
    if (status === 'refunded' || status === 'cancelled') {
      throw new ConflictError(
        'USE_DEDICATED_FLOW',
        'Refunds and cancellations must use their dedicated endpoints so seats and stock are released',
      );
    }
    const order = await this.dataSource.getRepository(Order).findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundError('ORDER_NOT_FOUND', 'Order not found');

    order.status = status;
    await this.dataSource.getRepository(Order).save(order);
    return this.loadDetail(order.id);
  }

  async refund(orderId: string): Promise<OrderDetailView> {
    return this.dataSource.transaction(async (em) => {
      const order = await em.getRepository(Order).findOne({
        where: { id: orderId },
        relations: { items: { tickets: true } },
      });
      if (!order) throw new NotFoundError('ORDER_NOT_FOUND', 'Order not found');
      return this.refundOrder(em, order);
    });
  }

  async cancelForUser(userId: string, orderId: string): Promise<OrderDetailView> {
    return this.dataSource.transaction(async (em) => {
      const order = await em.getRepository(Order).findOne({
        where: { id: orderId, userId },
        relations: { items: { tickets: true } },
      });
      if (!order) throw new NotFoundError('ORDER_NOT_FOUND', 'Order not found');
      if (order.status === 'refunded' || order.status === 'cancelled') {
        throw new ConflictError('ALREADY_REFUNDED', 'Order already refunded');
      }
      if (order.status !== 'confirmed') {
        throw new ConflictError('ORDER_NOT_CANCELLABLE', 'Only confirmed orders can be cancelled');
      }
      return this.refundOrder(em, order);
    });
  }

  private async refundOrder(em: EntityManager, order: Order): Promise<OrderDetailView> {
    if (order.status === 'refunded') throw new ConflictError('ALREADY_REFUNDED', 'Order already refunded');

    const soldByType = new Map<string, number>();
    for (const item of order.items ?? []) {
      const tickets = item.tickets ?? (await em.getRepository(Ticket).find({ where: { orderItemId: item.id } }));
      const reserved = tickets.some((ticket) => ticket.seatId !== null);
      if (!reserved) {
        const current = soldByType.get(item.ticketTypeId) ?? 0;
        soldByType.set(item.ticketTypeId, current + item.quantity);
      }
      if (item.tickets) {
        for (const ticket of item.tickets) ticket.status = 'refunded';
        await em.getRepository(Ticket).save(item.tickets);
      } else {
        await em.getRepository(Ticket).update({ orderItemId: item.id }, { status: 'refunded' });
      }
    }
    for (const [ticketTypeId, quantity] of soldByType) {
      const tt = await em.getRepository(TicketType).findOne({
        where: { id: ticketTypeId },
        lock: { mode: 'pessimistic_write' },
      });
      if (tt) {
        tt.quantitySold = Math.max(0, tt.quantitySold - quantity);
        await em.getRepository(TicketType).save(tt);
      }
    }

    order.status = 'refunded';
    await em.getRepository(Order).save(order);
    await em.getRepository(Payment).update({ orderId: order.id }, { status: 'refunded' });

    await em.getRepository(Notification).save(
      em.getRepository(Notification).create({
        userId: order.userId,
        type: 'order_cancelled',
        channel: 'in_app',
        title: 'Order refunded',
        message: `Your order ${order.orderNumber} has been refunded.`,
      }),
    );

    return this.findDetail(em, order.id);
  }

  async loadDetail(orderId: string): Promise<OrderDetailView> {
    return this.findDetail(this.dataSource, orderId);
  }

  async detailAdmin(orderId: string): Promise<OrderDetailView> {
    return this.loadDetail(orderId);
  }

  private async findDetail(
    source: DataSource | EntityManager,
    orderId: string,
  ): Promise<OrderDetailView> {
    const order = await source.getRepository(Order).findOne({
      where: { id: orderId },
      relations: ORDER_RELATIONS,
    });
    if (!order) throw new NotFoundError('ORDER_NOT_FOUND', 'Order not found');
    return serializeOrder(order as OrderWithRelations);
  }
}