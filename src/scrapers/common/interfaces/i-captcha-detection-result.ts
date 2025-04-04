import { ElementHandle } from 'playwright';

/**
 * Captcha detection result model
 * Contains information about a detected captcha
 */
export interface CaptchaDetectionResult {
  /**
   * Whether a captcha was detected
   */
  detected: boolean;

  /**
   * Type of captcha detected (recaptcha, hcaptcha, tiktok-slide, etc.)
   */
  type: string | null;

  /**
   * Element handle for the captcha if detected
   */
  element: ElementHandle | null;

  /**
   * CSS selector for the captcha element if detected
   */
  selector?: string;

  /**
   * Path to a screenshot of the captcha if taken
   */
  screenshotPath?: string;
}
