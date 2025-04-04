// src/auth/implementations/steps/NaturalScrollingStep.ts
import { Page } from 'playwright';
import { Logger } from '@nestjs/common';
import {
  AuthStepType,
  IAuthenticationStep,
} from '@src/scrapers/common/interfaces';
import { BrowserHelperService } from '@src/services';
import { AuthenticatorContext } from '@src/authenticators/common/models/authenticator-context';

export class NaturalScrollingStep implements IAuthenticationStep {
  private readonly logger: Logger;
  private readonly browserHelper: BrowserHelperService;
  private interruptionRequested: boolean = false;
  private apiRequestCaptured: boolean = false;

  // Default scrolling parameters
  private maxScrolls: number = 10;
  private minScrollPixels: number = 100;
  private maxScrollPixels: number = 300;
  private minDelay: number = 500;
  private maxDelay: number = 1500;
  private bottomMargin: number = 500;

  constructor(
    logger: Logger,
    options?: {
      maxScrolls?: number;
      minScrollPixels?: number;
      maxScrollPixels?: number;
      minDelay?: number;
      maxDelay?: number;
      bottomMargin?: number;
    },
  ) {
    this.logger = logger;
    this.browserHelper = BrowserHelperService.getInstance();

    // Override default parameters with provided options
    if (options) {
      this.maxScrolls = options.maxScrolls ?? this.maxScrolls;
      this.minScrollPixels = options.minScrollPixels ?? this.minScrollPixels;
      this.maxScrollPixels = options.maxScrollPixels ?? this.maxScrollPixels;
      this.minDelay = options.minDelay ?? this.minDelay;
      this.maxDelay = options.maxDelay ?? this.maxDelay;
      this.bottomMargin = options.bottomMargin ?? this.bottomMargin;
    }
  }
  getType(): AuthStepType {
    return AuthStepType.POST_SESSION;
  }

  getName(): string {
    return 'Natural Scrolling';
  }

  /**
   * Request interruption of the scrolling
   * @param reason Optional reason for the interruption
   */
  requestInterruption(reason: string = 'No reason provided'): void {
    this.interruptionRequested = true;
    this.logger.log(`Scrolling interruption requested: ${reason}`);
  }

  /**
   * Notify that an API request has been captured
   */
  notifyApiRequestCaptured(): void {
    this.apiRequestCaptured = true;
    this.requestInterruption('API request captured');
  }

  /**
   * Execute the natural scrolling step
   * @param page Playwright page
   * @returns Promise<boolean> Success status
   */
  async execute(context: AuthenticatorContext): Promise<boolean> {
    this.logger.log('Starting natural scrolling of the page');
    this.interruptionRequested = false;
    this.apiRequestCaptured = false;

    const page = context.state.page;
    if (!page) {
      this.logger.error('Page is not initialized');
      return false;
    }

    try {
      const scrollCount = await this.scrollNaturally(page);

      if (this.interruptionRequested) {
        this.logger.log(
          `Natural scrolling interrupted after ${scrollCount} scrolls`,
        );
        if (this.apiRequestCaptured) {
          this.logger.log(
            'Scrolling interrupted because API request was captured',
          );
        }
      } else {
        this.logger.log(
          `Natural scrolling completed: ${scrollCount} scrolls performed`,
        );
      }

      return true; // Return true even if interrupted, since interruption is a normal flow
    } catch (error) {
      this.logger.error('Error during natural scrolling:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  }

  /**
   * Function for natural scrolling of the page, imitating human behavior
   * Scrolls the page step by step with small random variations
   * @param page - Playwright page instance
   * @returns Promise<number> Number of scrolls performed
   */
  private async scrollNaturally(page: Page): Promise<number> {
    // Get current page metrics
    const pageMetrics = await page.evaluate(() => {
      return {
        scrollHeight: document.body.scrollHeight,
        scrollTop: window.pageYOffset || document.documentElement.scrollTop,
        windowHeight: window.innerHeight,
      };
    });

    let currentScrollTop = pageMetrics.scrollTop;
    const maxScrollTop =
      pageMetrics.scrollHeight - pageMetrics.windowHeight - this.bottomMargin;
    let scrollCount = 0;

    // Continue scrolling until reaching bottom boundary or max scrolls count, or until interrupted
    while (
      currentScrollTop < maxScrollTop &&
      scrollCount < this.maxScrolls &&
      !this.interruptionRequested
    ) {
      // Generate random scroll amount
      const scrollAmount = this.browserHelper.randomBetween(
        this.minScrollPixels,
        this.maxScrollPixels,
      );

      // Calculate new scroll position, but don't scroll beyond max allowed position
      const newScrollTop = Math.min(
        currentScrollTop + scrollAmount,
        maxScrollTop,
      );

      // Perform smooth scrolling
      await page.evaluate((scrollTo) => {
        window.scrollTo({
          top: scrollTo,
          behavior: 'smooth',
        });
      }, newScrollTop);

      // Update current scroll position
      currentScrollTop = newScrollTop;
      scrollCount++;

      // Random delay between scrolls to imitate human behavior
      const randomDelay = this.browserHelper.randomBetween(
        this.minDelay,
        this.maxDelay,
      );

      // Before waiting, check if interruption was requested
      if (this.interruptionRequested) {
        break;
      }

      await this.browserHelper.delay(randomDelay);

      // Check again for interruption after the delay
      if (this.interruptionRequested) {
        break;
      }

      // Sometimes make an additional pause as if a human stopped to read content
      if (Math.random() < 0.3) {
        // 30% chance to make an additional pause
        const readingPause = this.browserHelper.randomBetween(1000, 3000);

        // Before additional pause, check if interruption was requested
        if (this.interruptionRequested) {
          break;
        }

        await this.browserHelper.delay(readingPause);

        // Check again for interruption after the reading pause
        if (this.interruptionRequested) {
          break;
        }
      }

      // Check if we reached the bottom of the page
      const newMetrics = await page.evaluate(() => {
        return {
          scrollHeight: document.body.scrollHeight,
          scrollTop: window.pageYOffset || document.documentElement.scrollTop,
          windowHeight: window.innerHeight,
        };
      });

      // If page height changed during scrolling (dynamic content loaded), update max scroll position
      if (newMetrics.scrollHeight !== pageMetrics.scrollHeight) {
        const newMaxScrollTop =
          newMetrics.scrollHeight - newMetrics.windowHeight - this.bottomMargin;

        // Only update if the new max is greater than the old max
        if (newMaxScrollTop > maxScrollTop) {
          currentScrollTop = newMetrics.scrollTop;
        }
      }
    }

    this.logger.log(`Natural scrolling: ${scrollCount} scrolls performed`);
    return scrollCount;
  }

  /**
   * Check if scrolling was interrupted because of API request capture
   * @returns boolean
   */
  public wasInterruptedByApiRequest(): boolean {
    return this.interruptionRequested && this.apiRequestCaptured;
  }

  /**
   * Reset the scrolling state
   * This allows the step to be reused for another scrolling attempt
   */
  public reset(): void {
    this.interruptionRequested = false;
    this.apiRequestCaptured = false;
    this.logger.log('Natural scrolling state reset');
  }
}
