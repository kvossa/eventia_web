import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminEventsPage } from './events';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import type { EventStatus } from '@eventia/shared';
import type { EventListItem } from '../../core/models';

const makeEvent = (id: string, status: EventStatus): EventListItem =>
  ({
    id,
    name: `Event ${id}`,
    status,
    availability: { state: 'available', soldCount: 0, totalStock: 50, remaining: 50 },
    city: 'Berlin',
    dateTime: '2026-07-01T19:00:00.000Z',
    featured: false,
    fromPriceCents: 2000,
  }) as unknown as EventListItem;

describe('AdminEventsPage status actions', () => {
  const setup = async (initial: EventStatus) => {
    const api = {
      adminEvents: vi.fn().mockResolvedValue({
        data: [makeEvent('e1', initial)],
        page: 1,
        limit: 20,
        total: 1,
      }),
      categories: vi.fn().mockResolvedValue([]),
      adminSetEventStatus: vi.fn().mockResolvedValue({}),
      eventDuplicate: vi.fn(),
      eventRemove: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AdminEventsPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: { show: vi.fn() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminEventsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api };
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('routes every status action through the single generic endpoint', async () => {
    const { fixture, api } = await setup('draft');
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Publish');
    expect(root.textContent).toContain('Sold out');

    (root.querySelectorAll('button.link-btn')[0] as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(api.adminSetEventStatus).toHaveBeenCalledWith('e1', 'published');

    await fixture.componentInstance.setStatus('e1', 'sold_out');
    expect(api.adminSetEventStatus).toHaveBeenLastCalledWith('e1', 'sold_out');
    expect(api.adminEvents).toHaveBeenCalledTimes(3);
  });

  it('shows Unpublish instead of Publish once an event is live', async () => {
    const { fixture } = await setup('published');
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Unpublish');
    expect(root.textContent).not.toContain('Publish');
  });

  it('reports failures back through the toast', async () => {
    const { fixture, api } = await setup('draft');
    api.adminSetEventStatus.mockRejectedValueOnce(new Error('boom'));
    const toast = TestBed.inject(ToastService).show;

    await fixture.componentInstance.setStatus('e1', 'published');
    expect(toast).toHaveBeenCalledWith('error', 'boom');
  });
});