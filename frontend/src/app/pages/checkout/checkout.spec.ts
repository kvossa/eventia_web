import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutPage } from './checkout';
import { ApiService } from '../../core/api.service';
import { CartService } from '../../core/cart.service';
import { ToastService } from '../../core/toast.service';
import type { OrderDetailView } from '../../core/models';

const KEY = 'evt_checkout_key';

const order = { orderNumber: 'EVT-1', totalCents: 5000, payment: { status: 'succeeded', provider: 'sim' } };

const cartItem = {
  id: 'i1',
  quantity: 2,
  subtotalCents: 5000,
  event: { name: 'Jazz Night', dateTime: '2030-01-01T20:00:00.000Z' },
  ticketType: { name: 'GA' },
};

describe('CheckoutPage idempotency', () => {
  let post: ReturnType<typeof vi.fn>;
  let cart: {
    items: () => typeof cartItem[];
    subtotalCents: () => number;
    loaded: () => boolean;
    sync: () => Promise<void>;
    clearLocal: () => void;
  };

  const setup = async () => {
    post = vi.fn();
    cart = {
      items: () => [cartItem],
      subtotalCents: () => 5000,
      loaded: () => true,
      sync: vi.fn().mockResolvedValue(undefined),
      clearLocal: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CheckoutPage],
      providers: [
        { provide: ApiService, useValue: { post } },
        { provide: CartService, useValue: cart },
        { provide: ToastService, useValue: { show: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CheckoutPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  const sentKeys = () => post.mock.calls.map((c) => c[1].idempotencyKey as string);

  beforeEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  it('stores a key on the first attempt', async () => {
    const fixture = await setup();
    let keyDuringRequest: string | null = null;
    post.mockImplementationOnce(async () => {
      keyDuringRequest = sessionStorage.getItem(KEY);
      return order;
    });

    await fixture.componentInstance.pay();

    expect(sentKeys()).toHaveLength(1);
    expect(keyDuringRequest).toBe(sentKeys()[0]);
  });

  it('clears the key after a successful order', async () => {
    const fixture = await setup();
    post.mockResolvedValueOnce(order as never);

    await fixture.componentInstance.pay();

    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('reuses the same key when a retry follows an unreachable server', async () => {
    const fixture = await setup();
    post.mockRejectedValueOnce({ statusCode: 0, message: 'The server is unreachable.' });

    await fixture.componentInstance.pay();
    const first = sentKeys()[0];

    expect(sessionStorage.getItem(KEY)).toBe(first);

    post.mockResolvedValueOnce(order as never);
    await fixture.componentInstance.pay();

    expect(sentKeys()).toHaveLength(2);
    expect(sentKeys()[1]).toBe(first);
  });

  it('clears the key after a rejected request so the next attempt starts fresh', async () => {
    const fixture = await setup();
    post.mockRejectedValueOnce({ statusCode: 422, code: 'VALIDATION_ERROR', message: 'Cart is empty' });

    await fixture.componentInstance.pay();

    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('mints a new key when nothing is outstanding', async () => {
    const fixture = await setup();
    post.mockResolvedValue(order as never);

    await fixture.componentInstance.pay();
    await fixture.componentInstance.pay();

    expect(sentKeys()).toHaveLength(2);
    expect(sentKeys()[0]).not.toBe(sentKeys()[1]);
  });

  it('reuses a key that was already persisted before the page reloaded', async () => {
    sessionStorage.setItem(KEY, 'persisted-key');
    const fixture = await setup();
    post.mockResolvedValueOnce(order as never);

    await fixture.componentInstance.pay();

    expect(sentKeys()).toEqual(['persisted-key']);
  });

  it('shows the order number once the retry succeeds', async () => {
    const fixture = await setup();
    post.mockRejectedValueOnce({ statusCode: 0, message: 'timeout' });
    await fixture.componentInstance.pay();

    post.mockResolvedValueOnce(order as unknown as OrderDetailView);
    await fixture.componentInstance.pay();
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector('[data-testid="order-number"]') as HTMLElement;
    expect(el.textContent).toContain('EVT-1');
    expect(cart.clearLocal).toHaveBeenCalled();
  });
});
