import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  template: `
    <footer class="footer">
      <div class="inner">
        <span class="brand">eventia</span>
        <span>Discover. Book. Enjoy.</span>
      </div>
    </footer>
  `,
  styles: `
    .footer { margin-top: 48px; border-top: 1px solid var(--color-border); color: var(--color-text-dim); }
    .inner { max-width: var(--container); margin: 0 auto; padding: 24px clamp(16px, 4vw, 40px); display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .brand { font-weight: 800; color: var(--color-text); }
    .brand::first-letter { color: var(--color-accent); }
  `,
})
export class Footer {}