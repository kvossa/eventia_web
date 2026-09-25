import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminNav } from '../../components/admin-nav';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Venue, VenueInput } from '../../core/models';

@Component({
  selector: 'app-admin-venues',
  imports: [FormsModule, RouterLink, AdminNav, Loading],
  template: `
    <div class="page">
      <h1 class="page-title">Venues</h1>

      <app-admin-nav />

      @if (loading()) {
        <app-loading />
      } @else {
        <div class="card card-pad" data-testid="admin-venues-list">
          <div class="head">
            <span>Name</span>
            <span>City</span>
            <span>Address</span>
            <span>Capacity</span>
            <span>Actions</span>
          </div>
          @for (v of venues(); track v.id) {
            <div class="row" [attr.data-testid]="'admin-venue-' + v.id">
              <div class="name">
                @if (editingId() === v.id) {
                  <input class="field" [(ngModel)]="form.name" data-testid="venue-edit-name" />
                } @else {
                  {{ v.name }}
                }
              </div>
              <div class="city">{{ v.city }}</div>
              <div class="address">{{ v.address }}</div>
              <div class="capacity">{{ v.capacity ?? '—' }}</div>
              <div class="actions">
                @if (editingId() === v.id) {
                  <button type="button" class="link-btn" (click)="cancelEdit()">Cancel</button>
                } @else {
                  <button type="button" class="link-btn" (click)="startEdit(v)">Edit</button>
                }
                <a class="link-btn" [routerLink]="['/admin/venues', v.id, 'layout']">Seat layout</a>
                <button type="button" class="link-btn danger" (click)="remove(v)">Delete</button>
              </div>
            </div>
          } @empty {
            <p class="empty" data-testid="admin-venues-empty">No venues yet.</p>
          }
        </div>

        <form class="card card-pad form" (ngSubmit)="save()" data-testid="admin-venues-form" novalidate>
          <h2>{{ editingId() ? 'Edit venue' : 'Add venue' }}</h2>
          <div class="grid-3">
            <div class="form-field">
              <label for="v-name">Name *</label>
              <input id="v-name" class="field" name="v-name" [(ngModel)]="form.name" required data-testid="venue-name" />
            </div>
            <div class="form-field">
              <label for="v-city">City *</label>
              <input id="v-city" class="field" name="v-city" [(ngModel)]="form.city" required data-testid="venue-city" />
            </div>
            <div class="form-field">
              <label for="v-address">Address *</label>
              <input id="v-address" class="field" name="v-address" [(ngModel)]="form.address" required data-testid="venue-address" />
            </div>
          </div>
          <div class="grid-2">
            <div class="form-field">
              <label for="v-capacity">Capacity</label>
              <input id="v-capacity" class="field" type="number" min="1" name="v-capacity" [(ngModel)]="form.capacity" data-testid="venue-capacity" />
            </div>
            <div class="form-field">
              <label for="v-image">Image URL</label>
              <input id="v-image" class="field" name="v-image" [(ngModel)]="form.imageUrl" data-testid="venue-image" />
            </div>
          </div>
          <div class="form-field">
            <label for="v-description">Description</label>
            <textarea id="v-description" class="field" rows="3" name="v-description" [(ngModel)]="form.description" data-testid="venue-description"></textarea>
          </div>
          <div class="actions">
            <button class="btn btn-primary" type="submit" [disabled]="saving()" data-testid="venue-submit">
              {{ saving() ? 'Saving…' : (editingId() ? 'Save changes' : 'Add venue') }}
            </button>
            @if (editingId()) {
              <button type="button" class="btn btn-ghost" (click)="cancelEdit()">Cancel</button>
            }
          </div>
        </form>
      }
    </div>
  `,
  styles: `
    .head { display: grid; grid-template-columns: 1.4fr 1fr 1.6fr 0.8fr 1fr; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--color-border); color: var(--color-text-dim); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .row { display: grid; grid-template-columns: 1.4fr 1fr 1.6fr 0.8fr 1fr; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--color-border); }
    .row:last-child { border-bottom: none; }
    .name { font-weight: 600; }
    .city, .address, .capacity { color: var(--color-text-dim); font-size: 0.9rem; }
    .empty { color: var(--color-text-dim); margin: 10px 0; }
    .actions { display: flex; gap: 12px; }
    .link-btn { background: none; border: none; color: var(--color-text-dim); cursor: pointer; padding: 0; font-size: 0.88rem; text-decoration: underline; }
    .link-btn:hover { color: var(--color-text); }
    .link-btn.danger { color: var(--color-danger); }
    .form { display: flex; flex-direction: column; gap: 16px; max-width: 760px; margin-top: 24px; }
    .form h2 { margin: 0; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field label { font-size: 0.85rem; color: var(--color-text-dim); }
    .actions { display: flex; gap: 12px; margin-top: 4px; }
    @media (max-width: 900px) {
      .head { display: none; }
      .row { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 640px) { .grid-3, .grid-2 { grid-template-columns: 1fr; } }
  `,
})
export class AdminVenuesPage {
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly venues = signal<Venue[]>([]);
  readonly editingId = signal<string | null>(null);

  protected form: VenueInput = this.emptyForm();

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> {
    try {
      this.venues.set(await this.api.venues());
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  startEdit(v: Venue): void {
    this.editingId.set(v.id);
    this.form = {
      name: v.name,
      city: v.city,
      address: v.address,
      capacity: v.capacity ?? null,
      imageUrl: v.imageUrl ?? '',
      description: v.description ?? '',
    };
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.form = this.emptyForm();
  }

  async save(): Promise<void> {
    const name = this.form.name?.trim();
    const city = this.form.city?.trim();
    const address = this.form.address?.trim();
    if (!name || !city || !address) {
      this.toast.show('error', 'Please fill in name, city and address.');
      return;
    }
    this.saving.set(true);
    const body: VenueInput = { name, city, address };
    if (this.form.capacity != null) body.capacity = this.form.capacity;
    if (this.form.imageUrl?.trim()) body.imageUrl = this.form.imageUrl.trim();
    if (this.form.description?.trim()) body.description = this.form.description.trim();
    try {
      if (this.editingId()) {
        await this.api.venueUpdate(this.editingId()!, body);
        this.toast.show('success', 'Venue updated.');
      } else {
        await this.api.venueCreate(body);
        this.toast.show('success', 'Venue added.');
      }
      this.cancelEdit();
      this.venues.set(await this.api.venues());
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(v: Venue): Promise<void> {
    if (!window.confirm(`Delete "${v.name}"?`)) return;
    try {
      await this.api.venueRemove(v.id);
      this.toast.show('success', 'Venue deleted.');
      this.venues.set(await this.api.venues());
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    }
  }

  private emptyForm(): VenueInput {
    return { name: '', city: '', address: '', capacity: null, imageUrl: '', description: '' };
  }
}