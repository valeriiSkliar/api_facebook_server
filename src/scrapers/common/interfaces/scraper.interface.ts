import { RequestMetadata } from '@src/api/requests/request-manager-service';
import { IBaseScraperResult } from './base-scraper-result';

export interface IScraper<TQuery, TResult> {
  scrape(
    request: RequestMetadata<TQuery>,
  ): Promise<IBaseScraperResult<TResult>>;
}
