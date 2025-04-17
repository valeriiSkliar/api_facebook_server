import { AbstractGenericScraperStep } from '@src/scrapers/common/interfaces/abstract-generic-scraper-step';
import { Logger } from '@nestjs/common';
import { TiktokApiConfigContext } from '../../pipelines/api-config/tiktok-api-config-types';

export abstract class TiktokApiConfigStep extends AbstractGenericScraperStep<TiktokApiConfigContext> {
  // Base class for all TikTok API Config steps
  constructor(name: string, logger: Logger) {
    super(name, logger);
  }
}
