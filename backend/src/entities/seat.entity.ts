import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { SeatRow } from './seat-row.entity.js';

@Entity('seats')
@Index(['rowId', 'number'], { unique: true })
export class Seat extends BaseEntity {
  @ManyToOne('SeatRow', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'row_id' })
  row: SeatRow;

  @Index()
  @Column({ name: 'row_id', type: 'uuid' })
  rowId: string;

  @Column({ type: 'integer' })
  number: number;

  @Column({ name: 'is_accessible', type: 'boolean', default: false })
  isAccessible: boolean;
}