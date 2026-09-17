import { Column, DeleteDateColumn, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';

@Entity('organizers')
export class Organizer extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @Column({ name: 'website_url', type: 'varchar', length: 500, nullable: true })
  websiteUrl: string | null;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}