// src/auth/implementations/steps/EmailVerificationStep.ts

import { Page } from 'playwright';
import { Logger } from '@nestjs/common';

import { BrowserHelperService } from '@src/core/browser/helpers';
import { AuthenticatorContext } from '@src/authenticators/common/models/authenticator-context';
import { AuthCredentials } from '@src/authenticators/common/models/auth-credentials';
import { AuthStepType } from '@src/scrapers/common/interfaces';
import { IAuthenticationStep } from '@src/scrapers/common/interfaces';
import { EmailService } from '@src/services/tik-tok';

export class EmailVerificationStep implements IAuthenticationStep {
  private readonly logger: Logger;
  private readonly emailService: EmailService;
  private readonly browserHelper: BrowserHelperService;
  private readonly maxRetries: number = 3;

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

      const isVerificationRequired =
        await this.isEmailVerificationRequired(page);

      if (!isVerificationRequired) {
        this.logger.log('No email verification required');
        return true;
      }

      this.logger.log('Email verification required, waiting for code...');

      if (!credentials?.email) {
        this.logger.error('No email provided in credentials');
        return false;
      }

      let retryCount = 0;
      let lastError: Error | null = null;

      while (retryCount < this.maxRetries) {
        try {
          // Wait for the verification code
          const code = await this.emailService.waitForVerificationCode(
            credentials.email,
            120000, // 2 minutes timeout
            10000, // Poll every 10 seconds
          );

          if (!code) {
            this.logger.warn(
              `Failed to get verification code (attempt ${retryCount + 1}/${this.maxRetries})`,
            );
            retryCount++;
            continue;
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
          lastError = error instanceof Error ? error : new Error(String(error));
          this.logger.error(
            `Error during verification attempt ${retryCount + 1}:`,
            {
              error: lastError.message,
              stack: lastError.stack,
            },
          );
          retryCount++;
        }
      }

      this.logger.error('All verification attempts failed', {
        attempts: retryCount,
        lastError: lastError?.message,
      });
      return false;
    } catch (error) {
      this.logger.error('Error during email verification:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  }

  private async isEmailVerificationRequired(page: Page): Promise<boolean> {
    const verificationSelectors = [
      'div.tiktokads-common-login-code-form',
      'input[placeholder="Enter verification code"]',
      'div:has-text("Verification code")',
      'div:has-text("For security reasons, a verification code has been sent to")',
      '#TikTok_Ads_SSO_Login_Code_Content',
      'div[class*="verification-code"]',
      'div[class*="verification_code"]',
      'div[class*="verificationCode"]',
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
      } catch (error) {
        this.logger.debug('Error checking selector:', {
          selector,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return false;
  }

  private async enterVerificationCode(
    page: Page,
    code: string,
  ): Promise<boolean> {
    try {
      const codeInputSelector =
        'input[name="code"], input[placeholder="Verification code"], input[placeholder="Enter verification code"], input.verification-code-input, #TikTok_Ads_SSO_Code_Code_Input, #TikTok_Ads_SSO_Login_Code_Input, input[class*="verification-code"], input[class*="verification_code"]';

      const inputExists = await page.evaluate(
        ({ selector, codeValue }) => {
          const inputs = Array.from(document.querySelectorAll(selector));

          let input = inputs.find((el) => {
            const rect = el.getBoundingClientRect();
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              window.getComputedStyle(el).display !== 'none'
            );
          }) as HTMLInputElement;

          if (!input && inputs.length > 0) {
            input = inputs[0] as HTMLInputElement;
          }

          if (input) {
            input.value = codeValue;
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

      const submitButtonSelector =
        'button[name="CodeloginBtn"], #TikTok_Ads_SSO_Login_Code_Btn, button.btn.primary, button[class*="submit"], button[class*="verify"], button[type="submit"]';

      const submitClicked = await page.evaluate(
        ({ selector }) => {
          const buttons = Array.from(document.querySelectorAll(selector));

          let button = buttons.find((el) => {
            const rect = el.getBoundingClientRect();
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              window.getComputedStyle(el).display !== 'none'
            );
          }) as HTMLButtonElement;

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
        this.logger.log('Could not find submit button, trying Enter key');
        await page.keyboard.press('Enter');
      } else {
        this.logger.log('Successfully clicked submit button');
      }

      return true;
    } catch (error) {
      this.logger.error('Error entering verification code:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  }

  private async waitForVerificationResult(page: Page): Promise<void> {
    try {
      await Promise.race([
        page.waitForNavigation({ timeout: 30000 }).catch(() => {
          this.logger.log('No navigation detected after submit');
        }),
        page
          .waitForSelector('div:has-text("Verification successful")', {
            timeout: 30000,
          })
          .catch(() => {
            this.logger.log('No success message detected');
          }),
        page
          .waitForSelector('div:has-text("Invalid verification code")', {
            timeout: 30000,
          })
          .catch(() => {
            this.logger.log('No error message detected');
          }),
      ]);

      await page.waitForTimeout(5000);
    } catch (error) {
      this.logger.error('Error waiting for verification result:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }
}
