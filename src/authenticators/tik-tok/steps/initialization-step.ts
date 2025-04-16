import { Logger } from '@nestjs/common';
import { AuthenticatorContext } from '@src/authenticators/common/models/authenticator-context';
import { AuthStepType } from '@src/scrapers/common/interfaces';
import { IAuthenticationStep } from '@src/scrapers/common/interfaces';

export class InitializationStep implements IAuthenticationStep {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  getType(): AuthStepType {
    return AuthStepType.PRE_SESSION;
  }

  getName(): string {
    return 'Initialization';
  }

  async execute(context: AuthenticatorContext): Promise<boolean> {
    this.logger.log('Initializing TikTok authentication');

    try {
      // Проверяем наличие браузера и страницы
      if (!context.state.browser) {
        this.logger.error('Browser not found in context');
        return false;
      }

      if (!context.state.page) {
        this.logger.error('Page not found in context');
        return false;
      }

      const page = context.state.page;

      // Проверяем состояние страницы
      if (page.isClosed()) {
        this.logger.error('Page is closed');
        return false;
      }

      // Устанавливаем размер viewport
      try {
        await page.setViewportSize(
          context.options.browser?.viewport || { width: 1280, height: 800 },
        );
        this.logger.log('Viewport size set successfully');
      } catch (vpError) {
        this.logger.error('Failed to set viewport size', {
          error: vpError instanceof Error ? vpError.message : String(vpError),
        });
        return false;
      }

      // Проверяем доступность страницы
      try {
        await page.evaluate(() => document.readyState);
        this.logger.log('Page is accessible');
      } catch (evalError) {
        this.logger.error('Page is not accessible', {
          error:
            evalError instanceof Error ? evalError.message : String(evalError),
        });
        return false;
      }

      context.state.externalBrowser = true;
      this.logger.log('Initialization completed successfully');
      return true;
    } catch (error) {
      this.logger.error('Initialization failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
