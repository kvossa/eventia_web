import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-admin-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="admin-nav" data-testid="admin-nav">
      <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
      <a routerLink="/admin/events" routerLinkActive="active">Events</a>
      <a routerLink="/admin/orders" routerLinkActive="active">Orders</a>
      <a routerLink="/admin/users" routerLinkActive="active">Users</a>
      <a routerLink="/admin/venues" routerLinkActive="active">Venues</a>
      <a routerLink="/admin/organizers" routerLinkActive="active">Organizers</a>
      <a routerLink="/admin/categories" routerLinkActive="active">Categories</a>
    </nav>
  `,
  styles: `
    .admin-nav {
      display: flex; gap: 4px; flex-wrap: wrap;
      margin-bottom: 24px; padding: 6px; border-radius: var(--radius-card);
      background: var(--color-surface); border: 1px solid var(--color-border);
      width: fit-content;
    }
    .admin-nav a {
      color: var(--color-text-dim); text-decoration: none; font-size: 0.9rem;
      padding: 7px 14px; border-radius: calc(var(--radius-card) - 4px);
    }
    .admin-nav a.active, .admin-nav a:hover { color: var(--color-text); background: var(--color-surface-2); }
  `,
})
export class AdminNav {}