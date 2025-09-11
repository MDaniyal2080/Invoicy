import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  IsEnum,
  IsNotEmpty,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  companyName?: string;

  @IsString()
  @IsOptional()
  companyAddress?: string;

  @IsString()
  @IsOptional()
  companyPhone?: string;

  @IsEmail()
  @IsOptional()
  companyEmail?: string;

  @IsString()
  @IsOptional()
  taxNumber?: string;

  @IsString()
  @IsOptional()
  companyLogo?: string;
}

export class UpdateSettingsDto {
  @IsString()
  @IsOptional()
  invoicePrefix?: string;

  @IsNumber()
  @IsOptional()
  invoiceStartNumber?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsOptional()
  taxRate?: number;

  @IsNumber()
  @IsOptional()
  paymentTerms?: number;

  @IsString()
  @IsOptional()
  invoiceNotes?: string;

  @IsString()
  @IsOptional()
  invoiceFooter?: string;

  // Notification preferences
  @IsBoolean()
  @IsOptional()
  emailNotificationsEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  emailNotifyNewInvoice?: boolean;

  @IsBoolean()
  @IsOptional()
  emailNotifyPaymentReceived?: boolean;

  @IsBoolean()
  @IsOptional()
  emailNotifyInvoiceOverdue?: boolean;

  @IsBoolean()
  @IsOptional()
  emailNotifyWeeklySummary?: boolean;

  @IsBoolean()
  @IsOptional()
  emailNotifyNewClientAdded?: boolean;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
