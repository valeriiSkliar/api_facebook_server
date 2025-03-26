import { Page } from 'playwright';
import { Browser } from 'playwright';
import { AdData } from './AdData';
import { AdLibraryQuery } from './AdLibraryQuery';
import { ScraperOptions } from './ScraperOptions';

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
  };
}
