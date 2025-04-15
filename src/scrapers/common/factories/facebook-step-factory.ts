import { Logger, Inject } from '@nestjs/common';
import { IScraperStep } from '../interfaces/i-scraper-step';
import { InitializationStep } from '../../facebook/steps/initialization-step';
import { InterceptionSetupStep } from '../../facebook/steps/interception-setup-step';
import { PaginationStep } from '../../facebook/steps/pagination-step';
import { StorageStep } from '../../facebook/steps/storage-step';
import { NavigationStep } from '../../facebook/steps/navigation-step';
import { AuthStepType } from '../interfaces/i-authentication-step';

export class FacebookStepFactory {
  constructor(@Inject(Logger) private readonly logger: Logger) {}

  createInitializationStep(): IScraperStep {
    this.logger.log('Creating InitializationStep');
    return new InitializationStep(
      'InitializationStep',
      this.logger,
      AuthStepType.PRE_SESSION,
    );
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
