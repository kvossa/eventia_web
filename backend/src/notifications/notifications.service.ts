import { Injectable } from '@nestjs/common';
import { DataSource, FindOptionsWhere, IsNull } from 'typeorm';
import type { NotificationChannel, NotificationType } from '@eventia/shared';
import { NotFoundError } from '../common/app-error.js';
import { Notification } from '../entities/notification.entity.js';
import { NotificationQueryDto } from './dto/notification-query.dto.js';

export interface NotificationView {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string | null;
  read: boolean;
  createdAt: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly dataSource: DataSource) {}

  async listForUser(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<{ data: NotificationView[]; unreadCount: number }> {
    const limit = query.limit ?? 20;
    const where: FindOptionsWhere<Notification> = { userId };
    if (query.unreadOnly) where.readAt = IsNull();

    const [notifications, unreadCount] = await Promise.all([
      this.dataSource.getRepository(Notification).find({
        where,
        order: { createdAt: 'DESC' },
        take: limit,
      }),
      this.dataSource.getRepository(Notification).count({
        where: { userId, readAt: IsNull() },
      }),
    ]);

    return {
      data: notifications.map(toView),
      unreadCount,
    };
  }

  async unreadCount(userId: string): Promise<{ unreadCount: number }> {
    return {
      unreadCount: await this.dataSource
        .getRepository(Notification)
        .count({ where: { userId, readAt: IsNull() } }),
    };
  }

  async markRead(userId: string, id: string): Promise<NotificationView> {
    const notification = await this.dataSource.getRepository(Notification).findOne({
      where: { id, userId },
    });
    if (!notification) throw new NotFoundError('NOTIFICATION_NOT_FOUND', 'Notification not found');
    notification.readAt = notification.readAt ?? new Date();
    await this.dataSource.getRepository(Notification).save(notification);
    return toView(notification);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const where: FindOptionsWhere<Notification> = { userId, readAt: IsNull() };
    const result = await this.dataSource.getRepository(Notification).update(
      where,
      { readAt: new Date() },
    );
    return { updated: result.affected ?? 0 };
  }
}

const toView = (n: Notification): NotificationView => ({
  id: n.id,
  type: n.type,
  channel: n.channel,
  title: n.title,
  message: n.message,
  read: n.readAt !== null,
  createdAt: n.createdAt.toISOString(),
});