import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { RedisService } from './redis.service';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly memory = new Map<
    string,
    { hits: number; expiresAt: number; blockedUntil: number }
  >();

  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const fullKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `${fullKey}:block`;

    if (this.redis.isReady) {
      try {
        const client = this.redis.raw!;
        const blockTtl = await client.pttl(blockKey);
        if (blockTtl > 0) {
          return {
            totalHits: limit + 1,
            timeToExpire: blockTtl,
            isBlocked: true,
            timeToBlockExpire: blockTtl,
          };
        }
        const hits = await client.incr(fullKey);
        if (hits === 1) await client.pexpire(fullKey, ttl);
        let timeToExpire = await client.pttl(fullKey);
        if (timeToExpire < 0) {
          await client.pexpire(fullKey, ttl);
          timeToExpire = ttl;
        }
        if (hits > limit && blockDuration > 0) {
          await client.psetex(blockKey, blockDuration, '1');
          return {
            totalHits: hits,
            timeToExpire,
            isBlocked: true,
            timeToBlockExpire: blockDuration,
          };
        }
        return {
          totalHits: hits,
          timeToExpire,
          isBlocked: hits > limit,
          timeToBlockExpire: 0,
        };
      } catch {
        /* fall through to memory */
      }
    }

    const now = Date.now();
    const current = this.memory.get(fullKey);
    if (current && current.blockedUntil > now) {
      return {
        totalHits: current.hits,
        timeToExpire: current.blockedUntil - now,
        isBlocked: true,
        timeToBlockExpire: current.blockedUntil - now,
      };
    }
    const entry =
      current && current.expiresAt > now
        ? current
        : { hits: 0, expiresAt: now + ttl, blockedUntil: 0 };
    entry.hits += 1;
    if (entry.hits > limit && blockDuration > 0) {
      entry.blockedUntil = now + blockDuration;
    }
    this.memory.set(fullKey, entry);
    return {
      totalHits: entry.hits,
      timeToExpire: Math.max(0, entry.expiresAt - now),
      isBlocked: entry.hits > limit,
      timeToBlockExpire: Math.max(0, entry.blockedUntil - now),
    };
  }
}
