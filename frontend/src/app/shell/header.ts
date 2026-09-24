import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { CartService } from '../core/cart.service';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  template: `
    <header class="header">
      <a class="brand" routerLink="/">eventia</a>
      <nav class="nav">
        <a routerLink="/events" routerLinkActive="active">Events</a>
        @if (auth.isAuthenticated()) {
          <a routerLink="/my-tickets" routerLinkActive="active">My Tickets</a>
          <a routerLink="/my-orders" routerLinkActive="active">My Orders</a>
          <a routerLink="/my-profile" routerLinkActive="active">My Profile</a>
          <a routerLink="/my-favorites" routerLinkActive="active">My Favorites</a>
          @if (auth.user()?.role === 'admin') {
            <a routerLink="/admin" routerLinkActive="active">Admin</a>
          }
        }
      </nav>
      <div class="actions">
        <a class="cart" routerLink="/cart" aria-label="Cart">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle>
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
          </svg>
          @if (cart.count() > 0) {
            <span class="badge" data-testid="cart-count">{{ cart.count() }}</span>
          }
        </a>
        @if (auth.isAuthenticated(); as authed) {
          <button class="user" (click)="logout()" data-testid="logout">
            {{ auth.user()?.name }}
            <span class="logoff">log out</span>
          </button>
        } @else {
          <a class="btn btn-ghost" routerLink="/auth/login">Log in</a>
          <a class="btn btn-primary" routerLink="/auth/register">Sign up</a>
        }
      </div>
    </header>
  `,
  styles: `
    .header {
      position: sticky; top: 0; z-index: 20;
      display: flex; align-items: center; gap: 24px;
      padding: 12px clamp(16px, 4vw, 40px);
      background: rgba(11, 15, 26, 0.9);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--color-border);
    }
    .brand { font-weight: 800; font-size: 1.3rem; letter-spacing: -0.02em; color: var(--color-text); text-decoration: none; }
    .brand::first-letter { color: var(--color-accent); }
    .nav { display: flex; gap: 16px; flex: 1; }
    .nav a { color: var(--color-text-dim); text-decoration: none; font-size: 0.92rem; padding: 6px 4px; }
    .nav a.active, .nav a:hover { color: var(--color-text); }
    .actions { display: flex; align-items: center; gap: 12px; }
    .cart { position: relative; display: inline-flex; color: var(--color-text-dim); text-decoration: none; padding: 6px; }
    .cart:hover { color: var(--color-text); }
    .badge {
      position: absolute; top: 0; right: -4px; min-width: 18px; height: 18px; padding: 0 4px;
      border-radius: 9px; background: var(--color-accent); color: #fff;
      font-size: 0.7rem; font-weight: 700; display: flex; align-items: center; justify-content: center;
    }
    .user { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; background: none; border: none; color: var(--color-text); cursor: pointer; font-size: 0.9rem; }
    .logoff { font-size: 0.68rem; color: var(--color-text-dim); text-transform: uppercase; letter-spacing: 0.4px; }
  `,
})
export class Header implements OnInit {
  readonly auth = inject(AuthService);
  readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    if (!this.cart.loaded()) {
      try {
        await this.cart.sync();
      } catch {
        this.cart.loaded.set(true);
      }
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.cart.clearLocal();
    this.toast.show('info', 'You have been logged out.');
    await this.router.navigate(['/']);
  }
}