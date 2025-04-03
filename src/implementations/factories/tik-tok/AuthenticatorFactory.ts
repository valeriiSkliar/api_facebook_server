// src/auth/factories/AuthenticatorFactory.ts

import { PlaywrightCrawlerOptions } from 'crawlee';
import {
  IAuthenticator,
  ICaptchaSolver,
  ISessionManager,
} from '@src/interfaces/tik-tok';

import { Env } from '@lib/Env';
import { PrismaClient } from '@prisma/client';
import {
  EmailService,
  TikTokAuthenticator,
  FileSystemSessionManager,
  SadCaptchaSolverService,
  BrowserPoolService,
  TabManager,
} from '@src/services';
import { EmailAccount } from '@src/models/tik-tok/email-account';
import { Logger } from '@nestjs/common';

/**
 * Factory for creating authenticator instances
 */
export class AuthenticatorFactory {
  /**
   * Creates a TikTok authenticator with all necessary dependencies
   * @param logger Logger instance
   * @param options Additional options for authenticator creation
   * @param emailAccount Email account to use
   * @param browserPoolService Browser pool service to use
   * @param tabManager Tab manager to use
   * @returns TikTokAuthenticator instance
   */
  static createTikTokAuthenticator(
    logger: Logger,
    options: {
      sessionStoragePath?: string;
      captchaSolverApiKey?: string;
      crawlerOptions?: Partial<PlaywrightCrawlerOptions>;
    } = {},
    emailAccount: EmailAccount,
    browserPoolService: BrowserPoolService,
    tabManager: TabManager,
  ): IAuthenticator {
    // Set default options
    const sessionStoragePath =
      options.sessionStoragePath ||
      process.env.SESSION_STORAGE_PATH ||
      './storage/sessions';
    const captchaSolverApiKey =
      options.captchaSolverApiKey || process.env.SAD_CAPTCHA_API_KEY || '';
    // const crawlerOptions = options.crawlerOptions || {};

    // Create dependencies
    const sessionManager = AuthenticatorFactory.createSessionManager(
      sessionStoragePath,
      logger,
    );
    const captchaSolver = AuthenticatorFactory.createCaptchaSolver(
      captchaSolverApiKey,
      logger,
    );

    // Create prisma client and email service
    const prisma = new PrismaClient();
    const emailService = new EmailService(prisma, logger, emailAccount);

    // Create and set up the authenticator
    const authenticator = new TikTokAuthenticator(
      logger,
      captchaSolver,
      sessionManager,
      browserPoolService,
      tabManager,
      emailService,
    );

    // Set the session storage path explicitly
    authenticator.setSessionStoragePath(sessionStoragePath);

    return authenticator;
  }

  /**
   * Creates a session manager instance
   * @param storagePath Path to session storage directory
   * @param logger Logger instance
   * @returns ISessionManager implementation
   */
  private static createSessionManager(
    storagePath: string,
    logger: Logger,
  ): ISessionManager {
    return new FileSystemSessionManager(storagePath, logger);
  }

  /**
   * Creates a captcha solver instance
   * @param apiKey API key for the captcha solving service
   * @param logger Logger instance
   * @returns ICaptchaSolver implementation
   */
  private static createCaptchaSolver(
    apiKey: string,
    logger: Logger,
  ): ICaptchaSolver {
    const screenshotsDir =
      Env.CAPTCHA_SCREENSHOTS_DIR || 'storage/captcha-screenshots';
    return new SadCaptchaSolverService(logger, apiKey, screenshotsDir);
  }
}
