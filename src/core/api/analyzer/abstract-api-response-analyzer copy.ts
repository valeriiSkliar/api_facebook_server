import { AxiosError } from 'axios';
import { ApiResponseAnalysis } from '../models/api-response-analysis';
import { ActionRecommendation } from '../models/action-recommendation';

export abstract class AbstractApiResponseAnalyzer {
  /**
   * Анализирует ответ API и классифицирует ошибку при наличии
   */
  abstract analyzeResponse(
    // response: AxiosResponse | null,
    materialId: string | null, // nullable
    error: AxiosError | null,
    endpoint: string,
    requestTimestamp: Date,
  ): ApiResponseAnalysis;

  /**
   * Генерирует рекомендации по корректировке стратегии запросов
   * на основе текущего анализа и истории ошибок
   */
  abstract generateActionRecommendation(
    analysis: ApiResponseAnalysis,
    currentAttempt: number,
    maxAttempts: number,
  ): ActionRecommendation;

  /**
   * Определяет, следует ли повторить запрос на основе типа ошибки
   */
  abstract shouldRetry(analysis: ApiResponseAnalysis): boolean;

  /**
   * Рассчитывает оптимальное время ожидания перед повторной попыткой
   */
  abstract calculateBackoffTime(
    analysis: ApiResponseAnalysis,
    attempt: number,
  ): number;
}
