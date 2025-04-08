import { IsBoolean, IsOptional } from 'class-validator';

import { Type } from 'class-transformer';
import { TiktokLibraryQueryDto } from './tiktok-library-query.dto';
import { ValidateNested } from 'class-validator';
import { BaseScraperOptions } from '@src/scrapers/common/interfaces/scraper-options.interface';
import {
  StorageOptionsDto,
  BehaviorOptionsDto,
  BrowserOptionsDto,
  NetworkOptionsDto,
} from '@src/scrapers/common/dto';

export class TiktokScraperOptionsDto implements BaseScraperOptions {
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
  @Type(() => TiktokLibraryQueryDto)
  query: TiktokLibraryQueryDto;
}
