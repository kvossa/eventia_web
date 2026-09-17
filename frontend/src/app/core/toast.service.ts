import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  private counter = 0;

  show(type: Toast['type'], message: string): void {
    const id = ++this.counter;
    this.toasts.update((all) => [...all, { id, type, message }]);
    setTimeout(() => this.dismiss(id), 4000);
  }

  dismiss(id: number): void {
    this.toasts.update((all) => all.filter((t) => t.id !== id));
  }
}