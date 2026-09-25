import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  CreateTicketTypeDto,
  TicketTypeSectionsDto,
  UpdateTicketTypeDto,
} from './dto/ticket-type.dto.js';
import { TicketTypesService } from './ticket-types.service.js';

@ApiTags('ticket-types')
@Controller('ticket-types')
export class TicketTypesController {
  constructor(private readonly service: TicketTypesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all ticket types (admin)' })
  findAll() {
    return this.service.findAll();
  }

  @Get('by-event')
  @ApiOperation({ summary: 'List ticket types for an event' })
  findByEvent(@Query('eventId') eventId: string) {
    return this.service.findByEvent(eventId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a ticket type (admin)' })
  create(@Body() dto: CreateTicketTypeDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a ticket type (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateTicketTypeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a ticket type (admin, only if unsold)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Put(':id/sections')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Replace seat sections of a reserved-seating ticket type (admin)' })
  replaceSections(@Param('id') id: string, @Body() dto: TicketTypeSectionsDto) {
    return this.service.replaceSections(id, dto.sectionIds);
  }
}