import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { env } from '../config/env';

/**
 * Uploads are held in memory: the file is handed straight to the storage driver
 * and then to the AI service, so it never touches a temporary path on disk.
 */
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/tiff',
];

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Please upload a PDF, JPEG, PNG, WebP or TIFF report.'));
  }
};

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: env.maxUploadBytes, files: 1 },
  fileFilter,
});

/**
 * Translates multer's errors into the same response envelope the rest of the
 * API uses, so the frontend never sees a raw stack trace.
 */
export const handleUploadErrors = (
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `That file is too large. The maximum size is ${env.MAX_UPLOAD_MB} MB.`
        : `Upload failed: ${err.message}`;
    return res.status(413).json({ success: false, data: null, message });
  }

  return res.status(400).json({
    success: false,
    data: null,
    message: err.message || 'The file could not be accepted.',
  });
};
