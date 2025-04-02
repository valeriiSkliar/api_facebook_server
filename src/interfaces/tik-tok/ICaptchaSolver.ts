import { Page } from 'playwright';
import { CaptchaDetectionResult } from '@src/interfaces/tik-tok';

/**
 * Interface for captcha solving services
 * Defines the contract for any captcha solver implementation
 */
export interface ICaptchaSolver {
  /**
   * Detects the presence of a captcha on the page
   * @param page Playwright page object
   * @returns Promise resolving to captcha detection result
   */
  detect(page: Page): Promise<CaptchaDetectionResult>;

  /**
   * Attempts to solve the detected captcha
   * @param page Playwright page object
   * @param detectionResult Result from the captcha detection
   * @returns Promise resolving to boolean indicating success
   */
  solve(page: Page, detectionResult: CaptchaDetectionResult): Promise<boolean>;
}

export interface CaptchaCheckResult {
  detected: boolean;
  selector: string;
  screenshotPath: string | null;
  type: string | null;
  element?: any;
}
