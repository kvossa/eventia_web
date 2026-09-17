import { Column, DeleteDateColumn, Entity, Index } from 'typeorm';
import { USER_ROLES, type UserRole } from '@eventia/shared';
import { BaseEntity } from './base.entity.js';

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  phone: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'profile_image_url', type: 'varchar', length: 500, nullable: true })
  profileImageUrl: string | null;

  @Column({ name: 'preferred_city', type: 'varchar', length: 255, nullable: true })
  preferredCity: string | null;

  @Column({ type: 'enum', enum: [...USER_ROLES], enumName: 'user_role', default: 'customer' })
  role: UserRole;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}