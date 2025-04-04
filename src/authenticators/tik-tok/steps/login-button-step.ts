import { Logger } from '@nestjs/common';
import { AuthenticatorContext } from '@src/authenticators/common/models/authenticator-context';
import { AuthStepType } from '@src/interfaces';
import { IAuthenticationStep } from '@src/interfaces';

export class LoginButtonStep implements IAuthenticationStep {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  getName(): string {
    return 'Login Button Click';
  }

  getType(): AuthStepType {
    return AuthStepType.LOGIN;
  }

  async execute(context: AuthenticatorContext): Promise<boolean> {
    const page = context.state.page;
    if (!page) {
      this.logger.error('Page is not initialized');
      return false;
    }
    this.logger.log('Attempting to click on login button');
    try {
      // Wait for the login button to be visible
      await page.waitForSelector('div[data-testid="cc_header_login"]', {
        timeout: 10000,
      });

      // Find the login button using the data-testid attribute
      const loginButton = page.locator('div[data-testid="cc_header_login"]');

      // Check if the button exists and click it
      if ((await loginButton.count()) > 0) {
        this.logger.log('Clicking login button');
        await loginButton.click();
        this.logger.log('Successfully clicked login button');

        // Wait a moment for the login page/modal to load
        // await page.waitForTimeout(3000);
      } else {
        // Try alternative selector if the first one doesn't work
        const altLoginButton = page.locator(
          'div.FixedHeaderPc_loginBtn__lL73Y',
        );

        if ((await altLoginButton.count()) > 0) {
          this.logger.log('Clicking login button (using alternative selector)');
          await altLoginButton.click();
          this.logger.log('Successfully clicked login button');

          // Wait a moment for the login page/modal to load
          await page.waitForTimeout(3000);
        } else {
          this.logger.warn('Could not find login button');
          return false;
        }
      }

      return true;
    } catch (error: unknown) {
      // Take a screenshot to help debug
      await page.screenshot({
        path: 'storage/screenshots/login-button-error.png',
      });
      this.logger.error('Error clicking login button:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
