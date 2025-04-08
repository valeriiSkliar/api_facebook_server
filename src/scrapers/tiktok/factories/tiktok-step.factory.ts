import { Logger, Inject } from '@nestjs/common';
import { IScraperStep } from '@src/scrapers/common/interfaces';
import { InitializationStep } from '../steps/initialization-step';
import { GetApiConfigStep } from '../steps/get-api-config-step';
import { PrismaService } from '@src/database/prisma.service';

export class TiktokStepFactory {
  constructor(
    @Inject(Logger) private readonly logger: Logger,
    private readonly prisma: PrismaService,
  ) {}

  createInitializationStep(): IScraperStep {
    this.logger.log('Creating InitializationStep');
    return new InitializationStep('TiktokInitializationStep', this.logger);
  }

  createGetApiConfigStep(): IScraperStep {
    this.logger.log('Creating GetApiConfigStep');
    return new GetApiConfigStep('GetApiConfigStep', this.logger, this.prisma);
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
