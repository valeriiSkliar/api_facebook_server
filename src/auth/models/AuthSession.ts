import { ProxyConfig } from './ProxyConfig';

/**
 * Перечисление статусов сессии авторизации
 */
export enum AuthSessionStatus {
  ACTIVE = 'ACTIVE', // Активная сессия, готова к использованию
  EXPIRED = 'EXPIRED', // Срок действия истек
  INVALID = 'INVALID', // Стала недействительной (была обнаружена разлогинизация)
  REFRESHING = 'REFRESHING', // В процессе обновления
  SUSPENDED = 'SUSPENDED', // Временно приостановлена (например, при лимитах)
  ERROR = 'ERROR', // Ошибка в сессии
}

/**
 * Интерфейс для полного состояния браузера (cookies, localStorage и т.д.)
 */
export interface BrowserStorageState {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;
  localStorage?: Record<string, Record<string, string>>;
  sessionStorage?: Record<string, Record<string, string>>;
  origins?: Array<{
    origin: string;
    localStorage: Array<{
      name: string;
      value: string;
    }>;
  }>;
  msToken?: string; // Специфический для TikTok токен
  ttwid?: string; // TikTok Web ID токен
  csrftoken?: string; // CSRF токен для защиты от межсайтовых запросов
}

/**
 * Метаданные сессии
 */
export interface AuthSessionMetadata {
  captchasSolved?: number;
  emailVerifications?: number;
  lastUrl?: string;
  lastError?: string;
  customFields?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Интерфейс для состояния авторизации
 */
export interface AuthSession {
  // Основная информация
  id: string;
  email: string;
  storageState: BrowserStorageState;

  // Связи и references
  proxyId?: string;
  proxyConfig?: ProxyConfig;

  // Временные метки
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
  lastRefreshAt?: Date;

  // Статус и счетчики
  status: AuthSessionStatus;
  refreshCount: number;
  failCount: number;

  // Дополнительная информация
  userAgent?: string;
  instanceId?: string;
  metadata?: AuthSessionMetadata;
}

/**
 * Параметры для создания новой сессии
 */
export interface CreateAuthSessionParams {
  email: string;
  storageState: BrowserStorageState;
  proxyId?: string;
  proxyConfig?: ProxyConfig;
  expiresIn?: number; // Время жизни в миллисекундах (по умолчанию 24 часа)
  userAgent?: string;
  instanceId?: string;
  metadata?: AuthSessionMetadata;
}

/**
 * Параметры для поиска сессии
 */
export interface FindAuthSessionParams {
  id?: string;
  email?: string;
  proxyId?: string;
  status?: AuthSessionStatus | AuthSessionStatus[];
  minExpiresAt?: Date; // Минимальная дата истечения (для поиска действующих)
  instanceId?: string;
}

/**
 * Интерфейс для обновления сессии
 */
export interface UpdateAuthSessionParams {
  storageState?: BrowserStorageState;
  status?: AuthSessionStatus;
  expiresAt?: Date;
  refreshCount?: number;
  failCount?: number;
  metadata?: AuthSessionMetadata;
  lastUsedAt?: Date;
  lastRefreshAt?: Date;
}
