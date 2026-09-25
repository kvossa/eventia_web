import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator.js';
import { CART_COOKIE, setCartCookie } from '../common/cookies.js';
import { CartService, CART_TTL_MS } from './cart.service.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';

@ApiTags('cart')
@Controller('cart')
@UseGuards(OptionalJwtAuthGuard)
export class CartController {
  private readonly cookieSecure: boolean;

  constructor(
    private readonly cartService: CartService,
    config: ConfigService,
  ) {
    this.cookieSecure = config.get<string>('COOKIE_SECURE') === 'true';
  }

  @Get()
  @ApiOperation({ summary: 'Get cart (creates one if needed)' })
  async getCart(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const cart = await this.cartService.getOrCreate(this.readCartId(req), this.readUserId(req));
    this.ensureCookie(res, cart.id);
    return this.cartService.getWithLines(cart);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add tickets to the cart' })
  async addItem(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: AddCartItemDto,
  ) {
    const cart = await this.cartService.getOrCreate(this.readCartId(req), this.readUserId(req));
    this.ensureCookie(res, cart.id);
    return this.cartService.addItem(cart, dto.ticketTypeId, dto.quantity, dto.seatIds ?? []);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Update cart item quantity' })
  async updateItem(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const cart = await this.cartService.getOrCreate(this.readCartId(req), this.readUserId(req));
    return this.cartService.updateItemQuantity(cart, itemId, dto.quantity);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove item from the cart' })
  async removeItem(@Req() req: AuthenticatedRequest, @Param('itemId') itemId: string) {
    const cart = await this.cartService.getOrCreate(this.readCartId(req), this.readUserId(req));
    return this.cartService.removeItem(cart, itemId);
  }

  private readUserId(req: AuthenticatedRequest): string | null {
    return req.user?.sub ?? null;
  }

  private readCartId(req: Request): string | null {
    const id = (req.cookies as Record<string, string | undefined> | undefined)?.[CART_COOKIE];
    return typeof id === 'string' && id ? id : null;
  }

  private ensureCookie(res: Response, cartId: string): void {
    setCartCookie(res, cartId, { secure: this.cookieSecure, maxAgeMs: CART_TTL_MS });
  }
}