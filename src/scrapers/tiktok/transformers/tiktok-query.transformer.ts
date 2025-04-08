import { Injectable, BadRequestException } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  TiktokLibraryQuery,
  TiktokLibraryPeriod,
  TiktokLibraryOrderBy,
  TiktokLibraryAdFormat,
  TiktokLibraryLike,
  TiktokLibraryAdLanguage,
  TiktokLibraryCountryCode,
} from '../models/tiktok-library-query';
import { TiktokLibraryQueryDto } from '../dto/tiktok-library-query.dto';
import { TiktokScraperOptionsDto } from '../dto/tiktok-scraper-options.dto';

@Injectable()
export class TiktokQueryTransformer {
  transform(parameters: TiktokScraperOptionsDto): TiktokLibraryQuery {
    const queryDto = plainToClass(TiktokLibraryQueryDto, {
      queryString: parameters.query?.queryString || '',
      period: parameters.query?.period || TiktokLibraryPeriod.DAY,
      orderBy: parameters.query?.orderBy || TiktokLibraryOrderBy.LIKE,
      countryCode: parameters.query?.countryCode || [
        TiktokLibraryCountryCode.UNITED_STATES,
      ],
      languages: parameters.query?.languages || [],
      adFormat: parameters.query?.adFormat || TiktokLibraryAdFormat.SPARK_ADS,
      like: parameters.query?.like || TiktokLibraryLike.FROM_1_TO_20,
      adLanguages: parameters.query?.adLanguages || [
        TiktokLibraryAdLanguage.ENGLISH,
      ],
    } as Partial<TiktokLibraryQueryDto>);

    const errors = validateSync(queryDto);
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    return queryDto;
  }
}
