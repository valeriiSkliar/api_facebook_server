import { Logger } from '@nestjs/common';
import { IScraperStep } from '../../interfaces/IScraperStep';
import { InitializationStep } from '../steps/InitializationStep';
import { InterceptionSetupStep } from '../steps/InterceptionSetupStep';
import { PaginationStep } from '../steps/PaginationStep';
import { StorageStep } from '../steps/StorageStep';
import { NavigationStep } from '../steps/NavigationStep';

export class StepFactory {
  constructor(private readonly logger: Logger) {}

  createInitializationStep(): IScraperStep {
    return new InitializationStep('InitializationStep', this.logger);
  }

  createNavigationStep(): IScraperStep {
    return new NavigationStep('NavigationStep', this.logger);
  }

  createInterceptionSetupStep(): IScraperStep {
    return new InterceptionSetupStep('InterceptionSetupStep', this.logger);
  }

  createPaginationStep(): IScraperStep {
    return new PaginationStep('PaginationStep', this.logger);
  }

  createStorageStep(): IScraperStep {
    return new StorageStep('StorageStep', this.logger);
  }
}
