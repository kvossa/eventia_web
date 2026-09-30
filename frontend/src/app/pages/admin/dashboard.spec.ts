import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDashboardPage } from './dashboard';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import type { AdminStats } from '../../core/models';

const STATS: AdminStats = {
  totalEvents: 42,
  publishedEvents: 30,
  totalUsers: 128,
  totalOrders: 87,
  totalRevenueCents: 123456,
  ticketsSold: 210,
  upcomingEvents: 5,
  recentOrders: [
    {
      id: 'o1',
      orderNumber: 'EVT-1001',
      status: 'confirmed',
      totalCents: 4500,
      createdAt: '2026-03-02T10:00:00.000Z',
      customerName: 'Ada Lovelace',
      customerEmail: 'ada@example.com',
    },
  ],
};

describe('AdminDashboardPage', () => {
  const setup = async (stats: AdminStats | Error = STATS) => {
    const api = {
      adminStats: stats instanceof Error ? vi.fn().mockRejectedValue(stats) : vi.fn().mockResolvedValue(stats),
    };
    const toast = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AdminDashboardPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: toast },
        provideRouter([]),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api, toast };
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('renders every stat card with raw counts and formatted revenue', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="stat-total-events"]')?.textContent).toContain('42');
    expect(root.querySelector('[data-testid="stat-published-events"]')?.textContent).toContain('30');
    expect(root.querySelector('[data-testid="stat-upcoming-events"]')?.textContent).toContain('5');
    expect(root.querySelector('[data-testid="stat-total-users"]')?.textContent).toContain('128');
    expect(root.querySelector('[data-testid="stat-total-orders"]')?.textContent).toContain('87');
    expect(root.querySelector('[data-testid="stat-tickets-sold"]')?.textContent).toContain('210');
    expect(root.querySelector('[data-testid="stat-revenue"]')?.textContent).toMatch(/1[.,]?234/);
    expect(root.querySelector('[data-testid="stat-revenue"]')?.textContent).not.toContain('123456');
  });

  it('lists recent orders with a capitalised status', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;

    const row = root.querySelector('[data-testid="recent-order-o1"]');
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain('EVT-1001');
    expect(row?.textContent).toContain('Ada Lovelace');
    expect(row?.textContent).toContain('Confirmed');
  });

  it('shows the empty state when there are no orders', async () => {
    const { fixture } = await setup({ ...STATS, recentOrders: [] });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="recent-orders"]')?.textContent).toContain('No orders yet.');
  });

  it('reports a failed load and shows the error card', async () => {
    const { fixture, toast } = await setup(new Error('boom'));
    const root = fixture.nativeElement as HTMLElement;

    expect(toast.show).toHaveBeenCalledWith('error', 'boom');
    expect(root.querySelector('[data-testid="stats-empty"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="stats-grid"]')).toBeNull();
  });
});