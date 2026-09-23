import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

const loginLimiter = rateLimit(5, 60, 'rl:login', (req) => req.ip);
// 10/minute per IP still stops automated account creation, but does not lock
// out a shared network (a clinic, a lab, a classroom) where several people
// legitimately register within a minute of each other.
const signupLimiter = rateLimit(10, 60, 'rl:signup', (req) => req.ip);
const otpSendLimiter = rateLimit(3, 300, 'rl:otp_send', (req) => req.body.identifier || req.ip);
const otpVerifyLimiter = rateLimit(5, 300, 'rl:otp_verify', (req) => req.body.identifier || req.ip);

import { verifyToken } from '../middleware/auth.middleware';

router.post('/signup', signupLimiter, AuthController.signup);
router.post('/register', signupLimiter, AuthController.signup);
router.post('/login', loginLimiter, AuthController.login);
router.get('/me', verifyToken, AuthController.me);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post('/otp/send', otpSendLimiter, AuthController.sendOtp);
router.post('/otp/verify', otpVerifyLimiter, AuthController.verifyOtp);

export default router;
