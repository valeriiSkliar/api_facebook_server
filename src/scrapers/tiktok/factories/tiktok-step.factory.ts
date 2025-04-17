import { Injectable, Logger, Inject } from '@nestjs/common';
import { TiktokScraperStep } from '../steps/tik-tok-scraper/tiktok-scraper-step';
import { InitializationStep } from '../steps/tik-tok-scraper/initialization-step';
import { GetApiConfigStep } from '../steps/tik-tok-scraper/get-api-config-step';
import { ApiRequestStep } from '../steps/tik-tok-scraper/api-request-step';
import { GetMatirialsIdStep } from '../steps/tik-tok-scraper/get-matirials-id';
import { FilterMaterialsStep } from '../steps/tik-tok-scraper/filter-materials.step';
import { ProcessMaterialsStep } from '../steps/tik-tok-scraper/process-materials-step';
import { SaveCreativesStep } from '../steps/tik-tok-scraper/save-creatives.step';
import { PrismaService } from '@src/database/prisma.service';
import { HttpService } from '@nestjs/axios';
import { TiktokCreativeService } from '../services/tiktok-creative.service';
import { PaginationStep } from '../steps/tik-tok-scraper/pagination-step';
import { ErrorAnalysisStep } from '../steps/tik-tok-scraper/error-analysis-step';
import { ErrorDiagnosticStep } from '../steps/tik-tok-scraper/error-diagnostic-step';
import { ErrorReportingService } from '@src/core/reporting/services/error-reporting-service';
import { ApiResponseAnalyzer } from '@src/core/api/analyzer/base-api-response-analyzer';
import { SCRAPER_STATE_STORAGE } from '@src/core/storage/scraper-state/scraper-state-storage.token';
import { IScraperStateStorage } from '@src/core/storage/scraper-state/i-scraper-state-storage';

@Injectable()
export class TiktokStepFactory {
  constructor(
    private readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly creativeService: TiktokCreativeService,
    private readonly errorReportingService: ErrorReportingService,
    private readonly apiResponseAnalyzer: ApiResponseAnalyzer,
    @Inject(SCRAPER_STATE_STORAGE)
    private readonly stateStorage: IScraperStateStorage,
  ) {}

  createInitializationStep(): TiktokScraperStep {
    return new InitializationStep(
      'InitializationStep',
      this.logger,
      this.stateStorage,
    );
  }

  createGetApiConfigStep(): TiktokScraperStep {
    return new GetApiConfigStep('GetApiConfigStep', this.logger, this.prisma);
  }

  createPaginationStep(): TiktokScraperStep {
    return new PaginationStep('PaginationStep', this.logger);
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

  createErrorDiagnosticStep(): TiktokScraperStep {
    return new ErrorDiagnosticStep(
      'ErrorDiagnosticStep',
      this.logger,
      this.prisma,
    );
  }

  createErrorAnalysisStep(): TiktokScraperStep {
    return new ErrorAnalysisStep(
      'ErrorAnalysisStep',
      this.logger,
      this.errorReportingService,
      this.apiResponseAnalyzer,
    );
  }

  createProcessMaterialsStep(): TiktokScraperStep {
    return new ProcessMaterialsStep(
      'ProcessMaterialsStep',
      this.logger,
      this.httpService,
      this.stateStorage,
    );
  }

  createSaveCreativesStep(): TiktokScraperStep {
    return new SaveCreativesStep(this.logger, this.creativeService);
  }
}
