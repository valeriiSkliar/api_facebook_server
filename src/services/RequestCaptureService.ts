import { Injectable } from '@nestjs/common';
import { Log } from 'crawlee';
import * as fs from 'fs';
import * as path from 'path';
import { Request } from 'playwright';

@Injectable()
export class RequestCaptureService {
  private capturedRequests: Map<string, any> = new Map();
  private requestCount = 0;
  private storagePath: string;

  constructor(private readonly logger?: Log) {
    // Create storage directory if it doesn't exist
    this.storagePath = path.join(process.cwd(), 'storage', 'requests');
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  /**
   * Captures and stores details about a request
   * @param request The Puppeteer request object
   * @param associatedId Optional ID to associate with this request (like tiktokAccountId)
   * @returns A unique ID for the captured request
   */
  async captureRequest(
    request: Request,
    associatedId?: number,
  ): Promise<string> {
    try {
      // Generate a unique ID for this request
      const requestId = `req_${Date.now()}_${++this.requestCount}`;

      // Extract request data
      const url = request.url();
      const method = request.method();
      const headers = request.headers();

      // Extract request body if it's a POST request
      let postData: string | null = null;
      if (method === 'POST') {
        postData = request.postData();
      }

      // Create request capture object
      const requestData = {
        id: requestId,
        timestamp: new Date().toISOString(),
        associatedId,
        request: {
          url,
          method,
          headers,
          postData,
        },
      };

      // Store in memory
      this.capturedRequests.set(requestId, requestData);

      // Log the capture
      this.logger?.debug('Request captured', {
        id: requestId,
        url,
        method,
        associatedId,
      });

      // Save to file system for persistence
      await this.saveRequestToFile(requestId, requestData);

      return requestId;
    } catch (error) {
      this.logger?.error('Error capturing request', {
        error: error instanceof Error ? error.message : String(error),
        url: request.url(),
      });
      throw error;
    }
  }

  /**
   * Gets a previously captured request
   * @param requestId The ID of the request to retrieve
   * @returns The captured request data or null if not found
   */
  getRequest(requestId: string): any {
    return this.capturedRequests.get(requestId) || null;
  }

  /**
   * Gets all captured requests
   * @returns Array of all captured requests
   */
  getAllRequests(): any[] {
    return Array.from(this.capturedRequests.values());
  }

  /**
   * Gets captured requests associated with a specific ID
   * @param associatedId The ID to filter requests by
   * @returns Array of matching requests
   */
  getRequestsByAssociatedId(associatedId: number): any[] {
    return Array.from(this.capturedRequests.values()).filter(
      (req) => req.associatedId === associatedId,
    );
  }

  /**
   * Saves request data to a JSON file
   * @param requestId The ID of the request
   * @param requestData The request data to save
   */
  private async saveRequestToFile(
    requestId: string,
    requestData: any,
  ): Promise<void> {
    try {
      const filePath = path.join(this.storagePath, `${requestId}.json`);
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(requestData, null, 2),
      );

      this.logger?.debug('Request saved to file', { filePath });
    } catch (error) {
      this.logger?.error('Error saving request to file', {
        error: error instanceof Error ? error.message : String(error),
        requestId,
      });
    }
  }

  /**
   * Analyzes a batch of requests to extract API configurations and patterns
   * @param requests Array of request data objects
   * @returns Analysis results
   */
  analyzeRequests(requests: any[]): any {
    // Implement request analysis logic here
    // This could include identifying common endpoints, parameters, headers, etc.

    const analysis = {
      endpoints: new Map<string, number>(),
      parameters: new Set<string>(),
      headers: new Set<string>(),
      timestamp: new Date().toISOString(),
    };

    for (const req of requests) {
      // Extract endpoint
      const url = new URL(req.request.url);
      const endpoint = url.pathname;

      // Count endpoint occurrences
      if (analysis.endpoints.has(endpoint)) {
        analysis.endpoints.set(endpoint, analysis.endpoints.get(endpoint)! + 1);
      } else {
        analysis.endpoints.set(endpoint, 1);
      }

      // Extract URL parameters
      url.searchParams.forEach((_, key) => {
        analysis.parameters.add(key);
      });

      // Extract headers
      Object.keys(req.request.headers).forEach((header) => {
        analysis.headers.add(header);
      });
    }

    // Convert Maps and Sets to objects for easier serialization
    return {
      endpoints: Object.fromEntries(analysis.endpoints),
      parameters: Array.from(analysis.parameters),
      headers: Array.from(analysis.headers),
      timestamp: analysis.timestamp,
    };
  }
}
