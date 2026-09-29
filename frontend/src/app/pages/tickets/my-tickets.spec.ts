import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MyTicketsPage } from './my-tickets';
import { ApiService } from '../../core/api.service';
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
});
