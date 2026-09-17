import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { PAYMENT_PROVIDERS, PAYMENT_STATUSES, type PaymentProvider, type PaymentStatus } from '@eventia/shared';
import { BaseEntity } from './base.entity.js';
import { Order } from './order.entity.js';

@Entity('payments')
export class Payment extends BaseEntity {
  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents: number;

  @Column({ type: 'enum', enum: [...PAYMENT_PROVIDERS], enumName: 'payment_provider', default: 'simulated' })
  provider: PaymentProvider;

  @Column({ name: 'provider_ref', type: 'varchar', length: 100, nullable: true })
  providerRef: string | null;

  @Column({ type: 'enum', enum: [...PAYMENT_STATUSES], enumName: 'payment_status', default: 'processing' })
  status: PaymentStatus;
}