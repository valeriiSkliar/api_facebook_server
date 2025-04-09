/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  ValidateNested,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

// Define a union type of all supported scraper types
export type ScraperType = 'facebook_scraper' | 'tiktok_scraper';

// Class for creating requests
export class CreateRequestDto {
  @IsString()
  @IsEnum(['facebook_scraper', 'tiktok_scraper'], {
    message: 'requestType must be one of: facebook_scraper, tiktok_scraper',
  })
  requestType: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => Object as any)
  parameters: any;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsString()
  webhookUrl?: string;
}
