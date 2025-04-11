export interface ActionRecommendation {
  /** Рекомендуемое действие */
  action: 'retry' | 'abort' | 'delay' | 'reduce_batch' | 'change_headers'; // Добавил 'delay' как явный сигнал

  /** Рекомендуемая задержка перед следующим действием (в мс), если применимо */
  delayMs?: number;

  /** Сообщение для логирования, объясняющее рекомендацию */
  message: string;

  /** Максимальное количество попыток (может передаваться для контекста) */
  maxAttempts?: number;

  /** Дополнительный контекст, который может понадобиться для выполнения действия */
  context?: Record<string, any>;
}
