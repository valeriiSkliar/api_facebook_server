import { Page } from 'playwright';
import { Browser } from 'puppeteer';
import { AdData } from './AdData';
import { AdLibraryQuery } from './AdLibraryQuery';

export interface ScraperOptions {
  storage?: {
    outputPath?: string;
  };
}

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
