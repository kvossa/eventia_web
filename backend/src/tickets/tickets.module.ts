import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../entities/ticket.entity.js';
import { AdminTicketsController, TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket])],
  controllers: [TicketsController, AdminTicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}