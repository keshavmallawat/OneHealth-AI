import { Router } from 'express';
import { RecordsController } from '../controllers/records.controller';
import { verifyToken } from '../middleware/auth.middleware';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { requireRole, checkRecordAccess } from '../middleware/rbac.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Apply auth middleware to all records routes
router.use(verifyToken);

// CREATE
router.post('/upload', requireRole([Role.PATIENT]), uploadMiddleware.single('file'), RecordsController.uploadRecord);

// READ (List)
router.get('/', requireRole([Role.PATIENT]), RecordsController.listRecords);

// READ (Single)
router.get('/:id', checkRecordAccess, RecordsController.getRecord);

// UPDATE
router.patch('/:id', requireRole([Role.PATIENT]), checkRecordAccess, RecordsController.updateRecord);

// DELETE
router.delete('/:id', requireRole([Role.PATIENT]), checkRecordAccess, RecordsController.deleteRecord);

// Deprecated (aliased to getRecord)
router.get('/:id/url', checkRecordAccess, RecordsController.getFileAccessUrl);

export default router;
