import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminNav } from '../../components/admin-nav';
import { AvailabilityBadge } from '../../components/availability-badge';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { formatCents } from '../../core/format';
import { Category, EventListItem } from '../../core/models';
import type { EventStatus } from '@eventia/shared';

@Component({
  selector: 'app-admin-events',
  imports: [FormsModule, RouterLink, AdminNav, Loading, AvailabilityBadge],
  template: `
    <div class="page">
      <h1 class="page-title">Events</h1>

      <app-admin-nav />

      <div class="toolbar">
        <a class="btn btn-primary" routerLink="/admin/events/new" data-testid="admin-event-create">
          + New event
        </a>
      </div>

      <form class="filters" (ngSubmit)="search()" data-testid="admin-events-search-form">
        <div class="form-field q">
          <input
            class="field"
            name="q"
            [(ngModel)]="query"
            placeholder="Search events"
            data-testid="admin-events-q"
          />
        </div>
        <div class="form-field">
          <select class="field" name="category" [(ngModel)]="category" data-testid="admin-events-category">
            <option value="">All categories</option>
            @for (cat of categories(); track cat.id) {
              <option [value]="cat.id">{{ cat.name }}</option>
            }
          </select>
        </div>
        <div class="form-field">
          <select class="field" name="status" [(ngModel)]="status" data-testid="admin-events-status">
            <option value="">All statuses</option>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="sold_out">sold out</option>
            <option value="cancelled">cancelled</option>
            <option value="finished">finished</option>
          </select>
        </div>
        <div class="form-field">
          <button class="btn btn-primary" type="submit" data-testid="admin-events-search">Search</button>
        </div>
      </form>

      @if (loading()) {
        <app-loading />
      } @else if (events().length === 0) {
        <div class="card card-pad" data-testid="admin-events-empty">
          <p>No events found.</p>
        </div>
      } @else {
        <div class="card card-pad" data-testid="admin-events-list">
          <div class="head">
            <span>Event</span>
            <span>When</span>
            <span>Status</span>
            <span>Availability</span>
            <span>From</span>
            <span>Featured</span>
            <span>Actions</span>
          </div>
          @for (e of events(); track e.id) {
            <div class="row" [attr.data-testid]="'admin-event-' + e.id">
              <div class="event-name">
                <a routerLink="/admin/events/{{ e.id }}/edit">{{ e.name }}</a>
                <span class="muted">{{ e.city }}</span>
              </div>
              <div class="date">{{ shortDate(e.dateTime) }}</div>
              <div class="chip tag-{{ e.status }}">{{ e.status }}</div>
              <app-availability-badge [state]="e.availability.state" />
              <div class="price">{{ e.fromPriceCents ? formatCents(e.fromPriceCents) : '—' }}</div>
              <div class="featured">{{ e.featured ? '★' : '' }}</div>
              <div class="action-links">
                <a [routerLink]="['/admin/events', e.id, 'ticket-types']">Ticket types</a>
                <a [routerLink]="['/admin/events', e.id, 'edit']">Edit</a>
                @if (e.status !== 'published') {
                  <button type="button" class="link-btn" (click)="publish(e.id)">Publish</button>
                } @else {
                  <button type="button" class="link-btn" (click)="unpublish(e.id)">Unpublish</button>
                }
                @if (e.status !== 'sold_out') {
                  <button type="button" class="link-btn" (click)="markSoldOut(e.id)">Sold out</button>
                }
                <button type="button" class="link-btn" (click)="duplicate(e.id)">Duplicate</button>
                <button type="button" class="link-btn danger" (click)="remove(e.id)">Delete</button>
              </div>
            </div>
          }
        </div>

        <div class="pager">
          <button
            class="btn btn-ghost"
            type="button"
            [disabled]="page() <= 1"
            (click)="load(page() - 1)"
            data-testid="admin-events-prev"
          >Previous</button>
          <span class="page-num">{{ page() }} of {{ totalPages() }}</span>
          <button
            class="btn btn-ghost"
            type="button"
            [disabled]="page() >= totalPages()"
            (click)="load(page() + 1)"
            data-testid="admin-events-next"
          >Next</button>
        </div>
      }
    </div>
  `,
  styles: `
    .toolbar { display: flex; justify-content: flex-end; margin-bottom: 16px; }
    .filters { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
    .q { flex: 1; min-width: 220px; }
    .head { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr 0.8fr 0.6fr 2fr; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--color-border); color: var(--color-text-dim); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .row { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr 0.8fr 0.6fr 2fr; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--color-border); }
    .row:last-child { border-bottom: none; }
    .event-name { display: flex; flex-direction: column; gap: 2px; }
    .event-name a { color: var(--color-accent); font-weight: 600; text-decoration: none; }
    .event-name a:hover { color: var(--color-accent-hover); }
    .muted { color: var(--color-text-dim); font-size: 0.85rem; }
    .date { color: var(--color-text-dim); font-size: 0.9rem; }
    .price { font-weight: 600; }
    .featured { color: var(--color-accent); }
    .chip { padding: 3px 10px; border-radius: 999px; font-size: 0.78rem; width: fit-content; }
    .tag-draft { background: var(--color-surface-2); color: var(--color-text); border: 1px solid var(--color-border); }
    .tag-published { background: var(--color-success); color: var(--color-bg); }
    .tag-sold_out { background: var(--color-danger); color: var(--color-bg); }
    .tag-cancelled { background: var(--color-warning); color: var(--color-bg); }
    .tag-finished { background: var(--color-surface-2); color: var(--color-text); border: 1px solid var(--color-border); }
    .action-links { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; font-size: 0.88rem; }
    .action-links a { color: var(--color-text-dim); text-decoration: none; }
    .action-links a:hover { color: var(--color-text); }
    .link-btn { background: none; border: none; color: var(--color-text-dim); cursor: pointer; padding: 0; font-size: 0.88rem; text-decoration: underline; }
    .link-btn:hover { color: var(--color-text); }
    .link-btn.danger { color: var(--color-danger); }
    .pager { display: flex; align-items: center; gap: 14px; margin-top: 18px; }
    .page-num { color: var(--color-text-dim); font-size: 0.9rem; }
    @media (max-width: 900px) {
      .head { display: none; }
      .row { grid-template-columns: 1fr 1fr; }
    }
  `,
})
export class AdminEventsPage {
  readonly loading = signal(true);
  readonly events = signal<EventListItem[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly page = signal(1);
  readonly limit = 20;

  protected query = '';
  protected category = '';
  protected status = '';
  private total = 0;

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly formatCents = formatCents;

  async ngOnInit(): Promise<void> {
    void this.loadCategories();
    await this.load(1);
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  async search(): Promise<void> {
    await this.load(1);
  }

  shortDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }

  async load(page: number): Promise<void> {
    this.loading.set(true);
    try {
      const q = this.query.trim() || undefined;
      const category = this.category || undefined;
      const status = (this.status || undefined) as EventStatus | undefined;
      const res = await this.api.adminEvents({ q, category, status, page, limit: this.limit });
      this.events.set(res.data);
      this.total = res.total;
      this.page.set(res.page);
    } catch (err) {
      this.events.set([]);
      this.toast.show('error', (err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  async publish(id: string): Promise<void> {
    try {
      await this.api.eventPublish(id);
      this.toast.show('success', 'Event published.');
      await this.load(this.page());
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    }
  }

  async unpublish(id: string): Promise<void> {
    try {
      await this.api.eventUnpublish(id);
      this.toast.show('success', 'Event unpublished.');
      await this.load(this.page());
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    }
  }

  async markSoldOut(id: string): Promise<void> {
    try {
      await this.api.eventMarkSoldOut(id);
      this.toast.show('success', 'Event marked sold out.');
      await this.load(this.page());
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    }
  }

  async duplicate(id: string): Promise<void> {
    try {
      await this.api.eventDuplicate(id);
      this.toast.show('success', 'Event duplicated as a draft.');
      await this.load(this.page());
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    }
  }

  async remove(id: string): Promise<void> {
    if (!window.confirm('Delete this event? This can be undone by an administrator.')) return;
    try {
      await this.api.eventRemove(id);
      this.toast.show('success', 'Event deleted.');
      await this.load(this.page());
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    }
  }

  private async loadCategories(): Promise<void> {
    try {
      this.categories.set(await this.api.categories());
    } catch {
      this.categories.set([]);
    }
  }
}