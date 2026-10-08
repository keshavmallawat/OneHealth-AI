import { Router } from 'express';
import { UsersController } from '../controllers/users.controller';
import { verifyToken } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { Role } from '@prisma/client';

const router = Router();
router.use(verifyToken);

router.get('/me/profile', UsersController.getProfile);
router.patch('/me/profile', UsersController.updateProfile);
router.get('/me/emergency-card', requireRole([Role.PATIENT]), UsersController.getEmergencyCard);
router.post('/me/share-code/rotate', requireRole([Role.PATIENT]), UsersController.rotateShareCode);

export default router;
