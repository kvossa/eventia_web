import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminNav } from '../../components/admin-nav';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Organizer, OrganizerInput } from '../../core/models';

@Component({
  selector: 'app-admin-organizers',
  imports: [FormsModule, AdminNav, Loading],
  template: `
    <div class="page">
      <h1 class="page-title">Organizers</h1>

      <app-admin-nav />

      @if (loading()) {
        <app-loading />
      } @else {
        <div class="card card-pad" data-testid="admin-organizers-list">
          <div class="head">
            <span>Name</span>
            <span>Slug</span>
            <span>Website</span>
            <span>Actions</span>
          </div>
          @for (o of organizers(); track o.id) {
            <div class="row" [attr.data-testid]="'admin-organizer-' + o.id">
              <div class="name">
                @if (editingId() === o.id) {
                  <input class="field" [(ngModel)]="form.name" data-testid="organizer-edit-name" />
                } @else {
                  {{ o.name }}
                }
              </div>
              <div class="slug">{{ o.slug }}</div>
              <div class="website">{{ o.websiteUrl ?? '—' }}</div>
              <div class="actions">
                @if (editingId() === o.id) {
                  <button type="button" class="link-btn" (click)="cancelEdit()">Cancel</button>
                } @else {
                  <button type="button" class="link-btn" (click)="startEdit(o)">Edit</button>
                }
                <button type="button" class="link-btn danger" (click)="remove(o)">Delete</button>
              </div>
            </div>
          } @empty {
            <p class="empty" data-testid="admin-organizers-empty">No organizers yet.</p>
          }
        </div>

        <form class="card card-pad form" (ngSubmit)="save()" data-testid="admin-organizers-form" novalidate>
          <h2>{{ editingId() ? 'Edit organizer' : 'Add organizer' }}</h2>
          <div class="grid-2">
            <div class="form-field">
              <label for="o-name">Name *</label>
              <input id="o-name" class="field" name="o-name" [(ngModel)]="form.name" required data-testid="organizer-name" />
            </div>
            <div class="form-field">
              <label for="o-slug">Slug *</label>
              <input id="o-slug" class="field" name="o-slug" [(ngModel)]="form.slug" required data-testid="organizer-slug" />
            </div>
          </div>
          <div class="grid-2">
            <div class="form-field">
              <label for="o-website">Website URL</label>
              <input id="o-website" class="field" name="o-website" [(ngModel)]="form.websiteUrl" data-testid="organizer-website" />
            </div>
            <div class="form-field">
              <label for="o-logo">Logo URL</label>
              <input id="o-logo" class="field" name="o-logo" [(ngModel)]="form.logoUrl" data-testid="organizer-logo" />
            </div>
          </div>
          <div class="form-field">
            <label for="o-description">Description</label>
            <textarea id="o-description" class="field" rows="3" name="o-description" [(ngModel)]="form.description" data-testid="organizer-description"></textarea>
          </div>
          <div class="actions">
            <button class="btn btn-primary" type="submit" [disabled]="saving()" data-testid="organizer-submit">
              {{ saving() ? 'Saving…' : (editingId() ? 'Save changes' : 'Add organizer') }}
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
    .head { display: grid; grid-template-columns: 1.6fr 1fr 1.6fr 1fr; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--color-border); color: var(--color-text-dim); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .row { display: grid; grid-template-columns: 1.6fr 1fr 1.6fr 1fr; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--color-border); }
    .row:last-child { border-bottom: none; }
    .name { font-weight: 600; }
    .slug, .website { color: var(--color-text-dim); font-size: 0.9rem; }
    .empty { color: var(--color-text-dim); margin: 10px 0; }
    .actions { display: flex; gap: 12px; }
    .link-btn { background: none; border: none; color: var(--color-text-dim); cursor: pointer; padding: 0; font-size: 0.88rem; text-decoration: underline; }
    .link-btn:hover { color: var(--color-text); }
    .link-btn.danger { color: var(--color-danger); }
    .form { display: flex; flex-direction: column; gap: 16px; max-width: 720px; margin-top: 24px; }
    .form h2 { margin: 0; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field label { font-size: 0.85rem; color: var(--color-text-dim); }
    .actions { display: flex; gap: 12px; margin-top: 4px; }
    @media (max-width: 900px) {
      .head { display: none; }
      .row { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 640px) { .grid-2 { grid-template-columns: 1fr; } }
  `,
})
export class AdminOrganizersPage {
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly organizers = signal<Organizer[]>([]);
  readonly editingId = signal<string | null>(null);

  protected form: OrganizerInput = this.emptyForm();

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> {
    try {
      this.organizers.set(await this.api.organizers());
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  startEdit(o: Organizer): void {
    this.editingId.set(o.id);
    this.form = {
      name: o.name,
      slug: o.slug,
      websiteUrl: o.websiteUrl ?? '',
      logoUrl: o.logoUrl ?? '',
      description: o.description ?? '',
    };
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.form = this.emptyForm();
  }

  async save(): Promise<void> {
    const name = this.form.name?.trim();
    const slug = this.form.slug?.trim();
    if (!name || !slug) {
      this.toast.show('error', 'Please fill in name and slug.');
      return;
    }
    this.saving.set(true);
    const body: OrganizerInput = { name, slug };
    if (this.form.websiteUrl?.trim()) body.websiteUrl = this.form.websiteUrl.trim();
    if (this.form.logoUrl?.trim()) body.logoUrl = this.form.logoUrl.trim();
    if (this.form.description?.trim()) body.description = this.form.description.trim();
    try {
      if (this.editingId()) {
        await this.api.organizerUpdate(this.editingId()!, body);
        this.toast.show('success', 'Organizer updated.');
      } else {
        await this.api.organizerCreate(body);
        this.toast.show('success', 'Organizer added.');
      }
      this.cancelEdit();
      this.organizers.set(await this.api.organizers());
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(o: Organizer): Promise<void> {
    if (!window.confirm(`Delete "${o.name}"?`)) return;
    try {
      await this.api.organizerRemove(o.id);
      this.toast.show('success', 'Organizer deleted.');
      this.organizers.set(await this.api.organizers());
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    }
  }

  private emptyForm(): OrganizerInput {
    return { name: '', slug: '', websiteUrl: '', logoUrl: '', description: '' };
  }
}