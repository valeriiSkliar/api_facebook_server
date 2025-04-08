import {
  IsNotEmpty,
  IsString,
  IsNumber,
  ValidateNested,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FacebookScraperOptionsDto } from '@src/api/facebook/dto';

export class CreateRequestDto {
  @IsString()
  @IsEnum(['facebook_scraper', 'tiktok_scraper'], {
    message: 'requestType must be one of: facebook_scraper, tiktok_scraper',
  })
  requestType: 'facebook_scraper' | 'tiktok_scraper';

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => FacebookScraperOptionsDto)
  parameters: FacebookScraperOptionsDto;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsString()
  webhookUrl?: string;
}
