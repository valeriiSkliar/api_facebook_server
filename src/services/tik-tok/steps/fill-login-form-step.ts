import { Logger } from '@nestjs/common';

import { Locator } from 'playwright';
import { AuthStepType } from '@src/interfaces';
import { IAuthenticationStep } from '@src/interfaces';
import { BrowserHelperService } from '@src/core/browser/helpers';
import { AuthCredentials, AuthenticatorContext } from '@src/models';

export class FillLoginFormStep implements IAuthenticationStep {
  private readonly logger: Logger;
  private readonly browserHelper: BrowserHelperService;

  constructor(logger: Logger) {
    this.logger = logger;
    this.browserHelper = BrowserHelperService.getInstance();
  }

  getName(): string {
    return 'Fill Login Form';
  }

  getType(): AuthStepType {
    return AuthStepType.LOGIN;
  }

  async execute(
    context: AuthenticatorContext,
    credentials: AuthCredentials,
  ): Promise<boolean> {
    const page = context.state.page;
    const { email, password } = credentials;
    if (!page) {
      this.logger.error('Page is not initialized');
      return false;
    }
    if (!email || !password) {
      this.logger.error('Missing credentials for login form');
      return false;
    }

    this.logger.log('Filling in login form with email and password');
    try {
      // Wait for the login form to be visible - try multiple possible selectors
      const formSelectors: string[] = [
        'div.tiktokads-common-login-form',
        'form[class*="login"]',
        'div[class*="login-form"]',
        'div[class*="login_form"]',
        'div.login-container',
      ];

      let formFound = false;
      for (const selector of formSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 1000 });
          this.logger.log(`Login form found with selector: ${selector}`);
          formFound = true;
          break;
        } catch (error: unknown) {
          this.logger.debug(
            `Could not find login form with selector ${selector}: ${error instanceof Error ? error.message : String(error)}`,
          );
          // Continue trying other selectors
        }
      }

      if (!formFound) {
        // Take a screenshot to help debug
        await page.screenshot({
          path: 'storage/screenshots/login-form-not-found.png',
        });
        this.logger.warn(
          'Could not find login form with predefined selectors. Continuing anyway...',
        );
      }

      // Try multiple selectors for email input
      const emailSelectors: string[] = [
        '#TikTok_Ads_SSO_Login_Email_Input',
        'input[type="email"]',
        'input[name="email"]',
        'input[placeholder*="Email"]',
        'input[placeholder*="email"]',
        'input[class*="email"]',
      ];

      let emailInput: Locator | null = null;
      for (const selector of emailSelectors) {
        const input = page.locator(selector);
        if ((await input.count()) > 0) {
          emailInput = input.first(); // Use first() to handle multiple matches
          this.logger.log(`Found email input with selector: ${selector}`);
          break;
        }
      }

      if (!emailInput) {
        // Try a more general approach - find all inputs and use the first one
        const allInputs = page.locator('input');
        const count = await allInputs.count();

        if (count > 0) {
          emailInput = allInputs.first();
          this.logger.log('Using first input field as email input');
        } else {
          throw new Error('Could not find any input field for email');
        }
      }

      // Click on the email input field (like a human would)
      await emailInput.click();

      // Add a small random delay to simulate human thinking
      await page.waitForTimeout(this.browserHelper.randomBetween(100, 500));

      // Type the email address with human-like typing speed
      await this.browserHelper.typeWithHumanDelay(
        page,
        emailInput,
        credentials.email,
      );

      this.logger.log('Email entered');

      // Add a delay between filling email and password (like a human would)
      await page.waitForTimeout(this.browserHelper.randomBetween(100, 500));

      // Try the specific password selector first, then fall back to more general ones
      const passwordSelectors: string[] = [
        // Specific TikTok password input selector
        '#TikTok_Ads_SSO_Login_Pwd_Input',
        '.tiktokads-common-login-form-password',
        'input[type="password"]',
        'input[name="password"]',
        'input[placeholder*="Password"]',
        'input[placeholder*="password"]',
        'input[class*="password"]',
      ];

      let passwordInput: Locator | null = null;
      for (const selector of passwordSelectors) {
        const input = page.locator(selector);
        const count = await input.count();
        if (count > 0) {
          // If there are multiple password fields, use the first one
          this.logger.log(
            `Found ${count} password inputs with selector: ${selector}, using the first one`,
          );
          passwordInput = input.first(); // Use first() to handle multiple matches
          break;
        }
      }

      if (!passwordInput) {
        // If we can't find a password field, try using the second input field
        const allInputs = page.locator('input');
        const count = await allInputs.count();

        if (count > 1) {
          passwordInput = allInputs.nth(1);
          this.logger.log('Using second input field as password input');
        } else {
          throw new Error('Could not find password input field');
        }
      }

      // Click on the password field
      await passwordInput.click();

      // Add a small random delay
      await page.waitForTimeout(this.browserHelper.randomBetween(100, 500));

      // Type the password with human-like typing speed
      await this.browserHelper.typeWithHumanDelay(
        page,
        passwordInput,
        credentials.password,
      );

      this.logger.log('Password entered');

      // Add a delay before proceeding (like a human would review their input)
      await page.waitForTimeout(this.browserHelper.randomBetween(100, 500));

      return true;
    } catch (error: unknown) {
      // Take a screenshot to help debug
      await page.screenshot({
        path: 'storage/screenshots/login-form-error.png',
      });
      this.logger.error('Error filling login form:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
