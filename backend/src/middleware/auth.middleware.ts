import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../services/jwt.service';

export interface AuthRequest extends Request {
  user?: any;
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2) {
      return res.status(401).json({ error: 'Access denied. Invalid token format.' });
    }
    const token = parts[1] as string;

    // Verify token
    const decoded = JwtService.verifyAccessToken(token);
    req.user = decoded;

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please refresh.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};
