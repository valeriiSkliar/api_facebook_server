// src/scrapers/facebook/facebook-scraper-types.ts

import { Page, Browser } from 'playwright';
import { AdData } from './models/facebook-ad-data';
import { AdLibraryQuery } from './models/facebook-ad-lib-query';
import { 
  IBaseScraperContext, 
  IBaseScraperOptions,
  IBaseScraperResult,
  IBaseScraperState
} from '../common/interfaces';

/**
 * Facebook Scraper Options Interface
 * Extends the base scraper options
 */
export interface FacebookScraperOptions extends IBaseScraperOptions {
  /** Retry configuration */
  retryAttempts?: number;
  
  /** Additional behavior options specific to Facebook */
  behavior?: {
    maxAdsToCollect?: number;
    applyFilters?: boolean;
    maxPages?: number;
    waitForResults?: boolean;
    waitTimeout?: number;
    cleanUpTimeout?: number;
    scrollDelay?: number;
  };
  
  /** Whether to use an external browser instance */
  useExternalBrowser?: boolean;
  
  /** Whether to include the actual ad data in the API response */
  includeAdsInResponse?: boolean;
}

/**
 * Facebook Scraper State Interface
 * Extends the base scraper state
 */
export interface FacebookScraperState extends IBaseScraperState {
  /** Browser instance if created by the scraper */
  browser?: Browser;
  
  /** Page instance */
  page?: Page;
  
  /** Collection of ads */
  adsCollected: AdData[];
  
  /** Whether there are more results to fetch */
  hasMoreResults: boolean;
  
  /** Current page number (0-based) */
  currentPage: number;
  
  /** Whether to force stop scraping */
  forceStop: boolean;
  
  /** Whether an external browser is being used */
  externalBrowser?: boolean;
  
  /** ID of the browser being used */
  browserId?: string;
  
  /** Task ID for state tracking */
  taskId?: string;
  
  /** Start time of the scraping process */
  startTime?: Date;
}

/**
 * Facebook Scraper Context Interface
 * Extends the base scraper context
 */
export interface FacebookScraperContext extends IBaseScraperContext<AdLibraryQuery, FacebookScraperOptions, FacebookScraperState> {
  /** Consistent with generic pattern */
}

/**
 * Facebook Scraper Result Interface
 * Extends the base scraper result
 */
export interface FacebookScraperResult extends IBaseScraperResult<AdData> {
  /** Whether there are more results to fetch */
  hasMoreResults?: boolean;
  
  /** Current page number */
  currentPage?: number;
  
  /** Whether to include the ads in the response */
  includeAdsInResponse?: boolean;
}
