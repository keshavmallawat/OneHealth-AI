/**
 * Audit trail.
 *
 * Every read or write of clinical data goes through here. Two identifiers are
 * always recorded: `actorId` (who did it) and `patientId` (whose data it was).
 * Recording both is what makes the log meaningful to a patient — without the
 * subject, "Dr Menon opened a report" cannot be shown on the patient's own
 * access history.
 *
 * Logging is best-effort: an audit write must never fail the request that a
 * patient is waiting on, so failures are reported to the server log only.
 */
import { prisma } from '../config/database';

export type AuditAction =
  | 'UPLOAD_RECORD'
  | 'VIEW_RECORD_DETAILS'
  | 'DOWNLOAD_RECORD_FILE'
  | 'UPDATE_RECORD'
  | 'DELETE_RECORD'
  | 'REPROCESS_RECORD'
  | 'VIEW_PATIENT_SUMMARY'
  | 'EXPORT_HEALTH_SUMMARY'
  | 'CONSENT_REQUESTED'
  | 'CONSENT_APPROVED'
  | 'CONSENT_REJECTED'
  | 'CONSENT_REVOKED'
  | 'CONSENT_GRANTED'
  | 'SHARE_SESSION_CREATED'
  | 'SHARE_SESSION_REVOKED'
  | 'SHARE_SESSION_REDEEMED'
  | 'UPDATE_PROFILE'
  | 'ASSISTANT_QUERY';

export interface AuditInput {
  actorId: string;
  patientId?: string | null;
  recordId?: string | null;
  action: AuditAction;
  detail?: string | null;
  ipAddress?: string | null;
}

export class AuditService {
  static async record(input: AuditInput): Promise<void> {
    try {
      await prisma.accessLog.create({
        data: {
          actorId: input.actorId,
          patientId: input.patientId ?? input.actorId,
          targetRecordId: input.recordId ?? null,
          action: input.action,
          detail: input.detail ? input.detail.slice(0, 300) : null,
          ipAddress: input.ipAddress ?? null,
        },
      });
    } catch (error: any) {
      console.error('[audit] failed to write access log:', error?.message || error);
    }
  }
}
