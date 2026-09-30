import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { TicketQueryDto } from './dto/ticket-query.dto.js';
import { TicketsService } from './tickets.service.js';

@ApiTags('tickets')
@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My digital tickets (upcoming/past/all)' })
  listMine(@CurrentUser() user: AuthUserPayload, @Query() query: TicketQueryDto) {
    return this.ticketsService.listForUser(user.sub, query);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ticket detail (own ticket with QR payload)' })
  detail(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.ticketsService.detailForUser(user.sub, id);
  }
}

@ApiTags('admin-tickets')
@Controller('admin/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminTicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post(':id/cancel')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a single valid ticket (admin, voids the ticket, frees its seat)' })
  cancel(@Param('id') id: string) {
    return this.ticketsService.cancelTicket(id);
  }
}