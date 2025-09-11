import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  // Optional flag to control token lifetime (remember me)
  // When true, backend will issue a longer-lived JWT
  // When false/undefined, a short-lived JWT is issued
  // Frontend can also use this to choose storage (localStorage vs sessionStorage)
  // Not required for backward compatibility
  // Using IsString/IsNotEmpty is not applicable here; keep it optional boolean
  // Import IsOptional and IsBoolean for validation
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
