import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { NotFoundError } from '../common/app-error.js';
import { UsersService } from '../users/users.service.js';
import { CheckoutDto } from './dto/checkout.dto.js';
import { CheckoutService } from './checkout.service.js';

@ApiTags('checkout')
@Controller('checkout')
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Place an order from the current user cart (idempotent)' })
  async checkout(@CurrentUser() user: AuthUserPayload, @Body() dto: CheckoutDto) {
    const account = await this.usersService.findById(user.sub);
    if (!account) throw new NotFoundError('USER_NOT_FOUND', 'User not found');
    return this.checkoutService.placeOrder(user.sub, account.email, dto);
  }
}