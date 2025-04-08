import { ScraperContext } from '@src/scrapers/facebook/models/facebook-scraper-context';
import { IPipelineStep } from '../../../core/interfaces/I-pipeline';

export interface IScraperStep extends IPipelineStep<ScraperContext> {
  shouldExecute(context: ScraperContext): boolean | Promise<boolean>;
  cleanup(context: ScraperContext): Promise<void>;
}
