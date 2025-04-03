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
  async execute(
    context: AuthenticatorContext,
    // credentials?: AuthCredentials,
  ): Promise<boolean> {
    this.logger.log('Initializing TikTok authentication');
    if (context.state.browser && context.state.page) {
      const page = context.state.page;
      try {
        if (!page) {
          throw new Error('Page not found');
        }
        await page.setViewportSize(
          context.options.browser?.viewport || { width: 1280, height: 800 },
        );
      } catch (vpError: unknown) {
        // Логгируем ошибку, если страница могла быть закрыта
        this.logger.warn(
          `[InitializationStep.execute] Could not set viewport, page might be closed: ${vpError instanceof Error ? vpError.message : 'Unknown error'}`,
        );
        // Возможно, стоит выбросить ошибку, если страница обязательна
        if (context.state.page && !context.state.page.isClosed()) throw vpError;
      }
      context.state.externalBrowser = true; // Помечаем как внешние
      return true;
    }
    // СЛУЧАЙ 3: Ничего не предоставлено - запускаем новый браузер и страницу
    this.logger.log(
      '[InitializationStep.execute] No external browser/page. Launching new browser.',
    );
    const browser = await launchPlaywright({
      launchOptions: {
        /* ... ваши опции ... */
      },
    });
    const page = await browser.newPage();
    await page.setViewportSize(
      context.options.browser?.viewport || { width: 1280, height: 800 },
    );

    context.state.browser = browser;
    context.state.page = page;
    context.state.externalBrowser = false; // Управляется этим пайплайном
    return true;
  }
}
