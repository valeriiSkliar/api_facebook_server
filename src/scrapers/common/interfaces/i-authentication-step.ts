import { AuthenticatorContext } from '@src/authenticators/common/models/authenticator-context';
import { IPipelineStep } from '../../../core/interfaces/I-pipeline';
import { AuthCredentials } from '@src/authenticators/common/models/auth-credentials';

export enum AuthStepType {
  PRE_SESSION = 'pre_session', // Steps that run before session restore
  POST_SESSION = 'post_session', // Steps that must run after session restore
  LOGIN = 'login', // Regular login steps that can be skipped if session is restored
}

/**
 * Authentication pipeline step interface
 */
export interface IAuthenticationStep
  extends IPipelineStep<AuthenticatorContext, AuthCredentials> {
  /**
   * Get the type of authentication step
   */
  getType(): AuthStepType;
}

// export interface IAuthenticationStep {
//   /**
//    * Execute this authentication step
//    * @param page Playwright page object
//    * @param credentials Authentication credentials
//    * @returns Promise resolving to a boolean indicating success
//    */
//   execute(page: Page, credentials?: AuthCredentials): Promise<boolean>;

//   /**
//    * Get the name of this step for logging purposes
//    */
//   getName(): string;

//   /**
//    * Get the type of this authentication step
//    */
//   getType(): AuthStepType;
// }
