import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../entities/event.entity.js';
import { Section } from '../entities/section.entity.js';
import { TicketType } from '../entities/ticket-type.entity.js';
import { TicketTypeSection } from '../entities/ticket-type-section.entity.js';
import { TicketTypesController } from './ticket-types.controller.js';
import { TicketTypesService } from './ticket-types.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([TicketType, Event, Section, TicketTypeSection]),
  ],
  controllers: [TicketTypesController],
  providers: [TicketTypesService],
  exports: [TicketTypesService],
})
export class TicketTypesModule {}