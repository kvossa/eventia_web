import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../entities/category.entity.js';
import { Event } from '../entities/event.entity.js';
import { Organizer } from '../entities/organizer.entity.js';
import { TicketType } from '../entities/ticket-type.entity.js';
import { Venue } from '../entities/venue.entity.js';
import { AdminEventsController, EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Event, TicketType, Category, Organizer, Venue])],
  controllers: [EventsController, AdminEventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}