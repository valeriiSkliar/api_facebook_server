import { Injectable, Logger } from '@nestjs/common';
import { AdLibraryQuery } from '../models/facebook-ad-lib-query';

@Injectable()
export class SearchParameterService {
  private readonly logger = new Logger(SearchParameterService.name);

  validateQuery(query: AdLibraryQuery): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!query.queryString) {
      errors.push('queryString is required');
    }

    // Validate enum values
    const activeStatusValues = ['active', 'inactive', 'all'];
    if (
      query.activeStatus &&
      !activeStatusValues.includes(query.activeStatus)
    ) {
      errors.push(
        `activeStatus must be one of: ${activeStatusValues.join(', ')}`,
      );
    }

    const adTypeValues = ['political_and_issue_ads', 'all'];
    if (query.adType && !adTypeValues.includes(query.adType)) {
      errors.push(`adType must be one of: ${adTypeValues.join(', ')}`);
    }

    const mediaTypeValues = ['all', 'image', 'video'];
    if (query.mediaType && !mediaTypeValues.includes(query.mediaType)) {
      errors.push(`mediaType must be one of: ${mediaTypeValues.join(', ')}`);
    }

    const searchTypeValues = ['keyword_unordered', 'keyword_exact_phrase'];
    if (query.searchType && !searchTypeValues.includes(query.searchType)) {
      errors.push(`searchType must be one of: ${searchTypeValues.join(', ')}`);
    }

    // Validate filters if present
    if (query.filters) {
      // Validate date range if present
      if (query.filters.dateRange) {
        const { start, end } = query.filters.dateRange;
        if (start && !(start instanceof Date) && isNaN(Date.parse(start))) {
          errors.push('dateRange.start must be a valid date');
        }
        if (end && !(end instanceof Date) && isNaN(new Date(end).getTime())) {
          errors.push('dateRange.end must be a valid date');
        }
        if (start && end && new Date(start) > new Date(end)) {
          errors.push('dateRange.start must be before dateRange.end');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  buildQuery(params: Partial<AdLibraryQuery>): AdLibraryQuery {
    // Default values
    const defaultQuery: AdLibraryQuery = {
      queryString: '',
      countries: ['ALL'],
      activeStatus: 'active',
      adType: 'all',
      isTargetedCountry: false,
      mediaType: 'all',
      searchType: 'keyword_unordered',
    };

    // Merge with provided parameters
    const query = { ...defaultQuery, ...params };

    // Log the built query
    this.logger.log('Built query', { query });

    return query;
  }
}
