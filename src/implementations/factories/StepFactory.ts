import { Logger } from '@nestjs/common';
import { IScraperStep } from '@src/interfaces/IScraperStep';
import {
  InitializationStep,
  InterceptionSetupStep,
  NavigationStep,
  PaginationStep,
  StorageStep,
} from '../steps/InitializationStep';

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
