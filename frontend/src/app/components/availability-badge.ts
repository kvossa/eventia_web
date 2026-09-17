import { Component, input } from '@angular/core';
import type { EventAvailabilityState } from '@eventia/shared';

const STATE_LABELS: Record<EventAvailabilityState, string> = {
  available: 'Available',
  almost_sold_out: 'Almost sold out',
  sold_out: 'Sold out',
  temporarily_unavailable: 'Temporarily unavailable',
};

@Component({
  selector: 'app-availability-badge',
  template: `
    <span class="badge" [class]="state()" data-testid="availability-badge">
      {{ label() }}
    </span>
  `,
})
export class AvailabilityBadge {
  readonly state = input<EventAvailabilityState>('available');

  protected readonly label = () => STATE_LABELS[this.state()];
}