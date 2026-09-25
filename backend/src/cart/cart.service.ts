import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CART_LIFETIME_DAYS } from '@eventia/shared';
import { In, IsNull, Repository } from 'typeorm';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../common/app-error.js';
import { Cart } from '../entities/cart.entity.js';
import { CartItem } from '../entities/cart-item.entity.js';
import { CartItemSeat } from '../entities/cart-item-seat.entity.js';
import { Event } from '../entities/event.entity.js';
import { Seat } from '../entities/seat.entity.js';
import { Ticket } from '../entities/ticket.entity.js';
import { TicketType } from '../entities/ticket-type.entity.js';
import { TicketTypeSection } from '../entities/ticket-type-section.entity.js';

export const CART_TTL_MS = CART_LIFETIME_DAYS * 24 * 60 * 60 * 1000;

export interface CartLineSeat {
  seatId: string;
  seatLabel: string;
}

export interface CartLine {
  id: string;
  ticketTypeId: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  ticketType: TicketType;
  event: Event;
  seats: CartLineSeat[];
}

export interface CartWithLines {
  id: string;
  userId: string | null;
  subtotalCents: number;
  items: CartLine[];
}

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartsRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly itemsRepository: Repository<CartItem>,
    @InjectRepository(TicketType)
    private readonly ticketTypesRepository: Repository<TicketType>,
    @InjectRepository(CartItemSeat)
    private readonly cartItemSeatsRepository: Repository<CartItemSeat>,
    @InjectRepository(Seat)
    private readonly seatsRepository: Repository<Seat>,
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,
    @InjectRepository(TicketTypeSection)
    private readonly ticketTypeSectionsRepository: Repository<TicketTypeSection>,
  ) {}

  async getOrCreate(cartId: string | null, userId: string | null): Promise<Cart> {
    const active = {
      status: 'active' as const,
    };

    if (userId) {
      const existing = await this.cartsRepository.findOne({
        where: { ...active, userId },
      });
      if (existing) return existing;
      return this.createCart(userId);
    }

    if (cartId) {
      const existing = await this.cartsRepository.findOne({
        where: { id: cartId, ...active },
      });
      if (existing && existing.expiresAt.getTime() > Date.now()) return existing;
    }

    return this.createCart(null);
  }

  async getWithLines(cart: Cart): Promise<CartWithLines> {
    const items = await this.findLines(cart.id);
    const subtotalCents = items.reduce((sum, item) => sum + item.subtotalCents, 0);
    return { id: cart.id, userId: cart.userId, subtotalCents, items };
  }

  async addItem(
    cart: Cart,
    ticketTypeId: string,
    quantity: number,
    seatIds: string[] = [],
  ): Promise<CartWithLines> {
    const ticketType = await this.ticketTypesRepository.findOne({
      where: { id: ticketTypeId },
      relations: { event: true },
    });
    if (!ticketType) throw new NotFoundError('TICKET_TYPE_NOT_FOUND', 'Ticket type not found');
    await this.assertSellable(ticketType);

    if (ticketType.event.reservedSeating) {
      if (seatIds.length === 0) {
        throw new AppError('SEATS_REQUIRED', 'Seat selection is required for this ticket type', 400);
      }
      quantity = seatIds.length;
      await this.assertSeatsValid(ticketType, seatIds);
      this.assertMaxPerCustomer(ticketType, (await this.existingQuantity(cart.id, ticketTypeId)) + quantity);

      let item = await this.itemsRepository.findOne({
        where: { cartId: cart.id, ticketTypeId },
      });
      if (item) {
        item.quantity += quantity;
        await this.itemsRepository.save(item);
      } else {
        item = this.itemsRepository.create({ cartId: cart.id, ticketTypeId, quantity });
        await this.itemsRepository.save(item);
      }
      await this.saveSeatsForItem(item, seatIds);
    } else {
      if (seatIds.length > 0) {
        throw new AppError(
          'SEATS_NOT_APPLICABLE',
          'Seat selection is only available for reserved-seating events',
          400,
        );
      }
      this.assertCapacity(ticketType, (await this.existingQuantity(cart.id, ticketTypeId)) + quantity);

      let item = await this.itemsRepository.findOne({
        where: { cartId: cart.id, ticketTypeId },
      });
      if (item) {
        item.quantity += quantity;
        await this.itemsRepository.save(item);
      } else {
        item = this.itemsRepository.create({ cartId: cart.id, ticketTypeId, quantity });
        await this.itemsRepository.save(item);
      }
    }

    await this.touchExpiry(cart);
    return this.getWithLines(cart);
  }

  async updateItemQuantity(cart: Cart, itemId: string, quantity: number): Promise<CartWithLines> {
    const item = await this.itemsRepository.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundError('CART_ITEM_NOT_FOUND', 'Cart item not found');

    const hasSeats = await this.cartItemSeatsRepository.exists({
      where: { cartItemId: itemId },
    });
    if (hasSeats) {
      throw new ConflictError(
        'RESERVED_SEATS_FIXED',
        'Seat choices cannot be changed once added to the cart',
      );
    }

    const ticketType = await this.ticketTypesRepository.findOne({
      where: { id: item.ticketTypeId },
    });
    if (!ticketType) throw new NotFoundError('TICKET_TYPE_NOT_FOUND', 'Ticket type not found');

    this.assertCapacity(ticketType, quantity);
    item.quantity = quantity;
    await this.itemsRepository.save(item);

    await this.touchExpiry(cart);
    return this.getWithLines(cart);
  }

  async removeItem(cart: Cart, itemId: string): Promise<CartWithLines> {
    const item = await this.itemsRepository.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundError('CART_ITEM_NOT_FOUND', 'Cart item not found');
    await this.itemsRepository.remove(item);
    return this.getWithLines(cart);
  }

  async clear(cart: Cart): Promise<void> {
    await this.itemsRepository.delete({ cartId: cart.id });
  }

  async markConverted(cartId: string): Promise<void> {
    await this.cartsRepository.update(cartId, { status: 'converted' });
  }

  async mergeGuestCart(cartId: string | null, userId: string): Promise<Cart> {
    if (!cartId) return this.getOrCreate(null, userId);

    const guestCart = await this.cartsRepository.findOne({
      where: { id: cartId, userId: IsNull(), status: 'active' },
    });
    if (!guestCart) return this.getOrCreate(null, userId);

    const userCart = await this.getOrCreate(null, userId);
    const guestItems = await this.itemsRepository.find({ where: { cartId: guestCart.id } });

    for (const guestItem of guestItems) {
      const ticketType = await this.ticketTypesRepository.findOne({
        where: { id: guestItem.ticketTypeId },
        relations: { event: true },
      });
      if (!ticketType) continue;

      const guestSeats = await this.cartItemSeatsRepository.find({
        where: { cartItemId: guestItem.id },
      });

      if (ticketType.event.reservedSeating) {
        if (guestSeats.length === 0) continue;
        const freeSeats = await this.freeForMerge(ticketType, guestSeats, userCart.id);
        if (freeSeats.length === 0) continue;

        let item = await this.itemsRepository.findOne({
          where: { cartId: userCart.id, ticketTypeId: guestItem.ticketTypeId },
        });
        if (!item) {
          item = this.itemsRepository.create({
            cartId: userCart.id,
            ticketTypeId: guestItem.ticketTypeId,
            quantity: 0,
          });
          await this.itemsRepository.save(item);
        }
        item.quantity += freeSeats.length;
        await this.itemsRepository.save(item);
        await this.saveSeatsForItem(item, freeSeats);
        continue;
      }

      const existing = await this.itemsRepository.findOne({
        where: { cartId: userCart.id, ticketTypeId: guestItem.ticketTypeId },
      });
      const combined = Math.min(
        (existing ? existing.quantity : 0) + guestItem.quantity,
        ticketType.maxPerCustomer ?? Number.MAX_SAFE_INTEGER,
      );

      if (existing) {
        existing.quantity = combined;
        await this.itemsRepository.save(existing);
      } else if (combined > 0) {
        await this.itemsRepository.save(
          this.itemsRepository.create({
            cartId: userCart.id,
            ticketTypeId: guestItem.ticketTypeId,
            quantity: combined,
          }),
        );
      }
    }

    await this.cartsRepository.delete(guestCart.id);
    return userCart;
  }

  private async createCart(userId: string | null): Promise<Cart> {
    const cart = this.cartsRepository.create({
      userId,
      status: 'active',
      expiresAt: new Date(Date.now() + CART_TTL_MS),
    });
    return this.cartsRepository.save(cart);
  }

  private async touchExpiry(cart: Cart): Promise<void> {
    cart.expiresAt = new Date(Date.now() + CART_TTL_MS);
    await this.cartsRepository.save(cart);
  }

  private async existingQuantity(cartId: string, ticketTypeId: string): Promise<number> {
    const item = await this.itemsRepository.findOne({ where: { cartId, ticketTypeId } });
    return item ? item.quantity : 0;
  }

  private async assertSellable(ticketType: TicketType): Promise<void> {
    if (!ticketType.isVisible) {
      throw new ValidationError('This ticket type is not available for sale');
    }
    if (ticketType.event.status !== 'published') {
      throw new ValidationError('This event is not available for purchase');
    }
    if (!this.isWithinSalesWindow(ticketType)) {
      throw new ValidationError('Sales are not open for this ticket type');
    }
  }

  private assertCapacity(ticketType: TicketType, quantity: number): void {
    this.assertMaxPerCustomer(ticketType, quantity);
    const remaining = ticketType.quantity - ticketType.quantitySold;
    if (quantity > remaining) {
      throw new ValidationError('Not enough tickets available for this selection');
    }
  }

  private assertMaxPerCustomer(ticketType: TicketType, quantity: number): void {
    if (ticketType.maxPerCustomer !== null && quantity > ticketType.maxPerCustomer) {
      throw new ValidationError(
        `A maximum of ${ticketType.maxPerCustomer} tickets per customer is allowed`,
      );
    }
  }

  private isWithinSalesWindow(ticketType: TicketType): boolean {
    const now = Date.now();
    if (ticketType.salesStartsAt && ticketType.salesStartsAt.getTime() > now) return false;
    if (ticketType.salesEndsAt && ticketType.salesEndsAt.getTime() < now) return false;
    return true;
  }

  private async assertSeatsValid(ticketType: TicketType, seatIds: string[]): Promise<void> {
    const uniqueSeatIds = [...new Set(seatIds)];
    const seats = await this.seatsRepository.find({
      where: { id: In(uniqueSeatIds) },
      relations: { row: { section: true } },
    });
    if (seats.length !== uniqueSeatIds.length) {
      throw new NotFoundError('SEAT_NOT_FOUND', 'One or more selected seats do not exist');
    }

    const sections = new Set(seats.map((seat) => seat.row.section.id));
    if (sections.size > 0) {
      const bound = await this.ticketTypeSectionsRepository.find({
        where: { ticketTypeId: ticketType.id, sectionId: In([...sections]) },
      });
      const boundSectionIds = new Set(bound.map((b) => b.sectionId));
      for (const section of sections) {
        if (!boundSectionIds.has(section)) {
          throw new AppError(
            'SEAT_NOT_IN_TICKET_TYPE',
            'Some selected seats are not available for this ticket type',
            422,
          );
        }
      }
    }

    const taken = await this.findTakenSeats(ticketType.eventId, uniqueSeatIds);
    for (const seatId of uniqueSeatIds) {
      if (taken.has(seatId)) {
        throw new ConflictError('SEAT_TAKEN', 'One or more selected seats are already taken');
      }
    }
    await this.assertSeatsNotCarted(ticketType.eventId, uniqueSeatIds);
  }

  private async findTakenSeats(eventId: string, seatIds: string[]): Promise<Set<string>> {
    const rows = await this.ticketsRepository
      .createQueryBuilder('ticket')
      .select('ticket.seatId', 'seatId')
      .where('ticket.eventId = :eventId', { eventId })
      .andWhere('ticket.seatId IN (:...seatIds)', { seatIds })
      .andWhere('ticket.status NOT IN (:...excluded)', { excluded: ['refunded', 'cancelled'] })
      .getRawMany<{ seatId: string }>();
    return new Set(rows.map((row) => row.seatId));
  }

  private async assertSeatsNotCarted(eventId: string, seatIds: string[]): Promise<void> {
    const rows = await this.cartItemSeatsRepository
      .createQueryBuilder('cis')
      .innerJoin(CartItem, 'ci', 'ci.id = cis.cartItemId')
      .innerJoin(TicketType, 'tt', 'tt.id = ci.ticketTypeId')
      .select('cis.seatId', 'seatId')
      .where('cis.seatId IN (:...seatIds)', { seatIds })
      .andWhere('tt.eventId = :eventId', { eventId })
      .getRawMany<{ seatId: string }>();
    if (rows.length > 0) {
      throw new ConflictError(
        'SEAT_ALREADY_IN_CART',
        'One or more selected seats are already in someone else\u2019s cart',
      );
    }
  }

  private async freeForMerge(
    ticketType: TicketType,
    guestSeats: CartItemSeat[],
    userCartId: string,
  ): Promise<string[]> {
    const seatIds = guestSeats.map((seat) => seat.seatId);
    const taken = await this.findTakenSeats(ticketType.eventId, seatIds);

    const offered = [...new Set(seatIds)];
    const existingRows = await this.cartItemSeatsRepository
      .createQueryBuilder('cis')
      .innerJoin(CartItem, 'ci', 'ci.id = cis.cartItemId')
      .select('cis.seatId', 'seatId')
      .where('cis.seatId IN (:...seatIds)', { seatIds: offered })
      .andWhere('ci.cartId = :userCartId', { userCartId })
      .getRawMany<{ seatId: string }>();
    const existing = new Set(existingRows.map((row) => row.seatId));

    return offered.filter((seatId) => !taken.has(seatId) && !existing.has(seatId));
  }

  private async saveSeatsForItem(item: CartItem, seatIds: string[]): Promise<void> {
    if (seatIds.length === 0) return;
    const seats = await this.seatsRepository.find({
      where: { id: In(seatIds) },
      relations: { row: { section: true } },
    });
    const rows = seats.map((seat) =>
      this.cartItemSeatsRepository.create({
        cartItemId: item.id,
        seatId: seat.id,
        seatLabel: `${seat.row.section.name} \u00b7 ${seat.row.label} \u00b7 ${seat.number}`,
      }),
    );
    await this.cartItemSeatsRepository.save(rows);
  }

  private async findLines(cartId: string): Promise<CartLine[]> {
    const items = await this.itemsRepository.find({
      where: { cartId },
      relations: { ticketType: { event: true } },
    });

    const seatRows = await this.cartItemSeatsRepository.find({
      where: { cartItemId: In(items.map((item) => item.id)) },
      order: { createdAt: 'ASC' },
    });
    const seatsByItem = new Map<string, CartLineSeat[]>();
    for (const row of seatRows) {
      const list = seatsByItem.get(row.cartItemId) ?? [];
      list.push({ seatId: row.seatId, seatLabel: row.seatLabel });
      seatsByItem.set(row.cartItemId, list);
    }

    return items.map((item) => {
      const unitPriceCents = item.ticketType.priceCents;
      return {
        id: item.id,
        ticketTypeId: item.ticketTypeId,
        quantity: item.quantity,
        unitPriceCents,
        subtotalCents: unitPriceCents * item.quantity,
        ticketType: item.ticketType,
        event: item.ticketType.event,
        seats: seatsByItem.get(item.id) ?? [],
      };
    });
  }

  async assertCartExists(cartId: string, condition: 'OWNED', userId: string): Promise<Cart> {
    const cart = await this.cartsRepository.findOne({
      where: { id: cartId, status: 'active' },
    });
    if (!cart || cart.userId !== userId) {
      throw new ConflictError('CART_NOT_FOUND', 'Cart not found for this user');
    }
    return cart;
  }
}