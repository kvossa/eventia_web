import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MyNotificationsPage } from './my-notifications';
import { ApiService } from '../../core/api.service';
import { NotificationsService } from '../../core/notifications.service';
import { ToastService } from '../../core/toast.service';
import type { NotificationView } from '../../core/models';

const makeNotification = (id: string, read = false): NotificationView =>
  ({
    id,
    title: `Note ${id}`,
    message: 'Body',
    read,
    createdAt: '2026-05-04T10:00:00.000Z',
  }) as unknown as NotificationView;

const page = (ids: string[], pageNo: number, total: number) => ({
  data: ids.map((id) => makeNotification(id)),
  unreadCount: ids.length,
  page: pageNo,
  limit: 20,
  total,
});

describe('MyNotificationsPage pagination', () => {
  const setup = async (respond: (params?: { page?: number }) => ReturnType<typeof page>) => {
    const notifications = vi.fn((params?: { page?: number }) => respond(params));
    const api = {
      notifications,
      markNotificationRead: vi.fn(),
      markAllNotificationsRead: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [MyNotificationsPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: NotificationsService, useValue: { applyUnread: vi.fn() } },
        { provide: ToastService, useValue: { show: vi.fn() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MyNotificationsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, notifications };
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('appends the next page and hides the button once everything is shown', async () => {
    const { fixture, notifications } = await setup((params) =>
      (params?.page ?? 1) === 1 ? page(['n1', 'n2'], 1, 3) : page(['n3'], 2, 3),
    );
    const root = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.items().map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(root.querySelector('[data-testid="load-more-notifications"]')).toBeTruthy();
    expect(root.textContent).toContain('Showing 2 of 3');

    await fixture.componentInstance.loadMore();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(notifications.mock.calls.at(-1)?.[0]).toEqual({ page: 2 });
    expect(fixture.componentInstance.items().map((n) => n.id)).toEqual(['n1', 'n2', 'n3']);
    expect(root.querySelector('[data-testid="load-more-notifications"]')).toBeNull();
  });

  it('never shows the button when the first page holds everything', async () => {
    const { fixture } = await setup(() => page(['n1'], 1, 1));

    expect(fixture.componentInstance.hasMore()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="load-more-notifications"]')).toBeNull();
  });

  it('tolerates a backend response without pagination metadata', async () => {
    const { fixture } = await setup(() => ({ data: [makeNotification('n1')], unreadCount: 1 } as never));

    expect(fixture.componentInstance.hasMore()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="load-more-notifications"]')).toBeNull();
  });
});
