import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from '../entities/cart.entity.js';
import { CartItem } from '../entities/cart-item.entity.js';
import { CartItemSeat } from '../entities/cart-item-seat.entity.js';
import { Category } from '../entities/category.entity.js';
import { Event } from '../entities/event.entity.js';
import { Organizer } from '../entities/organizer.entity.js';
import { Seat } from '../entities/seat.entity.js';
import { SeatRow } from '../entities/seat-row.entity.js';
import { Section } from '../entities/section.entity.js';
import { Ticket } from '../entities/ticket.entity.js';
import { TicketType } from '../entities/ticket-type.entity.js';
import { TicketTypeSection } from '../entities/ticket-type-section.entity.js';
import { Venue } from '../entities/venue.entity.js';
import { AdminEventsController, EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,
      TicketType,
      Category,
      Organizer,
      Venue,
      Section,
      SeatRow,
      Seat,
      Ticket,
      TicketTypeSection,
      Cart,
      CartItem,
      CartItemSeat,
    ]),
  ],
  controllers: [EventsController, AdminEventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}