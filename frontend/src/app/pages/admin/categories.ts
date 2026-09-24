import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminNav } from '../../components/admin-nav';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Category, CategoryInput } from '../../core/models';

@Component({
  selector: 'app-admin-categories',
  imports: [FormsModule, AdminNav, Loading],
  template: `
    <div class="page">
      <h1 class="page-title">Categories</h1>

      <app-admin-nav />

      @if (loading()) {
        <app-loading />
      } @else {
        <div class="card card-pad" data-testid="admin-categories-list">
          <div class="head">
            <span>Name</span>
            <span>Slug</span>
            <span>Description</span>
            <span>Actions</span>
          </div>
          @for (c of categories(); track c.id) {
            <div class="row" [attr.data-testid]="'admin-category-' + c.id">
              <div class="name">
                @if (editingId() === c.id) {
                  <input class="field" [(ngModel)]="form.name" data-testid="category-edit-name" />
                } @else {
                  {{ c.name }}
                }
              </div>
              <div class="slug">{{ c.slug }}</div>
              <div class="description">{{ c.description ?? '—' }}</div>
              <div class="actions">
                @if (editingId() === c.id) {
                  <button type="button" class="link-btn" (click)="cancelEdit()">Cancel</button>
                } @else {
                  <button type="button" class="link-btn" (click)="startEdit(c)">Edit</button>
                }
                <button type="button" class="link-btn danger" (click)="remove(c)">Delete</button>
              </div>
            </div>
          } @empty {
            <p class="empty" data-testid="admin-categories-empty">No categories yet.</p>
          }
        </div>

        <form class="card card-pad form" (ngSubmit)="save()" data-testid="admin-categories-form" novalidate>
          <h2>{{ editingId() ? 'Edit category' : 'Add category' }}</h2>
          <div class="grid-2">
            <div class="form-field">
              <label for="c-name">Name *</label>
              <input id="c-name" class="field" name="c-name" [(ngModel)]="form.name" required data-testid="category-name" />
            </div>
            <div class="form-field">
              <label for="c-slug">Slug *</label>
              <input id="c-slug" class="field" name="c-slug" [(ngModel)]="form.slug" required data-testid="category-slug" />
            </div>
          </div>
          <div class="form-field">
            <label for="c-description">Description</label>
            <textarea id="c-description" class="field" rows="3" name="c-description" [(ngModel)]="form.description" data-testid="category-description"></textarea>
          </div>
          <div class="actions">
            <button class="btn btn-primary" type="submit" [disabled]="saving()" data-testid="category-submit">
              {{ saving() ? 'Saving…' : (editingId() ? 'Save changes' : 'Add category') }}
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
    .head { display: grid; grid-template-columns: 1.4fr 0.8fr 2fr 1fr; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--color-border); color: var(--color-text-dim); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .row { display: grid; grid-template-columns: 1.4fr 0.8fr 2fr 1fr; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--color-border); }
    .row:last-child { border-bottom: none; }
    .name { font-weight: 600; }
    .slug, .description { color: var(--color-text-dim); font-size: 0.9rem; }
    .empty { color: var(--color-text-dim); margin: 10px 0; }
    .actions { display: flex; gap: 12px; }
    .link-btn { background: none; border: none; color: var(--color-text-dim); cursor: pointer; padding: 0; font-size: 0.88rem; text-decoration: underline; }
    .link-btn:hover { color: var(--color-text); }
    .link-btn.danger { color: var(--color-danger); }
    .form { display: flex; flex-direction: column; gap: 16px; max-width: 640px; margin-top: 24px; }
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
export class AdminCategoriesPage {
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly categories = signal<Category[]>([]);
  readonly editingId = signal<string | null>(null);

  protected form: CategoryInput = this.emptyForm();

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> {
    try {
      this.categories.set(await this.api.categories());
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  startEdit(c: Category): void {
    this.editingId.set(c.id);
    this.form = { name: c.name, slug: c.slug, description: c.description ?? '' };
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
    const body: CategoryInput = { name, slug };
    if (this.form.description?.trim()) body.description = this.form.description.trim();
    try {
      if (this.editingId()) {
        await this.api.categoryUpdate(this.editingId()!, body);
        this.toast.show('success', 'Category updated.');
      } else {
        await this.api.categoryCreate(body);
        this.toast.show('success', 'Category added.');
      }
      this.cancelEdit();
      this.categories.set(await this.api.categories());
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(c: Category): Promise<void> {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    try {
      await this.api.categoryRemove(c.id);
      this.toast.show('success', 'Category deleted.');
      this.categories.set(await this.api.categories());
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    }
  }

  private emptyForm(): CategoryInput {
    return { name: '', slug: '', description: '' };
  }
}