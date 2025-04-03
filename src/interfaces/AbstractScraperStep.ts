import { Logger } from '@nestjs/common';
import { ScraperContext } from '@src/models/ScraperContext';
import { IScraperStep } from './IScraperStep';

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
