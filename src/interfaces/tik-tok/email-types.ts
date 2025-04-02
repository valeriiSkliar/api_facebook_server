import { ImapFlowOptions } from 'imapflow';

export interface EmailVerificationCodeType {
  code: string;
  message_id: string;
  email_body: string;
  sender_email: string;
}

export interface FetchMessageObject {
  uid: number;
  source: string;
  envelope: {
    from: Array<{ address: string }>;
  };
}

export type ImapConfig = ImapFlowOptions & {
  connection_details?: {
    host: string;
    port: number;
  };
};
