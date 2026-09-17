import { Column, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { EVENT_STATUSES, type EventStatus } from '@eventia/shared';
import { BaseEntity } from './base.entity.js';
import { Category } from './category.entity.js';
import { Organizer } from './organizer.entity.js';
import { Venue } from './venue.entity.js';

@Entity('events')
export class Event extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Index()
  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => Organizer)
  @JoinColumn({ name: 'organizer_id' })
  organizer: Organizer;

  @Index()
  @Column({ name: 'organizer_id', type: 'uuid' })
  organizerId: string;

  @ManyToOne(() => Venue)
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @Index()
  @Column({ name: 'venue_id', type: 'uuid' })
  venueId: string;

  @Index()
  @Column({ name: 'date_time', type: 'timestamptz' })
  dateTime: Date;

  @Column({ name: 'start_time', type: 'timetz', nullable: true })
  startTime: string | null;

  @Column({ name: 'end_time', type: 'timetz', nullable: true })
  endTime: string | null;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  city: string;

  @Column({ type: 'varchar', length: 255 })
  address: string;

  @Column({ name: 'max_capacity', type: 'integer', nullable: true })
  maxCapacity: number | null;

  @Column({ name: 'age_restriction', type: 'varchar', length: 100, nullable: true })
  ageRestriction: string | null;

  @Column({ name: 'accessibility_info', type: 'text', nullable: true })
  accessibilityInfo: string | null;

  @Index()
  @Column({ type: 'enum', enum: [...EVENT_STATUSES], enumName: 'event_status', default: 'draft' })
  status: EventStatus;

  @Column({ type: 'boolean', default: false })
  featured: boolean;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}