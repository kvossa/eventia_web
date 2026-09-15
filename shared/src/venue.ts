import type { EntityId, SoftDeletable, Timestamps } from './common.js';

export interface Venue extends Timestamps, SoftDeletable {
  id: EntityId;
  name: string;
  address: string;
  city: string;
  capacity: number | null;
  description: string | null;
  imageUrl: string | null;
}