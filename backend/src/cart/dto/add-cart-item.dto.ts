import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, Max, Min } from 'class-validator';
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
}