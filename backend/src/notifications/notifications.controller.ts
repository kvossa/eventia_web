import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { NotificationQueryDto } from './dto/notification-query.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My notifications (+ unread count)' })
  list(@CurrentUser() user: AuthUserPayload, @Query() query: NotificationQueryDto) {
    return this.notificationsService.listForUser(user.sub, query);
  }

  @Get('unread-count')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unread notifications count' })
  unreadCount(@CurrentUser() user: AuthUserPayload) {
    return this.notificationsService.unreadCount(user.sub);
  }

  @Patch('read-all')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark all as read' })
  markAllRead(@CurrentUser() user: AuthUserPayload) {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Patch(':id/read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.notificationsService.markRead(user.sub, id);
  }
}