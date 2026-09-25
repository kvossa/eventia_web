import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { CartItem } from './cart-item.entity.js';
import { Seat } from './seat.entity.js';

@Entity('cart_item_seats')
@Index(['cartItemId', 'seatId'], { unique: true })
export class CartItemSeat extends BaseEntity {
  @ManyToOne('CartItem', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_item_id' })
  cartItem: CartItem;

  @Index()
  @Column({ name: 'cart_item_id', type: 'uuid' })
  cartItemId: string;

  @ManyToOne('Seat', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'seat_id' })
  seat: Seat;

  @Index()
  @Column({ name: 'seat_id', type: 'uuid' })
  seatId: string;

  @Column({ name: 'seat_label', type: 'varchar', length: 255 })
  seatLabel: string;
}