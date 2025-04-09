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
    const { materials } = data;

    const materialsIds = materials.map((material) => material.id);

    context.state.materialsIds = materialsIds;

    return Promise.resolve(true);
  }

  async shouldExecute(context: TiktokScraperContext): Promise<boolean> {
    return Promise.resolve(
      context.state?.rawApiResponse?.data?.materials.length !== 0,
    );
  }
  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
  ) {
    super(name, logger);
  }
}
