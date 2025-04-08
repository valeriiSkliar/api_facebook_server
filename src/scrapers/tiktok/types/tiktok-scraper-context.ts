import { TikTokQuery } from './tiktok-query';
import { TiktokScraperOptionsDto } from '../dto/tiktok-scraper-options.dto';

export interface TikTokScraperContext {
  query: TikTokQuery;
  options: TiktokScraperOptionsDto;
  state: {
    adsCollected: any[];
    hasMoreResults: boolean;
    currentPage: number;
    errors: Error[];
    forceStop: boolean;
  };
}
