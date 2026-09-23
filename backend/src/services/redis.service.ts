/**
 * Redis-backed short-lived state: OTP codes, refresh-token blacklist, rate limits.
 *
 * IMPORTANT BEHAVIOUR: Redis is treated as an optimisation, not a hard
 * dependency. If it is unreachable (very common on a development machine
 * without Docker running) the service transparently falls back to an in-process
 * store with the same TTL semantics, and the application keeps working.
 *
 * The fallback is single-process and non-durable, which is correct for local
 * development and demonstration. In production Redis should be present; the
 * banner printed at boot makes it obvious which mode is active.
 */
import Redis from 'ioredis';
import { env } from '../config/env';

/** Minimal TTL map used when Redis is unavailable. */
class InMemoryStore {
  private data = new Map<string, { value: string; expiresAt: number }>();

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.data) {
      if (entry.expiresAt <= now) this.data.delete(key);
    }
  }

  get(key: string): string | null {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  setex(key: string, ttlSeconds: number, value: string): void {
    if (this.data.size > 5000) this.sweep();
    this.data.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  del(key: string): void {
    this.data.delete(key);
  }

  ttl(key: string): number {
    const entry = this.data.get(key);
    if (!entry) return -2;
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  incr(key: string, ttlSeconds: number): number {
    const current = this.get(key);
    const next = (current ? parseInt(current, 10) : 0) + 1;
    const existingTtl = this.ttl(key);
    this.setex(key, existingTtl > 0 ? existingTtl : ttlSeconds, String(next));
    return next;
  }
}

const memory = new InMemoryStore();

let redisClient: Redis | null = null;
let redisUsable = false;
let warnedOnce = false;

if (env.REDIS_ENABLED) {
  redisClient = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    // Give up reconnecting after a few attempts instead of logging forever.
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
    enableOfflineQueue: false,
  });

  redisClient.on('ready', () => {
    redisUsable = true;
    console.log('   Redis          : connected');
  });

  redisClient.on('error', () => {
    if (redisUsable || !warnedOnce) {
      warnedOnce = true;
      console.warn('   Redis          : unavailable - using in-memory fallback for OTP / rate limits / token blacklist');
    }
    redisUsable = false;
  });

  redisClient.connect().catch(() => {
    redisUsable = false;
  });
}

export { redisClient };

/** True when a real Redis connection is currently serving requests. */
export function isRedisConnected(): boolean {
  return redisUsable;
}

/** Run a Redis operation, silently falling back to memory on any failure. */
async function withRedis<T>(operation: (client: Redis) => Promise<T>, fallback: () => T): Promise<T> {
  if (redisUsable && redisClient) {
    try {
      return await operation(redisClient);
    } catch {
      redisUsable = false;
    }
  }
  return fallback();
}

export class RedisService {
  static async setOTPData(identifier: string, data: any, ttlSeconds = 300): Promise<void> {
    const payload = JSON.stringify(data);
    await withRedis(
      async (client) => {
        await client.setex(`otp:${identifier}`, ttlSeconds, payload);
      },
      () => memory.setex(`otp:${identifier}`, ttlSeconds, payload)
    );
  }

  static async getOTPData(identifier: string): Promise<any | null> {
    const value = await withRedis(
      (client) => client.get(`otp:${identifier}`),
      () => memory.get(`otp:${identifier}`)
    );
    return value ? JSON.parse(value) : null;
  }

  static async updateOTPData(identifier: string, data: any): Promise<void> {
    const ttl = await RedisService.getOtpTTL(identifier);
    if (ttl > 0) {
      await RedisService.setOTPData(identifier, data, ttl);
    }
  }

  static async getOtpTTL(identifier: string): Promise<number> {
    return withRedis(
      (client) => client.ttl(`otp:${identifier}`),
      () => memory.ttl(`otp:${identifier}`)
    );
  }

  static async deleteOTP(identifier: string): Promise<void> {
    await withRedis(
      async (client) => {
        await client.del(`otp:${identifier}`);
      },
      () => memory.del(`otp:${identifier}`)
    );
  }

  static async blacklistToken(token: string, expiresInSeconds: number): Promise<void> {
    await withRedis(
      async (client) => {
        await client.setex(`blacklist:${token}`, expiresInSeconds, 'true');
      },
      () => memory.setex(`blacklist:${token}`, expiresInSeconds, 'true')
    );
  }

  static async isBlacklisted(token: string): Promise<boolean> {
    const value = await withRedis(
      (client) => client.get(`blacklist:${token}`),
      () => memory.get(`blacklist:${token}`)
    );
    return value === 'true';
  }

  static async incrementRateLimit(key: string, ttlSeconds: number): Promise<number> {
    return withRedis(
      async (client) => {
        const count = await client.incr(key);
        if (count === 1) await client.expire(key, ttlSeconds);
        return count;
      },
      () => memory.incr(key, ttlSeconds)
    );
  }

  static async deleteRateLimit(key: string): Promise<void> {
    await withRedis(
      async (client) => {
        await client.del(key);
      },
      () => memory.del(key)
    );
  }
}
