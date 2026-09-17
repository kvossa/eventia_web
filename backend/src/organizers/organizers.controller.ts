import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OrganizersService } from './organizers.service.js';

export class OrganizerBodyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  logoUrl?: string;
}

@ApiTags('organizers')
@Controller('organizers')
export class OrganizersController {
  constructor(private readonly service: OrganizersService) {}

  @Get()
  @ApiOperation({ summary: 'List organizers' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an organizer' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an organizer (admin)' })
  create(@Body() dto: OrganizerBodyDto) {
    return this.service.create({
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      websiteUrl: dto.websiteUrl ?? null,
      logoUrl: dto.logoUrl ?? null,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an organizer (admin)' })
  update(@Param('id') id: string, @Body() dto: Partial<OrganizerBodyDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an organizer (admin)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}