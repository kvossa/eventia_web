import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
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