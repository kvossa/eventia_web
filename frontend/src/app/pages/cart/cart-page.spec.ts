import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CartPage } from './cart-page';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { ToastService } from '../../core/toast.service';
import type { CartLine } from '../../core/models';

const baseTt = {
  id: 'tt1',
  eventId: 'evt1',
  description: null,
  salesStartsAt: null,
  salesEndsAt: null,
  isVisible: true,
};

const GENERAL_LINE: CartLine = {
  id: 'line1',
  ticketTypeId: 'tt1',
  quantity: 3,
  unitPriceCents: 1500,
  subtotalCents: 4500,
  event: { id: 'evt1', name: 'Symphony Night', dateTime: '2026-12-01T19:30:00.000Z', city: 'Metropolis', address: '1 Main St', status: 'published', imageUrl: null },
  ticketType: { ...baseTt, name: 'General', priceCents: 1500, quantity: 100, quantitySold: 20, maxPerCustomer: null },
  seats: [],
};

const SEATED_LINE: CartLine = {
  id: 'line2',
  ticketTypeId: 'tt2',
  quantity: 2,
  unitPriceCents: 3000,
  subtotalCents: 6000,
  event: { id: 'evt2', name: 'Ballet Gala', dateTime: '2026-12-15T19:30:00.000Z', city: 'Metropolis', address: '2 Opera Pl', status: 'published', imageUrl: null },
  ticketType: { ...baseTt, id: 'tt2', name: 'VIP', priceCents: 3000, quantity: 50, quantitySold: 0, maxPerCustomer: null },
  seats: [{ seatId: 'seat-1', seatLabel: 'Floor A-1' }],
};

describe('CartPage', () => {
  const setup = async (overrides: { items?: CartLine[]; authenticated?: boolean } = {}) => {
    const items = signal(overrides.items ?? [GENERAL_LINE]);
    const subtotalCents = signal(items().reduce((sum, i) => sum + i.subtotalCents, 0));
    const cart = {
      items,
      subtotalCents,
      loaded: signal(true),
      add: vi.fn(),
      sync: vi.fn().mockResolvedValue(undefined),
      updateQuantity: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clearLocal: vi.fn(),
    };
    const auth = { isAuthenticated: () => overrides.authenticated ?? true };
    const toast = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [CartPage],
      providers: [
        { provide: CartService, useValue: cart },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CartPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, cart, toast };
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('renders cart lines, seats and totals', async () => {
    const { fixture } = await setup({ items: [GENERAL_LINE, SEATED_LINE] });
    const root = fixture.nativeElement as HTMLElement;

    const lines = [...(root.querySelectorAll('[data-testid="cart-line"]'))];
    expect(lines.length).toBe(2);
    expect(root.textContent).toContain('Symphony Night');
    expect(root.textContent).toContain('Ballet Gala');
    expect(root.querySelector('[data-testid="cart-seats"]')?.textContent).toContain('Floor A-1');
    expect(fixture.componentInstance.cart.subtotalCents()).toBe(10500);
    expect(root.querySelector('[data-testid="cart-total"]')?.textContent).toMatch(/10500|105|10\.500/);
  });

  it('clamps the quantity stepper at the remaining stock cap', async () => {
    const line: CartLine = {
      ...GENERAL_LINE,
      ticketType: { ...baseTt, name: 'General', priceCents: 1500, quantity: 12, quantitySold: 3, maxPerCustomer: null },
    };
    const { fixture } = await setup({ items: [line] });
    const root = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.maxFor(line)).toBe(9);
    const plus = root.querySelectorAll('[data-testid="cart-line"] .qty button')[1] as HTMLButtonElement;
    expect(plus.disabled).toBe(false);
  });

  it('changes quantity via the steppers', async () => {
    const { fixture, cart } = await setup();
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelectorAll('[data-testid="cart-line"] .qty button')[0] as HTMLButtonElement).click();
    (root.querySelectorAll('[data-testid="cart-line"] .qty button')[1] as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(cart.updateQuantity).toHaveBeenCalledTimes(2);
    expect(cart.updateQuantity).toHaveBeenNthCalledWith(1, 'line1', 2);
    expect(cart.updateQuantity).toHaveBeenNthCalledWith(2, 'line1', 4);
  });

  it('removes a line', async () => {
    const { fixture, cart, toast } = await setup();
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelector('[data-testid="cart-line"] .remove') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(cart.remove).toHaveBeenCalledWith('line1');
    expect(toast.show).toHaveBeenCalledWith('info', 'Item removed from your cart.');
  });

  it('hides the stepper for seat-based lines but keeps Remove', async () => {
    const { fixture } = await setup({ items: [SEATED_LINE] });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="item-qty"]')).toBeNull();
    expect(root.querySelector('[data-testid="cart-line"] .remove')).toBeTruthy();
  });

  it('shows the empty state when the cart has no items', async () => {
    const { fixture } = await setup({ items: [] });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Your cart is empty');
    expect([...root.querySelectorAll('a')].some((a) => a.textContent?.trim() === 'Browse events')).toBe(true);
  });

  it('offers login with a checkout returnUrl for guests', async () => {
    const { fixture } = await setup({ authenticated: false });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Log in to check out');
    expect([...root.querySelectorAll('a')].some((a) => a.textContent?.includes('Log in to check out'))).toBe(true);
  });

  it('shows the checkout CTA for authenticated users', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Proceed to checkout');
  });
});