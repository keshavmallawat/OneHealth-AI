import { Response } from 'express';
import { PrismaClient, RecordType, ProcessStatus } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { S3Service } from '../services/s3.service';

const prisma = new PrismaClient();

export class RecordsController {
  
  /**
   * Standard response helper
   */
  private static sendResponse(res: Response, status: number, success: boolean, data: any, message?: string) {
    return res.status(status).json({ success, data, message });
  }

  /**
   * Upload a new health record
   */
  static async uploadRecord(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.userId;
      const file = req.file;
      const { type, tags } = req.body;

      if (!file) {
        return RecordsController.sendResponse(res, 400, false, null, 'No file uploaded');
      }

      if (!type || !Object.values(RecordType).includes(type as RecordType)) {
        return RecordsController.sendResponse(res, 400, false, null, 'Invalid record type');
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
          type: type as RecordType,
          fileUrl: fileKey,
          fileName: file.originalname,
          fileSize: file.size,
          status: 'PENDING',
          tags: Array.isArray(tags) ? tags : []
        }
      });

      // Log the upload action
      await prisma.accessLog.create({
        data: {
          actorId: userId,
          targetRecordId: record.id,
          action: 'UPLOAD_RECORD',
          ipAddress: req.ip
        }
      });

      // Generate a presigned URL for immediate viewing (15 min expiry)
      const presignedUrl = await S3Service.getPresignedUrl(fileKey, 900);

      return RecordsController.sendResponse(res, 201, true, {
        recordId: record.id,
        presignedUrl
      }, 'File uploaded successfully');
    } catch (error) {
      console.error(error);
      return RecordsController.sendResponse(res, 500, false, null, 'Failed to upload file');
    }
  }

  /**
   * Get all records for current user with pagination, filtering, and search
   */
  static async listRecords(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as RecordType;
      const search = req.query.search as string;

      const skip = (page - 1) * limit;

      const where: any = { 
        userId,
        status: { not: 'DELETED' } // Don't list deleted records
      };

      if (type && Object.values(RecordType).includes(type)) {
        where.type = type;
      }

      if (search) {
        where.fileName = {
          contains: search,
          mode: 'insensitive'
        };
      }

      const [records, total] = await Promise.all([
        prisma.healthRecord.findMany({
          where,
          skip,
          take: limit,
          orderBy: { uploadedAt: 'desc' }
        }),
        prisma.healthRecord.count({ where })
      ]);

      return RecordsController.sendResponse(res, 200, true, {
        records,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error(error);
      return RecordsController.sendResponse(res, 500, false, null, 'Failed to fetch records');
    }
  }

  /**
   * Get single record details + generate fresh presigned S3 URL
   */
  static async getRecord(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.userId;
      const record = (req as any).record;

      if (!record || record.status === 'DELETED') {
        return RecordsController.sendResponse(res, 404, false, null, 'Record not found');
      }

      // Generate Presigned URL (15 minutes expiry)
      const presignedUrl = await S3Service.getPresignedUrl(record.fileUrl, 900);

      // Log access
      await prisma.accessLog.create({
        data: {
          actorId: userId,
          targetRecordId: record.id,
          action: 'VIEW_RECORD_DETAILS',
          ipAddress: req.ip
        }
      });

      return RecordsController.sendResponse(res, 200, true, {
        record,
        presignedUrl
      });
    } catch (error) {
      console.error(error);
      return RecordsController.sendResponse(res, 500, false, null, 'Failed to fetch record details');
    }
  }

  /**
   * Update record: type and/or tags only
   */
  static async updateRecord(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.userId;
      const record = (req as any).record;
      const { type, tags } = req.body;

      if (!record || record.status === 'DELETED') {
        return RecordsController.sendResponse(res, 404, false, null, 'Record not found');
      }

      const updateData: any = {};
      if (type && Object.values(RecordType).includes(type as RecordType)) {
        updateData.type = type as RecordType;
      }
      if (Array.isArray(tags)) {
        updateData.tags = tags;
      }

      const updatedRecord = await prisma.healthRecord.update({
        where: { id: record.id },
        data: updateData
      });

      // Log update
      await prisma.accessLog.create({
        data: {
          actorId: userId,
          targetRecordId: record.id,
          action: 'UPDATE_RECORD',
          ipAddress: req.ip
        }
      });

      return RecordsController.sendResponse(res, 200, true, updatedRecord, 'Record updated successfully');
    } catch (error) {
      console.error(error);
      return RecordsController.sendResponse(res, 500, false, null, 'Failed to update record');
    }
  }

  /**
   * Soft delete record
   */
  static async deleteRecord(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.userId;
      const record = (req as any).record;

      if (!record || record.status === 'DELETED') {
        return RecordsController.sendResponse(res, 404, false, null, 'Record already deleted');
      }

      await prisma.healthRecord.update({
        where: { id: record.id },
        data: { status: 'DELETED' }
      });

      // Log deletion
      await prisma.accessLog.create({
        data: {
          actorId: userId,
          targetRecordId: record.id,
          action: 'DELETE_RECORD',
          ipAddress: req.ip
        }
      });

      return RecordsController.sendResponse(res, 200, true, null, 'Record deleted successfully');
    } catch (error) {
      console.error(error);
      return RecordsController.sendResponse(res, 500, false, null, 'Failed to delete record');
    }
  }

  /**
   * Deprecated helper (kept for compatibility with checkRecordAccess)
   */
  static async getFileAccessUrl(req: AuthRequest, res: Response) {
    return RecordsController.getRecord(req, res);
  }
}
