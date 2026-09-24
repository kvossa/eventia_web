import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { FavoriteView } from '../../core/models';

@Component({
  selector: 'app-my-favorites',
  imports: [RouterLink, Loading],
  template: `
    <div class="page">
      <h1 class="page-title">My Favorites</h1>

      @if (loading()) {
        <app-loading />
      } @else if (items().length === 0) {
        <div class="card card-pad" data-testid="favorites-empty">
          <p>You haven't saved any favorite events yet.</p>
          <a class="btn btn-primary" routerLink="/events">Browse events</a>
        </div>
      } @else {
        <div class="grid" data-testid="favorites-list">
          @for (ev of items(); track ev.id) {
            <div class="card card-pad" [attr.data-testid]="'favorite-' + ev.id">
              <a class="event-name" routerLink="/events/{{ ev.id }}">
                <h2>{{ ev.name }}</h2>
                <p class="meta">{{ ev.dateTime }} · {{ ev.city }}</p>
                <p class="meta">{{ ev.venue?.name }} — {{ ev.venue?.address }}</p>
                <p class="meta">Favorited {{ favoriteDate(ev.favoritedAt) }}</p>
              </a>
              <div class="actions">
                <button
                  class="btn btn-danger"
                  type="button"
                  (click)="remove(ev.id)"
                  [disabled]="removing()"
                  [attr.data-testid]="'favorite-remove-' + ev.id"
                >Remove</button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class MyFavoritesPage {
  readonly loading = signal(true);
  readonly removing = signal(false);
  readonly items = signal<FavoriteView[]>([]);

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> {
    try {
      const res = await this.api.favorites();
      this.items.set(res.data ?? []);
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  favoriteDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }

  async remove(id: string): Promise<void> {
    this.removing.set(true);
    try {
      await this.api.favoriteRemove(id);
      this.items.update((list) => list.filter((ev) => ev.id !== id));
      this.toast.show('success', 'Removed from favorites.');
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.removing.set(false);
    }
  }
}
