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
    try {
      await this.requestCaptureService.setupInterception(page, {
        log: this.logger,
        sessionId: this.sessionId,
        page: page,
        onFirstRequest: async () => {
          // Callback for when first request is intercepted
          // You can implement additional logic here if needed
          this.logger.log('First API request intercepted');
          if (this.scrollingStep) {
            this.scrollingStep.notifyApiRequestCaptured();
          }
        },
      });

      this.logger.log('Request interception setup completed successfully');
      return true;
    } catch (error) {
      this.logger.error('Error setting up request interception:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // We'll consider this a non-critical failure - auth can proceed
      // even without request interception
      return true;
    }
  }

  setSessionId(sessionId: number): void {
    this.sessionId = sessionId;
    this.requestCaptureService = new IntegratedRequestCaptureService(
      this.logger,
      sessionId,
    );
  }
}
