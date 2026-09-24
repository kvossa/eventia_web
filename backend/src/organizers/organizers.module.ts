import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../entities/event.entity.js';
import { Organizer } from '../entities/organizer.entity.js';
import { OrganizersController } from './organizers.controller.js';
import { OrganizersService } from './organizers.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Organizer, Event])],
  controllers: [OrganizersController],
  providers: [OrganizersService],
  exports: [OrganizersService],
})
export class OrganizersModule {}