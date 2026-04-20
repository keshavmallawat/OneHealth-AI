import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Ensures the authenticated user has one of the allowed roles.
 */
export const requireRole = (roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Unauthorized: No role specified' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    
    next();
  };
};

/**
 * Ensures the authenticated user is authorized to access the specific health record.
 * Attaches the fetched record to req.record.
 */
export const checkRecordAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const recordId = req.params.id as string;

    if (!recordId) {
      return res.status(400).json({ error: 'Record ID is required' });
    }

    const record = await prisma.healthRecord.findUnique({
      where: { id: recordId }
    });

    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    // Attach record to request object for controller
    (req as any).record = record;

    // Admins bypass ownership checks
    if (userRole === Role.ADMIN) {
      return next();
    }

    // Patients can only access their own records
    if (userRole === Role.PATIENT) {
      if (record.userId === userId) {
        return next();
      }
      return res.status(403).json({ error: 'Forbidden: You do not own this record' });
    }

    // Doctors must have an active access token to the patient
    if (userRole === Role.DOCTOR) {
      const activeToken = await prisma.doctorAccessToken.findFirst({
        where: {
          patientId: record.userId,
          doctorId: userId,
          isRevoked: false
        }
      });

      if (activeToken && (!activeToken.expiresAt || activeToken.expiresAt > new Date())) {
        return next();
      }
      return res.status(403).json({ error: 'Forbidden: No active access token for this patient' });
    }

    return res.status(403).json({ error: 'Forbidden: Invalid role' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error during authorization' });
  }
};
