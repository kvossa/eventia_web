import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { Event } from './event.entity.js';
import { User } from './user.entity.js';

@Entity('favorites')
@Index('uq_favorites_user_event', ['userId', 'eventId'], { unique: true })
export class Favorite extends BaseEntity {
  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index('idx_favorites_user')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne('Event', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Index('idx_favorites_event')
  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;
}