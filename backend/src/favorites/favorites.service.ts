import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Paginated } from '@eventia/shared';
import { Repository } from 'typeorm';
import { NotFoundError } from '../common/app-error.js';
import { Favorite } from '../entities/favorite.entity.js';
import { EventsService, type EventListItem } from '../events/events.service.js';

export interface FavoriteView extends EventListItem {
  favoritedAt: string;
}

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoritesRepo: Repository<Favorite>,
    private readonly eventsService: EventsService,
  ) {}

  async listForUser(userId: string): Promise<Paginated<FavoriteView>> {
    const favorites = await this.favoritesRepo.find({
      where: { userId },
      relations: { event: { venue: true, category: true, organizer: true } },
      order: { createdAt: 'DESC' },
    });

    const events = favorites.map((f) => f.event);
    const decorated = await this.eventsService.decorateEvents(events);

    const data = favorites.map((f, index) => ({
      ...decorated[index],
      favoritedAt: f.createdAt.toISOString(),
    }));

    return { data, page: 1, limit: data.length, total: data.length };
  }

  async add(userId: string, eventId: string): Promise<{ id: string }> {
    const existing = await this.favoritesRepo
      .findOne({ where: { userId, eventId } })
      .catch(() => null);
    if (existing) return { id: existing.eventId };

    const event = await this.eventsService.findById(eventId).catch(() => null);
    if (!event) throw new NotFoundError('EVENT_NOT_FOUND', 'Event not found');

    await this.favoritesRepo.save(this.favoritesRepo.create({ userId, eventId }));
    return { id: eventId };
  }

  async remove(userId: string, eventId: string): Promise<void> {
    await this.favoritesRepo.delete({ userId, eventId });
  }
}