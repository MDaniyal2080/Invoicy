import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DiscountType, RecurrenceFrequency } from '../../../common/enums';

export class CreateRecurringInvoiceItemDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  rate: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsBoolean()
  taxable?: boolean;
}

export class CreateRecurringInvoiceDto {
  // Associations
  @IsString()
  clientId: string;

  // Items
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRecurringInvoiceItemDto)
  items: CreateRecurringInvoiceItemDto[];

  // Template fields
  @IsNumber()
  @IsOptional()
  @Min(0)
  taxRate?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discount?: number;

  @IsEnum(DiscountType)
  @IsOptional()
  discountType?: (typeof DiscountType)[keyof typeof DiscountType];

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  terms?: string;

  @IsString()
  @IsOptional()
  footer?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  dueInDays?: number;

  // Recurrence configuration
  @IsEnum(RecurrenceFrequency)
  frequency: (typeof RecurrenceFrequency)[keyof typeof RecurrenceFrequency];

  @IsNumber()
  @IsOptional()
  @Min(1)
  interval?: number; // default 1

  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @Type(() => Date)
  @IsOptional()
  @IsDate()
  endDate?: Date | null;

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxOccurrences?: number;

  @IsBoolean()
  @IsOptional()
  autoSend?: boolean;
}
