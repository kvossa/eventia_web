import type { EntityId } from './common.js';
import type { EmailOutboxStatus, NotificationChannel, NotificationType } from './enums.js';

export interface Notification {
  id: EntityId;
  userId: EntityId;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface EmailOutboxRecord {
  id: EntityId;
  to: string;
  subject: string;
  body: string;
  status: EmailOutboxStatus;
  sentAt: string | null;
  createdAt: string;
}