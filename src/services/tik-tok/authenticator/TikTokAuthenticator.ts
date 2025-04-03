/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// src/services/tik-tok/authenticator/TikTokAuthenticator.ts
import { Logger } from '@nestjs/common';
import { Page } from 'playwright';

import { BrowserHelperService } from '@src/services';
import { BrowserPoolService } from '@core/browser/browser-pool/browser-pool-service';
import { TabManager } from '@core/browser/browser-pool/tab-manager';
import { AuthenticationPipeline } from '@src/implementations';
import { ICaptchaSolver, ISessionManager } from '@src/interfaces';
import { AuthCredentials, Session } from '@src/models';
import { PrismaClient } from '@prisma/client';
import {
  CookieConsentStep,
  InitializationStep,
  LoginButtonStep,
  NavigationStep,
  SessionRestoreStep,
  SaveSessionStep,
  SelectPhoneEmailLoginStep,
} from '../steps';
import { BaseAuthenticator } from '@src/services/auth/BaseAuthenticator';
import { EmailService } from '../email/EmailService';
import { FillLoginFormStep } from '../steps/fill-login-form-step';
import { SubmitLoginFormStep } from '../steps/submit-login-form-step';
import { CaptchaVerificationStep } from '../steps/captcha-verification-step';
import { EmailVerificationStep } from '../steps/email-verification-step';

/**
 * TikTok authenticator implementation that extends BaseAuthenticator
 * Handles the authentication process for TikTok
 */
export class TikTokAuthenticator extends BaseAuthenticator {
  private captchaSolver: ICaptchaSolver;
  private sessionManager: ISessionManager;
  private currentSession: Session | null = null;
  private authPipeline: AuthenticationPipeline;
  private browserHelperService: BrowserHelperService;
  private emailService: EmailService;
  private browserPool: BrowserPoolService;
  private tabManager: TabManager;
  private prisma: PrismaClient;
  private sessionStoragePath = 'storage/sessions';
  private loginUrl =
    'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en';

  /**
   * Creates a new TikTokAuthenticator instance
   * @param logger Logger instance
   * @param captchaSolver Captcha solver implementation
   * @param sessionManager Session manager implementation
   * @param browserPool Browser pool service
   * @param tabManager Tab manager service
   * @param emailService Email service implementation
   */
  constructor(
    logger: Logger,
    captchaSolver: ICaptchaSolver,
    sessionManager: ISessionManager,
    browserPool: BrowserPoolService,
    tabManager: TabManager,
    emailService: EmailService,
  ) {
    super(logger); // Call base constructor with logger

    this.captchaSolver = captchaSolver;
    this.sessionManager = sessionManager;
    this.browserPool = browserPool;
    this.tabManager = tabManager;
    this.emailService = emailService;
    this.authPipeline = new AuthenticationPipeline(logger);

    // Initialize browser helper service
    this.browserHelperService = BrowserHelperService.getInstance();
    this.browserHelperService.setLogger(logger);

    // Initialize Prisma client
    this.prisma = new PrismaClient();

    // Configure the authentication pipeline with required steps
    this.initializeAuthPipeline();
  }

  /**
   * Initialize authentication pipeline with all required steps
   */
  private initializeAuthPipeline(): void {
    // Add authentication steps to the pipeline
    this.authPipeline.addStep(new InitializationStep(this.logger));
    this.authPipeline.addStep(new NavigationStep(this.logger));
    this.authPipeline.addStep(new SessionRestoreStep(this.logger));
    this.authPipeline.addStep(new CookieConsentStep(this.logger));
    this.authPipeline.addStep(new LoginButtonStep(this.logger));
    this.authPipeline.addStep(new SelectPhoneEmailLoginStep(this.logger));
    this.authPipeline.addStep(new FillLoginFormStep(this.logger));
    this.authPipeline.addStep(new SubmitLoginFormStep(this.logger));
    this.authPipeline.addStep(
      new CaptchaVerificationStep(this.logger, this.captchaSolver),
    );
    this.authPipeline.addStep(
      new EmailVerificationStep(this.logger, this.emailService),
    );
    this.authPipeline.addStep(new SaveSessionStep(this.logger));

    this.logger.log('Authentication pipeline initialized');
  }

  /**
   * Run the authentication process
   * @param credentials User credentials for authentication
   */
  async runAuthenticator(credentials: AuthCredentials): Promise<void> {
    this.logger.log('Starting TikTok authentication process', {
      email: credentials.email,
      sessionPath: credentials.sessionPath,
    });

    let browserId: string | null = null;
    let tabId: string | null = null;

    try {
      // Create a dedicated ID for this authentication request
      const authSessionId = `auth_${credentials.email}_${Date.now()}`;

      // Acquire a browser and tab from the pool using system tab method
      const tabCreation = await this.browserPool.createSystemTabForSession(
        authSessionId,
        credentials.email,
      );

      if (!tabCreation) {
        throw new Error('Failed to create browser tab for authentication');
      }

      browserId = tabCreation.browserId;
      tabId = tabCreation.tabId;

      this.logger.log('Browser tab created for authentication', {
        browserId,
        tabId,
        sessionId: authSessionId,
      });

      // Get page from tab
      const page = this.browserPool['lifecycleManager'].getPageForTab(tabId);

      if (!page) {
        throw new Error(`No page found for tab ${tabId}`);
      }

      // Установка страницы и браузера в контекст перед выполнением пайплайна
      this.context.state.page = page;
      // Добавляем browserId и tabId в контекст для отслеживания
      this.context.state.browserId = browserId;
      this.context.state.tabId = tabId;

      try {
        const browser =
          await this.browserPool['lifecycleManager'].getBrowserForTab(tabId);
        if (browser) {
          // @ts-expect-error - используем упрощенный объект браузера
          this.context.state.browser = browser;
          this.logger.log(`Using browser ${browser.id} for authentication`);
        }
      } catch (browserError) {
        this.logger.warn(
          `Could not get browser for tab ${tabId}, continuing without browser context: ${browserError instanceof Error ? browserError.message : 'Unknown error'}`,
        );
      }

      const result = await this.authPipeline.execute(this.context, credentials);

      if (!result.success) {
        throw new Error(`Authentication failed: ${result.error}`);
      }

      // Запись успешных результатов аутентификации
      this.logger.log('Authentication pipeline execution completed', {
        success: result.success,
        sessionRestored: result.data?.sessionRestored,
        executionTime: result.data?.executionTime,
      });

      // Сохранение сессии в базу данных при успешной аутентификации
      if (result.success) {
        await this.saveSessionToDatabase(
          credentials.email,
          credentials.sessionPath ||
            `${this.sessionStoragePath}/tiktok_${credentials.email.replace(/[@.]/g, '_')}.json`,
        );
      }
    } catch (error) {
      this.logger.error('Error during authentication process:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    } finally {
      // Clean up browser resources when done
      if (browserId && tabId) {
        try {
          await this.browserPool.closeTab(browserId, tabId);
          this.logger.log('Closed authentication browser tab', {
            browserId,
            tabId,
          });
        } catch (cleanupError) {
          this.logger.warn('Error closing authentication browser tab', {
            error:
              cleanupError instanceof Error
                ? cleanupError.message
                : String(cleanupError),
          });
        }
      }

      await this.prisma.$disconnect();
    }
  }

  /**
   * Save session information to database
   */
  private async saveSessionToDatabase(
    email: string,
    storagePath: string,
  ): Promise<void> {
    try {
      // Update or create session record in database
      const existingSession = await this.prisma.session.findFirst({
        where: { email },
      });

      if (existingSession) {
        await this.prisma.session.update({
          where: { id: existingSession.id },
          data: {
            is_valid: true,
            status: 'ACTIVE',
            storage_path: storagePath,
            last_activity_timestamp: new Date(),
          },
        });
        this.logger.log('Updated existing session in database', { email });
      } else {
        await this.prisma.session.create({
          data: {
            email,
            is_valid: true,
            status: 'ACTIVE',
            storage_path: storagePath,
            last_activity_timestamp: new Date(),
            created_at: new Date(),
            session_data: {},
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
          },
        });
        this.logger.log('Created new session in database', { email });
      }
    } catch (error) {
      this.logger.error('Error saving session to database:', {
        email,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Verifies if the current session is valid
   * @returns Promise resolving to boolean indicating session validity
   */
  async verifySession(): Promise<boolean> {
    if (!this.currentSession) {
      this.logger.log('No active session to verify');
      return false;
    }

    this.logger.log('Verifying TikTok session', {
      sessionId: this.currentSession.id,
    });

    // Implementation would need to create a tab, load the session, and check if logged in
    // For example:
    try {
      const verificationSessionId = `verify_${this.currentSession.id}`;
      // Добавляем более уникальный идентификатор с меткой времени
      const uniqueVerificationId = `${verificationSessionId}_${Date.now()}`;

      const tabCreation = await this.browserPool.createSystemTabForSession(
        uniqueVerificationId,
        this.currentSession.userId,
      );

      if (!tabCreation) {
        this.logger.warn(
          'Failed to create browser tab for session verification',
        );
        return false;
      }

      this.logger.log('Browser tab created for session verification', {
        browserId: tabCreation.browserId,
        tabId: tabCreation.tabId,
      });

      const result = await this.browserPool.executeInTab(
        tabCreation.browserId,
        tabCreation.tabId,
        async ({ page }) => {
          // Explicitly type the page as Page
          const typedPage = page as Page;

          // Navigate to TikTok
          await typedPage.goto(this.loginUrl, { waitUntil: 'networkidle' });

          // Check if logged in
          return await this.browserHelperService.isLoggedIn(typedPage);
        },
      );

      // Clean up
      await this.browserPool.closeTab(tabCreation.browserId, tabCreation.tabId);
      this.logger.log('Closed verification browser tab', {
        browserId: tabCreation.browserId,
        tabId: tabCreation.tabId,
      });

      return result;
    } catch (error) {
      this.logger.error('Error verifying session', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Refreshes the current session to extend its validity
   * @returns Promise resolving to boolean indicating success
   */
  async refreshSession(): Promise<boolean> {
    if (!this.currentSession) {
      this.logger.log('No active session to refresh');
      return false;
    }

    this.logger.log('Refreshing TikTok session', {
      sessionId: this.currentSession.id,
    });

    // Implementation similar to verifySession but with additional steps
    // to extend the session validity, e.g., perform some authenticated action

    return new Promise((resolve) => {
      resolve(false);
    }); // Placeholder - implement actual refresh logic
  }

  /**
   * Performs logout, invalidating the current session
   * @returns Promise resolving when logout is complete
   */
  async logout(): Promise<void> {
    if (!this.currentSession) {
      this.logger.log('No active session to logout from');
      return;
    }

    this.logger.log('Logging out from TikTok', {
      sessionId: this.currentSession.id,
    });

    try {
      const logoutSessionId = `logout_${this.currentSession.id}`;
      const tabCreation = await this.browserPool.createSystemTabForSession(
        logoutSessionId,
        this.currentSession.userId,
      );

      if (tabCreation) {
        await this.browserPool.executeInTab(
          tabCreation.browserId,
          tabCreation.tabId,
          async ({ page }) => {
            // Explicitly type the page as Page
            const typedPage = page as Page;

            // Navigate to TikTok
            await typedPage.goto(this.loginUrl, { waitUntil: 'networkidle' });

            // Perform logout actions
            try {
              // Click user menu
              await typedPage.click('div[data-e2e="profile-icon"]');
              await typedPage.waitForTimeout(1000);

              // Click logout button - adjust selector as needed
              await typedPage.click(
                'button[aria-label="Log out"], a[href*="logout"]',
              );
              await typedPage.waitForTimeout(3000);
            } catch (error) {
              this.logger.error('Error performing logout actions', {
                error: error instanceof Error ? error.message : String(error),
              });
            }
          },
        );

        // Clean up
        await this.browserPool.closeTab(
          tabCreation.browserId,
          tabCreation.tabId,
        );
      }

      // Mark session as invalid in database
      if (this.currentSession) {
        const sessionRecord = await this.prisma.session.findFirst({
          where: { id: parseInt(this.currentSession.id) },
        });

        if (sessionRecord) {
          await this.prisma.session.update({
            where: { id: sessionRecord.id },
            data: {
              is_valid: false,
              status: 'LOGGED_OUT',
            },
          });
        }
      }

      this.currentSession = null;
    } catch (error) {
      this.logger.error('Error during logout', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Cleans up resources used by the authenticator
   */
  async dispose(): Promise<void> {
    this.logger.log('Disposing TikTok authenticator');
    await this.prisma.$disconnect();
  }

  /**
   * Set the session storage path
   * @param path Path to store session files
   */
  setSessionStoragePath(path: string): void {
    this.sessionStoragePath = path;
  }
}
