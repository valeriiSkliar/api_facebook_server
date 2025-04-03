import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsJSON,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateEmailAccountDto {
  @IsEmail()
  email_address: string;

  @IsString()
  provider: string;

  @IsOptional()
  @IsJSON()
  @Transform(({ value }) => {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value as string;
  })
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
