import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { BrowserPoolService } from './browser-pool-service';
import { CreateRequestDto } from '@src/dto/create-request.dto';
import { Prisma } from '@prisma/client';

export interface RequestMetadata {
  id: string;
  user_id: string;
  user_email: string;
  requestType: string;
  parameters: CreateRequestDto['parameters'];
  status: RequestStatus;
  createdAt: Date;
  processedAt?: Date;
  expiresAt: Date;
  browserId?: string;
  lastActivityAt: Date;
  priorityLevel: number;
  retryCount: number;
  webhookUrl?: string;
}

export enum RequestStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Injectable()
export class RequestManagerService {
  private readonly logger = new Logger(RequestManagerService.name);
  private readonly REQUEST_PREFIX = 'request:';
  private readonly USER_PREFIX = 'user:';
  private readonly REQUEST_EXPIRY = 60 * 60 * 24; // 24 hours in seconds

  constructor(
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly browserPoolService: BrowserPoolService,
  ) {}

  /**
   * Create a new request and reserve a browser instance
   */
  async createRequest(
    userId: string,
    userEmail: string,
    requestType: CreateRequestDto['requestType'],
    parameters: CreateRequestDto['parameters'],
    priority: number = 1,
    webhookUrl?: string,
  ): Promise<RequestMetadata> {
    try {
      const requestId = uuidv4();

      // Create request metadata
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 24 * 1000); // 24 hours from now

      const requestMetadata: RequestMetadata = {
        id: requestId,
        user_id: userId,
        user_email: userEmail,
        requestType,
        parameters,
        status: RequestStatus.PENDING,
        createdAt: now,
        expiresAt,
        lastActivityAt: now,
        priorityLevel: priority,
        retryCount: 0,
        webhookUrl,
      };

      const userRedisKey = `${this.USER_PREFIX}${userId}`;
      await this.redisService.set(userRedisKey, userEmail, this.REQUEST_EXPIRY);

      // Store in Redis
      const redisKey = `${this.REQUEST_PREFIX}${requestType}:${requestId}`;
      await this.redisService.set(
        redisKey,
        requestMetadata,
        this.REQUEST_EXPIRY,
      );

      // Create record in database
      await this.prismaService.request.create({
        data: {
          external_request_id: requestId,
          user_email: userEmail,
          user_id: userId,
          request_type: requestType,
          parameters: JSON.parse(
            JSON.stringify(parameters),
          ) as Prisma.InputJsonValue,
          created_at: now,
          status: RequestStatus.PENDING,
          session_id: 0, // Will be updated when a session is assigned
          priority: priority,
          retry_count: 0,
          webhook_url: webhookUrl,
        },
      });

      // Try to reserve a browser
      try {
        const browser = await this.browserPoolService.reserveBrowser(
          requestId,
          userId,
          parameters,
        );
        if (browser) {
          requestMetadata.browserId = browser.id;
          requestMetadata.status = RequestStatus.PROCESSING;

          // Update Redis and database
          await this.redisService.set(
            redisKey,
            requestMetadata,
            this.REQUEST_EXPIRY,
          );
          await this.prismaService.request.updateMany({
            where: { external_request_id: requestId },
            data: {
              status: RequestStatus.PROCESSING.toString(),
            },
          });

          this.logger.log(
            `Browser ${browser.id} reserved for request ${requestId}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to reserve browser for request ${requestId}`,
          error,
        );
        // Continue without browser - it will be assigned later when available
      }

      return requestMetadata;
    } catch (error) {
      this.logger.error('Error creating request', error);
      throw error;
    }
  }

  /**
   * Get a request by ID
   */
  async getRequest(requestId: string): Promise<RequestMetadata | null> {
    try {
      const redisKey = `${this.REQUEST_PREFIX}${requestId}`;
      const cachedRequest =
        await this.redisService.get<RequestMetadata>(redisKey);

      if (cachedRequest) {
        return cachedRequest;
      }

      // If not in Redis, try to find in database
      const dbRequest = await this.prismaService.request.findFirst({
        where: { external_request_id: requestId },
      });

      if (!dbRequest) {
        return null;
      }

      // Recreate request metadata from database
      const requestMetadata: RequestMetadata = {
        id: dbRequest.external_request_id,
        user_id: dbRequest.user_id,
        user_email: dbRequest.user_email,
        requestType: dbRequest.request_type,
        parameters: dbRequest.parameters as Record<string, any>,
        status: dbRequest.status as RequestStatus,
        createdAt: dbRequest.created_at,
        processedAt: dbRequest.processed_at || undefined,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Set expiry to 24h from now
        lastActivityAt: dbRequest.processed_at || dbRequest.created_at,
        priorityLevel: dbRequest.priority,
        retryCount: dbRequest.retry_count,
        webhookUrl: dbRequest.webhook_url || undefined,
      };

      // Cache in Redis for future lookups
      await this.redisService.set(
        redisKey,
        requestMetadata,
        this.REQUEST_EXPIRY,
      );

      return requestMetadata;
    } catch (error) {
      this.logger.error(`Error getting request ${requestId}`, error);
      throw error;
    }
  }

  /**
   * Update a request's status and record activity
   */
  async updateRequestStatus(
    requestId: string,
    status: RequestStatus,
    result?: any,
  ): Promise<RequestMetadata | null> {
    try {
      const request = await this.getRequest(requestId);
      if (!request) {
        return null;
      }

      const now = new Date();
      request.status = status;
      request.lastActivityAt = now;

      if (
        status === RequestStatus.COMPLETED ||
        status === RequestStatus.FAILED
      ) {
        request.processedAt = now;
      }

      const redisKey = `${this.REQUEST_PREFIX}${requestId}`;
      await this.redisService.set(redisKey, request, this.REQUEST_EXPIRY);

      // Update database
      await this.prismaService.request.updateMany({
        where: { external_request_id: requestId },
        data: {
          status: status.toString(),
          processed_at:
            status === RequestStatus.COMPLETED ||
            status === RequestStatus.FAILED
              ? now
              : undefined,
          response_data: result ? result : undefined,
        },
      });

      // Get request ID from database
      const dbRequest = await this.prismaService.request.findFirst({
        where: { external_request_id: requestId },
        select: { id: true },
      });

      // If request is completed or failed, release the browser
      if (
        (status === RequestStatus.COMPLETED ||
          status === RequestStatus.FAILED ||
          status === RequestStatus.CANCELLED ||
          status === RequestStatus.EXPIRED) &&
        request.browserId
      ) {
        await this.browserPoolService.releaseBrowser(request.browserId);
      }

      // Log activity
      await this.prismaService.activityLog.create({
        data: {
          timestamp: now,
          entity_type: 'Request',
          entity_id: dbRequest?.id || 0,
          action_type: `Request_Status_${status}`,
          details: { requestId, status } as any,
          severity: 'INFO',
          request_id: dbRequest?.id || 0,
          created_at: now,
          updated_at: now,
        },
      });

      return request;
    } catch (error) {
      this.logger.error(`Error updating request ${requestId}`, error);
      throw error;
    }
  }

  /**
   * Record activity for a request to keep it alive
   */
  async recordActivity(requestId: string): Promise<boolean> {
    try {
      const request = await this.getRequest(requestId);
      if (!request) {
        return false;
      }

      // Update last activity time
      const now = new Date();
      request.lastActivityAt = now;

      const redisKey = `${this.REQUEST_PREFIX}${requestId}`;
      await this.redisService.set(redisKey, request, this.REQUEST_EXPIRY);

      // If we have a browser ID, extend its reservation
      if (request.browserId) {
        await this.browserPoolService.extendReservation(request.browserId);
      }

      // Update database
      await this.prismaService.request.updateMany({
        where: { external_request_id: requestId },
        data: {
          updated_at: now,
        },
      });

      return true;
    } catch (error) {
      this.logger.error(
        `Error recording activity for request ${requestId}`,
        error,
      );
      return false;
    }
  }

  /**
   * Cancel a request
   */
  async cancelRequest(requestId: string): Promise<boolean> {
    return !!(await this.updateRequestStatus(
      requestId,
      RequestStatus.CANCELLED,
    ));
  }

  /**
   * List all requests for a user
   */
  async listUserRequests(userId: string): Promise<RequestMetadata[]> {
    try {
      const dbRequests = await this.prismaService.request.findMany({
        where: {
          // session: {
          //   email: {
          //     equals: userId, // Assuming userId is an email address
          //   },
          // },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      // Convert to RequestMetadata format
      return dbRequests.map((dbRequest) => ({
        id: dbRequest.external_request_id,
        user_id: dbRequest.user_id,
        user_email: dbRequest.user_email,
        requestType: dbRequest.request_type,
        parameters: dbRequest.parameters as Record<string, any>,
        status: dbRequest.status as RequestStatus,
        createdAt: dbRequest.created_at,
        processedAt: dbRequest.processed_at || undefined,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Set expiry to 24h from now
        lastActivityAt: dbRequest.processed_at || dbRequest.created_at,
        priorityLevel: dbRequest.priority,
        retryCount: dbRequest.retry_count,
        webhookUrl: dbRequest.webhook_url || undefined,
      }));
    } catch (error) {
      this.logger.error(`Error listing requests for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Check for expired requests and clean them up
   */
  async cleanupExpiredRequests(): Promise<number> {
    try {
      const now = new Date();
      const threshold = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes ago

      // Find requests with no activity for 15+ minutes
      const expiredRequests = await this.prismaService.request.findMany({
        where: {
          status: {
            in: [
              RequestStatus.PENDING.toString(),
              RequestStatus.PROCESSING.toString(),
            ],
          },
          updated_at: {
            lt: threshold,
          },
        },
      });

      let count = 0;

      // Mark each as expired and release browsers
      for (const request of expiredRequests) {
        await this.updateRequestStatus(
          request.external_request_id,
          RequestStatus.EXPIRED,
        );
        count++;
      }

      return count;
    } catch (error) {
      this.logger.error('Error cleaning up expired requests', error);
      throw error;
    }
  }
}
