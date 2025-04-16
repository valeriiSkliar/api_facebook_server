import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';
import * as dotenv from 'dotenv';
// Load environment variables
dotenv.config();

// Helper function to parse comma-separated string into array
const parseCommaSeparated = (str: string | undefined): string[] => {
  if (!str) return [];
  return str
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

// Don't add NODE_ENV into T3 Env, it changes the tree-shaking behavior
export const Env = createEnv({
  /**
   * Client-side environment variables schema
   */
  client: {
    // No client-side env vars for now
  },
  /**
   * Server-side environment variables schema
   */
  server: {
    IS_PRODUCTION: z.boolean().default(false),
    SESSION_STORAGE_PATH: z.string().default('./storage/sessions'),
    // API Keys
    API_KEY: z.string().transform((val) => (val ? val : 'your-api-key-here')),
    OPENAI_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    SAD_CAPTCHA_API_KEY: z.string().default('test_api_key'),
    CAPTCHA_RESOLVE_MODE: z.enum(['manual', 'api']).default('manual'),
    CAPTCHA_SCREENSHOTS_DIR: z
      .string()
      .default('./storage/captcha-screenshots'),
    // Headless mode
    HEADLESS: z
      .string()
      .transform((val) => (val.toLowerCase() === 'false' ? false : true))
      .default('true'),

    // Database URLs
    DATABASE_POSTGRES_URL: z
      .string()
      .default('postgresql://user:password@localhost:5432/tiktok'),
    DATABASE_SQLITE_URL: z.string().default('file:./data/tiktok.db'),
    DATABASE_MYSQL_URL: z
      .string()
      .default('mysql://root:password@localhost:3306/tiktok'),

    // Email Service Configuration
    UKR_NET_EMAIL: z.string(),
    UKR_NET_APP_PASSWORD: z.string(),
    UKR_NET_IMAP_HOST: z.string().default('imap.ukr.net'),
    UKR_NET_SMTP_HOST: z.string().default('smtp.ukr.net'),
    UKR_NET_SMTP_PORT: z
      .string()
      .transform((val) => parseInt(val, 10))
      .default('465'),
    UKR_NET_SMTP_SECURE: z
      .string()
      .transform((val) => val.toLowerCase() === 'true')
      .default('true'),

    // TikTok Credentials
    TIKTOK_EMAIL: z.string().default('test@example.com'),
    TIKTOK_PASSWORD: z.string().default('password123'),
    // Crawler Settings
    CRAWLER_MAX_WAIT_TIME: z
      .string()
      .transform((val) => parseInt(val, 10))
      .default('30000'),
    CRAWLER_CAPTCHA_TIMEOUT: z
      .string()
      .transform((val) => parseInt(val, 10))
      .default('60000'),
    CRAWLER_MAX_CAPTCHA_ATTEMPTS: z
      .string()
      .transform((val) => parseInt(val, 10))
      .default('3'),
    CRAWLER_HUMAN_DELAY_MIN: z
      .string()
      .transform((val) => parseInt(val, 10))
      .default('500'),
    CRAWLER_HUMAN_DELAY_MAX: z
      .string()
      .transform((val) => parseInt(val, 10))
      .default('2000'),

    // Storage Paths
    PATH_SCREENSHOTS: z.string().default('./storage/screenshots'),
    PATH_DATA: z.string().default('./storage/data'),

    // Proxy Settings
    PROXY_ENABLED: z
      .string()
      .transform((val) => val.toLowerCase() === 'true')
      .default('false'),
    PROXY_URL: z.string().optional(),

    // Filter Settings
    FILTER_REGION: z.string().optional().transform(parseCommaSeparated),
    FILTER_INDUSTRY: z.string().optional().transform(parseCommaSeparated),
    FILTER_OBJECTIVE: z.string().optional().transform(parseCommaSeparated),
    FILTER_PERIOD: z.string().optional(),
    FILTER_AD_LANGUAGE: z.string().optional().transform(parseCommaSeparated),
    FILTER_AD_FORMAT: z.string().optional(),
    FILTER_LIKES: z.string().optional().transform(parseCommaSeparated),

    // User Agent Settings
    USER_AGENT_USE_CUSTOM: z
      .string()
      .transform((val) => val.toLowerCase() === 'true')
      .default('false'),
    USER_AGENT_CUSTOM: z.string().optional(),
  },
  /**
   * Specify your client-side environment variables schema here
   */
  clientPrefix: '',
  /**
   * Environment variables available on the client and server
   */
  runtimeEnv: {
    SESSION_STORAGE_PATH: process.env.SESSION_STORAGE_PATH,
    // API Keys
    API_KEY: process.env.API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    SAD_CAPTCHA_API_KEY: process.env.SAD_CAPTCHA_API_KEY,
    CAPTCHA_RESOLVE_MODE: process.env.CAPTCHA_RESOLVE_MODE,
    CAPTCHA_SCREENSHOTS_DIR: process.env.CAPTCHA_SCREENSHOTS_DIR,

    // Database URLs
    DATABASE_POSTGRES_URL: process.env.DATABASE_POSTGRES_URL,
    DATABASE_SQLITE_URL: process.env.DATABASE_SQLITE_URL,
    DATABASE_MYSQL_URL: process.env.DATABASE_MYSQL_URL,

    // Email Service Configuration
    UKR_NET_EMAIL: process.env.UKR_NET_EMAIL,
    UKR_NET_APP_PASSWORD: process.env.UKR_NET_APP_PASSWORD,
    UKR_NET_IMAP_HOST: process.env.UKR_NET_IMAP_HOST,
    UKR_NET_SMTP_HOST: process.env.UKR_NET_SMTP_HOST,
    UKR_NET_SMTP_PORT: process.env.UKR_NET_SMTP_PORT,
    UKR_NET_SMTP_SECURE: process.env.UKR_NET_SMTP_SECURE,

    // TikTok Credentials
    TIKTOK_EMAIL: process.env.TIKTOK_EMAIL,
    TIKTOK_PASSWORD: process.env.TIKTOK_PASSWORD,
    // Crawler Settings
    CRAWLER_MAX_WAIT_TIME: process.env.CRAWLER_MAX_WAIT_TIME,
    CRAWLER_CAPTCHA_TIMEOUT: process.env.CRAWLER_CAPTCHA_TIMEOUT,
    CRAWLER_MAX_CAPTCHA_ATTEMPTS: process.env.CRAWLER_MAX_CAPTCHA_ATTEMPTS,
    CRAWLER_HUMAN_DELAY_MIN: process.env.CRAWLER_HUMAN_DELAY_MIN,
    CRAWLER_HUMAN_DELAY_MAX: process.env.CRAWLER_HUMAN_DELAY_MAX,

    // Storage Paths
    PATH_SCREENSHOTS: process.env.PATH_SCREENSHOTS,
    PATH_DATA: process.env.PATH_DATA,

    // Proxy Settings
    PROXY_ENABLED: process.env.PROXY_ENABLED,
    PROXY_URL: process.env.PROXY_URL,

    // Filter Settings
    FILTER_REGION: process.env.FILTER_REGION,
    FILTER_INDUSTRY: process.env.FILTER_INDUSTRY,
    FILTER_OBJECTIVE: process.env.FILTER_OBJECTIVE,
    FILTER_PERIOD: process.env.FILTER_PERIOD,
    FILTER_AD_LANGUAGE: process.env.FILTER_AD_LANGUAGE,
    FILTER_AD_FORMAT: process.env.FILTER_AD_FORMAT,
    FILTER_LIKES: process.env.FILTER_LIKES,

    // Headless mode
    HEADLESS: process.env.HEADLESS,

    // User Agent Settings
    USER_AGENT_USE_CUSTOM: process.env.USER_AGENT_USE_CUSTOM,
    USER_AGENT_CUSTOM: process.env.USER_AGENT_CUSTOM,
  },
});
