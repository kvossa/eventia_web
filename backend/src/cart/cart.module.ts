import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from '../entities/cart.entity.js';
import { CartItem } from '../entities/cart-item.entity.js';
import { TicketType } from '../entities/ticket-type.entity.js';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem, TicketType])],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}