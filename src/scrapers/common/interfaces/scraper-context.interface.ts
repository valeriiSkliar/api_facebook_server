import { IScraperOptions } from './scraper-options.interface';

export interface IScraperContext<T extends IScraperOptions = IScraperOptions> {
  query: T;
  options: T;
  data: unknown;
}
