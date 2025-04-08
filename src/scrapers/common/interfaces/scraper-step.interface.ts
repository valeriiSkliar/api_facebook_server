import { IScraperContext } from './scraper-context.interface';
import { IScraperOptions } from './scraper-options.interface';

export interface IScraperStep<T extends IScraperOptions = IScraperOptions> {
  execute(context: IScraperContext<T>, metadata: unknown): Promise<void>;
}
