// import { ActionRecommendation } from './action-recommendation';
import { ApiErrorType } from './api-error-type';

export interface ApiResponseAnalysis {
  // Общая информация
  materialId: string;
  timestamp: Date;
  endpoint: string;

  // Статус запроса
  isSuccess: boolean;
  statusCode: number;

  // Детали ошибки
  errorType: ApiErrorType;
  errorMessage: string;

  // Технические детали
  responseHeaders?: Record<string, string>;
  responseSize?: number;
  responseTime?: number;

  // Сокращенное содержимое ответа (для отладки)
  responseSnippet?: string;
  requestUrl?: string;

  // Рекомендация
  // recommendation?: ActionRecommendation;
}
