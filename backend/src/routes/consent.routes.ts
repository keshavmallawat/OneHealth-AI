/**
 * Consent routes.
 *
 * Role guards are applied per route, so a doctor cannot call a patient's
 * decision endpoints and a patient cannot call the provider endpoints — the
 * distinction is enforced by the router, not by which page rendered.
 */
import { Router } from 'express';
import { Role } from '@prisma/client';
import { ConsentController } from '../controllers/consent.controller';
import { verifyToken } from '../middleware/auth.middleware';
import { checkPatientAccess, requireRole } from '../middleware/rbac.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();
router.use(verifyToken);

// Shared: each side sees only its own half of the relationship.
router.get('/', ConsentController.list);

// --- Patient ---------------------------------------------------------------
router.get('/directory', requireRole([Role.PATIENT]), ConsentController.directory);
router.post('/grant', requireRole([Role.PATIENT]), ConsentController.grant);
// Declared explicitly rather than as one parameterised route: Express 5 no
// longer accepts inline regex in a path, and three named routes read better.
router.post('/:id/approve', requireRole([Role.PATIENT]), ConsentController.decide);
router.post('/:id/reject', requireRole([Role.PATIENT]), ConsentController.decide);
router.post('/:id/revoke', requireRole([Role.PATIENT]), ConsentController.decide);

// --- Doctor ----------------------------------------------------------------
// Rate limited: this is the one endpoint that takes a patient-supplied code,
// so it is also the one that could be brute-forced.
router.post(
  '/request',
  requireRole([Role.DOCTOR]),
  rateLimit(10, 300, 'rl:consent_request', (req: any) => req.user?.userId || req.ip),
  ConsentController.request
);
router.get('/patients', requireRole([Role.DOCTOR]), ConsentController.patients);
router.get('/patients/:patientId', requireRole([Role.DOCTOR]), checkPatientAccess, ConsentController.patientDetail);

export default router;
