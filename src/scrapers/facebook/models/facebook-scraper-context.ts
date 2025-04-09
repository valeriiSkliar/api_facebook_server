import { Page } from 'playwright';
import { Browser } from 'playwright';
import { AdData } from './facebook-ad-data';
import { AdLibraryQuery } from './facebook-ad-lib-query';
import { ScraperOptions } from './facebook-scraper-options';
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
  };
}
