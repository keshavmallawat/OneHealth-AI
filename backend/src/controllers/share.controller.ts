/**
 * QR / link sharing.
 *
 * The QR code carries an opaque random token and nothing else — no name, no
 * identifier, no clinical value. Scanning it does not reveal anything on its
 * own: the clinician must already be signed in as a verified provider, and
 * redeeming the token is what creates a normal, revocable, time-limited
 * consent row. That keeps a photographed QR code from being a data leak.
 */
import crypto from 'crypto';
import { Response } from 'express';
import QRCode from 'qrcode';
import { ConsentStatus, Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database';
import { env } from '../config/env';
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

/** How long the QR itself stays scannable, in minutes. Short by design. */
const SESSION_MINUTES = [5, 15, 60] as const;

function shareUrl(token: string): string {
  return `${env.FRONTEND_URL.replace(/\/$/, '')}/share/${token}`;
}

function shapeSession(session: any) {
  const expired = session.expiresAt.getTime() <= Date.now();
  return {
    id: session.id,
    // The token is only meaningful to whoever the patient shows it to.
    token: session.token,
    url: shareUrl(session.token),
    scope: session.scope?.length ? session.scope : DEFAULT_SCOPE,
    purpose: session.purpose,
    expiresAt: session.expiresAt,
    grantDurationHrs: session.grantDurationHrs,
    revoked: session.revoked,
    revokedAt: session.revokedAt,
    claimedAt: session.claimedAt,
    claimedBy: session.doctor ? { id: session.doctor.id, name: session.doctor.name } : null,
    status: session.revoked
      ? 'REVOKED'
      : session.claimedAt
      ? 'USED'
      : expired
      ? 'EXPIRED'
      : 'ACTIVE',
    createdAt: session.createdAt,
  };
}

export class ShareController {
  /** Patient mints a single-use, short-lived share session and its QR image. */
  static create = guard(async (req: any, res: Response) => {
    const schema = z.object({
      expiresInMinutes: z.coerce
        .number()
        .int()
        .refine((v) => (SESSION_MINUTES as readonly number[]).includes(v), {
          message: 'Choose one of the offered QR lifetimes',
        })
        .optional(),
      grantDurationHrs: z.coerce
        .number()
        .int()
        .refine((v) => (GRANT_DURATIONS as readonly number[]).includes(v), {
          message: 'Choose one of the offered access periods',
        })
        .optional(),
      scope: z.array(z.enum(CONSENT_SCOPES)).min(1).max(3).optional(),
      purpose: z.string().trim().max(200).optional(),
    });

    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, 400, zodMessage(parsed.error));

    const {
      expiresInMinutes = 15,
      grantDurationHrs = 72,
      scope,
      purpose,
    } = parsed.data;

    // Any earlier unused session is retired, so only one QR is ever live.
    await prisma.shareSession.updateMany({
      where: { patientId: req.user.userId, revoked: false, claimedAt: null },
      data: { revoked: true, revokedAt: new Date() },
    });

    const session = await prisma.shareSession.create({
      data: {
        token: crypto.randomBytes(24).toString('base64url'),
        patientId: req.user.userId,
        scope: (scope as ConsentScope[]) ?? DEFAULT_SCOPE,
        purpose: purpose || null,
        grantDurationHrs,
        expiresAt: new Date(Date.now() + expiresInMinutes * 60_000),
      },
    });

    const qrDataUrl = await QRCode.toDataURL(shareUrl(session.token), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#0f172a', light: '#ffffff' },
    });

    await AuditService.record({
      actorId: req.user.userId,
      patientId: req.user.userId,
      action: 'SHARE_SESSION_CREATED',
      detail: `QR valid for ${expiresInMinutes} min, grants ${grantDurationHrs}h of access`,
      ipAddress: req.ip,
    });

    return ok(
      res,
      { session: shapeSession(session), qrDataUrl },
      'Share code ready. It expires shortly and can only be used once.',
      201
    );
  }, 'Failed to create the share code.');

  static list = guard(async (req: any, res: Response) => {
    const sessions = await prisma.shareSession.findMany({
      where: { patientId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      include: { doctor: true },
      take: 20,
    });
    return ok(res, { sessions: sessions.map(shapeSession) });
  }, 'Failed to load your share codes.');

  static revoke = guard(async (req: any, res: Response) => {
    const session = await prisma.shareSession.findUnique({ where: { id: req.params.id as string } });
    if (!session || session.patientId !== req.user.userId) {
      return fail(res, 404, 'That share code could not be found.');
    }
    if (session.revoked) return fail(res, 409, 'That share code has already been revoked.');

    const updated = await prisma.shareSession.update({
      where: { id: session.id },
      data: { revoked: true, revokedAt: new Date() },
      include: { doctor: true },
    });

    await AuditService.record({
      actorId: req.user.userId,
      patientId: req.user.userId,
      action: 'SHARE_SESSION_REVOKED',
      ipAddress: req.ip,
    });

    return ok(res, { session: shapeSession(updated) }, 'That share code no longer works.');
  }, 'Failed to revoke the share code.');

  /**
   * A signed-in clinician redeems a scanned token.
   *
   * Every failure mode returns the same shape of refusal so a token cannot be
   * probed: expired, revoked, already used and never-existed are all rejections
   * the caller learns nothing more from than that it did not work.
   */
  static redeem = guard(async (req: any, res: Response) => {
    const schema = z.object({ token: z.string().trim().min(10, 'That share code is not valid').max(120) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, zodMessage(parsed.error));

    const doctorId = req.user.userId;
    const session = await prisma.shareSession.findUnique({
      where: { token: parsed.data.token },
      include: { patient: true },
    });

    if (!session) return fail(res, 404, 'That share code is not valid.');
    if (session.revoked) return fail(res, 410, 'That share code has been revoked by the patient.');
    if (session.claimedAt) return fail(res, 410, 'That share code has already been used.');
    if (session.expiresAt.getTime() <= Date.now()) {
      return fail(res, 410, 'That share code has expired. Ask the patient for a new one.');
    }
    if (session.patientId === doctorId) {
      return fail(res, 400, 'You cannot redeem your own share code.');
    }

    const existing = await ConsentService.findActive(doctorId, session.patientId);
    if (existing) {
      await prisma.shareSession.update({
        where: { id: session.id },
        data: { claimedByDoctorId: doctorId, claimedAt: new Date() },
      });
      return fail(res, 409, `You already have access to ${session.patient.name}'s records.`);
    }

    const expiresAt = new Date(Date.now() + session.grantDurationHrs * 3600_000);

    const [, consent] = await prisma.$transaction([
      prisma.shareSession.update({
        where: { id: session.id },
        data: { claimedByDoctorId: doctorId, claimedAt: new Date() },
      }),
      prisma.doctorAccessToken.create({
        data: {
          token: newConsentToken(),
          patientId: session.patientId,
          doctorId,
          // The patient created the QR, so scanning it is the patient's own
          // act of consent — no second approval step is needed.
          status: ConsentStatus.APPROVED,
          scope: session.scope.length ? session.scope : DEFAULT_SCOPE,
          purpose: session.purpose,
          requestedBy: 'PATIENT',
          origin: 'QR',
          decidedAt: new Date(),
          expiresAt,
        },
      }),
    ]);

    await AuditService.record({
      actorId: doctorId,
      patientId: session.patientId,
      action: 'SHARE_SESSION_REDEEMED',
      detail: `${req.user.name || 'A clinician'} redeemed a QR share code`,
      ipAddress: req.ip,
    });

    return ok(
      res,
      {
        patient: { id: session.patient.id, name: session.patient.name },
        consentId: consent.id,
        expiresAt,
        scope: consent.scope,
      },
      `You now have read-only access to ${session.patient.name}'s records.`,
      201
    );
  }, 'Failed to redeem that share code.');
}
