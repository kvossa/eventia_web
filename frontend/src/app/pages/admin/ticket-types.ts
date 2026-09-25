import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminNav } from '../../components/admin-nav';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { formatCents } from '../../core/format';
import { EventDetail, TicketType, TicketTypeInput, VenueLayoutView } from '../../core/models';

@Component({
  selector: 'app-admin-ticket-types',
  imports: [FormsModule, RouterLink, AdminNav, Loading],
  template: `
    <div class="page">
      <h1 class="page-title">Ticket types</h1>

      <app-admin-nav />

      @if (loading()) {
        <app-loading />
      } @else if (event()) {
        <div class="crumb">
          <a routerLink="/admin/events">Events</a>
          <span>›</span>
          <a routerLink="/admin/events/{{ event()!.id }}/edit">{{ event()!.name }}</a>
          <span>›</span>
          <span class="now">Ticket types</span>
        </div>

        <div class="card card-pad" data-testid="admin-ticket-types-list">
          <div class="head">
            <span>Type</span>
            <span>Price</span>
            <span>Sold</span>
            <span>Visible</span>
            <span>Sales window</span>
            <span>Max</span>
            <span>Actions</span>
          </div>
          @for (t of event()!.ticketTypes; track t.id) {
            <div class="row" [attr.data-testid]="'admin-ticket-type-' + t.id">
              <div class="name">{{ t.name }}</div>
              <div class="price">{{ formatCents(t.priceCents) }}</div>
              <div class="sold">{{ t.quantitySold }} / {{ t.quantity }}</div>
              <div class="visible">{{ t.isVisible ? 'yes' : 'no' }}</div>
              <div class="window">
                @if (t.salesStartsAt || t.salesEndsAt) {
                  {{ t.salesStartsAt ? shortDateTime(t.salesStartsAt) : '—' }} →
                  {{ t.salesEndsAt ? shortDateTime(t.salesEndsAt) : '—' }}
                } @else {
                  open
                }
              </div>
              <div class="max">{{ t.maxPerCustomer ?? '—' }}</div>
              <div class="actions">
                @if (editingId() === t.id) {
                  <button type="button" class="link-btn" (click)="cancelEdit()">Cancel</button>
                } @else {
                  <button type="button" class="link-btn" (click)="startEdit(t)">Edit</button>
                }
                <button type="button" class="link-btn danger" (click)="remove(t)">Delete</button>
              </div>
            </div>
          } @empty {
            <p class="empty" data-testid="admin-ticket-types-empty">No ticket types yet.</p>
          }
        </div>

        @if (event()!.reservedSeating && layout(); as lay) {
          <div class="card card-pad sections" data-testid="admin-tt-sections">
            <h2>Reserved seating — ticket type sections</h2>
            <p class="empty">
              Bind each ticket type to the venue sections it can be sold in. Customers pick seats from these
              sections on the event page.
            </p>
            @for (t of event()!.ticketTypes; track t.id) {
              <div class="sec-row" [attr.data-testid]="'admin-tt-sections-' + t.id">
                <div class="sec-name">{{ t.name }}</div>
                <div class="sec-opts">
                  @for (s of lay.sections; track s.id) {
                    <label class="sec-check">
                      <input
                        type="checkbox"
                        [checked]="isSectionSelected(t.id, s.id)"
                        (change)="toggleSection(t.id, s.id)"
                        [attr.data-testid]="'section-check-' + t.id + '-' + s.id"
                      />
                      {{ s.name }}
                    </label>
                  } @empty {
                    <span class="empty">This venue has no sections yet.</span>
                  }
                </div>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  [disabled]="savingSectionsId() === t.id"
                  (click)="saveSections(t)"
                  [attr.data-testid]="'save-sections-' + t.id"
                >{{ savingSectionsId() === t.id ? 'Saving…' : 'Save' }}</button>
              </div>
            }
          </div>
        }

        <form class="card card-pad form" (ngSubmit)="save()" data-testid="admin-ticket-types-form" novalidate>
          <h2>{{ editingId() ? 'Edit ticket type' : 'Add ticket type' }}</h2>
          <div class="grid-2">
            <div class="form-field">
              <label for="tt-name">Name *</label>
              <input id="tt-name" class="field" name="tt-name" [(ngModel)]="form.name" required data-testid="ticket-type-name" />
            </div>
            <div class="form-field">
              <label for="tt-price">Price (€) *</label>
              <input id="tt-price" class="field" type="number" min="0" step="0.01" name="tt-price" [(ngModel)]="priceEur" required data-testid="ticket-type-price" />
            </div>
          </div>
          <div class="form-field">
            <label for="tt-description">Description</label>
            <input id="tt-description" class="field" name="tt-description" [(ngModel)]="form.description" data-testid="ticket-type-description" />
          </div>
          <div class="grid-2">
            <div class="form-field">
              <label for="tt-quantity">Quantity *</label>
              <input id="tt-quantity" class="field" type="number" min="1" name="tt-quantity" [(ngModel)]="form.quantity" required data-testid="ticket-type-quantity" />
            </div>
            <div class="form-field">
              <label for="tt-max">Max per customer</label>
              <input id="tt-max" class="field" type="number" min="1" max="99" name="tt-max" [(ngModel)]="form.maxPerCustomer" data-testid="ticket-type-max" />
            </div>
          </div>
          <div class="grid-2">
            <div class="form-field">
              <label for="tt-starts">Sales start</label>
              <input id="tt-starts" class="field" type="datetime-local" name="tt-starts" [(ngModel)]="form.salesStartsAt" data-testid="ticket-type-starts" />
            </div>
            <div class="form-field">
              <label for="tt-ends">Sales end</label>
              <input id="tt-ends" class="field" type="datetime-local" name="tt-ends" [(ngModel)]="form.salesEndsAt" data-testid="ticket-type-ends" />
            </div>
          </div>
          <div class="form-field check">
            <label class="check-label">
              <input type="checkbox" name="tt-visible" [(ngModel)]="form.isVisible" data-testid="ticket-type-visible" />
              Visible to customers
            </label>
          </div>
          <div class="actions">
            <button class="btn btn-primary" type="submit" [disabled]="saving()" data-testid="ticket-type-submit">
              {{ saving() ? 'Saving…' : (editingId() ? 'Save changes' : 'Add ticket type') }}
            </button>
            @if (editingId()) {
              <button type="button" class="btn btn-ghost" (click)="cancelEdit()">Cancel</button>
            }
          </div>
        </form>
      } @else {
        <div class="card card-pad" data-testid="admin-ticket-types-missing">
          <p>Could not load this event.</p>
        </div>
      }
    </div>
  `,
  styles: `
    .crumb { display: flex; gap: 8px; align-items: center; color: var(--color-text-dim); font-size: 0.9rem; margin-bottom: 18px; }
    .crumb a { color: var(--color-accent); text-decoration: none; }
    .crumb .now { color: var(--color-text); }
    .head { display: grid; grid-template-columns: 1.2fr 0.8fr 1fr 0.6fr 1.6fr 0.5fr 1fr; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--color-border); color: var(--color-text-dim); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .row { display: grid; grid-template-columns: 1.2fr 0.8fr 1fr 0.6fr 1.6fr 0.5fr 1fr; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--color-border); }
    .row:last-child { border-bottom: none; }
    .name { font-weight: 600; }
    .price { font-weight: 600; color: var(--color-accent); }
    .sold, .window, .max { color: var(--color-text-dim); font-size: 0.9rem; }
    .visible { font-size: 0.9rem; }
    .empty { color: var(--color-text-dim); margin: 10px 0; }
    .sections { margin-top: 24px; }
    .sections h2 { margin: 0 0 6px; font-size: 1.05rem; }
    .sec-row { display: grid; grid-template-columns: 1fr 2.2fr auto; gap: 12px; align-items: center; padding: 10px 0; border-top: 1px solid var(--color-border); }
    .sec-name { font-weight: 600; }
    .sec-opts { display: flex; flex-wrap: wrap; gap: 12px; }
    .sec-check { display: inline-flex; align-items: center; gap: 6px; font-size: 0.9rem; color: var(--color-text); cursor: pointer; }
    @media (max-width: 900px) { .sec-row { grid-template-columns: 1fr; } }
    .actions { display: flex; gap: 12px; }
    .link-btn { background: none; border: none; color: var(--color-text-dim); cursor: pointer; padding: 0; font-size: 0.88rem; text-decoration: underline; }
    .link-btn:hover { color: var(--color-text); }
    .link-btn.danger { color: var(--color-danger); }
    .form { display: flex; flex-direction: column; gap: 16px; max-width: 720px; margin-top: 24px; }
    .form h2 { margin: 0; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field label { font-size: 0.85rem; color: var(--color-text-dim); }
    .check-label { display: flex; align-items: center; gap: 8px; font-size: 0.95rem; color: var(--color-text); cursor: pointer; }
    .actions { display: flex; gap: 12px; margin-top: 4px; }
    @media (max-width: 900px) {
      .head { display: none; }
      .row { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 640px) { .grid-2 { grid-template-columns: 1fr; } }
  `,
})
export class AdminTicketTypesPage {
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly event = signal<EventDetail | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly layout = signal<VenueLayoutView | null>(null);
  readonly sectionDraft = signal<Record<string, string[]>>({});
  readonly savingSectionsId = signal<string | null>(null);

  protected priceEur = 0;
  protected form: TicketTypeInput = this.emptyForm();

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  protected readonly formatCents = formatCents;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    try {
      const event = await this.api.adminEvent(id);
      this.event.set(event);
      if (event.reservedSeating) await this.loadLayout(event);
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  isSectionSelected(ttId: string, sectionId: string): boolean {
    return (this.sectionDraft()[ttId] ?? []).includes(sectionId);
  }

  toggleSection(ttId: string, sectionId: string): void {
    const current = this.sectionDraft()[ttId] ?? [];
    const next = current.includes(sectionId)
      ? current.filter((id) => id !== sectionId)
      : [...current, sectionId];
    this.sectionDraft.set({ ...this.sectionDraft(), [ttId]: next });
  }

  async saveSections(t: TicketType): Promise<void> {
    this.savingSectionsId.set(t.id);
    try {
      const sectionIds = this.sectionDraft()[t.id] ?? [];
      await this.api.ticketTypeSections(t.id, sectionIds);
      this.toast.show('success', `Sections updated for "${t.name}".`);
      this.event.set(await this.api.adminEvent(this.event()!.id));
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.savingSectionsId.set(null);
    }
  }

  private async loadLayout(event: EventDetail): Promise<void> {
    try {
      const layout = await this.api.venueLayout(event.venueId);
      this.layout.set(layout);
      const draft: Record<string, string[]> = {};
      for (const tt of event.ticketTypes) {
        draft[tt.id] = tt.sectionIds ?? [];
      }
      this.sectionDraft.set(draft);
    } catch {
      this.layout.set(null);
    }
  }

  shortDateTime(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  startEdit(t: TicketType): void {
    this.editingId.set(t.id);
    this.priceEur = t.priceCents / 100;
    this.form = {
      name: t.name,
      description: t.description ?? '',
      quantity: t.quantity,
      maxPerCustomer: t.maxPerCustomer ?? null,
      salesStartsAt: t.salesStartsAt ? toDateTimeLocal(t.salesStartsAt) : '',
      salesEndsAt: t.salesEndsAt ? toDateTimeLocal(t.salesEndsAt) : '',
      isVisible: t.isVisible,
    };
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.form = this.emptyForm();
    this.priceEur = 0;
  }

  async save(): Promise<void> {
    const name = this.form.name?.trim();
    const quantity = this.form.quantity;
    if (!name || quantity == null || this.priceEur === undefined || this.priceEur < 0) {
      this.toast.show('error', 'Please provide a name, price and quantity.');
      return;
    }
    this.saving.set(true);
    const body: TicketTypeInput = {
      name,
      priceCents: Math.round(this.priceEur * 100),
      quantity,
    };
    if (this.form.description?.trim()) body.description = this.form.description.trim();
    if (this.form.maxPerCustomer != null) body.maxPerCustomer = this.form.maxPerCustomer;
    if (this.form.salesStartsAt) body.salesStartsAt = new Date(this.form.salesStartsAt).toISOString();
    if (this.form.salesEndsAt) body.salesEndsAt = new Date(this.form.salesEndsAt).toISOString();
    if (this.form.isVisible !== undefined) body.isVisible = this.form.isVisible;
    try {
      if (this.editingId()) {
        await this.api.ticketTypeUpdate(this.editingId()!, body);
        this.toast.show('success', 'Ticket type updated.');
      } else {
        await this.api.ticketTypeCreate({ ...body, eventId: this.event()!.id });
        this.toast.show('success', 'Ticket type added.');
      }
      this.cancelEdit();
      this.event.set(await this.api.adminEvent(this.event()!.id));
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(t: TicketType): Promise<void> {
    if (!window.confirm(`Delete "${t.name}"? Only unsold ticket types can be deleted.`)) return;
    try {
      await this.api.ticketTypeRemove(t.id);
      this.toast.show('success', 'Ticket type deleted.');
      this.event.set(await this.api.adminEvent(this.event()!.id));
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    }
  }

  private emptyForm(): TicketTypeInput {
    return {
      name: '',
      description: '',
      quantity: undefined,
      maxPerCustomer: null,
      salesStartsAt: '',
      salesEndsAt: '',
      isVisible: true,
    };
  }
}

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}