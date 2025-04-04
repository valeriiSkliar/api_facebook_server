import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  ValidateNested,
  IsArray,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ScraperOptionsDto } from './facebook-scraper-options-dto';

import { IsDateString, ArrayMinSize } from 'class-validator';
import {
  AdLibraryQuery,
  AdLibraryFilters,
} from '../../../models/AdLibraryQuery';

export class DateRangeDto {
  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  end?: string;
}

export class AdLibraryFiltersDto implements AdLibraryFilters {
  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeDto)
  dateRange?: DateRangeDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];
}

export class AdLibraryQueryDto implements AdLibraryQuery {
  @IsString()
  @IsNotEmpty()
  queryString: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  countries: string[] = ['ALL'];

  @IsEnum(['active', 'inactive', 'all'], {
    message: 'activeStatus must be one of: active, inactive, all',
  })
  activeStatus: 'active' | 'inactive' | 'all' = 'active';

  @IsEnum(['political_and_issue_ads', 'all'], {
    message: 'adType must be one of: political_and_issue_ads, all',
  })
  adType: 'political_and_issue_ads' | 'all' = 'all';

  @IsBoolean()
  isTargetedCountry: boolean = false;

  @IsEnum(['all', 'image', 'video'], {
    message: 'mediaType must be one of: all, image, video',
  })
  mediaType: 'all' | 'image' | 'video' = 'all';

  @IsEnum(['keyword_unordered', 'keyword_exact_phrase'], {
    message:
      'searchType must be one of: keyword_unordered, keyword_exact_phrase',
  })
  searchType: 'keyword_unordered' | 'keyword_exact_phrase' =
    'keyword_unordered';

  @IsOptional()
  @ValidateNested()
  @Type(() => AdLibraryFiltersDto)
  filters?: AdLibraryFiltersDto;
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
