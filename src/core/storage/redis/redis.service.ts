/* eslint-disable @typescript-eslint/no-unsafe-return */

import Redis, { RedisOptions } from 'ioredis';
import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private defaultConnection!: Redis;

  constructor() {
    const redisOptions: RedisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times: number) => {
        if (times > 3) {
          throw new Error('Redis connection failed');
        }
        return Math.min(times * 1000, 3000);
      },
    };

    this.defaultConnection = new Redis(redisOptions);
  }

  async onModuleInit() {
    try {
      await this.isConnected();
      this.logger.log('Redis connection established');
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.defaultConnection.quit();
    this.logger.log('Redis connection closed');
  }

  public async isConnected(connection = this.defaultConnection) {
    this.logger.debug('CMD: Ping');
    const ping = await connection.ping();
    if (ping !== 'PONG') {
      throw new HttpException(
        'Redis disconnected.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async set(key: string, value: any, ttl?: number): Promise<void> {
    this.logger.debug(`CMD: Set ${key}`);
    if (ttl) {
      await this.defaultConnection.set(key, JSON.stringify(value), 'EX', ttl);
    } else {
      await this.defaultConnection.set(key, JSON.stringify(value));
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    this.logger.debug(`CMD: Get ${key}`);
    const value = await this.defaultConnection.get(key);
    return value ? JSON.parse(value) : null;
  }

  public async del(key: string): Promise<void> {
    this.logger.debug(`CMD: Del ${key}`);
    await this.defaultConnection.del(key);
  }

  public async exists(key: string): Promise<boolean> {
    this.logger.debug(`CMD: Exists ${key}`);
    const result = await this.defaultConnection.exists(key);
    return result === 1;
  }

  public async ttl(key: string): Promise<number> {
    this.logger.debug(`CMD: TTL ${key}`);
    return await this.defaultConnection.ttl(key);
  }

  public async lpush(key: string, value: string | string[]): Promise<number> {
    this.logger.debug(`CMD: LPUSH ${key}`);
    if (Array.isArray(value)) {
      return await this.defaultConnection.lpush(key, ...value);
    }
    return await this.defaultConnection.lpush(key, value);
  }

  public async lrange(
    key: string,
    start: number,
    stop: number,
  ): Promise<string[]> {
    this.logger.debug(`CMD: LRANGE ${key} ${start} ${stop}`);
    return await this.defaultConnection.lrange(key, start, stop);
  }

  async zAdd(key: string, score: number, member: string): Promise<number> {
    this.logger.debug(`CMD: ZADD ${key} ${score} ${member}`);
    return await this.defaultConnection.zadd(key, score, member);
  }

  async zPopMin(key: string): Promise<string[] | null> {
    this.logger.debug(`CMD: ZPOPMIN ${key}`);
    return await this.defaultConnection.zpopmin(key);
  }

  public async expire(key: string, seconds: number): Promise<number> {
    this.logger.debug(`CMD: EXPIRE ${key} ${seconds}`);
    return await this.defaultConnection.expire(key, seconds);
  }

  /**
   * Get all keys matching a pattern
   * @param pattern Pattern to match keys
   * @returns Promise resolving to array of matching keys
   */
  public async keys(pattern: string): Promise<string[]> {
    this.logger.debug(`CMD: KEYS ${pattern}`);
    try {
      return await this.defaultConnection.keys(pattern);
    } catch (error) {
      this.logger.error(
        `Error executing KEYS command with pattern ${pattern}`,
        error,
      );
      throw new HttpException(
        'Redis operation failed.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
