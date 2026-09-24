import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictError, NotFoundError } from '../common/app-error.js';
import { Event } from '../entities/event.entity.js';
import { Venue } from '../entities/venue.entity.js';

@Injectable()
export class VenuesService {
  constructor(
    @InjectRepository(Venue)
    private readonly repo: Repository<Venue>,
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
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
}