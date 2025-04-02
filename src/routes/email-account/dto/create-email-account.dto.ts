import { IsString, IsEmail, IsOptional, IsBoolean, IsJSON } from 'class-validator';

export class CreateEmailAccountDto {
  @IsEmail()
  email_address: string;

  @IsString()
  provider: string;

  @IsOptional()
  @IsJSON()
  connection_details?: Record<string, any>;

  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsString()
  status: string;

  @IsBoolean()
  @IsOptional()
  is_associated?: boolean = false;
}
