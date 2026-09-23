/**
 * Consent — the single source of truth for cross-tenant access.
 *
 * A clinician may read a patient's data only while a consent row is
 * APPROVED, not revoked, and not past its expiry. Nothing in the frontend can
 * grant that: every protected route asks this module, and the answer is
 * computed from the database on each request. Reaching a doctor page in the
 * browser therefore proves nothing — the API still refuses.
 *
 * Expiry is enforced at read time rather than by a background job, so a lapsed
 * grant stops working the moment it lapses even if nothing has swept the table.
 */
import crypto from 'crypto';
import { ConsentStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export const CONSENT_SCOPES = ['RECORDS', 'TRENDS', 'PROFILE'] as const;
export type ConsentScope = (typeof CONSENT_SCOPES)[number];

export const DEFAULT_SCOPE: ConsentScope[] = ['RECORDS', 'TRENDS', 'PROFILE'];

/** Grant durations offered in the UI, in hours. */
export const GRANT_DURATIONS = [24, 72, 168, 720] as const;

export function newConsentToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export interface ActiveConsent {
  id: string;
  patientId: string;
  doctorId: string;
  scope: string[];
  expiresAt: Date;
}

export class ConsentService {
  /**
   * Returns the live consent linking this doctor to this patient, or null.
   * A row that has passed its expiry is flipped to EXPIRED as a side effect so
   * the patient's consent list tells the truth without a scheduled job.
   */
  static async findActive(doctorId: string, patientId: string): Promise<ActiveConsent | null> {
    const consent = await prisma.doctorAccessToken.findFirst({
      where: {
        doctorId,
        patientId,
        status: ConsentStatus.APPROVED,
        revoked: false,
      },
      orderBy: { expiresAt: 'desc' },
    });

    if (!consent) return null;

    if (consent.expiresAt.getTime() <= Date.now()) {
      await prisma.doctorAccessToken
        .update({ where: { id: consent.id }, data: { status: ConsentStatus.EXPIRED } })
        .catch(() => undefined);
      return null;
    }

    return {
      id: consent.id,
      patientId: consent.patientId,
      doctorId: consent.doctorId,
      scope: consent.scope,
      expiresAt: consent.expiresAt,
    };
  }

  /** True when the consent covers the requested scope. */
  static covers(consent: ActiveConsent, scope: ConsentScope): boolean {
    return consent.scope.length === 0 || consent.scope.includes(scope);
  }

  /** Note that a grant was used — surfaced to the patient as "last accessed". */
  static async touch(consentId: string): Promise<void> {
    await prisma.doctorAccessToken
      .update({
        where: { id: consentId },
        data: { lastAccessedAt: new Date(), accessCount: { increment: 1 } },
      })
      .catch(() => undefined);
  }

  /** Flip every lapsed row for this user so listings are accurate. */
  static async expireLapsed(where: Prisma.DoctorAccessTokenWhereInput): Promise<void> {
    await prisma.doctorAccessToken
      .updateMany({
        where: { ...where, status: ConsentStatus.APPROVED, expiresAt: { lte: new Date() } },
        data: { status: ConsentStatus.EXPIRED },
      })
      .catch(() => undefined);
  }
}
