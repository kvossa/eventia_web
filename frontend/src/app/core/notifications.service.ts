import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  readonly unreadCount = signal(0);

  constructor(private readonly api: ApiService) {}

  async refresh(): Promise<void> {
    try {
      const { unreadCount } = await this.api.unreadNotificationsCount();
      this.unreadCount.set(unreadCount);
    } catch {
      this.unreadCount.set(0);
    }
  }

  applyUnread(count: number): void {
    this.unreadCount.set(count);
  }
}