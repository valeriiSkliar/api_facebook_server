import { Page } from 'playwright';
import { Browser } from 'playwright';

import { AuthenticatorOptions } from './authenticator-options';
import { AuthCredentials } from './auth-credentials';

export interface AuthenticatorContext {
  options: AuthenticatorOptions;
  credentials?: AuthCredentials;
  state: {
    browser?: Browser;
    page?: Page;
    errors: Error[];
    forceStop: boolean;
    externalBrowser?: boolean;
    browserId?: string;
    tabId?: string;
  };
}
