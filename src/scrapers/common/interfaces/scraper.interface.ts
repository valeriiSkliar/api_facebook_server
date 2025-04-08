import { RequestMetadata } from '@src/api/requests/request-manager-service';
import { BaseScraperResult } from './base-scraper-result';

export interface IScraper<TQuery, TResult> {
  scrape(request: RequestMetadata<TQuery>): Promise<BaseScraperResult<TResult>>;
}
