import { ScraperContext } from '@src/models/scraper-context';
import { IPipelineStep } from '../../../core/interfaces/I-pipeline';

export interface IScraperStep extends IPipelineStep<ScraperContext> {
  shouldExecute(context: ScraperContext): boolean;
  cleanup(context: ScraperContext): Promise<void>;
}
