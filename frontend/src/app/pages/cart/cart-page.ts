import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyState } from '../../components/empty-state';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { formatCents, formatDateTime } from '../../core/format';
import { CartLine } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-cart',
  imports: [RouterLink, EmptyState],
  template: `
    <div class="page">
      <h1 class="page-title">Your cart</h1>

      @if (loading()) {
        <div class="card card-pad center">Loading your cart…</div>
      } @else if (cart.items().length === 0) {
        <app-empty-state
          title="Your cart is empty"
          message="Find an event you like and add some tickets."
        >
          <a class="btn btn-primary" routerLink="/events">Browse events</a>
        </app-empty-state>
      } @else {
        <div class="cart-layout">
          <div class="lines">
            @for (item of cart.items(); track item.id) {
              <div class="line card card-pad" data-testid="cart-line">
                <div class="line-main">
                  <div class="line-head">
                    <a [routerLink]="['/events', item.event.id]">
                      <h3>{{ item.event.name }}</h3>
                    </a>
                    <span class="date">{{ formatDateTime(item.event.dateTime) }}</span>
                  </div>
                  <p class="tt-name">{{ item.ticketType.name }}</p>
                  <p class="unit">{{ formatCents(item.unitPriceCents) }} each</p>
                </div>
                <div class="line-controls">
                  <div class="qty">
                    <button
                      class="btn btn-ghost btn-sm"
                      type="button"
                      [disabled]="busy()"
                      (click)="change(item.id, item.quantity - 1)"
                    >−</button>
                    <span class="qty-val" data-testid="item-qty">{{ item.quantity }}</span>
                    <button
                      class="btn btn-ghost btn-sm"
                      type="button"
                      [disabled]="busy() || item.quantity >= maxFor(item)"
                      (click)="change(item.id, item.quantity + 1)"
                    >+</button>
                    <button
                      class="btn btn-ghost btn-sm remove"
                      type="button"
                      [disabled]="busy()"
                      (click)="remove(item.id)"
                    >Remove</button>
                  </div>
                  <span class="line-total">{{ formatCents(item.subtotalCents) }}</span>
                </div>
              </div>
            }
          </div>

          <aside class="summary card card-pad">
            <h2>Summary</h2>
            <div class="row"><span>Subtotal</span><span>{{ formatCents(cart.subtotalCents()) }}</span></div>
            <div class="row"><span>Service</span><span>Included</span></div>
            <hr class="divider-line" />
            <div class="row total"><span>Total</span><span data-testid="cart-total">{{ formatCents(cart.subtotalCents()) }}</span></div>
            @if (auth.isAuthenticated()) {
              <a class="btn btn-primary btn-block" routerLink="/checkout">Proceed to checkout</a>
            } @else {
              <a class="btn btn-primary btn-block" routerLink="/auth/login"
                 [queryParams]="{ returnUrl: 'checkout' }">Log in to check out</a>
              <p class="hint">You need an account to purchase tickets. Your cart is saved.</p>
            }
          </aside>
        </div>
      }
    </div>
  `,
  styles: `
    .center { text-align: center; color: var(--color-text-dim); }
    .cart-layout { display: grid; gap: 20px; grid-template-columns: 1fr 320px; align-items: start; }
    @media (max-width: 840px) { .cart-layout { grid-template-columns: 1fr; } }
    .line { display: flex; justify-content: space-between; gap: 16px; padding: 18px 20px; }
    .line-main h3 { margin: 0 0 4px; }
    .line-main > a { text-decoration: none; color: inherit; }
    .date { color: var(--color-text-dim); font-size: 0.85rem; }
    .tt-name { margin: 8px 0 2px; font-weight: 600; }
    .unit { margin: 0; color: var(--color-text-dim); font-size: 0.85rem; }
    .line-controls { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; justify-content: center; }
    .qty { display: flex; align-items: center; gap: 8px; }
    .qty-val { min-width: 28px; text-align: center; font-weight: 700; }
    .remove { color: var(--color-danger); }
    .line-total { font-weight: 700; }
    .summary h2 { margin: 0 0 12px; font-size: 1.2rem; }
    .summary .row { display: flex; justify-content: space-between; margin-bottom: 8px; color: var(--color-text-dim); }
    .summary .total { color: var(--color-text); font-weight: 700; font-size: 1.05rem; margin-bottom: 16px; }
    .hint { margin-top: 10px; color: var(--color-text-dim); font-size: 0.8rem; }
  `,
})
export class CartPage implements OnInit {
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly busy = signal(false);

  protected readonly formatCents = formatCents;
  protected readonly formatDateTime = formatDateTime;

  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> {
    if (!this.cart.loaded()) {
      try {
        await this.cart.sync();
      } catch {
        this.cart.clearLocal();
      }
    }
    this.loading.set(false);
  }

  maxFor(item: CartLine): number {
    const remaining = item.ticketType.quantity - item.ticketType.quantitySold;
    return Math.max(1, Math.min(remaining, item.ticketType.maxPerCustomer ?? 10, 10));
  }

  async change(itemId: string, quantity: number): Promise<void> {
    this.busy.set(true);
    try {
      await this.cart.updateQuantity(itemId, quantity);
    } catch (err) {
      const api = err as { message?: string };
      this.toast.show('error', api.message ?? 'Could not update the cart.');
    } finally {
      this.busy.set(false);
    }
  }

  async remove(itemId: string): Promise<void> {
    this.busy.set(true);
    try {
      await this.cart.remove(itemId);
      this.toast.show('info', 'Item removed from your cart.');
    } catch (err) {
      const api = err as { message?: string };
      this.toast.show('error', api.message ?? 'Could not remove the item.');
    } finally {
      this.busy.set(false);
    }
  }
}