import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminOrderDetailPage } from './order-detail';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import type { OrderStatus } from '@eventia/shared';
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
        { provide: Router, useValue: { navigate: vi.fn() } },
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
