import type { EntityId } from './common.js';

export interface Favorite {
  id: EntityId;
  userId: EntityId;
  eventId: EntityId;
  createdAt: string;
}