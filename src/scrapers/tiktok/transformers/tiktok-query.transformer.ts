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

@Injectable()
export class TiktokQueryTransformer {
  transform(parameters: TiktokLibraryQuery): TiktokLibraryQuery {
    const queryDto = plainToClass(TiktokLibraryQueryDto, {
      queryString: parameters.queryString || '',
      period: parameters.period || TiktokLibraryPeriod.DAY,
      orderBy: parameters.orderBy || TiktokLibraryOrderBy.LIKE,
      countryCode: parameters.countryCode || [
        TiktokLibraryCountryCode.UNITED_STATES,
      ],
      languages: parameters.languages || [],
      adFormat: parameters.adFormat || TiktokLibraryAdFormat.SPARK_ADS,
      like: parameters.like || TiktokLibraryLike.FROM_1_TO_20,
      adLanguages: parameters.adLanguages || [TiktokLibraryAdLanguage.ENGLISH],
    } as Partial<TiktokLibraryQueryDto>);

    const errors = validateSync(queryDto);
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    return queryDto;
  }
}
