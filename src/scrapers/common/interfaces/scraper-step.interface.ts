import { IScraperContext } from './scraper-context.interface';
import { ScraperOptions } from './scraper-options.interface';

export interface IScraperStep<T extends ScraperOptions<unknown>> {
  execute(
    context: IScraperContext<T, unknown, unknown>,
    metadata: unknown,
  ): Promise<void>;
}
