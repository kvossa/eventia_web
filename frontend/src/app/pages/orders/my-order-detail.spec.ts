import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MyOrderDetailPage } from './my-order-detail';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import type { OrderStatus } from '@eventia/shared';
import type { OrderDetailView } from '../../core/models';

const makeOrder = (status: OrderStatus = 'confirmed'): OrderDetailView =>
  ({
    id: 'o1',
    orderNumber: 'EVT-3001',
    status,
    totalCents: 123456,
    createdAt: '2026-05-04T10:00:00.000Z',
    items: [
      {
        id: 'i1',
        quantity: 2,
        unitPriceCents: 61728,
        subtotalCents: 123456,
        event: { name: 'Jazz Night', dateTime: '2030-01-01T20:00:00.000Z' },
        ticketType: { name: 'GA' },
      },
    ],
    payment: { id: 'p1', provider: 'sim', providerRef: null, status: 'succeeded', amountCents: 123456 },
  }) as unknown as OrderDetailView;

describe('MyOrderDetailPage', () => {
  const setup = async (status: OrderStatus = 'confirmed') => {
    const api = {
      myOrder: vi.fn().mockResolvedValue(makeOrder(status)),
      cancelOrder: vi.fn().mockResolvedValue(makeOrder('cancelled')),
    };

    await TestBed.configureTestingModule({
      imports: [MyOrderDetailPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: { show: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'o1' }) } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MyOrderDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api };
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('renders the order total and line price in euros', async () => {
    const { fixture } = await setup();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).not.toContain('$');
    expect(text).toContain('1.234,56');
    expect(text).toContain('€');
  });

  it('uses the shared danger button class on the cancel action', async () => {
    const { fixture } = await setup();
    const btn = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="cancel-order"]',
    ) as HTMLButtonElement;

    expect(btn.classList.contains('btn')).toBe(true);
    expect(btn.classList.contains('btn-danger')).toBe(true);
  });

  it('offers cancellation only for orders that can still be cancelled', async () => {
    const open = await setup('confirmed');
    const root = open.fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="cancel-order"]')).toBeTruthy();

    TestBed.resetTestingModule();
    const closed = await setup('cancelled');
    const closedRoot = closed.fixture.nativeElement as HTMLElement;
    expect(closedRoot.querySelector('[data-testid="cancel-order"]')).toBeNull();
  });
});
