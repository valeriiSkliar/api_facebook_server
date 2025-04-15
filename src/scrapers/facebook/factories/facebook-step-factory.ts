// src/scrapers/facebook/factories/facebook-step.factory.ts

import { Injectable, Logger } from '@nestjs/common';
import { FacebookScraperStep } from '../steps/facebook-scraper-step';
import { ResponseCacheService } from '@src/services/ResponseCacheService';
import { SCRAPER_STATE_STORAGE } from '@src/core/storage/scraper-state/scraper-state-storage.token';
import { IScraperStateStorage } from '@src/core/storage/scraper-state/i-scraper-state-storage';
import { Inject, Optional } from '@nestjs/common';
import { RequestCaptureService } from '@src/services/RequestCaptureService';
import { InitializationStep } from '../steps/initialization-step';
import { AuthStepType } from '@src/scrapers/common/interfaces';
import {
  InterceptionSetupStep,
  NavigationStep,
  PaginationStep,
  StorageStep,
} from '../steps';
import { StorageFacebookCreativesStep } from '../steps/store-facebook-creatives-step';
import { FacebookCreativeService } from '../services/facebook-creative-service';

@Injectable()
export class FacebookStepFactory {
  constructor(
    private readonly logger: Logger,
    private readonly responseCacheService: ResponseCacheService,
    private readonly requestCaptureService: RequestCaptureService,
    private readonly creativeService: FacebookCreativeService,
    @Optional()
    @Inject(SCRAPER_STATE_STORAGE)
    private readonly stateStorage?: IScraperStateStorage,
  ) {}

  createInitializationStep(): FacebookScraperStep {
    return new InitializationStep(
      'InitializationStep',
      this.logger,
      AuthStepType.PRE_SESSION,
    );
  }

  createNavigationStep(): FacebookScraperStep {
    return new NavigationStep('NavigationStep', this.logger);
  }

  createInterceptionSetupStep(): FacebookScraperStep {
    return new InterceptionSetupStep('InterceptionSetupStep', this.logger);
  }

  createPaginationStep(): FacebookScraperStep {
    return new PaginationStep('PaginationStep', this.logger);
  }

  createStorageFacebookCreativesStep(): FacebookScraperStep {
    return new StorageFacebookCreativesStep(
      'StorageFacebookCreativesStep',
      this.logger,
      this.creativeService,
    );
  }

  createStorageStep(): FacebookScraperStep {
    return new StorageStep('StorageStep', this.logger);
  }
}
