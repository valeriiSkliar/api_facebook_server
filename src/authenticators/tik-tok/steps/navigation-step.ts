import { AuthStepType, IAuthenticationStep } from '@src/interfaces';
import { Logger } from '@nestjs/common';
import { AuthenticatorContext } from '@src/authenticators/common/models/authenticator-context';

export class NavigationStep implements IAuthenticationStep {
  constructor(private readonly logger: Logger) {}

  getType(): AuthStepType {
    return AuthStepType.PRE_SESSION;
  }
  getName(): string {
    return 'Navigation';
  }
  async execute(
    context: AuthenticatorContext,
    // credentials?: AuthCredentials,
  ): Promise<boolean> {
    const page = context.state.page;
    if (!page) {
      this.logger.error('Page not found in NavigationStep');
      throw new Error('Page not found');
    }

    this.logger.log(`Navigating to TikTok creative center page`);

    try {
      // Настройка таймаута навигации (30 секунд)
      await page.goto(
        'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en',
        { waitUntil: 'networkidle', timeout: 30000 },
      );

      // Проверяем, что страница загрузилась успешно
      const pageTitle = await page.title();
      this.logger.log(
        `Successfully navigated to page with title: ${pageTitle}`,
      );

      // Даем странице время для загрузки скриптов и инициализации
      await page.waitForTimeout(2000);

      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Navigation to TikTok page failed: ${errorMessage}`);
      throw error;
    }
  }
}
