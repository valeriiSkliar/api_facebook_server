import { RequestMetadata } from '@src/api/requests/request-manager-service';
import { ScraperResult } from '@src/scrapers/facebook/models/facebook-scraper-result';

export interface IScraper {
  /**
   * Основной метод для запуска процесса скрапинга.
   * @param request - Метаданные запроса, содержащие параметры и тип.
   * @returns Promise, разрешающийся результатом скрапинга.
   */
  scrape(request: RequestMetadata): Promise<ScraperResult>;
}
