import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-admin-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="admin-layout" data-testid="admin-nav">
      <aside class="admin-side">
        <nav class="admin-nav" data-testid="admin-nav-links">
          <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
          <a routerLink="/admin/events" routerLinkActive="active">Events</a>
          <a routerLink="/admin/orders" routerLinkActive="active">Orders</a>
          <a routerLink="/admin/users" routerLinkActive="active">Users</a>
          <a routerLink="/admin/venues" routerLinkActive="active">Venues</a>
          <a routerLink="/admin/organizers" routerLinkActive="active">Organizers</a>
          <a routerLink="/admin/categories" routerLinkActive="active">Categories</a>
        </nav>
      </aside>
      <main class="admin-main"><ng-content /></main>
    </div>
  `,
  styles: `
    .admin-layout { display: grid; grid-template-columns: 220px 1fr; gap: 24px; align-items: start; }
    .admin-side { position: sticky; top: 76px; min-width: 0; }
    .admin-nav { display: flex; flex-direction: column; gap: 2px; padding: 6px; border-radius: var(--radius-card); background: var(--color-surface); border: 1px solid var(--color-border); }
    .admin-nav a {
      color: var(--color-text-dim); text-decoration: none; font-size: 0.9rem;
      padding: 8px 14px; border-radius: calc(var(--radius-card) - 4px); white-space: nowrap;
    }
    .admin-nav a.active, .admin-nav a:hover { color: var(--color-text); background: var(--color-surface-2); }
    .admin-main { min-width: 0; }
    @media (max-width: 900px) {
      .admin-layout { grid-template-columns: 1fr; gap: 16px; }
      .admin-side { position: static; }
      .admin-nav { flex-direction: row; flex-wrap: nowrap; overflow-x: auto; }
    }
  `,
})
export class AdminNav {}