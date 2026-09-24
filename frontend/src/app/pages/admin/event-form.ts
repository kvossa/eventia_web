import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminNav } from '../../components/admin-nav';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Category, EventDetail, EventFormValue, Organizer, Venue } from '../../core/models';

@Component({
  selector: 'app-admin-event-form',
  imports: [FormsModule, RouterLink, AdminNav, Loading],
  template: `
    <div class="page">
      <h1 class="page-title">{{ eventId() ? 'Edit event' : 'New event' }}</h1>

      <app-admin-nav />

      @if (loading()) {
        <app-loading />
      } @else {
        <form class="card card-pad form" (ngSubmit)="save()" data-testid="admin-event-form" novalidate>
          <div class="form-field">
            <label for="name">Name *</label>
            <input id="name" class="field" name="name" [(ngModel)]="value.name" required data-testid="event-form-name" />
          </div>
          <div class="form-field">
            <label for="description">Description</label>
            <textarea id="description" class="field" name="description" rows="4" [(ngModel)]="value.description" data-testid="event-form-description"></textarea>
          </div>
          <div class="grid-2">
            <div class="form-field">
              <label for="categoryId">Category *</label>
              <select id="categoryId" class="field" name="categoryId" [(ngModel)]="value.categoryId" required data-testid="event-form-category">
                <option value="" disabled>Select a category</option>
                @for (cat of categories(); track cat.id) {
                  <option [value]="cat.id">{{ cat.name }}</option>
                }
              </select>
            </div>
            <div class="form-field">
              <label for="organizerId">Organizer *</label>
              <select id="organizerId" class="field" name="organizerId" [(ngModel)]="value.organizerId" required data-testid="event-form-organizer">
                <option value="" disabled>Select an organizer</option>
                @for (org of organizers(); track org.id) {
                  <option [value]="org.id">{{ org.name }}</option>
                }
              </select>
            </div>
          </div>
          <div class="grid-2">
            <div class="form-field">
              <label for="venueId">Venue *</label>
              <select id="venueId" class="field" name="venueId" [(ngModel)]="value.venueId" required data-testid="event-form-venue">
                <option value="" disabled>Select a venue</option>
                @for (ven of venues(); track ven.id) {
                  <option [value]="ven.id">{{ ven.name }}</option>
                }
              </select>
            </div>
            <div class="form-field">
              <label for="dateTime">Date & time *</label>
              <input id="dateTime" class="field" type="datetime-local" name="dateTime" [(ngModel)]="value.dateTime" required data-testid="event-form-dateTime" />
            </div>
          </div>
          <div class="grid-2">
            <div class="form-field">
              <label for="startTime">Start time</label>
              <input id="startTime" class="field" type="time" name="startTime" [(ngModel)]="value.startTime" data-testid="event-form-startTime" />
            </div>
            <div class="form-field">
              <label for="endTime">End time</label>
              <input id="endTime" class="field" type="time" name="endTime" [(ngModel)]="value.endTime" data-testid="event-form-endTime" />
            </div>
          </div>
          <div class="grid-2">
            <div class="form-field">
              <label for="city">City</label>
              <input id="city" class="field" name="city" [(ngModel)]="value.city" data-testid="event-form-city" />
            </div>
            <div class="form-field">
              <label for="address">Address</label>
              <input id="address" class="field" name="address" [(ngModel)]="value.address" data-testid="event-form-address" />
            </div>
          </div>
          <div class="grid-2">
            <div class="form-field">
              <label for="maxCapacity">Max capacity</label>
              <input id="maxCapacity" class="field" type="number" min="1" name="maxCapacity" [(ngModel)]="value.maxCapacity" data-testid="event-form-maxCapacity" />
            </div>
            <div class="form-field">
              <label for="ageRestriction">Age restriction</label>
              <input id="ageRestriction" class="field" name="ageRestriction" [(ngModel)]="value.ageRestriction" data-testid="event-form-ageRestriction" />
            </div>
          </div>
          <div class="form-field">
            <label for="accessibilityInfo">Accessibility info</label>
            <input id="accessibilityInfo" class="field" name="accessibilityInfo" [(ngModel)]="value.accessibilityInfo" data-testid="event-form-accessibilityInfo" />
          </div>
          <div class="grid-2">
            <div class="form-field">
              <label for="imageUrl">Image URL</label>
              <input id="imageUrl" class="field" name="imageUrl" [(ngModel)]="value.imageUrl" data-testid="event-form-imageUrl" />
            </div>
            <div class="form-field check">
              <label class="check-label">
                <input type="checkbox" name="featured" [(ngModel)]="value.featured" data-testid="event-form-featured" />
                Featured event
              </label>
            </div>
          </div>

          <div class="actions">
            <button class="btn btn-primary" type="submit" [disabled]="saving()" data-testid="event-form-submit">
              {{ saving() ? 'Saving…' : (eventId() ? 'Save changes' : 'Create event') }}
            </button>
            <a class="btn btn-ghost" routerLink="/admin/events">Cancel</a>
          </div>
        </form>
      }
    </div>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: 16px; max-width: 720px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field label { font-size: 0.85rem; color: var(--color-text-dim); }
    .check { justify-content: flex-end; }
    .check-label { display: flex; align-items: center; gap: 8px; font-size: 0.95rem; color: var(--color-text); cursor: pointer; padding-bottom: 10px; }
    .actions { display: flex; gap: 12px; margin-top: 4px; }
    @media (max-width: 640px) { .grid-2 { grid-template-columns: 1fr; } }
  `,
})
export class AdminEventFormPage {
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly eventId = signal<string | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly venues = signal<Venue[]>([]);
  readonly organizers = signal<Organizer[]>([]);

  protected value: EventFormValue = this.emptyValue();

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    this.eventId.set(id);
    try {
      const [cats, vens, orgs] = await Promise.all([
        this.api.categories(),
        this.api.venues(),
        this.api.organizers(),
      ]);
      this.categories.set(cats);
      this.venues.set(vens);
      this.organizers.set(orgs);
      if (id) {
        const event = await this.api.adminEvent(id);
        this.value = this.fromEvent(event);
      }
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    const v = this.value;
    if (!v.name?.trim() || !v.categoryId || !v.organizerId || !v.venueId || !v.dateTime) {
      this.toast.show('error', 'Please fill in all required fields.');
      return;
    }
    this.saving.set(true);
    try {
      const include = this.flatten(v);
      if (this.eventId()) {
        await this.api.eventUpdate(this.eventId()!, include);
        this.toast.show('success', 'Event updated.');
      } else {
        await this.api.eventCreate(include);
        this.toast.show('success', 'Event created.');
      }
      await this.router.navigate(['/admin/events']);
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  private flatten(v: EventFormValue): EventFormValue {
    const out: EventFormValue = {
      name: v.name.trim(),
      categoryId: v.categoryId,
      organizerId: v.organizerId,
      venueId: v.venueId,
      dateTime: new Date(v.dateTime).toISOString(),
    };
    if (v.description?.trim()) out.description = v.description.trim();
    if (v.startTime) out.startTime = v.startTime;
    if (v.endTime) out.endTime = v.endTime;
    if (v.maxCapacity != null) out.maxCapacity = v.maxCapacity;
    if (v.ageRestriction?.trim()) out.ageRestriction = v.ageRestriction.trim();
    if (v.accessibilityInfo?.trim()) out.accessibilityInfo = v.accessibilityInfo.trim();
    if (v.city?.trim()) out.city = v.city.trim();
    if (v.address?.trim()) out.address = v.address.trim();
    if (v.imageUrl?.trim()) out.imageUrl = v.imageUrl.trim();
    if (v.featured !== undefined) out.featured = v.featured;
    return out;
  }

  private fromEvent(event: EventDetail): EventFormValue {
    return {
      name: event.name,
      description: event.description ?? '',
      categoryId: event.categoryId,
      organizerId: event.organizerId,
      venueId: event.venueId,
      dateTime: toDateTimeLocal(event.dateTime),
      startTime: event.startTime ?? '',
      endTime: event.endTime ?? '',
      maxCapacity: event.maxCapacity ?? null,
      ageRestriction: event.ageRestriction ?? '',
      accessibilityInfo: event.accessibilityInfo ?? '',
      city: event.city ?? '',
      address: event.address ?? '',
      featured: event.featured ?? false,
      imageUrl: event.imageUrl ?? '',
    };
  }

  private emptyValue(): EventFormValue {
    return {
      name: '',
      description: '',
      categoryId: '',
      organizerId: '',
      venueId: '',
      dateTime: '',
      startTime: '',
      endTime: '',
      maxCapacity: null,
      ageRestriction: '',
      accessibilityInfo: '',
      city: '',
      address: '',
      featured: false,
      imageUrl: '',
    };
  }
}

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}