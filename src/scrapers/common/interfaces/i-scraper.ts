import { RequestMetadata } from '@src/api/requests/request-manager-service';
import { IBaseScraperResult } from './base-scraper-result';

// /**
//  * Определяет структуру результата работы скрапера.
//  */
// export interface ScraperResult {
//   /** Флаг успешности выполнения операции скрапинга. */
//   success: boolean;
//   /** Собранные данные. Тип может быть уточнен. */
//   data?: any; // TODO: Уточнить тип данных или использовать union type
//   /** Информация об ошибке, если операция не удалась. */
//   error?: string | object;
//   /** Путь к файлу, в который могли быть сохранены результаты (например, для больших объемов данных). */
//   outputPath?: string;
//   /** Количество успешно собранных элементов. */
//   count?: number;
// }

/**
 * Интерфейс для реализации скрапера.
 */

export interface IScraper<T = unknown, R = unknown> {
  /**
   * Основной метод для запуска процесса скрапинга.
   * @param request - Метаданные запроса, содержащие параметры и тип.
   * @returns Promise, разрешающийся результатом скрапинга.
   */
  scrape(request: RequestMetadata<T>): Promise<IBaseScraperResult<R>>;
}
