import { ScraperContext } from '@src/models/ScraperContext';
import { AbstractScraperStep } from './AbstractScraperStep';
import { Logger } from '@nestjs/common';

export abstract class AbstractFilterStep extends AbstractScraperStep {
  constructor(
    name: string,
    logger: Logger,
    protected readonly filterType: string,
  ) {
    super(name, logger);
  }

  shouldExecute(context: ScraperContext): boolean {
    return !!context.query.filters?.[this.filterType];
  }

  abstract applyFilter(context: ScraperContext): Promise<boolean>;

  async execute(context: ScraperContext): Promise<boolean> {
    this.logger.log(`Applying filter: ${this.filterType}`);
    return await this.applyFilter(context);
  }
}
