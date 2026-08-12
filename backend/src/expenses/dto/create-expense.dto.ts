import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { SplitType } from '../../generated/prisma/client';
import { ExpenseSplitInputDto } from './expense-split-input.dto';

export class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  description: string;

  @IsInt()
  @Min(1)
  amountCents: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsISO8601()
  date?: string;

  @IsString()
  paidById: string;

  @IsEnum(SplitType)
  splitType: SplitType;

  @ValidateIf((o) => o.splitType === SplitType.EQUAL)
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  participantUserIds?: string[];

  @ValidateIf((o) => o.splitType !== SplitType.EQUAL)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseSplitInputDto)
  splits?: ExpenseSplitInputDto[];
}
