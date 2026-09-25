import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from '../entities/cart.entity.js';
import { CartItem } from '../entities/cart-item.entity.js';
import { Event } from '../entities/event.entity.js';
import { Order } from '../entities/order.entity.js';
import { OrderItem } from '../entities/order-item.entity.js';
import { Payment } from '../entities/payment.entity.js';
import { Ticket } from '../entities/ticket.entity.js';
import { TicketType } from '../entities/ticket-type.entity.js';
import { Venue } from '../entities/venue.entity.js';
import { CartModule } from '../cart/cart.module.js';
import { MailModule } from '../mail/mail.module.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cart,
      CartItem,
      Event,
      Order,
      OrderItem,
      Payment,
      Ticket,
      TicketType,
      Venue,
    ]),
    CartModule,
    MailModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}