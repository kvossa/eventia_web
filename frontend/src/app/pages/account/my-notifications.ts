import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { NotificationsService } from '../../core/notifications.service';
import { ToastService } from '../../core/toast.service';
import { NotificationView } from '../../core/models';

@Component({
  selector: 'app-my-notifications',
  imports: [RouterLink, Loading],
  template: `
    <div class="page">
      <h1 class="page-title">Notifications</h1>

      @if (loading()) {
        <app-loading />
      } @else if (items().length === 0) {
        <div class="card card-pad" data-testid="notifications-empty">
          <p>You have no notifications yet.</p>
          <a class="btn btn-primary" routerLink="/events">Browse events</a>
        </div>
      } @else {
        <div class="card card-pad" data-testid="notifications-list">
          <div class="toolbar">
            <p class="sub">
              {{ unreadLocal() }} unread
            </p>
            @if (unreadLocal() > 0) {
              <button
                class="btn btn-ghost"
                type="button"
                (click)="markAllRead()"
                [disabled]="markingAll()"
                data-testid="mark-all-read"
              >Mark all as read</button>
            }
          </div>

          @for (n of items(); track n.id) {
            <button
              class="row"
              type="button"
              [class.unread]="!n.read"
              (click)="markRead(n)"
              [attr.data-testid]="'notification-' + n.id"
            >
              <span class="dot" aria-hidden="true"></span>
              <span class="body">
                <span class="title">{{ n.title }}</span>
                @if (n.message) {
                  <span class="message">{{ n.message }}</span>
                }
                <span class="time">{{ formatDate(n.createdAt) }}</span>
              </span>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--color-border); margin-bottom: 8px; }
    .sub { color: var(--color-text-dim); font-size: 0.85rem; margin: 0; }
    .row {
      display: flex; align-items: flex-start; gap: 12px; width: 100%; text-align: left;
      padding: 14px 10px; border: none; border-bottom: 1px solid var(--color-border);
      background: none; color: var(--color-text); cursor: pointer; border-radius: var(--radius-sm);
    }
    .row:last-child { border-bottom: none; }
    .row:hover { background: rgba(255, 255, 255, 0.03); }
    .dot { width: 8px; height: 8px; margin-top: 7px; border-radius: 50%; background: transparent; flex: none; }
    .row.unread .dot { background: var(--color-accent); }
    .body { display: flex; flex-direction: column; gap: 3px; }
    .body .title { font-weight: 600; }
    .row.unread .title { color: var(--color-accent); }
    .message { color: var(--color-text-dim); font-size: 0.9rem; }
    .time { color: var(--color-text-dim); font-size: 0.76rem; }
  `,
})
export class MyNotificationsPage {
  readonly loading = signal(true);
  readonly markingAll = signal(false);
  readonly items = signal<NotificationView[]>([]);
  readonly unreadLocal = computed(() => this.items().filter((n) => !n.read).length);

  private readonly api = inject(ApiService);
  private readonly notifications = inject(NotificationsService);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> {
    try {
      const res = await this.api.notifications();
      this.items.set(res.data ?? []);
      this.notifications.applyUnread(res.unreadCount);
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }

  async markRead(n: NotificationView): Promise<void> {
    if (n.read) return;
    this.items.update((list) => list.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
    this.notifications.applyUnread(this.unreadLocal());
    try {
      await this.api.markNotificationRead(n.id);
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    }
  }

  async markAllRead(): Promise<void> {
    if (this.unreadLocal() === 0) return;
    this.markingAll.set(true);
    try {
      await this.api.markAllNotificationsRead();
      this.items.update((list) => list.map((item) => ({ ...item, read: true })));
      this.notifications.applyUnread(0);
      this.toast.show('success', 'All notifications marked as read.');
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.markingAll.set(false);
    }
  }
}