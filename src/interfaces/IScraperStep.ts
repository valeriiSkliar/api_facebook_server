import { ScraperContext } from '@src/models/ScraperContext';

export interface IScraperStep {
  getName(): string;
  shouldExecute(context: ScraperContext): boolean;
  execute(context: ScraperContext): Promise<void>;
  cleanup(context: ScraperContext): Promise<void>;
}
