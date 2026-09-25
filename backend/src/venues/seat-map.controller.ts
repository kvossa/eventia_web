import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { VenuesService } from './venues.service.js';

export class CreateSectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class RowDraftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  label: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  seatCount: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  accessibleNumbers?: number[];
}

@ApiTags('venues')
@Controller('admin/venues')
export class SeatMapController {
  constructor(private readonly service: VenuesService) {}

  @Post(':venueId/sections')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a venue section (admin)' })
  createSection(@Param('venueId') venueId: string, @Body() dto: CreateSectionDto) {
    return this.service.createSection(venueId, dto.name, dto.sortOrder ?? 0);
  }

  @Patch('sections/:sectionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a venue section (admin)' })
  updateSection(@Param('sectionId') sectionId: string, @Body() dto: UpdateSectionDto) {
    return this.service.updateSection(sectionId, dto);
  }

  @Delete('sections/:sectionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a venue section and its rows (admin)' })
  deleteSection(@Param('sectionId') sectionId: string) {
    return this.service.deleteSection(sectionId);
  }

  @Post('sections/:sectionId/rows')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a row of seats within a section (admin)' })
  createRow(@Param('sectionId') sectionId: string, @Body() dto: RowDraftDto) {
    return this.service.createRow(sectionId, dto.label, dto.seatCount, dto.accessibleNumbers ?? []);
  }

  @Patch('rows/:rowId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rebuild a row (label, seat count, accessible numbers)' })
  updateRow(@Param('rowId') rowId: string, @Body() dto: RowDraftDto) {
    return this.service.updateRow(rowId, { label: dto.label, seatCount: dto.seatCount, accessibleNumbers: dto.accessibleNumbers ?? [] });
  }

  @Delete('rows/:rowId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a row and its seats (admin)' })
  deleteRow(@Param('rowId') rowId: string) {
    return this.service.deleteRow(rowId);
  }
}