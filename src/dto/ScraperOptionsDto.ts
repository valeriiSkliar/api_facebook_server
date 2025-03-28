import {
  // IsObject,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';

// import { ScraperOptions } from '@src/models/ScraperOptions';
import { Type } from 'class-transformer';

// export class ScraperOptionsDto implements Partial<ScraperOptions> {
//   @IsObject()
//   @IsOptional()
//   storage?: {
//     outputPath?: string;
//   };

//   @IsBoolean()
//   @IsOptional()
//   includeAdsInResponse?: boolean = false;

//   @IsObject()
//   @IsOptional()
//   browser?: {
//     headless?: boolean;
//     viewport?: {
//       width: number;
//       height: number;
//     };
//   };

//   @IsObject()
//   @IsOptional()
//   network?: {
//     timeout?: number;
//     retries?: number;
//   };

//   @IsObject()
//   @IsOptional()
//   behavior?: {
//     maxAdsToCollect?: number;
//     applyFilters?: boolean;
//   };
// }

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

export class ScraperOptionsDto {
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
}
