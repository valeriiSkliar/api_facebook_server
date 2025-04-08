import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  IsNotEmpty,
} from 'class-validator';
import {
  TiktokLibraryPeriod,
  TiktokLibraryOrderBy,
  TiktokLibraryCountryCode,
  TiktokLibraryAdLanguage,
  TiktokLibraryAdFormat,
  TiktokLibraryLike,
} from '../models/tiktok-library-query';

export class TiktokLibraryQueryDto {
  @IsString()
  @IsNotEmpty()
  queryString: string;

  @IsEnum(TiktokLibraryPeriod)
  @IsNotEmpty()
  period: TiktokLibraryPeriod;

  @IsEnum(TiktokLibraryOrderBy)
  @IsNotEmpty()
  orderBy: TiktokLibraryOrderBy;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(TiktokLibraryCountryCode, { each: true })
  countryCode?: TiktokLibraryCountryCode[];

  @IsOptional()
  @IsArray()
  @IsEnum(TiktokLibraryAdLanguage, { each: true })
  languages?: TiktokLibraryAdLanguage[];

  @IsOptional()
  @IsEnum(TiktokLibraryAdFormat)
  adFormat?: TiktokLibraryAdFormat;

  @IsOptional()
  @IsEnum(TiktokLibraryLike)
  like?: TiktokLibraryLike;

  @IsOptional()
  @IsArray()
  @IsEnum(TiktokLibraryAdLanguage, { each: true })
  adLanguages?: TiktokLibraryAdLanguage[];
}
