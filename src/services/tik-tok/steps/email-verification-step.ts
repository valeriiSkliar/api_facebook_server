// src/auth/implementations/steps/EmailVerificationStep.ts

import { Page } from 'playwright';
import { Logger } from '@nestjs/common';

import { BrowserHelperService } from '@src/services/common';
import { AuthenticatorContext, AuthCredentials } from '@src/models';
import { AuthStepType } from '@src/interfaces';
import { IAuthenticationStep } from '@src/interfaces';
import { EmailService } from '@src/services/tik-tok';

export class EmailVerificationStep implements IAuthenticationStep {
  private readonly logger: Logger;
  private readonly emailService: EmailService;
  private readonly browserHelper: BrowserHelperService;

  constructor(logger: Logger, emailService: EmailService) {
    this.logger = logger;
    this.emailService = emailService;
    this.browserHelper = BrowserHelperService.getInstance();
  }

  getName(): string {
    return 'Email Verification';
  }

  getType(): AuthStepType {
    return AuthStepType.LOGIN;
  }

  async execute(
    context: AuthenticatorContext,
    credentials: AuthCredentials,
  ): Promise<boolean> {
    const page = context.state.page;
    if (!page) {
      this.logger.error('Page is not initialized');
      return false;
    }
    try {
      this.logger.log('Checking for email verification...');

      // Check if email verification is required
      const isVerificationRequired =
        await this.isEmailVerificationRequired(page);

      if (!isVerificationRequired) {
        this.logger.log('No email verification required');
        return true;
      }

      // Email verification is required, get the verification code
      this.logger.log('Email verification required, waiting for code...');

      if (!credentials?.email) {
        this.logger.error('No email provided in credentials');
        return false;
      }

      // Wait for the verification code
      const code = await this.emailService.waitForVerificationCode(
        credentials.email,
        60000, // 1 minute timeout
        5000, // Poll every 5 seconds
      );

      if (!code) {
        this.logger.error('Failed to get verification code');
        return false;
      }

      this.logger.log('Verification code received', { code });

      // Enter the verification code
      const codeEntered = await this.enterVerificationCode(page, code);
      if (!codeEntered) {
        this.logger.error('Failed to enter verification code');
        return false;
      }

      // Mark the code as used
      await this.emailService.markCodeAsUsed(code);

      // Wait for navigation or success indication
      await this.waitForVerificationResult(page);

      return true;
    } catch (error) {
      this.logger.error('Error during email verification:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Checks if email verification is required
   */
  private async isEmailVerificationRequired(page: Page): Promise<boolean> {
    const verificationSelectors = [
      'div.tiktokads-common-login-code-form',
      'input[placeholder="Enter verification code"]',
      'div:has-text("Verification code")',
      'div:has-text("For security reasons, a verification code has been sent to")',
      '#TikTok_Ads_SSO_Login_Code_Content',
    ];

    for (const selector of verificationSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            this.logger.log(
              `Email verification detected with selector: ${selector}`,
            );
            return true;
          }
        }
      } catch (error: unknown) {
        this.logger.debug('Error checking selector:', {
          selector,
          error: (error as Error).message,
        });
        // Continue checking other selectors
      }
    }

    return false;
  }

  /**
   * Enters the verification code into the form
   */
  private async enterVerificationCode(
    page: Page,
    code: string,
  ): Promise<boolean> {
    try {
      // Find the input field for the verification code
      const codeInputSelector =
        'input[name="code"], input[placeholder="Verification code"], input[placeholder="Enter verification code"], input.verification-code-input, #TikTok_Ads_SSO_Code_Code_Input, #TikTok_Ads_SSO_Login_Code_Input';

      // Try to find and interact with the input field
      const inputExists = await page.evaluate(
        ({ selector, codeValue }) => {
          const inputs = Array.from(document.querySelectorAll(selector));

          // Try to find visible inputs first
          let input = inputs.find((el) => {
            const rect = el.getBoundingClientRect();
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              window.getComputedStyle(el).display !== 'none'
            );
          }) as HTMLInputElement;

          // If no visible input, try any input
          if (!input && inputs.length > 0) {
            input = inputs[0] as HTMLInputElement;
          }

          if (input) {
            // Set the value directly
            input.value = codeValue;

            // Dispatch events to simulate user interaction
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));

            return true;
          }

          return false;
        },
        { selector: codeInputSelector, codeValue: code },
      );

      if (!inputExists) {
        this.logger.error(
          'Could not find or interact with verification code input',
        );
        return false;
      }

      this.logger.log('Successfully entered verification code');

      // Find and click the submit button
      const submitButtonSelector =
        'button[name="CodeloginBtn"], #TikTok_Ads_SSO_Login_Code_Btn, button.btn.primary';

      const submitClicked = await page.evaluate(
        ({ selector }) => {
          const buttons = Array.from(document.querySelectorAll(selector));

          // Try to find visible buttons first
          let button = buttons.find((el) => {
            const rect = el.getBoundingClientRect();
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              window.getComputedStyle(el).display !== 'none'
            );
          }) as HTMLButtonElement;

          // If no visible button, try any button
          if (!button && buttons.length > 0) {
            button = buttons[0] as HTMLButtonElement;
          }

          if (button) {
            button.click();
            return true;
          }

          return false;
        },
        { selector: submitButtonSelector },
      );

      if (!submitClicked) {
        // Try pressing Enter as a fallback
        this.logger.log('Could not find submit button, trying Enter key');
        await page.keyboard.press('Enter');
      } else {
        this.logger.log('Successfully clicked submit button');
      }

      return true;
    } catch (error) {
      this.logger.error('Error entering verification code:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Waits for the verification result
   */
  private async waitForVerificationResult(page: Page): Promise<void> {
    // Wait for navigation or success indicator
    await Promise.race([
      page.waitForNavigation({ timeout: 20000 }).catch(() => {
        this.logger.log('No navigation detected after submit');
      }),
      page
        .waitForSelector('div:has-text("Verification successful")', {
          timeout: 20000,
        })
        .catch(() => {
          this.logger.log('No success message detected');
        }),
    ]);

    // Wait for additional processing time
    await page.waitForTimeout(5000);
  }
}
