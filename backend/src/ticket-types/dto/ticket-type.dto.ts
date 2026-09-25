import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTicketTypeDto {
  @IsUUID()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  quantity: number;

  @IsOptional()
  @IsString()
  salesStartsAt?: string;

  @IsOptional()
  @IsString()
  salesEndsAt?: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  maxPerCustomer?: number;
}

export class TicketTypeSectionsDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  sectionIds: string[];
}

export class UpdateTicketTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  quantity?: number;

  @IsOptional()
  @IsString()
  salesStartsAt?: string;

  @IsOptional()
  @IsString()
  salesEndsAt?: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  maxPerCustomer?: number;
}