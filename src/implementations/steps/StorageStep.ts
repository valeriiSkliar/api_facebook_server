/* eslint-disable @typescript-eslint/require-await */
import fs from 'fs';
import path from 'path';
import { AbstractScraperStep } from '@src/interfaces/AbstractScraperStep';
import { ScraperContext } from '@src/models/ScraperContext';

export class StorageStep extends AbstractScraperStep {
  async execute(context: ScraperContext): Promise<boolean> {
    const { adsCollected } = context.state;

    if (adsCollected.length === 0) {
      this.logger.warn('No ads collected, skipping storage');
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

    this.logger.log(`Saved ${adsCollected.length} ads to ${filePath}`);
    if (!context.options.storage) {
      context.options.storage = {};
    }
    context.options.storage.outputPath = filePath;
    return true;
  }
}
