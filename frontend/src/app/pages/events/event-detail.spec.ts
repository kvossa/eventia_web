import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventDetailPage } from './event-detail';
import { ApiService } from '../../core/api.service';
import { CartService } from '../../core/cart.service';
import { ToastService } from '../../core/toast.service';
import type { EventDetail, EventSeatMap } from '../../core/models';

const EVENT: EventDetail = {
  id: 'evt1',
  name: 'Symphony Night',
  description: 'An evening of music.',
  categoryId: 'cat1',
  organizerId: 'org1',
  venueId: 'ven1',
  dateTime: '2026-12-01T19:30:00.000Z',
  startTime: null,
  endTime: null,
  city: 'Metropolis',
  address: '1 Main St',
  maxCapacity: 500,
  status: 'published',
  featured: false,
  reservedSeating: true,
  imageUrl: null,
  ageRestriction: null,
  accessibilityInfo: null,
  category: { id: 'cat1', name: 'Music', slug: 'music', description: null },
  venue: { id: 'ven1', name: 'Grand Hall', city: 'Metropolis', address: '1 Main St', capacity: 500, description: null, imageUrl: null },
  organizer: { id: 'org1', name: 'Orchestra Co', slug: 'orchestra-co', description: null, websiteUrl: null, logoUrl: null },
  availability: { state: 'available', totalStock: 150, soldCount: 22, soldPercent: 15 },
  fromPriceCents: 1500,
  ticketTypes: [
    { id: 'gen', eventId: 'evt1', name: 'General', description: null, priceCents: 1500, quantity: 100, quantitySold: 20, salesStartsAt: null, salesEndsAt: null, isVisible: true, maxPerCustomer: null },
    { id: 'vip', eventId: 'evt1', name: 'VIP', description: null, priceCents: 3000, quantity: 50, quantitySold: 0, salesStartsAt: null, salesEndsAt: null, isVisible: true, maxPerCustomer: null, sectionIds: ['s1'] },
    { id: 'exp', eventId: 'evt1', name: 'Early bird', description: null, priceCents: 1000, quantity: 10, quantitySold: 2, salesStartsAt: '2020-01-01T00:00:00.000Z', salesEndsAt: '2020-06-01T00:00:00.000Z', isVisible: true, maxPerCustomer: null },
  ],
};

const SEAT_MAP: EventSeatMap = {
  ticketTypes: [
    { id: 'gen', name: 'General', priceCents: 1500, sectionIds: [] },
    { id: 'vip', name: 'VIP', priceCents: 3000, sectionIds: ['s1'] },
  ],
  sections: [
    {
      id: 's1',
      name: 'Floor',
      rows: [
        {
          id: 'r1',
          label: 'A',
          seats: [
            { id: 'seat-1', number: 1, isAccessible: true, occupied: false, held: false },
            { id: 'seat-2', number: 2, isAccessible: false, occupied: true, held: false },
            { id: 'seat-3', number: 3, isAccessible: false, occupied: false, held: true },
            { id: 'seat-4', number: 4, isAccessible: false, occupied: false, held: false },
          ],
        },
      ],
    },
    {
      id: 's2',
      name: 'Balcony',
      rows: [
        { id: 'r2', label: 'B', seats: [{ id: 'seat-b1', number: 1, isAccessible: false, occupied: false, held: false }] },
      ],
    },
  ],
};

describe('EventDetailPage', () => {
  const setup = async (overrides: { favorites?: () => Promise<unknown> } = {}) => {
    const api = {
      get: vi.fn().mockResolvedValue(EVENT),
      favorites: overrides.favorites ?? vi.fn().mockResolvedValue({ data: [] }),
      favoriteAdd: vi.fn().mockResolvedValue({}),
      favoriteRemove: vi.fn().mockResolvedValue({}),
      eventSeatMap: vi.fn().mockResolvedValue(SEAT_MAP),
    };
    const cart = {
      add: vi.fn().mockResolvedValue({ items: [], subtotalCents: 0 }),
    };
    const toast = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [EventDetailPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: CartService, useValue: cart },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { params: of({ id: 'evt1' }), snapshot: { queryParamMap: convertToParamMap({}) } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EventDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api, cart, toast };
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('renders event info and available ticket types', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent).toContain('Symphony Night');
    expect(root.textContent).toContain('Grand Hall');
    expect(root.textContent).toContain('General');
    expect(root.querySelectorAll('[data-testid="ticket-type"]').length).toBe(3);
  });

  it('adds a quantity of a non-seat ticket to the cart', async () => {
    const { fixture, cart, toast } = await setup();
    const root = fixture.nativeElement as HTMLElement;

    const plus = root.querySelectorAll('.ticket')[0].querySelectorAll('button')[1] as HTMLButtonElement;
    plus.click();
    fixture.detectChanges();

    const addBtn = root.querySelectorAll('[data-testid="add-to-cart"]')[0] as HTMLButtonElement;
    addBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(cart.add).toHaveBeenCalledWith('gen', 2);
    expect(toast.show).toHaveBeenCalledWith('success', '2 × General added to your cart.');
  });

  it('shows a closed sales window as unavailable', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;

    const text = root.querySelectorAll('.ticket')[2].textContent ?? '';
    expect(text).toContain('Sales ended');
    expect(root.querySelectorAll('.ticket')[2].querySelector('[data-testid="add-to-cart"]')).toBeNull();
  });

  it('renders the seat map and disables sold, held and out-of-scope seats', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;
    const seats = [...(root.querySelectorAll('[data-testid="seat-map"] .seat'))] as HTMLButtonElement[];

    expect(seats.length).toBe(5);
    for (const seat of seats) {
      if (seat.classList.contains('occupied') || seat.classList.contains('held') || seat.classList.contains('inactive')) {
        expect(seat.disabled).toBe(true);
      } else {
        expect(seat.disabled).toBe(false);
      }
    }
    const trim = (el: HTMLButtonElement | undefined) => el?.textContent?.trim();
    expect(trim(seats.find((s) => s.classList.contains('occupied')))).toBe('2');
    expect(trim(seats.find((s) => s.classList.contains('held')))).toBe('3');
    expect(trim(seats.find((s) => s.classList.contains('inactive')))).toBe('1');
    expect(seats.find((s) => s.classList.contains('accessible'))).toBeTruthy();
  });

  it('tracks seat selection and subtotal', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;

    const available = [...(root.querySelectorAll('[data-testid="seat-map"] .seat.available'))] as HTMLButtonElement[];
    available[0].click();
    available[available.length - 1].click();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="seat-count"]')?.textContent).toContain('2');
    expect(fixture.componentInstance.selectedSubtotalCents()).toBe(6000);
    const subtotal = root.querySelector('[data-testid="seat-subtotal"]')?.textContent ?? '';
    expect(subtotal).toMatch(/60/);
    const selected = root.querySelector('[data-testid="seat-map"] .seat.selected') as HTMLButtonElement;
    expect(selected.getAttribute('aria-pressed')).toBe('true');
  });

  it('adds selected seats to the cart and clears the selection', async () => {
    const { fixture, api, cart } = await setup();
    const root = fixture.nativeElement as HTMLElement;

    const available = [...(root.querySelectorAll('[data-testid="seat-map"] .seat.available'))] as HTMLButtonElement[];
    available[0].click();
    available[available.length - 1].click();
    fixture.detectChanges();

    (root.querySelector('[data-testid="add-seats-to-cart"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(cart.add).toHaveBeenCalledWith('vip', 2, ['seat-1', 'seat-4']);
    expect(root.querySelector('[data-testid="seat-count"]')?.textContent).toContain('0');
    expect(api.eventSeatMap).toHaveBeenCalledTimes(2);
  });

  it('clears selected seats', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelector('[data-testid="seat-map"] .seat.available') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="seat-count"]')?.textContent).toContain('1');

    (root.querySelector('.sel-actions button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="seat-count"]')?.textContent).toContain('0');
  });

  it('toggles the favorite state', async () => {
    const { fixture, toast } = await setup();
    const root = fixture.nativeElement as HTMLElement;
    const toggle = root.querySelector('[data-testid="favorite-toggle"]') as HTMLButtonElement;

    toggle.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="favorite-toggle"]')?.textContent).toContain('Favorited');
    expect(toast.show).toHaveBeenCalledWith('success', 'Added to favorites.');

    (root.querySelector('[data-testid="favorite-toggle"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="favorite-toggle"]')?.textContent).toContain('Add to favorites');
    expect(toast.show).toHaveBeenCalledWith('success', 'Removed from favorites.');
  });

  it('seeds the favorite button for an already-favorited event', async () => {
    const { fixture, api } = await setup({ favorites: vi.fn().mockResolvedValue({ data: [{ id: 'evt1' }] }) });
    fixture.componentInstance.event.set(EVENT);
    await fixture.componentInstance.seedFavorite();
    fixture.detectChanges();
    expect(api.favorites).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="favorite-toggle"]')?.textContent).toContain('Favorited');
  });
});