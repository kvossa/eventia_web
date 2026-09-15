import type { EntityId, Timestamps } from './common.js';

export interface Category extends Timestamps {
  id: EntityId;
  name: string;
  description: string | null;
}

export interface CategorySummary {
  id: Category['id'];
  name: Category['name'];
}