import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from '../entities/cart.entity.js';
import { CartItem } from '../entities/cart-item.entity.js';
import { CartItemSeat } from '../entities/cart-item-seat.entity.js';
import { Seat } from '../entities/seat.entity.js';
import { Ticket } from '../entities/ticket.entity.js';
import { TicketType } from '../entities/ticket-type.entity.js';
import { TicketTypeSection } from '../entities/ticket-type-section.entity.js';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem, CartItemSeat, TicketType, TicketTypeSection, Seat, Ticket]),
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}