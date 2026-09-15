import type { EntityId, Timestamps } from './common.js';
import type { CartStatus } from './enums.js';
import type { TicketType } from './ticket-type.js';

export interface CartItem {
  id: EntityId;
  ticketTypeId: EntityId;
  quantity: number;
}

export interface Cart extends Timestamps {
  id: EntityId;
  userId: EntityId | null;
  status: CartStatus;
  expiresAt: string;
  items: CartItem[];
}

export interface CartLine extends CartItem {
  ticketType: TicketType;
  unitPriceCents: number;
  subtotalCents: number;
}

export interface CartWithLines extends Omit<Cart, 'items'> {
  items: CartLine[];
  subtotalCents: number;
}