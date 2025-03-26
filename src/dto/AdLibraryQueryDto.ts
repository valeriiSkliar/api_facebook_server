import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsObject,
  ValidateNested,
  IsArray,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdLibraryQuery } from '@src/models/AdLibraryQuery';
import { ScraperOptions } from '@src/models/ScraperOptions';

export class AdLibraryQueryDto implements Partial<AdLibraryQuery> {
  @IsString()
  @IsNotEmpty()
  queryString: string;

  @IsArray()
  @IsOptional()
  countries?: string[];

  @IsEnum(['active', 'inactive', 'all'], {
    message: 'activeStatus must be one of: active, inactive, all',
  })
  @IsOptional()
  activeStatus?: 'active' | 'inactive' | 'all' = 'active';

  @IsEnum(['political_and_issue_ads', 'all'], {
    message: 'adType must be one of: political_and_issue_ads, all',
  })
  @IsOptional()
  adType?: 'political_and_issue_ads' | 'all' = 'all';

  @IsBoolean()
  @IsOptional()
  isTargetedCountry?: boolean = false;

  @IsEnum(['all', 'image', 'video'], {
    message: 'mediaType must be one of: all, image, video',
  })
  @IsOptional()
  mediaType?: 'all' | 'image' | 'video' = 'all';

  @IsEnum(['keyword_unordered', 'keyword_exact_phrase'], {
    message:
      'searchType must be one of: keyword_unordered, keyword_exact_phrase',
  })
  @IsOptional()
  searchType?: 'keyword_unordered' | 'keyword_exact_phrase' =
    'keyword_unordered';

  @IsObject()
  @IsOptional()
  filters?: Record<string, any>;
}

export class ScraperOptionsDto implements Partial<ScraperOptions> {
  @IsObject()
  @IsOptional()
  storage?: {
    outputPath?: string;
  };

  @IsBoolean()
  @IsOptional()
  includeAdsInResponse?: boolean = false;

  @IsObject()
  @IsOptional()
  browser?: {
    headless?: boolean;
    viewport?: {
      width: number;
      height: number;
    };
  };

  @IsObject()
  @IsOptional()
  network?: {
    timeout?: number;
    retries?: number;
  };

  @IsObject()
  @IsOptional()
  behavior?: {
    maxAdsToCollect?: number;
    applyFilters?: boolean;
  };
}

export class ScraperRequestDto {
  @ValidateNested()
  @Type(() => AdLibraryQueryDto)
  query: AdLibraryQueryDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScraperOptionsDto)
  options?: ScraperOptionsDto;
}
