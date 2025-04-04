import { ImapFlowOptions } from 'imapflow';

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
