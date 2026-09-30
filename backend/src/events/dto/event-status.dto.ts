import { IsIn } from 'class-validator';
import { EVENT_ADMIN_WRITEABLE_STATUSES, type EventAdminWriteableStatus } from '@eventia/shared';

export class UpdateEventStatusDto {
  @IsIn(EVENT_ADMIN_WRITEABLE_STATUSES)
  status: EventAdminWriteableStatus;
}