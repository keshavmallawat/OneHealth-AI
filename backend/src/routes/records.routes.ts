import { Router } from 'express';
import { RecordsController } from '../controllers/records.controller';
import { verifyToken } from '../middleware/auth.middleware';
import { uploadMiddleware, handleUploadErrors } from '../middleware/upload.middleware';
import { requireRole, checkRecordAccess, checkPatientAccess } from '../middleware/rbac.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Every route below requires a valid access token.
router.use(verifyToken);

// --- Aggregates (declared before /:id so they are not captured by it) --------
router.get('/stats', requireRole([Role.PATIENT]), RecordsController.getStats);
router.get('/trends', requireRole([Role.PATIENT]), RecordsController.getTrends);
router.get('/compare', requireRole([Role.PATIENT]), RecordsController.compare);
router.get('/activity', requireRole([Role.PATIENT]), RecordsController.getActivity);
router.get('/summary.pdf', requireRole([Role.PATIENT]), RecordsController.exportSummary);

// Provider views of an authorised patient. checkPatientAccess re-verifies the
// consent on every call, so reaching the doctor UI grants nothing by itself.
router.get(
  '/patients/:patientId/trends',
  requireRole([Role.DOCTOR]),
  checkPatientAccess,
  RecordsController.getTrends
);
router.get(
  '/patients/:patientId/summary.pdf',
  requireRole([Role.DOCTOR]),
  checkPatientAccess,
  RecordsController.exportSummary
);

// --- CRUD -------------------------------------------------------------------
router.post(
  '/upload',
  requireRole([Role.PATIENT]),
  uploadMiddleware.single('file'),
  handleUploadErrors,
  RecordsController.uploadRecord
);

router.get('/', requireRole([Role.PATIENT]), RecordsController.listRecords);
router.get('/:id', checkRecordAccess, RecordsController.getRecord);

// Authenticated file access. Ownership (or consent) is re-checked on every
// request; there is no unauthenticated route to an uploaded document.
router.get('/:id/file', checkRecordAccess, RecordsController.streamFile);

router.post(
  '/:id/reprocess',
  requireRole([Role.PATIENT]),
  checkRecordAccess,
  RecordsController.reprocessRecord
);

router.patch('/:id', requireRole([Role.PATIENT]), checkRecordAccess, RecordsController.updateRecord);
router.delete('/:id', requireRole([Role.PATIENT]), checkRecordAccess, RecordsController.deleteRecord);

// Deprecated alias kept for backwards compatibility.
router.get('/:id/url', checkRecordAccess, RecordsController.getFileAccessUrl);

export default router;
