import type { EntityId, SoftDeletable, Timestamps } from './common.js';

export interface Organizer extends Timestamps, SoftDeletable {
  id: EntityId;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
}