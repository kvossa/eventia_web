import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { OrderStatus } from '@eventia/shared';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OrderQueryDto } from './dto/order-query.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my orders' })
  listMine(@CurrentUser() user: AuthUserPayload, @Query() query: OrderQueryDto) {
    return this.ordersService.listForUser(user.sub, query);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Order detail (own order)' })
  detail(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.ordersService.detailForUser(user.sub, id);
  }
}

@ApiTags('admin-orders')
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search/filter all orders (admin)' })
  list(@Query() query: OrderQueryDto) {
    return this.ordersService.listAdmin(query);
  }

  @Get(':id')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Order detail (admin)' })
  detail(@Param('id') id: string) {
    return this.ordersService.detailAdmin(id);
  }

  @Patch(':id/status')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change order status (admin)' })
  setStatus(@Param('id') id: string, @Body() body: { status: OrderStatus }) {
    return this.ordersService.setStatus(id, body.status);
  }

  @Post(':id/refund')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Simulate a refund (admin)' })
  refund(@Param('id') id: string) {
    return this.ordersService.refund(id);
  }
}