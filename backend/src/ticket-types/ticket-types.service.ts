import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../common/app-error.js';
import { Event } from '../entities/event.entity.js';
import { Section } from '../entities/section.entity.js';
import { TicketType } from '../entities/ticket-type.entity.js';
import { TicketTypeSection } from '../entities/ticket-type-section.entity.js';
import { CreateTicketTypeDto, UpdateTicketTypeDto } from './dto/ticket-type.dto.js';

@Injectable()
export class TicketTypesService {
  constructor(
    @InjectRepository(TicketType)
    private readonly repo: Repository<TicketType>,
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @InjectRepository(Section)
    private readonly sectionsRepo: Repository<Section>,
    @InjectRepository(TicketTypeSection)
    private readonly ticketTypeSectionsRepo: Repository<TicketTypeSection>,
  ) {}

  findAll(): Promise<TicketType[]> {
    return this.repo.find({ order: { eventId: 'ASC', priceCents: 'ASC' } });
  }

  async findByEvent(eventId: string): Promise<TicketType[]> {
    const ticketTypes = await this.repo.find({
      where: { eventId },
      order: { priceCents: 'ASC' },
    });
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    await this.attachSectionIds(event?.reservedSeating ?? false, ticketTypes);
    return ticketTypes;
  }

  private async attachSectionIds(reserved: boolean, ticketTypes: TicketType[]): Promise<void> {
    if (!reserved || ticketTypes.length === 0) return;
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

  async create(dto: CreateTicketTypeDto): Promise<TicketType> {
    const event = await this.eventsRepo.findOne({ where: { id: dto.eventId } });
    if (!event) throw new ConflictError('EVENT_NOT_FOUND', 'Event does not exist');

    const ticketType = this.repo.create({
      eventId: dto.eventId,
      name: dto.name,
      description: dto.description ?? null,
      priceCents: dto.priceCents,
      quantity: dto.quantity,
      quantitySold: 0,
      salesStartsAt: dto.salesStartsAt ? new Date(dto.salesStartsAt) : null,
      salesEndsAt: dto.salesEndsAt ? new Date(dto.salesEndsAt) : null,
      isVisible: dto.isVisible ?? true,
      maxPerCustomer: dto.maxPerCustomer ?? null,
    });
    return this.repo.save(ticketType);
  }

  async update(id: string, dto: UpdateTicketTypeDto): Promise<TicketType> {
    const ticketType = await this.findOne(id);
    if (dto.name !== undefined) ticketType.name = dto.name;
    if (dto.description !== undefined) ticketType.description = dto.description;
    if (dto.priceCents !== undefined) ticketType.priceCents = dto.priceCents;
    if (dto.quantity !== undefined) {
      if (dto.quantity < ticketType.quantitySold) {
        throw new ValidationError('Quantity cannot be lower than already sold tickets');
      }
      ticketType.quantity = dto.quantity;
    }
    if (dto.salesStartsAt !== undefined) {
      ticketType.salesStartsAt = dto.salesStartsAt ? new Date(dto.salesStartsAt) : null;
    }
    if (dto.salesEndsAt !== undefined) {
      ticketType.salesEndsAt = dto.salesEndsAt ? new Date(dto.salesEndsAt) : null;
    }
    if (dto.isVisible !== undefined) ticketType.isVisible = dto.isVisible;
    if (dto.maxPerCustomer !== undefined) ticketType.maxPerCustomer = dto.maxPerCustomer;
    return this.repo.save(ticketType);
  }

  async findOne(id: string): Promise<TicketType> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundError('TICKET_TYPE_NOT_FOUND', 'Ticket type not found');
    return found;
  }

  async remove(id: string): Promise<void> {
    const ticketType = await this.findOne(id);
    if (ticketType.quantitySold > 0) {
      throw new ConflictError(
        'TICKET_TYPE_HAS_SALES',
        'Cannot delete a ticket type that already has sales',
      );
    }
    await this.repo.remove(ticketType);
  }

  async replaceSections(id: string, sectionIds: string[]): Promise<{ id: string; sectionIds: string[] }> {
    const ticketType = await this.findOne(id);
    const event = await this.eventsRepo.findOne({ where: { id: ticketType.eventId } });
    if (!event) throw new NotFoundError('EVENT_NOT_FOUND', 'Event not found');
    if (!event.reservedSeating) {
      throw new AppError('SEATS_NOT_APPLICABLE', 'Only reserved-seating events support seat sections', 400);
    }
    if (sectionIds.length > 0) {
      const venuesSectionIds = await this.sectionsRepo.find({
        where: { id: In(sectionIds), venueId: event.venueId },
      });
      if (venuesSectionIds.length !== sectionIds.length) {
        throw new AppError('SECTIONS_NOT_FOR_VENUE', 'Every section must belong to the event venue', 422);
      }
    }
    await this.ticketTypeSectionsRepo.delete({ ticketTypeId: id });
    if (sectionIds.length > 0) {
      await this.ticketTypeSectionsRepo.save(
        sectionIds.map((sectionId) =>
          this.ticketTypeSectionsRepo.create({ ticketTypeId: id, sectionId }),
        ),
      );
    }
    return { id, sectionIds };
  }
}