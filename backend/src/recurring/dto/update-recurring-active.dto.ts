import { IsBoolean } from 'class-validator';

export class UpdateRecurringActiveDto {
  @IsBoolean()
  active: boolean;
}
