import type { EntityId, SoftDeletable, Timestamps } from './common.js';
import type { UserRole } from './enums.js';

export interface User extends Timestamps, SoftDeletable {
  id: EntityId;
  name: string;
  email: string;
  phone: string | null;
  profileImageUrl: string | null;
  preferredCity: string | null;
  role: UserRole;
}