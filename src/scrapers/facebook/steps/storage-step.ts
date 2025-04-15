/* eslint-disable @typescript-eslint/require-await */
import fs from 'fs';
import path from 'path';
import { ScraperContext } from '@src/scrapers/facebook/models/facebook-scraper-context';
import { FacebookScraperStep } from './facebook-scraper-step';

export class StorageStep extends FacebookScraperStep {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shouldExecute(context: ScraperContext): boolean {
    // Гарантируем вызов StorageStep всегда
    return true;
  }

  async execute(context: ScraperContext): Promise<boolean> {
    this.logger.log(
      `[StorageStep] shouldExecute: ${this.shouldExecute(context)}`,
    );
    const { adsCollected } = context.state;
    this.logger.log(`[StorageStep] Ads collected: ${adsCollected.length}`);
    if (adsCollected.length === 0) {
      this.logger.warn('[StorageStep] No ads collected, skipping storage');
      return true;
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `facebook_ads_${context.query.queryString}_${timestamp}.json`;

    // Save to file
    const outputDir =
      context.options.storage?.outputPath || path.join(process.cwd(), 'data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(adsCollected, null, 2));

    this.logger.log(
      `[StorageStep] Saved ${adsCollected.length} ads to ${filePath}`,
    );
    if (!context.options.storage) {
      context.options.storage = {};
    }
    context.options.storage.outputPath = filePath;
    return true;
  }
}
