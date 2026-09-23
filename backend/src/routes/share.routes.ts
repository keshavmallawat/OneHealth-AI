import { Router } from 'express';
import { Role } from '@prisma/client';
import { ShareController } from '../controllers/share.controller';
import { verifyToken } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();
router.use(verifyToken);

router.get('/sessions', requireRole([Role.PATIENT]), ShareController.list);
router.post('/sessions', requireRole([Role.PATIENT]), ShareController.create);
router.post('/sessions/:id/revoke', requireRole([Role.PATIENT]), ShareController.revoke);

// Redeeming is the sensitive direction, so it is rate limited per clinician:
// a valid token cannot be found by guessing.
router.post(
  '/redeem',
  requireRole([Role.DOCTOR]),
  rateLimit(10, 300, 'rl:share_redeem', (req: any) => req.user?.userId || req.ip),
  ShareController.redeem
);

export default router;
