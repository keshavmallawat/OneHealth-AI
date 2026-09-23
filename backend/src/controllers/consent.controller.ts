/**
 * Patient-controlled provider access.
 *
 * The patient is the decision maker everywhere in this file. A clinician can
 * only ever create a PENDING request; nothing but an explicit patient action
 * turns that into access, and the patient can end it at any moment. Each
 * decision is written to the audit trail so the history is reconstructable.
 */
import { Response } from 'express';
import { ConsentStatus, Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database';
import { CryptoService } from '../services/crypto.service';
import {
  CONSENT_SCOPES,
  ConsentScope,
  ConsentService,
  DEFAULT_SCOPE,
  GRANT_DURATIONS,
  newConsentToken,
} from '../services/consent.service';
import { AuditService } from '../services/audit.service';
import { fail, guard, ok, zodMessage } from '../lib/http';

const scopeSchema = z.array(z.enum(CONSENT_SCOPES)).min(1).max(3).optional();
const durationSchema = z.coerce
  .number()
  .int()
  .refine((v) => (GRANT_DURATIONS as readonly number[]).includes(v), {
    message: 'Choose one of the offered access periods',
  })
  .optional();

function publicDoctor(user: any) {
  return {
    id: user.id,
    name: user.name,
    specialization: user.specialization,
    clinicName: user.clinicName,
    registrationNumber: user.registrationNumber,
    city: user.city,
  };
}

function publicPatient(user: any) {
  return {
    id: user.id,
    name: user.name,
    bloodType: user.bloodType,
    sex: user.sex,
    dateOfBirth: user.dateOfBirth,
    allergies: user.allergies ?? [],
    chronicConditions: user.chronicConditions ?? [],
  };
}

function shapeConsent(row: any, viewer: Role) {
  const active =
    row.status === ConsentStatus.APPROVED && !row.revoked && row.expiresAt.getTime() > Date.now();
  return {
    id: row.id,
    status: row.status,
    active,
    scope: row.scope?.length ? row.scope : DEFAULT_SCOPE,
    purpose: row.purpose,
    requestedBy: row.requestedBy,
    origin: row.origin,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
    revokedAt: row.revokedAt,
    expiresAt: row.expiresAt,
    lastAccessedAt: row.lastAccessedAt,
    accessCount: row.accessCount,
    doctor: row.doctor ? publicDoctor(row.doctor) : null,
    patient: viewer === Role.DOCTOR && row.patient ? { id: row.patient.id, name: row.patient.name } : null,
  };
}

export class ConsentController {
  // -------------------------------------------------------------------------
  // Shared
  // -------------------------------------------------------------------------

  /** Every consent involving the signed-in user, newest first. */
  static list = guard(async (req: any, res: Response) => {
    const userId = req.user.userId;
    const isDoctor = req.user.role === Role.DOCTOR;
    const where = isDoctor ? { doctorId: userId } : { patientId: userId };

    await ConsentService.expireLapsed(where);

    const rows = await prisma.doctorAccessToken.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { doctor: true, patient: true },
      take: 100,
    });

    const consents = rows.map((row) => shapeConsent(row, req.user.role));
    return ok(res, {
      consents,
      counts: {
        pending: consents.filter((c) => c.status === 'PENDING').length,
        active: consents.filter((c) => c.active).length,
        total: consents.length,
      },
    });
  }, 'Failed to load consent records.');

  // -------------------------------------------------------------------------
  // Patient actions
  // -------------------------------------------------------------------------

  /** Directory of registered clinicians a patient can share with. */
  static directory = guard(async (req: any, res: Response) => {
    const query = String(req.query.q || '').trim().slice(0, 60);

    const doctors = await prisma.user.findMany({
      where: {
        role: Role.DOCTOR,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' as const } },
                { specialization: { contains: query, mode: 'insensitive' as const } },
                { clinicName: { contains: query, mode: 'insensitive' as const } },
                { city: { contains: query, mode: 'insensitive' as const } },
                { registrationNumber: { contains: query, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 25,
    });

    // Existing relationships, so the UI can show "already shared" rather than
    // letting the patient create a duplicate grant.
    const existing = await prisma.doctorAccessToken.findMany({
      where: { patientId: req.user.userId, doctorId: { in: doctors.map((d) => d.id) } },
      select: { doctorId: true, status: true, expiresAt: true, revoked: true },
    });

    return ok(res, {
      doctors: doctors.map((doctor) => {
        const link = existing.find((e) => e.doctorId === doctor.id);
        return {
          ...publicDoctor(doctor),
          existingStatus: link
            ? link.status === ConsentStatus.APPROVED && !link.revoked && link.expiresAt > new Date()
              ? 'ACTIVE'
              : link.status
            : null,
        };
      }),
    });
  }, 'Failed to search the clinician directory.');

  /** Patient grants access directly, without waiting for a request. */
  static grant = guard(async (req: any, res: Response) => {
    const schema = z.object({
      doctorId: z.string().min(1, 'Choose a clinician'),
      durationHours: durationSchema,
      scope: scopeSchema,
      purpose: z.string().trim().max(200).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, zodMessage(parsed.error));

    const { doctorId, durationHours = 72, scope, purpose } = parsed.data;
    const patientId = req.user.userId;

    if (doctorId === patientId) return fail(res, 400, 'You cannot share your record with yourself.');

    const doctor = await prisma.user.findUnique({ where: { id: doctorId } });
    if (!doctor || doctor.role !== Role.DOCTOR) {
      return fail(res, 404, 'That clinician could not be found.');
    }

    const existing = await ConsentService.findActive(doctorId, patientId);
    if (existing) {
      return fail(res, 409, `${doctor.name} already has access until ${existing.expiresAt.toISOString()}.`);
    }

    const consent = await prisma.doctorAccessToken.create({
      data: {
        token: newConsentToken(),
        patientId,
        doctorId,
        status: ConsentStatus.APPROVED,
        scope: (scope as ConsentScope[]) ?? DEFAULT_SCOPE,
        purpose: purpose || null,
        requestedBy: 'PATIENT',
        origin: 'DIRECT',
        decidedAt: new Date(),
        expiresAt: new Date(Date.now() + durationHours * 3600_000),
      },
      include: { doctor: true, patient: true },
    });

    await AuditService.record({
      actorId: patientId,
      patientId,
      action: 'CONSENT_GRANTED',
      detail: `Access granted to ${doctor.name} for ${durationHours}h`,
      ipAddress: req.ip,
    });

    return ok(
      res,
      { consent: shapeConsent(consent, Role.PATIENT) },
      `${doctor.name} can now view your records until the access period ends.`,
      201
    );
  }, 'Failed to grant access.');

  /** Approve / reject / revoke — all patient-only decisions on one row. */
  static decide = guard(async (req: any, res: Response) => {
    // The action is the last path segment (/consents/:id/approve|reject|revoke).
    const action = req.path.split('/').pop() as 'approve' | 'reject' | 'revoke';
    const consentId = req.params.id as string;
    const patientId = req.user.userId;

    const schema = z.object({ durationHours: durationSchema, scope: scopeSchema });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, 400, zodMessage(parsed.error));

    const consent = await prisma.doctorAccessToken.findUnique({
      where: { id: consentId },
      include: { doctor: true },
    });

    // Ownership is checked here, not in the route: only the patient named on
    // the row may decide it, whoever is signed in.
    if (!consent || consent.patientId !== patientId) {
      return fail(res, 404, 'That access request could not be found.');
    }

    const now = new Date();

    if (action === 'approve') {
      if (consent.status !== ConsentStatus.PENDING) {
        return fail(res, 409, 'That request is no longer pending.');
      }
      const durationHours = parsed.data.durationHours ?? 72;
      const updated = await prisma.doctorAccessToken.update({
        where: { id: consentId },
        data: {
          status: ConsentStatus.APPROVED,
          decidedAt: now,
          revoked: false,
          revokedAt: null,
          expiresAt: new Date(Date.now() + durationHours * 3600_000),
          ...(parsed.data.scope ? { scope: parsed.data.scope as ConsentScope[] } : {}),
        },
        include: { doctor: true, patient: true },
      });
      await AuditService.record({
        actorId: patientId,
        patientId,
        action: 'CONSENT_APPROVED',
        detail: `Approved access for ${consent.doctor.name} (${durationHours}h)`,
        ipAddress: req.ip,
      });
      return ok(
        res,
        { consent: shapeConsent(updated, Role.PATIENT) },
        `${consent.doctor.name} now has access to your records.`
      );
    }

    if (action === 'reject') {
      if (consent.status !== ConsentStatus.PENDING) {
        return fail(res, 409, 'That request is no longer pending.');
      }
      const updated = await prisma.doctorAccessToken.update({
        where: { id: consentId },
        data: { status: ConsentStatus.REJECTED, decidedAt: now },
        include: { doctor: true, patient: true },
      });
      await AuditService.record({
        actorId: patientId,
        patientId,
        action: 'CONSENT_REJECTED',
        detail: `Declined access for ${consent.doctor.name}`,
        ipAddress: req.ip,
      });
      return ok(res, { consent: shapeConsent(updated, Role.PATIENT) }, 'The request was declined.');
    }

    // revoke
    if (consent.status !== ConsentStatus.APPROVED) {
      return fail(res, 409, 'That access has already ended.');
    }
    const updated = await prisma.doctorAccessToken.update({
      where: { id: consentId },
      data: { status: ConsentStatus.REVOKED, revoked: true, revokedAt: now },
      include: { doctor: true, patient: true },
    });
    await AuditService.record({
      actorId: patientId,
      patientId,
      action: 'CONSENT_REVOKED',
      detail: `Revoked access for ${consent.doctor.name}`,
      ipAddress: req.ip,
    });
    return ok(
      res,
      { consent: shapeConsent(updated, Role.PATIENT) },
      `${consent.doctor.name} can no longer view your records.`
    );
  }, 'Failed to update that access request.');

  // -------------------------------------------------------------------------
  // Doctor actions
  // -------------------------------------------------------------------------

  /**
   * A clinician asks a patient for access using the patient's share code.
   * The code — not the email — is the lookup key, so a doctor account cannot
   * discover patients by guessing addresses.
   */
  static request = guard(async (req: any, res: Response) => {
    const schema = z.object({
      shareCode: z.string().trim().min(4, 'Enter the code the patient gave you').max(40),
      purpose: z.string().trim().max(200).optional(),
      scope: scopeSchema,
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, zodMessage(parsed.error));

    const doctorId = req.user.userId;
    const shareCode = parsed.data.shareCode.toUpperCase().replace(/\s+/g, '');

    const patient = await prisma.user.findUnique({ where: { shareCode } });
    if (!patient || patient.role !== Role.PATIENT) {
      // Same message for "no such code" and "not a patient" so the endpoint
      // cannot be used to confirm which codes exist.
      return fail(res, 404, 'No patient matches that share code.');
    }

    const active = await ConsentService.findActive(doctorId, patient.id);
    if (active) {
      return fail(res, 409, `You already have access to ${patient.name}'s records.`);
    }

    const pending = await prisma.doctorAccessToken.findFirst({
      where: { doctorId, patientId: patient.id, status: ConsentStatus.PENDING },
    });
    if (pending) {
      return fail(res, 409, 'You already have a request awaiting this patient’s decision.');
    }

    const consent = await prisma.doctorAccessToken.create({
      data: {
        token: newConsentToken(),
        patientId: patient.id,
        doctorId,
        status: ConsentStatus.PENDING,
        scope: (parsed.data.scope as ConsentScope[]) ?? DEFAULT_SCOPE,
        purpose: parsed.data.purpose || null,
        requestedBy: 'DOCTOR',
        origin: 'DIRECT',
        // A pending request carries a provisional window; approving resets it.
        expiresAt: new Date(Date.now() + 72 * 3600_000),
      },
      include: { doctor: true, patient: true },
    });

    await AuditService.record({
      actorId: doctorId,
      patientId: patient.id,
      action: 'CONSENT_REQUESTED',
      detail: `${req.user.name || 'A clinician'} requested access`,
      ipAddress: req.ip,
    });

    return ok(
      res,
      { consent: shapeConsent(consent, Role.DOCTOR) },
      `Request sent to ${patient.name}. You will get access once they approve it.`,
      201
    );
  }, 'Failed to send the access request.');

  /** Patients this clinician is currently authorised to see. */
  static patients = guard(async (req: any, res: Response) => {
    const doctorId = req.user.userId;
    await ConsentService.expireLapsed({ doctorId });

    const consents = await prisma.doctorAccessToken.findMany({
      where: { doctorId, status: ConsentStatus.APPROVED, revoked: false, expiresAt: { gt: new Date() } },
      include: { patient: true },
      orderBy: { expiresAt: 'asc' },
    });

    const patientIds = consents.map((c) => c.patientId);
    const counts = patientIds.length
      ? await prisma.healthRecord.groupBy({
          by: ['userId'],
          where: { userId: { in: patientIds }, status: { not: 'DELETED' } },
          _count: { _all: true },
          _sum: { abnormalCount: true },
          _max: { uploadedAt: true },
        })
      : [];

    return ok(res, {
      patients: consents.map((consent) => {
        const stat = counts.find((c) => c.userId === consent.patientId);
        return {
          consentId: consent.id,
          expiresAt: consent.expiresAt,
          scope: consent.scope,
          purpose: consent.purpose,
          lastAccessedAt: consent.lastAccessedAt,
          patient: publicPatient(consent.patient),
          recordCount: stat?._count._all ?? 0,
          abnormalTotal: stat?._sum.abnormalCount ?? 0,
          lastUploadAt: stat?._max.uploadedAt ?? null,
        };
      }),
    });
  }, 'Failed to load your patient list.');

  /** Read-only clinical view of one authorised patient. */
  static patientDetail = guard(async (req: any, res: Response) => {
    const patientId = (req as any).patientId as string;
    const consent = (req as any).consent;

    const patient = await prisma.user.findUnique({ where: { id: patientId } });
    if (!patient) return fail(res, 404, 'That patient could not be found.');

    const records = await prisma.healthRecord.findMany({
      where: { userId: patientId, status: { not: 'DELETED' } },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        type: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        status: true,
        tags: true,
        reportDate: true,
        labName: true,
        summarySource: true,
        abnormalCount: true,
        parameterCount: true,
        processedAt: true,
        uploadedAt: true,
      },
    });

    await AuditService.record({
      actorId: req.user.userId,
      patientId,
      action: 'VIEW_PATIENT_SUMMARY',
      detail: `${req.user.name || 'Clinician'} opened the patient summary`,
      ipAddress: req.ip,
    });

    const scope: string[] = consent?.scope?.length ? consent.scope : DEFAULT_SCOPE;

    return ok(res, {
      patient: {
        ...publicPatient(patient),
        // Contact details are only exposed when the patient shared the PROFILE
        // scope, and even then only what a clinician needs to reach them.
        email: scope.includes('PROFILE') ? safeDecrypt(patient.emailEncrypted) : null,
        emergencyName: scope.includes('PROFILE') ? patient.emergencyName : null,
        emergencyPhone: scope.includes('PROFILE') ? patient.emergencyPhone : null,
        abhaId: scope.includes('PROFILE') ? patient.abhaId : null,
      },
      records: scope.includes('RECORDS') ? records : [],
      access: {
        consentId: consent?.id ?? null,
        expiresAt: consent?.expiresAt ?? null,
        scope,
        readOnly: true,
      },
    });
  }, 'Failed to load that patient record.');
}

function safeDecrypt(payload: string | null): string | null {
  if (!payload) return null;
  try {
    return CryptoService.decrypt(payload);
  } catch {
    return null;
  }
}
