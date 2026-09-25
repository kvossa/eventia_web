import { Injectable, computed, signal } from '@angular/core';
import { ApiService } from './api.service';
import { ApiError, Cart, CartLine } from './models';

@Injectable({ providedIn: 'root' })
export class CartService {
  readonly items = signal<CartLine[]>([]);
  readonly subtotalCents = signal(0);
  readonly count = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));
  readonly loaded = signal(false);

  constructor(private readonly api: ApiService) {}

  async load(): Promise<void> {
    const cart = await this.api.get<Cart>('/cart');
    this.apply(cart);
  }

  async sync(): Promise<void> {
    await this.load();
  }

  async add(ticketTypeId: string, quantity: number, seatIds?: string[]): Promise<Cart> {
    const cart = await this.api.post<Cart>('/cart/items', {
      ticketTypeId,
      quantity,
      ...(seatIds && seatIds.length ? { seatIds } : {}),
    });
    this.apply(cart);
    return cart;
  }

  async updateQuantity(itemId: string, quantity: number): Promise<void> {
    if (quantity < 1) {
      await this.remove(itemId);
      return;
    }
    const cart = await this.api.patch<Cart>(`/cart/items/${itemId}`, { quantity });
    this.apply(cart);
  }

  async remove(itemId: string): Promise<void> {
    const cart = await this.api.delete<Cart>(`/cart/items/${itemId}`);
    this.apply(cart);
  }

  clearLocal(): void {
    this.items.set([]);
    this.subtotalCents.set(0);
    this.loaded.set(true);
  }

  private apply(cart: Cart): void {
    this.items.set(cart.items);
    this.subtotalCents.set(cart.subtotalCents);
    this.loaded.set(true);
  }
}

export function isCartError(err: unknown): err is ApiError {
  return typeof err === 'object' && err !== null && 'code' in err && 'message' in err;
}