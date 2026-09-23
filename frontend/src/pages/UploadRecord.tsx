import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ScanLine, ShieldCheck, Upload } from 'lucide-react';
import AppShell from '../components/AppShell';
import UploadPanel from '../components/UploadPanel';
import { Panel, PanelHeader, PageHeader } from '../components/ui';

const STEPS = [
  {
    icon: FileText,
    title: 'The document is stored',
    body: 'Your file is saved against your account. Only you — and clinicians you explicitly authorise — can retrieve it.',
  },
  {
    icon: ScanLine,
    title: 'The text is read',
    body: 'A PDF with a text layer is read directly. A scan or photograph goes through optical character recognition.',
  },
  {
    icon: ShieldCheck,
    title: 'Values are extracted and compared',
    body: 'Laboratory values are matched by name and compared against published reference intervals. The numbers are never produced by a language model.',
  },
];

const UploadRecord: React.FC = () => {
  const navigate = useNavigate();

  return (
    <AppShell>
      <PageHeader
        title="Add a medical record"
        description="Upload a laboratory report, prescription, discharge summary or scan."
      />

      <div className="grid gap-5 lg:grid-cols-5 lg:items-start">
        <Panel className="min-w-0 lg:col-span-3">
          <PanelHeader title="Upload" icon={Upload} />
          <UploadPanel onUploaded={() => navigate('/reports')} />
        </Panel>

        <Panel className="min-w-0 lg:col-span-2">
          <PanelHeader title="What happens next" />
          <ol className="divide-y divide-line">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="flex gap-3.5 px-5 py-4">
                  <span className="mt-0.5 h-7 w-7 shrink-0 rounded-full border border-line bg-sunken grid place-items-center text-xs font-semibold text-muted tabular">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                      <Icon className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                      {step.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{step.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>
      </div>
    </AppShell>
  );
};

export default UploadRecord;
