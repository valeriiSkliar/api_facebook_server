import { Page } from 'playwright';
import { Logger } from '@nestjs/common';
import { AuthStepType, IAuthenticationStep } from '@src/interfaces';

export class CookieConsentStep implements IAuthenticationStep {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  getName(): string {
    return 'Cookie Consent';
  }

  getType(): AuthStepType {
    return AuthStepType.LOGIN;
  }

  shouldExecute(): boolean {
    return true;
  }

  async execute(page: Page): Promise<boolean> {
    try {
      this.logger.log('Handling cookie consent banner');

      const cookieBannerSelector = 'div.tiktok-cookie-banner';
      const allowButtonSelector = 'button:has-text("Allow all")';

      await page.waitForTimeout(2000);

      // First check if the cookie banner exists at all
      const cookieBanner = await page.$(cookieBannerSelector);

      // If no cookie banner is found, it might be already accepted or not shown yet
      if (!cookieBanner) {
        this.logger.log('No cookie banner found - might be already accepted');
        return true;
      }

      this.logger.log('Cookie banner found, looking for Allow button');

      try {
        // Wait for the Allow button with a timeout
        const allowAllButton = await page.waitForSelector(
          `${cookieBannerSelector} ${allowButtonSelector}`,
          { timeout: 5000, state: 'visible' },
        );

        if (allowAllButton) {
          // Take a screenshot before clicking for debugging purposes
          await page.screenshot({
            path: 'storage/screenshots/before-cookie-consent.png',
          });

          this.logger.log('Clicking "Allow all" button');
          await allowAllButton.click();
          this.logger.log('Successfully clicked "Allow all" button');

          // Wait a moment for the banner to disappear and take another screenshot
          await page.waitForTimeout(2000);
          await page.screenshot({
            path: 'storage/screenshots/after-cookie-consent.png',
          });

          // Verify the banner disappeared
          const bannerAfterClick = await page.$(cookieBannerSelector);
          if (bannerAfterClick) {
            this.logger.warn(
              'Cookie banner still present after clicking "Allow all"',
            );
          } else {
            this.logger.log('Cookie banner successfully dismissed');
          }

          return true;
        }
      } catch (buttonError) {
        // If we can't find the allow button specifically, log it but don't fail
        this.logger.warn(
          'Could not find "Allow all" button in the cookie banner',
          {
            error:
              buttonError instanceof Error
                ? buttonError.message
                : String(buttonError),
          },
        );

        // Try to find any button in the cookie banner as a fallback
        const anyButton = await cookieBanner.$('button');
        if (anyButton) {
          this.logger.log(
            'Trying to click alternative button in cookie banner',
          );
          await anyButton.click();
          await page.waitForTimeout(2000);
        }

        // Even if we couldn't click a specific button, return success
        // as this is not critical to the main authentication flow
        return true;
      }

      // If we reach here, we found the banner but couldn't handle it properly
      this.logger.warn('Cookie banner handling completed with warns');
      return true;
    } catch (error: unknown) {
      // Take a screenshot to help debug the error state
      try {
        await page.screenshot({
          path: 'storage/screenshots/cookie-consent-error.png',
          fullPage: true,
        });
      } catch (screenshotError) {
        this.logger.error('Failed to take error screenshot', {
          error:
            screenshotError instanceof Error
              ? screenshotError.message
              : String(screenshotError),
        });
      }

      // Log detailed error information
      this.logger.error('Error handling cookie consent:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        url: page.url(),
      });
      // Not critical if this fails
      return true;
    }
  }
}
