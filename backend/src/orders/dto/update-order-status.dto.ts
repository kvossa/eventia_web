import { IsIn } from 'class-validator';
import { ORDER_STATUSES, type OrderStatus } from '@eventia/shared';

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES)
  status: OrderStatus;
}