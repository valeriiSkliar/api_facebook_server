import {
  IsOptional,
  ValidateNested,
  IsString,
  IsUrl,
  IsObject,
  IsNumber,
  IsIn,
  IsArray,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdSnapshotDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => AdBodyDto)
  body?: AdBodyDto | null;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdImageDto)
  images?: AdImageDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdVideoDto)
  videos?: AdVideoDto[];

  @IsObject()
  @IsOptional()
  additionalProperties?: Record<string, any>;
}

export class AdBodyDto {
  @IsOptional()
  @IsString()
  text?: string;
}

export class AdImageDto {
  @IsOptional()
  @IsString()
  @IsUrl()
  url?: string;
}

export class AdVideoDto {
  @IsOptional()
  @IsString()
  @IsUrl()
  url?: string;
}

export class AdDataDto {
  @IsString()
  @IsNotEmpty()
  adArchiveId: string;

  @IsOptional()
  @IsString()
  adId: string | null;

  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsString()
  @IsNotEmpty()
  pageName: string;

  @ValidateNested()
  @Type(() => AdSnapshotDto)
  snapshot: AdSnapshotDto;

  @IsNumber()
  startDate: number;

  @IsNumber()
  endDate: number;

  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status: string;

  @IsArray()
  @IsString({ each: true })
  publisherPlatform: string[];

  @IsObject()
  rawData: any;
}
