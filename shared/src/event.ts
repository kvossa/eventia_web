import type { EntityId, SoftDeletable, Timestamps } from './common.js';
import type { EventAvailabilityState, EventStatus } from './enums.js';
import type { Venue } from './venue.js';
import type { Category } from './category.js';
import type { Organizer } from './organizer.js';

export interface Event extends Timestamps, SoftDeletable {
  id: EntityId;
  name: string;
  description: string | null;
  categoryId: EntityId;
  organizerId: EntityId;
  venueId: EntityId;
  dateTime: string;
  startTime: string | null;
  endTime: string | null;
  city: string;
  address: string;
  maxCapacity: number | null;
  ageRestriction: string | null;
  accessibilityInfo: string | null;
  status: EventStatus;
  featured: boolean;
  imageUrl: string | null;
}

export interface EventAvailability {
  state: EventAvailabilityState;
  totalStock: number;
  soldCount: number;
  soldPercent: number;
}

export interface EventWithRelations extends Event {
  venue: Venue;
  category: Category;
  organizer: Organizer;
  availability: EventAvailability;
}