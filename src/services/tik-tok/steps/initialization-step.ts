import { AuthStepType, IAuthenticationStep } from '@src/interfaces';
import { AuthenticatorContext } from '@src/models';
import { Logger } from '@nestjs/common';

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

    // Проверяем, что браузер и страница уже есть в контексте
    if (context.state.browser && context.state.page) {
      this.logger.log('Using existing browser and page from context');

      const page = context.state.page;
      try {
        if (!page || page.isClosed()) {
          throw new Error('Page not found or is closed');
        }

        await page.setViewportSize(
          context.options.browser?.viewport || { width: 1280, height: 800 },
        );

        this.logger.log('Successfully initialized existing page');
      } catch (vpError: unknown) {
        const errorMessage =
          vpError instanceof Error ? vpError.message : 'Unknown error';
        this.logger.warn(
          `[InitializationStep.execute] Could not set viewport: ${errorMessage}`,
        );

        // Не будем пытаться создать новый браузер в этом шаге
        return false;
      }

      // Помечаем как внешние компоненты только если они валидны
      if (
        context.state.browser &&
        context.state.page &&
        !context.state.page.isClosed()
      ) {
        context.state.externalBrowser = true;
        return true;
      }
    } else {
      // Если браузер или страница отсутствуют в контексте, просто логируем это
      this.logger.warn(
        '[InitializationStep.execute] No browser or page available in context. This step expects them to be created previously.',
      );
      return false;
    }

    return false;
  }
}
