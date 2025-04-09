import { Injectable, Logger } from '@nestjs/common';
import { TiktokScraperStep } from '../steps/tiktok-scraper-step';
import { InitializationStep } from '../steps/initialization-step';
import { GetApiConfigStep } from '../steps/get-api-config-step';
import { ApiRequestStep } from '../steps/api-request-step';
import { GetMatirialsIdStep } from '../steps/get-matirials-id';
import { FilterMaterialsStep } from '../steps/filter-materials.step';
import { ProcessMaterialsStep } from '../steps/process-materials-step';
import { SaveCreativesStep } from '../steps/save-creatives.step';
import { PrismaService } from '@src/database/prisma.service';
import { HttpService } from '@nestjs/axios';
import { TiktokCreativeService } from '../services/tiktok-creative.service';

@Injectable()
export class TiktokStepFactory {
  constructor(
    private readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly creativeService: TiktokCreativeService,
  ) {}

  createInitializationStep(): TiktokScraperStep {
    return new InitializationStep('InitializationStep', this.logger);
  }

  createGetApiConfigStep(): TiktokScraperStep {
    return new GetApiConfigStep('GetApiConfigStep', this.logger, this.prisma);
  }

  createApiRequestStep(): TiktokScraperStep {
    return new ApiRequestStep('ApiRequestStep', this.logger, this.httpService);
  }

  createGetMatirialsIdStep(): TiktokScraperStep {
    return new GetMatirialsIdStep('GetMatirialsIdStep', this.logger);
  }

  createFilterMaterialsStep(): TiktokScraperStep {
    return new FilterMaterialsStep(
      'FilterMaterialsStep',
      this.logger,
      this.prisma,
    );
  }

  createProcessMaterialsStep(): TiktokScraperStep {
    return new ProcessMaterialsStep(
      'ProcessMaterialsStep',
      this.logger,
      this.httpService,
    );
  }

  createSaveCreativesStep(): TiktokScraperStep {
    return new SaveCreativesStep(this.logger, this.creativeService);
  }
}
