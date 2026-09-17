import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import QRCode from 'qrcode';
import { EmptyState } from '../../components/empty-state';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { formatCents, formatDateTime } from '../../core/format';
import { Paginated, TicketView } from '../../core/models';
import { ToastService } from '../../core/toast.service';

type Scope = 'upcoming' | 'past' | 'all';

@Component({
  selector: 'app-my-tickets',
  imports: [RouterLink, Loading, EmptyState],
  template: `
    <div class="page">
      <h1 class="page-title">My tickets</h1>

      <div class="tabs">
        @for (tab of tabs; track tab.value) {
          <button
            class="tab"
            [class.active]="scope() === tab.value"
            (click)="setScope(tab.value)"
            data-testid="scope-tab"
          >{{ tab.label }}</button>
        }
      </div>

      @if (loading()) {
        <app-loading />
      } @else if (tickets().length === 0) {
        <app-empty-state
          title="No tickets here"
          message="Tickets you buy will show up here with their QR code."
        >
          <a class="btn btn-primary" routerLink="/events">Find an event</a>
        </app-empty-state>
      } @else {
        <div class="tickets">
          @for (ticket of tickets(); track ticket.id) {
            <article class="ticket card" data-testid="ticket">
              <div class="info">
                <h2>{{ ticket.event.name }}</h2>
                <p class="date">{{ formatDateTime(ticket.event.dateTime) }}</p>
                <p class="venue">
                  {{ ticket.event.venue.name }} — {{ ticket.event.address }}, {{ ticket.event.city }}
                </p>
                <div class="rows">
                  <div class="row"><span>Ticket type</span><strong>{{ ticket.ticketType.name }}</strong></div>
                  @if (ticket.seatLabel) {
                    <div class="row"><span>Seat</span><strong>{{ ticket.seatLabel }}</strong></div>
                  }
                  <div class="row"><span>Ticket ID</span><strong class="mono">{{ ticket.uniqueId }}</strong></div>
                  <div class="row"><span>Price</span><strong>{{ formatCents(ticket.pricePaidCents) }}</strong></div>
                </div>
                <div class="status-line">
                  <span class="badge" [class]="ticket.status">{{ ticket.status }}</span>
                  @if (ticket.status === 'valid') {
                    <span class="scan-note">Show this QR code at the entrance</span>
                  }
                </div>
              </div>
              <div class="qr">
                @if (qrData().get(ticket.id); as dataUrl) {
                  <img [src]="dataUrl" alt="Ticket QR code" width="160" height="160" />
                } @else {
                  <app-loading />
                }
              </div>
            </article>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .tabs { display: flex; gap: 8px; margin-bottom: 20px; }
    .tab {
      padding: 8px 18px; border-radius: 999px; cursor: pointer;
      background: var(--color-surface); border: 1px solid var(--color-border);
      color: var(--color-text-dim); font-weight: 600; font-size: 0.9rem;
    }
    .tab.active { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }
    .tickets { display: grid; gap: 20px; }
    .ticket { display: flex; gap: 24px; padding: 20px; align-items: center; justify-content: space-between; }
    @media (max-width: 720px) { .ticket { flex-direction: column; } .qr { order: -1; } }
    .info { flex: 1; min-width: 0; }
    .info h2 { margin: 0 0 4px; font-size: 1.2rem; }
    .date { margin: 0 0 4px; color: var(--color-text-dim); }
    .venue { margin: 0 0 12px; color: var(--color-text-dim); font-size: 0.9rem; }
    .rows { display: grid; gap: 6px; margin-bottom: 12px; }
    .row { display: flex; justify-content: space-between; gap: 16px; font-size: 0.9rem; color: var(--color-text-dim); max-width: 420px; }
    .row strong { color: var(--color-text); text-align: right; }
    .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; }
    .status-line { display: flex; align-items: center; gap: 10px; }
    .scan-note { font-size: 0.8rem; color: var(--color-text-dim); }
    .qr { flex-shrink: 0; }
    .qr img { display: block; border-radius: var(--radius-sm); background: #fff; padding: 8px; }
  `,
})
export class MyTicketsPage implements OnInit {
  readonly tabs: { value: Scope; label: string }[] = [
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'past', label: 'Past' },
    { value: 'all', label: 'All' },
  ];

  readonly scope = signal<Scope>('upcoming');
  readonly tickets = signal<TicketView[]>([]);
  readonly loading = signal(true);
  readonly qrData = signal<Map<string, string>>(new Map());

  protected readonly formatCents = formatCents;
  protected readonly formatDateTime = formatDateTime;

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> {
    await this.loadTickets();
  }

  async setScope(next: Scope): Promise<void> {
    if (next === this.scope()) return;
    this.scope.set(next);
    await this.loadTickets();
  }

  private async loadTickets(): Promise<void> {
    this.loading.set(true);
    this.qrData.set(new Map());
    try {
      const res = await this.api.get<Paginated<TicketView>>('/tickets', { scope: this.scope() });
      this.tickets.set(res.data);
      for (const ticket of res.data) {
        void this.genQr(ticket);
      }
    } catch (err) {
      const api = err as { message?: string };
      this.toast.show('error', api.message ?? 'Could not load your tickets.');
      this.tickets.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private async genQr(ticket: TicketView): Promise<void> {
    try {
      const payload = this.parseQr(ticket.qrPayload);
      const url = await QRCode.toDataURL(payload, { width: 160, margin: 1 });
      this.qrData.update((map) => new Map(map).set(ticket.id, url));
    } catch {
      // keep the QR area empty for corrupt payloads
    }
  }

  private parseQr(qrPayload: string): string {
    if (typeof qrPayload !== 'string') return JSON.stringify(qrPayload);
    if (qrPayload.startsWith('{')) return qrPayload;
    try {
      return JSON.stringify(JSON.parse(qrPayload));
    } catch {
      return qrPayload;
    }
  }
}