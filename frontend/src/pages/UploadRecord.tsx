import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  ScanLine,
  ShieldCheck,
  Upload,
  BrainCircuit,
  Lock,
  Sparkles,
  Info,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import UploadPanel from '../components/UploadPanel';
import { Panel, PanelHeader, PageHeader } from '../components/ui';

const STEPS = [
  {
    icon: Lock,
    title: '1. Encrypted Storage at Rest',
    body: 'Your file is saved in isolated, encrypted local storage with strict ownership verification. Only you and clinicians you explicitly authorise can retrieve it.',
  },
  {
    icon: ScanLine,
    title: '2. High-Fidelity OCR & Text Parsing',
    body: 'Digital PDFs are parsed directly from their vector text layer. Scanned documents and camera photos pass through Tesseract OCR preprocessing.',
  },
  {
    icon: ShieldCheck,
    title: '3. Deterministic Clinical Extraction',
    body: 'Exact biomarker numbers are mapped against standard clinical reference intervals (WHO, ADA, NCEP). Lab values are never fabricated or guessed by an LLM.',
  },
  {
    icon: BrainCircuit,
    title: '4. Negation-Aware Clinical NER',
    body: 'Medical terminology is verified with clinical entity recognition, ensuring statements like "no evidence of diabetes" are never mistakenly flagged as disease.',
  },
];

const RECOGNISED_BIOMARKERS = [
  'Hemoglobin',
  'RBC & WBC Counts',
  'Platelets',
  'Fasting Blood Glucose',
  'HbA1c',
  'Serum Creatinine',
  'TSH (Thyroid)',
  'Total Cholesterol',
  'LDL & HDL Cholesterol',
  'Triglycerides',
  'ALT (SGPT)',
  'AST (SGOT)',
];

const UploadRecord: React.FC = () => {
  const navigate = useNavigate();

  return (
    <AppShell>
      <PageHeader
        title="Add Medical Record"
        description="Upload a laboratory blood panel, radiology report, discharge summary or prescription for automated clinical extraction."
      />

      <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
        {/* Upload Form (3 cols) */}
        <Panel className="min-w-0 lg:col-span-3 overflow-hidden shadow-sm">
          <PanelHeader
            title="Upload Document"
            description="Drag & drop or select files to add to your health vault"
            icon={Upload}
          />
          <UploadPanel onUploaded={() => navigate('/reports')} />
        </Panel>

        {/* Pipeline & Information Side (2 cols) */}
        <div className="space-y-6 lg:col-span-2">
          {/* How AI pipeline works */}
          <Panel className="min-w-0 overflow-hidden shadow-sm">
            <PanelHeader
              title="How Our AI Pipeline Works"
              description="Grounded & deterministic extraction"
              icon={Sparkles}
            />
            <div className="p-5 space-y-4">
              <ol className="relative space-y-4 border-l border-sky-200 dark:border-sky-900/60 ml-3 pl-5">
                {STEPS.map((step) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.title} className="relative group">
                      <span className="absolute -left-[27px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-slate-900 border-2 border-sky-500 text-sky-600 dark:text-sky-400">
                        <Icon className="h-3 w-3" />
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {step.title}
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {step.body}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </div>
          </Panel>

          {/* Recognised Laboratory Panels */}
          <Panel className="min-w-0 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Recognised Biomarkers
              </h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Standard clinical reference ranges are matched for:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {RECOGNISED_BIOMARKERS.map((bio) => (
                <span
                  key={bio}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300"
                >
                  {bio}
                </span>
              ))}
            </div>
          </Panel>

          {/* Safety Notice */}
          <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-4 flex gap-3 text-xs text-amber-900 dark:text-amber-200">
            <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Clinical Decision Support Notice:</strong> All extractions are presented for patient information and review. They do not constitute formal diagnostic advice.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default UploadRecord;
