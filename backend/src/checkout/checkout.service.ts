import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In, QueryFailedError } from 'typeorm';
import type { TicketQrPayload } from '@eventia/shared';
import { ConflictError, ValidationError } from '../common/app-error.js';
import { generateOrderNumber, generateTicketUniqueId } from '../common/ids.js';
import { Cart } from '../entities/cart.entity.js';
import { CartItem } from '../entities/cart-item.entity.js';
import { CartLineSeat, CartService, CartWithLines } from '../cart/cart.service.js';
import { EmailOutboxRecord } from '../entities/email-outbox.entity.js';
import { Event } from '../entities/event.entity.js';
import { Notification } from '../entities/notification.entity.js';
import { Order } from '../entities/order.entity.js';
import { OrderItem } from '../entities/order-item.entity.js';
import { Payment } from '../entities/payment.entity.js';
import { Seat } from '../entities/seat.entity.js';
import { Ticket } from '../entities/ticket.entity.js';
import { TicketType } from '../entities/ticket-type.entity.js';
import { TicketTypeSection } from '../entities/ticket-type-section.entity.js';
import { CheckoutDto } from './dto/checkout.dto.js';
import { OrderDetailView, OrderWithRelations, serializeOrder } from '../orders/order.serializer.js';

interface PricedLine {
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  unitPriceCents: number;
  eventName: string;
  eventDate: Date;
  venueName: string | null;
  ticketTypeName: string;
  reserved: boolean;
  seats: CartLineSeat[] | null;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cartService: CartService,
  ) {}

  async placeOrder(userId: string, email: string, dto: CheckoutDto): Promise<OrderDetailView> {
    const idempotencyKey = dto.idempotencyKey ?? null;

    if (idempotencyKey) {
      const existing = await this.dataSource.getRepository(Order).findOne({
        where: { userId, idempotencyKey },
        relations: { items: true },
      });
      if (existing) return this.loadDetail(existing.id);
    }

    const cart = await this.cartService.getOrCreate(null, userId);
    const lines = (await this.cartService.getWithLines(cart)).items;
    if (lines.length === 0) {
      throw new ValidationError('Cart is empty');
    }

    return this.dataSource.transaction(async (em) => {
      const priced = await this.priceLines(em, lines);

      let totalCents = 0;
      for (const line of priced) {
        totalCents += line.quantity * line.unitPriceCents;
      }

      const order = await em.getRepository(Order).save(
        em.getRepository(Order).create({
          userId,
          orderNumber: generateOrderNumber(),
          status: 'confirmed',
          totalCents,
          idempotencyKey,
        }),
      );

      for (const line of priced) {
        const item = await em.getRepository(OrderItem).save(
          em.getRepository(OrderItem).create({
            orderId: order.id,
            eventId: line.eventId,
            ticketTypeId: line.ticketTypeId,
            unitPriceCents: line.unitPriceCents,
            quantity: line.quantity,
            subtotalCents: line.quantity * line.unitPriceCents,
          }),
        );

        const tickets: Ticket[] = [];
        if (line.reserved && line.seats) {
          for (const seat of line.seats) {
            tickets.push(this.buildTicket(line, item, order.id, userId, seat.seatId, seat.seatLabel));
          }
        } else {
          for (let i = 0; i < line.quantity; i++) {
            tickets.push(this.buildTicket(line, item, order.id, userId, null, null));
          }
        }
        try {
          await em.getRepository(Ticket).save(tickets);
        } catch (error) {
          if (error instanceof QueryFailedError) {
            throw new ConflictError('SEAT_TAKEN', 'One or more selected seats were just taken');
          }
          throw error;
        }

        if (!line.reserved) {
          const tt = await em.getRepository(TicketType).findOne({
            where: { id: line.ticketTypeId },
          });
          if (!tt) throw new ValidationError('A ticket type in your cart no longer exists');
          tt.quantitySold += line.quantity;
          await em.getRepository(TicketType).save(tt);
        }
      }

      await em.getRepository(Payment).save(
        em.getRepository(Payment).create({
          orderId: order.id,
          amountCents: totalCents,
          provider: 'simulated',
          providerRef: `sim-${order.orderNumber}`,
          status: 'succeeded',
        }),
      );

      await em.getRepository(Notification).save(
        em.getRepository(Notification).create({
          userId,
          type: 'purchase_confirmed',
          channel: 'in_app',
          title: 'Order confirmed',
          message: `Your order ${order.orderNumber} was confirmed. Tickets are ready in My Tickets.`,
        }),
      );

      await em.getRepository(EmailOutboxRecord).save(
        em.getRepository(EmailOutboxRecord).create({
          to: email,
          subject: `Your Eventia tickets (${order.orderNumber})`,
          body: [
            `Hello,`,
            ``,
            `Thank you for your purchase!`,
            `Order number: ${order.orderNumber}`,
            `Total: €${(totalCents / 100).toFixed(2)}`,
            `Your digital tickets are available in your Eventia account.`,
          ].join('\n'),
        }),
      );

      await em.getRepository(CartItem).delete({ cartId: cart.id });
      await em.getRepository(Cart).update(cart.id, { status: 'converted' });

      return this.findDetail(em, order.id);
    });
  }

  private async priceLines(em: EntityManager, lines: CartWithLines['items']): Promise<PricedLine[]> {
    const priced: PricedLine[] = [];
    for (const line of lines) {
      const tt = await em
        .getRepository(TicketType)
        .findOne({ where: { id: line.ticketTypeId }, lock: { mode: 'pessimistic_write' } });
      if (!tt) throw new ValidationError('A ticket type in your cart no longer exists');

      const event = await em
        .getRepository(Event)
        .findOne({ where: { id: tt.eventId }, relations: { venue: true } });
      if (!event) throw new ValidationError('The event for a ticket type in your cart no longer exists');

      this.assertSellable(tt, event, line.quantity, event.reservedSeating);

      let seats: CartLineSeat[] | null = null;
      if (event.reservedSeating) {
        if (!line.seats || line.seats.length === 0) {
          throw new ValidationError('Seat selection is required for a reserved-seating event');
        }
        seats = await this.assertSeatsInTxn(em, tt, event.id, line.seats);
      } else if (line.seats && line.seats.length > 0) {
        throw new ValidationError('A general-admission line cannot carry seats');
      }

      priced.push({
        eventId: event.id,
        ticketTypeId: tt.id,
        quantity: line.quantity,
        unitPriceCents: tt.priceCents,
        eventName: event.name,
        eventDate: event.dateTime,
        venueName: event.venue ? `${event.venue.name}, ${event.venue.city}` : null,
        ticketTypeName: tt.name,
        reserved: event.reservedSeating,
        seats,
      });
    }
    return priced;
  }

  private async assertSeatsInTxn(
    em: EntityManager,
    ticketType: TicketType,
    eventId: string,
    seats: CartLineSeat[],
  ): Promise<CartLineSeat[]> {
    const seatIds = [...new Set(seats.map((seat) => seat.seatId))];
    const loaded = await em.getRepository(Seat).find({
      where: { id: In(seatIds) },
      relations: { row: { section: true } },
    });
    if (loaded.length !== seatIds.length) {
      throw new ConflictError('SEAT_TAKEN', 'A selected seat no longer exists');
    }

    const sections = [...new Set(loaded.map((seat) => seat.row.section.id))];
    const bound = await em.getRepository(TicketTypeSection).find({
      where: { ticketTypeId: ticketType.id, sectionId: In(sections) },
    });
    const boundSections = new Set(bound.map((b) => b.sectionId));
    for (const sectionId of sections) {
      if (!boundSections.has(sectionId)) {
        throw new ConflictError('SEAT_TAKEN', 'A selected seat is no longer available for this ticket type');
      }
    }

    const occupied = new Set(
      (
        await em
          .getRepository(Ticket)
          .createQueryBuilder('ticket')
          .select('ticket.seatId', 'seatId')
          .where('ticket.eventId = :eventId', { eventId })
          .andWhere('ticket.seatId IN (:...seatIds)', { seatIds })
          .andWhere('ticket.status NOT IN (:...excluded)', { excluded: ['refunded', 'cancelled'] })
          .getRawMany<{ seatId: string }>()
      ).map((row) => row.seatId),
    );
    for (const seatId of seatIds) {
      if (occupied.has(seatId)) {
        throw new ConflictError('SEAT_TAKEN', 'One or more selected seats were just taken');
      }
    }

    return loaded.map((seat) => ({
      seatId: seat.id,
      seatLabel: `${seat.row.section.name} \u00b7 ${seat.row.label} \u00b7 ${seat.number}`,
    }));
  }

  private assertSellable(
    ticketType: TicketType,
    event: Event,
    quantity: number,
    reserved = false,
  ): void {
    if (!ticketType.isVisible) {
      throw new ValidationError('A ticket type in your cart is no longer available');
    }
    if (event.status !== 'published') {
      throw new ValidationError(`"${event.name}" is no longer available for purchase`);
    }
    const now = Date.now();
    if (ticketType.salesStartsAt && ticketType.salesStartsAt.getTime() > now) {
      throw new ValidationError('Sales are not open yet for a ticket type in your cart');
    }
    if (ticketType.salesEndsAt && ticketType.salesEndsAt.getTime() < now) {
      throw new ValidationError('Sales have ended for a ticket type in your cart');
    }
    if (!reserved) {
      const remaining = ticketType.quantity - ticketType.quantitySold;
      if (quantity > remaining) {
        throw new ValidationError('Not enough tickets available for a ticket type in your cart');
      }
    }
    if (ticketType.maxPerCustomer !== null && quantity > ticketType.maxPerCustomer) {
      throw new ValidationError(
        `A maximum of ${ticketType.maxPerCustomer} tickets per customer is allowed`,
      );
    }
  }

  private buildTicket(
    line: PricedLine,
    item: OrderItem,
    orderId: string,
    userId: string,
    seatId: string | null,
    seatLabel: string | null,
  ): Ticket {
    const uniqueId = generateTicketUniqueId();
    const payload: TicketQrPayload = {
      v: 1,
      t: uniqueId,
      e: line.eventName,
      d: line.eventDate.toISOString(),
      vn: line.venueName ?? 'TBA',
      tt: line.ticketTypeName,
      s: seatLabel,
      u: userId,
    };
    return {
      orderItemId: item.id,
      userId,
      eventId: line.eventId,
      ticketTypeId: line.ticketTypeId,
      uniqueId,
      qrPayload: JSON.stringify(payload),
      status: 'valid',
      seatLabel,
      seatId,
      pricePaidCents: line.unitPriceCents,
      purchasedAt: new Date(),
    } as Ticket;
  }

async loadDetail(orderId: string): Promise<OrderDetailView> {
    return this.findDetail(this.dataSource, orderId);
  }

  private async findDetail(
    source: DataSource | EntityManager,
    orderId: string,
  ): Promise<OrderDetailView> {
    const order = await source.getRepository(Order).findOne({
      where: { id: orderId },
      relations: { items: { event: { venue: true }, ticketType: true, tickets: true }, payments: true },
    });
    if (!order) throw new ValidationError('Order not found');
    return serializeOrder(order as OrderWithRelations);
  }
}