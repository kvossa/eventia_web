import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { VenuesService } from './venues.service.js';

export class VenueBodyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  city: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  address: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000)
  capacity?: number;

  @IsOptional()
  @IsString()
  @IsUrl()
  imageUrl?: string;
}

@ApiTags('venues')
@Controller('venues')
export class VenuesController {
  constructor(private readonly service: VenuesService) {}

  @Get()
  @ApiOperation({ summary: 'List venues' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a venue' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a venue (admin)' })
  create(@Body() dto: VenueBodyDto) {
    return this.service.create({
      name: dto.name,
      city: dto.city,
      address: dto.address,
      description: dto.description ?? null,
      capacity: dto.capacity ?? null,
      imageUrl: dto.imageUrl ?? null,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a venue (admin)' })
  update(@Param('id') id: string, @Body() dto: Partial<VenueBodyDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a venue (admin)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}