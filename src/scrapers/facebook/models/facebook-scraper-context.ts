import { Page } from 'playwright';
import { Browser } from 'playwright';
import { AdData } from './facebook-ad-data';
import { AdLibraryQuery } from './facebook-ad-lib-query';
import { ScraperOptions } from './facebook-scraper-options';
import { ApiConfiguration } from '@src/scrapers/tiktok/models/tiktok-scraper-context';
export interface ScraperContext {
  query: AdLibraryQuery;
  options: ScraperOptions;
  state: {
    browser?: Browser;
    page?: Page;
    adsCollected: AdData[];
    hasMoreResults: boolean;
    currentPage: number;
    errors: Error[];
    forceStop: boolean;
    externalBrowser?: boolean;
    browserId?: string;
    apiConfig?: ApiConfiguration;
  };
}
