import { Response } from 'express';
import { ProcessStatus, Prisma, RecordType, Role } from '@prisma/client';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { StorageService, parsePointer } from '../services/storage.service';
import { AiService, AI_DISCLAIMER, ExtractedParameter } from '../services/ai.service';
import { AuditService } from '../services/audit.service';
import { PdfService, SummaryRecord } from '../services/pdf.service';
import { compareParameters, describeTrend } from '../services/insights.service';
import { prisma } from '../config/database';
import { fail, guard, ok, zodMessage } from '../lib/http';

/** Fields returned in list views — deliberately excludes ocrText and the full
 *  extracted payload so the dashboard stays fast. */
const LIST_FIELDS = {
  id: true,
  type: true,
  fileName: true,
  fileSize: true,
  mimeType: true,
  status: true,
  tags: true,
  reportDate: true,
  labName: true,
  notes: true,
  summarySource: true,
  abnormalCount: true,
  parameterCount: true,
  processingError: true,
  processedAt: true,
  uploadedAt: true,
} as const;

/** The record's own subject — used so an audit entry names the right patient. */
function subjectOf(record: { userId: string }): string {
  return record.userId;
}

export class RecordsController {
  // ---------------------------------------------------------------------------
  // Processing pipeline
  // ---------------------------------------------------------------------------

  /**
   * Run a stored record through the AI service and persist the result.
   *
   * Runs detached from the HTTP request so the upload returns immediately and
   * the UI can show a real PROCESSING state. Every failure path leaves the
   * record in a well-defined state with a message the patient can read — the
   * uploaded document itself is never lost.
   */
  static async processRecord(recordId: string): Promise<void> {
    try {
      const record = await prisma.healthRecord.findUnique({ where: { id: recordId } });
      if (!record || record.status === ProcessStatus.DELETED) return;

      await prisma.healthRecord.update({
        where: { id: recordId },
        data: { status: ProcessStatus.PROCESSING, processingError: null },
      });

      const buffer = await StorageService.read(record.fileUrl);
      const analysis = await AiService.analyzeDocument(
        buffer,
        record.fileName,
        record.mimeType || 'application/octet-stream'
      );

      await prisma.healthRecord.update({
        where: { id: recordId },
        data: {
          status: ProcessStatus.DONE,
          ocrText: analysis.ocrText.slice(0, 100_000),
          extractedData: {
            parameters: analysis.parameters,
            extraction: analysis.extraction,
            detectedSex: analysis.detectedSex,
            stats: analysis.stats,
            processingMs: analysis.processingMs,
            fallbackReason: analysis.fallbackReason ?? null,
          } as any,
          // The disclaimer is appended server-side so it can never be missing
          // from anything we show or export.
          aiSummary: `${analysis.summary}\n\n${AI_DISCLAIMER}`,
          summarySource: analysis.summarySource,
          abnormalCount: analysis.stats.abnormalCount,
          parameterCount: analysis.stats.parameterCount,
          processingError: null,
          processedAt: new Date(),
        },
      });
    } catch (error: any) {
      console.error(`[records] processing failed for ${recordId}:`, error?.message || error);
      await prisma.healthRecord
        .update({
          where: { id: recordId },
          data: {
            status: ProcessStatus.FAILED,
            processingError: String(error?.message || 'Processing failed unexpectedly.').slice(0, 500),
            processedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  static uploadRecord = guard(async (req: AuthRequest, res: Response) => {
    const userId = req.user.userId;
    const file = req.file;
    const { type, tags, labName, reportDate } = req.body;

    if (!file) {
      return fail(res, 400, 'No file uploaded. Please choose a PDF or image.');
    }

    const recordType =
      type && Object.values(RecordType).includes(type as RecordType)
        ? (type as RecordType)
        : RecordType.OTHER;

    let parsedTags: string[] = [];
    if (Array.isArray(tags)) parsedTags = tags.map(String);
    else if (typeof tags === 'string' && tags.trim()) {
      parsedTags = tags
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean)
        .slice(0, 10);
    }

    let parsedReportDate: Date | null = null;
    if (typeof reportDate === 'string' && reportDate.trim()) {
      const candidate = new Date(reportDate);
      if (!Number.isNaN(candidate.getTime()) && candidate.getTime() <= Date.now() + 86_400_000) {
        parsedReportDate = candidate;
      }
    }

    const pointer = await StorageService.save(userId, file.originalname, file.buffer, file.mimetype);

    const record = await prisma.healthRecord.create({
      data: {
        userId,
        type: recordType,
        fileUrl: pointer,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: ProcessStatus.PENDING,
        tags: parsedTags,
        reportDate: parsedReportDate,
        labName: typeof labName === 'string' && labName.trim() ? labName.trim().slice(0, 120) : null,
      },
      select: LIST_FIELDS,
    });

    await AuditService.record({
      actorId: userId,
      patientId: userId,
      recordId: record.id,
      action: 'UPLOAD_RECORD',
      detail: file.originalname,
      ipAddress: req.ip,
    });

    // Kick off analysis without blocking the response.
    void RecordsController.processRecord(record.id);

    return ok(res, { record }, 'Report uploaded. Analysis has started.', 201);
  }, 'Failed to upload the report.');

  static listRecords = guard(async (req: AuthRequest, res: Response) => {
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      type: z.string().optional(),
      search: z.string().max(120).optional(),
      status: z.string().optional(),
      tag: z.string().max(60).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      sort: z.enum(['newest', 'oldest', 'name', 'flagged']).default('newest'),
    });
    const parsed = query.safeParse(req.query);
    if (!parsed.success) return fail(res, 400, zodMessage(parsed.error));

    const { page, limit, type, search, status, tag, from, to, sort } = parsed.data;
    const userId = req.user.userId;

    const where: Prisma.HealthRecordWhereInput = {
      userId,
      status: { not: ProcessStatus.DELETED },
    };
    if (type && Object.values(RecordType).includes(type as RecordType)) {
      where.type = type as RecordType;
    }
    if (status === 'FLAGGED') where.abnormalCount = { gt: 0 };
    else if (status === 'NORMAL') where.AND = [{ abnormalCount: 0 }, { status: ProcessStatus.DONE }];
    else if (status === 'PROCESSING') {
      where.status = { in: [ProcessStatus.PENDING, ProcessStatus.PROCESSING] };
    } else if (status === 'FAILED') where.status = ProcessStatus.FAILED;

    if (tag) where.tags = { has: tag };

    if (search) {
      where.OR = [
        { fileName: { contains: search, mode: 'insensitive' } },
        { labName: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
      ];
    }

    const dateFilter: Prisma.DateTimeFilter = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) dateFilter.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        dateFilter.lte = d;
      }
    }
    if (Object.keys(dateFilter).length) where.uploadedAt = dateFilter;

    const orderBy: Prisma.HealthRecordOrderByWithRelationInput =
      sort === 'oldest'
        ? { uploadedAt: 'asc' }
        : sort === 'name'
        ? { fileName: 'asc' }
        : sort === 'flagged'
        ? { abnormalCount: 'desc' }
        : { uploadedAt: 'desc' };

    const [records, total, allTags] = await Promise.all([
      prisma.healthRecord.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        select: LIST_FIELDS,
      }),
      prisma.healthRecord.count({ where }),
      prisma.healthRecord.findMany({
        where: { userId, status: { not: ProcessStatus.DELETED } },
        select: { tags: true },
      }),
    ]);

    const tagSet = new Set<string>();
    for (const row of allTags) for (const t of row.tags) tagSet.add(t);

    return ok(res, {
      records,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      availableTags: [...tagSet].sort(),
    });
  }, 'Failed to load your reports.');

  static getRecord = guard(async (req: AuthRequest, res: Response) => {
    const record = (req as any).record;
    if (!record || record.status === ProcessStatus.DELETED) {
      return fail(res, 404, 'Record not found');
    }

    const accessUrl = await StorageService.getAccessUrl(record.fileUrl, record.id).catch(() => null);

    await AuditService.record({
      actorId: req.user.userId,
      patientId: subjectOf(record),
      recordId: record.id,
      action: 'VIEW_RECORD_DETAILS',
      detail:
        req.user.role === Role.DOCTOR
          ? `${req.user.name || 'A clinician'} opened this report under an active consent`
          : null,
      ipAddress: req.ip,
    });

    const extracted = (record.extractedData as any) || {};
    const { fileUrl, ocrText, userId, ...safeRecord } = record;

    return ok(res, {
      record: {
        ...safeRecord,
        storageDriver: parsePointer(record.fileUrl).driver,
        parameters: extracted.parameters ?? [],
        extraction: extracted.extraction ?? null,
        detectedSex: extracted.detectedSex ?? null,
        fallbackReason: extracted.fallbackReason ?? null,
        hasOcrText: Boolean(ocrText),
      },
      accessUrl,
      disclaimer: AI_DISCLAIMER,
      viewer: {
        role: req.user.role,
        // A clinician is a guest on this record and the UI says so plainly.
        readOnly: req.user.role !== Role.PATIENT,
      },
    });
  }, 'Failed to load this report.');

  /**
   * Stream the original document.
   *
   * This is the ONLY way a locally-stored file can be read, and it runs behind
   * verifyToken + checkRecordAccess — there is no public path to an uploaded
   * medical document.
   */
  static streamFile = guard(async (req: AuthRequest, res: Response) => {
    const record = (req as any).record;
    if (!record || record.status === ProcessStatus.DELETED) {
      return fail(res, 404, 'Record not found');
    }

    const { driver } = parsePointer(record.fileUrl);
    if (driver === 's3') {
      const url = await StorageService.getAccessUrl(record.fileUrl, record.id);
      return res.redirect(url);
    }

    const buffer = await StorageService.read(record.fileUrl);

    await AuditService.record({
      actorId: req.user.userId,
      patientId: subjectOf(record),
      recordId: record.id,
      action: 'DOWNLOAD_RECORD_FILE',
      ipAddress: req.ip,
    });

    res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(record.fileName)}"`
    );
    return res.send(buffer);
  }, 'The stored file could not be read.');

  static reprocessRecord = guard(async (req: AuthRequest, res: Response) => {
    const record = (req as any).record;
    if (!record || record.status === ProcessStatus.DELETED) {
      return fail(res, 404, 'Record not found');
    }

    await prisma.healthRecord.update({
      where: { id: record.id },
      data: { status: ProcessStatus.PENDING, processingError: null },
    });

    await AuditService.record({
      actorId: req.user.userId,
      patientId: subjectOf(record),
      recordId: record.id,
      action: 'REPROCESS_RECORD',
      ipAddress: req.ip,
    });

    void RecordsController.processRecord(record.id);
    return ok(res, { recordId: record.id }, 'Re-analysis started.', 202);
  }, 'Could not restart the analysis.');

  /** Patient-owned metadata. The extractor guesses; the patient corrects. */
  static updateRecord = guard(async (req: AuthRequest, res: Response) => {
    const record = (req as any).record;
    if (!record || record.status === ProcessStatus.DELETED) {
      return fail(res, 404, 'Record not found');
    }

    const schema = z.object({
      type: z.enum(Object.values(RecordType) as [string, ...string[]]).optional(),
      tags: z.array(z.string()).max(10).optional(),
      labName: z.string().trim().max(120).nullable().optional(),
      notes: z.string().trim().max(1000).nullable().optional(),
      reportDate: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, zodMessage(parsed.error));

    const data: Prisma.HealthRecordUpdateInput = {};
    if (parsed.data.type) data.type = parsed.data.type as RecordType;
    if (parsed.data.tags) {
      data.tags = [
        ...new Set(
          parsed.data.tags
            .map((t) => t.trim().toLowerCase().slice(0, 40))
            .filter(Boolean)
        ),
      ].slice(0, 10);
    }
    if (parsed.data.labName !== undefined) data.labName = parsed.data.labName || null;
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes || null;
    if (parsed.data.reportDate !== undefined) {
      if (!parsed.data.reportDate) data.reportDate = null;
      else {
        const date = new Date(parsed.data.reportDate);
        if (Number.isNaN(date.getTime())) return fail(res, 400, 'That report date is not valid.');
        data.reportDate = date;
      }
    }

    if (Object.keys(data).length === 0) return fail(res, 400, 'There was nothing to update.');

    const updated = await prisma.healthRecord.update({
      where: { id: record.id },
      data,
      select: LIST_FIELDS,
    });

    await AuditService.record({
      actorId: req.user.userId,
      patientId: subjectOf(record),
      recordId: record.id,
      action: 'UPDATE_RECORD',
      detail: `Updated: ${Object.keys(data).join(', ')}`,
      ipAddress: req.ip,
    });

    return ok(res, { record: updated }, 'Report details saved.');
  }, 'Failed to update the report.');

  static deleteRecord = guard(async (req: AuthRequest, res: Response) => {
    const record = (req as any).record;
    if (!record || record.status === ProcessStatus.DELETED) {
      return fail(res, 404, 'Record already deleted');
    }

    // Soft delete: the row and its audit trail are retained.
    await prisma.healthRecord.update({
      where: { id: record.id },
      data: { status: ProcessStatus.DELETED },
    });

    await AuditService.record({
      actorId: req.user.userId,
      patientId: subjectOf(record),
      recordId: record.id,
      action: 'DELETE_RECORD',
      detail: record.fileName,
      ipAddress: req.ip,
    });

    return ok(res, null, 'Report deleted.');
  }, 'Failed to delete the report.');

  // ---------------------------------------------------------------------------
  // Dashboard aggregates
  // ---------------------------------------------------------------------------

  static getStats = guard(async (req: AuthRequest, res: Response) => {
    const userId = req.user.userId;

    const records = await prisma.healthRecord.findMany({
      where: { userId, status: { not: ProcessStatus.DELETED } },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        status: true,
        uploadedAt: true,
        reportDate: true,
        abnormalCount: true,
        parameterCount: true,
        extractedData: true,
      },
    });

    const analysed = records.filter((r) => r.status === ProcessStatus.DONE);
    const latest = analysed[0];
    const latestParams: ExtractedParameter[] =
      ((latest?.extractedData as any)?.parameters as ExtractedParameter[]) || [];

    const trackedKeys = new Set<string>();
    for (const record of analysed) {
      for (const p of ((record.extractedData as any)?.parameters || []) as ExtractedParameter[]) {
        trackedKeys.add(p.key);
      }
    }

    // Consent and reminder counters, so the dashboard can answer "what needs
    // my attention?" without a second round of requests.
    const [pendingConsents, activeConsents, openReminders] = await Promise.all([
      prisma.doctorAccessToken.count({ where: { patientId: userId, status: 'PENDING' } }),
      prisma.doctorAccessToken.count({
        where: { patientId: userId, status: 'APPROVED', revoked: false, expiresAt: { gt: new Date() } },
      }),
      prisma.reminder.count({ where: { userId, completed: false } }),
    ]);

    return ok(res, {
      totalReports: records.length,
      analysedReports: analysed.length,
      processingReports: records.filter(
        (r) => r.status === ProcessStatus.PENDING || r.status === ProcessStatus.PROCESSING
      ).length,
      failedReports: records.filter((r) => r.status === ProcessStatus.FAILED).length,
      parametersTracked: trackedKeys.size,
      lastUploadAt: records[0]?.uploadedAt ?? null,
      pendingConsents,
      activeConsents,
      openReminders,
      latestReport: latest
        ? {
            id: latest.id,
            fileName: latest.fileName,
            uploadedAt: latest.uploadedAt,
            reportDate: latest.reportDate,
            parameterCount: latest.parameterCount,
            abnormalCount: latest.abnormalCount,
            normalCount: latestParams.filter((p) => p.status === 'NORMAL').length,
            flagged: latestParams
              .filter((p) => p.status === 'LOW' || p.status === 'HIGH')
              .map((p) => ({
                key: p.key,
                testName: p.testName,
                value: p.value,
                unit: p.unit,
                status: p.status,
                referenceRange: p.referenceRange,
              })),
          }
        : null,
    });
  }, 'Failed to load your health overview.');

  /**
   * Time series per parameter, assembled from the stored extractions, with a
   * deterministic observation attached to each series. Only parameters that
   * appear in at least two analysed reports are returned — a single point is
   * not a trend.
   */
  static getTrends = guard(async (req: AuthRequest, res: Response) => {
    const userId =
      req.user.role === Role.PATIENT ? req.user.userId : ((req as any).patientId as string);

    const records = await prisma.healthRecord.findMany({
      where: { userId, status: ProcessStatus.DONE },
      orderBy: { uploadedAt: 'asc' },
      select: { id: true, uploadedAt: true, reportDate: true, fileName: true, extractedData: true },
    });

    const series: Record<string, any> = {};
    for (const record of records) {
      const params = ((record.extractedData as any)?.parameters || []) as ExtractedParameter[];
      for (const p of params) {
        if (p.status === 'UNKNOWN') continue;
        if (!series[p.key]) {
          series[p.key] = {
            key: p.key,
            testName: p.testName,
            unit: p.unit,
            panel: p.panel,
            referenceLow: p.referenceLow,
            referenceHigh: p.referenceHigh,
            referenceRange: p.referenceRange,
            points: [],
          };
        }
        series[p.key].points.push({
          recordId: record.id,
          fileName: record.fileName,
          date: record.reportDate ?? record.uploadedAt,
          value: p.value,
          status: p.status,
        });
      }
    }

    const trends = Object.values(series)
      .filter((s: any) => s.points.length >= 2)
      .map((s: any) => ({ ...s, observation: describeTrend(s.points, s.testName, s.unit) }))
      .sort((a: any, b: any) => {
        // Newly abnormal first — that is what a patient needs to see.
        const weight = (s: any) =>
          s.observation.newlyAbnormal ? 0 : s.points[s.points.length - 1].status !== 'NORMAL' ? 1 : 2;
        return weight(a) - weight(b) || a.testName.localeCompare(b.testName);
      });

    const singlePoint = Object.values(series).filter((s: any) => s.points.length === 1).length;

    return ok(res, {
      trends,
      reportsAnalysed: records.length,
      parametersWithOneReading: singlePoint,
      message:
        trends.length === 0
          ? 'Upload at least two analysed reports containing the same test to see trends.'
          : undefined,
    });
  }, 'Failed to build your trends.');

  /** Side-by-side comparison of two of the patient's own reports. */
  static compare = guard(async (req: AuthRequest, res: Response) => {
    const schema = z.object({ a: z.string().min(1), b: z.string().min(1) });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return fail(res, 400, 'Choose two reports to compare.');
    if (parsed.data.a === parsed.data.b) return fail(res, 400, 'Choose two different reports.');

    const userId =
      req.user.role === Role.PATIENT ? req.user.userId : ((req as any).patientId as string);

    const records = await prisma.healthRecord.findMany({
      where: {
        id: { in: [parsed.data.a, parsed.data.b] },
        userId,
        status: ProcessStatus.DONE,
      },
      select: {
        id: true,
        fileName: true,
        uploadedAt: true,
        reportDate: true,
        extractedData: true,
        abnormalCount: true,
        parameterCount: true,
      },
    });

    // Ownership is part of the query, so a foreign id simply is not found.
    if (records.length !== 2) {
      return fail(res, 404, 'Both reports must exist, be analysed, and belong to you.');
    }

    const ordered = records.sort(
      (x, y) =>
        (x.reportDate ?? x.uploadedAt).getTime() - (y.reportDate ?? y.uploadedAt).getTime()
    );
    const [earlier, later] = ordered as [typeof records[0], typeof records[0]];

    const rows = compareParameters(
      ((earlier.extractedData as any)?.parameters || []) as ExtractedParameter[],
      ((later.extractedData as any)?.parameters || []) as ExtractedParameter[]
    );

    return ok(res, {
      earlier: {
        id: earlier.id,
        fileName: earlier.fileName,
        date: earlier.reportDate ?? earlier.uploadedAt,
        abnormalCount: earlier.abnormalCount,
        parameterCount: earlier.parameterCount,
      },
      later: {
        id: later.id,
        fileName: later.fileName,
        date: later.reportDate ?? later.uploadedAt,
        abnormalCount: later.abnormalCount,
        parameterCount: later.parameterCount,
      },
      rows,
      summary: {
        improved: rows.filter((r) => r.returnedToRange).length,
        worsened: rows.filter((r) => r.newlyAbnormal).length,
        unchanged: rows.filter((r) => r.direction === 'STABLE').length,
        added: rows.filter((r) => r.direction === 'ADDED').length,
        removed: rows.filter((r) => r.direction === 'REMOVED').length,
      },
    });
  }, 'Failed to compare those reports.');

  /**
   * The patient's access history.
   *
   * Because AccessLog records both the actor and the subject, this returns
   * everything that happened TO this patient's data — including a clinician
   * opening a report — not merely what the patient did themselves.
   */
  static getActivity = guard(async (req: AuthRequest, res: Response) => {
    const userId = req.user.userId;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const scope = (req.query.scope as string) === 'mine' ? 'mine' : 'all';

    const logs = await prisma.accessLog.findMany({
      where: scope === 'mine' ? { actorId: userId } : { patientId: userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        detail: true,
        timestamp: true,
        targetRecordId: true,
        actorId: true,
        actor: { select: { id: true, name: true, role: true } },
        record: { select: { fileName: true, status: true } },
      },
    });

    return ok(res, {
      activity: logs.map((log) => ({
        id: log.id,
        action: log.action,
        detail: log.detail,
        timestamp: log.timestamp,
        recordId: log.targetRecordId,
        fileName: log.record?.fileName ?? null,
        recordDeleted: log.record?.status === ProcessStatus.DELETED,
        byMe: log.actorId === userId,
        actor: { name: log.actor?.name ?? 'Unknown', role: log.actor?.role ?? 'PATIENT' },
      })),
    });
  }, 'Failed to load your access history.');

  /** Downloadable health summary, built only from stored values. */
  static exportSummary = guard(async (req: AuthRequest, res: Response) => {
    const patientId =
      req.user.role === Role.PATIENT ? req.user.userId : ((req as any).patientId as string);

    const [patient, records] = await Promise.all([
      prisma.user.findUnique({ where: { id: patientId } }),
      prisma.healthRecord.findMany({
        where: { userId: patientId, status: { not: ProcessStatus.DELETED } },
        orderBy: { uploadedAt: 'desc' },
        select: {
          id: true,
          fileName: true,
          type: true,
          status: true,
          uploadedAt: true,
          reportDate: true,
          labName: true,
          parameterCount: true,
          abnormalCount: true,
          aiSummary: true,
          summarySource: true,
          extractedData: true,
        },
      }),
    ]);

    if (!patient) return fail(res, 404, 'That patient could not be found.');

    const summaryRecords: SummaryRecord[] = records.map((record) => ({
      id: record.id,
      fileName: record.fileName,
      type: record.type,
      status: record.status,
      uploadedAt: record.uploadedAt,
      reportDate: record.reportDate,
      labName: record.labName,
      parameterCount: record.parameterCount,
      abnormalCount: record.abnormalCount,
      aiSummary: record.aiSummary,
      summarySource: record.summarySource,
      parameters: ((record.extractedData as any)?.parameters || []) as ExtractedParameter[],
    }));

    let email: string | null = null;
    try {
      const { CryptoService } = await import('../services/crypto.service');
      email = CryptoService.decrypt(patient.emailEncrypted);
    } catch {
      email = null;
    }

    const pdf = await PdfService.build({
      patient: {
        name: patient.name,
        email,
        dateOfBirth: patient.dateOfBirth,
        sex: patient.sex,
        bloodType: patient.bloodType,
        abhaId: patient.abhaId,
        allergies: patient.allergies ?? [],
        chronicConditions: patient.chronicConditions ?? [],
        emergencyName: patient.emergencyName,
        emergencyPhone: patient.emergencyPhone,
      },
      records: summaryRecords,
      generatedBy: req.user.name || (req.user.role === Role.DOCTOR ? 'a clinician' : patient.name),
    });

    await AuditService.record({
      actorId: req.user.userId,
      patientId,
      action: 'EXPORT_HEALTH_SUMMARY',
      detail: `${summaryRecords.length} record(s) exported to PDF`,
      ipAddress: req.ip,
    });

    const safeName = patient.name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'patient';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="OneHealth-Summary-${safeName}.pdf"`
    );
    return res.send(pdf);
  }, 'Failed to build the health summary.');

  /** Kept for backward compatibility with the previous route. */
  static getFileAccessUrl = RecordsController.getRecord;
}
