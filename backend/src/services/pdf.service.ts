/**
 * Patient health summary export.
 *
 * The document contains only values already stored for that patient: profile
 * fields they entered, records they uploaded, parameters the extractor read,
 * and interpretations the platform generated. Nothing is computed for the
 * export and nothing is inferred — a field the patient has not filled in prints
 * as "Not provided", and the medical disclaimer is stamped on the first page.
 */
import PDFDocument from 'pdfkit';
import { AI_DISCLAIMER, ExtractedParameter } from './ai.service';

const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';
const ACCENT = '#1e3a8a';
const HIGH = '#991b1b';
const LOW = '#9a3412';
const NORMAL = '#065f46';

export interface SummaryRecord {
  id: string;
  fileName: string;
  type: string;
  status: string;
  uploadedAt: Date;
  reportDate: Date | null;
  labName: string | null;
  parameterCount: number;
  abnormalCount: number;
  aiSummary: string | null;
  summarySource: string | null;
  parameters: ExtractedParameter[];
}

export interface SummaryInput {
  patient: {
    name: string;
    email: string | null;
    dateOfBirth: Date | null;
    sex: string | null;
    bloodType: string | null;
    abhaId: string | null;
    allergies: string[];
    chronicConditions: string[];
    emergencyName: string | null;
    emergencyPhone: string | null;
  };
  records: SummaryRecord[];
  generatedBy: string;
}

const NOT_PROVIDED = 'Not provided';

function value(input: string | null | undefined): string {
  return input && String(input).trim() ? String(input) : NOT_PROVIDED;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return NOT_PROVIDED;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusColour(status: string): string {
  if (status === 'HIGH') return HIGH;
  if (status === 'LOW') return LOW;
  if (status === 'NORMAL') return NORMAL;
  return MUTED;
}

export class PdfService {
  static build(input: SummaryInput): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 46, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const left = doc.page.margins.left;

      const rule = (gap = 8) => {
        doc.moveDown(0.3);
        doc
          .strokeColor(LINE)
          .lineWidth(0.8)
          .moveTo(left, doc.y)
          .lineTo(left + width, doc.y)
          .stroke();
        doc.y += gap;
      };

      const heading = (text: string) => {
        if (doc.y > doc.page.height - 140) doc.addPage();
        doc.moveDown(0.6);
        doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(10.5).text(text.toUpperCase(), left, doc.y, {
          characterSpacing: 0.6,
        });
        rule(8);
      };

      const field = (label: string, text: string, x: number, y: number, w: number) => {
        doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text(label.toUpperCase(), x, y, {
          width: w,
          characterSpacing: 0.5,
        });
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text(text, x, y + 11, { width: w });
      };

      // ---- Header ----------------------------------------------------------
      doc.rect(0, 0, doc.page.width, 84).fill('#f8fafc');
      doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(0, 84).lineTo(doc.page.width, 84).stroke();
      
      doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(18).text('OneHealth AI', left, 22);
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('CLINICAL SUMMARY REPORT', left, 44);
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(8.5)
        .text('Patient-supplied health records and derived analytics', left, 56);
        
      doc
        .fillColor(MUTED)
        .fontSize(8.5)
        .text(
          `Exported: ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`,
          left,
          24,
          { width, align: 'right' }
        );
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(`By: ${input.generatedBy}`, left, 38, { width, align: 'right' });

      doc.y = 110;

      // ---- Patient ---------------------------------------------------------
      heading('Patient');
      const col = width / 3;
      let rowY = doc.y;
      field('Name', value(input.patient.name), left, rowY, col - 10);
      field('Date of birth', formatDate(input.patient.dateOfBirth), left + col, rowY, col - 10);
      field('Sex', value(input.patient.sex), left + col * 2, rowY, col - 10);
      rowY += 34;
      field('Blood type', value(input.patient.bloodType), left, rowY, col - 10);
      field('ABHA ID', value(input.patient.abhaId), left + col, rowY, col - 10);
      field('Contact', value(input.patient.email), left + col * 2, rowY, col - 10);
      rowY += 34;
      field(
        'Known allergies',
        input.patient.allergies.length ? input.patient.allergies.join(', ') : NOT_PROVIDED,
        left,
        rowY,
        col * 1.5 - 10
      );
      field(
        'Chronic conditions',
        input.patient.chronicConditions.length
          ? input.patient.chronicConditions.join(', ')
          : NOT_PROVIDED,
        left + col * 1.5,
        rowY,
        col * 1.5 - 10
      );
      rowY += 34;
      field(
        'Emergency contact',
        input.patient.emergencyName
          ? `${input.patient.emergencyName}${input.patient.emergencyPhone ? ` — ${input.patient.emergencyPhone}` : ''}`
          : NOT_PROVIDED,
        left,
        rowY,
        width
      );
      doc.y = rowY + 34;

      // ---- Disclaimer ------------------------------------------------------
      const boxTop = doc.y;
      doc.rect(left, boxTop, width, 42).fillAndStroke('#fff7ed', '#fdba74');
      doc
        .fillColor('#9a3412')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('MEDICAL DISCLAIMER', left + 10, boxTop + 8);
      doc
        .fillColor('#7c2d12')
        .font('Helvetica')
        .fontSize(8)
        .text(AI_DISCLAIMER, left + 10, boxTop + 20, { width: width - 20 });
      doc.y = boxTop + 52;

      // ---- Record history --------------------------------------------------
      heading('Record history');
      if (input.records.length === 0) {
        doc.fillColor(MUTED).font('Helvetica').fontSize(9).text('No records on file.', left, doc.y);
      } else {
        const cols = [width * 0.4, width * 0.16, width * 0.16, width * 0.14, width * 0.14];
        const headerY = doc.y;
        const labels = ['Report', 'Date', 'Type', 'Values', 'Flagged'];
        let x = left;
        labels.forEach((labelText, i) => {
          doc
            .fillColor(MUTED)
            .font('Helvetica-Bold')
            .fontSize(7.5)
            .text(labelText.toUpperCase(), x, headerY, { width: cols[i]! - 6 });
          x += cols[i]!;
        });
        doc.y = headerY + 14;
        rule(6);

        for (const record of input.records) {
          if (doc.y > doc.page.height - 90) doc.addPage();
          const y = doc.y;
          x = left;
          const cells = [
            record.fileName,
            formatDate(record.reportDate ?? record.uploadedAt),
            record.type.replace(/_/g, ' ').toLowerCase(),
            record.status === 'DONE' ? String(record.parameterCount) : record.status.toLowerCase(),
            record.status === 'DONE' ? String(record.abnormalCount) : '—',
          ];
          cells.forEach((cell, i) => {
            doc
              .fillColor(i === 4 && record.abnormalCount > 0 ? HIGH : INK)
              .font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(8.5)
              .text(cell, x, y, { width: cols[i]! - 6, ellipsis: true, lineBreak: false });
            x += cols[i]!;
          });
          doc.y = y + 15;
        }
      }

      // ---- Per-report detail ----------------------------------------------
      const analysed = input.records.filter((r) => r.status === 'DONE' && r.parameters.length > 0);

      for (const record of analysed) {
        doc.addPage();
        heading(record.fileName);
        doc
          .fillColor(MUTED)
          .font('Helvetica')
          .fontSize(8.5)
          .text(
            `${formatDate(record.reportDate ?? record.uploadedAt)}` +
              `${record.labName ? ` · ${record.labName}` : ''}` +
              ` · ${record.parameterCount} values · ${record.abnormalCount} outside reference range`,
            left,
            doc.y
          );
        doc.moveDown(0.8);

        // Results table
        const cols = [width * 0.34, width * 0.13, width * 0.13, width * 0.24, width * 0.16];
        const labels = ['Test', 'Result', 'Unit', 'Reference range', 'Status'];
        let headerY = doc.y;
        let x = left;
        labels.forEach((labelText, i) => {
          doc
            .fillColor(MUTED)
            .font('Helvetica-Bold')
            .fontSize(7.5)
            .text(labelText.toUpperCase(), x, headerY, { width: cols[i]! - 6 });
          x += cols[i]!;
        });
        doc.y = headerY + 13;
        rule(6);

        for (const p of record.parameters) {
          if (doc.y > doc.page.height - 80) {
            doc.addPage();
            doc.y = doc.page.margins.top;
          }
          const y = doc.y;
          x = left;
          const cells = [
            p.testName,
            String(p.value),
            p.unit || '—',
            p.referenceRange || '—',
            p.status,
          ];
          cells.forEach((cell, i) => {
            doc
              .fillColor(i === 4 ? statusColour(p.status) : INK)
              .font(i === 0 || i === 4 ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(8.5)
              .text(cell, x, y, { width: cols[i]! - 6, ellipsis: true, lineBreak: false });
            x += cols[i]!;
          });
          doc.y = y + 14;
        }

        if (record.aiSummary) {
          heading('Assisted interpretation');
          doc
            .fillColor(MUTED)
            .font('Helvetica-Oblique')
            .fontSize(7.5)
            .text(
              record.summarySource === 'openai'
                ? 'Generated by a language model from values extracted by the platform.'
                : 'Generated by the platform’s built-in deterministic explainer.',
              left,
              doc.y
            );
          doc.moveDown(0.4);
          doc
            .fillColor(INK)
            .font('Helvetica')
            .fontSize(9)
            .text(record.aiSummary.replace(AI_DISCLAIMER, '').trim(), left, doc.y, {
              width,
              lineGap: 2,
            });
        }
      }

      // ---- Footer on every page -------------------------------------------
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const footerY = doc.page.height - 34;
        doc
          .strokeColor(LINE)
          .lineWidth(0.6)
          .moveTo(left, footerY - 8)
          .lineTo(left + width, footerY - 8)
          .stroke();
        doc
          .fillColor(MUTED)
          .font('Helvetica')
          .fontSize(7.5)
          .text(
            `OneHealth AI · Patient health summary · Not a diagnostic document · Exported by ${input.generatedBy}`,
            left,
            footerY,
            { width: width * 0.8 }
          );
        doc
          .fillColor(MUTED)
          .fontSize(7.5)
          .text(`Page ${i + 1} of ${range.count}`, left, footerY, { width, align: 'right' });
      }

      doc.end();
    });
  }
}
