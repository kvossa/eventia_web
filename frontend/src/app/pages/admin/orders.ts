import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminNav } from '../../components/admin-nav';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { formatCents } from '../../core/format';
import { OrderDetailView } from '../../core/models';
import type { OrderStatus } from '@eventia/shared';

@Component({
  selector: 'app-admin-orders',
  imports: [FormsModule, RouterLink, AdminNav, Loading],
  template: `
    <div class="page">
      <h1 class="page-title">Orders</h1>

      <app-admin-nav />

      <form class="filters" (ngSubmit)="search()" data-testid="admin-orders-search-form">
        <div class="form-field status">
          <select
            class="field"
            name="status"
            [(ngModel)]="status"
            data-testid="admin-orders-status"
          >
            <option value="">All statuses</option>
            <option value="pending">pending</option>
            <option value="confirmed">confirmed</option>
            <option value="cancelled">cancelled</option>
            <option value="refunded">refunded</option>
          </select>
        </div>
        <div class="form-field q">
          <input
            class="field"
            name="q"
            [(ngModel)]="query"
            placeholder="Order number, email or name"
            data-testid="admin-orders-q"
          />
        </div>
        <div class="form-field">
          <input class="field" type="date" name="from" [(ngModel)]="from" data-testid="admin-orders-from" />
        </div>
        <div class="form-field">
          <input class="field" type="date" name="to" [(ngModel)]="to" data-testid="admin-orders-to" />
        </div>
        <div class="form-field">
          <button class="btn btn-primary" type="submit" data-testid="admin-orders-search">Search</button>
        </div>
      </form>

      @if (loading()) {
        <app-loading />
      } @else if (orders().length === 0) {
        <div class="card card-pad" data-testid="admin-orders-empty">
          <p>No orders found.</p>
        </div>
      } @else {
        <div class="card card-pad" data-testid="admin-orders-list">
          <div class="head">
            <span>Order</span>
            <span>Status</span>
            <span>Total</span>
            <span>Created</span>
            <span>Items</span>
          </div>
          @for (o of orders(); track o.id) {
            <a class="row" routerLink="/admin/orders/{{ o.id }}" [attr.data-testid]="'admin-order-' + o.id">
              <span class="order-number">{{ o.orderNumber }}</span>
              <span class="chip tag-{{ o.status }}">{{ o.status }}</span>
              <span class="total">{{ formatCents(o.totalCents) }}</span>
              <span class="date">{{ shortDate(o.createdAt) }}</span>
              <span class="date">{{ itemsLabel(o) }}</span>
            </a>
          }
        </div>

        <div class="pager">
          <button
            class="btn btn-ghost"
            type="button"
            [disabled]="page() <= 1"
            (click)="load(page() - 1)"
            data-testid="admin-orders-prev"
          >Previous</button>
          <span class="page-num">{{ page() }} of {{ totalPages() }}</span>
          <button
            class="btn btn-ghost"
            type="button"
            [disabled]="page() >= totalPages()"
            (click)="load(page() + 1)"
            data-testid="admin-orders-next"
          >Next</button>
        </div>
      }
    </div>
  `,
  styles: `
    .filters { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
    .q { flex: 1; min-width: 220px; }
    .head { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--color-border); color: var(--color-text-dim); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .row { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--color-border); color: var(--color-text); text-decoration: none; }
    .row:last-child { border-bottom: none; }
    .row:hover .order-number { color: var(--color-accent-hover); }
    .order-number { font-weight: 600; color: var(--color-accent); }
    .total { font-weight: 600; }
    .date { color: var(--color-text-dim); font-size: 0.9rem; }
    .chip { padding: 3px 10px; border-radius: 999px; font-size: 0.8rem; width: fit-content; }
    .tag-pending { background: var(--color-warning); color: var(--color-bg); }
    .tag-confirmed { background: var(--color-success); color: var(--color-bg); }
    .tag-cancelled { background: var(--color-surface-2); color: var(--color-text); border: 1px solid var(--color-border); }
    .tag-refunded { background: var(--color-danger); color: var(--color-bg); }
    .pager { display: flex; align-items: center; gap: 14px; margin-top: 18px; }
    .page-num { color: var(--color-text-dim); font-size: 0.9rem; }
    @media (max-width: 760px) {
      .head { display: none; }
      .row { grid-template-columns: 1fr 1fr; }
    }
  `,
})
export class AdminOrdersPage {
  readonly loading = signal(true);
  readonly orders = signal<OrderDetailView[]>([]);
  readonly page = signal(1);
  readonly limit = 10;

  protected status = '';
  protected query = '';
  protected from = '';
  protected to = '';
  private total = 0;

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly formatCents = formatCents;

  async ngOnInit(): Promise<void> {
    await this.load(1);
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  async search(): Promise<void> {
    await this.load(1);
  }

  itemsLabel(o: OrderDetailView): string {
    return o.items.map((it) => it.event.name).join(', ') || '—';
  }

  shortDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }

  async load(page: number): Promise<void> {
    this.loading.set(true);
    try {
      const q = this.query.trim() || undefined;
      const status = (this.status || undefined) as OrderStatus | undefined;
      const from = this.from || undefined;
      const to = this.to || undefined;
      const res = await this.api.adminOrders({ q, status, from, to, page, limit: this.limit });
      this.orders.set(res.data);
      this.total = res.total;
      this.page.set(res.page);
    } catch (err) {
      this.orders.set([]);
      this.toast.show('error', (err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
}