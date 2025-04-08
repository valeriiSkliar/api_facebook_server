import {
  IsNotEmpty,
  IsString,
  IsNumber,
  ValidateNested,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ScraperOptions } from '@src/scrapers/common/interfaces/scraper-options.interface';

export class CreateRequestDto<T = any> {
  @IsString()
  @IsEnum(['facebook_scraper', 'tiktok_scraper'], {
    message: 'requestType must be one of: facebook_scraper, tiktok_scraper',
  })
  requestType: 'facebook_scraper' | 'tiktok_scraper';

  @IsNotEmpty()
  @ValidateNested()
  parameters: ScraperOptions<T>;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsString()
  webhookUrl?: string;
}
