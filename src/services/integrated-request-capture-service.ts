/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import fs from 'fs';
import { Request, Page } from 'playwright';
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BrowserHelperService } from '@src/services';

export interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  timestamp: string;
}

interface RequestInterceptionOptions {
  /**
   * Logger instance for logging messages.
   */
  log?: Logger;
  /**
   * Callback to be called when first request is intercepted
   */
  onFirstRequest?: () => Promise<void>;

  /**
   * Session ID to connect the captured request to
   */
  sessionId?: number;
  /**
   * Page instance to intercept requests
   */
  page?: Page;
}

/**
 * Service that handles request interception and capture for TikTok API endpoints
 */
export class IntegratedRequestCaptureService {
  private static CAPTURES_DIR = 'storage/request-captures';
  private isFirstRequest = true;
  private prisma: PrismaClient;
  private sessionId?: number;
  private browserHelperService: BrowserHelperService;

  // Default API endpoints to intercept
  private static DEFAULT_ENDPOINTS = [
    '**/creative_radar_api/v1/top_ads/v2/list**',
  ];

  constructor(
    private log?: Logger,
    sessionId?: number,
  ) {
    this.ensureCapturesDirectory();
    this.prisma = new PrismaClient();
    this.sessionId = sessionId;
    this.browserHelperService = BrowserHelperService.getInstance();
    if (this.log) {
      this.browserHelperService.setLogger(this.log);
    }
  }

  /**
   * Ensure the captures directory exists
   */
  private ensureCapturesDirectory() {
    if (!fs.existsSync(IntegratedRequestCaptureService.CAPTURES_DIR)) {
      fs.mkdirSync(IntegratedRequestCaptureService.CAPTURES_DIR, {
        recursive: true,
      });
    }
  }

  /**
   * Capture and save request details
   */
  private async captureRequest(request: Request): Promise<void> {
    const capturedRequest: CapturedRequest = {
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      postData: request.postData() || undefined,
      timestamp: new Date().toISOString(),
    };

    const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.json`;
    const filepath = `${IntegratedRequestCaptureService.CAPTURES_DIR}/${filename}`;

    await fs.promises.writeFile(
      filepath,
      JSON.stringify(capturedRequest, null, 2),
    );

    // Extract API version from URL or headers
    const apiVersion = this.extractApiVersion(request.url());

    // Create ApiConfiguration record and connect to session if sessionId is provided
    const apiConfig = await this.prisma.apiConfiguration.create({
      data: {
        api_version: apiVersion,
        parameters: {
          url: capturedRequest.url,
          method: capturedRequest.method,
          headers: capturedRequest.headers,
          postData: capturedRequest.postData,
          timestamp: capturedRequest.timestamp,
        },
        is_active: true,
        update_frequency: 3600,
        sessions: this.sessionId
          ? {
              connect: {
                id: this.sessionId,
              },
            }
          : undefined,
      },
    });

    // If we have a sessionId but didn't connect it during creation, update the session
    if (this.sessionId) {
      await this.prisma.session.update({
        where: { id: this.sessionId },
        data: { api_config_id: apiConfig.id },
      });
    }

    this.log?.debug('Request captured and saved', {
      url: request.url(),
      filepath,
      apiConfigId: apiConfig.id,
    });
  }

  private extractApiVersion(url: string): string {
    // Extract version from URL pattern like 'v1' or 'v2'
    const versionMatch = url.match(/v(\d+)/);
    return versionMatch ? `v${versionMatch[1]}` : 'v1'; // Default to v1 if not found
  }

  /**
   * Sets up request interception for the specified page
   */
  async setupInterception(
    page: Page,
    options: RequestInterceptionOptions = {},
  ): Promise<void> {
    const { log = this.log, onFirstRequest } = options;

    // Reset first request flag when setting up interception
    this.isFirstRequest = true;

    // Set up interception for the default endpoint
    await page.route(
      IntegratedRequestCaptureService.DEFAULT_ENDPOINTS[0],
      async (route, request) => {
        try {
          await this.captureRequest(request);

          if (this.isFirstRequest) {
            this.isFirstRequest = false;
            if (onFirstRequest) {
              await onFirstRequest();
            }
            log?.log('First API request intercepted and captured', {
              url: request.url(),
            });
          }

          await route.continue();
        } catch (error) {
          log?.error('Error processing request:', {
            error: (error as Error).message,
          });
          await route.continue();
        }
      },
    );
  }
}
