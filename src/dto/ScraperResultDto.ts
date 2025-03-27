import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { AdDataDto } from './AdDataDto';

export class ScraperResultDto {
  /**
   * Indicates if the scraping operation was successful
   */
  @IsBoolean()
  success: boolean;

  /**
   * Total count of ads collected
   */
  @IsNumber()
  @Min(0)
  totalCount: number;

  /**
   * Total execution time in milliseconds
   */
  @IsNumber()
  @Min(0)
  executionTime: number;

  /**
   * Path where the data was saved (if applicable)
   */
  @IsOptional()
  @IsString()
  outputPath?: string;

  /**
   * Any errors that occurred during scraping
   */
  @IsArray()
  @IsString({ each: true })
  errors: string[];

  /**
   * Whether to include the ads in the response
   */
  @IsBoolean()
  includeAdsInResponse: boolean;

  /**
   * The collected ad data (only included when includeAdsInResponse is true)
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdDataDto)
  ads?: AdDataDto[];
}
