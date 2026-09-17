import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { NOTIFICATION_CHANNELS, NOTIFICATION_TYPES, type NotificationChannel, type NotificationType } from '@eventia/shared';
import { BaseEntity } from './base.entity.js';
import { User } from './user.entity.js';

@Entity('notifications')
export class Notification extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: [...NOTIFICATION_TYPES], enumName: 'notification_type' })
  type: NotificationType;

  @Column({ type: 'enum', enum: [...NOTIFICATION_CHANNELS], enumName: 'notification_channel', default: 'in_app' })
  channel: NotificationChannel;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;
}