export interface IBaseScraperState {
  /** Array of errors encountered during scraping */
  errors: Error[];

  /** Flag to force stop the pipeline execution */
  forceStop: boolean;

  /** Flag indicating if an external browser is being used */
  externalBrowser?: boolean;

  /** ID of the browser being used */
  browserId?: string;

  /** Array of collected data items */
  adsCollected: any[];

  /** Whether there are more results to fetch */
  hasMoreResults?: boolean;

  /** Current page number for pagination */
  currentPage?: number;

  /** Path where output is stored */
  outputPath?: string;

  /** Browser instance, using any type to avoid circular dependencies */
  browser?: any;

  /** Page instance, using any type to avoid circular dependencies */
  page?: any;
}
