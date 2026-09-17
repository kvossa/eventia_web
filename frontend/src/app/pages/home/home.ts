import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EventCard } from '../../components/event-card';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { Category, EventListItem, Paginated } from '../../core/models';

@Component({
  selector: 'app-home',
  imports: [ReactiveFormsModule, RouterLink, EventCard, Loading],
  template: `
    <section class="hero">
      <div class="hero-inner">
        <h1>Discover your next night out</h1>
        <p>Concerts, theatre, festivals and more — all in one place.</p>
        <form class="hero-search" (ngSubmit)="search()">
          <input
            class="field"
            type="text"
            placeholder="Search artists, events, venues…"
            [formControl]="searchQuery"
            data-testid="hero-search"
          />
          <button class="btn btn-primary" type="submit">Search</button>
        </form>
      </div>
    </section>

    <div class="page">
      @if (categories(); as cats) {
        <div class="chips">
          @for (cat of cats; track cat.id) {
            <a class="chip" [routerLink]="['/events']" [queryParams]="{ category: cat.slug }">
              {{ cat.name }}
            </a>
          }
        </div>
      }

      @if (featured()?.length) {
        <section class="section">
          <div class="section-head">
            <h2>Featured events</h2>
            <a class="more" routerLink="/events">See all →</a>
          </div>
          <div class="grid grid-cards">
            @for (event of featured()!; track event.id) {
              <app-event-card [event]="event" />
            }
          </div>
        </section>
      }

      <section class="section">
        <div class="section-head">
          <h2>Upcoming events</h2>
          <a class="more" routerLink="/events">See all →</a>
        </div>
        @if (spotlight()) {
          <div class="grid grid-cards">
            @for (event of spotlight()!; track event.id) {
              <app-event-card [event]="event" />
            }
          </div>
        } @else {
          <app-loading />
        }
      </section>
    </div>
  `,
  styles: `
    .hero {
      background:
        radial-gradient(1200px 400px at 70% -10%, rgba(139, 92, 246, 0.28), transparent),
        linear-gradient(180deg, #0c1120, var(--color-bg));
      border-bottom: 1px solid var(--color-border);
      padding: 64px clamp(16px, 4vw, 40px);
    }
    .hero-inner { max-width: var(--container); margin: 0 auto; }
    .hero h1 { font-size: clamp(1.9rem, 4vw, 2.8rem); margin: 0 0 8px; }
    .hero p { color: var(--color-text-dim); margin: 0 0 24px; }
    .hero-search { display: flex; gap: 10px; max-width: 560px; }
    .hero-search .field { padding: 14px 16px; }
    .chips { display: flex; flex-wrap: wrap; gap: 10px; margin: 24px 0; }
    .chip {
      padding: 8px 16px; border-radius: 999px;
      background: var(--color-surface); border: 1px solid var(--color-border);
      color: var(--color-text-dim); text-decoration: none; font-size: 0.9rem;
    }
    .chip:hover { border-color: var(--color-accent); color: var(--color-text); }
    .section { margin: 32px 0; }
    .section-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 16px; }
    .section-head h2 { margin: 0; }
    .more { color: var(--color-text-dim); text-decoration: none; font-size: 0.9rem; }
    .more:hover { color: var(--color-accent); }
  `,
})
export class HomePage implements OnInit {
  readonly searchQuery = new FormControl('', { nonNullable: true });

  readonly categories = signal<Category[] | null>(null);
  readonly featured = signal<EventListItem[] | null>(null);
  readonly spotlight = signal<EventListItem[] | null>(null);

  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    void this.api.get<Category[]>('/categories').then((c) => this.categories.set(c)).catch(() => this.categories.set([]));
    void this.api
      .get<Paginated<EventListItem>>('/events', { limit: 8 })
      .then((r) => {
        this.featured.set(r.data.filter((e) => e.featured).slice(0, 4));
        this.spotlight.set(r.data);
      })
      .catch(() => {
        this.featured.set([]);
        this.spotlight.set([]);
      });
  }

  search(): void {
    const q = this.searchQuery.value.trim();
    void this.router.navigate(['/events'], q ? { queryParams: { q } } : {});
  }
}