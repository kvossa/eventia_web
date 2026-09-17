import { Column, Entity, Index } from 'typeorm';
import { EMAIL_OUTBOX_STATUSES, type EmailOutboxStatus } from '@eventia/shared';
import { BaseEntity } from './base.entity.js';

@Entity('email_outbox')
export class EmailOutboxRecord extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  to: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Index()
  @Column({ type: 'enum', enum: [...EMAIL_OUTBOX_STATUSES], enumName: 'email_outbox_status', default: 'pending' })
  status: EmailOutboxStatus;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;
}