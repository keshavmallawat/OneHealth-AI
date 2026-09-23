import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const JWT_SECRET = env.JWT_SECRET;
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;

export class JwtService {
  static generateAccessToken(userId: string, role: string, name?: string): string {
    return jwt.sign({ userId, role, name }, JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL as any });
  }

  static generateRefreshToken(userId: string): string {
    return jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: env.REFRESH_TOKEN_TTL as any });
  }

  static verifyAccessToken(token: string): any {
    return jwt.verify(token, JWT_SECRET);
  }

  static verifyRefreshToken(token: string): any {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  }
}
