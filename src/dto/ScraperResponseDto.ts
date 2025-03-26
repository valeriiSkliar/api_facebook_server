import { AdData } from '../models/AdData';

export class ScraperResponseDto {
  /**
   * Indicates if the scraping operation was successful
   */
  success: boolean;

  /**
   * Total number of ads that were collected
   */
  totalAds: number;

  /**
   * Execution time in milliseconds
   */
  executionTime: number;

  /**
   * Path where the scraped data was saved
   */
  outputPath?: string;

  /**
   * Error messages if any occurred during scraping
   */
  errors: string[];

  /**
   * The actual ad data, if requested in options
   * Only included when includeAdsInResponse is true
   */
  ads?: AdData[];
}
