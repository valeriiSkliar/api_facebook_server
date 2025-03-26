import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

// Define the expected environment variables types
interface EnvSchema {
  DATABASE_URL: string;
  PORT: number;
  NODE_ENV: 'development' | 'test' | 'production';
}

// Create the environment schema with zod validation
export const env = createEnv({
  /*
   * Server-side environment variables schema
   */
  server: {
    // Database
    DATABASE_URL: z.string().url(),

    // Server configuration
    PORT: z.coerce.number().positive().default(3000),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),

    // Add any other environment variables your application needs
    // API_KEY: z.string().min(1),
  },

  /*
   * Client-side environment variables schema
   * In a NestJS app, this is typically empty but still required by the library
   */
  client: {
    // This can remain empty but needs to be present
  },

  /*
   * Configuration for environment variables loading
   */
  runtimeEnv: process.env as Record<string, string | undefined>,

  /**
   * Whether to skip validation of environment variables
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Required prefix for client-side environment variables
   * Even though we don't use client env vars in NestJS, this is required by the library
   */
  clientPrefix: 'PUBLIC_',

  /**
   * Enable more verbose logs for debugging
   */
  emptyStringAsUndefined: true,
}) as EnvSchema;
