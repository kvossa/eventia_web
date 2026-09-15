import type { EntityId, Timestamps } from './common.js';

export interface TicketType extends Timestamps {
  id: EntityId;
  eventId: EntityId;
  name: string;
  description: string | null;
  priceCents: number;
  quantity: number;
  quantitySold: number;
  salesStartsAt: string | null;
  salesEndsAt: string | null;
  isVisible: boolean;
  maxPerCustomer: number | null;
}