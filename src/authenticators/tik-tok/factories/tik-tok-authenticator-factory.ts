import { Injectable } from '@nestjs/common';

import { TikTokAuthenticator } from '@src/authenticators/tik-tok/tik-tok-authenticator';
import { SadCaptchaSolverService } from '@src/services/common/captcha-solver/sad-captcha-solver-service';
import { FileSystemSessionManager } from '@src/services/tik-tok/session-refresh/file-system-session-manager';
import { EmailService } from '@src/services/common/email/email-service';
import { BrowserPoolService } from '@core/browser/browser-pool/browser-pool-service';
import { TabManager } from '@src/core/browser/tab-manager/tab-manager';
import {
  IAuthenticator,
  IAuthenticatorFactory,
} from '@src/scrapers/common/interfaces';
import { AuthenticatorOptions } from '@src/authenticators/common/models/authenticator-options';
import { AuthenticatorContext } from '@src/authenticators/common/models/authenticator-context';
import { PrismaService } from '@src/database';

@Injectable()
export class TikTokAuthenticatorFactory implements IAuthenticatorFactory {
  constructor(
    private readonly browserPoolService: BrowserPoolService,
    private readonly tabManager: TabManager,
    private readonly emailService: EmailService,
    private readonly captchaSolverService: SadCaptchaSolverService,
    private readonly sessionManagerService: FileSystemSessionManager,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Creates a TikTok authenticator with all required dependencies
   * @returns TikTok authenticator instance
   */
  createAuthenticator(): IAuthenticator {
    return new TikTokAuthenticator(
      this.captchaSolverService,
      this.sessionManagerService,
      this.browserPoolService,
      this.tabManager,
      this.emailService,
      this.prisma,
    );
  }

  /**
   * Creates a standardized authenticator context
   * @param options Optional configuration options
   * @returns Authenticator context
   */
  createContext(options?: Partial<AuthenticatorOptions>): AuthenticatorContext {
    const defaultOptions = this.mergeWithDefaultOptions(options);
    return {
      options: defaultOptions,
      state: {
        errors: [],
        forceStop: false,
        externalBrowser: false,
      },
    };
  }

  /**
   * Merges provided options with default options
   * @param options Optional configuration options
   * @returns Complete options object
   */
  private mergeWithDefaultOptions(
    options?: Partial<AuthenticatorOptions>,
  ): AuthenticatorOptions {
    const defaultOptions: AuthenticatorOptions = {
      browser: {
        headless: true,
      },
      network: {
        timeout: 30000,
        retries: 3,
      },
      behavior: {
        applyFilters: false,
        maxRetries: 3,
        waitForResults: true,
        maxWaitTimeoutForStep: 30000,
        cleanUpTimeout: 300000,
      },
      storage: {
        enabled: true,
        format: 'json',
        outputPath: './storage/sessions',
      },
    };

    return { ...defaultOptions, ...options };
  }
}
