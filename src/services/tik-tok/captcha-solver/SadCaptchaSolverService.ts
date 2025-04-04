// src/auth/services/SadCaptchaSolverService.ts

import { Logger } from '@nestjs/common';
import { Page } from 'playwright';
import axios from 'axios';
import * as fs from 'fs';
import path from 'path';
import {
  ICaptchaSolver,
  CaptchaDetectionResult,
} from '@src/interfaces/tik-tok';
import { BrowserHelperService } from '@src/core/browser/helpers';

interface SadCaptchaResponse {
  pointOneProportionX: number;
  pointOneProportionY: number;
  pointTwoProportionX: number;
  pointTwoProportionY: number;
}

/**
 * Implementation of ICaptchaSolver using SadCaptcha service
 * Handles detection and solving of captchas on TikTok
 */
export class SadCaptchaSolverService implements ICaptchaSolver {
  private readonly baseUrl = 'https://www.sadcaptcha.com/api/v1';
  private readonly logger: Logger;
  private readonly apiKey: string;
  private readonly screenshotsDir: string;
  private browserHelperService: BrowserHelperService;

  /**
   * Creates a new SadCaptchaSolver instance
   * @param logger Logger instance
   * @param apiKey SadCaptcha API key
   * @param screenshotsDir Directory to store captcha screenshots
   */
  constructor(
    logger: Logger,
    apiKey: string,
    screenshotsDir = 'storage/screenshots',
  ) {
    this.logger = logger;
    this.apiKey = apiKey;
    this.screenshotsDir = screenshotsDir;
    this.browserHelperService = BrowserHelperService.getInstance();
    this.browserHelperService.setLogger(logger);
    // Ensure screenshots directory exists
    this.ensureDirectoryExists(this.screenshotsDir);
  }

  /**
   * Detects the presence of a captcha on the page
   * @param page Playwright page object
   * @returns Promise resolving to captcha detection result
   */
  async detect(page: Page): Promise<CaptchaDetectionResult> {
    this.logger.log('Detecting captcha', { url: page.url() });

    try {
      // Common captcha selectors for TikTok
      const captchaSelectors = [
        // TikTok shape captcha
        'div.captcha_verify_container',
        'div.captcha-verify-container',
        'div[class*="captcha"]',
        // Slide captcha
        'div.secsdk-captcha-drag-wrapper',
        'div.captcha_verify_slide',
        // General captcha containers
        'iframe[src*="captcha"]',
        'div[id*="captcha"]',
      ];

      // Check for captcha elements
      for (const selector of captchaSelectors) {
        const isVisible = await page.isVisible(selector).catch(() => false);

        if (isVisible) {
          this.logger.log(`Captcha detected with selector: ${selector}`);

          // Take a screenshot of the captcha
          const timestamp = Date.now();
          const screenshotPath = path.join(
            this.screenshotsDir,
            `captcha-${timestamp}.png`,
          );

          // Get the element handle
          const element = await page.$(selector);

          // Take a screenshot of the captcha element
          if (element) {
            await element.screenshot({ path: screenshotPath });
          } else {
            // Fallback to full page screenshot
            await page.screenshot({ path: screenshotPath });
          }

          // Determine captcha type
          let captchaType = 'unknown';

          if (selector.includes('slide')) {
            captchaType = 'tiktok-slide';
          } else if (selector.includes('verify')) {
            captchaType = 'tiktok-shape';
          }

          return {
            detected: true,
            type: captchaType,
            element,
            selector,
            screenshotPath,
          };
        }
      }

      // No captcha detected
      return {
        detected: false,
        type: null,
        element: null,
      };
    } catch (error) {
      this.logger.error('Error detecting captcha:', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        detected: false,
        type: null,
        element: null,
      };
    }
  }

  /**
   * Attempts to solve the detected captcha
   * @param page Playwright page object
   * @param detectionResult Result from the captcha detection
   * @returns Promise resolving to boolean indicating success
   */
  async solve(
    page: Page,
    detectionResult: CaptchaDetectionResult,
  ): Promise<boolean> {
    if (
      !detectionResult.detected ||
      !detectionResult.element ||
      !detectionResult.screenshotPath
    ) {
      this.logger.log('No captcha to solve or missing required information');
      return false;
    }

    this.logger.log('Solving captcha', {
      type: detectionResult.type,
      selector: detectionResult.selector,
    });

    try {
      // Use the solveCaptcha method to solve the captcha
      return await this.solveCaptcha(
        page,
        detectionResult.selector || 'div[class*="captcha"]',
        detectionResult.screenshotPath,
      );
    } catch (error) {
      this.logger.error('Error solving captcha:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Solves a captcha using the SadCaptcha API
   * @param page Playwright page object
   * @param captchaImageSelector Selector for the captcha image
   * @param screenshotPath Path to the captcha screenshot
   * @returns Promise resolving to boolean indicating success
   */
  private async solveCaptcha(
    page: Page,
    captchaImageSelector: string,
    screenshotPath: string,
  ): Promise<boolean> {
    try {
      if (!screenshotPath) {
        this.logger.error('No screenshot path provided for captcha solving');
        return false;
      }

      await page.waitForTimeout(1000);

      // Read the existing screenshot
      const buffer = await fs.promises.readFile(screenshotPath);
      const imageBase64 = buffer.toString('base64');

      // Get the captcha element
      this.logger.log('Getting captcha element', {
        selector: captchaImageSelector,
      });
      const captchaElement = await page.$(captchaImageSelector);
      if (!captchaElement) {
        this.logger.error('Captcha element not found');
        return false;
      }

      // Get solution from SadCaptcha API
      const solution = await this.getSolution(imageBase64);
      if (!solution) {
        return false;
      }
      this.logger.log('Captcha solution received', { solution });

      // Get element dimensions and position
      const boundingBox = await captchaElement.boundingBox();
      if (!boundingBox) {
        this.logger.error('Could not get captcha element dimensions');
        return false;
      }
      this.logger.log('Captcha element dimensions', { boundingBox });

      // Take a screenshot before clicking for debugging
      await page.screenshot({
        path: path.join(this.screenshotsDir, 'before-captcha-click.png'),
      });

      // Find the actual puzzle/image element inside the captcha container
      // Many captchas have the interactive element nested within the container
      const puzzleElement = await this.findPuzzleElement(
        page,
        captchaElement,
        captchaImageSelector,
      );

      // Calculate actual click coordinates
      // Use the puzzle element's bounding box if found, otherwise use the container
      const targetElement = puzzleElement || captchaElement;
      const targetBox = await targetElement.boundingBox();

      if (!targetBox) {
        this.logger.error('Could not get target element dimensions');
        return false;
      }

      // Log the target box for debugging
      this.logger.log('Target element for clicks', { targetBox });

      // Calculate absolute click positions within the page
      const clickPoints = [
        {
          x: targetBox.x + targetBox.width * solution.pointOneProportionX,
          y: targetBox.y + targetBox.height * solution.pointOneProportionY,
        },
        {
          x: targetBox.x + targetBox.width * solution.pointTwoProportionX,
          y: targetBox.y + targetBox.height * solution.pointTwoProportionY,
        },
      ];

      this.logger.log('Absolute click points on page', { clickPoints });

      // Click the points with absolute coordinates (not relative to element)
      for (const point of clickPoints) {
        await page.waitForTimeout(
          this.browserHelperService.randomBetween(1000, 2000),
        );

        // Move mouse to position with some random variation
        const moveX = point.x + this.browserHelperService.randomBetween(-2, 2);
        const moveY = point.y + this.browserHelperService.randomBetween(-2, 2);

        this.logger.log('Moving mouse to position', { x: moveX, y: moveY });
        await page.mouse.move(moveX, moveY, {
          steps: this.browserHelperService.randomBetween(5, 10),
        });

        await page.waitForTimeout(300);

        // Click at the exact calculated position
        this.logger.log('Clicking at position', { x: point.x, y: point.y });
        await page.mouse.click(point.x, point.y);

        // Take screenshot after each click for debugging
        await page.screenshot({
          path: path.join(
            this.screenshotsDir,
            `after-captcha-click-${Date.now()}.png`,
          ),
        });
      }

      this.logger.log('Captcha solution applied');

      // Increase wait time after applying solution to give TikTok's system time to process
      await page.waitForTimeout(3500);

      // Take a verification screenshot
      await page.screenshot({
        path: path.join(this.screenshotsDir, 'before-confirmation.png'),
      });

      // Multiple attempts to confirm the captcha
      for (let attempt = 0; attempt < 3; attempt++) {
        const confirmed = await this.attemptCaptchaConfirmation(
          page,
          captchaImageSelector,
        );
        if (confirmed) {
          return true;
        }
        // Wait between attempts
        await page.waitForTimeout(2000);
      }

      return false;
    } catch (error) {
      this.logger.error('Error solving captcha:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  }

  /**
   * Tries to find the actual puzzle/image element inside the captcha container
   * @param page - Playwright page
   * @param containerElement - The main captcha container
   * @param containerSelector - The selector for the container
   * @returns Promise with the puzzle element or null
   */
  private async findPuzzleElement(
    page: Page,
    containerElement: any,
    containerSelector: string,
  ) {
    // Common selectors for the actual puzzle part inside the container
    const puzzleSelectors = [
      'canvas',
      'img.captcha_verify_img_slide',
      'div.captcha-verify-image',
      'div.captcha_verify_img_wrapper',
      'div.verify-captcha-image',
      '.verify-captcha-panel',
      '.captcha-puzzle',
    ];

    // First try to find within the container
    for (const selector of puzzleSelectors) {
      try {
        const elements = await containerElement.$$(selector);
        if (elements.length > 0) {
          this.logger.log(`Found puzzle element with selector ${selector}`);
          return elements[0];
        }
      } catch (error) {
        // Continue to next selector
      }
    }

    // If no puzzle element found in container, try with CSS descendant selectors
    for (const selector of puzzleSelectors) {
      try {
        const fullSelector = `${containerSelector} ${selector}`;
        const element = await page.$(fullSelector);
        if (element) {
          this.logger.log(`Found puzzle element with selector ${fullSelector}`);
          return element;
        }
      } catch (error) {
        // Continue to next selector
      }
    }

    this.logger.warn('Could not find specific puzzle element, using container');
    return null;
  }

  /**
   * Attempts to click the CAPTCHA confirm button and verify success
   * @param page - Playwright page object
   * @param selector - CAPTCHA selector to check for removal
   * @returns Promise<boolean> - Whether verification was successful
   */
  private async attemptCaptchaConfirmation(
    page: Page,
    selector: string,
  ): Promise<boolean> {
    const confirmSelectors = [
      'div.verify-captcha-submit-button',
      'button.verify-captcha-submit-button',
      'button[type="submit"]',
      'button.captcha_verify_submit',
      '.secsdk-captcha-submit-button',
    ];

    for (const confirmSelector of confirmSelectors) {
      try {
        const confirmButton = await page.$(confirmSelector);
        if (!confirmButton) continue;

        const isVisible = await confirmButton.isVisible().catch(() => false);
        const isEnabled = await confirmButton.isEnabled().catch(() => false);

        if (isVisible && isEnabled) {
          this.logger.log(
            `CAPTCHA solved, clicking confirm button (${confirmSelector})...`,
          );

          // Take screenshot before clicking
          await page.screenshot({
            path: path.join(
              this.screenshotsDir,
              `before-confirm-${Date.now().toString()}.png`,
            ),
          });

          // Click the button
          await confirmButton.click();

          // Wait longer for any verification forms to appear
          await page.waitForTimeout(4000);

          // Check multiple times for email verification as it might appear with delay
          for (let i = 0; i < 3; i++) {
            if (await this.checkEmailVerification(page)) {
              this.logger.log(
                'Email verification form detected after CAPTCHA',
                {
                  attempt: i,
                },
              );
              return true;
            }
            await page.waitForTimeout(1000);
          }

          // Then check if CAPTCHA is gone
          const captchaStillPresent = await page.$(selector).catch(() => null);
          if (!captchaStillPresent) {
            // Even if captcha is gone, wait and check for email verification again
            await page.waitForTimeout(2000);
            if (await this.checkEmailVerification(page)) {
              this.logger.log(
                'Email verification form detected after CAPTCHA disappeared',
              );
              return true;
            }
            this.logger.log('CAPTCHA verification completed successfully');
            return true;
          }

          // Check if page URL changed (sometimes indicates success)
          const currentUrl = page.url();
          if (!currentUrl.includes('captcha')) {
            // Even if URL changed, check for email verification
            if (await this.checkEmailVerification(page)) {
              this.logger.log(
                'Email verification form detected after URL change',
              );
              return true;
            }
            this.logger.log(
              'Page URL changed after CAPTCHA - assuming success',
            );
            return true;
          }
        }
      } catch (error) {
        this.logger.warn('Failed to click confirm button:', {
          selector: confirmSelector,
          error: (error as Error).message,
        });
      }
    }

    // Final check - if the page has navigated or captcha is no longer visible
    try {
      const finalCheck = await page.$(selector);
      if (!finalCheck) {
        this.logger.log('CAPTCHA no longer present - assuming success');
        return true;
      }

      const isVisible = await finalCheck.isVisible().catch(() => false);
      if (!isVisible) {
        this.logger.log('CAPTCHA no longer visible - assuming success');
        return true;
      }
    } catch (error) {
      // If error occurs during check, it might mean the element is gone
      this.logger.log('Error checking captcha element - it may be gone');
      return true;
    }

    this.logger.warn('Could not confirm CAPTCHA solution');
    return false;
  }

  /**
   * Check for email verification form
   * @param page - Playwright page object
   * @returns Promise<boolean> - Whether email verification form is present
   */
  private async checkEmailVerification(page: Page): Promise<boolean> {
    const emailSelectors = [
      'div.tiktokads-common-login-code-form-item',
      '#TikTok_Ads_SSO_Login_Code_FormItem',
      'input[name="code"][placeholder="Enter verification code"]',
    ];

    for (const selector of emailSelectors) {
      const element = await page.$(selector).catch(() => null);
      if (element) {
        const isVisible = await element.isVisible().catch(() => false);
        if (isVisible) return true;
      }
    }

    return false;
  }

  /**
   * Gets a solution from the SadCaptcha API
   * @param imageBase64 Base64-encoded image data
   * @returns Promise resolving to SadCaptcha response
   */
  private async getSolution(
    imageBase64: string,
  ): Promise<SadCaptchaResponse | null> {
    try {
      const response = await axios.post<SadCaptchaResponse>(
        `${this.baseUrl}/shapes`,
        { imageB64: imageBase64 },
        {
          params: {
            licenseKey: this.apiKey,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error('Error getting captcha solution:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Ensures that a directory exists, creating it if necessary
   * @param directory Directory path
   */
  private ensureDirectoryExists(directory: string): void {
    try {
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
        this.logger.log(`Created directory: ${directory}`);
      }
    } catch (error) {
      this.logger.error(`Error creating directory ${directory}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
