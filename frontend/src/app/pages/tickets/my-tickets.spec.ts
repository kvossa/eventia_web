import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MyTicketsPage } from './my-tickets';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import type { TicketView } from '../../core/models';

const makeTicket = (status: TicketView['status']): TicketView =>
  ({
    id: `t-${status}`,
    uniqueId: 'EVT-T-1',
    status,
    seatLabel: null,
    qrPayload: '{}',
    pricePaidCents: 2500,
    purchasedAt: '2026-05-04T10:00:00.000Z',
    event: {
      name: 'Jazz Night',
      dateTime: '2030-01-01T20:00:00.000Z',
      venue: { name: 'Eventia Arena' },
      address: 'Mainstr. 1',
      city: 'Berlin',
    },
    ticketType: { id: 'tt1', name: 'GA' },
  }) as unknown as TicketView;

const STATUSES: TicketView['status'][] = ['valid', 'used', 'cancelled', 'refunded', 'expired'];

describe('MyTicketsPage status badges', () => {
  const setup = async (tickets: TicketView[]) => {
    const api = {
      get: vi.fn().mockResolvedValue({ data: tickets, page: 1, limit: 50, total: tickets.length }),
    };

    await TestBed.configureTestingModule({
      imports: [MyTicketsPage],
      providers: [
        { provide: ApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MyTicketsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('gives every ticket status a class that is styled in the global stylesheet', async () => {
    const fixture = await setup(STATUSES.map(makeTicket));
    const badges = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.status-line .badge')];

    expect(badges).toHaveLength(STATUSES.length);
    badges.forEach((badge, i) => {
      expect(badge.classList.contains(STATUSES[i]!)).toBe(true);
    });
  });

  it('shows the status name as text so terminal states stay distinguishable', async () => {
    const fixture = await setup(STATUSES.map(makeTicket));
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    for (const status of STATUSES) {
      expect(text.toLowerCase()).toContain(status);
    }
  });

  it('shows a notice and renders the ticket when its event was deleted', async () => {
    const deletedTicket = makeTicket('valid');
    deletedTicket.event = { ...makeTicket('valid').event!, deleted: true } as TicketView['event'];
    const fixture = await setup([deletedTicket]);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="ticket-event-unavailable"]')).toBeTruthy();
    expect(root.textContent).toContain('Jazz Night');
    expect(root.querySelector('[data-testid="ticket"]')).toBeTruthy();
  });

  it('renders a fallback notice when the event relation is missing', async () => {
    const bareTicket = makeTicket('valid');
    bareTicket.event = null;
    bareTicket.ticketType = null;
    const fixture = await setup([bareTicket]);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="ticket-event-unavailable"]')).toBeTruthy();
    const text = root.textContent ?? '';
    expect(text).toContain('EVT-T-1');
    expect(text).toContain('25,00');
  });
});

describe('MyTicketsPage pagination', () => {
  const page = (ids: string[], pageNo: number, total: number) => ({
    data: ids.map((id) => ({ ...makeTicket('valid'), id })),
    page: pageNo,
    limit: 12,
    total,
  });

  const setup = async (
    respond: (params?: { scope?: string; page?: number }) => { data: unknown[]; page: number; limit: number; total: number },
  ) => {
    const get = vi.fn((_path: string, params?: { scope?: string; page?: number }) => respond(params));

    await TestBed.configureTestingModule({
      imports: [MyTicketsPage],
      providers: [
        { provide: ApiService, useValue: { get } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: ToastService, useValue: { show: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MyTicketsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, get };
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('appends the next page and hides the button once everything is shown', async () => {
    const { fixture, get } = await setup((params) =>
      (params?.page ?? 1) === 1 ? page(['t1', 't2'], 1, 3) : page(['t3'], 2, 3),
    );
    const root = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.tickets().map((t) => t.id)).toEqual(['t1', 't2']);
    expect(root.querySelector('[data-testid="load-more"]')).toBeTruthy();
    expect(root.textContent).toContain('Showing 2 of 3');

    await fixture.componentInstance.loadMore();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(get.mock.calls.at(-1)?.[1]).toEqual({ scope: 'upcoming', page: 2 });
    expect(fixture.componentInstance.tickets().map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    expect(root.querySelector('[data-testid="load-more"]')).toBeNull();
  });

  it('never shows the button when the first page holds everything', async () => {
    const { fixture } = await setup(() => page(['t1'], 1, 1));

    expect(fixture.componentInstance.hasMore()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="load-more"]')).toBeNull();
  });

  it('asks the backend for the next page instead of reloading from one', async () => {
    const { fixture, get } = await setup((params) =>
      (params?.page ?? 1) === 1 ? page(['t1', 't2'], 1, 4) : page(['t3', 't4'], 2, 4),
    );

    await fixture.componentInstance.loadMore();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.page()).toBe(2);
    expect(fixture.componentInstance.total()).toBe(4);
    expect(fixture.componentInstance.tickets().map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4']);
    expect(get.mock.calls.at(-1)?.[1]).toEqual({ scope: 'upcoming', page: 2 });
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="load-more"]')).toBeNull();
  });

  it('resets to the first page when the scope changes', async () => {
    const { fixture, get } = await setup((params) => {
      if (params?.scope === 'past') return page(['p1', 'p2'], 1, 2);
      return (params?.page ?? 1) === 1 ? page(['t1', 't2'], 1, 4) : page(['t3', 't4'], 2, 4);
    });

    await fixture.componentInstance.loadMore();
    expect(fixture.componentInstance.page()).toBe(2);

    await fixture.componentInstance.setScope('past');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(get.mock.calls.at(-1)?.[1]).toEqual({ scope: 'past' });
    expect(fixture.componentInstance.page()).toBe(1);
    expect(fixture.componentInstance.tickets().map((t) => t.id)).toEqual(['p1', 'p2']);
    expect(fixture.componentInstance.hasMore()).toBe(false);
  });
});
