import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import type { Paginated, TicketStatus } from '@eventia/shared';
import { ConflictError, NotFoundError } from '../common/app-error.js';
import { Ticket } from '../entities/ticket.entity.js';
import { TicketQueryDto } from './dto/ticket-query.dto.js';

export interface TicketView {
  id: string;
  uniqueId: string;
  status: TicketStatus;
  seatLabel: string | null;
  qrPayload: string;
  pricePaidCents: number;
  purchasedAt: string;
  event: {
    id: string;
    name: string;
    dateTime: string;
    city: string;
    address: string;
    deleted: boolean;
    venue: { id: string; name: string; city: string; address: string } | null;
  } | null;
  ticketType: { id: string; name: string } | null;
}

const TICKET_RELATIONS = {
  event: { venue: true },
  ticketType: true,
} as const;

@Injectable()
export class TicketsService {
  constructor(private readonly dataSource: DataSource) {}

  async listForUser(userId: string, query: TicketQueryDto): Promise<Paginated<TicketView>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const scope = query.scope ?? 'all';

    const repo = this.dataSource.getRepository(Ticket);
    const qb = repo
      .createQueryBuilder('t')
      .leftJoin('t.event', 'e')
      .where('t.userId = :userId', { userId });
    if (scope === 'upcoming') qb.andWhere('e.dateTime >= :now', { now: new Date() });
    if (scope === 'past') qb.andWhere('e.dateTime < :now', { now: new Date() });
    qb.orderBy('e.dateTime', 'DESC');

    const total = await qb.clone().getCount();
    const rows = await qb
      .select('t.id', 'id')
      .addSelect('e.dateTime', 'dateTime')
      .skip((page - 1) * limit)
      .take(limit)
      .getRawMany<{ id: string; dateTime: string | Date | null }>();

    const tickets = rows.length
      ? await repo.find({
          where: { id: In(rows.map((r) => r.id)) },
          relations: TICKET_RELATIONS,
          withDeleted: true,
        })
      : [];

    const byId = new Map(tickets.map((t) => [t.id, t]));
    const ordered = rows
      .map((r) => byId.get(r.id))
      .filter((t): t is Ticket => !!t)
      .map(toView);

    return { data: ordered, page, limit, total };
  }

  async detailForUser(userId: string, ticketId: string): Promise<TicketView> {
    const ticket = await this.dataSource.getRepository(Ticket).findOne({
      where: { id: ticketId, userId },
      relations: TICKET_RELATIONS,
      withDeleted: true,
    });
    if (!ticket) throw new NotFoundError('TICKET_NOT_FOUND', 'Ticket not found');
    return toView(ticket);
  }

  async cancelTicket(ticketId: string): Promise<TicketView> {
    const ticket = await this.dataSource.getRepository(Ticket).findOne({
      where: { id: ticketId },
      relations: TICKET_RELATIONS,
    });
    if (!ticket) throw new NotFoundError('TICKET_NOT_FOUND', 'Ticket not found');
    if (ticket.status !== 'valid') {
      throw new ConflictError(
        'TICKET_NOT_CANCELLABLE',
        `Only valid tickets can be cancelled (current status: ${ticket.status})`,
      );
    }
    ticket.status = 'cancelled';
    await this.dataSource.getRepository(Ticket).save(ticket);
    return toView(ticket);
  }
}

const toView = (ticket: Ticket): TicketView => ({
  id: ticket.id,
  uniqueId: ticket.uniqueId,
  status: ticket.status,
  seatLabel: ticket.seatLabel,
  qrPayload: ticket.qrPayload,
  pricePaidCents: ticket.pricePaidCents,
  purchasedAt: ticket.purchasedAt.toISOString(),
  event: ticket.event
    ? {
        id: ticket.event.id,
        name: ticket.event.name,
        dateTime: ticket.event.dateTime.toISOString(),
        city: ticket.event.city,
        address: ticket.event.address,
        deleted: ticket.event.deletedAt !== null,
        venue: ticket.event.venue
          ? {
              id: ticket.event.venue.id,
              name: ticket.event.venue.name,
              city: ticket.event.venue.city,
              address: ticket.event.venue.address,
            }
          : null,
      }
    : null,
  ticketType: ticket.ticketType ? { id: ticket.ticketType.id, name: ticket.ticketType.name } : null,
});