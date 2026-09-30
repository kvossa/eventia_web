import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminTicketTypesPage } from './ticket-types';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import type { EventDetail, TicketType, VenueLayoutView } from '../../core/models';

const TICKET_TYPE: TicketType = {
  id: 'tt1',
  eventId: 'e1',
  name: 'Standard',
  description: null,
  priceCents: 4500,
  quantity: 100,
  quantitySold: 12,
  salesStartsAt: null,
  salesEndsAt: null,
  isVisible: true,
  maxPerCustomer: 4,
};

const LAYOUT: VenueLayoutView = {
  venueId: 'v1',
  sections: [
    { id: 's1', name: 'Stalls', sortOrder: 1, rows: [] },
    { id: 's2', name: 'Balcony', sortOrder: 2, rows: [] },
  ],
} as VenueLayoutView;

const makeEvent = (overrides: Partial<EventDetail> = {}): EventDetail =>
  ({
    id: 'e1',
    name: 'Symphony Night',
    description: null,
    categoryId: 'c1',
    organizerId: 'o1',
    venueId: 'v1',
    dateTime: '2026-12-01T19:30:00.000Z',
    startTime: null,
    endTime: null,
    city: 'Berlin',
    address: 'Potsdamer Str. 1',
    maxCapacity: 1000,
    status: 'published',
    featured: false,
    imageUrl: null,
    fromPriceCents: 4500,
    availability: { state: 'available', soldCount: 12, totalStock: 100, remaining: 88 },
    reservedSeating: false,
    ticketTypes: [TICKET_TYPE],
    ...overrides,
  }) as EventDetail;

describe('AdminTicketTypesPage', () => {
  let routeId: string | null = 'e1';
  const routeProvider = {
    provide: ActivatedRoute,
    useValue: { snapshot: { paramMap: { get: (key: string) => (key === 'id' ? routeId : null) } } },
  };

  const setup = async (overrides: { event?: EventDetail | Error; layout?: VenueLayoutView | Error } = {}) => {
    const event = overrides.event instanceof Error ? overrides.event : (overrides.event ?? makeEvent());
    const layout = overrides.layout instanceof Error ? overrides.layout : (overrides.layout ?? LAYOUT);
    const api = {
      adminEvent: event instanceof Error ? vi.fn().mockRejectedValue(event) : vi.fn().mockResolvedValue(event),
      venueLayout: layout instanceof Error ? vi.fn().mockRejectedValue(layout) : vi.fn().mockResolvedValue(layout),
      ticketTypeCreate: vi.fn().mockResolvedValue(TICKET_TYPE),
      ticketTypeUpdate: vi.fn().mockResolvedValue(TICKET_TYPE),
      ticketTypeRemove: vi.fn().mockResolvedValue(undefined),
      ticketTypeSections: vi.fn().mockResolvedValue(undefined),
    };
    const toast = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AdminTicketTypesPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: toast },
        provideRouter([]),
        routeProvider,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminTicketTypesPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    return { fixture, api, toast };
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    routeId = 'e1';
  });
  afterEach(() => vi.restoreAllMocks());

  it('lists ticket types with price, sold count and limits', async () => {
    const { fixture } = await setup();
    const row = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="admin-ticket-type-tt1"]');
    expect(row?.textContent).toContain('Standard');
    expect(row?.textContent).toContain('12 / 100');
    expect(row?.textContent).toContain('yes');
    expect(row?.textContent).toContain('open');
    expect(row?.textContent).toContain('4');
  });

  it('shows the empty state when the event has no ticket types', async () => {
    const { fixture } = await setup({ event: makeEvent({ ticketTypes: [] }) });
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="admin-ticket-types-empty"]')).toBeTruthy();
  });

  it('shows the missing-event card when the id is absent', async () => {
    const api = {
      adminEvent: vi.fn(),
      venueLayout: vi.fn(),
      ticketTypeCreate: vi.fn(),
      ticketTypeUpdate: vi.fn(),
      ticketTypeRemove: vi.fn(),
      ticketTypeSections: vi.fn(),
    };
    routeId = null;
    await TestBed.configureTestingModule({
      imports: [AdminTicketTypesPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: { show: vi.fn() } },
        provideRouter([]),
        routeProvider,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminTicketTypesPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.adminEvent).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="admin-ticket-types-missing"]')).toBeTruthy();
  });

  it('requires a name, price and quantity', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance as unknown as {
      form: Record<string, unknown>;
      priceEur: number;
    };
    page.form = { name: ' ', quantity: 10 };
    page.priceEur = 10;

    await fixture.componentInstance.save();
    expect(api.ticketTypeCreate).not.toHaveBeenCalled();
    expect(toast.show).toHaveBeenCalledWith('error', 'Please provide a name, price and quantity.');
  });

  it('converts the price to cents on create and forwards optional fields', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance as unknown as {
      form: Record<string, unknown>;
      priceEur: number;
    };
    page.form = {
      name: ' VIP ',
      description: '  Front row  ',
      quantity: 25,
      maxPerCustomer: 2,
      salesStartsAt: '2026-05-01T10:00',
      salesEndsAt: '',
      isVisible: true,
    };
    page.priceEur = 89.995;

    await fixture.componentInstance.save();

    expect(api.ticketTypeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'e1',
        name: 'VIP',
        priceCents: 9000,
        quantity: 25,
        description: 'Front row',
        maxPerCustomer: 2,
        salesStartsAt: new Date('2026-05-01T10:00').toISOString(),
        isVisible: true,
      }),
    );
    expect(toast.show).toHaveBeenCalledWith('success', 'Ticket type added.');
    expect(fixture.componentInstance.editingId()).toBeNull();
  });

  it('prefills cents as euros and updates the existing type', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance as unknown as { priceEur: number; form: { name: string } };

    fixture.componentInstance.startEdit(TICKET_TYPE);
    fixture.detectChanges();
    expect(page.priceEur).toBe(45);
    expect(page.form.name).toBe('Standard');

    await fixture.componentInstance.save();
    expect(api.ticketTypeUpdate).toHaveBeenCalledWith('tt1', expect.objectContaining({ name: 'Standard', priceCents: 4500 }));
    expect(toast.show).toHaveBeenCalledWith('success', 'Ticket type updated.');
  });

  it('deletes only after confirmation and reloads the event', async () => {
    const { fixture, api, toast } = await setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await fixture.componentInstance.remove(TICKET_TYPE);
    expect(api.ticketTypeRemove).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await fixture.componentInstance.remove(TICKET_TYPE);
    expect(api.ticketTypeRemove).toHaveBeenCalledWith('tt1');
    expect(api.adminEvent).toHaveBeenCalledTimes(2);
    expect(toast.show).toHaveBeenCalledWith('success', 'Ticket type deleted.');
  });

  it('toggles and saves section bindings for reserved-seating events', async () => {
    const event = makeEvent({
      reservedSeating: true,
      ticketTypes: [{ ...TICKET_TYPE, sectionIds: ['s1'] }],
    });
    const { fixture, api, toast } = await setup({ event });

    const root = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.isSectionSelected('tt1', 's1')).toBe(true);
    expect(fixture.componentInstance.isSectionSelected('tt1', 's2')).toBe(false);

    const check = root.querySelector('[data-testid="section-check-tt1-s2"]') as HTMLInputElement;
    check.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.isSectionSelected('tt1', 's2')).toBe(true);

    (root.querySelector('[data-testid="save-sections-tt1"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(api.ticketTypeSections).toHaveBeenCalledWith('tt1', ['s1', 's2']);
    expect(toast.show).toHaveBeenCalledWith('success', 'Sections updated for "Standard".');
  });

  it('hides the section editor for non reserved-seating events', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.layout()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="admin-tt-sections"]')).toBeNull();
  });

  it('falls back to no layout when the venue layout request fails', async () => {
    const { fixture } = await setup({ event: makeEvent({ reservedSeating: true }), layout: new Error('layout boom') });
    expect(fixture.componentInstance.layout()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="admin-tt-sections"]')).toBeNull();
  });
});
