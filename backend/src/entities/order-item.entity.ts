import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import type { Order } from './order.entity.js';
import type { Ticket } from './ticket.entity.js';
import { BaseEntity } from './base.entity.js';
import { Event } from './event.entity.js';
import { TicketType } from './ticket-type.entity.js';

@Entity('order_items')
export class OrderItem extends BaseEntity {
  @ManyToOne('Order', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

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

  @Column({ name: 'unit_price_cents', type: 'integer' })
  unitPriceCents: number;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ name: 'subtotal_cents', type: 'integer' })
  subtotalCents: number;

  @OneToMany('Ticket', (t: Ticket) => t.orderItem)
  tickets: Ticket[];
}