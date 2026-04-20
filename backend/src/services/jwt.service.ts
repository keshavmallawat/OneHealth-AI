import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_min_32_chars';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'another_super_secret_refresh_key';

export class JwtService {
  static generateAccessToken(userId: string, role: string): string {
    return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '15m' });
  }

  static generateRefreshToken(userId: string): string {
    return jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  }

  static verifyAccessToken(token: string): any {
    return jwt.verify(token, JWT_SECRET);
  }

  static verifyRefreshToken(token: string): any {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  }
}
