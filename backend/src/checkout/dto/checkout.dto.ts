import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CheckoutDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  idempotencyKey?: string;
}