/* eslint-disable @typescript-eslint/no-unused-vars */
import { Logger } from '@nestjs/common';
import { ScraperContext } from '@src/scrapers/facebook/models/facebook-scraper-context';
import { IScraperStep } from './i-scraper-step';

export abstract class AbstractScraperStep implements IScraperStep {
  constructor(
    protected readonly name: string,
    public readonly logger: Logger,
  ) {}

  getName(): string {
    return this.name;
  }

  shouldExecute(context: ScraperContext): boolean {
    return true;
  }

  abstract execute(context: ScraperContext): Promise<boolean>;

  async cleanup(context: ScraperContext): Promise<void> {
    // Default implementation - do nothing
  }
}
