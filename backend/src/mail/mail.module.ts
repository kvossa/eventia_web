import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailOutboxRecord } from '../entities/email-outbox.entity.js';
import { User } from '../entities/user.entity.js';
import { MailController } from './mail.controller.js';
import { MailService } from './mail.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([EmailOutboxRecord, User])],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
