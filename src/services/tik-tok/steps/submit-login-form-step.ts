import { Page } from 'playwright';
import { Logger } from '@nestjs/common';

import { Locator } from 'playwright';
import { AuthStepType } from '@src/interfaces';
import { IAuthenticationStep } from '@src/interfaces';
import { BrowserHelperService } from '@src/services/common';
import { AuthenticatorContext } from '@src/models';

export class SubmitLoginFormStep implements IAuthenticationStep {
  private logger: Logger;
  private browserHelper: BrowserHelperService;

  constructor(logger: Logger) {
    this.logger = logger;
    this.browserHelper = BrowserHelperService.getInstance();
  }

  getName(): string {
    return 'Submit Login Form';
  }

  getType(): AuthStepType {
    return AuthStepType.LOGIN;
  }

  // We need to keep the credentials parameter to match the interface
  async execute(context: AuthenticatorContext): Promise<boolean> {
    const page = context.state.page;
    if (!page) {
      this.logger.error('Page is not initialized');
      return false;
    }
    this.logger.log('Submitting login form...');

    try {
      // Find and click the login button - try multiple selectors with TikTok-specific ones first
      const loginButtonSelectors = [
        // Exact TikTok login button selector from the HTML
        '#TikTok_Ads_SSO_Login_Btn',
        'button[name="loginBtn"]',
        'button.btn.primary',
        // Other TikTok-specific selectors
        'button.tiktokads-common-login-form-submit',
        'button[data-e2e="login-button"]',
        'button[id*="TikTok_Ads_SSO_Login"]',
        // Generic selectors
        'button[type="submit"]',
        'button:has-text("Log in")',
        'button:has-text("Login")',
        'button:has-text("Sign In")',
        'button:has-text("Continue")',
        'button[class*="login"]',
        'button[class*="submit"]',
      ];

      let loginButtonLocator: Locator | null = null;
      for (const selector of loginButtonSelectors) {
        const button = page.locator(selector);
        const count = await button.count();
        if (count > 0) {
          loginButtonLocator = button.first(); // Use first() to handle multiple matches
          this.logger.log(
            `Found login button with selector: ${selector}, count: ${count}`,
          );
          break;
        }
      }

      if (!loginButtonLocator) {
        // Take a screenshot to help debug
        await page.screenshot({
          path: 'storage/screenshots/login-button-not-found.png',
        });

        this.logger.warn(
          'Could not find login button with predefined selectors. Trying to find any button...',
        );

        // Try to find any button
        const allButtons = page.locator('button');
        const count = await allButtons.count();

        if (count > 0) {
          // Use the last button as it's likely to be the submit button
          loginButtonLocator = allButtons.last();
          this.logger.log(
            `Using last button as login button (found ${count} buttons)`,
          );
        } else {
          throw new Error('Could not find any button for login submission');
        }
      }

      // Add a small delay before clicking to simulate human behavior
      await this.browserHelper.delay(
        this.browserHelper.randomBetween(500, 1500),
      );

      // Click the login button
      if (loginButtonLocator) {
        await loginButtonLocator.click();
        this.logger.log('Login form submitted');
      } else {
        throw new Error('Login button locator is null');
      }

      // Wait for navigation or response
      await this.browserHelper.delay(
        this.browserHelper.randomBetween(3000, 5000),
      );

      // Check for successful login
      return await this.checkLoginSuccess(page);
    } catch (error: unknown) {
      // Take a screenshot to help debug
      await page.screenshot({
        path: 'storage/screenshots/login-submission-error.png',
      });
      this.logger.error('Error submitting login form', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Checks if the login was successful
   * @param page - Playwright page object
   * @returns Promise resolving to boolean indicating login success
   */
  private async checkLoginSuccess(page: Page): Promise<boolean> {
    // Method 1: Check for user avatar which is typically visible after login
    const avatarSelectors = [
      'img[data-e2e="user-avatar"]',
      '.tiktok-avatar',
      'img[class*="avatar"]',
      'div[class*="avatar"]',
      // Additional TikTok-specific selectors for logged-in state
      '.user-info',
      '.user-profile',
      '.account-info',
    ];

    let isAvatarVisible = false;
    for (const selector of avatarSelectors) {
      isAvatarVisible = await page.isVisible(selector).catch(() => false);
      if (isAvatarVisible) {
        this.logger.log(`Found avatar/user info with selector: ${selector}`);
        break;
      }
    }

    // Method 2: Check for login error messages
    const errorSelectors = [
      '.login-error',
      '.error-message',
      'div[class*="error"]',
      'span[class*="error"]',
      'p:has-text("incorrect")',
      'p:has-text("Invalid")',
      // TikTok-specific error selectors
      '.tiktokads-common-login-form-error',
      '[data-e2e="login-error"]',
    ];

    let isErrorVisible = false;
    let errorText = '';
    for (const selector of errorSelectors) {
      isErrorVisible = await page.isVisible(selector).catch(() => false);
      if (isErrorVisible) {
        errorText = (await page.textContent(selector)) || 'Unknown error';
        this.logger.log(`Found error message: ${errorText}`);
        break;
      }
    }

    // Method 3: Check URL for successful redirect
    const currentUrl = page.url();
    const isRedirectedToHome =
      currentUrl.includes('/home') ||
      currentUrl.includes('/dashboard') ||
      !currentUrl.includes('/login');

    // Take a screenshot to help debug
    await page.screenshot({
      path: 'storage/screenshots/login-result.png',
    });

    if (isAvatarVisible || isRedirectedToHome) {
      this.logger.log('Login successful!');
      return true;
    } else if (isErrorVisible) {
      this.logger.error(`Login failed: ${errorText}`);
      return false;
    } else {
      this.logger.warn('Login status unclear. Please check the screenshots.');
      return false;
    }
  }
}
