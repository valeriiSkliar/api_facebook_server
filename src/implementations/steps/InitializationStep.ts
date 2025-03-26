import { AbstractScraperStep } from '@src/interfaces/AbstractScraperStep';
import { AdData } from '@src/models/AdData';
import { AdLibraryQuery } from '@src/models/AdLibraryQuery';
import { ScraperContext } from '@src/models/ScraperContext';
import puppeteer from 'puppeteer';

// steps/InitializationStep.ts
export class InitializationStep extends AbstractScraperStep {
  async execute(context: ScraperContext): Promise<void> {
    this.logger.debug('Initializing browser');

    // Launch browser with options from context
    const browser = await puppeteer.launch({
      headless: context.options.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport(context.options.browser.viewport);

    // Store browser and page in context
    context.state.browser = browser;
    context.state.page = page;
  }

  async cleanup(context: ScraperContext): Promise<void> {
    if (context.state.browser) {
      await context.state.browser.close();
    }
  }
}

// steps/NavigationStep.ts
export class NavigationStep extends AbstractScraperStep {
  async execute(context: ScraperContext): Promise<void> {
    if (!context.state.page) {
      throw new Error('Page not initialized');
    }

    const url = this.buildAdLibraryUrl(context.query);
    this.logger.info(`Navigating to: ${url}`);

    await context.state.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: context.options.network.timeout,
    });

    // Wait for main content
    await context.state.page.waitForSelector('[role="main"]', {
      timeout: context.options.network.timeout,
    });
  }

  private buildAdLibraryUrl(query: AdLibraryQuery): string {
    // Construct URL with query parameters
    // ...implementation here...
    return '';
  }
}

// steps/InterceptionSetupStep.ts
export class InterceptionSetupStep extends AbstractScraperStep {
  async execute(context: ScraperContext): Promise<void> {
    if (!context.state.page) {
      throw new Error('Page not initialized');
    }

    await context.state.page.setRequestInterception(true);

    context.state.page.on('request', (request) => {
      request.continue();
    });

    context.state.page.on('response', async (response) => {
      const url = response.url();

      // Only process GraphQL API responses
      if (
        url.includes('facebook.com/api/graphql/') &&
        response.request().method() === 'POST'
      ) {
        try {
          const responseText = await response.text();

          if (
            responseText.includes('ad_library_main') &&
            responseText.includes('search_results_connection')
          ) {
            // Extract ad data
            const adData = this.extractAdData(responseText);
            context.state.adsCollected.push(...adData);

            this.logger.info(
              `Total ads collected: ${context.state.adsCollected.length}`,
            );
          }
        } catch (error) {
          this.logger.error('Error processing response', error);
          context.state.errors.push(error as Error);
        }
      }
    });
  }

  private extractAdData(responseText: string): AdData[] {
    // Extract and format ad data from response
    // ...implementation here...
    return [];
  }
}

// steps/PaginationStep.ts
export class PaginationStep extends AbstractScraperStep {
  shouldExecute(context: ScraperContext): boolean {
    return (
      context.state.adsCollected.length <
        context.options.behavior.maxAdsToCollect && context.state.hasMoreResults
    );
  }

  async execute(context: ScraperContext): Promise<void> {
    if (!context.state.page) {
      throw new Error('Page not initialized');
    }

    this.logger.debug('Scrolling to load more content');

    // Scroll down to trigger loading more results
    await context.state.page.evaluate(() => {
      window.scrollBy(0, 800);
    });

    // Wait for network activity to settle
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if we've reached the bottom
    const isAtBottom = await context.state.page.evaluate(() => {
      return window.innerHeight + window.scrollY >= document.body.scrollHeight;
    });

    if (isAtBottom) {
      context.state.hasMoreResults = false;
      this.logger.debug('Reached bottom of page');
    }
  }
}

// steps/StorageStep.ts
export class StorageStep extends AbstractScraperStep {
  async execute(context: ScraperContext): Promise<void> {
    const { adsCollected } = context.state;

    if (adsCollected.length === 0) {
      this.logger.warn('No ads collected, skipping storage');
      return;
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `facebook_ads_${context.query.queryString}_${timestamp}.json`;

    // Save to file
    const outputDir =
      context.options.storage.outputPath || path.join(process.cwd(), 'data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(adsCollected, null, 2));

    this.logger.info(`Saved ${adsCollected.length} ads to ${filePath}`);
    context.options.storage.outputPath = filePath;
  }
}
