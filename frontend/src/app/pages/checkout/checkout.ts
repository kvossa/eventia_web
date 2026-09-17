import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { formatCents, formatDateTime } from '../../core/format';
import { OrderDetailView } from '../../core/models';
import { ToastService } from '../../core/toast.service';

function makeKey(): string {
  const k = crypto.randomUUID();
  sessionStorage.setItem('evt_checkout_key', k);
  return k;
}

@Component({
  selector: 'app-checkout',
  imports: [RouterLink],
  template: `
    <div class="page">
      <h1 class="page-title">Checkout</h1>

      @if (successOrder(); as order) {
        <div class="success card card-pad">
          <div class="tick">✓</div>
          <h2>Payment confirmed</h2>
          <p class="order-number">Order number: <strong data-testid="order-number">{{ order.orderNumber }}</strong></p>
          <p class="muted">A simulated payment of {{ formatCents(order.totalCents) }} was completed.</p>
          <div class="totals">
            <div class="row"><span>Total paid</span><span>{{ formatCents(order.totalCents) }}</span></div>
            <div class="row"><span>Payment</span><span>{{ order.payment?.status }} ({{ order.payment?.provider }})</span></div>
          </div>
          <div class="cta">
            <a class="btn btn-primary" routerLink="/my-tickets">View my tickets</a>
            <a class="btn btn-ghost" routerLink="/">Back to home</a>
          </div>
        </div>
      } @else if (loading()) {
        <div class="card card-pad center">Preparing your order…</div>
      } @else if (cart.items().length === 0) {
        <div class="card card-pad center">
          <p>Your cart is empty.</p>
          <a class="btn btn-ghost" routerLink="/events">Browse events</a>
        </div>
      } @else {
        <div class="layout">
          <div class="summary card card-pad">
            <h2>Your order</h2>
            @for (item of cart.items(); track item.id) {
              <div class="line">
                <div>
                  <p class="name">{{ item.event.name }}</p>
                  <p class="date">{{ formatDateTime(item.event.dateTime) }}</p>
                  <p class="tt">{{ item.quantity }} × {{ item.ticketType.name }}</p>
                </div>
                <span class="amount">{{ formatCents(item.subtotalCents) }}</span>
              </div>
            }
            <hr class="divider-line" />
            <div class="total-row"><span>Total</span><span data-testid="checkout-total">{{ formatCents(cart.subtotalCents()) }}</span></div>
          </div>

          <div class="pay card card-pad">
            <h2>Payment</h2>
            <p class="muted">
              Paying as <strong>{{ auth.user()?.name }}</strong> ({{ auth.user()?.email }}).
              This is a <strong>simulated</strong> payment — no real money is charged.
            </p>
            <div class="card-ghost">
              <span>Stripe (simulated)</span>
              <span class="cc">•••• 4242</span>
            </div>
            <button
              class="btn btn-primary btn-block"
              [disabled]="paying()"
              (click)="pay()"
              data-testid="pay"
            >{{ paying() ? 'Processing payment…' : 'Pay ' + formatCents(cart.subtotalCents()) }}</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .center { text-align: center; color: var(--color-text-dim); padding: 40px; }
    .layout { display: grid; gap: 20px; grid-template-columns: 1fr 360px; align-items: start; }
    @media (max-width: 840px) { .layout { grid-template-columns: 1fr; } }
    .summary h2, .pay h2 { margin: 0 0 12px; font-size: 1.2rem; }
    .line { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .name { margin: 0; font-weight: 600; }
    .date, .tt { margin: 0; color: var(--color-text-dim); font-size: 0.87rem; }
    .amount { font-weight: 700; }
    .total-row { display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 700; }
    .muted { color: var(--color-text-dim); font-size: 0.9rem; line-height: 1.5; }
    .card-ghost {
      display: flex; justify-content: space-between; align-items: center;
      background: var(--color-surface-2); border: 1px dashed var(--color-border);
      border-radius: var(--radius-sm); padding: 12px 14px; margin: 16px 0;
      font-size: 0.9rem;
    }
    .cc { color: var(--color-text-dim); }
    .success { text-align: center; max-width: 520px; margin: 0 auto; padding: 40px; }
    .tick {
      width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 50%;
      background: rgba(52, 211, 153, 0.15); color: var(--color-success);
      display: flex; align-items: center; justify-content: center; font-size: 1.6rem;
    }
    .success h2 { margin: 0 0 6px; }
    .order-number { margin: 0 0 4px; }
    .muted { margin: 0 0 16px; }
    .totals { text-align: left; margin: 16px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 8px; color: var(--color-text-dim); }
    .cta { display: flex; gap: 10px; justify-content: center; }
  `,
})
export class CheckoutPage implements OnInit {
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly paying = signal(false);
  readonly successOrder = signal<OrderDetailView | null>(null);

  protected readonly formatCents = formatCents;
  protected readonly formatDateTime = formatDateTime;

  async ngOnInit(): Promise<void> {
    if (!this.cart.loaded()) {
      await this.cart.sync().catch(() => this.cart.clearLocal());
    }
    this.loading.set(false);
  }

  async pay(): Promise<void> {
    this.paying.set(true);
    try {
      const order = await this.api.post<OrderDetailView>('/checkout', { idempotencyKey: makeKey() });
      sessionStorage.removeItem('evt_checkout_key');
      this.successOrder.set(order);
      this.cart.clearLocal();
    } catch (err) {
      const api = err as { code?: string; message?: string };
      sessionStorage.removeItem('evt_checkout_key');
      const message =
        api.code === 'CART_EMPTY'
          ? 'Your cart is empty. Add some tickets first.'
          : api.message ?? 'Payment failed. Please try again.';
      this.toast.show('error', message);
    } finally {
      this.paying.set(false);
    }
  }
}