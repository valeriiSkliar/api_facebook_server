import { Logger, Inject } from '@nestjs/common';
import { InitializationStep } from '../steps/initialization-step';
import { GetApiConfigStep } from '../steps/get-api-config-step';
import { PrismaService } from '@src/database/prisma.service';
import { TiktokScraperStep } from '../steps/tiktok-scraper-step';
import { ApiRequestStep } from '../steps/api-request-step';
import { HttpService } from '@nestjs/axios';
import { GetMatirialsIdStep } from '../steps/get-matirials-id';
import { ProcessMaterialsStep } from '../steps/process-materials-step';

export class TiktokStepFactory {
  constructor(
    @Inject(Logger) private readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  createInitializationStep(): TiktokScraperStep {
    this.logger.log('Creating InitializationStep');
    return new InitializationStep('TiktokInitializationStep', this.logger);
  }

  createGetApiConfigStep(): TiktokScraperStep {
    this.logger.log('Creating GetApiConfigStep');
    return new GetApiConfigStep('GetApiConfigStep', this.logger, this.prisma);
  }

  createApiRequestStep(): TiktokScraperStep {
    this.logger.log('Creating ApiRequestStep');
    return new ApiRequestStep('ApiRequestStep', this.logger, this.httpService);
  }

  createGetMatirialsIdStep(): TiktokScraperStep {
    this.logger.log('Creating GetMatirialsIdStep');
    return new GetMatirialsIdStep('GetMatirialsIdStep', this.logger);
  }

  createProcessMaterialsStep(): TiktokScraperStep {
    this.logger.log('Creating ProcessMaterialsStep');
    return new ProcessMaterialsStep(
      'ProcessMaterialsStep',
      this.logger,
      this.httpService,
    );
  }
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
