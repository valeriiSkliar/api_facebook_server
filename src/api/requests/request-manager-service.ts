/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/services/request-manager-service.ts

import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '@core/storage/redis/redis.service';
import { PrismaService } from '@src/database';
import { Prisma, Request } from '@prisma/client';
import { QueueService } from '@core/queue/queue.service';

export interface RequestMetadata<T = unknown> {
  id: string;
  user_id: string;
  user_email: string;
  requestType: string;
  parameters: T;
  status: RequestStatus;
  createdAt: Date;
  processedAt?: Date;
  expiresAt: Date;
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
  private readonly USER_REQUESTS_PREFIX = 'user-requests:';
  private readonly REQUEST_EXPIRY = 60 * 60 * 24; // 24 hours in seconds

  constructor(
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Get the full request record from the database, including results.
   */
  async getRequestWithResults(requestId: string): Promise<Request | null> {
    this.logger.debug(
      `Workspaceing request with results from DB for ID: ${requestId}`,
    );
    try {
      const dbRequest = await this.prismaService.request.findFirst({
        where: { external_request_id: requestId },
      });
      if (!dbRequest) {
        this.logger.warn(
          `Request with external_request_id ${requestId} not found in DB.`,
        );
      }
      return dbRequest;
    } catch (error) {
      this.logger.error(
        `Error getting request with results ${requestId} from DB`,
        error,
      );
      // В зависимости от политики обработки ошибок, можно либо вернуть null, либо пробросить исключение
      // throw new Error(`Failed to retrieve request details for ${requestId}`);
      return null;
    }
  }

  /**
   * Create a new request with any parameter type
   */
  async createRequest(
    userId: string,
    userEmail: string,
    requestType: string,
    parameters: any,
    priority: number = 1,
    webhookUrl?: string,
  ): Promise<{ id: string; status: RequestStatus }> {
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

      // Store user data in Redis
      const userRedisKey = `${this.USER_PREFIX}${userId}`;
      await this.redisService.set(userRedisKey, userEmail, this.REQUEST_EXPIRY);

      // Store request in Redis
      const requestRedisKey = `${this.REQUEST_PREFIX}${requestId}`;
      await this.redisService.set(
        requestRedisKey,
        requestMetadata,
        this.REQUEST_EXPIRY,
      );

      // Add request to user's requests list
      const userRequestsKey = `${this.USER_REQUESTS_PREFIX}${userId}`;
      await this.redisService.lpush(userRequestsKey, requestId);
      await this.redisService.expire(userRequestsKey, this.REQUEST_EXPIRY);

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
          priority: priority,
          retry_count: 0,
          webhook_url: webhookUrl,
        },
      });

      // Log before enqueueing - no tab creation needed
      this.logger.debug(`[createRequest] Enqueueing request ${requestId}...`);
      // Enqueue for processing
      await this.queueService.enqueueRequest(requestId, priority);

      this.logger.log(`Enqueued request ${requestId}`);

      // Return only id and status as requested
      return { id: requestId, status: RequestStatus.PENDING };
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
   * Get all requests for a user
   */
  async getUserRequests(userId: string): Promise<RequestMetadata[]> {
    try {
      const userRequestsKey = `${this.USER_REQUESTS_PREFIX}${userId}`;
      const requestIds =
        (await this.redisService.lrange(userRequestsKey, 0, -1)) || [];

      const requests: RequestMetadata[] = [];
      for (const requestId of requestIds) {
        const request = await this.getRequest(requestId);
        if (request) {
          requests.push(request);
        }
      }

      return requests;
    } catch (error) {
      this.logger.error(`Error getting requests for user ${userId}`, error);
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

      // Update request status
      const now = new Date();
      request.status = status;
      request.lastActivityAt = now;

      // If request is completed or failed, set processedAt
      if (
        status === RequestStatus.COMPLETED ||
        status === RequestStatus.FAILED ||
        status === RequestStatus.CANCELLED ||
        status === RequestStatus.EXPIRED
      ) {
        request.processedAt = now;
      }

      // Get DB entity
      const dbRequest = await this.prismaService.request.findFirst({
        where: {
          external_request_id: requestId,
        },
      });

      // Store result in database result field if provided
      if (dbRequest && result) {
        await this.prismaService.request.update({
          where: {
            id: dbRequest.id,
          },
          data: {
            response_data: result,
            updated_at: now,
          },
        });
      }

      // Update database record
      if (dbRequest) {
        await this.prismaService.request.update({
          where: {
            id: dbRequest.id,
          },
          data: {
            status: status.toString(),
            processed_at:
              status === RequestStatus.COMPLETED ||
              status === RequestStatus.FAILED ||
              status === RequestStatus.CANCELLED ||
              status === RequestStatus.EXPIRED
                ? now
                : undefined,
            updated_at: now,
          },
        });
      }

      // Store updated request in Redis
      const requestRedisKey = `${this.REQUEST_PREFIX}${requestId}`;
      await this.redisService.set(
        requestRedisKey,
        request,
        this.REQUEST_EXPIRY,
      );

      // Log activity
      const redisKey = `${this.REQUEST_PREFIX}${requestId}`;
      await this.redisService.set(redisKey, request, this.REQUEST_EXPIRY);

      // Update database
      await this.prismaService.request.updateMany({
        where: { external_request_id: requestId },
        data: {
          status: status.toString(),
          processed_at:
            status === RequestStatus.COMPLETED ||
            status === RequestStatus.FAILED ||
            status === RequestStatus.CANCELLED ||
            status === RequestStatus.EXPIRED
              ? now
              : undefined,
          updated_at: now,
        },
      });

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
      // First try to get from Redis
      const userRequests = await this.getUserRequests(userId);
      if (userRequests.length > 0) {
        return userRequests;
      }

      // If not in Redis, get from database
      const dbRequests = await this.prismaService.request.findMany({
        where: {
          user_id: userId,
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      // Convert to RequestMetadata format and cache in Redis
      const requests = await Promise.all(
        dbRequests.map((dbRequest) => {
          // Ensure browserId and tabId are not included
          return {
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
        }),
      );

      // Cache each request in Redis
      for (const request of requests) {
        const requestRedisKey = `${this.REQUEST_PREFIX}${request.id}`;
        await this.redisService.set(
          requestRedisKey,
          request,
          this.REQUEST_EXPIRY,
        );

        // Add to user's requests list
        const userRequestsKey = `${this.USER_REQUESTS_PREFIX}${userId}`;
        await this.redisService.lpush(userRequestsKey, request.id);
        await this.redisService.expire(userRequestsKey, this.REQUEST_EXPIRY);
      }

      return requests;
    } catch (error) {
      this.logger.error(`Error listing requests for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Cleanup expired requests (e.g., those older than 24 hours)
   */
  async cleanupExpiredRequests(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    this.logger.debug('Running cleanup of expired requests...');

    // It might be inefficient to get ALL keys if there are many.
    // Consider using SCAN or limiting the initial fetch if performance becomes an issue.
    const allRequestKeys = await this.redisService.keys(
      `${this.REQUEST_PREFIX}*`,
    );

    this.logger.debug(`Found ${allRequestKeys.length} request keys in Redis.`);

    for (const key of allRequestKeys) {
      const requestId = key.substring(this.REQUEST_PREFIX.length);
      try {
        const requestMeta = await this.redisService.get<RequestMetadata>(key);

        if (!requestMeta) {
          this.logger.warn(
            `Metadata for request key ${key} not found, skipping.`,
          );
          continue;
        }

        // Ensure dates are Date objects
        const createdAt = new Date(requestMeta.createdAt);
        const updatedAt = requestMeta.lastActivityAt
          ? new Date(requestMeta.lastActivityAt)
          : createdAt;

        // Check if request is expired based on last activity
        const expiryThreshold = new Date(
          updatedAt.getTime() + this.REQUEST_EXPIRY * 1000,
        );

        this.logger.debug(
          `Checking request ${requestId}: lastActivityAt=${updatedAt.toISOString()}, now=${now.toISOString()}, expiryThreshold=${expiryThreshold.toISOString()}`,
        );

        if (
          now > expiryThreshold &&
          requestMeta.status !== RequestStatus.COMPLETED &&
          requestMeta.status !== RequestStatus.FAILED &&
          requestMeta.status !== RequestStatus.EXPIRED
        ) {
          this.logger.log(
            `Request ${requestId} is expired (last activity: ${updatedAt.toISOString()}). Updating status to EXPIRED.`,
          );

          try {
            this.logger.debug(
              `Calling updateRequestStatus for expired request ${requestId}`,
            );
            await this.updateRequestStatus(requestId, RequestStatus.EXPIRED, {
              reason: 'Request timed out due to inactivity',
            });
            cleanedCount++;
            this.logger.log(
              `Successfully marked request ${requestId} as EXPIRED.`,
            );
          } catch (updateError) {
            this.logger.error(
              `Error updating status for expired request ${requestId}:`,
              updateError,
            );
          }
        } else {
          this.logger.debug(`Request ${requestId} is still valid.`);
        }
      } catch (error) {
        this.logger.error(
          `Error processing request key ${key} during cleanup:`,
          error,
        );
      }
    }

    this.logger.log(
      `Expired request cleanup finished. Marked ${cleanedCount}.`,
    );
    return cleanedCount;
  }

  /**
   * Get count of pending and processing requests
   */
  async getPendingRequestsCount(): Promise<number> {
    try {
      const count = await this.prismaService.request.count({
        where: {
          status: {
            in: [
              RequestStatus.PENDING.toString(),
              RequestStatus.PROCESSING.toString(),
            ],
          },
        },
      });

      return count;
    } catch (error) {
      this.logger.error('Error getting pending requests count', error);
      return 0;
    }
  }
}
