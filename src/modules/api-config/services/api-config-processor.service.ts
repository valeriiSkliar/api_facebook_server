import { Injectable, Logger } from '@nestjs/common';
import { BrowserPoolService } from '@src/core';
import { TabManager } from '@src/core';
import { ApiConfigLifecycleManager } from './api-config-lifecycle-manager.service';
import { ApiConfigStorageService } from './api-config-storage.service';
import { IntegratedRequestCaptureService } from '@src/services';
import { ApiConfigData } from '../interfaces/api-config.interface';

@Injectable()
export class ApiConfigProcessor {
  private readonly logger = new Logger(ApiConfigProcessor.name);
  private readonly requestCaptureService: IntegratedRequestCaptureService;
  private readonly targetEndpoints = [
    '/api/creative_center/com/popular/search/list/',
    '/api/creative_center/com/popular/search/list/get/',
    '/api/creative_center/com/popular/category/list/',
  ];

  constructor(
    private readonly browserPoolService: BrowserPoolService,
    private readonly tabManager: TabManager,
    private readonly lifecycleManager: ApiConfigLifecycleManager,
    private readonly storageService: ApiConfigStorageService,
  ) {
    this.requestCaptureService = new IntegratedRequestCaptureService(
      this.logger,
    );
  }

  /**
   * Обрабатывает аккаунт для получения API-конфигураций
   * @param accountId ID аккаунта TikTok
   * @param sessionData Данные сессии
   * @returns true если обработка успешна, false в противном случае
   */
  async processAccount(accountId: number, sessionData: any): Promise<boolean> {
    // try {
    //   this.logger.log(
    //     `Processing account ${accountId} to capture API configurations`,
    //   );
    //   // Получаем браузер из пула
    //   const browser = await this.browserPoolService.getBrowser();
    //   if (!browser) {
    //     this.logger.error('Failed to get browser from pool');
    //     return false;
    //   }
    //   // Создаем новую вкладку с сессией аккаунта
    //   const tab = await this.tabManager.createTabWithSession(
    //     browser,
    //     sessionData.cookies,
    //     sessionData.localStorage || {},
    //     sessionData.sessionStorage || {},
    //   );
    //   if (!tab) {
    //     this.logger.error('Failed to create tab with session');
    //     return false;
    //   }
    //   // Настраиваем перехват запросов
    //   await this.setupRequestInterception(tab, accountId);
    //   try {
    //     // Переходим на страницу TikTok Creative Center
    //     await tab.goto('https://www.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en', {
    //       waitUntil: 'networkidle2',
    //       timeout: 60000,
    //     });
    //     // Ждем загрузки страницы
    //     await tab.waitForSelector('.creative-center-container', {
    //       timeout: 30000,
    //     });
    //     // Выполняем действия для вызова API-запросов
    //     await this.performActionsToTriggerApiRequests(tab);
    //     // Ждем некоторое время для перехвата запросов
    //     await new Promise((resolve) => setTimeout(resolve, 5000));
    //     this.logger.log(
    //       `Captured ${this.requestCaptureService.getCapturedRequestsCount()} API requests for account ${accountId}`,
    //     );
    //     return true;
    //   } catch (error) {
    //     this.logger.error(
    //       `Error during API configuration capture for account ${accountId}: ${
    //         error instanceof Error ? error.message : String(error)
    //       }`,
    //     );
    //     return false;
    //   } finally {
    //     // Закрываем вкладку
    //     await this.tabManager.closeTab(tab);
    //   }
    // } catch (error) {
    //   this.logger.error(
    //     `Failed to process account ${accountId}: ${
    //       error instanceof Error ? error.message : String(error)
    //     }`,
    //   );
    //   return false;
    // }
    return new Promise<boolean>((resolve) => {
      resolve(true);
    });
  }

  /**
   * Настраивает перехват запросов
   * @param tab Вкладка браузера
   * @param accountId ID аккаунта TikTok
   */
  private async setupRequestInterception(
    tab: any,
    accountId: number,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      resolve();
    });
  }

  /**
   * Выполняет действия для вызова API-запросов
   * @param tab Вкладка браузера
   */
  private async performActionsToTriggerApiRequests(tab: any): Promise<void> {
    try {
      // Прокручиваем страницу для загрузки контента
      await this.scrollPage(tab);

      // Кликаем на различные категории для вызова API-запросов
      await this.clickOnCategories(tab);

      // Выполняем поиск для вызова API-запросов поиска
      await this.performSearch(tab);
    } catch (error) {
      this.logger.error(
        `Error performing actions to trigger API requests: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  /**
   * Прокручивает страницу для загрузки контента
   * @param tab Вкладка браузера
   */
  private async scrollPage(tab: any): Promise<void> {
    try {
      // Прокручиваем страницу несколько раз с паузами
      for (let i = 0; i < 5; i++) {
        await tab.evaluate(() => {
          window.scrollBy(0, 500);
        });

        // Пауза между прокрутками
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      this.logger.error(
        `Error scrolling page: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Кликает на различные категории для вызова API-запросов
   * @param tab Вкладка браузера
   */
  private async clickOnCategories(tab: any): Promise<void> {
    // try {
    //   // Ждем появления категорий
    //   await tab.waitForSelector('.category-item', { timeout: 10000 });
    //   // Получаем список категорий
    //   const categories = await tab.$$('.category-item');
    //   // Кликаем на первые 3 категории (или меньше, если их меньше 3)
    //   const maxCategories = Math.min(3, categories.length);
    //   for (let i = 0; i < maxCategories; i++) {
    //     await categories[i].click();
    //     // Ждем загрузки данных
    //     await new Promise((resolve) => setTimeout(resolve, 2000));
    //   }
    // } catch (error) {
    //   this.logger.error(
    //     `Error clicking on categories: ${
    //       error instanceof Error ? error.message : String(error)
    //     }`,
    //   );
    // }
  }

  /**
   * Выполняет поиск для вызова API-запросов поиска
   * @param tab Вкладка браузера
   */
  private async performSearch(tab: any): Promise<void> {
    // try {
    //   // Ждем появления поля поиска
    //   await tab.waitForSelector('.search-input', { timeout: 10000 });
    //   // Вводим текст в поле поиска
    //   await tab.type('.search-input', 'trending');
    //   // Нажимаем Enter для выполнения поиска
    //   await tab.keyboard.press('Enter');
    //   // Ждем загрузки результатов поиска
    //   await new Promise((resolve) => setTimeout(resolve, 3000));
    // } catch (error) {
    //   this.logger.error(
    //     `Error performing search: ${
    //       error instanceof Error ? error.message : String(error)
    //     }`,
    //   );
    // }
  }
}
