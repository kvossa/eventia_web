import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';

@Entity('categories')
export class Category extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;
}