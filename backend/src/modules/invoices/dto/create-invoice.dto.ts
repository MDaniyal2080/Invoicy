import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsDate,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus, DiscountType } from '../../../common/enums';

export class CreateInvoiceItemDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  rate: number;
}

export class CreateInvoiceDto {
  @IsString()
  clientId: string;

  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  invoiceDate?: Date;

  @Type(() => Date)
  @IsDate()
  dueDate: Date;

  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];

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
}
