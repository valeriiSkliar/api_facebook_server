import { ScraperContext } from '@src/models/ScraperContext';
import { IPipelineStep } from '../../../core/interfaces/I-pipeline';

export interface IScraperStep extends IPipelineStep<ScraperContext> {
  shouldExecute(context: ScraperContext): boolean;
  cleanup(context: ScraperContext): Promise<void>;
}
