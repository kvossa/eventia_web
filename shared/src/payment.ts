import type { EntityId, Timestamps } from './common.js';
import type { PaymentProvider, PaymentStatus } from './enums.js';

export interface Payment extends Timestamps {
  id: EntityId;
  orderId: EntityId;
  amountCents: number;
  provider: PaymentProvider;
  providerRef: string | null;
  status: PaymentStatus;
}