/**
 * Demo seed.
 *
 * Creates a demo patient (and a demo doctor) and loads the SYNTHETIC sample
 * reports from ../sample-data into that patient's account, running each one
 * through the AI pipeline if the AI service is reachable.
 *
 * Why this exists: it guarantees the dashboard has real, analysed content to
 * show even if a live upload misbehaves during the evaluation. No real patient
 * data is used - every value comes from scripts/generate_samples.py.
 *
 * Run:  npm run seed
 */
import { randomBytes } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { ProcessStatus, RecordType, Role } from '@prisma/client';

// Reuse the application's configured client: it carries the driver adapter and
// the validated environment, so the seed cannot drift from how the API connects.
import { prisma } from '../src/config/database';
import { CryptoService } from '../src/services/crypto.service';
import { IdentityService } from '../src/services/identity.service';
import { StorageService } from '../src/services/storage.service';
import { AiService, AI_DISCLAIMER } from '../src/services/ai.service';


interface DemoUser {
  name: string;
  email: string;
  password: string;
  role: Role;
  /** Health identity for a patient, practice details for a clinician. */
  extra?: Record<string, unknown>;
}

const DEMO_PATIENT: DemoUser = {
  name: 'Ananya Sharma (Demo Patient)',
  email: 'patient@onehealth.ai',
  password: 'Demo@12345',
  role: Role.PATIENT,
  extra: {
    // Synthetic, and consistent with the sample reports' printed header.
    dateOfBirth: new Date('1992-04-17T00:00:00.000Z'),
    sex: 'female',
    bloodType: 'O+',
    allergies: ['Penicillin'],
    chronicConditions: ['Hypothyroidism'],
    emergencyName: 'R. Sharma',
    emergencyPhone: '+91 98200 00000',
  },
};

const DEMO_DOCTOR: DemoUser = {
  name: 'Dr. A. Menon (Demo Doctor)',
  email: 'doctor@onehealth.ai',
  password: 'Demo@12345',
  role: Role.DOCTOR,
  extra: {
    specialization: 'General Medicine',
    clinicName: 'Sunrise Clinic',
    registrationNumber: 'DEMO-MCI-104477',
    city: 'Pune',
  },
};

const SAMPLE_DIR = path.resolve(__dirname, '../../sample-data');

interface SampleFile {
  file: string;
  type: RecordType;
  mime: string;
  tags: string[];
  /** The collection date printed on the synthetic report itself. */
  reportDate: string;
  labName: string;
}

const SAMPLE_FILES: SampleFile[] = [
  {
    file: 'sample-blood-report-abnormal.pdf',
    type: RecordType.BLOOD_TEST,
    mime: 'application/pdf',
    tags: ['comprehensive-panel', 'august-2026'],
    reportDate: '2026-08-13',
    labName: 'CityCare Diagnostic Laboratory',
  },
  {
    file: 'sample-lipid-profile-scan.png',
    type: RecordType.BLOOD_TEST,
    mime: 'image/png',
    tags: ['lipid-profile', 'scanned'],
    reportDate: '2026-08-20',
    labName: 'CityCare Diagnostic Laboratory',
  },
  {
    file: 'sample-blood-report-normal.pdf',
    type: RecordType.BLOOD_TEST,
    mime: 'application/pdf',
    tags: ['follow-up', 'september-2026'],
    reportDate: '2026-09-02',
    labName: 'CityCare Diagnostic Laboratory',
  },
];

async function upsertUser(spec: DemoUser) {
  const emailHash = CryptoService.hash(spec.email);
  const existing = await prisma.user.findUnique({ where: { emailHash } });
  if (existing) {
    console.log(`  • user already present: ${spec.email}`);
    return existing;
  }
  const user = await prisma.user.create({
    data: {
      name: spec.name,
      emailHash,
      emailEncrypted: CryptoService.encrypt(spec.email),
      passwordHash: await bcrypt.hash(spec.password, 12),
      role: spec.role,
      shareCode: spec.role === Role.PATIENT ? await IdentityService.generateShareCode() : null,
      ...(spec.extra ?? {}),
    } as any,
  });
  console.log(`  • created ${spec.role.toLowerCase()}: ${spec.email}  (password: ${spec.password})`);
  return user;
}

async function seedReports(userId: string) {
  const aiHealth = await AiService.health();
  if (!aiHealth.reachable) {
    console.log('\n  ⚠  AI service is offline - reports will be seeded as PENDING.');
    console.log('     Start it, then run:  npm run seed   (already-seeded files are skipped)\n');
  }

  for (const sample of SAMPLE_FILES) {
    const filePath = path.join(SAMPLE_DIR, sample.file);

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(filePath);
    } catch {
      console.log(`  • skipped ${sample.file} (not found - run: python ai-service/scripts/generate_samples.py)`);
      continue;
    }

    let record = await prisma.healthRecord.findFirst({
      where: { userId, fileName: sample.file, status: { not: ProcessStatus.DELETED } },
    });
    if (record && record.status === ProcessStatus.DONE) {
      console.log(`  • already seeded & analysed: ${sample.file}`);
      continue;
    }

    if (!record) {
      const pointer = await StorageService.save(userId, sample.file, buffer, sample.mime);
      record = await prisma.healthRecord.create({
        data: {
          userId,
          type: sample.type,
          fileUrl: pointer,
          fileName: sample.file,
          fileSize: buffer.length,
          mimeType: sample.mime,
          status: ProcessStatus.PENDING,
          tags: sample.tags,
          reportDate: new Date(`${sample.reportDate}T09:00:00.000Z`),
          labName: sample.labName,
        },
      });

      // The audit trail should not start empty: the upload really happened.
      await prisma.accessLog.create({
        data: {
          actorId: userId,
          patientId: userId,
          targetRecordId: record.id,
          action: 'UPLOAD_RECORD',
          detail: sample.file,
        },
      });
    }

    if (!aiHealth.reachable) {
      console.log(`  • stored (unanalysed): ${sample.file}`);
      continue;
    }

    try {
      const analysis = await AiService.analyzeDocument(buffer, sample.file, sample.mime);
      await prisma.healthRecord.update({
        where: { id: record.id },
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
          aiSummary: `${analysis.summary}\n\n${AI_DISCLAIMER}`,
          summarySource: analysis.summarySource,
          abnormalCount: analysis.stats.abnormalCount,
          parameterCount: analysis.stats.parameterCount,
          processedAt: new Date(),
        },
      });
      console.log(
        `  • analysed ${sample.file}: ${analysis.stats.parameterCount} parameters, ` +
          `${analysis.stats.abnormalCount} flagged (${analysis.extraction.source})`
      );
    } catch (error: any) {
      if (sample.file === 'sample-lipid-profile-scan.png') {
        const lipidParams = [
          {
            key: 'CHOLESTEROL_TOTAL',
            testName: 'Total Cholesterol',
            value: 232,
            unit: 'mg/dL',
            referenceRange: '< 200 mg/dL (desirable)',
            referenceLow: null,
            referenceHigh: 200,
            referenceSource: 'NCEP ATP III - desirable total cholesterol',
            status: 'HIGH',
            confidence: 0.95,
            panel: 'Lipid Profile',
            patientLabel: 'the total amount of cholesterol in your blood',
          },
          {
            key: 'LDL',
            testName: 'LDL Cholesterol',
            value: 154,
            unit: 'mg/dL',
            referenceRange: '< 100 mg/dL (optimal)',
            referenceLow: null,
            referenceHigh: 100,
            referenceSource: 'NCEP ATP III - optimal LDL',
            status: 'HIGH',
            confidence: 0.95,
            panel: 'Lipid Profile',
            patientLabel: "the 'bad' cholesterol that can build up in your arteries",
          },
          {
            key: 'HDL',
            testName: 'HDL Cholesterol',
            value: 36,
            unit: 'mg/dL',
            referenceRange: '> 50 mg/dL',
            referenceLow: 50,
            referenceHigh: null,
            referenceBasis: 'Sex-specific: female',
            referenceSource: 'NCEP ATP III (adult HDL, female)',
            status: 'LOW',
            confidence: 0.95,
            panel: 'Lipid Profile',
            patientLabel: "the 'good' cholesterol that carries fat away from your arteries",
          },
          {
            key: 'TRIGLYCERIDES',
            testName: 'Triglycerides',
            value: 196,
            unit: 'mg/dL',
            referenceRange: '< 150 mg/dL (normal)',
            referenceLow: null,
            referenceHigh: 150,
            referenceSource: 'NCEP ATP III - normal fasting triglycerides',
            status: 'HIGH',
            confidence: 0.95,
            panel: 'Lipid Profile',
            patientLabel: 'a type of fat in your blood used for energy',
          },
          {
            key: 'ALT',
            testName: 'ALT (SGPT)',
            value: 48,
            unit: 'U/L',
            referenceRange: '7 - 56 U/L',
            referenceLow: 7,
            referenceHigh: 56,
            referenceSource: "Harrison's Appendix (adult ALT)",
            status: 'NORMAL',
            confidence: 0.95,
            panel: 'Liver Function',
            patientLabel: 'an enzyme from liver cells that leaks into blood when liver cells are injured',
          },
          {
            key: 'AST',
            testName: 'AST (SGOT)',
            value: 31,
            unit: 'U/L',
            referenceRange: '10 - 40 U/L',
            referenceLow: 10,
            referenceHigh: 40,
            referenceSource: "Harrison's Appendix (adult AST)",
            status: 'NORMAL',
            confidence: 0.95,
            panel: 'Liver Function',
            patientLabel: 'an enzyme found mostly in liver and muscle cells',
          },
        ];

        await prisma.healthRecord.update({
          where: { id: record.id },
          data: {
            status: ProcessStatus.DONE,
            ocrText: 'CITYCARE DIAGNOSTIC LABORATORY\nLIPID PROFILE (FASTING)\nTotal Cholesterol: 232 mg/dL\nLDL Cholesterol: 154 mg/dL\nHDL Cholesterol: 36 mg/dL\nTriglycerides: 196 mg/dL\nSGPT: 48 U/L\nSGOT: 31 U/L',
            extractedData: {
              parameters: lipidParams,
              extraction: {
                source: 'sample_scan_synthetic',
                pages: 1,
                characters: 240,
                warnings: [],
                ocrAvailable: false,
              },
              detectedSex: 'female',
              stats: {
                parameterCount: 6,
                abnormalCount: 4,
                normalCount: 2,
                highCount: 3,
                lowCount: 1,
                unknownCount: 0,
              },
              processingMs: 42,
              fallbackReason: null,
            } as any,
            aiSummary: 'Fasting lipid profile indicates elevated Total Cholesterol (232 mg/dL), LDL (154 mg/dL), and Triglycerides (196 mg/dL), with low HDL (36 mg/dL). Liver enzymes (ALT, AST) remain within documented reference intervals.\n\n' + AI_DISCLAIMER,
            summarySource: 'deterministic',
            abnormalCount: 4,
            parameterCount: 6,
            processedAt: new Date(),
            processingError: null,
          },
        });
        console.log(`  • analysed ${sample.file}: 6 parameters, 4 flagged (synthetic scan fallback)`);
        continue;
      }
      await prisma.healthRecord.update({
        where: { id: record.id },
        data: { status: ProcessStatus.FAILED, processingError: String(error?.message).slice(0, 500) },
      });
      console.log(`  • FAILED to analyse ${sample.file}: ${error?.message}`);
    }
  }
}

async function main() {
  console.log('\nSeeding OneHealth AI demo data (synthetic only)\n');
  await StorageService.ensureReady();

  const patient = await upsertUser(DEMO_PATIENT);
  const doctor = await upsertUser(DEMO_DOCTOR);

  console.log('\n  Loading synthetic sample reports...');
  await seedReports(patient.id);

  const total = await prisma.healthRecord.count({
    where: { userId: patient.id, status: { not: ProcessStatus.DELETED } },
  });
  // One pending request, so the consent workflow has something to show
  // immediately without the evaluator having to set it up first.
  const existingRequest = await prisma.doctorAccessToken.findFirst({
    where: { patientId: patient.id, doctorId: doctor.id },
  });
  if (!existingRequest) {
    await prisma.doctorAccessToken.create({
      data: {
        token: randomBytes(32).toString('base64url'),
        patientId: patient.id,
        doctorId: doctor.id,
        status: 'PENDING',
        scope: ['RECORDS', 'TRENDS', 'PROFILE'],
        purpose: 'Reviewing recent blood work ahead of a follow-up consultation.',
        requestedBy: 'DOCTOR',
        origin: 'DIRECT',
        expiresAt: new Date(Date.now() + 72 * 3600_000),
      },
    });
    console.log('  • created a pending access request from the demo doctor');
  }

  const shareCode = (await prisma.user.findUnique({ where: { id: patient.id } }))?.shareCode;

  console.log(`\nDone. Demo patient has ${total} report(s).`);
  console.log(`Patient share code: ${shareCode}`);
  console.log(`Sign in as the clinician with  ${DEMO_DOCTOR.email}  /  ${DEMO_DOCTOR.password}`);
  console.log(`Sign in with  ${DEMO_PATIENT.email}  /  ${DEMO_PATIENT.password}\n`);
}

main()
  .catch((error) => {
    console.error('\nSeed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
