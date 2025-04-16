import { Prisma } from '@prisma/client';

export interface EmailConnectionDetails {
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
}

export class EmailAccount {
  id: number;
  password: string;
  email_address: string;
  imap_password: string;
  connection_details: EmailConnectionDetails | Prisma.InputJsonValue;
}

export class Email {
  id: number;
  email_address: string;
  provider: string;
  connection_details?: EmailConnectionDetails | Prisma.InputJsonValue;
  username: string;
  password: string;
  imap_password: string;
  status: string;
  last_check_timestamp?: Date;
  is_associated: boolean;
  created_at: Date;
  updated_at: Date;

  // Relations
  activities?: any[];
  tiktok_account?: any[];
  verification_codes?: any[];
}
