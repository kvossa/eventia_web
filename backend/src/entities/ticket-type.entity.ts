import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { Event } from './event.entity.js';

@Entity('ticket_types')
export class TicketType extends BaseEntity {
  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Index()
  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'price_cents', type: 'integer' })
  priceCents: number;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ name: 'quantity_sold', type: 'integer', default: 0 })
  quantitySold: number;

  @Column({ name: 'sales_starts_at', type: 'timestamptz', nullable: true })
  salesStartsAt: Date | null;

  @Column({ name: 'sales_ends_at', type: 'timestamptz', nullable: true })
  salesEndsAt: Date | null;

  @Column({ name: 'is_visible', type: 'boolean', default: true })
  isVisible: boolean;

  @Column({ name: 'max_per_customer', type: 'integer', nullable: true })
  maxPerCustomer: number | null;
}