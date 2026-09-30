import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminOrdersPage } from './orders';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import type { OrderDetailView } from '../../core/models';

const makeOrder = (id: string, status: OrderDetailView['status'] = 'confirmed'): OrderDetailView =>
  ({
    id,
    orderNumber: `EVT-${id}`,
    status,
    totalCents: 4500,
    idempotencyKey: null,
    createdAt: '2026-03-02T10:00:00.000Z',
    items: [
      {
        id: `i-${id}`,
        event: { id: 'evt1', name: 'Symphony Night', dateTime: '2026-12-01T19:30:00.000Z', venue: null },
        ticketType: { id: 'tt1', name: 'General' },
        unitPriceCents: 1500,
        quantity: 3,
      },
    ],
    payment: null,
  }) as OrderDetailView;

interface AdminOrdersPageFilters {
  status: string;
  query: string;
  from: string;
  to: string;
  search: () => Promise<void>;
}

describe('AdminOrdersPage', () => {
  const setup = async (overrides: { total?: number; csv?: string; exportError?: unknown } = {}) => {
    const total = overrides.total ?? 1;
    const api = {
      adminOrders: vi.fn(async (params: { page?: number } = {}) => ({
        data: [makeOrder('1')],
        page: params.page ?? 1,
        limit: 10,
        total,
      })),
      adminOrdersExport: overrides.exportError
        ? vi.fn().mockRejectedValue(overrides.exportError)
        : vi.fn().mockResolvedValue({ csv: overrides.csv ?? 'orderNumber,total\nEVT-1,4500' }),
    };
    const toast = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AdminOrdersPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: toast },
        provideRouter([]),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminOrdersPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api, toast };
  };

  let createObjectURL: ReturnType<typeof vi.spyOn>;
  let revokeObjectURL: ReturnType<typeof vi.spyOn>;
  let anchorClick: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:orders');
    revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists orders and derives the items label', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;

    const row = root.querySelector('[data-testid="admin-order-1"]');
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain('EVT-1');
    expect(row?.textContent).toContain('Symphony Night');
    expect(row?.textContent).toContain('confirmed');
  });

  it('shows the empty state when no orders match', async () => {
    const { fixture, api } = await setup();
    api.adminOrders.mockResolvedValueOnce({ data: [], page: 1, limit: 10, total: 0 });
    await fixture.componentInstance.search();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="admin-orders-empty"]')).toBeTruthy();
  });

  it('passes the active filters to the query', async () => {
    const { fixture, api } = await setup();
    const page = fixture.componentInstance as unknown as AdminOrdersPageFilters;
    page.query = '  EVT-1  ';
    page.status = 'confirmed';
    page.from = '2026-03-01';
    page.to = '2026-03-31';

    await page.search();
    expect(api.adminOrders).toHaveBeenLastCalledWith({
      q: 'EVT-1',
      status: 'confirmed',
      from: '2026-03-01',
      to: '2026-03-31',
      page: 1,
      limit: 10,
    });
  });

  it('omits blank filters entirely', async () => {
    const { fixture, api } = await setup();
    await fixture.componentInstance.search();

    expect(api.adminOrders).toHaveBeenLastCalledWith({
      q: undefined,
      status: undefined,
      from: undefined,
      to: undefined,
      page: 1,
      limit: 10,
    });
  });

  it('exports matching orders as a CSV download', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance as unknown as AdminOrdersPageFilters;
    page.query = 'EVT-1';

    await fixture.componentInstance.exportCsv();
    fixture.detectChanges();

    expect(api.adminOrdersExport).toHaveBeenCalledWith({ q: 'EVT-1', status: undefined, from: undefined, to: undefined });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:orders');
    expect(toast.show).toHaveBeenCalledWith('success', 'Orders exported.');
    expect(fixture.componentInstance.exporting()).toBe(false);
  });

  it('surfaces export failures and clears the busy flag', async () => {
    const { fixture, toast } = await setup({ exportError: new Error('export boom') });

    await fixture.componentInstance.exportCsv();
    fixture.detectChanges();

    expect(toast.show).toHaveBeenCalledWith('error', 'export boom');
    expect(anchorClick).not.toHaveBeenCalled();
    expect(fixture.componentInstance.exporting()).toBe(false);
  });

  it('paginates and reflects the page count', async () => {
    const { fixture, api } = await setup({ total: 25 });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.page-num')?.textContent?.trim()).toBe('1 of 3');
    (root.querySelector('[data-testid="admin-orders-next"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.adminOrders).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(root.querySelector('.page-num')?.textContent?.trim()).toBe('2 of 3');
    (root.querySelector('[data-testid="admin-orders-prev"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(api.adminOrders).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  });
});