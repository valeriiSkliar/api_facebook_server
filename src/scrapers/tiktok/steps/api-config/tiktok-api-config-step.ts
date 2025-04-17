import { AbstractGenericScraperStep } from '@src/scrapers/common/interfaces/abstract-generic-scraper-step';
import { TiktokApiConfigContext } from '../../pipelines/api-config/tiktok-api-config-types';

export abstract class TiktokApiConfigStep extends AbstractGenericScraperStep<TiktokApiConfigContext> {
  // Tiktok-api-config-specific step methods could be added here
}
