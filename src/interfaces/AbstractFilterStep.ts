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

  abstract applyFilter(context: ScraperContext): Promise<void>;

  async execute(context: ScraperContext): Promise<void> {
    this.logger.debug(`Applying filter: ${this.filterType}`);
    await this.applyFilter(context);
  }
}
