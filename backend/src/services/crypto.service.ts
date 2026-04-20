import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ENCRYPTION_KEY = process.env.PII_ENCRYPTION_KEY || 'default_32_byte_key_for_dev_only!'; // Must be 32 bytes
const HMAC_SECRET = process.env.PII_HMAC_SECRET || 'default_hmac_secret_for_dev';
const ALGORITHM = 'aes-256-gcm';

export class CryptoService {
  /**
   * Hashes a string deterministically (e.g., for email lookups).
   */
  static hash(text: string): string {
    const normalized = text.toLowerCase().trim();
    return crypto.createHmac('sha256', HMAC_SECRET).update(normalized).digest('hex');
  }

  /**
   * Encrypts a string using AES-256-GCM.
   * Returns a payload containing iv, ciphertext, and authTag.
   */
  static encrypt(text: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    // Return in format: iv:authTag:ciphertext
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts an AES-256-GCM encrypted payload.
   */
  static decrypt(encryptedPayload: string): string {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format');
    }

    const ivHex = parts[0] as string;
    const authTagHex = parts[1] as string;
    const ciphertext = parts[2] as string;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
