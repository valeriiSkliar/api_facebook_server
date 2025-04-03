import { Page } from 'playwright';
import { Browser } from 'playwright';

import { AuthenticatorOptions } from './authenticator-options';

export interface AuthenticatorContext {
  options: AuthenticatorOptions;
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
