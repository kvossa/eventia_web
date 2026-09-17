import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="empty">
      <div class="icon">🎫</div>
      <h3>{{ title() }}</h3>
      <p>{{ message() }}</p>
      <ng-content />
    </div>
  `,
  styles: `
    .empty { text-align: center; padding: 48px 24px; color: var(--color-text-dim); }
    .icon { font-size: 2.5rem; margin-bottom: 8px; }
    h3 { margin: 0 0 6px; color: var(--color-text); }
    p { margin: 0 0 16px; max-width: 420px; margin-inline: auto; }
  `,
})
export class EmptyState {
  readonly title = input('Nothing here yet');
  readonly message = input('');
}