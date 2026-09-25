import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { Venue } from './venue.entity.js';

@Entity('sections')
@Index(['venueId', 'sortOrder'])
export class Section extends BaseEntity {
  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @Index()
  @Column({ name: 'venue_id', type: 'uuid' })
  venueId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;
}