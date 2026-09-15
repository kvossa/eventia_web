export type EntityId = string;

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

export interface SoftDeletable {
  deletedAt: string | null;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}