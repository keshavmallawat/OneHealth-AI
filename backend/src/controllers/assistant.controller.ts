/**
 * Health assistant.
 *
 * This controller is the security boundary for the feature: it builds the
 * context from the signed-in patient's own rows and nothing else, so the
 * assistant is structurally incapable of reading another patient's results —
 * there is no patient identifier in the request for it to honour.
 *
 * Clinicians can ask about a patient they hold consent for; the same assembly
 * runs, keyed by the authorised patient id rather than a client-supplied one.
 */
import { Response } from 'express';
import { ProcessStatus, Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AiService, AssistantContext, ExtractedParameter } from '../services/ai.service';
import { AuditService } from '../services/audit.service';
import { fail, guard, ok, zodMessage } from '../lib/http';

const askSchema = z.object({
  question: z.string().trim().min(2, 'Please type a question').max(500, 'That question is too long'),
});

function label(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Everything the assistant is allowed to know, drawn from one patient's rows. */
async function buildContext(patientId: string): Promise<AssistantContext> {
  const records = await prisma.healthRecord.findMany({
    where: { userId: patientId, status: { not: ProcessStatus.DELETED } },
    orderBy: { uploadedAt: 'asc' },
    select: {
      id: true,
      fileName: true,
      status: true,
      uploadedAt: true,
      reportDate: true,
      extractedData: true,
    },
  });

  const analysed = records.filter((r) => r.status === ProcessStatus.DONE);
  const history: AssistantContext['history'] = [];

  for (const record of analysed) {
    const parameters = ((record.extractedData as any)?.parameters || []) as ExtractedParameter[];
    const when = record.reportDate ?? record.uploadedAt;
    for (const p of parameters) {
      if (p.status === 'UNKNOWN') continue;
      history.push({
        key: p.key,
        testName: p.testName,
        value: p.value,
        unit: p.unit,
        referenceRange: p.referenceRange,
        status: p.status,
        recordId: record.id,
        fileName: record.fileName,
        date: when.toISOString(),
        dateLabel: label(when),
      });
    }
  }

  const newest = analysed[analysed.length - 1];
  const newestWhen = newest ? newest.reportDate ?? newest.uploadedAt : null;

  return {
    recordCount: records.length,
    analysedCount: analysed.length,
    latest: newest
      ? {
          id: newest.id,
          fileName: newest.fileName,
          date: newestWhen!.toISOString(),
          dateLabel: label(newestWhen!),
          parameters: (((newest.extractedData as any)?.parameters || []) as ExtractedParameter[]).map(
            (p) => ({
              key: p.key,
              testName: p.testName,
              value: p.value,
              unit: p.unit,
              referenceRange: p.referenceRange,
              status: p.status,
            })
          ),
        }
      : null,
    history,
  };
}

export class AssistantController {
  static ask = guard(async (req: any, res: Response) => {
    const parsed = askSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, zodMessage(parsed.error));

    // A clinician may pass ?patientId=, but only after checkPatientAccess has
    // authorised it and written the id onto the request. A patient can only
    // ever be asking about themselves.
    const patientId =
      req.user.role === Role.PATIENT ? req.user.userId : ((req as any).patientId as string);

    if (!patientId) return fail(res, 400, 'No patient context for this question.');

    const context = await buildContext(patientId);

    let answer;
    try {
      answer = await AiService.ask(parsed.data.question, context);
    } catch (error: any) {
      return fail(
        res,
        503,
        'The assistant is unavailable right now. Please try again shortly.'
      );
    }

    await AuditService.record({
      actorId: req.user.userId,
      patientId,
      action: 'ASSISTANT_QUERY',
      detail: parsed.data.question.slice(0, 200),
      ipAddress: req.ip,
    });

    return ok(res, {
      question: parsed.data.question,
      ...answer,
      groundedIn: {
        records: context.recordCount,
        analysedRecords: context.analysedCount,
        parameters: new Set(context.history.map((h) => h.key)).size,
      },
    });
  }, 'The assistant could not answer that.');

  /** Starter questions, built from what this patient actually has on file. */
  static suggestions = guard(async (req: any, res: Response) => {
    const patientId =
      req.user.role === Role.PATIENT ? req.user.userId : ((req as any).patientId as string);
    const context = await buildContext(patientId);

    const suggestions: string[] = [];
    if (context.latest) {
      suggestions.push('What is flagged in my latest report?');
      const flagged = context.latest.parameters.filter(
        (p) => p.status === 'HIGH' || p.status === 'LOW'
      );
      for (const p of flagged.slice(0, 2)) {
        suggestions.push(`What does my ${p.testName} result mean?`);
      }
      const repeated = [...new Set(context.history.map((h) => h.key))].filter(
        (key) => context.history.filter((h) => h.key === key).length >= 2
      );
      if (repeated.length) {
        const name = context.history.find((h) => h.key === repeated[0])!.testName;
        suggestions.push(`Has my ${name} changed since my last report?`);
      }
    } else {
      suggestions.push('How many reports do I have?');
      suggestions.push('What is HbA1c?');
    }
    suggestions.push('Give me an overview of my results.');

    return ok(res, { suggestions: [...new Set(suggestions)].slice(0, 5) });
  }, 'Failed to build suggestions.');
}
