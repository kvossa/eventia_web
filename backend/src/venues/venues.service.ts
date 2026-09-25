import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConflictError, NotFoundError, ValidationError } from '../common/app-error.js';
import { Event } from '../entities/event.entity.js';
import { Seat } from '../entities/seat.entity.js';
import { Section } from '../entities/section.entity.js';
import { SeatRow } from '../entities/seat-row.entity.js';
import { Venue } from '../entities/venue.entity.js';

export interface LayoutSeatView {
  id: string;
  number: number;
  isAccessible: boolean;
}

export interface LayoutRowView {
  id: string;
  label: string;
  seats: LayoutSeatView[];
}

export interface LayoutSectionView {
  id: string;
  name: string;
  sortOrder: number;
  rows: LayoutRowView[];
}

export interface VenueLayoutView {
  sections: LayoutSectionView[];
}

@Injectable()
export class VenuesService {
  constructor(
    @InjectRepository(Venue)
    private readonly repo: Repository<Venue>,
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @InjectRepository(Section)
    private readonly sectionsRepo: Repository<Section>,
    @InjectRepository(SeatRow)
    private readonly rowsRepo: Repository<SeatRow>,
    @InjectRepository(Seat)
    private readonly seatsRepo: Repository<Seat>,
  ) {}

  findAll(): Promise<Venue[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Venue> {
    const venue = await this.repo.findOne({ where: { id } });
    if (!venue) throw new NotFoundError('VENUE_NOT_FOUND', 'Venue not found');
    return venue;
  }

  create(data: { name: string; city: string; address: string; description?: string | null; capacity?: number | null; imageUrl?: string | null }): Promise<Venue> {
    const venue = this.repo.create(data);
    return this.repo.save(venue);
  }

  async update(id: string, data: Partial<{ name: string; city: string; address: string; description: string | null; capacity: number | null; imageUrl: string | null }>): Promise<Venue> {
    const venue = await this.findOne(id);
    Object.assign(venue, data);
    return this.repo.save(venue);
  }

  async remove(id: string): Promise<void> {
    const venue = await this.findOne(id);
    const used = await this.eventsRepo.count({ where: { venueId: id } });
    if (used > 0) {
      throw new ConflictError('VENUE_IN_USE', 'Cannot delete a venue that still has events');
    }
    await this.repo.softRemove(venue);
  }

  async getLayout(venueId: string): Promise<VenueLayoutView> {
    await this.findOne(venueId);
    const sections = await this.sectionsRepo.find({
      where: { venueId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    const rows = await this.rowsRepo.find({
      where: sections.length > 0 ? { sectionId: In(sections.map((s) => s.id)) } : {},
      order: { createdAt: 'ASC' },
    });
    const seats = await this.seatsRepo.find({
      where: rows.length > 0 ? { rowId: In(rows.map((r) => r.id)) } : {},
      order: { number: 'ASC' },
    });

    const seatByRow = new Map<string, LayoutSeatView[]>();
    for (const seat of seats) {
      const list = seatByRow.get(seat.rowId) ?? [];
      list.push({ id: seat.id, number: seat.number, isAccessible: seat.isAccessible });
      seatByRow.set(seat.rowId, list);
    }

    const rowsBySection = new Map<string, LayoutRowView[]>();
    for (const row of rows) {
      const list = rowsBySection.get(row.sectionId) ?? [];
      list.push({ id: row.id, label: row.label, seats: seatByRow.get(row.id) ?? [] });
      rowsBySection.set(row.sectionId, list);
    }

    return {
      sections: sections.map((section) => ({
        id: section.id,
        name: section.name,
        sortOrder: section.sortOrder,
        rows: rowsBySection.get(section.id) ?? [],
      })),
    };
  }

  async createSection(venueId: string, name: string, sortOrder: number): Promise<Section> {
    await this.findOne(venueId);
    return this.sectionsRepo.save(this.sectionsRepo.create({ venueId, name, sortOrder }));
  }

  async updateSection(id: string, data: Partial<{ name: string; sortOrder: number }>): Promise<Section> {
    const section = await this.sectionsRepo.findOne({ where: { id } });
    if (!section) throw new NotFoundError('SECTION_NOT_FOUND', 'Section not found');
    Object.assign(section, data);
    return this.sectionsRepo.save(section);
  }

  async deleteSection(id: string): Promise<void> {
    const section = await this.sectionsRepo.findOne({ where: { id } });
    if (!section) throw new NotFoundError('SECTION_NOT_FOUND', 'Section not found');
    await this.sectionsRepo.remove(section);
  }

  async createRow(sectionId: string, label: string, seatCount: number, accessibleNumbers: number[]): Promise<SeatRow> {
    const section = await this.sectionsRepo.findOne({ where: { id: sectionId } });
    if (!section) throw new NotFoundError('SECTION_NOT_FOUND', 'Section not found');
    await this.assertRowLabelFree(sectionId, label);
    this.assertAccessibleNumbers(accessibleNumbers, seatCount);

    const row = await this.rowsRepo.save(this.rowsRepo.create({ sectionId, label }));
    await this.materializeSeats(row.id, seatCount, accessibleNumbers);
    return row;
  }

  async updateRow(
    id: string,
    data: { label: string; seatCount: number; accessibleNumbers: number[] },
  ): Promise<SeatRow> {
    const row = await this.rowsRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundError('ROW_NOT_FOUND', 'Row not found');
    if (data.label !== row.label) {
      await this.assertRowLabelFree(row.sectionId, data.label);
    }
    this.assertAccessibleNumbers(data.accessibleNumbers, data.seatCount);

    await this.seatsRepo.delete({ rowId: id });
    row.label = data.label;
    await this.rowsRepo.save(row);
    await this.materializeSeats(id, data.seatCount, data.accessibleNumbers);
    return row;
  }

  async deleteRow(id: string): Promise<void> {
    const row = await this.rowsRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundError('ROW_NOT_FOUND', 'Row not found');
    await this.rowsRepo.remove(row);
  }

  private async assertRowLabelFree(sectionId: string, label: string): Promise<void> {
    const existing = await this.rowsRepo.findOne({ where: { sectionId, label } });
    if (existing) {
      throw new ConflictError('ROW_LABEL_TAKEN', `A row labelled "${label}" already exists in this section`);
    }
  }

  private assertAccessibleNumbers(accessibleNumbers: number[], seatCount: number): void {
    const unique = new Set(accessibleNumbers);
    if (unique.size !== accessibleNumbers.length) {
      throw new ValidationError('Accessible seat numbers must be unique');
    }
    for (const number of accessibleNumbers) {
      if (number < 1 || number > seatCount) {
        throw new ValidationError('Accessible seat numbers must be between 1 and the seat count');
      }
    }
  }

  private async materializeSeats(rowId: string, seatCount: number, accessibleNumbers: number[]): Promise<void> {
    const accessible = new Set(accessibleNumbers);
    const seats: Pick<Seat, 'rowId' | 'number' | 'isAccessible'>[] = [];
    for (let n = 1; n <= seatCount; n++) {
      seats.push({ rowId, number: n, isAccessible: accessible.has(n) });
    }
    await this.seatsRepo.save(this.seatsRepo.create(seats));
  }
}