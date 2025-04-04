import { Logger } from '@nestjs/common';
import { CachedResponse } from '../core/interfaces/cached-response';

export class ResponseCacheService {
  private responseCache = new Map<string, CachedResponse>();
  private readonly maxCacheAge = 5 * 60 * 1000; // 5 minutes
  private readonly cleanupInterval = 60 * 1000; // 1 minute

  constructor(private readonly logger: Logger) {
    this.startCleanupInterval();
  }

  public async cacheResponse(
    url: string,
    responseText: string,
  ): Promise<string> {
    const responseId = `${url}_${Date.now()}`;
    this.responseCache.set(responseId, {
      text: responseText,
      url,
      timestamp: Date.now(),
    });
    return new Promise((resolve) => resolve(responseId));
  }

  public getCachedResponse(responseId: string): CachedResponse | undefined {
    return this.responseCache.get(responseId);
  }

  public deleteCachedResponse(responseId: string): void {
    this.responseCache.delete(responseId);
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupOldResponses();
    }, this.cleanupInterval);
  }

  private cleanupOldResponses(): void {
    const now = Date.now();
    for (const [id, response] of this.responseCache.entries()) {
      if (now - response.timestamp > this.maxCacheAge) {
        this.responseCache.delete(id);
        this.logger.debug(`Cleaned up cached response: ${id}`);
      }
    }
  }
}
