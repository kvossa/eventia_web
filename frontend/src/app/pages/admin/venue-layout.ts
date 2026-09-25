import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminNav } from '../../components/admin-nav';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { RowView, SectionView } from '../../core/models';

@Component({
  selector: 'app-admin-venue-layout',
  imports: [FormsModule, RouterLink, AdminNav, Loading],
  template: `
    <div class="page">
      <h1 class="page-title">Seat layout</h1>
      <a class="back" routerLink="/admin/venues">← Back to venues</a>

      <app-admin-nav />

      @if (loading()) {
        <app-loading />
      } @else {
        <form class="card card-pad form" (ngSubmit)="addSection()" data-testid="layout-add-section" novalidate>
          <h2>Add section</h2>
          <div class="grid-2">
            <div class="form-field">
              <label for="s-name">Section name *</label>
              <input id="s-name" class="field" name="s-name" [(ngModel)]="newSectionName" required data-testid="layout-section-name" />
            </div>
            <div class="form-field">
              <label for="s-order">Sort order</label>
              <input id="s-order" class="field" type="number" min="0" name="s-order" [(ngModel)]="newSectionSort" data-testid="layout-section-sort" />
            </div>
          </div>
          <button class="btn btn-primary" type="submit" [disabled]="!newSectionName.trim() || saving()" data-testid="layout-section-submit">
            Add section
          </button>
        </form>

        @for (s of sections(); track s.id) {
          <div class="card card-pad section" [attr.data-testid]="'layout-section-' + s.id">
            <div class="section-head">
              @if (editingSectionId() === s.id) {
                <input class="field name-input" [(ngModel)]="editSectionName" data-testid="layout-edit-section-name" />
                <input class="field sort-input" type="number" min="0" [(ngModel)]="editSectionSort" data-testid="layout-edit-section-sort" />
                <button type="button" class="link-btn" (click)="saveSection(s)">Save</button>
                <button type="button" class="link-btn" (click)="cancelEditSection()">Cancel</button>
              } @else {
                <span class="name">{{ s.name }}</span>
                <span class="dim">#{{ s.sortOrder }}</span>
                <div class="actions">
                  <button type="button" class="link-btn" (click)="startEditSection(s)">Rename</button>
                  <button type="button" class="link-btn danger" (click)="deleteSection(s)">Delete</button>
                </div>
              }
            </div>

            <div class="map">
              @for (row of s.rows; track row.id) {
                <div class="map-row" [attr.data-testid]="'layout-row-' + row.id">
                  <span class="row-label">{{ row.label }}</span>
                  <span class="seats">
                    @for (seat of row.seats; track seat.id) {
                      <span
                        class="seat"
                        [class.accessible]="seat.isAccessible"
                        [attr.data-testid]="'layout-seat-' + seat.id"
                        [attr.title]="(seat.isAccessible ? 'Accessible seat ' : 'Seat ') + seat.number"
                      >
                        {{ seat.number }}
                      </span>
                    }
                  </span>
                  <span class="row-actions">
                    <button type="button" class="link-btn" (click)="startEditRow(s, row)">Edit</button>
                    <button type="button" class="link-btn danger" (click)="deleteRow(row)">Delete</button>
                  </span>
                </div>
              } @empty {
                <p class="empty">No rows yet in this section.</p>
              }
            </div>

            @if (openRowSection() === s.id) {
              <form class="row-form" (ngSubmit)="saveRow(s)" novalidate>
                <div class="grid-3">
                  <div class="form-field">
                    <label for="r-label">Row label *</label>
                    <input id="r-label" class="field" name="r-label" [(ngModel)]="rowForm.label" required data-testid="layout-row-label" />
                  </div>
                  <div class="form-field">
                    <label for="r-count">Seat count *</label>
                    <input id="r-count" class="field" type="number" min="1" max="1000" name="r-count" [(ngModel)]="rowForm.seatCount" required data-testid="layout-row-count" />
                  </div>
                  <div class="form-field">
                    <label for="r-access">Accessible seats (e.g. 1, 5)</label>
                    <input id="r-access" class="field" name="r-access" [(ngModel)]="rowForm.accessible" placeholder="1, 5" data-testid="layout-row-access" />
                  </div>
                </div>
                <div class="actions">
                  <button class="btn btn-primary" type="submit" [disabled]="!rowForm.label.trim() || !rowForm.seatCount || saving()" data-testid="layout-row-submit">
                    {{ rowForm.rowId ? 'Save row' : 'Add row' }}
                  </button>
                  <button type="button" class="btn btn-ghost" (click)="closeRowForm()">Cancel</button>
                </div>
              </form>
            } @else {
              <button class="btn btn-ghost add-row" type="button" (click)="openRowForm(s)" data-testid="layout-add-row">
                Add row
              </button>
            }
          </div>
        } @empty {
          <p class="empty" data-testid="layout-empty">No sections yet. Add one above.</p>
        }
      }
    </div>
  `,
  styles: `
    .back { color: var(--color-text-dim); text-decoration: none; font-size: 0.9rem; }
    .form { display: flex; flex-direction: column; gap: 14px; max-width: 640px; margin-bottom: 20px; }
    .form h2 { margin: 0; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field label { font-size: 0.85rem; color: var(--color-text-dim); }
    .section { margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px; }
    .section-head { display: flex; align-items: center; gap: 10px; }
    .section-head .name { font-weight: 700; font-size: 1.05rem; }
    .section-head .dim { color: var(--color-text-dim); font-size: 0.85rem; }
    .section-head .actions { margin-left: auto; display: flex; gap: 12px; }
    .name-input { max-width: 220px; }
    .sort-input { max-width: 90px; }
    .map { display: flex; flex-direction: column; gap: 8px; }
    .map-row { display: flex; align-items: center; gap: 10px; }
    .row-label { min-width: 26px; font-weight: 600; color: var(--color-text-dim); }
    .seats { display: flex; flex-wrap: wrap; gap: 6px; }
    .seat {
      min-width: 30px; height: 26px; padding: 0 6px; border-radius: 6px;
      background: var(--color-bg); border: 1px solid var(--color-border);
      color: var(--color-text-dim); font-size: 0.75rem; display: inline-flex; align-items: center; justify-content: center;
    }
    .seat.accessible { border-color: var(--color-accent); color: var(--color-accent); }
    .row-actions { margin-left: auto; display: flex; gap: 10px; }
    .row-form { border-top: 1px solid var(--color-border); padding-top: 12px; display: flex; flex-direction: column; gap: 12px; }
    .add-row { align-self: flex-start; }
    .empty { color: var(--color-text-dim); margin: 6px 0; }
    .link-btn { background: none; border: none; color: var(--color-text-dim); cursor: pointer; padding: 0; font-size: 0.88rem; text-decoration: underline; }
    .link-btn:hover { color: var(--color-text); }
    .link-btn.danger { color: var(--color-danger); }
    .actions { display: flex; gap: 12px; }
    @media (max-width: 760px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } }
  `,
})
export class AdminVenueLayoutPage {
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly sections = signal<SectionView[]>([]);
  readonly editingSectionId = signal<string | null>(null);
  readonly openRowSection = signal<string | null>(null);

  newSectionName = '';
  newSectionSort = 0;
  editSectionName = '';
  editSectionSort = 0;
  rowForm: { rowId: string | null; label: string; seatCount: number | null; accessible: string } = {
    rowId: null,
    label: '',
    seatCount: null,
    accessible: '',
  };

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  private venueId(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const layout = await this.api.venueLayout(this.venueId());
      this.sections.set(layout.sections);
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  async addSection(): Promise<void> {
    if (!this.newSectionName.trim()) return;
    this.saving.set(true);
    try {
      await this.api.sectionCreate(this.venueId(), {
        name: this.newSectionName.trim(),
        sortOrder: this.newSectionSort,
      });
      this.newSectionName = '';
      this.newSectionSort = 0;
      this.toast.show('success', 'Section added.');
      await this.refresh();
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  startEditSection(s: SectionView): void {
    this.editingSectionId.set(s.id);
    this.editSectionName = s.name;
    this.editSectionSort = s.sortOrder;
  }

  cancelEditSection(): void {
    this.editingSectionId.set(null);
  }

  async saveSection(s: SectionView): Promise<void> {
    if (!this.editSectionName.trim()) return;
    this.saving.set(true);
    try {
      await this.api.sectionUpdate(s.id, {
        name: this.editSectionName.trim(),
        sortOrder: this.editSectionSort,
      });
      this.editingSectionId.set(null);
      this.toast.show('success', 'Section updated.');
      await this.refresh();
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async deleteSection(s: SectionView): Promise<void> {
    if (!window.confirm(`Delete section "${s.name}" and all its rows?`)) return;
    try {
      await this.api.sectionRemove(s.id);
      this.toast.show('success', 'Section deleted.');
      await this.refresh();
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    }
  }

  openRowForm(s: SectionView): void {
    this.rowForm = { rowId: null, label: '', seatCount: null, accessible: '' };
    this.openRowSection.set(s.id);
  }

  startEditRow(s: SectionView, row: RowView): void {
    this.rowForm = {
      rowId: row.id,
      label: row.label,
      seatCount: row.seats.length,
      accessible: row.seats
        .filter((seat) => seat.isAccessible)
        .map((seat) => seat.number)
        .join(', '),
    };
    this.openRowSection.set(s.id);
  }

  closeRowForm(): void {
    this.openRowSection.set(null);
  }

  async saveRow(s: SectionView): Promise<void> {
    if (!this.rowForm.label.trim() || !this.rowForm.seatCount) return;
    const body = {
      label: this.rowForm.label.trim(),
      seatCount: this.rowForm.seatCount,
      accessibleNumbers: this.parseAccessible(this.rowForm.accessible),
    };
    this.saving.set(true);
    try {
      if (this.rowForm.rowId) {
        await this.api.rowUpdate(this.rowForm.rowId, body);
        this.toast.show('success', 'Row updated.');
      } else {
        await this.api.rowCreate(s.id, body);
        this.toast.show('success', 'Row added.');
      }
      this.openRowSection.set(null);
      await this.refresh();
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async deleteRow(row: RowView): Promise<void> {
    if (!window.confirm(`Delete row "${row.label}" and its seats?`)) return;
    try {
      await this.api.rowRemove(row.id);
      this.toast.show('success', 'Row deleted.');
      await this.refresh();
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    }
  }

  private parseAccessible(raw: string): number[] {
    const numbers = raw
      .split(/[\s,]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => Number(part));
    return [...new Set(numbers)].filter((n) => Number.isInteger(n) && n > 0);
  }
}