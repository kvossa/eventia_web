import { Column, DeleteDateColumn, Entity } from 'typeorm';
import { BaseEntity } from './base.entity.js';

@Entity('venues')
export class Venue extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  address: string;

  @Column({ type: 'varchar', length: 255 })
  city: string;

  @Column({ type: 'integer', nullable: true })
  capacity: number | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}