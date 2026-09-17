import type { User } from '../entities/user.entity.js';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  profileImageUrl: string | null;
  preferredCity: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  profileImageUrl: user.profileImageUrl,
  preferredCity: user.preferredCity,
  role: user.role,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});