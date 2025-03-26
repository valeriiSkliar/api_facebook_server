// services/FacebookAdScraperService.ts
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
