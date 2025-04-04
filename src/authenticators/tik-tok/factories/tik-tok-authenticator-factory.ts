import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';

import { TikTokAuthenticator } from '@src/authenticators/tik-tok/tik-tok-authenticator';
import { SadCaptchaSolverService } from '@src/services/common/captcha-solver/sad-captcha-solver-service';
import { FileSystemSessionManager } from '@src/services/tik-tok/session-refresh/file-system-session-manager';
import { EmailService } from '@src/services/common/email/email-service';
import { BrowserPoolService } from '@core/browser/browser-pool/browser-pool-service';
import { TabManager } from '@src/core/browser/tab-manager/tab-manager';
import { PrismaClient } from '@prisma/client';
import { Env } from '@src/config';
import { IAuthenticator, IAuthenticatorFactory } from '@src/interfaces';
import { AuthenticatorOptions } from '@src/authenticators/common/models/authenticator-options';
import { AuthenticatorContext } from '@src/authenticators/common/models/authenticator-context';

@Injectable()
export class TikTokAuthenticatorFactory implements IAuthenticatorFactory {
  constructor(
    private readonly browserPoolService: BrowserPoolService,
    private readonly tabManager: TabManager,
  ) {}

  /**
   * Creates a TikTok authenticator with all required dependencies
   * @param logger Logger instance
   * @returns TikTok authenticator instance
   */
  createAuthenticator(logger: Logger): IAuthenticator {
    // Create captcha solver
    const captchaSolver = new SadCaptchaSolverService(
      logger,
      Env.SAD_CAPTCHA_API_KEY || '',
      'storage/captcha-screenshots',
    );

    // Create session manager
    const sessionManager = new FileSystemSessionManager(
      process.env.SESSION_STORAGE_PATH || './storage/sessions',
      logger,
    );

    // Create email service with required account details
    const prismaClient = new PrismaClient();
    const emailAccount = {
      id: 1,
      email_address: Env.UKR_NET_EMAIL || '',
      password: Env.UKR_NET_APP_PASSWORD || '',
      connection_details: {
        imap_host: Env.UKR_NET_IMAP_HOST || '',
        imap_port: 993,
        imap_secure: true,
      },
    };

    const emailService = new EmailService(prismaClient, logger, emailAccount);

    // Create and return the TikTok authenticator
    return new TikTokAuthenticator(
      logger,
      captchaSolver,
      sessionManager,
      this.browserPoolService,
      this.tabManager,
      emailService,
    );
  }

  /**
   * Creates a standardized authenticator context
   * @param options Optional configuration options
   * @returns Authenticator context
   */
  createContext(options?: Partial<AuthenticatorOptions>): AuthenticatorContext {
    return {
      options: this.mergeWithDefaultOptions(options),
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

    return {
      ...defaultOptions,
      ...options,
    };
  }
}
