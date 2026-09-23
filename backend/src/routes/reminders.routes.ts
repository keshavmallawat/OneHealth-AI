import { Router } from 'express';
import { Role } from '@prisma/client';
import { RemindersController } from '../controllers/reminders.controller';
import { verifyToken } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';

const router = Router();
router.use(verifyToken, requireRole([Role.PATIENT]));

router.get('/', RemindersController.list);
router.post('/', RemindersController.create);
router.patch('/:id', RemindersController.update);
router.delete('/:id', RemindersController.remove);

export default router;
