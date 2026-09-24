import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { MyOrderListItem } from '../../core/models';

@Component({
  selector: 'app-my-orders',
  imports: [RouterLink, Loading],
  template: `
    <div class="page">
      <h1 class="page-title">My Orders</h1>

      @if (loading()) {
        <app-loading />
      } @else if (orders().length === 0) {
        <div class="card card-pad" data-testid="orders-empty">
          <p>You haven't placed any orders yet.</p>
          <a class="btn btn-primary" routerLink="/events">Browse events</a>
        </div>
      } @else {
        <div class="grid" data-testid="orders-list">
          @for (o of orders(); track o.id) {
            <a class="card card-pad" routerLink="/my-orders/{{ o.id }}" [attr.data-testid]="'order-' + o.id">
              <h2 class="order-number">{{ o.orderNumber }}</h2>
              <p class="meta">{{ formatDate(o.createdAt) }} — {{ itemsLabel(o) }}</p>
              <p class="meta">
                Total {{ cents(o.totalCents) }} · {{ statusLabel(o) }}
              </p>
            </a>
          }
        </div>
        @if (totalPages() > 1) {
          <div class="pagination">
            <button
              class="btn"
              type="button"
              [disabled]="page() <= 1"
              (click)="load(page() - 1)"
              [attr.data-testid]="'orders-prev'"
            >Prev</button>
            <span class="meta">Page {{ page() }} of {{ totalPages() }}</span>
            <button
              class="btn"
              type="button"
              [disabled]="page() >= totalPages()"
              (click)="load(page() + 1)"
              [attr.data-testid]="'orders-next'"
            >Next</button>
          </div>
        }
      }
    </div>
  `,
})
export class MyOrdersPage {
  readonly loading = signal(true);
  readonly orders = signal<MyOrderListItem[]>([]);
  readonly page = signal(1);
  readonly limit = 10;

  private readonly api = inject(ApiService);

  async ngOnInit(): Promise<void> {
    await this.load(1);
  }

  async load(page: number): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.myOrders({ page, limit: this.limit });
      this.orders.set(res.data);
      this.page.set(res.page);
      this._total = res.total;
    } catch {
      this.orders.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private _total = 0;

  totalPages(): number {
    return Math.max(1, Math.ceil(this._total / this.limit));
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }

  itemsLabel(o: MyOrderListItem): string {
    if (!o.items || o.items.length === 0) return 'No items';
    const names = new Set(o.items.map((i) => i.event.name));
    return o.items.length === 1
      ? `${o.items[0].quantity} × ${names.values().next().value}`
      : `${o.items.length} items`;
  }

  statusLabel(o: MyOrderListItem): string {
    return o.status.charAt(0).toUpperCase() + o.status.slice(1);
  }

  cents(c: number): string {
    return `$${(c / 100).toFixed(2)}`;
  }
}
