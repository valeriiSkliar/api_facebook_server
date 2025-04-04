/* eslint-disable @typescript-eslint/require-await */
// src/auth/implementations/steps/RequestInterceptionSetupStep.ts
import { Logger } from '@nestjs/common';
import {
  AuthStepType,
  IAuthenticationStep,
} from '@src/scrapers/common/interfaces';
import { NaturalScrollingStep } from './natural-scrolling-step';
import { IntegratedRequestCaptureService } from '@src/services';
import { AuthenticatorContext } from '@src/authenticators/common/models/authenticator-context';
export class RequestInterceptionSetupStep implements IAuthenticationStep {
  private readonly logger: Logger;
  private requestCaptureService: IntegratedRequestCaptureService;
  private sessionId?: number;
  private scrollingStep?: NaturalScrollingStep;

  constructor(
    logger: Logger,
    sessionId?: number,
    scrollingStep?: NaturalScrollingStep,
  ) {
    this.logger = logger;
    this.sessionId = sessionId;
    this.requestCaptureService = new IntegratedRequestCaptureService(
      logger,
      sessionId,
    );
    this.scrollingStep = scrollingStep;

    if (sessionId) {
      this.logger.log(
        `RequestInterceptionSetupStep initialized with sessionId: ${sessionId}`,
      );
    } else {
      this.logger.log(
        'RequestInterceptionSetupStep initialized without sessionId - will be set later',
      );
    }
  }

  getName(): string {
    return 'Request Interception Setup';
  }

  getType(): AuthStepType {
    return AuthStepType.POST_SESSION;
  }
  setScrollingStep(scrollingStep: NaturalScrollingStep): void {
    this.scrollingStep = scrollingStep;
  }

  async execute(context: AuthenticatorContext): Promise<boolean> {
    const page = context.state.page;
    if (!page) {
      this.logger.error('Page is not initialized');
      return false;
    }

    // Проверяем, если в контексте есть sessionId, будем использовать его
    if (context.credentials?.sessionId && !this.sessionId) {
      this.setSessionId(context.credentials.sessionId);
      this.logger.log(
        `Using sessionId from credentials: ${context.credentials.sessionId}`,
      );
    }

    try {
      await this.requestCaptureService.setupInterception(page, {
        log: this.logger,
        sessionId: this.sessionId,
        page: page,
        onFirstRequest: async () => {
          // Callback for when first request is intercepted
          this.logger.log('First API request intercepted');
          if (this.scrollingStep) {
            this.scrollingStep.notifyApiRequestCaptured();
          }
        },
      });

      this.logger.log('Request interception setup completed successfully', {
        sessionId: this.sessionId,
      });
      return true;
    } catch (error) {
      this.logger.error('Error setting up request interception:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        sessionId: this.sessionId,
      });
      // We'll consider this a non-critical failure - auth can proceed
      // even without request interception
      return true;
    }
  }

  setSessionId(sessionId: number): void {
    this.logger.log(
      `Setting session ID for request interception: ${sessionId}`,
    );
    this.sessionId = sessionId;
    this.requestCaptureService = new IntegratedRequestCaptureService(
      this.logger,
      sessionId,
    );
  }
}
