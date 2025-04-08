import {
  IsNotEmpty,
  IsString,
  IsNumber,
  ValidateNested,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ScraperOptionsDto } from '@src/api/facebook/dto';

export class CreateRequestDto {
  @IsString()
  @IsEnum(['facebook_scraper', 'tiktok_scraper'], {
    message: 'requestType must be one of: facebook_scraper, tiktok_scraper',
  })
  requestType: 'facebook_scraper' | 'tiktok_scraper';

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ScraperOptionsDto)
  parameters: ScraperOptionsDto;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsString()
  webhookUrl?: string;
}
