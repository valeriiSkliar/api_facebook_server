import { AuthStepType, IAuthenticationStep } from '@src/interfaces';
import { AuthenticatorContext } from '@src/models';
import { Logger } from '@nestjs/common';
import { launchPlaywright } from 'crawlee';

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

    // Случай 1: Браузер и страница уже есть в контексте
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
        // Если страница существует, но вызвала ошибку при настройке, выбрасываем исключение
        if (context.state.page && !context.state.page.isClosed()) throw vpError;

        // Если страница закрыта, продолжаем к запуску нового браузера
        this.logger.warn(
          'Page is closed, will attempt to create a new browser instance',
        );
        context.state.page = undefined;
        context.state.browser = undefined;
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
    }

    // Случай 2: Пустой контекст или невалидные компоненты - запускаем новый браузер
    this.logger.log(
      '[InitializationStep.execute] No external browser/page. Launching new browser.',
    );

    try {
      const browser = await launchPlaywright({
        launchOptions: {
          headless: context.options.browser?.headless !== false,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      });

      const page = await browser.newPage();
      await page.setViewportSize(
        context.options.browser?.viewport || { width: 1280, height: 800 },
      );

      context.state.browser = browser;
      context.state.page = page;
      context.state.externalBrowser = false; // Управляется этим пайплайном

      this.logger.log('Successfully launched new browser and created page');
      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to launch browser: ${errorMessage}`);
      throw error;
    }
  }
}
