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

        <a class="btn btn-primary" routerLink="/my-orders" data-testid="orders-back">Back to My Orders</a>
      } @else {
        <div class="card card-pad" data-testid="order-not-found">
          <p>Order not found.</p>
          <a class="btn btn-primary" routerLink="/my-orders">Back to My Orders</a>
        </div>
      }
    </div>
  `,
})
export class MyOrderDetailPage {
  readonly loading = signal(true);
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

  cents(c: number): string {
    return `$${(c / 100).toFixed(2)}`;
  }
}
