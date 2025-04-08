import {
  // IsObject,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
  IsEnum,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdLibraryQuery } from '@src/scrapers/facebook/models/facebook-ad-lib-query';
import { ScraperOptions } from '@src/scrapers/common/interfaces/scraper-options.interface';
import { StorageOptionsDto } from '@src/scrapers/common/dto/storage-options';
import { BrowserOptionsDto } from '@src/scrapers/common/dto/browser-options';
import { NetworkOptionsDto } from '@src/scrapers/common/dto/network-options';
import { BehaviorOptionsDto } from '@src/scrapers/common/dto/behavior-options';

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
  query: ScraperAdLibraryQueryDto;
}
