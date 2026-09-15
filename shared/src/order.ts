import type { EntityId, Timestamps } from './common.js';
import type { OrderStatus } from './enums.js';

export interface Order extends Timestamps {
  id: EntityId;
  orderNumber: string;
  userId: EntityId;
  status: OrderStatus;
  totalCents: number;
  idempotencyKey: string | null;
}

export interface OrderItem {
  id: EntityId;
  orderId: EntityId;
  eventId: EntityId;
  ticketTypeId: EntityId;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
}