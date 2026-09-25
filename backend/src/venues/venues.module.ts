import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../entities/event.entity.js';
import { Seat } from '../entities/seat.entity.js';
import { Section } from '../entities/section.entity.js';
import { SeatRow } from '../entities/seat-row.entity.js';
import { Venue } from '../entities/venue.entity.js';
import { SeatMapController } from './seat-map.controller.js';
import { VenuesController } from './venues.controller.js';
import { VenuesService } from './venues.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Venue, Event, Section, SeatRow, Seat])],
  controllers: [VenuesController, SeatMapController],
  providers: [VenuesService],
  exports: [VenuesService],
})
export class VenuesModule {}