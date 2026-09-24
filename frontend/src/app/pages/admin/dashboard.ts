import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminNav } from '../../components/admin-nav';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { formatCents } from '../../core/format';
import { AdminStats } from '../../core/models';

interface StatCard {
  key: string;
  label: string;
  value: number;
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, AdminNav, Loading],
  template: `
    <div class="page">
      <h1 class="page-title">Admin Dashboard</h1>

      <app-admin-nav />

      @if (loading()) {
        <app-loading />
      } @else if (stats()) {
        <div class="grid grid-cards" data-testid="stats-grid">
          @for (card of statCards(); track card.key) {
            <div class="card card-pad stat" [attr.data-testid]="'stat-' + card.key">
              <span class="stat-label">{{ card.label }}</span>
              <span class="stat-value">{{ card.key === 'revenue' ? formatCents(card.value) : card.value }}</span>
            </div>
          }
        </div>

        <section class="card card-pad recent" data-testid="recent-orders">
          <h2>Recent orders</h2>
          @if (stats()!.recentOrders.length === 0) {
            <p class="muted">No orders yet.</p>
          } @else {
            @for (o of stats()!.recentOrders; track o.id) {
              <div class="order" [attr.data-testid]="'recent-order-' + o.id">
                <span class="order-number">{{ o.orderNumber }}</span>
                <span class="muted">{{ o.customerName }} · {{ o.customerEmail }}</span>
                <span class="muted">{{ shortDate(o.createdAt) }} · {{ statusLabel(o.status) }}</span>
                <span class="total">{{ formatCents(o.totalCents) }}</span>
              </div>
            }
          }
        </section>
      } @else {
        <div class="card card-pad" data-testid="stats-empty">
          <p>Could not load dashboard stats.</p>
        </div>
      }
    </div>
  `,
  styles: `
    .stat { display: flex; flex-direction: column; gap: 6px; }
    .stat-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-dim); }
    .stat-value { font-size: 1.5rem; font-weight: 700; color: var(--color-text); }
    .recent { margin-top: 28px; }
    .recent h2 { margin: 0 0 14px; }
    .order { display: grid; grid-template-columns: 1.2fr 2fr 1.5fr auto; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--color-border); }
    .order:last-child { border-bottom: none; }
    .order-number { font-weight: 600; color: var(--color-accent); }
    .total { font-weight: 700; }
    .muted { color: var(--color-text-dim); font-size: 0.9rem; }
    @media (max-width: 720px) {
      .order { grid-template-columns: 1fr; gap: 4px; }
    }
  `,
})
export class AdminDashboardPage {
  readonly loading = signal(true);
  readonly stats = signal<AdminStats | null>(null);

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly statCards = () => {
    const s = this.stats();
    if (!s) return [];
    return [
      { key: 'total-events', label: 'Total events', value: s.totalEvents },
      { key: 'published-events', label: 'Published events', value: s.publishedEvents },
      { key: 'upcoming-events', label: 'Upcoming events', value: s.upcomingEvents },
      { key: 'total-users', label: 'Users', value: s.totalUsers },
      { key: 'total-orders', label: 'Orders', value: s.totalOrders },
      { key: 'tickets-sold', label: 'Tickets sold', value: s.ticketsSold },
      { key: 'revenue', label: 'Revenue', value: s.totalRevenueCents },
    ] as StatCard[];
  };

  protected readonly formatCents = formatCents;

  async ngOnInit(): Promise<void> {
    try {
      this.stats.set(await this.api.adminStats());
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  statusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  shortDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }
}