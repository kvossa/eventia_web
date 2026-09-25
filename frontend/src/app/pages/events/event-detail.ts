import { NgOptimizedImage } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AvailabilityBadge } from '../../components/availability-badge';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { CartService } from '../../core/cart.service';
import { formatCents, formatDateTime } from '../../core/format';
import {
  EventDetail,
  EventSeatMap,
  EventSeatMapSeat,
  EventSeatMapSection,
  EventSeatMapTicketType,
  TicketType,
} from '../../core/models';
import { ToastService } from '../../core/toast.service';

type SalesState = 'not_started' | 'open' | 'ended';

@Component({
  selector: 'app-event-detail',
  imports: [RouterLink, NgOptimizedImage, AvailabilityBadge, Loading],
  template: `
    <div class="page">
      @if (loading()) {
        <app-loading />
      } @else if (event(); as event) {
        <div class="hero">
          <div class="image">
            @if (event.imageUrl) {
              <img [ngSrc]="event.imageUrl" alt="" width="560" height="315" [priority]="true" />
            } @else {
              <div class="media-fallback">{{ event.name }}</div>
            }
          </div>
          <div class="info">
            <app-availability-badge [state]="event.availability.state" />
            <h1>{{ event.name }}</h1>
            <p class="meta">
              {{ formatDateTime(event.dateTime) }}
            </p>
            <p class="venue">
              {{ event.venue.name }} — {{ event.venue.address }}, {{ event.venue.city }}
            </p>
            <p class="sub">
              <button
                class="btn favorite-btn"
                type="button"
                (click)="toggleFavorite()"
                [attr.aria-pressed]="favorited()"
                data-testid="favorite-toggle"
              >{{ favorited() ? 'Favorited ♥' : 'Add to favorites ♡' }}</button>
            </p>
            <p class="sub">
              @if (event.category) {
                <span class="chip">{{ event.category.name }}</span>
              }
              @if (event.organizer) {
                <span class="chip">{{ event.organizer.name }}</span>
              }
              @if (event.ageRestriction) {
                <span class="chip">{{ event.ageRestriction }}</span>
              }
            </p>
            @if (event.description) {
              <p class="desc">{{ event.description }}</p>
            }
            @if (event.accessibilityInfo) {
              <p class="sub">♿ {{ event.accessibilityInfo }}</p>
            }
          </div>
        </div>

        <section class="tickets card card-pad">
          <h2>Choose your tickets</h2>
          @for (tt of event.ticketTypes; track tt.id) {
            @if (tt.isVisible) {
              <div class="ticket" data-testid="ticket-type">
                <div class="tt-info">
                  <h3>{{ tt.name }}</h3>
                  @if (tt.description) {
                    <p>{{ tt.description }}</p>
                  }
                  <p class="price">{{ formatCents(tt.priceCents) }}</p>
                  <p class="status" [class]="salesState(tt)">
                    {{ salesNote(tt) }}
                  </p>
                </div>
                @if (canBuy(tt); as max) {
                  @if (isSeatBased(tt)) {
                    <p class="hint">Choose your seats in the seat map below.</p>
                  } @else {
                  <div class="buy">
                    <div class="qty">
                      <button
                        class="btn btn-ghost btn-sm"
                        type="button"
                        [disabled]="(qty(tt) ?? 0) <= 1"
                        (click)="dec(tt)"
                      >−</button>
                      <span class="qty-val" data-testid="qty">{{ qty(tt) ?? 1 }}</span>
                      <button
                        class="btn btn-ghost btn-sm"
                        type="button"
                        [disabled]="(qty(tt) ?? 1) >= max"
                        (click)="inc(tt)"
                      >+</button>
                    </div>
                    <button
                      class="btn btn-primary"
                      [disabled]="adding()"
                      (click)="add(tt)"
                      data-testid="add-to-cart"
                    >{{ adding() ? 'Adding…' : 'Add to cart' }}</button>
                  </div>
                  }
                } @else {
                  <p class="unavailable">Not available</p>
                }
              </div>
            }
          }
        </section>

        @if (seatMap(); as map) {
          <section class="seatmap card card-pad" data-testid="seat-map">
            <h2>Pick your seats</h2>
            <div class="tt-switch" role="tablist" aria-label="Ticket type">
              @for (mapTt of seatTicketTypes(); track mapTt.id) {
                <button
                  type="button"
                  role="tab"
                  class="tt-tab"
                  [class.active]="mapTt.id === activeSeatTt()?.id"
                  [attr.aria-selected]="mapTt.id === activeSeatTt()?.id"
                  (click)="activeSeatTtId.set(mapTt.id); clearSeats()"
                  [attr.data-testid]="'tt-tab-' + mapTt.name"
                >
                  {{ mapTt.name }} · {{ formatCents(mapTt.priceCents) }}
                </button>
              }
            </div>

            <div class="legend" aria-hidden="true">
              <span class="lg"><i class="sw available"></i>Available</span>
              <span class="lg"><i class="sw selected"></i>Selected</span>
              <span class="lg"><i class="sw occupied"></i>Sold</span>
              <span class="lg"><i class="sw held"></i>Held</span>
              <span class="lg"><i class="sw accessible"></i>Accessible</span>
            </div>

            <div class="screen" aria-hidden="true">STAGE</div>

            @for (section of map.sections; track section.id) {
              <div class="section">
                <h3>{{ section.name }}</h3>
                @for (row of section.rows; track row.id) {
                  <div class="row">
                    <span class="row-label">{{ row.label }}</span>
                    <div class="seats">
                      @for (seat of row.seats; track seat.id) {
                        <button
                          type="button"
                          class="seat"
                          [class]="seatState(seat)"
                          [class.accessible]="seat.isAccessible"
                          [disabled]="!isPickable(seat)"
                          [attr.aria-pressed]="isSelected(seat)"
                          [attr.aria-label]="seatTitle(seat)"
                          [attr.title]="seatTitle(seat)"
                          (click)="toggleSeat(seat)"
                          [attr.data-testid]="'seat-' + seat.number"
                        >
                          {{ seat.number }}
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            }

            <div class="seatbar">
              <div class="sel-info">
                <span data-testid="seat-count">
                  {{ selectedSeatIds().length }} seat(s) selected
                </span>
                @if (activeSeatTt(); as att) {
                  <span class="subtotal" data-testid="seat-subtotal">
                    {{ formatCents(selectedSubtotalCents()) }}
                  </span>
                }
              </div>
              <div class="sel-actions">
                <button
                  class="btn btn-ghost"
                  type="button"
                  [disabled]="selectedSeatIds().length === 0"
                  (click)="clearSeats()"
                >Clear</button>
                <button
                  class="btn btn-primary"
                  type="button"
                  [disabled]="seatAdding() || selectedSeatIds().length === 0"
                  (click)="addSelectedSeats()"
                  data-testid="add-seats-to-cart"
                >{{ seatAdding() ? 'Adding…' : 'Add seats to cart' }}</button>
              </div>
            </div>
          </section>
        }

        <div class="back">
          <a class="btn btn-ghost" routerLink="/events">← Back to events</a>
        </div>
      } @else {
        <div class="card card-pad">
          <h2>Event not found</h2>
          <a class="btn btn-ghost" routerLink="/events">← Back to events</a>
        </div>
      }
    </div>
  `,
  styles: `
    .hero { display: grid; gap: 24px; grid-template-columns: 1.2fr 1fr; align-items: start; margin-bottom: 28px; }
    @media (max-width: 720px) { .hero { grid-template-columns: 1fr; } }
    .image { border-radius: var(--radius-card); overflow: hidden; background: #0d1222; aspect-ratio: 16/9; }
    .image img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .media-fallback { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-dim); font-weight: 600; }
    .info h1 { margin: 12px 0 6px; font-size: clamp(1.6rem, 3vw, 2.3rem); }
    .meta { color: var(--color-text-dim); margin: 0 0 4px; }
    .venue { color: var(--color-text); margin: 0 0 12px; }
    .sub { color: var(--color-text-dim); font-size: 0.9rem; }
    .chip { display: inline-block; padding: 4px 10px; border-radius: 999px; background: var(--color-surface-2); border: 1px solid var(--color-border); font-size: 0.8rem; margin-right: 6px; }
    .desc { line-height: 1.6; color: var(--color-text-dim); }
    .tickets h2 { margin: 0 0 16px; }
    .ticket { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 16px 0; border-bottom: 1px solid var(--color-border); }
    .ticket:last-child { border-bottom: none; }
    .tt-info h3 { margin: 0 0 4px; }
    .tt-info p { margin: 0; }
    .tt-info .price { font-weight: 700; color: var(--color-accent); margin-top: 6px; }
    .tt-info .status { font-size: 0.8rem; color: var(--color-text-dim); margin-top: 4px; }
    .tt-info .status.open { color: var(--color-success); }
    .tt-info .status.not_started { color: var(--color-warning); }
    .tt-info .status.ended { color: var(--color-danger); }
    .buy { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
    .unavailable { color: var(--color-text-dim); font-size: 0.9rem; }
    .qty { display: flex; align-items: center; gap: 8px; }
    .qty-val { min-width: 24px; text-align: center; font-weight: 700; }
    .back { margin-top: 24px; }
    .hint { color: var(--color-text-dim); font-size: 0.9rem; margin: 0; text-align: right; }
    .seatmap { margin-top: 24px; }
    .seatmap h2 { margin: 0 0 14px; }
    .tt-switch { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
    .tt-tab { border: 1px solid var(--color-border); background: var(--color-surface-2); color: var(--color-text); border-radius: 999px; padding: 8px 14px; font-weight: 600; cursor: pointer; }
    .tt-tab.active { border-color: var(--color-accent); color: var(--color-accent); }
    .legend { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 12px; color: var(--color-text-dim); font-size: 0.8rem; }
    .lg { display: inline-flex; align-items: center; gap: 6px; }
    .sw { width: 12px; height: 12px; border-radius: 3px; display: inline-block; border: 1px solid var(--color-border); }
    .sw.available { background: var(--color-surface-2); }
    .sw.selected { background: var(--color-accent); border-color: var(--color-accent); }
    .sw.occupied { background: var(--color-border); }
    .sw.held { background: var(--color-warning); }
    .sw.accessible { background: var(--color-success); }
    .screen { margin: 6px auto 20px; width: 60%; text-align: center; padding: 6px; border-radius: 6px; background: var(--color-surface-2); color: var(--color-text-dim); font-size: 0.75rem; letter-spacing: 0.2em; }
    .section { margin-bottom: 20px; }
    .section h3 { margin: 0 0 8px; font-size: 0.95rem; color: var(--color-text-dim); }
    .row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .row-label { width: 20px; color: var(--color-text-dim); font-size: 0.8rem; font-weight: 700; }
    .seats { display: flex; flex-wrap: wrap; gap: 6px; }
    .seat { width: 30px; height: 30px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface-2); color: var(--color-text); font-size: 0.75rem; cursor: pointer; }
    .seat.available:hover { border-color: var(--color-accent); }
    .seat.selected { background: var(--color-accent); border-color: var(--color-accent); color: #fff; }
    .seat.occupied { background: var(--color-border); color: var(--color-text-dim); cursor: not-allowed; }
    .seat.held { background: var(--color-warning); color: #111; cursor: not-allowed; }
    .seat.inactive { opacity: 0.35; cursor: not-allowed; }
    .seat.accessible.available { border-color: var(--color-success); color: var(--color-success); }
    .seatbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid var(--color-border); padding-top: 14px; margin-top: 8px; }
    .sel-info { display: flex; flex-direction: column; }
    .subtotal { font-weight: 700; color: var(--color-accent); }
    .sel-actions { display: flex; gap: 8px; }
    @media (max-width: 560px) {
      .ticket { flex-direction: column; align-items: flex-start; }
      .buy { align-items: stretch; width: 100%; }
      .seatbar { flex-direction: column; align-items: stretch; }
      .sel-actions { justify-content: flex-end; }
    }
  `,
})
export class EventDetailPage implements OnInit, OnDestroy {
  readonly event = signal<EventDetail | null>(null);
  readonly loading = signal(true);
  readonly quantities = new Map<string, number>();
  readonly adding = signal(false);
  readonly favorited = signal(false);
  readonly seatMap = signal<EventSeatMap | null>(null);
  readonly activeSeatTtId = signal<string | null>(null);
  readonly selectedSeatIds = signal<string[]>([]);
  readonly seatAdding = signal(false);

  protected readonly formatCents = formatCents;
  protected readonly formatDateTime = formatDateTime;

  private readonly api = inject(ApiService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private sub: Subscription | null = null;

  async ngOnInit(): Promise<void> {
    void this.seedFavorite();
    this.sub = this.route.params.subscribe((params) => {
      const id = params['id'];
      if (id) void this.load(id);
    });
  }

  async seedFavorite(): Promise<void> {
    try {
      const res = await this.api.favorites();
      const ev = this.event();
      this.favorited.set(ev ? res.data.some((f) => f.id === ev.id) : false);
    } catch {
      this.favorited.set(false);
    }
  }

  async toggleFavorite(): Promise<void> {
    const ev = this.event();
    if (!ev) return;
    const next = !this.favorited();
    this.favorited.set(next);
    try {
      if (next) {
        await this.api.favoriteAdd(ev.id);
        this.toast.show('success', 'Added to favorites.');
      } else {
        await this.api.favoriteRemove(ev.id);
        this.toast.show('success', 'Removed from favorites.');
      }
    } catch (err) {
      this.favorited.set(!next);
      this.toast.show('error', (err as Error).message);
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  isSeatBased(tt: TicketType): boolean {
    const entry = this.seatMap()?.ticketTypes.find((x) => x.id === tt.id);
    return !!entry && entry.sectionIds.length > 0;
  }

  seatTicketTypes(): EventSeatMapTicketType[] {
    return (this.seatMap()?.ticketTypes ?? []).filter((tt) => tt.sectionIds.length > 0);
  }

  activeSeatTt(): EventSeatMapTicketType | null {
    const tts = this.seatTicketTypes();
    return tts.find((tt) => tt.id === this.activeSeatTtId()) ?? tts[0] ?? null;
  }

  sectionForSeat(seat: EventSeatMapSeat): EventSeatMapSection | null {
    return (this.seatMap()?.sections ?? []).find((section) =>
      section.rows.some((row) => row.seats.some((s) => s.id === seat.id)),
    ) ?? null;
  }

  inActiveScope(seat: EventSeatMapSeat): boolean {
    const section = this.sectionForSeat(seat);
    const active = this.activeSeatTt();
    if (!section || !active) return false;
    return active.sectionIds.includes(section.id);
  }

  isSelected(seat: EventSeatMapSeat): boolean {
    return this.selectedSeatIds().includes(seat.id);
  }

  isPickable(seat: EventSeatMapSeat): boolean {
    return !seat.occupied && !seat.held && this.inActiveScope(seat);
  }

  seatState(seat: EventSeatMapSeat): string {
    if (seat.occupied) return 'occupied';
    if (seat.held) return 'held';
    if (!this.inActiveScope(seat)) return 'inactive';
    if (this.isSelected(seat)) return 'selected';
    return 'available';
  }

  seatTitle(seat: EventSeatMapSeat): string {
    const label = `${this.sectionForSeat(seat)?.name ?? ''} row seat ${seat.number}`;
    if (seat.occupied) return `${label} — sold`;
    if (seat.held) return `${label} — held in another cart`;
    if (!this.inActiveScope(seat)) return `${label} — not available for this ticket type`;
    if (this.isSelected(seat)) return `${label} — selected`;
    return seat.isAccessible ? `${label} — accessible, select` : `${label} — select`;
  }

  toggleSeat(seat: EventSeatMapSeat): void {
    if (!this.isPickable(seat)) return;
    const current = this.selectedSeatIds();
    if (current.includes(seat.id)) {
      this.selectedSeatIds.set(current.filter((id) => id !== seat.id));
      return;
    }
    const max = this.activeQuantityCap();
    if (current.length >= max) {
      this.toast.show('error', `You can select up to ${max} seats.`);
      return;
    }
    this.selectedSeatIds.set([...current, seat.id]);
  }

  private activeQuantityCap(): number {
    const active = this.activeSeatTt();
    if (!active) return 10;
    const full = this.event()?.ticketTypes.find((tt) => tt.id === active.id);
    const remaining = full ? full.quantity - full.quantitySold : 10;
    return Math.max(1, Math.min(remaining, full?.maxPerCustomer ?? 10, 10));
  }

  selectedSubtotalCents(): number {
    const active = this.activeSeatTt();
    return (active?.priceCents ?? 0) * this.selectedSeatIds().length;
  }

  clearSeats(): void {
    this.selectedSeatIds.set([]);
  }

  async addSelectedSeats(): Promise<void> {
    const active = this.activeSeatTt();
    const seatIds = this.selectedSeatIds();
    if (!active || seatIds.length === 0) return;
    this.seatAdding.set(true);
    try {
      await this.cart.add(active.id, seatIds.length, [...seatIds]);
      this.toast.show('success', `${seatIds.length} × ${active.name} seat(s) added to your cart.`);
      this.clearSeats();
      void this.loadSeatMap(this.event()?.id);
    } catch (err) {
      const api = err as { code?: string; message?: string };
      this.toast.show('error', api.message ?? 'Could not add seats to the cart.');
    } finally {
      this.seatAdding.set(false);
    }
  }

  qty(tt: TicketType): number {
    return this.quantities.get(tt.id) ?? 1;
  }

  inc(tt: TicketType): void {
    const max = this.maxQty(tt);
    this.quantities.set(tt.id, Math.min(this.qty(tt) + 1, max));
  }

  dec(tt: TicketType): void {
    this.quantities.set(tt.id, Math.max(this.qty(tt) - 1, 1));
  }

  salesState(tt: TicketType): SalesState {
    const now = Date.now();
    if (tt.salesStartsAt && new Date(tt.salesStartsAt).getTime() > now) return 'not_started';
    if (tt.salesEndsAt && new Date(tt.salesEndsAt).getTime() < now) return 'ended';
    return 'open';
  }

  salesNote(tt: TicketType): string {
    const state = this.salesState(tt);
    if (state === 'not_started') return 'On sale soon';
    if (state === 'ended') return 'Sales ended';
    const remaining = this.remaining(tt);
    return remaining <= 0
      ? 'Sold out'
      : `${remaining} left${tt.maxPerCustomer ?? 0 > 0 ? ` · max ${tt.maxPerCustomer} per customer` : ''}`;
  }

  canBuy(tt: TicketType): number | null {
    if (this.salesState(tt) !== 'open') return null;
    const remaining = this.remaining(tt);
    if (remaining <= 0) return null;
    const availability = this.event()?.availability.state;
    if (availability === 'sold_out' || availability === 'temporarily_unavailable') return null;
    return this.maxQty(tt);
  }

  private maxQty(tt: TicketType): number {
    return Math.max(1, Math.min(this.remaining(tt), tt.maxPerCustomer ?? 10, 10));
  }

  private remaining(tt: TicketType): number {
    return tt.quantity - tt.quantitySold;
  }

  async add(tt: TicketType): Promise<void> {
    this.adding.set(true);
    try {
      await this.cart.add(tt.id, this.qty(tt));
      this.toast.show('success', `${this.qty(tt)} × ${tt.name} added to your cart.`);
    } catch (err) {
      const api = err as { code?: string; message?: string };
      this.toast.show('error', api.message ?? 'Could not add tickets to the cart.');
    } finally {
      this.adding.set(false);
    }
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.quantities.clear();
    this.seatMap.set(null);
    this.activeSeatTtId.set(null);
    this.selectedSeatIds.set([]);
    try {
      const event = await this.api.get<EventDetail>(`/events/${id}`);
      this.event.set(event);
      if (event.reservedSeating) {
        void this.loadSeatMap(id);
      }
    } catch {
      this.event.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadSeatMap(id: string | undefined): Promise<void> {
    if (!id) return;
    try {
      const map = await this.api.eventSeatMap(id);
      this.seatMap.set(map);
      const firstSeatBased = map.ticketTypes.find((tt) => tt.sectionIds.length > 0);
      this.activeSeatTtId.set(firstSeatBased?.id ?? null);
    } catch {
      this.seatMap.set(null);
    }
  }
}