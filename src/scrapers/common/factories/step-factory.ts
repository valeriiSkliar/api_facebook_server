import { Logger, Inject } from '@nestjs/common';
import { IScraperStep } from '../interfaces/i-scraper-step';
import { InitializationStep } from '../../../implementations/steps/InitializationStep';
import { InterceptionSetupStep } from '../../../implementations/steps/InterceptionSetupStep';
import { PaginationStep } from '../../../implementations/steps/PaginationStep';
import { StorageStep } from '../../../implementations/steps/StorageStep';
import { NavigationStep } from '../../../implementations/steps/NavigationStep';

export class StepFactory {
  constructor(@Inject(Logger) private readonly logger: Logger) {}

  createInitializationStep(): IScraperStep {
    this.logger.log('Creating InitializationStep');
    return new InitializationStep('InitializationStep', this.logger);
  }

  createNavigationStep(): IScraperStep {
    this.logger.log('Creating NavigationStep');
    return new NavigationStep('NavigationStep', this.logger);
  }

  createInterceptionSetupStep(): IScraperStep {
    this.logger.log('Creating InterceptionSetupStep');
    return new InterceptionSetupStep('InterceptionSetupStep', this.logger);
  }

  createPaginationStep(): IScraperStep {
    this.logger.log('Creating PaginationStep');
    return new PaginationStep('PaginationStep', this.logger);
  }

  createStorageStep(): IScraperStep {
    this.logger.log('Creating StorageStep');
    return new StorageStep('StorageStep', this.logger);
  }
}
