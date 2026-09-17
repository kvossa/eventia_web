import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Paginated, EventAvailability } from '@eventia/shared';
import { In, Repository } from 'typeorm';
import { ConflictError, NotFoundError, ValidationError } from '../common/app-error.js';
import { Category } from '../entities/category.entity.js';
import { Event } from '../entities/event.entity.js';
import { Organizer } from '../entities/organizer.entity.js';
import { TicketType } from '../entities/ticket-type.entity.js';
import { Venue } from '../entities/venue.entity.js';
import { computeAvailability, isSalesOpen } from './availability.service.js';
import { CreateEventDto, EventQueryDto, UpdateEventDto } from './dto/event.dto.js';

export interface EventListItem extends Event {
  availability: EventAvailability;
  ticketTypes: TicketType[];
  fromPriceCents: number | null;
}

export interface EventDetail extends EventListItem {
  venue: Venue;
  category: Category;
  organizer: Organizer;
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @InjectRepository(TicketType)
    private readonly ticketTypesRepo: Repository<TicketType>,
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    @InjectRepository(Organizer)
    private readonly organizersRepo: Repository<Organizer>,
    @InjectRepository(Venue)
    private readonly venuesRepo: Repository<Venue>,
  ) {}

  async list(query: EventQueryDto): Promise<Paginated<EventListItem>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const qb = this.eventsRepo
      .createQueryBuilder('event')
      .where('event.status = :status', { status: 'published' })
      .orderBy('event.dateTime', 'ASC');

    if (query.q) {
      qb.andWhere(
        '(event.name ILIKE :q OR event.city ILIKE :q OR venue.name ILIKE :q OR event.address ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }
    if (query.city) {
      qb.andWhere('event.city ILIKE :city', { city: `%${query.city}%` });
    }
    if (query.category) {
      qb.andWhere('event.categoryId = :category', { category: query.category });
    }
    if (query.from) {
      const from = new Date(query.from);
      if (Number.isNaN(from.getTime())) throw new ValidationError('from must be a valid date');
      qb.andWhere('event.dateTime >= :from', { from });
    }
    if (query.to) {
      const to = new Date(query.to);
      if (Number.isNaN(to.getTime())) throw new ValidationError('to must be a valid date');
      qb.andWhere('event.dateTime <= :to', { to });
    }

    qb.leftJoinAndSelect('event.venue', 'venue');
    qb.leftJoinAndSelect('event.category', 'category');
    qb.leftJoinAndSelect('event.organizer', 'organizer');

    if (query.priceMin !== undefined || query.priceMax !== undefined) {
      const conditions: string[] = [];
      const params: Record<string, number> = {};
      if (query.priceMin !== undefined) {
        conditions.push('MIN(tt.priceCents) >= :priceMin');
        params.priceMin = query.priceMin;
      }
      if (query.priceMax !== undefined) {
        conditions.push('MIN(tt.priceCents) <= :priceMax');
        params.priceMax = query.priceMax;
      }
      const subQuery = this.ticketTypesRepo
        .createQueryBuilder('tt')
        .select('tt.eventId', 'eventId')
        .groupBy('tt.eventId')
        .having(conditions.join(' AND '), params)
        .getQuery();
      qb.andWhere(`event.id IN (${subQuery})`).setParameters(params);
    }

    const total = await qb.getCount();
    const events = await qb.skip((page - 1) * limit).take(limit).getMany();
    const items = await this.decorate(events);

    return { data: items, page, limit, total };
  }

  async detail(id: string): Promise<EventDetail> {
    const event = await this.eventsRepo.findOne({
      where: { id, status: 'published' },
      relations: { venue: true, category: true, organizer: true },
    });
    if (!event) throw new NotFoundError('EVENT_NOT_FOUND', 'Event not found');
    const ticketTypes = await this.ticketTypesRepo.find({
      where: { eventId: event.id, isVisible: true },
      order: { priceCents: 'ASC' },
    });
    return this.buildDetail(event, ticketTypes);
  }

  async create(dto: CreateEventDto): Promise<Event> {
    await this.assertReferencesExist(dto.categoryId, dto.organizerId, dto.venueId);
    const venue = await this.venuesRepo.findOne({ where: { id: dto.venueId } });
    const event = this.eventsRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      categoryId: dto.categoryId,
      organizerId: dto.organizerId,
      venueId: dto.venueId,
      dateTime: new Date(dto.dateTime),
      startTime: dto.startTime ?? null,
      endTime: dto.endTime ?? null,
      maxCapacity: dto.maxCapacity ?? null,
      ageRestriction: dto.ageRestriction ?? null,
      accessibilityInfo: dto.accessibilityInfo ?? null,
      city: dto.city ?? venue?.city ?? 'TBA',
      address: dto.address ?? venue?.address ?? 'TBA',
      featured: dto.featured ?? false,
      imageUrl: dto.imageUrl ?? null,
      status: 'draft',
    });
    return this.eventsRepo.save(event);
  }

  async update(id: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.eventsRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundError('EVENT_NOT_FOUND', 'Event not found');

    if (dto.categoryId) await this.assertReferencesExist(dto.categoryId, undefined, undefined);
    if (dto.organizerId) await this.assertReferencesExist(undefined, dto.organizerId, undefined);
    if (dto.venueId) await this.assertReferencesExist(undefined, undefined, dto.venueId);

    if (dto.name !== undefined) event.name = dto.name;
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.categoryId !== undefined) event.categoryId = dto.categoryId;
    if (dto.organizerId !== undefined) event.organizerId = dto.organizerId;
    if (dto.venueId !== undefined) event.venueId = dto.venueId;
    if (dto.dateTime !== undefined) event.dateTime = new Date(dto.dateTime);
    if (dto.startTime !== undefined) event.startTime = dto.startTime;
    if (dto.endTime !== undefined) event.endTime = dto.endTime;
    if (dto.maxCapacity !== undefined) event.maxCapacity = dto.maxCapacity;
    if (dto.ageRestriction !== undefined) event.ageRestriction = dto.ageRestriction;
    if (dto.accessibilityInfo !== undefined) event.accessibilityInfo = dto.accessibilityInfo;
    if (dto.city !== undefined) event.city = dto.city;
    if (dto.address !== undefined) event.address = dto.address;
    if (dto.featured !== undefined) event.featured = dto.featured;
    if (dto.imageUrl !== undefined) event.imageUrl = dto.imageUrl;

    return this.eventsRepo.save(event);
  }

  async setStatus(id: string, status: Event['status']): Promise<Event> {
    const event = await this.eventsRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundError('EVENT_NOT_FOUND', 'Event not found');
    event.status = status;
    return this.eventsRepo.save(event);
  }

  async remove(id: string): Promise<void> {
    const event = await this.eventsRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundError('EVENT_NOT_FOUND', 'Event not found');
    await this.eventsRepo.softRemove(event);
  }

  private async decorate(events: Event[]): Promise<EventListItem[]> {
    if (events.length === 0) return [];
    const ids = events.map((e) => e.id);
    const allTicketTypes = await this.ticketTypesRepo.find({ where: { eventId: In(ids) } });
    return events.map((event) =>
      this.buildListItem(event, allTicketTypes.filter((tt) => tt.eventId === event.id)),
    );
  }

  private buildListItem(event: Event, ticketTypes: TicketType[]): EventListItem {
    const { state, totalStock, soldCount, soldPercent } = computeAvailability(ticketTypes);
    const salesOpen = ticketTypes.some(isSalesOpen);
    const availability: EventAvailability = {
      state: this.resolveAvailabilityState(event, state, salesOpen, totalStock),
      totalStock,
      soldCount,
      soldPercent,
    };
    const priced = ticketTypes.filter((tt) => tt.isVisible);
    return {
      ...event,
      availability,
      ticketTypes,
      fromPriceCents: priced.length > 0 ? Math.min(...priced.map((tt) => tt.priceCents)) : null,
    };
  }

  private buildDetail(event: Event, ticketTypes: TicketType[]): EventDetail {
    const base = this.buildListItem(event, ticketTypes);
    return {
      ...base,
      venue: event.venue,
      category: event.category,
      organizer: event.organizer,
    };
  }

  private resolveAvailabilityState(
    event: Event,
    computed: EventAvailability['state'],
    salesOpen: boolean,
    totalStock: number,
  ): EventAvailability['state'] {
    if (event.status !== 'published' || !salesOpen || totalStock === 0) {
      return 'temporarily_unavailable';
    }
    return computed;
  }

  private async assertReferencesExist(
    categoryId?: string,
    organizerId?: string,
    venueId?: string,
  ): Promise<void> {
    if (categoryId) {
      const found = await this.categoriesRepo.findOne({ where: { id: categoryId } });
      if (!found) throw new ConflictError('CATEGORY_NOT_FOUND', 'Category does not exist');
    }
    if (organizerId) {
      const found = await this.organizersRepo.findOne({ where: { id: organizerId } });
      if (!found) throw new ConflictError('ORGANIZER_NOT_FOUND', 'Organizer does not exist');
    }
    if (venueId) {
      const found = await this.venuesRepo.findOne({ where: { id: venueId } });
      if (!found) throw new ConflictError('VENUE_NOT_FOUND', 'Venue does not exist');
    }
  }
}