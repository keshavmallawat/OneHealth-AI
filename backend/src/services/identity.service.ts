/**
 * Share codes.
 *
 * A patient hands a clinician their share code so the clinician can *request*
 * access. Using a code rather than the email address matters: it means a doctor
 * account cannot probe for patients by guessing addresses, and the patient can
 * be issued a new code if one leaks. Ambiguous characters are excluded so the
 * code survives being read aloud or copied off a screen.
 */
import crypto from 'crypto';
import { prisma } from '../config/database';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1

function randomCode(): string {
  const bytes = crypto.randomBytes(9);
  let out = '';
  for (let i = 0; i < 9; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
    if (i === 2 || i === 5) out += '-';
  }
  return `OH-${out}`;
}

export class IdentityService {
  /** Allocate a unique share code, retrying on the (vanishing) chance of a clash. */
  static async generateShareCode(): Promise<string> {
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = randomCode();
      const clash = await prisma.user.findUnique({ where: { shareCode: code }, select: { id: true } });
      if (!clash) return code;
    }
    // Fall back to something guaranteed unique rather than failing signup.
    return `OH-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  }

  /** Ensure an existing account has a share code (accounts predating the feature). */
  static async ensureShareCode(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { shareCode: true } });
    if (user?.shareCode) return user.shareCode;
    const code = await IdentityService.generateShareCode();
    await prisma.user.update({ where: { id: userId }, data: { shareCode: code } });
    return code;
  }
}
