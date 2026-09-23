import { Request, Response } from 'express';

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { JwtService } from '../services/jwt.service';
import { CryptoService } from '../services/crypto.service';
import { RedisService } from '../services/redis.service';
import { OtpService } from '../services/otp.service';
import { prisma } from '../config/database';
import { Role } from '@prisma/client';
import { IdentityService } from '../services/identity.service';


const signupSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name').max(80),
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), {
      message: 'Password must contain at least one letter and one number',
    }),
  phone: z.string().trim().min(6).max(20).optional(),
  // Only these two roles are self-registerable. ADMIN is never granted here,
  // so the enum is the guard rather than a filter applied afterwards.
  role: z.enum(['PATIENT', 'DOCTOR']).default('PATIENT'),
  specialization: z.string().trim().max(80).optional(),
  clinicName: z.string().trim().max(120).optional(),
  registrationNumber: z.string().trim().max(60).optional(),
  city: z.string().trim().max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});


/**
 * Refresh-token cookie, plus a readable hint cookie.
 *
 * The refresh token itself stays HttpOnly so JavaScript can never read it. The
 * hint carries no secret — it only tells the SPA that a session probably
 * exists, so a first visit by a signed-out user does not fire a doomed refresh
 * request and log a 401 in the console.
 */
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function setSessionCookies(res: Response, refreshToken: string) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: REFRESH_MAX_AGE,
  });
  res.cookie('oh_session', '1', {
    httpOnly: false,
    secure,
    sameSite: 'strict',
    maxAge: REFRESH_MAX_AGE,
  });
}

function clearSessionCookies(res: Response) {
  res.clearCookie('refreshToken');
  res.clearCookie('oh_session');
}

export class AuthController {
  
  static async signup(req: Request, res: Response) {
    try {
      const parsed = signupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const {
        name, email, password, phone, role,
        specialization, clinicName, registrationNumber, city,
      } = parsed.data;

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
        return res.status(409).json({ error: 'An account with this email already exists.' });
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
          role: role as Role,
          // Patients get a share code at signup so they can hand it to a
          // clinician without exposing their email address.
          shareCode: role === 'PATIENT' ? await IdentityService.generateShareCode() : null,
          ...(role === 'DOCTOR'
            ? {
                specialization: specialization || null,
                clinicName: clinicName || null,
                registrationNumber: registrationNumber || null,
                city: city || null,
              }
            : {}),
        }
      });

      // Generate tokens
      const accessToken = JwtService.generateAccessToken(user.id, user.role, user.name);
      const refreshToken = JwtService.generateRefreshToken(user.id);

      // Set cookie
      setSessionCookies(res, refreshToken);

      return res.status(201).json({
        message: 'User registered successfully',
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email, // return plaintext to client
          role: user.role,
          shareCode: user.shareCode,
        }
      });
    } catch (err: any) {
      console.error("REGISTER ERROR:", err);
      return res.status(500).json({ error: "Service temporarily unavailable. Please try again." });
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

      const accessToken = JwtService.generateAccessToken(user.id, user.role, user.name);
      const refreshToken = JwtService.generateRefreshToken(user.id);

      setSessionCookies(res, refreshToken);

      return res.json({
        message: 'Login successful',
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: CryptoService.decrypt(user.emailEncrypted),
          role: user.role,
          shareCode: user.shareCode,
        }
      });
    } catch (err: any) {
      console.error("LOGIN ERROR:", err);
      return res.status(500).json({ error: "Service temporarily unavailable. Please try again." });
    }
  }

  static async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.cookies;
      if (!refreshToken) {
        clearSessionCookies(res);
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
        clearSessionCookies(res);
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Blacklist old refresh token to implement rotation (prevent reuse)
      await RedisService.blacklistToken(refreshToken, 7 * 24 * 60 * 60);

      // Issue new tokens
      const newAccessToken = JwtService.generateAccessToken(user.id, user.role, user.name);
      const newRefreshToken = JwtService.generateRefreshToken(user.id);

      setSessionCookies(res, newRefreshToken);

      return res.json({
        message: 'Token refreshed',
        accessToken: newAccessToken
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Service temporarily unavailable. Please try again.' });
    }
  }

  static async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.cookies;
      if (refreshToken) {
        await RedisService.blacklistToken(refreshToken, 7 * 24 * 60 * 60);
      }
      clearSessionCookies(res);
      return res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Service temporarily unavailable. Please try again.' });
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
      return res.status(500).json({ error: 'Service temporarily unavailable. Please try again.' });
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
      const accessToken = JwtService.generateAccessToken(user.id, user.role, user.name);
      const refreshToken = JwtService.generateRefreshToken(user.id);

      setSessionCookies(res, refreshToken);

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
      return res.status(500).json({ error: 'Service temporarily unavailable. Please try again.' });
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
          role: user.role,
          shareCode: user.shareCode,
        }
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Service temporarily unavailable. Please try again.' });
    }
  }
}
