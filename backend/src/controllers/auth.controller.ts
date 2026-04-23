import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { JwtService } from '../services/jwt.service';
import { CryptoService } from '../services/crypto.service';
import { RedisService } from '../services/redis.service';
import { OtpService } from '../services/otp.service';

const prisma = new PrismaClient();

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

export class AuthController {
  
  static async signup(req: Request, res: Response) {
    try {
      const parsed = signupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const { name, email, password, phone } = parsed.data;

      const emailHash = CryptoService.hash(email);
      const emailEncrypted = CryptoService.encrypt(email);
      
      let phoneHash = null;
      let phoneEncrypted = null;
      if (phone) {
        phoneHash = CryptoService.hash(phone);
        phoneEncrypted = CryptoService.encrypt(phone);
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { emailHash } });
      if (existingUser) {
        return res.status(409).json({ error: 'Email already in use' });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          name,
          emailHash,
          emailEncrypted,
          phoneHash,
          phoneEncrypted,
          passwordHash,
        }
      });

      // Generate tokens
      const accessToken = JwtService.generateAccessToken(user.id, user.role);
      const refreshToken = JwtService.generateRefreshToken(user.id);

      // Set cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      return res.status(201).json({
        message: 'User registered successfully',
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email, // return plaintext to client
          role: user.role
        }
      });
    } catch (err: any) {
      console.error("REGISTER ERROR:", err);
      return res.status(500).json({ error: err.message || "Server error" });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const { email, password } = parsed.data;

      const emailHash = CryptoService.hash(email);
      const user = await prisma.user.findUnique({ where: { emailHash } });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const accessToken = JwtService.generateAccessToken(user.id, user.role);
      const refreshToken = JwtService.generateRefreshToken(user.id);

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return res.json({
        message: 'Login successful',
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: CryptoService.decrypt(user.emailEncrypted),
          role: user.role
        }
      });
    } catch (err: any) {
      console.error("LOGIN ERROR:", err);
      return res.status(500).json({ error: err.message || "Server error" });
    }
  }

  static async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.cookies;
      if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token provided' });
      }

      const isBlacklisted = await RedisService.isBlacklisted(refreshToken);
      if (isBlacklisted) {
        return res.status(401).json({ error: 'Refresh token has been revoked' });
      }

      let payload: any;
      try {
        payload = JwtService.verifyRefreshToken(refreshToken);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Blacklist old refresh token to implement rotation (prevent reuse)
      await RedisService.blacklistToken(refreshToken, 7 * 24 * 60 * 60);

      // Issue new tokens
      const newAccessToken = JwtService.generateAccessToken(user.id, user.role);
      const newRefreshToken = JwtService.generateRefreshToken(user.id);

      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return res.json({
        message: 'Token refreshed',
        accessToken: newAccessToken
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.cookies;
      if (refreshToken) {
        await RedisService.blacklistToken(refreshToken, 7 * 24 * 60 * 60);
        res.clearCookie('refreshToken');
      }
      return res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async sendOtp(req: Request, res: Response) {
    try {
      const { identifier } = req.body; // email or phone
      if (!identifier) {
        return res.status(400).json({ error: 'Identifier required' });
      }

      // Check 60 seconds cooldown
      const ttl = await RedisService.getOtpTTL(identifier);
      if (ttl > 240) {
        return res.status(429).json({ error: `Please wait ${ttl - 240} seconds before requesting a new OTP.` });
      }

      const otp = OtpService.generateOTP();
      const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

      await RedisService.setOTPData(identifier, { hash: hashedOtp, attempts: 0 }, 300); // 5 min TTL
      
      // Reset the verify attempts whenever a new OTP is sent
      await RedisService.deleteRateLimit(`rl:otp_verify:${identifier}`);
      
      await OtpService.sendOTP(identifier, otp);

      return res.json({ message: 'OTP sent successfully' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async verifyOtp(req: Request, res: Response) {
    try {
      const { identifier, otp } = req.body;
      if (!identifier || !otp) {
        return res.status(400).json({ error: 'Identifier and OTP required' });
      }

      const storedData = await RedisService.getOTPData(identifier);
      if (!storedData) {
        return res.status(400).json({ error: 'OTP expired or not requested' });
      }

      if (storedData.attempts >= 5) {
        await RedisService.deleteOTP(identifier);
        return res.status(429).json({ error: 'Too many failed attempts. Request a new OTP.' });
      }

      const hashedInput = crypto.createHash('sha256').update(otp).digest('hex');
      
      if (storedData.hash !== hashedInput) {
        storedData.attempts += 1;
        if (storedData.attempts >= 5) {
          await RedisService.deleteOTP(identifier);
          return res.status(429).json({ error: 'Too many failed attempts. Request a new OTP.' });
        } else {
          await RedisService.updateOTPData(identifier, storedData);
          return res.status(400).json({ error: 'Invalid OTP' });
        }
      }

      await RedisService.deleteOTP(identifier);

      // If this is a login attempt via OTP, lookup user by hashed identifier
      const identHash = CryptoService.hash(identifier);
      let user = await prisma.user.findUnique({ where: { emailHash: identHash } });
      
      if (!user) {
        // Might be a phone login
        const usersByPhone = await prisma.user.findMany({ where: { phoneHash: identHash } });
        if (usersByPhone.length > 0) user = usersByPhone[0];
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found for this identifier' });
      }

      // Generate tokens
      const accessToken = JwtService.generateAccessToken(user.id, user.role);
      const refreshToken = JwtService.generateRefreshToken(user.id);

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return res.json({
        message: 'OTP verified successfully',
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async me(req: any, res: Response) {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json({
        user: {
          id: user.id,
          name: user.name,
          email: CryptoService.decrypt(user.emailEncrypted),
          role: user.role
        }
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
