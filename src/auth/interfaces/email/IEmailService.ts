export interface EmailVerificationCodeType {
  id: number;
  email_id: number;
  tiktok_account_id: number;
  code: string;
  received_at: Date;
  used_at: Date | null;
  status: string;
  message_id: string;
  email_body: string | null;
  sender_email: string;
  created_at: Date;
  updated_at: Date;
}

export interface IEmailService {
  /**
   * Tests the connection to the email server
   * @returns Promise resolving to connection status details
   */
  testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: Record<string, unknown>;
  }>;

  /**
   * Retrieves the latest verification code from emails
   * @param emailId Email ID to retrieve code for
   * @param tiktokAccountId TikTok account ID to retrieve code for
   * @returns Promise with the verification code or null if not found
   */
  getLatestVerificationCode(
    emailId: number,
    tiktokAccountId: number,
  ): Promise<EmailVerificationCodeType | null>;

  /**
   * Waits for a verification code to arrive for a specific email
   * @param email Email address to wait for code
   * @param timeoutMs Timeout in milliseconds
   * @param pollIntervalMs Polling interval in milliseconds
   * @returns Promise resolving to verification code or null if timeout
   */
  waitForVerificationCode(
    email: string,
    timeoutMs?: number,
    pollIntervalMs?: number,
  ): Promise<string | null>;

  /**
   * Marks a verification code as used
   * @param code The verification code to mark as used
   * @returns Promise resolving to the updated code record
   */
  markCodeAsUsed(code: string): Promise<EmailVerificationCodeType>;

  /**
   * Gets the status of a verification code
   * @param code The verification code to check
   * @returns Promise resolving to the code record or null if not found
   */
  getCodeStatus(code: string): Promise<EmailVerificationCodeType | null>;
}
