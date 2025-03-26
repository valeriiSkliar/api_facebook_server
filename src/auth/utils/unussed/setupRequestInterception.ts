import { Page } from 'playwright';
import { Log } from 'crawlee';
import { RequestCaptureService } from '@src/services/RequestCaptureService';
// import { PrismaClient } from '@prisma/client';

interface SetupRequestInterceptionOptions {
  /**
   * Logger instance for logging messages.
   */
  log?: Log;
  /**
   * TikTok account ID for session creation
   */
  tiktokAccountId?: number;
  /**
   * Proxy ID for session creation
   */
  proxyId?: number;
  /**
   * Callback to be called when first request is intercepted
   */
  onFirstRequest?: () => Promise<void>;
}

/**
 * Sets up request interception for TikTok API requests
 * Enhances the existing request interception to save API configurations and sessions
 *
 * @param page - Playwright page instance
 * @param options - Interception options
 */
export const setupRequestInterception = async (
  page: Page,
  options: SetupRequestInterceptionOptions = {},
) => {
  const { log, tiktokAccountId, proxyId, onFirstRequest } = options;

  // Initialize PrismaClient for database operations
  // const prisma = new PrismaClient();

  // Initialize the enhanced RequestCaptureService with PrismaClient
  const requestCapture = new RequestCaptureService(log);

  let isFirstRequest = true;

  await page.route(
    '**/creative_radar_api/v1/top_ads/v2/list**',
    async (route, request) => {
      try {
        // Capture request details with TikTok account and proxy info for session creation
        await requestCapture.captureRequest(request, tiktokAccountId);

        if (isFirstRequest) {
          isFirstRequest = false;
          // Call the onFirstRequest callback if provided
          if (onFirstRequest) {
            await onFirstRequest();
          }

          log?.info('First API request intercepted and captured', {
            url: request.url(),
            tiktokAccountId,
            proxyId,
          });
        }

        // Continue request processing as usual
        await route.continue();
      } catch (error) {
        if (log) {
          log.error('Error processing request:', {
            error: (error as Error).message,
          });
        }
        await route.continue();
      }
    },
  );

  // Add interception for other potential API endpoints
  await page.route('**/api/**', async (route, request) => {
    // Only intercept GET or POST requests to actual API endpoints
    const isApiRequest =
      request.url().includes('/api/') &&
      (request.method() === 'GET' || request.method() === 'POST');

    if (isApiRequest) {
      try {
        await requestCapture.captureRequest(request, tiktokAccountId);
        log?.debug('API request intercepted and captured', {
          url: request.url(),
        });
      } catch (error) {
        log?.error('Error capturing API request:', {
          error: (error as Error).message,
        });
      }
    }

    // Always continue the request
    await route.continue();
  });
};
