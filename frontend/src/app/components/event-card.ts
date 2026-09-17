import { NgOptimizedImage } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvailabilityBadge } from '../components/availability-badge';
import { formatCents, formatDay, formatTime } from '../core/format';
import type { EventListItem } from '../core/models';

@Component({
  selector: 'app-event-card',
  imports: [RouterLink, AvailabilityBadge, NgOptimizedImage],
  template: `
    <a class="card" [routerLink]="['/events', event().id]">
      <div class="media">
        @if (event().imageUrl) {
          <img [ngSrc]="event().imageUrl!" alt="" width="600" height="300" [priority]="event().featured" />
        } @else {
          <div class="media-fallback">{{ event().name }}</div>
        }
        <app-availability-badge [state]="event().availability.state" />
      </div>
      <div class="body">
        <div class="meta">{{ formatDay(event().dateTime) }} · {{ formatTime(event().dateTime) }} · {{ event().city }}</div>
        <h3>{{ event().name }}</h3>
        <div class="venue">{{ event().venue.name }}</div>
        <div class="footer">
          <span class="price">from {{ formatCents(event().fromPriceCents) }}</span>
          <span class="cta">Details</span>
        </div>
      </div>
    </a>
  `,
  styles: `
    .card {
      display: block;
      background: var(--color-surface);
      border-radius: var(--radius-card);
      overflow: hidden;
      border: 1px solid var(--color-border);
      transition: transform 0.15s ease, border-color 0.15s ease;
      color: var(--color-text);
      text-decoration: none;
    }
    .card:hover { transform: translateY(-2px); border-color: var(--color-accent); }
    .media { position: relative; aspect-ratio: 2/1; background: #0d1222; }
    .media img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .media-fallback {
      display: flex; align-items: center; justify-content: center;
      height: 100%; color: var(--color-text-dim); font-weight: 600; letter-spacing: 0.5px;
    }
    .media app-availability-badge { position: absolute; top: 12px; left: 12px; }
    .body { padding: 16px; }
    .meta { font-size: 0.8rem; color: var(--color-text-dim); text-transform: uppercase; letter-spacing: 0.4px; }
    h3 { margin: 6px 0 2px; font-size: 1.05rem; line-height: 1.3; }
    .venue { color: var(--color-text-dim); font-size: 0.9rem; }
    .footer { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; }
    .price { font-weight: 700; color: var(--color-accent); }
    .cta { font-size: 0.85rem; color: var(--color-text-dim); }
  `,
})
export class EventCard {
  readonly event = input.required<EventListItem>();

  protected readonly formatCents = formatCents;
  protected readonly formatDay = formatDay;
  protected readonly formatTime = formatTime;
}