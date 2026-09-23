/**
 * Patient identity and provider profile.
 *
 * Design rule that runs through this file: the platform never invents clinical
 * or demographic information. Every health field is optional and starts empty;
 * what the patient has not entered is returned as null and rendered as
 * "Not provided". Email and phone stay read-only because they are the account's
 * identity and are held encrypted.
 */
import { Response } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database';
import { CryptoService } from '../services/crypto.service';
import { IdentityService } from '../services/identity.service';
import { AuditService } from '../services/audit.service';
import { fail, guard, ok, zodMessage } from '../lib/http';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
const SEXES = ['female', 'male', 'other', 'prefer_not_to_say'] as const;

/** Trim, drop empties, de-duplicate, cap. Used for allergies / conditions. */
function cleanList(values: unknown, max = 20): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = String(raw).trim().slice(0, 80);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

const patientProfileSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name').max(80).optional(),
  bloodType: z.preprocess(emptyToNull, z.enum(BLOOD_TYPES).nullable().optional()),
  sex: z.preprocess(emptyToNull, z.enum(SEXES).nullable().optional()),
  dateOfBirth: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker to set your date of birth')
      .nullable()
      .optional()
  ),
  abhaId: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .max(60)
      .regex(
        /^[0-9]{14}$|^[0-9-]{14,20}$|^[a-zA-Z0-9._-]+@[a-zA-Z]+$/,
        'Enter a 14-digit ABHA number or an ABHA address such as name@abdm'
      )
      .nullable()
      .optional()
  ),
  allergies: z.array(z.string()).max(20).optional(),
  chronicConditions: z.array(z.string()).max(20).optional(),
  emergencyName: z.preprocess(emptyToNull, z.string().trim().max(80).nullable().optional()),
  emergencyPhone: z.preprocess(
    emptyToNull,
    z.string().trim().min(6, 'Enter a reachable phone number').max(20).nullable().optional()
  ),
});

const doctorProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  specialization: z.preprocess(emptyToNull, z.string().trim().max(80).nullable().optional()),
  clinicName: z.preprocess(emptyToNull, z.string().trim().max(120).nullable().optional()),
  registrationNumber: z.preprocess(emptyToNull, z.string().trim().max(60).nullable().optional()),
  city: z.preprocess(emptyToNull, z.string().trim().max(80).nullable().optional()),
});

function shape(user: any) {
  const base = {
    id: user.id,
    name: user.name,
    role: user.role,
    email: (() => {
      try {
        return CryptoService.decrypt(user.emailEncrypted);
      } catch {
        return null;
      }
    })(),
    phone: (() => {
      if (!user.phoneEncrypted) return null;
      try {
        return CryptoService.decrypt(user.phoneEncrypted);
      } catch {
        return null;
      }
    })(),
    createdAt: user.createdAt,
  };

  if (user.role === Role.DOCTOR) {
    return {
      ...base,
      specialization: user.specialization,
      clinicName: user.clinicName,
      registrationNumber: user.registrationNumber,
      city: user.city,
    };
  }

  return {
    ...base,
    shareCode: user.shareCode,
    abhaId: user.abhaId,
    bloodType: user.bloodType,
    sex: user.sex,
    dateOfBirth: user.dateOfBirth,
    allergies: user.allergies ?? [],
    chronicConditions: user.chronicConditions ?? [],
    emergencyName: user.emergencyName,
    emergencyPhone: user.emergencyPhone,
  };
}

export class UsersController {
  static getProfile = guard(async (req: any, res: Response) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return fail(res, 404, 'Your account could not be found.');

    // Accounts created before share codes existed get one on first view.
    if (user.role === Role.PATIENT && !user.shareCode) {
      user.shareCode = await IdentityService.ensureShareCode(user.id);
    }

    return ok(res, { profile: shape(user) });
  }, 'Failed to load the profile.');

  static updateProfile = guard(async (req: any, res: Response) => {
    const isDoctor = req.user.role === Role.DOCTOR;
    const parsed = isDoctor
      ? doctorProfileSchema.safeParse(req.body)
      : patientProfileSchema.safeParse(req.body);

    if (!parsed.success) return fail(res, 400, zodMessage(parsed.error));

    const input = parsed.data as any;
    const data: any = {};

    if (input.name !== undefined) data.name = input.name;

    if (isDoctor) {
      for (const field of ['specialization', 'clinicName', 'registrationNumber', 'city']) {
        if (input[field] !== undefined) data[field] = input[field];
      }
    } else {
      for (const field of ['bloodType', 'sex', 'abhaId', 'emergencyName', 'emergencyPhone']) {
        if (input[field] !== undefined) data[field] = input[field];
      }
      if (input.dateOfBirth !== undefined) {
        if (input.dateOfBirth === null) {
          data.dateOfBirth = null;
        } else {
          const date = new Date(`${input.dateOfBirth}T00:00:00.000Z`);
          if (Number.isNaN(date.getTime())) return fail(res, 400, 'That date of birth is not valid.');
          if (date.getTime() > Date.now()) return fail(res, 400, 'Date of birth cannot be in the future.');
          data.dateOfBirth = date;
        }
      }
      if (input.allergies !== undefined) data.allergies = cleanList(input.allergies);
      if (input.chronicConditions !== undefined) {
        data.chronicConditions = cleanList(input.chronicConditions);
      }
    }

    if (Object.keys(data).length === 0) {
      return fail(res, 400, 'There was nothing to update.');
    }

    const updated = await prisma.user.update({ where: { id: req.user.userId }, data });

    await AuditService.record({
      actorId: req.user.userId,
      action: 'UPDATE_PROFILE',
      detail: `Updated: ${Object.keys(data).join(', ')}`,
      ipAddress: req.ip,
    });

    return ok(res, { profile: shape(updated) }, 'Your profile has been saved.');
  }, 'Failed to update the profile.');

  /** Issue a fresh share code, invalidating the previous one. */
  static rotateShareCode = guard(async (req: any, res: Response) => {
    const code = await IdentityService.generateShareCode();
    await prisma.user.update({ where: { id: req.user.userId }, data: { shareCode: code } });
    return ok(res, { shareCode: code }, 'A new share code has been issued. The previous one no longer works.');
  }, 'Failed to issue a new share code.');
}
