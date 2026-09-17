import { NgOptimizedImage } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AvailabilityBadge } from '../../components/availability-badge';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { CartService } from '../../core/cart.service';
import { formatCents, formatDateTime } from '../../core/format';
import { EventDetail, TicketType } from '../../core/models';
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
                } @else {
                  <p class="unavailable">Not available</p>
                }
              </div>
            }
          }
        </section>

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
    @media (max-width: 560px) {
      .ticket { flex-direction: column; align-items: flex-start; }
      .buy { align-items: stretch; width: 100%; }
    }
  `,
})
export class EventDetailPage implements OnInit, OnDestroy {
  readonly event = signal<EventDetail | null>(null);
  readonly loading = signal(true);
  readonly quantities = new Map<string, number>();
  readonly adding = signal(false);

  protected readonly formatCents = formatCents;
  protected readonly formatDateTime = formatDateTime;

  private readonly api = inject(ApiService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private sub: Subscription | null = null;

  async ngOnInit(): Promise<void> {
    this.sub = this.route.params.subscribe((params) => {
      const id = params['id'];
      if (id) void this.load(id);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
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
    try {
      this.event.set(await this.api.get<EventDetail>(`/events/${id}`));
    } catch {
      this.event.set(null);
    } finally {
      this.loading.set(false);
    }
  }
}