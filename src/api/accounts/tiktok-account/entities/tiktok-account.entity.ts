import { Email } from '../../email-account/entities/email-account.entity';

export class TikTokAccount {
  id: number;
  username: string;
  password: string;
  email_id: number;
  status: string;
  last_login_timestamp?: Date;
  creation_date: Date;
  notes?: string;
  verification_required: boolean;
  is_active: boolean;
  last_auth_success?: Date;
  updated_at: Date;

  // Relations
  email_account?: Email;
  activities?: any[];
  sessions?: any[];
  verification_codes?: any[];
}
