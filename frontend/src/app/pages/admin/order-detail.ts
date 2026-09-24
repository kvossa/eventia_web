import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { formatCents } from '../../core/format';
import { OrderDetailView } from '../../core/models';
import type { OrderStatus } from '@eventia/shared';

@Component({
  selector: 'app-admin-order-detail',
  imports: [FormsModule, RouterLink, Loading],
  template: `
    <div class="page">
      @if (loading()) {
        <app-loading />
      } @else if (order(); as o) {
        <div class="head">
          <div>
            <h1 class="page-title">{{ o.orderNumber }}</h1>
            <p class="meta">{{ shortDate(o.createdAt) }} · {{ statusLabel(o.status) }}</p>
          </div>
          <a class="btn btn-ghost" routerLink="/admin/orders" data-testid="admin-orders-back">← Back to orders</a>
        </div>

        <section class="card card-pad" data-testid="admin-order-detail">
          <h2>Details</h2>
          <div class="detail-row"><span class="muted">Total</span><span class="strong">{{ formatCents(o.totalCents) }}</span></div>
          <div class="detail-row"><span class="muted">Idempotency key</span><span>{{ o.idempotencyKey ?? '—' }}</span></div>
          @if (o.payment) {
            <div class="detail-row">
              <span class="muted">Payment</span>
              <span>{{ paymentLabel(o.payment.status) }} · {{ formatCents(o.payment.amountCents) }} · {{ o.payment.provider }}</span>
            </div>
          } @else {
            <div class="detail-row"><span class="muted">Payment</span><span>None</span></div>
          }
          <div class="detail-row">
            <span class="muted">Status</span>
            <div class="inline">
              <select
                class="field"
                [(ngModel)]="status"
                [disabled]="busy()"
                data-testid="admin-order-status"
              >
                <option value="pending">pending</option>
                <option value="confirmed">confirmed</option>
                <option value="cancelled">cancelled</option>
                <option value="refunded">refunded</option>
              </select>
              <button
                class="btn btn-sm btn-primary"
                type="button"
                [disabled]="busy() || !changed()"
                (click)="updateStatus()"
                data-testid="admin-order-status-save"
              >Save</button>
            </div>
          </div>
        </section>

        <section class="card card-pad items" data-testid="admin-order-items">
          <h2>Items</h2>
          @for (it of o.items; track it.id) {
            <div class="item" [attr.data-testid]="'admin-order-item-' + it.id">
              <div class="item-main">
                <span class="strong">{{ it.event.name }}</span>
                <span class="muted">{{ it.ticketType?.name ?? 'Ticket' }}</span>
              </div>
              <span class="muted">×{{ it.quantity }}</span>
              <span>{{ formatCents(it.subtotalCents) }}</span>
            </div>
          }
        </section>

        <div class="refund-row">
          <button
            class="btn btn-danger"
            type="button"
            [disabled]="busy() || o.status === 'refunded'"
            (click)="refund()"
            data-testid="admin-order-refund"
          >{{ o.status === 'refunded' ? 'Already refunded' : 'Refund order' }}</button>
        </div>
      } @else {
        <div class="card card-pad" data-testid="admin-order-not-found">
          <h2>Order not found</h2>
          <a class="btn btn-primary" routerLink="/admin/orders">← Back to orders</a>
        </div>
      }
    </div>
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
    .card h2 { margin: 0 0 12px; }
    .detail-row { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; border-bottom: 1px solid var(--color-border); }
    .detail-row:last-child { border-bottom: none; }
    .inline { display: flex; gap: 10px; align-items: center; }
    .inline .field { width: 160px; }
    .muted { color: var(--color-text-dim); }
    .strong { font-weight: 600; }
    .items { margin-top: 16px; }
    .item { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--color-border); }
    .item:last-child { border-bottom: none; }
    .item-main { display: flex; flex-direction: column; }
    .refund-row { margin-top: 20px; }
    .refund-row .btn-danger { background: var(--color-danger); color: var(--color-bg); border: none; }
    @media (max-width: 600px) {
      .head { flex-direction: column; }
      .inline { flex-wrap: wrap; }
    }
  `,
})
export class AdminOrderDetailPage {
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly order = signal<OrderDetailView | null>(null);

  protected status: OrderStatus = 'pending';

  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly formatCents = formatCents;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    await this.load(id);
  }

  changed(): boolean {
    const o = this.order();
    return !!o && this.status !== o.status;
  }

  async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const o = await this.api.adminOrder(id);
      this.order.set(o);
      this.status = o.status;
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  async updateStatus(): Promise<void> {
    const o = this.order();
    if (!o || this.status === o.status) return;
    this.busy.set(true);
    try {
      const updated = await this.api.adminOrderStatus(o.id, this.status);
      this.order.set(updated);
      this.status = updated.status;
      this.toast.show('success', `Order ${updated.orderNumber} is now ${updated.status}.`);
    } catch (err) {
      this.toast.show('error', (err as Error).message);
      await this.load(o.id);
    } finally {
      this.busy.set(false);
    }
  }

  async refund(): Promise<void> {
    const o = this.order();
    if (!o || o.status === 'refunded') return;
    this.busy.set(true);
    try {
      const updated = await this.api.adminOrderRefund(o.id);
      this.order.set(updated);
      this.status = updated.status;
      this.toast.show('success', `Order ${updated.orderNumber} refunded.`);
    } catch (err) {
      this.toast.show('error', (err as Error).message);
      await this.load(o.id);
    } finally {
      this.busy.set(false);
    }
  }

  statusLabel(status: OrderStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  paymentLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  shortDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }
}