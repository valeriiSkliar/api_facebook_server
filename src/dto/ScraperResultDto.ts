import {
  IsString,
  ValidateNested,
  IsOptional,
  Min,
  IsArray,
  IsBoolean,
  IsNumber,
} from 'class-validator';

import { Type } from 'class-transformer';

import { AdDataDto } from './AdDataDto';

export class ScraperResultDto {
  @IsBoolean()
  success: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdDataDto)
  ads: AdDataDto[];

  @IsNumber()
  @Min(0)
  totalCount: number;

  @IsNumber()
  @Min(0)
  executionTime: number;

  @IsOptional()
  @IsString()
  outputPath?: string;

  @IsArray()
  @IsString({ each: true })
  errors: string[];

  @IsBoolean()
  includeAdsInResponse: boolean;
}
