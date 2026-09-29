import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MyOrdersPage } from './my-orders';
import { ApiService } from '../../core/api.service';
import type { MyOrderListItem } from '../../core/models';

const makeOrder = (totalCents: number): MyOrderListItem =>
  ({
    id: 'o1',
    orderNumber: 'EVT-1001',
    status: 'confirmed',
    totalCents,
    createdAt: '2026-05-04T10:00:00.000Z',
    items: [{ quantity: 2, event: { name: 'Jazz Night' } }],
    payment: { status: 'succeeded', provider: 'sim', amountCents: totalCents },
  }) as unknown as MyOrderListItem;

describe('MyOrdersPage money formatting', () => {
  const setup = async (totalCents: number) => {
    const api = {
      myOrders: vi.fn().mockResolvedValue({
        data: [makeOrder(totalCents)],
        page: 1,
        limit: 10,
        total: 1,
      }),
    };

    await TestBed.configureTestingModule({
      imports: [MyOrdersPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MyOrdersPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('renders totals in euros rather than dollars', async () => {
    const fixture = await setup(4990);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).not.toContain('$');
    expect(text).toContain('49,90');
    expect(text).toContain('€');
  });

  it('formats a whole-euro amount without decimals', async () => {
    const fixture = await setup(5000);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).not.toContain('$');
    expect(text).toContain('50');
    expect(text).toContain('€');
  });
});
