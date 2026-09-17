import { Component } from '@angular/core';

@Component({
  selector: 'app-loading',
  template: `
    <div class="loading" role="status" aria-label="Loading">
      <span></span><span></span><span></span>
    </div>
  `,
  styles: `
    .loading { display: flex; gap: 8px; justify-content: center; padding: 40px; }
    .loading span {
      width: 10px; height: 10px; border-radius: 50%;
      background: var(--color-accent);
      animation: bounce 1s infinite ease-in-out;
    }
    .loading span:nth-child(2) { animation-delay: 0.15s; }
    .loading span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes bounce { 0%, 100% { transform: translateY(0); opacity: 0.4; } 50% { transform: translateY(-6px); opacity: 1; } }
  `,
})
export class Loading {}