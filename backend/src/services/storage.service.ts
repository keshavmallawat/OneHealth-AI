/**
 * Storage abstraction.
 *
 * The platform is documented as storing records in AWS S3, and that
 * implementation is intact (s3.service.ts). But requiring real AWS credentials
 * to run the app locally is a liability, so storage is behind a driver:
 *
 *   STORAGE_DRIVER=local  -> encrypted-at-rest-by-the-OS local disk (default)
 *   STORAGE_DRIVER=s3     -> the existing S3 implementation
 *
 * Records store a *pointer* of the form "<driver>:<key>", so a database written
 * under one driver still resolves correctly if the driver changes later. Rows
 * created before this abstraction existed have no prefix and are treated as s3.
 */
import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env';
import { S3Service } from './s3.service';

export type StorageDriver = 'local' | 's3';

export interface StoredPointer {
  driver: StorageDriver;
  key: string;
}

/** Strip anything that could escape the storage root or break on Windows. */
function sanitizeFilename(filename: string): string {
  const base = path.basename(filename).replace(/[\\/]/g, '_');
  return (
    base
      .replace(/[<>:"|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 120) || 'report'
  );
}

export function parsePointer(pointer: string): StoredPointer {
  const separator = pointer.indexOf(':');
  if (separator > 0) {
    const prefix = pointer.slice(0, separator);
    if (prefix === 'local' || prefix === 's3') {
      return { driver: prefix, key: pointer.slice(separator + 1) };
    }
  }
  // Legacy rows predate the prefix and were always S3 keys.
  return { driver: 's3', key: pointer };
}

export class StorageService {
  static get driver(): StorageDriver {
    return env.STORAGE_DRIVER;
  }

  /** Absolute on-disk path for a local key, guarded against path traversal. */
  private static resolveLocalPath(key: string): string {
    const target = path.resolve(env.localStorageRoot, key);
    const root = path.resolve(env.localStorageRoot);
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error('Refusing to access a path outside the storage root');
    }
    return target;
  }

  /**
   * Persist an uploaded file and return its pointer.
   * Key layout mirrors the S3 layout so the two drivers stay interchangeable.
   */
  static async save(
    userId: string,
    filename: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    const key = `records/${userId}/${Date.now()}-${sanitizeFilename(filename)}`;

    if (env.STORAGE_DRIVER === 's3') {
      const s3Key = await S3Service.uploadFile(userId, filename, buffer, mimeType);
      return `s3:${s3Key}`;
    }

    const target = StorageService.resolveLocalPath(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
    return `local:${key}`;
  }

  /** Read a stored file back into memory (used for AI processing and download). */
  static async read(pointer: string): Promise<Buffer> {
    const { driver, key } = parsePointer(pointer);
    if (driver === 's3') {
      return S3Service.getObjectBuffer(key);
    }
    return fs.readFile(StorageService.resolveLocalPath(key));
  }

  static async exists(pointer: string): Promise<boolean> {
    const { driver, key } = parsePointer(pointer);
    if (driver === 's3') return true; // avoid a network round-trip on list views
    try {
      await fs.access(StorageService.resolveLocalPath(key));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * How the client should fetch this file.
   *
   * For S3 we hand back a short-lived presigned URL. For local storage we do NOT
   * expose a public path - the client calls our own authenticated endpoint,
   * which re-checks ownership on every request.
   */
  static async getAccessUrl(pointer: string, recordId: string): Promise<string> {
    const { driver, key } = parsePointer(pointer);
    if (driver === 's3') {
      return S3Service.getPresignedUrl(key, 900);
    }
    return `/api/records/${recordId}/file`;
  }

  /** Best-effort removal. Soft-deleted records keep their file by design. */
  static async remove(pointer: string): Promise<void> {
    const { driver, key } = parsePointer(pointer);
    if (driver === 'local') {
      await fs.rm(StorageService.resolveLocalPath(key), { force: true });
    }
  }

  static async ensureReady(): Promise<void> {
    if (env.STORAGE_DRIVER === 'local') {
      await fs.mkdir(env.localStorageRoot, { recursive: true });
    }
  }
}
