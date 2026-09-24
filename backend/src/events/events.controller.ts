import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AdminEventQueryDto, CreateEventDto, EventQueryDto, UpdateEventDto } from './dto/event.dto.js';
import { EventsService } from './events.service.js';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'List published events (search/filter/paginate)' })
  list(@Query() query: EventQueryDto) {
    return this.eventsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Event detail with ticket types and availability' })
  detail(@Param('id') id: string) {
    return this.eventsService.detail(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an event (admin, defaults to draft)' })
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an event (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish an event (admin)' })
  publish(@Param('id') id: string) {
    return this.eventsService.setStatus(id, 'published');
  }

  @Post(':id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unpublish an event (admin)' })
  unpublish(@Param('id') id: string) {
    return this.eventsService.setStatus(id, 'draft');
  }

  @Post(':id/mark-sold-out')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Force mark an event sold out (admin)' })
  markSoldOut(@Param('id') id: string) {
    return this.eventsService.setStatus(id, 'sold_out');
  }

  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Duplicate an event incl. ticket types (admin, draft copy)' })
  duplicate(@Param('id') id: string) {
    return this.eventsService.duplicate(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft-delete an event (admin)' })
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }
}

@ApiTags('admin-events')
@Controller('admin/events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all events (admin, optional status filter)' })
  list(@Query() query: AdminEventQueryDto) {
    return this.eventsService.listAdmin(query);
  }

  @Get(':id')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Event detail for any status (admin)' })
  detail(@Param('id') id: string) {
    return this.eventsService.detailAdmin(id);
  }
}