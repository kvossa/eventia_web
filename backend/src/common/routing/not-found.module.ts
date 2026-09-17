import { Module } from '@nestjs/common';
import { NotFoundController } from './not-found.controller.js';

@Module({
  controllers: [NotFoundController],
})
export class NotFoundModule {}