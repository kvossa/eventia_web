import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { FavoritesService } from './favorites.service.js';

@ApiTags('favorites')
@Controller('favorites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'My favorite events (with live availability)' })
  list(@CurrentUser() user: AuthUserPayload) {
    return this.favoritesService.listForUser(user.sub);
  }

  @Post(':eventId')
  @ApiOperation({ summary: 'Favorite an event (idempotent)' })
  add(@CurrentUser() user: AuthUserPayload, @Param('eventId') eventId: string) {
    return this.favoritesService.add(user.sub, eventId);
  }

  @Delete(':eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an event from favorites (idempotent)' })
  async remove(@CurrentUser() user: AuthUserPayload, @Param('eventId') eventId: string): Promise<void> {
    await this.favoritesService.remove(user.sub, eventId);
  }
}