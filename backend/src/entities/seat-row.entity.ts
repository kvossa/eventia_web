import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { Section } from './section.entity.js';

@Entity('seat_rows')
@Index(['sectionId', 'label'], { unique: true })
export class SeatRow extends BaseEntity {
  @ManyToOne('Section', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: Section;

  @Index()
  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @Column({ type: 'varchar', length: 50 })
  label: string;
}