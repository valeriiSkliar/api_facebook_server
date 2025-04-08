import { BrowserOptionsDto, StorageOptionsDto } from '@src/api/facebook/dto';

import { NetworkOptionsDto } from '@src/api/facebook/dto';

import { IsBoolean, IsOptional } from 'class-validator';

import { Type } from 'class-transformer';
import { TiktokLibraryQueryDto } from './tiktok-library-query.dto';
import { ValidateNested } from 'class-validator';
import { BehaviorOptionsDto } from '@src/api/facebook/dto';
import { ScraperOptions } from '@src/scrapers/common/interfaces/scraper-options.interface';

export class TiktokScraperOptionsDto
  implements ScraperOptions<TiktokLibraryQueryDto>
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
  @Type(() => TiktokLibraryQueryDto)
  query?: TiktokLibraryQueryDto;
}
