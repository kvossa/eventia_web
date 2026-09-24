import { Component, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { OrderDetailView } from '../../core/models';

@Component({
  selector: 'app-my-order-detail',
  imports: [RouterLink, Loading],
  template: `
    <div class="page">
      @if (loading()) {
        <app-loading />
      } @else if (order()) {
        <div class="card card-pad" data-testid="order-detail">
          <h2 class="page-title">{{ order()!.orderNumber }}</h2>
          <p class="meta">{{ formatDate(order()!.createdAt) }} · {{ statusLabel(order()!) }}</p>
          <p class="meta">Total {{ cents(order()!.totalCents) }}</p>
        </div>

        <div class="grid" data-testid="order-items">
          @for (it of order()!.items; track it.id) {
            <div class="card card-pad" [attr.data-testid]="'order-item-' + it.id">
              <h3 class="event-name">{{ it.event.name }}</h3>
              <p class="meta">{{ it.ticketType?.name ?? 'Ticket' }} · {{ cents(it.subtotalCents) }}</p>
            </div>
          }
        </div>

        @if (order()!.status === 'confirmed') {
          <div class="cancel-row">
            <button
              class="btn btn-danger"
              type="button"
              [disabled]="cancelling()"
              (click)="cancel()"
              data-testid="cancel-order"
            >{{ cancelling() ? 'Cancelling…' : 'Cancel order & refund' }}</button>
          </div>
        }

        <a class="btn btn-primary" routerLink="/my-orders" data-testid="orders-back">Back to My Orders</a>
      } @else {
        <div class="card card-pad" data-testid="order-not-found">
          <p>Order not found.</p>
          <a class="btn btn-primary" routerLink="/my-orders">Back to My Orders</a>
        </div>
      }
    </div>
  `,
  styles: `
    .cancel-row { margin: 18px 0; }
    .btn-danger { background: var(--color-danger); color: var(--color-bg); border: none; }
  `,
})
export class MyOrderDetailPage {
  readonly loading = signal(true);
  readonly cancelling = signal(false);
  readonly order = signal<OrderDetailView | null>(null);

  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    try {
      this.order.set(await this.api.myOrder(id));
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }

  statusLabel(o: OrderDetailView): string {
    return o.status.charAt(0).toUpperCase() + o.status.slice(1);
  }

  async cancel(): Promise<void> {
    const o = this.order();
    if (!o || o.status !== 'confirmed') return;
    if (!window.confirm(`Cancel order ${o.orderNumber} and refund ${this.cents(o.totalCents)}?`)) return;
    this.cancelling.set(true);
    try {
      const updated = await this.api.cancelOrder(o.id);
      this.order.set(updated);
      this.toast.show('success', `Order ${updated.orderNumber} cancelled and refunded.`);
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.cancelling.set(false);
    }
  }

  cents(c: number): string {
    return `$${(c / 100).toFixed(2)}`;
  }
}
