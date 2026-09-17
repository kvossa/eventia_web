import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CART_LIFETIME_DAYS, CART_STATUSES, type CartStatus } from '@eventia/shared';
import { BaseEntity } from './base.entity.js';
import { User } from './user.entity.js';

@Entity('carts')
export class Cart extends BaseEntity {
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'enum', enum: [...CART_STATUSES], enumName: 'cart_status', default: 'active' })
  status: CartStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  static defaultLifetimeDays(): number {
    return CART_LIFETIME_DAYS;
  }
}