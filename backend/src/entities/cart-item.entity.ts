import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { Cart } from './cart.entity.js';
import { TicketType } from './ticket-type.entity.js';

@Entity('cart_items')
@Index(['cartId', 'ticketTypeId'], { unique: true })
export class CartItem extends BaseEntity {
  @ManyToOne(() => Cart, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart: Cart;

  @Column({ name: 'cart_id', type: 'uuid' })
  cartId: string;

  @ManyToOne(() => TicketType)
  @JoinColumn({ name: 'ticket_type_id' })
  ticketType: TicketType;

  @Column({ name: 'ticket_type_id', type: 'uuid' })
  ticketTypeId: string;

  @Column({ type: 'integer' })
  quantity: number;
}