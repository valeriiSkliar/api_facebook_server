export enum ApiErrorType {
  NONE = 'none', // Успех
  RATE_LIMIT = 'rate_limit', // Превышен лимит запросов (e.g., 429)
  ACCESS_DENIED = 'access_denied', // Ошибка аутентификации/авторизации (e.g., 401, 403, 40101)
  NOT_FOUND = 'not_found', // Ресурс не найден (e.g., 404)
  MALFORMED_RESPONSE = 'malformed_response', // Ответ не соответствует ожидаемой структуре (не JSON, не хватает полей)
  EMPTY_RESPONSE = 'empty_response', // Ответ успешен, но не содержит данных (когда ожидались)
  TIMEOUT = 'timeout', // Истекло время ожидания ответа (e.g., ECONNABORTED)
  NETWORK = 'network', // Ошибка сети (нет соединения, DNS lookup failed)
  LOGICAL_ERROR = 'logical_error', // API вернуло код ошибки в теле ответа (e.g., code != 0)
  OTHER_SERVER_ERROR = 'other_server_error', // Другие серверные ошибки (5xx)
  OTHER = 'other', // Другие ошибки на стороне клиента (ошибка конфигурации запроса и т.д.)
  UNKNOWN = 'unknown',
  PERMISSION_ERROR = 'PERMISSION_ERROR', // Не удалось определить тип ошибки
}
