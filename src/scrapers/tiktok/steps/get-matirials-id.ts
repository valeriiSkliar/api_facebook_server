import { Injectable, Logger } from '@nestjs/common';
import { TiktokScraperStep } from './tiktok-scraper-step';
import { TiktokScraperContext } from '../tiktok-scraper-types';

@Injectable()
export class GetMatirialsIdStep extends TiktokScraperStep {
  execute(context: TiktokScraperContext): Promise<boolean> {
    this.logger.log(`Executing ${this.name}`);

    if (!context.state.rawApiResponse) {
      throw new Error(
        'Raw API response is missing. ApiRequestStep must be executed first.',
      );
    }

    const { data } = context.state.rawApiResponse;

    if (!data) {
      this.logger.warn('No data found in API response');
      context.state.materialsIds = [];
      return Promise.resolve(true);
    }

    const materials = data.materials;

    if (!materials || !Array.isArray(materials)) {
      this.logger.warn('No materials found in API response data');
      context.state.materialsIds = [];
      return Promise.resolve(true);
    }

    const materialsIds = materials.map((material) => material.id);
    context.state.materialsIds = materialsIds;

    return Promise.resolve(true);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async shouldExecute(context: TiktokScraperContext): Promise<boolean> {
    return Promise.resolve(true);
  }

  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
  ) {
    super(name, logger);
  }
}
