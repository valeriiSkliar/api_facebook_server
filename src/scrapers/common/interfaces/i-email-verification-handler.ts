import { Page } from 'playwright';

/**
 * Interface for email verification handling
 * Defines the contract for any email verification implementation
 */
export interface IEmailVerificationHandler {
  /**
   * Waits for a verification code to be received for the specified email
   * @param email Email address to receive the verification code
   * @returns Promise resolving to the verification code or null if not received
   */
  waitForCode(email: string): Promise<string | null>;

  /**
   * Submits the verification code on the page
   * @param page Playwright page object
   * @param code Verification code to submit
   * @returns Promise resolving to boolean indicating success
   */
  submitCode(page: Page, code: string): Promise<boolean>;
}
