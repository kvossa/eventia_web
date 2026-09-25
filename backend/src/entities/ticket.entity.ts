import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TICKET_STATUSES, type TicketStatus } from '@eventia/shared';
import type { OrderItem } from './order-item.entity.js';
import { BaseEntity } from './base.entity.js';
import { Event } from './event.entity.js';
import { Seat } from './seat.entity.js';
import { TicketType } from './ticket-type.entity.js';
import { User } from './user.entity.js';

@Entity('tickets')
export class Ticket extends BaseEntity {
  @ManyToOne('OrderItem', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;

  @Index()
  @Column({ name: 'order_item_id', type: 'uuid' })
  orderItemId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Event)
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Index()
  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @ManyToOne(() => TicketType)
  @JoinColumn({ name: 'ticket_type_id' })
  ticketType: TicketType;

  @Column({ name: 'ticket_type_id', type: 'uuid' })
  ticketTypeId: string;

  @Index({ unique: true })
  @Column({ name: 'unique_id', type: 'varchar', length: 64 })
  uniqueId: string;

  @Column({ name: 'qr_payload', type: 'text' })
  qrPayload: string;

  @Column({ type: 'enum', enum: [...TICKET_STATUSES], enumName: 'ticket_status', default: 'valid' })
  status: TicketStatus;

  @Column({ name: 'seat_label', type: 'varchar', length: 100, nullable: true })
  seatLabel: string | null;

  @ManyToOne(() => Seat, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'seat_id' })
  seat: Seat | null;

  @Index()
  @Column({ name: 'seat_id', type: 'uuid', nullable: true })
  seatId: string | null;

  @Column({ name: 'price_paid_cents', type: 'integer' })
  pricePaidCents: number;

  @Column({ name: 'purchased_at', type: 'timestamptz' })
  purchasedAt: Date;
}