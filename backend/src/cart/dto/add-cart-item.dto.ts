import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { IsInt } from 'class-validator';

export class AddCartItemDto {
  @IsString()
  @IsNotEmpty()
  ticketTypeId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  seatIds?: string[];
}