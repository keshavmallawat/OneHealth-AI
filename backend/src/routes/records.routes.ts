import { Router } from 'express';
import { RecordsController } from '../controllers/records.controller';
import { verifyToken } from '../middleware/auth.middleware';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { requireRole, checkRecordAccess } from '../middleware/rbac.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Apply auth middleware to all records routes
router.use(verifyToken);

router.post('/upload', requireRole([Role.PATIENT]), uploadMiddleware.single('file'), RecordsController.uploadRecord);
router.get('/:id/url', checkRecordAccess, RecordsController.getFileAccessUrl);
router.get('/', requireRole([Role.PATIENT]), RecordsController.listMyRecords);

export default router;
