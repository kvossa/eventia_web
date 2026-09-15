import type { EntityId } from './common.js';
import type { TicketStatus } from './enums.js';

export interface Ticket {
  id: EntityId;
  orderItemId: EntityId;
  userId: EntityId;
  eventId: EntityId;
  ticketTypeId: EntityId;
  uniqueId: string;
  qrPayload: string;
  status: TicketStatus;
  seatLabel: string | null;
  pricePaidCents: number;
  purchasedAt: string;
  createdAt: string;
}

export interface TicketQrPayload {
  v: 1;
  t: string;
  e: string;
  d: string;
  vn: string;
  tt: string;
  s: string | null;
  u: string;
}