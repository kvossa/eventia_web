import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Paginated, EventAvailability, EventStatus } from '@eventia/shared';
import { In, Repository } from 'typeorm';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../common/app-error.js';
import { Category } from '../entities/category.entity.js';
import { Event } from '../entities/event.entity.js';
import { Organizer } from '../entities/organizer.entity.js';
import { Seat } from '../entities/seat.entity.js';
import { SeatRow } from '../entities/seat-row.entity.js';
import { Section } from '../entities/section.entity.js';
import { Ticket } from '../entities/ticket.entity.js';
import { TicketType } from '../entities/ticket-type.entity.js';
import { TicketTypeSection } from '../entities/ticket-type-section.entity.js';
import { Venue } from '../entities/venue.entity.js';
import { computeAvailability, isSalesOpen } from './availability.service.js';
import { AdminEventQueryDto, CreateEventDto, EventQueryDto, UpdateEventDto } from './dto/event.dto.js';

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
    @InjectRepository(Section)
    private readonly sectionsRepo: Repository<Section>,
    @InjectRepository(TicketTypeSection)
    private readonly ticketTypeSectionsRepo: Repository<TicketTypeSection>,
    @InjectRepository(SeatRow)
    private readonly seatRowsRepo: Repository<SeatRow>,
    @InjectRepository(Seat)
    private readonly seatsRepo: Repository<Seat>,
    @InjectRepository(Ticket)
    private readonly ticketsRepo: Repository<Ticket>,
  ) {}

  async list(query: EventQueryDto): Promise<Paginated<EventListItem>> {
    return this.runList(query, 'published');
  }

  async listAdmin(query: AdminEventQueryDto): Promise<Paginated<EventListItem>> {
    return this.runList(query, query.status);
  }

  private async runList(
    query: EventQueryDto,
    status?: EventStatus,
  ): Promise<Paginated<EventListItem>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const qb = this.eventsRepo
      .createQueryBuilder('event')
      .orderBy('event.dateTime', 'ASC');

    if (status) {
      qb.andWhere('event.status = :status', { status });
    }

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

  findById(id: string): Promise<Event | null> {
    return this.eventsRepo.findOne({ where: { id } });
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
    await this.attachSectionIds(event, ticketTypes);
    return this.buildDetail(event, ticketTypes);
  }

  async detailAdmin(id: string): Promise<EventDetail> {
    const event = await this.eventsRepo.findOne({
      where: { id },
      relations: { venue: true, category: true, organizer: true },
    });
    if (!event) throw new NotFoundError('EVENT_NOT_FOUND', 'Event not found');
    const ticketTypes = await this.ticketTypesRepo.find({
      where: { eventId: event.id },
      order: { priceCents: 'ASC' },
    });
    await this.attachSectionIds(event, ticketTypes);
    return this.buildDetail(event, ticketTypes);
  }

  async getSeatMap(id: string): Promise<unknown> {
    const event = await this.eventsRepo.findOne({ where: { id, status: 'published' } });
    if (!event) throw new NotFoundError('EVENT_NOT_FOUND', 'Event not found');
    if (!event.reservedSeating) {
      throw new AppError(
        'EVENT_NOT_RESERVED',
        'This event does not use reserved seating',
        400,
      );
    }

    const ticketTypes = await this.ticketTypesRepo.find({
      where: { eventId: event.id, isVisible: true },
      order: { priceCents: 'ASC' },
    });
    await this.attachSectionIds(event, ticketTypes);

    const sections = await this.sectionsRepo.find({
      where: { venueId: event.venueId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    const rows = await this.seatRowsRepo.find({
      where: { sectionId: In(sections.map((section) => section.id)) },
      order: { createdAt: 'ASC' },
    });
    const seats = await this.seatsRepo.find({
      where: { rowId: In(rows.map((row) => row.id)) },
      order: { number: 'ASC' },
    });

    const occupiedRows = await this.ticketsRepo
      .createQueryBuilder('ticket')
      .select('ticket.seatId', 'seatId')
      .where('ticket.eventId = :eventId', { eventId: event.id })
      .andWhere('ticket.seatId IS NOT NULL')
      .andWhere('ticket.status NOT IN (:...excluded)', { excluded: ['refunded', 'cancelled'] })
      .getRawMany<{ seatId: string }>();
    const occupied = new Set(occupiedRows.map((row) => row.seatId));

    return {
      ticketTypes: ticketTypes.map((tt) => ({
        id: tt.id,
        name: tt.name,
        priceCents: tt.priceCents,
        sectionIds: (tt as TicketType & { sectionIds?: string[] }).sectionIds ?? [],
      })),
      sections: sections.map((section) => ({
        id: section.id,
        name: section.name,
        rows: rows
          .filter((row) => row.sectionId === section.id)
          .map((row) => ({
            id: row.id,
            label: row.label,
            seats: seats
              .filter((seat) => seat.rowId === row.id)
              .map((seat) => ({
                id: seat.id,
                number: seat.number,
                isAccessible: seat.isAccessible,
                occupied: occupied.has(seat.id),
              })),
          })),
      })),
    };
  }

  private async attachSectionIds(event: Event, ticketTypes: TicketType[]): Promise<void> {
    if (!event.reservedSeating || ticketTypes.length === 0) return;
    const bindings = await this.ticketTypeSectionsRepo.find({
      where: { ticketTypeId: In(ticketTypes.map((tt) => tt.id)) },
    });
    const byType = new Map<string, string[]>();
    for (const binding of bindings) {
      const list = byType.get(binding.ticketTypeId) ?? [];
      list.push(binding.sectionId);
      byType.set(binding.ticketTypeId, list);
    }
    for (const tt of ticketTypes) {
      (tt as TicketType & { sectionIds: string[] }).sectionIds = byType.get(tt.id) ?? [];
    }
  }

  async create(dto: CreateEventDto): Promise<Event> {
    await this.assertReferencesExist(dto.categoryId, dto.organizerId, dto.venueId);
    const venue = await this.venuesRepo.findOne({ where: { id: dto.venueId } });
    if (dto.reservedSeating) await this.assertVenueHasLayout(dto.venueId);
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
      reservedSeating: dto.reservedSeating ?? false,
      imageUrl: dto.imageUrl ?? null,
      status: 'draft',
    });
    return this.eventsRepo.save(event);
  }

  private async assertVenueHasLayout(venueId: string): Promise<void> {
    const sectionCount = await this.sectionsRepo.count({ where: { venueId } });
    if (sectionCount === 0) {
      throw new AppError(
        'RESERVED_SEATING_NEEDS_LAYOUT',
        'Reserved seating requires the venue to have a seat layout',
        400,
      );
    }
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
    if (dto.reservedSeating !== undefined) event.reservedSeating = dto.reservedSeating;
    if (event.reservedSeating) await this.assertVenueHasLayout(event.venueId);
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

  async duplicate(id: string): Promise<EventListItem> {
    const event = await this.eventsRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundError('EVENT_NOT_FOUND', 'Event not found');

    const ticketTypes = await this.ticketTypesRepo.find({ where: { eventId: event.id } });
    const name = event.name.length > 250 ? `${event.name.slice(0, 250)} (copy)` : `${event.name} (copy)`;

    const copy = this.eventsRepo.create({
      name,
      description: event.description,
      categoryId: event.categoryId,
      organizerId: event.organizerId,
      venueId: event.venueId,
      dateTime: event.dateTime,
      startTime: event.startTime,
      endTime: event.endTime,
      maxCapacity: event.maxCapacity,
      ageRestriction: event.ageRestriction,
      accessibilityInfo: event.accessibilityInfo,
      city: event.city,
      address: event.address,
      featured: false,
      reservedSeating: event.reservedSeating,
      imageUrl: event.imageUrl,
      status: 'draft',
    });
    const saved = await this.eventsRepo.save(copy);

    if (ticketTypes.length > 0) {
      await this.ticketTypesRepo.save(
        ticketTypes.map((tt) =>
          this.ticketTypesRepo.create({
            eventId: saved.id,
            name: tt.name,
            description: tt.description,
            priceCents: tt.priceCents,
            quantity: tt.quantity,
            quantitySold: 0,
            salesStartsAt: tt.salesStartsAt,
            salesEndsAt: tt.salesEndsAt,
            isVisible: tt.isVisible,
            maxPerCustomer: tt.maxPerCustomer,
          }),
        ),
      );
    }

    const copiedTicketTypes = await this.ticketTypesRepo.find({ where: { eventId: saved.id } });
    return this.buildListItem(saved, copiedTicketTypes);
  }

  async decorateEvents(events: Event[]): Promise<EventListItem[]> {
    return this.decorate(events);
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