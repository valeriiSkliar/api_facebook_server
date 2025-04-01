import { AbstractScraperStep } from '@src/interfaces/AbstractScraperStep';
import { ScraperContext } from '@src/models/ScraperContext';
import { launchPlaywright } from 'crawlee';
import { Logger } from '@nestjs/common';

// steps/InitializationStep.ts
export class InitializationStep extends AbstractScraperStep {
  constructor(name: string, logger: Logger) {
    super(name, logger);
  }

  async execute(context: ScraperContext): Promise<void> {
    // СЛУЧАЙ 1: Browser И Page предоставлены извне (например, из пула)
    if (context.state.browser && context.state.page) {
      this.logger.log(
        '[InitializationStep.execute] Using provided browser and page from context.',
      );
      // Убедимся, что viewport установлен (можно делать при создании page в LifecycleManager)
      try {
        await context.state.page.setViewportSize(
          context.options.browser?.viewport || { width: 1280, height: 800 },
        );
      } catch (vpError: unknown) {
        // Логгируем ошибку, если страница могла быть закрыта
        this.logger.warn(
          `[InitializationStep.execute] Could not set viewport, page might be closed: ${vpError instanceof Error ? vpError.message : 'Unknown error'}`,
        );
        // Возможно, стоит выбросить ошибку, если страница обязательна
        if (!context.state.page.isClosed()) throw vpError; // Перебрасываем, если страница еще открыта
      }
      context.state.externalBrowser = true; // Помечаем как внешние
      return; // Инициализация завершена успешно
    }

    // СЛУЧАЙ 2: Только Browser предоставлен (маловероятен для вашего потока, но для защиты)
    // Если этот блок вызывается - значит Page не была передана в контекст на предыдущем шаге!
    if (context.state.browser && !context.state.page) {
      this.logger.warn(
        '[InitializationStep.execute] External browser provided, BUT NO PAGE. Creating new page!',
      );
      // !!! Этот блок создает НОВУЮ страницу, которую вы хотите избежать !!!
      // Если вы всегда ожидаете и браузер, и страницу, здесь можно выбросить ошибку:
      // throw new Error("InitializationStep expected both browser and page in context, but page was missing.");

      // Или оставить текущую логику, если она нужна для других сценариев:
      const browserContext = await context.state.browser.newContext();
      const page = await browserContext.newPage();
      await page.setViewportSize(
        context.options.browser?.viewport || { width: 1280, height: 800 },
      );
      context.state.page = page; // Используется НОВАЯ страница
      context.state.externalBrowser = true;
      return;
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
  }

  async cleanup(context: ScraperContext): Promise<void> {
    // Закрываем только если ресурсы НЕ внешние
    if (context.state.browser && !context.state.externalBrowser) {
      if (context.options.behavior?.cleanUpTimeout) {
        // ... (логика ожидания)
      }
      this.logger.log('Closing internally managed browser and page.');
      await context.state.page?.close(); // Безопасно закрываем страницу
      await context.state.browser.close(); // Закрываем браузер
    } else {
      this.logger.log('Skipping cleanup for externally managed browser/page.');
      // Важно: Внешняя страница должна закрываться через BrowserPoolService.closeTab / TabManager.closeTab
    }
  }
}
