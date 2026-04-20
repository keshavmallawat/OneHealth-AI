import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../services/redis.service';

/**
 * Creates a rate limiting middleware using Redis.
 * @param maxRequests Maximum number of requests allowed in the window
 * @param windowSeconds The time window in seconds
 * @param keyPrefix A prefix for the Redis key to separate different limits
 * @param keyGenerator A function that takes the request and returns the unique key (e.g., IP, email)
 */
export const rateLimit = (
  maxRequests: number,
  windowSeconds: number,
  keyPrefix: string,
  keyGenerator: (req: Request) => string | undefined
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const uniqueIdentifier = keyGenerator(req);
      if (!uniqueIdentifier) {
        return next(); 
      }

      const key = `${keyPrefix}:${uniqueIdentifier}`;
      const count = await RedisService.incrementRateLimit(key, windowSeconds);

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));

      if (count > maxRequests) {
        return res.status(429).json({ error: 'Too Many Requests. Please try again later.' });
      }

      next();
    } catch (error) {
      console.error('Rate limit error:', error);
      // Fail open to avoid blocking users if Redis is temporarily down
      next();
    }
  };
};
