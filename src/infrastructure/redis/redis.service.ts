import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../../config/env';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private ready = false;

  async onModuleInit() {
    this.client = new Redis(env.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    this.client.on('error', () => undefined);
    try {
      await this.client.connect();
      this.ready = true;
      this.logger.log(`Redis terhubung: ${env.redisUrl}`);
    } catch {
      this.ready = false;
      this.logger.warn('Redis tidak tersedia, cache/throttle memakai memori');
    }
  }

  async onModuleDestroy() {
    try {
      await this.client?.quit();
    } catch {
      this.client?.disconnect();
    }
  }

  get isReady() {
    return this.ready && this.client?.status === 'ready';
  }

  get raw() {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    if (!this.isReady) return null;
    try {
      return await this.client!.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isReady) return;
    try {
      if (ttlSeconds) await this.client!.set(key, value, 'EX', ttlSeconds);
      else await this.client!.set(key, value);
    } catch {
      /* ignore */
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.isReady || keys.length === 0) return;
    try {
      await this.client!.del(...keys);
    } catch {
      /* ignore */
    }
  }

  async delByPrefix(prefix: string): Promise<void> {
    if (!this.isReady) return;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.client!.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length) await this.client!.del(...keys);
      } while (cursor !== '0');
    } catch {
      /* ignore */
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number) {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }
}
