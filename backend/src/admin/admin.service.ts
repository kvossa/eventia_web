import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Paginated, UserRole } from '@eventia/shared';
import { Repository } from 'typeorm';
import { ForbiddenError, NotFoundError } from '../common/app-error.js';
import { Event } from '../entities/event.entity.js';
import { Order } from '../entities/order.entity.js';
import { Payment } from '../entities/payment.entity.js';
import { Ticket } from '../entities/ticket.entity.js';
import { User } from '../entities/user.entity.js';
import { toPublicUser, type PublicUser } from '../users/user.mapper.js';

export interface DashboardStats {
  totalEvents: number;
  publishedEvents: number;
  totalUsers: number;
  totalOrders: number;
  totalRevenueCents: number;
  ticketsSold: number;
  upcomingEvents: number;
  recentOrders: {
    id: string;
    orderNumber: string;
    status: Order['status'];
    totalCents: number;
    createdAt: string;
    customerName: string;
    customerEmail: string;
  }[];
}

export interface AdminUserListParams {
  q?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentsRepo: Repository<Payment>,
    @InjectRepository(Ticket)
    private readonly ticketsRepo: Repository<Ticket>,
  ) {}

  async stats(): Promise<DashboardStats> {
    const now = new Date();

    const [totalEvents, publishedEvents, totalUsers, totalOrders] = await Promise.all([
      this.eventsRepo.count(),
      this.eventsRepo.count({ where: { status: 'published' } }),
      this.usersRepo.count(),
      this.ordersRepo.count(),
    ]);

    const [paid, ticketsSold, upcomingEvents, recentOrders] = await Promise.all([
      this.paymentsRepo.sum('amountCents', { status: 'succeeded' }),
      this.ticketsRepo.count(),
      this.eventsRepo
        .createQueryBuilder('e')
        .where('e.status = :status', { status: 'published' })
        .andWhere('e.dateTime > :now', { now })
        .getCount(),
      this.ordersRepo.find({
        relations: { user: true },
        order: { createdAt: 'DESC' },
        take: 5,
      }),
    ]);

    return {
      totalEvents,
      publishedEvents,
      totalUsers,
      totalOrders,
      totalRevenueCents: paid ?? 0,
      ticketsSold,
      upcomingEvents,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        totalCents: o.totalCents,
        createdAt: o.createdAt.toISOString(),
        customerName: o.user?.name ?? '—',
        customerEmail: o.user?.email ?? '—',
      })),
    };
  }

  async listUsers(params: AdminUserListParams): Promise<Paginated<PublicUser>> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const qb = this.usersRepo.createQueryBuilder('u');
    if (params.q) {
      qb.where('(u.name ILIKE :q OR u.email ILIKE :q)', { q: `%${params.q}%` });
    }
    qb.orderBy('u.createdAt', 'DESC');

    const total = await qb.getCount();
    const users = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data: users.map(toPublicUser), page, limit, total };
  }

  async setRole(userId: string, role: UserRole): Promise<PublicUser> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundError('USER_NOT_FOUND', 'User not found');
    user.role = role;
    const saved = await this.usersRepo.save(user);
    return toPublicUser(saved);
  }

  async assertAdminRole(userId: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user || user.role !== 'admin') {
      throw new ForbiddenError('ADMIN_ONLY', 'Insufficient permissions');
    }
  }
}