import { Env } from '@lib/Env';

export interface EmailConfig {
  imap: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
}

// Validate required environment variables
const requiredEnvVars = [
  'UKR_NET_EMAIL',
  'UKR_NET_APP_PASSWORD',
  'UKR_NET_IMAP_HOST',
  'UKR_NET_SMTP_HOST',
  'UKR_NET_SMTP_PORT',
];

for (const envVar of requiredEnvVars) {
  if (!Env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Email configuration object
export const emailConfig: EmailConfig = {
  imap: {
    host: Env.UKR_NET_IMAP_HOST,
    port: 993, // Standard IMAP SSL port
    secure: true,
    auth: {
      user: Env.UKR_NET_EMAIL,
      pass: Env.UKR_NET_APP_PASSWORD,
    },
  },
  smtp: {
    host: Env.UKR_NET_SMTP_HOST,
    port: Env.UKR_NET_SMTP_PORT,
    secure: Env.UKR_NET_SMTP_SECURE,
    auth: {
      user: Env.UKR_NET_EMAIL,
      pass: Env.UKR_NET_APP_PASSWORD,
    },
  },
};
