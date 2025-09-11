import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole, Plan } from '../../../common/enums';

export class UpdateUserByAdminDto {
  @IsEnum(UserRole)
  @IsOptional()
  role?: (typeof UserRole)[keyof typeof UserRole];

  @IsEnum(Plan)
  @IsOptional()
  subscriptionPlan?: (typeof Plan)[keyof typeof Plan];

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  subscriptionEnd?: Date;

  @IsNumber()
  @IsOptional()
  invoiceLimit?: number;

  @IsBoolean()
  @IsOptional()
  emailVerified?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
