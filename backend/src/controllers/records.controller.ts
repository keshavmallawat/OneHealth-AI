import { Response } from 'express';
import { PrismaClient, RecordType } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { S3Service } from '../services/s3.service';

const prisma = new PrismaClient();

export class RecordsController {
  
  /**
   * Upload a new health record
   */
  static async uploadRecord(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.userId;
      const file = req.file;
      const type = req.body.type as RecordType;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      if (!type || !Object.values(RecordType).includes(type)) {
        return res.status(400).json({ error: 'Invalid record type' });
      }

      // Upload to S3
      const fileKey = await S3Service.uploadFile(
        userId,
        file.originalname,
        file.buffer,
        file.mimetype
      );

      // Create DB Record
      const record = await prisma.healthRecord.create({
        data: {
          userId,
          type,
          fileUrl: fileKey,
          fileName: file.originalname,
          fileSize: file.size,
        }
      });

      return res.status(201).json({
        message: 'File uploaded successfully',
        record
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to upload file' });
    }
  }

  /**
   * Get a securely presigned URL for downloading/viewing a file
   */
  static async getFileAccessUrl(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.userId;
      const record = (req as any).record;

      if (!record) {
        return res.status(404).json({ error: 'Record not found' });
      }

      // Generate Presigned URL (15 minutes expiry)
      const presignedUrl = await S3Service.getPresignedUrl(record.fileUrl, 900);

      // Log access
      await prisma.accessLog.create({
        data: {
          actorId: userId,
          targetRecordId: record.id,
          action: 'VIEW_RECORD',
          ipAddress: req.ip
        }
      });

      return res.json({ url: presignedUrl, expires_in: 900 });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to generate access URL' });
    }
  }

  /**
   * Get all records for current user
   */
  static async listMyRecords(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.userId;
      const records = await prisma.healthRecord.findMany({
        where: { userId },
        orderBy: { uploadedAt: 'desc' }
      });

      return res.json({ records });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to fetch records' });
    }
  }
}
