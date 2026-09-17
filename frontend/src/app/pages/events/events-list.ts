import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { EmptyState } from '../../components/empty-state';
import { EventCard } from '../../components/event-card';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { Category, EventListItem, Paginated } from '../../core/models';

const PAGE_SIZE = 12;

interface Filters {
  q?: string;
  category?: string;
  city?: string;
  dateFrom?: string;
  dateTo?: string;
  priceMin?: number;
  priceMax?: number;
  page?: number;
}

@Component({
  selector: 'app-events-list',
  imports: [ReactiveFormsModule, RouterLink, EventCard, Loading, EmptyState],
  template: `
    <div class="page">
      <h1 class="page-title">Events</h1>

      <form class="filters panel" (ngSubmit)="applyFilters()" novalidate>
        <div class="f-row">
          <input class="field" type="text" placeholder="Search…" formControlName="q" />
          <select class="field" formControlName="category">
            <option value="">All categories</option>
            @for (cat of categories(); track cat.id) {
              <option [value]="cat.slug">{{ cat.name }}</option>
            }
          </select>
          <input class="field" type="text" placeholder="City" formControlName="city" />
        </div>
        <div class="f-row">
          <input class="field" type="date" formControlName="dateFrom" />
          <input class="field" type="date" formControlName="dateTo" />
          <input class="field" type="number" min="0" placeholder="Min price (€)" formControlName="priceMin" />
          <input class="field" type="number" min="0" placeholder="Max price (€)" formControlName="priceMax" />
        </div>
        <div class="f-actions">
          <button class="btn btn-primary" type="submit">Apply filters</button>
          <button class="btn btn-ghost" type="button" (click)="reset()">Clear</button>
        </div>
      </form>

      <p class="count">
        @if (loaded()) { {{ events().length }} of {{ total() }} events shown }
      </p>

      @if (loading()) {
        <app-loading />
      } @else if (events().length === 0) {
        <app-empty-state
          title="No events found"
          message="Try adjusting your search or filters."
        >
          <a class="btn btn-ghost" routerLink="/events">Browse all events</a>
        </app-empty-state>
      } @else {
        <div class="grid grid-cards">
          @for (event of events(); track event.id) {
            <app-event-card [event]="event" />
          }
        </div>
        @if (total() > pageSize) {
          <div class="pager">
            <button
              class="btn btn-ghost"
              [disabled]="page() <= 1"
              (click)="goTo(page() - 1)"
            >← Previous</button>
            <span>Page {{ page() }}</span>
            <button
              class="btn btn-ghost"
              [disabled]="page() >= Math.ceil(total() / pageSize)"
              (click)="goTo(page() + 1)"
            >Next →</button>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .panel {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-card);
      padding: 16px;
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .f-row { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
    .f-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .count { color: var(--color-text-dim); font-size: 0.9rem; margin: 4px 0 16px; }
    .pager { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 28px; }
    .pager span { color: var(--color-text-dim); font-size: 0.9rem; }
  `,
})
export class EventsListPage implements OnInit, OnDestroy {
  readonly events = signal<EventListItem[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);
  readonly loaded = signal(false);
  readonly total = signal(0);
  readonly page = signal(1);

  readonly filters = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    category: new FormControl('', { nonNullable: true }),
    city: new FormControl('', { nonNullable: true }),
    dateFrom: new FormControl('', { nonNullable: true }),
    dateTo: new FormControl('', { nonNullable: true }),
    priceMin: new FormControl<number | null>(null),
    priceMax: new FormControl<number | null>(null),
  });

  protected readonly Math = Math;
  protected readonly pageSize = PAGE_SIZE;

  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private sub: Subscription | null = null;

  async ngOnInit(): Promise<void> {
    void this.loadCategories();
    this.sub = this.route.queryParams.subscribe((params) => {
      this.page.set(params['page'] ? Number(params['page']) : 1);
      this.filters.patchValue({
        q: params['q'] ?? '',
        category: params['category'] ?? '',
        city: params['city'] ?? '',
        dateFrom: params['dateFrom'] ?? '',
        dateTo: params['dateTo'] ?? '',
        priceMin: params['priceMin'] ? Number(params['priceMin']) : null,
        priceMax: params['priceMax'] ? Number(params['priceMax']) : null,
      });
      void this.loadEvents();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  applyFilters(): void {
    void this.router.navigate(['/events'], { queryParams: this.toParams() });
  }

  reset(): void {
    this.filters.reset();
    void this.router.navigate(['/events']);
  }

  async goTo(page: number): Promise<void> {
    if (page < 1) return;
    void this.router.navigate(['/events'], {
      queryParams: { ...this.toParams(), page: page > 1 ? page : null },
    });
  }

  private async loadCategories(): Promise<void> {
    try {
      this.categories.set(await this.api.get<Category[]>('/categories'));
    } catch {
      this.categories.set([]);
    }
  }

  private async loadEvents(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.get<Paginated<EventListItem>>('/events', {
        ...this.toParams(),
        page: this.page(),
        limit: PAGE_SIZE,
      });
      this.events.set(res.data);
      this.total.set(res.total);
      this.loaded.set(true);
    } catch {
      this.events.set([]);
      this.total.set(0);
      this.loaded.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private toParams(): Record<string, string | number> {
    const v = this.filters.value;
    const params: Record<string, string | number> = {};
    if (v.q?.trim()) params['q'] = v.q.trim();
    if (v.category) params['category'] = v.category;
    if (v.city?.trim()) params['city'] = v.city.trim();
    if (v.dateFrom) params['dateFrom'] = v.dateFrom;
    if (v.dateTo) params['dateTo'] = v.dateTo;
    if (v.priceMin != null && v.priceMin > 0) params['priceMin'] = Math.round(v.priceMin * 100);
    if (v.priceMax != null && v.priceMax > 0) params['priceMax'] = Math.round(v.priceMax * 100);
    return params;
  }
}