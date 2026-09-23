import { Router } from 'express';
import { Role } from '@prisma/client';
import { AssistantController } from '../controllers/assistant.controller';
import { verifyToken } from '../middleware/auth.middleware';
import { checkPatientAccess, requireRole } from '../middleware/rbac.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();
router.use(verifyToken);

const askLimiter = rateLimit(30, 300, 'rl:assistant', (req: any) => req.user?.userId || req.ip);

router.get('/suggestions', requireRole([Role.PATIENT]), AssistantController.suggestions);
router.post('/ask', requireRole([Role.PATIENT]), askLimiter, AssistantController.ask);

// A clinician may ask about a patient they hold consent for; the middleware is
// what establishes which patient, never the request body.
router.post(
  '/patients/:patientId/ask',
  requireRole([Role.DOCTOR]),
  checkPatientAccess,
  askLimiter,
  AssistantController.ask
);

export default router;
