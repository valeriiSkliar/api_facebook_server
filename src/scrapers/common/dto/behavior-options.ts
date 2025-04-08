import { IsBoolean } from 'class-validator';

import { IsNumber } from 'class-validator';

import { IsOptional } from 'class-validator';

import { Min } from 'class-validator';

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
