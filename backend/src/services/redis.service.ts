import Redis from 'ioredis';

// Connect to Redis mapped on 6379 in Docker
export const redisClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

export class RedisService {
  /**
   * Store OTP data in Redis with TTL (e.g., 300 seconds for 5 minutes)
   */
  static async setOTPData(identifier: string, data: any, ttlSeconds: number = 300): Promise<void> {
    await redisClient.setex(`otp:${identifier}`, ttlSeconds, JSON.stringify(data));
  }

  /**
   * Get OTP data from Redis
   */
  static async getOTPData(identifier: string): Promise<any | null> {
    const data = await redisClient.get(`otp:${identifier}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Update OTP data while keeping existing TTL
   */
  static async updateOTPData(identifier: string, data: any): Promise<void> {
    const ttl = await redisClient.ttl(`otp:${identifier}`);
    if (ttl > 0) {
      await redisClient.setex(`otp:${identifier}`, ttl, JSON.stringify(data));
    }
  }

  /**
   * Get TTL of an OTP key to enforce cooldown
   */
  static async getOtpTTL(identifier: string): Promise<number> {
    return await redisClient.ttl(`otp:${identifier}`);
  }

  /**
   * Delete OTP after successful verification
   */
  static async deleteOTP(identifier: string): Promise<void> {
    await redisClient.del(`otp:${identifier}`);
  }

  /**
   * Blacklist a refresh token
   */
  static async blacklistToken(token: string, expiresInSeconds: number): Promise<void> {
    await redisClient.setex(`blacklist:${token}`, expiresInSeconds, 'true');
  }

  /**
   * Check if a token is blacklisted
   */
  static async isBlacklisted(token: string): Promise<boolean> {
    const result = await redisClient.get(`blacklist:${token}`);
    return result === 'true';
  }

  /**
   * Increments a rate limit counter and sets TTL if it's new.
   */
  static async incrementRateLimit(key: string, ttlSeconds: number): Promise<number> {
    const count = await redisClient.incr(key);
    if (count === 1) {
      await redisClient.expire(key, ttlSeconds);
    }
    return count;
  }

  /**
   * Deletes a rate limit key.
   */
  static async deleteRateLimit(key: string): Promise<void> {
    await redisClient.del(key);
  }
}
