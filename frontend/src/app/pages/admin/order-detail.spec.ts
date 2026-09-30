import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminOrderDetailPage } from './order-detail';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import type { OrderStatus, TicketStatus } from '@eventia/shared';
import type { OrderDetailView } from '../../core/models';

const makeOrder = (status: OrderStatus): OrderDetailView =>
  ({
    id: 'o1',
    orderNumber: 'EVT-2001',
    status,
    totalCents: 5000,
    createdAt: '2026-05-04T10:00:00.000Z',
    items: [],
    payment: { id: 'p1', provider: 'sim', providerRef: null, status: 'succeeded', amountCents: 5000 },
  }) as unknown as OrderDetailView;

const makeOrderWithTicket = (ticketStatus: TicketStatus): OrderDetailView => ({
  ...makeOrder('confirmed'),
  items: [
    {
      id: 'i1',
      event: { id: 'e1', name: 'Big Gig', dateTime: '2026-07-01T19:00:00.000Z', venue: null },
      ticketType: { id: 'tt1', name: 'GA' },
      unitPriceCents: 2500,
      quantity: 1,
      subtotalCents: 2500,
      tickets: [{ id: 't1', uniqueId: 'EVT-2001-001', status: ticketStatus, seatLabel: null, qrPayload: '', pricePaidCents: 2500, purchasedAt: '2026-05-04T10:00:00.000Z' }],
    },
  ],
});

describe('AdminOrderDetailPage status control', () => {
  const setup = async (status: OrderStatus) => {
    const api = {
      adminOrder: vi.fn().mockResolvedValue(makeOrder(status)),
      adminOrderStatus: vi.fn().mockResolvedValue(makeOrder(status)),
      adminOrderRefund: vi.fn().mockResolvedValue(makeOrder('refunded')),
    };

    await TestBed.configureTestingModule({
      imports: [AdminOrderDetailPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: { show: vi.fn() } },
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'o1' }) } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api };
  };

  const options = (fixture: { nativeElement: HTMLElement }) =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="admin-order-status"] option')].map(
      (o) => (o as HTMLOptionElement).value,
    );

  beforeEach(() => TestBed.resetTestingModule());

  it('only offers the statuses the backend accepts', async () => {
    const { fixture } = await setup('confirmed');

    expect(options(fixture)).toEqual(['pending', 'confirmed']);
  });

  it('does not offer cancelled or refunded, which the status endpoint rejects', async () => {
    const { fixture } = await setup('pending');
    const values = options(fixture);

    expect(values).not.toContain('cancelled');
    expect(values).not.toContain('refunded');
  });

  it('replaces the select with static text once an order is refunded', async () => {
    const { fixture } = await setup('refunded');
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="admin-order-status"]')).toBeNull();
    const terminal = root.querySelector('[data-testid="admin-order-status-terminal"]');
    expect(terminal).toBeTruthy();
    expect(terminal?.textContent?.trim().toLowerCase()).toBe('refunded');
  });

  it('hides the select for a cancelled order too', async () => {
    const { fixture } = await setup('cancelled');
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="admin-order-status"]')).toBeNull();
    expect(root.querySelector('[data-testid="admin-order-status-terminal"]')).toBeTruthy();
  });

  it('never reports a change for a terminal order', async () => {
    const { fixture } = await setup('refunded');

    expect(fixture.componentInstance.terminal()).toBe(true);
    expect(fixture.componentInstance.changed()).toBe(false);
  });
});

describe('AdminOrderDetailPage per-ticket cancel', () => {
  const setup = async (ticketStatus: TicketStatus) => {
    const api = {
      adminOrder: vi.fn().mockResolvedValue(makeOrderWithTicket(ticketStatus)),
      adminOrderStatus: vi.fn(),
      adminOrderRefund: vi.fn(),
      adminCancelTicket: vi.fn().mockResolvedValue({ id: 't1', status: 'cancelled' }),
    };

    await TestBed.configureTestingModule({
      imports: [AdminOrderDetailPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: { show: vi.fn() } },
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'o1' }) } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api };
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('offers a cancel button only for valid tickets', async () => {
    const valid = await setup('valid');
    expect(
      (valid.fixture.nativeElement as HTMLElement).querySelector('[data-testid="admin-ticket-cancel-t1"]'),
    ).toBeTruthy();
    TestBed.resetTestingModule();

    const refunded = await setup('refunded');
    expect(
      (refunded.fixture.nativeElement as HTMLElement).querySelector('[data-testid="admin-ticket-cancel-t1"]'),
    ).toBeNull();
  });

  it('cancels a ticket after confirm and reloads the order', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { fixture, api } = await setup('valid');

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="admin-ticket-cancel-t1"]')!
      .click();
    await fixture.whenStable();

    expect(api.adminCancelTicket).toHaveBeenCalledWith('t1');
    expect(api.adminOrder).toHaveBeenCalledTimes(2);
  });

  it('skips the call when the confirm dialog is dismissed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { fixture, api } = await setup('valid');

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="admin-ticket-cancel-t1"]')!
      .click();
    await fixture.whenStable();

    expect(api.adminCancelTicket).not.toHaveBeenCalled();
    expect(api.adminOrder).toHaveBeenCalledTimes(1);
  });
});
