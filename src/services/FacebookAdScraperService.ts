import { Injectable, Logger } from '@nestjs/common';
import { ScraperFactory } from '../implementations/factories/ScraperFactory';
import { AdLibraryQuery } from '../models/AdLibraryQuery';
import { ScraperOptions } from '../models/ScraperOptions';
import { ScraperResult } from '../models/ScraperResult';
// import { plainToInstance } from 'class-transformer';
// import { ScraperResponseDto } from '@src/dto';

@Injectable()
export class FacebookAdScraperService {
  constructor(
    private readonly scraperFactory: ScraperFactory,
    private readonly logger: Logger,
  ) {}

  async scrapeAds(
    query: AdLibraryQuery,
    options?: Partial<ScraperOptions>,
  ): Promise<ScraperResult> {
    this.logger.log(
      `Starting Facebook Ad Library scraper for query: ${query.queryString}`,
    );

    // Create scraper pipeline and context
    const scraper = this.scraperFactory.createScraper(options);
    const context = this.scraperFactory.createContext(query, options);

    try {
      // Execute the scraper
      const result = await scraper.execute(context);

      // Add the includeAdsInResponse flag to the result
      result.includeAdsInResponse = options?.includeAdsInResponse || false;

      //TODO: Optional: validate against the DTO for internal checks
      // try {
      //   const resultDto = plainToInstance(ScraperResponseDto, {
      //     success: result.success,
      //     totalCount: result.totalCount,
      //     executionTime: result.executionTime,
      //     outputPath: result.outputPath || '',
      //     errors: result.errors.map((e) => e.message || String(e)),
      //     includeAdsInResponse: !!result.includeAdsInResponse,
      //     ads: result.includeAdsInResponse ? result.ads : undefined,
      //   });

      //   // Log validation success
      //   this.logger.debug('Result validated successfully');
      // } catch (validationError) {
      //   this.logger.warn('Result validation issues:', validationError);
      // }

      this.logger.log(
        `Scraping completed. Collected ${result.totalCount} ads.`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Scraping failed`, error);
      throw error;
    }
  }
}
