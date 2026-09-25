import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { MailService } from './mail.service.js';

@Controller('admin/outbox')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('drain')
  @Roles('admin')
  async drain(): Promise<{ processed: number }> {
    return { processed: await this.mailService.drain() };
  }
}
