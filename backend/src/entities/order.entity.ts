import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { ORDER_STATUSES, ORDER_NUMBER_PREFIX, type OrderStatus } from '@eventia/shared';
import { BaseEntity } from './base.entity.js';
import type { OrderItem } from './order-item.entity.js';
import type { Payment } from './payment.entity.js';
import { User } from './user.entity.js';

@Entity('orders')
export class Order extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: 'order_number', type: 'varchar', length: 40 })
  orderNumber: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: [...ORDER_STATUSES], enumName: 'order_status', default: 'pending' })
  status: OrderStatus;

  @Column({ name: 'total_cents', type: 'integer' })
  totalCents: number;

  @Index({ unique: true })
  @Column({ name: 'idempotency_key', type: 'varchar', length: 64, nullable: true })
  idempotencyKey: string | null;

  @OneToMany('OrderItem', (i: OrderItem) => i.order)
  items: OrderItem[];

  @OneToMany('Payment', (p: Payment) => p.order)
  payments: Payment[];

  static numberPrefix(): string {
    return ORDER_NUMBER_PREFIX;
  }
}