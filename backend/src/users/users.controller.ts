import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UnauthorizedError } from '../common/app-error.js';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { toPublicUser } from './user.mapper.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user profile' })
  async getCurrent(@CurrentUser() user: AuthUserPayload) {
    const me = await this.usersService.findById(user.sub);
    if (!me) throw new UnauthorizedError('USER_NOT_FOUND', 'User no longer exists');
    return toPublicUser(me);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async update(@CurrentUser() user: AuthUserPayload, @Body() dto: UpdateProfileDto) {
    const updated = await this.usersService.updateProfile(user.sub, dto);
    return toPublicUser(updated);
  }
}