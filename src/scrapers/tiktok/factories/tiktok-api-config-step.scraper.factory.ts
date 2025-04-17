import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/database';
import { BrowserPoolService } from '@src/core/browser/browser-pool';
import { InitAccountsStep } from '../steps/api-config/init-accounts-step';
import { OpenTabsStep } from '../steps/api-config/open-tabs-step';
import { TiktokApiConfigStep } from '../steps/api-config/api-config-step';
import { ApiConfigCollectionStep } from '../steps/api-config/api-config-collection-step copy';
import { CleanupStep } from '../steps/api-config/cleane-up-step';
import { NavigationAndRestoreStep } from '../steps/api-config/navigation-and-restore-step';
import { SessionRestoreStep } from '../steps/api-config/session-restore-step';
import { SessionStorageService } from '@src/services/session-manager';
@Injectable()
export class TiktokApiConfigStepFactory {
  constructor(
    private readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly browserPoolService: BrowserPoolService,
    private readonly sessionStorageService: SessionStorageService,
  ) {}

  createInitAccountsStep(): TiktokApiConfigStep {
    return new InitAccountsStep('InitAccountsStep', this.logger, this.prisma);
  }

  createOpenTabsStep(): TiktokApiConfigStep {
    return new OpenTabsStep(
      'OpenTabsStep',
      this.logger,
      this.browserPoolService,
    );
  }

  createApiConfigCollectionStep(): TiktokApiConfigStep {
    return new ApiConfigCollectionStep(
      'ApiConfigCollectionStep',
      this.logger,
      this.prisma,
    );
  }

  createNavigationAndRestoreStep(): TiktokApiConfigStep {
    return new NavigationAndRestoreStep(
      'NavigationAndRestoreStep',
      this.logger,
    );
  }

  createSessionRestoreStep(): TiktokApiConfigStep {
    return new SessionRestoreStep(
      'SessionRestoreStep',
      this.logger,
      this.prisma,
      this.sessionStorageService,
      this.browserPoolService,
    );
  }

  createCleanupStep(): TiktokApiConfigStep {
    return new CleanupStep('CleanupStep', this.logger);
  }
}
