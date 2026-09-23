/**
 * Role and ownership enforcement.
 *
 * These checks are the security boundary of the product. They run on every
 * protected request and read the database each time, so a revoked consent stops
 * working immediately and no client-side state can influence the outcome.
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { ProcessStatus, Role } from '@prisma/client';
import { prisma } from '../config/database';
import { ConsentService } from '../services/consent.service';

function deny(res: Response, status: number, message: string) {
  return res.status(status).json({ success: false, data: null, message, error: message });
}

/** Ensures the authenticated user holds one of the allowed roles. */
export const requireRole = (roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      return deny(res, 401, 'Unauthorized: no role on this session');
    }
    if (!roles.includes(req.user.role)) {
      return deny(res, 403, 'Forbidden: your account does not have access to this area');
    }
    next();
  };
};

/**
 * Authorises access to one health record and attaches it to the request.
 *
 * Patients reach their own records. Doctors reach a record only through a live
 * consent, which is re-checked here on every single request — including direct
 * API calls that never touched the doctor UI. `req.consent` is set when access
 * came via consent so controllers can log the correct subject.
 */
export const checkRecordAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role as Role;
    const recordId = req.params.id as string;

    if (!recordId) return deny(res, 400, 'A record id is required');

    const record = await prisma.healthRecord.findUnique({ where: { id: recordId } });

    // A deleted record is indistinguishable from a missing one for everyone but
    // an admin, so a soft delete cannot be detected by probing.
    if (!record || (record.status === ProcessStatus.DELETED && userRole !== Role.ADMIN)) {
      return deny(res, 404, 'Record not found');
    }

    (req as any).record = record;

    if (userRole === Role.ADMIN) return next();

    if (userRole === Role.PATIENT) {
      if (record.userId === userId) return next();
      return deny(res, 403, 'Forbidden: this record belongs to another patient');
    }

    if (userRole === Role.DOCTOR) {
      const consent = await ConsentService.findActive(userId, record.userId);
      if (!consent) {
        return deny(
          res,
          403,
          'Forbidden: you do not hold an active consent for this patient'
        );
      }
      if (!ConsentService.covers(consent, 'RECORDS')) {
        return deny(res, 403, 'Forbidden: this consent does not cover medical records');
      }
      (req as any).consent = consent;
      void ConsentService.touch(consent.id);
      return next();
    }

    return deny(res, 403, 'Forbidden: unrecognised role');
  } catch (error) {
    console.error('[rbac] record authorisation failed:', error);
    return deny(res, 500, 'Authorisation check failed');
  }
};

/**
 * Authorises access to a whole patient (used by the provider views).
 * Reads `req.params.patientId` and attaches `req.patientId` / `req.consent`.
 */
export const checkPatientAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role as Role;
    const patientId = (req.params.patientId || req.query.patientId) as string;

    if (!patientId) return deny(res, 400, 'A patient id is required');

    if (userRole === Role.PATIENT) {
      if (patientId !== userId) return deny(res, 403, 'Forbidden: you can only view your own record');
      (req as any).patientId = userId;
      return next();
    }

    if (userRole === Role.ADMIN) {
      (req as any).patientId = patientId;
      return next();
    }

    if (userRole === Role.DOCTOR) {
      const consent = await ConsentService.findActive(userId, patientId);
      if (!consent) {
        return deny(res, 403, 'Forbidden: you do not hold an active consent for this patient');
      }
      (req as any).patientId = patientId;
      (req as any).consent = consent;
      void ConsentService.touch(consent.id);
      return next();
    }

    return deny(res, 403, 'Forbidden: unrecognised role');
  } catch (error) {
    console.error('[rbac] patient authorisation failed:', error);
    return deny(res, 500, 'Authorisation check failed');
  }
};
