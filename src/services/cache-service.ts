import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../core/storage/redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  forceRefresh?: boolean; // Force a cache refresh
  tags?: string[]; // Tags for cache invalidation
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
  tags: string[];
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly CACHE_PREFIX = 'cache:';
  private readonly DEFAULT_TTL = 3600; // 1 hour in seconds

  constructor(
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * Generate a cache key from the request parameters
   */
  generateCacheKey(requestType: string, params: Record<string, any>): string {
    // Sort keys for consistent hash generation
    const sortedParams = Object.keys(params)
      .sort()
      .reduce(
        (obj, key) => {
          obj[key] = params[key];
          return obj;
        },
        {} as Record<string, any>,
      );

    // Create hash of the parameters
    const paramsString = JSON.stringify(sortedParams);
    const hash = crypto
      .createHash('md5')
      .update(`${requestType}:${paramsString}`)
      .digest('hex');

    return `${this.CACHE_PREFIX}${requestType}:${hash}`;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      // If force refresh, skip cache
      if (options.forceRefresh) {
        return null;
      }

      // Try to get from Redis
      const cachedEntry = await this.redisService.get<CacheEntry<T>>(key);

      if (cachedEntry) {
        // Check if expired
        if (cachedEntry.expiresAt < Date.now()) {
          await this.redisService.del(key);
          return null;
        }

        // Update hit count in database
        await this.updateCacheHitCount(key);

        return cachedEntry.value;
      }

      // Try to get from database
      const dbCache = await this.prismaService.cache.findFirst({
        where: {
          request_hash: key.replace(this.CACHE_PREFIX, ''),
        },
      });

      if (dbCache && new Date(dbCache.expires_at) > new Date()) {
        // Found valid cache entry in database
        const entry: CacheEntry<T> = {
          value: dbCache.response_data as T,
          timestamp: dbCache.created_at.getTime(),
          expiresAt: dbCache.expires_at.getTime(),
          tags: [],
        };

        // Store in Redis for future lookups
        await this.redisService.set(
          key,
          entry,
          Math.floor((entry.expiresAt - Date.now()) / 1000),
        );

        // Update hit count
        await this.updateCacheHitCount(key);

        return entry.value;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error getting cache for key ${key}`, error);
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {},
  ): Promise<void> {
    try {
      const ttl = options.ttl || this.DEFAULT_TTL;
      const now = Date.now();
      const expiresAt = now + ttl * 1000;

      const entry: CacheEntry<T> = {
        value,
        timestamp: now,
        expiresAt,
        tags: options.tags || [],
      };

      // Store in Redis
      await this.redisService.set(key, entry, ttl);

      // Store in database for persistence
      const requestHash = key.replace(this.CACHE_PREFIX, '');

      const existingCache = await this.prismaService.cache.findFirst({
        where: { request_hash: requestHash },
      });

      if (existingCache) {
        // Update existing entry
        await this.prismaService.cache.update({
          where: { id: existingCache.id },
          data: {
            response_data: value as any,
            expires_at: new Date(expiresAt),
            last_accessed_at: new Date(),
          },
        });
      } else {
        // Create new entry
        await this.prismaService.cache.create({
          data: {
            request_hash: requestHash,
            response_data: value as any,
            created_at: new Date(now),
            expires_at: new Date(expiresAt),
            hit_count: 1,
            last_accessed_at: new Date(),
          },
        });
      }
    } catch (error) {
      this.logger.error(`Error setting cache for key ${key}`, error);
      throw error;
    }
  }

  /**
   * Delete a cache entry
   */
  async delete(key: string): Promise<void> {
    try {
      // Delete from Redis
      await this.redisService.del(key);

      // Delete from database
      const requestHash = key.replace(this.CACHE_PREFIX, '');

      await this.prismaService.cache.deleteMany({
        where: { request_hash: requestHash },
      });
    } catch (error) {
      this.logger.error(`Error deleting cache for key ${key}`, error);
      throw error;
    }
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      // For simplicity, we'll implement a basic approach
      // In a production system, you'd want a more sophisticated tag-based invalidation
      // using Redis sets or similar

      // Get all caches from database
      const caches = await this.prismaService.cache.findMany({
        where: {
          expires_at: {
            gt: new Date(),
          },
        },
      });

      let invalidatedCount = 0;

      // Process each cache entry
      for (const cache of caches) {
        // Here we would check if the cache entry has any of the specified tags
        // Since we don't store tags in the database in this implementation,
        // we'll skip this part

        // For demo purposes, let's just delete items that match the tag pattern in the hash
        const matchesTag = tags.some((tag) => cache.request_hash.includes(tag));

        if (matchesTag) {
          // Delete from database
          await this.prismaService.cache.delete({
            where: { id: cache.id },
          });

          // Delete from Redis
          const key = `${this.CACHE_PREFIX}${cache.request_hash}`;
          await this.redisService.del(key);

          invalidatedCount++;
        }
      }

      return invalidatedCount;
    } catch (error) {
      this.logger.error(`Error invalidating cache by tags`, error);
      throw error;
    }
  }

  /**
   * Update the hit count for a cache entry
   */
  private async updateCacheHitCount(key: string): Promise<void> {
    try {
      const requestHash = key.replace(this.CACHE_PREFIX, '');

      await this.prismaService.cache.updateMany({
        where: { request_hash: requestHash },
        data: {
          hit_count: { increment: 1 },
          last_accessed_at: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Error updating cache hit count for ${key}`, error);
      // Don't throw error, as this is a non-critical operation
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredEntries(): Promise<number> {
    try {
      const now = new Date();

      const result = await this.prismaService.cache.deleteMany({
        where: {
          expires_at: {
            lt: now,
          },
        },
      });

      return result.count;
    } catch (error) {
      this.logger.error('Error cleaning up expired cache entries', error);
      throw error;
    }
  }
}
