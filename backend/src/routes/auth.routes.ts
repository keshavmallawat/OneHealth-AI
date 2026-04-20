import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

const loginLimiter = rateLimit(5, 60, 'rl:login', (req) => req.ip);
const signupLimiter = rateLimit(3, 60, 'rl:signup', (req) => req.ip);
const otpSendLimiter = rateLimit(3, 300, 'rl:otp_send', (req) => req.body.identifier || req.ip);
const otpVerifyLimiter = rateLimit(5, 300, 'rl:otp_verify', (req) => req.body.identifier || req.ip);

router.post('/signup', signupLimiter, AuthController.signup);
router.post('/login', loginLimiter, AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post('/otp/send', otpSendLimiter, AuthController.sendOtp);
router.post('/otp/verify', otpVerifyLimiter, AuthController.verifyOtp);

export default router;
