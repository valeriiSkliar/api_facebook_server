import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AdDataDto } from './facebook-ad-data-dto';

export class FacebookScraperResponseDto {
  /**
   * Indicates if the scraping operation was successful
   */
  @IsBoolean()
  success: boolean;

  /**
   * Total number of ads that were collected
   */
  @IsNumber()
  totalCount: number;

  /**
   * Execution time in milliseconds
   */
  @IsNumber()
  executionTime: number;

  /**
   * Path where the scraped data was saved
   */
  @IsOptional()
  @IsString()
  outputPath?: string;

  /**
   * Error messages if any occurred during scraping
   */
  @IsArray()
  @IsString({ each: true })
  errors: string[];

  /**
   * The actual ad data, if requested in options
   * Only included when includeAdsInResponse is true
   */
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdDataDto)
  ads?: AdDataDto[];
}
