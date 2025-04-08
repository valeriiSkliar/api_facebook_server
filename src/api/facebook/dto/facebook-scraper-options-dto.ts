import {
  // IsObject,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
  IsNumber,
  Min,
  IsEnum,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdLibraryQuery } from '@src/scrapers/facebook/models/facebook-ad-lib-query';
import { ScraperOptions } from '@src/scrapers/common/interfaces/scraper-options.interface';

export class StorageOptionsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsString()
  outputPath?: string;
}

export class ViewportDto {
  @IsNumber()
  @Min(200)
  width: number;

  @IsNumber()
  @Min(200)
  height: number;
}

export class BrowserOptionsDto {
  @IsOptional()
  @IsBoolean()
  headless?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ViewportDto)
  viewport?: ViewportDto;
}

export class NetworkOptionsDto {
  @IsOptional()
  @IsNumber()
  @Min(1000)
  timeout?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  retries?: number;
}

export class BehaviorOptionsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAdsToCollect?: number;

  @IsOptional()
  @IsBoolean()
  applyFilters?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxPages?: number;

  @IsOptional()
  @IsBoolean()
  waitForResults?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  waitTimeout?: number;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  cleanUpTimeout?: number;
}

export class ScraperAdLibraryQueryDto implements Partial<AdLibraryQuery> {
  @IsString()
  @IsOptional()
  queryString?: string;

  @IsArray()
  @IsOptional()
  countries?: string[];

  @IsEnum(['active', 'inactive', 'all'])
  @IsOptional()
  activeStatus?: 'active' | 'inactive' | 'all';

  @IsEnum(['political_and_issue_ads', 'all'])
  @IsOptional()
  adType?: 'political_and_issue_ads' | 'all';

  @IsBoolean()
  @IsOptional()
  isTargetedCountry?: boolean;

  @IsEnum(['all', 'image', 'video'])
  @IsOptional()
  mediaType?: 'all' | 'image' | 'video';

  @IsEnum(['keyword_unordered', 'keyword_exact_phrase'])
  @IsOptional()
  searchType?: 'keyword_unordered' | 'keyword_exact_phrase';

  @IsOptional()
  filters?: any;
}

export class FacebookScraperOptionsDto
  implements ScraperOptions<ScraperAdLibraryQueryDto>
{
  @IsOptional()
  @ValidateNested()
  @Type(() => StorageOptionsDto)
  storage?: StorageOptionsDto;

  @IsOptional()
  @IsBoolean()
  includeAdsInResponse?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrowserOptionsDto)
  browser?: BrowserOptionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NetworkOptionsDto)
  network?: NetworkOptionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BehaviorOptionsDto)
  behavior?: BehaviorOptionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScraperAdLibraryQueryDto)
  query?: ScraperAdLibraryQueryDto;
}
