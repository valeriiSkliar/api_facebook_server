import { AxiosError } from 'axios';
import { ApiResponseAnalysis } from '../models/api-response-analysis';
import { ActionRecommendation } from '../models/action-recommendation';
import { ErrorStorage } from '@src/core/error-handling/storage/error-storage'; // Путь к классу
import { ApiErrorType } from '../models/api-error-type'; // Путь к enum
import { AbstractApiResponseAnalyzer } from './abstract-api-response-analyzer copy';

export class ApiResponseAnalyzer extends AbstractApiResponseAnalyzer {
  constructor(private readonly errorStorage: ErrorStorage) {
    super();
  }

  /**
   * Анализирует ответ API (или ошибку Axios) и классифицирует ошибку.
   * @param response - Ответ от Axios (может быть null при сетевой ошибке или таймауте до ответа).
   * @param error - Ошибка Axios (если запрос завершился неудачно).
   * @param materialId - Идентификатор материала (если применимо, например, в ProcessMaterialsStep).
   * @param endpoint - Запрашиваемый URL endpoint.
   * @param requestTimestamp - Время начала запроса.
   * @returns Объект ApiResponseAnalysis с результатами анализа.
   */
  analyzeResponse(
    // response: AxiosResponse | null,
    materialId: string | null, //  nullable
    error: AxiosError | null,
    endpoint: string,
    requestTimestamp: Date,
    statusCode?: number,
  ): ApiResponseAnalysis {
    const analysis: ApiResponseAnalysis = {
      materialId: materialId ?? 'N/A',
      timestamp: new Date(),
      endpoint: endpoint,
      isSuccess: false,
      statusCode: statusCode || 0,
      errorType: ApiErrorType.OTHER,
      errorMessage: error?.message || 'Unknown error',
    };
    return analysis;
    // Логика:
    // 1. Определить statusCode (из response или error.response).
    // 2. Определить isSuccess.
    // 3. Определить errorType (на основе statusCode, error.code, содержимого response.data.msg/code).
    // 4. Извлечь errorMessage.
    // 5. Собрать технические детали (headers, size, time).
    // 6. Сформировать responseSnippet.
    // ...
    // Пример определения типа ошибки:
    // let errorType: ApiErrorType = ApiErrorType.NONE;
    // let errorMessage: string = '';
    // let statusCode: number = response?.status ?? 0;
    // let isSuccess: boolean = false;
    // const responseTime = Date.now() - requestTimestamp.getTime();

    // if (error) {
    //   statusCode =
    //     error.response?.status ?? (error.code === 'ECONNABORTED' ? 408 : 0); // 408 Request Timeout
    //   errorMessage = error.message;
    //   if (error.response) {
    //     // Ошибка с ответом от сервера (4xx, 5xx)
    //     const responseData = error.response.data as {
    //       code?: number;
    //       msg?: string;
    //     };
    //     errorMessage = responseData?.msg || error.message;
    //     if (statusCode === 429 || responseData?.code === 429) {
    //       // TODO: Уточнить код rate limit
    //       errorType = ApiErrorType.RATE_LIMIT;
    //     } else if (
    //       statusCode === 403 ||
    //       statusCode === 401 ||
    //       responseData?.code === 40101
    //     ) {
    //       errorType = ApiErrorType.ACCESS_DENIED;
    //     } else if (statusCode === 404) {
    //       errorType = ApiErrorType.NOT_FOUND;
    //     } else {
    //       errorType = ApiErrorType.OTHER_SERVER_ERROR; // Можно добавить новый тип
    //     }
    //   } else if (error.request) {
    //     // Запрос был сделан, но ответ не получен (сеть, таймаут)
    //     if (error.code === 'ECONNABORTED') {
    //       errorType = ApiErrorType.TIMEOUT;
    //     } else {
    //       errorType = ApiErrorType.NETWORK;
    //     }
    //   } else {
    //     // Ошибка настройки запроса
    //     errorType = ApiErrorType.OTHER;
    //     errorMessage = `Request setup error: ${error.message}`;
    //   }
    // } else if (response) {
    //   // Успешный ответ (2xx), но может быть логическая ошибка API
    //   const responseData = response.data as {
    //     code?: number;
    //     msg?: string;
    //     data?: any;
    //   };
    //   statusCode = response.status;
    //   if (responseData.code !== 0 && responseData.code !== 200) {
    //     // Уточнить коды успеха TikTok
    //     isSuccess = false;
    //     errorType = ApiErrorType.LOGICAL_ERROR; // Новый тип? Или OTHER?
    //     errorMessage =
    //       responseData.msg ||
    //       `API returned non-zero code: ${responseData.code}`;
    //   } else if (
    //     !responseData.data &&
    //     response.config.method?.toUpperCase() !== 'HEAD'
    //   ) {
    //     // Проверяем наличие данных, если ожидались
    //     // Ответ успешен, но не содержит ожидаемых данных
    //     isSuccess = false; // Считать ли это успехом - зависит от контекста
    //     errorType = ApiErrorType.EMPTY_RESPONSE;
    //     errorMessage = 'API response data is empty or missing.';
    //   } else {
    //     isSuccess = true;
    //     errorType = ApiErrorType.NONE;
    //   }
    //   // Проверка на Malformed Response (если data не парсится или не соответствует схеме)
    //   // try { Zod/Yup validation... } catch { errorType = ApiErrorType.MALFORMED_RESPONSE; }
    // } else {
    //   // Не должно происходить, но для полноты
    //   errorType = ApiErrorType.UNKNOWN;
    //   errorMessage = 'Unknown state: No response and no error.';
    // }

    // const analysis: ApiResponseAnalysis = {
    //   materialId: materialId ?? 'N/A',
    //   timestamp: new Date(),
    //   endpoint: endpoint,
    //   requestUrl: error?.config?.url || response?.config?.url || endpoint, // Более точный URL
    //   isSuccess: isSuccess, // Используем переменную isSuccess вместо вычисления
    //   statusCode: statusCode,
    //   errorType: errorType,
    //   errorMessage: errorMessage.substring(0, 1000), // Ограничение длины
    //   responseHeaders: response?.headers as Record<string, string>,
    //   responseSize: response?.headers['content-length']
    //     ? parseInt(response.headers['content-length'], 10)
    //     : undefined,
    //   responseTime: responseTime,
    //   responseSnippet: response?.data
    //     ? JSON.stringify(response.data).substring(0, 500)
    //     : '', // Сокращенный JSON
    //   // attemptNumber: 0, // Будет установлено логикой повторов
    // };

    // // Сохраняем некритичные ошибки во временное хранилище
    // if (
    //   !analysis.isSuccess &&
    //   errorType !== ApiErrorType.ACCESS_DENIED &&
    //   errorType !== ApiErrorType.NOT_FOUND
    // ) {
    //   this.errorStorage.addError(analysis);
    // }

    // return analysis; // Рекомендация генерируется отдельно
  }

  /**
   * Генерирует рекомендации по корректировке стратегии запросов
   * на основе текущего анализа и недавней истории ошибок из ErrorStorage.
   * @param analysis - Результат анализа текущего ответа/ошибки.
   * @param currentAttempt - Номер текущей попытки (начиная с 1).
   * @param maxAttempts - Максимальное количество разрешенных попыток.
   * @returns Рекомендация по дальнейшим действиям.
   */
  generateActionRecommendation(
    analysis: ApiResponseAnalysis,
    currentAttempt: number,
    maxAttempts: number,
  ): ActionRecommendation {
    // Логика:
    // 1. Проверить, можно ли вообще повторять ошибку (shouldRetry).
    // 2. Если да, проверить, не превышено ли число попыток.
    // 3. Проанализировать недавние ошибки из `errorStorage`.
    //    - Если много RATE_LIMIT подряд -> увеличить задержку, 'delay' или 'reduce_batch'.
    //    - Если много TIMEOUT/NETWORK -> увеличить задержку, 'retry'.
    //    - Если ACCESS_DENIED -> 'abort'.
    //    - Если NOT_FOUND -> 'abort'.
    // 4. Сгенерировать сообщение для логов.
    // 5. Рассчитать delayMs с помощью calculateBackoffTime.

    if (!this.shouldRetry(analysis)) {
      return {
        action: 'abort',
        message: `Aborting: Unretryable error type ${analysis.errorType}.`,
      };
    }

    if (currentAttempt >= maxAttempts) {
      return {
        action: 'abort',
        message: `Aborting: Max attempts (${maxAttempts}) reached for ${analysis.materialId ?? analysis.requestUrl}. Last error: ${analysis.errorType}`,
      };
    }

    // // Анализ недавних ошибок (простой пример)
    // const recentErrors = this.errorStorage.getRecentErrors(5); // Получить последние 5 ошибок
    // const recentRateLimits = recentErrors.filter(
    //   (e) => e.errorType === ApiErrorType.RATE_LIMIT,
    // ).length;

    const delayMs = this.calculateBackoffTime(analysis, currentAttempt);
    const action: ActionRecommendation['action'] = 'retry';
    const message = `Recommendation: Retry attempt ${currentAttempt + 1}/${maxAttempts} after ${delayMs}ms. Error: ${analysis.errorType}`;

    // if (
    //   analysis.errorType === ApiErrorType.RATE_LIMIT ||
    //   recentRateLimits >= 2
    // ) {
    //   // Если текущая ошибка - rate limit ИЛИ было >= 2 недавних rate limit'ов
    //   delayMs = Math.max(delayMs, 5000); // Увеличиваем минимальную задержку для rate limit
    //   action = 'delay'; // Используем 'delay' как сигнал к возможному увеличению задержки на уровне пайплайна
    //   message = `Recommendation: Delaying and Retrying attempt <span class="math-inline">\{currentAttempt \+ 1\}/</span>{maxAttempts} after ${delayMs}ms due to ${analysis.errorType} or recent rate limits.`;
    //   // Можно добавить логику для 'reduce_batch' или 'change_headers' при постоянных проблемах
    // }

    return {
      action: action,
      delayMs: delayMs,
      message: message,
      maxAttempts: maxAttempts, // Можно передать дальше, если нужно
    };
  }

  /**
   * Определяет, следует ли повторить запрос на основе типа ошибки.
   * @param analysis - Результат анализа ошибки.
   * @returns true, если ошибку можно и нужно пытаться повторить.
   */
  shouldRetry(analysis: ApiResponseAnalysis): boolean {
    switch (analysis.errorType) {
      case ApiErrorType.RATE_LIMIT:
      case ApiErrorType.TIMEOUT:
      case ApiErrorType.NETWORK:
      case ApiErrorType.OTHER_SERVER_ERROR: // Например, 500, 503
      case ApiErrorType.EMPTY_RESPONSE: // Иногда стоит повторить, если ожидались данные
      case ApiErrorType.MALFORMED_RESPONSE: // Иногда ответ может быть временным мусором
      case ApiErrorType.OTHER: // Неизвестные ошибки стоит пробовать повторить
      case ApiErrorType.UNKNOWN:
        return true;
      case ApiErrorType.NONE: // Успешный ответ повторять не нужно
      case ApiErrorType.ACCESS_DENIED: // Бесполезно повторять без изменения credentials/headers
      case ApiErrorType.NOT_FOUND: // Ресурс не найден, повтор не поможет
      case ApiErrorType.LOGICAL_ERROR: // Ошибка в логике API, повтор вряд ли исправит
        return false;
      default:
        return false; // По умолчанию не повторяем неизвестные типы
    }
  }

  /**
   * Рассчитывает оптимальное время ожидания перед повторной попыткой.
   * Использует стратегию экспоненциального отката с джиттером.
   * @param analysis - Результат анализа ошибки (может влиять на базовую задержку).
   * @param attempt - Номер попытки (начиная с 1).
   * @returns Время ожидания в миллисекундах.
   */
  calculateBackoffTime(analysis: ApiResponseAnalysis, attempt: number): number {
    const baseDelay = 500; // Базовая задержка 0.5 сек
    const maxDelay = 30000; // Максимальная задержка 30 сек
    // Экспоненциальный рост: 0.5s, 1s, 2s, 4s, 8s, 16s, 30s, 30s...
    const exponentialDelay = Math.min(
      maxDelay,
      baseDelay * Math.pow(2, attempt - 1),
    );
    // Добавляем джиттер (случайная задержка до 500мс) для предотвращения "громоподобных стад"
    const jitter = Math.random() * 500;
    let calculatedDelay = Math.round(exponentialDelay + jitter);

    // Особые случаи
    if (analysis.errorType === ApiErrorType.RATE_LIMIT) {
      // Для Rate Limit можно установить большую минимальную задержку
      calculatedDelay = Math.max(calculatedDelay, 3000); // Минимум 3 секунды при Rate Limit
    }

    return calculatedDelay;
  }
}
