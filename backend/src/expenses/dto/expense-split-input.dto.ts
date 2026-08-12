import { IsNumber, IsString, Min } from 'class-validator';

export class ExpenseSplitInputDto {
  @IsString()
  userId: string;

  @IsNumber()
  @Min(0)
  value: number;
}
