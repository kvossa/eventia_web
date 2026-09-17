import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CART_LIFETIME_DAYS } from '@eventia/shared';
import { IsNull, Repository } from 'typeorm';
import { ConflictError, NotFoundError, ValidationError } from '../common/app-error.js';
import { Cart } from '../entities/cart.entity.js';
import { CartItem } from '../entities/cart-item.entity.js';
import { Event } from '../entities/event.entity.js';
import { TicketType } from '../entities/ticket-type.entity.js';

export const CART_TTL_MS = CART_LIFETIME_DAYS * 24 * 60 * 60 * 1000;

export interface CartLine {
  id: string;
  ticketTypeId: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  ticketType: TicketType;
  event: Event;
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

  async addItem(cart: Cart, ticketTypeId: string, quantity: number): Promise<CartWithLines> {
    const ticketType = await this.assertSellable(ticketTypeId, quantity);

    let item = await this.itemsRepository.findOne({
      where: { cartId: cart.id, ticketTypeId },
    });

    const purchasedInCart = item ? item.quantity : 0;
    this.assertCapacity(ticketType, purchasedInCart + quantity);

    if (item) {
      item.quantity += quantity;
      await this.itemsRepository.save(item);
    } else {
      item = this.itemsRepository.create({ cartId: cart.id, ticketTypeId, quantity });
      await this.itemsRepository.save(item);
    }

    await this.touchExpiry(cart);
    return this.getWithLines(cart);
  }

  async updateItemQuantity(cart: Cart, itemId: string, quantity: number): Promise<CartWithLines> {
    const item = await this.itemsRepository.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundError('CART_ITEM_NOT_FOUND', 'Cart item not found');

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
      });
      if (!ticketType) continue;

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

  private async assertSellable(ticketTypeId: string, quantity: number): Promise<TicketType> {
    const ticketType = await this.ticketTypesRepository.findOne({
      where: { id: ticketTypeId },
      relations: { event: true },
    });
    if (!ticketType) {
      throw new NotFoundError('TICKET_TYPE_NOT_FOUND', 'Ticket type not found');
    }
    if (!ticketType.isVisible) {
      throw new ValidationError('This ticket type is not available for sale');
    }
    if (ticketType.event.status !== 'published') {
      throw new ValidationError('This event is not available for purchase');
    }
    if (!this.isWithinSalesWindow(ticketType)) {
      throw new ValidationError('Sales are not open for this ticket type');
    }
    this.assertCapacity(ticketType, quantity);
    return ticketType;
  }

  private assertCapacity(ticketType: TicketType, quantity: number): void {
    const remaining = ticketType.quantity - ticketType.quantitySold;
    if (quantity > remaining) {
      throw new ValidationError('Not enough tickets available for this selection');
    }
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

  private async findLines(cartId: string): Promise<CartLine[]> {
    const items = await this.itemsRepository.find({
      where: { cartId },
      relations: { ticketType: { event: true } },
    });

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