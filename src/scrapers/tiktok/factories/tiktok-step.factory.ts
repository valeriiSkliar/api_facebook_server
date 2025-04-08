import { Logger, Inject } from '@nestjs/common';
import { IScraperStep } from '@src/scrapers/common/interfaces';
import { InitializationStep } from '@src/scrapers/facebook/steps';

export class TiktokStepFactory {
  constructor(@Inject(Logger) private readonly logger: Logger) {}

  createInitializationStep(): IScraperStep {
    this.logger.log('Creating InitializationStep');
    return new InitializationStep('TiktokInitializationStep', this.logger);
  }

  // createNavigationStep(): IScraperStep {
  //   this.logger.log('Creating NavigationStep');
  //   return new NavigationStep('NavigationStep', this.logger);
  // }

  // createInterceptionSetupStep(): IScraperStep {
  //   this.logger.log('Creating InterceptionSetupStep');
  //   return new InterceptionSetupStep('InterceptionSetupStep', this.logger);
  // }

  // createPaginationStep(): IScraperStep {
  //   this.logger.log('Creating PaginationStep');
  //   return new PaginationStep('PaginationStep', this.logger);
  // }

  // createStorageStep(): IScraperStep {
  //   this.logger.log('Creating StorageStep');
  //   return new StorageStep('StorageStep', this.logger);
  // }
}
