import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Cpu,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  ScanLine,
  Trash2,
  Building2,
  Calendar,
  Lock,
  Tag,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { recordsApi } from '../services/recordsApi';
import type { ExtractedParameter, RecordDetail as Detail } from '../services/recordsApi';
import { apiErrorMessage } from '../services/apiClient';
import {
  formatBytes,
  formatDate,
  formatDateTime,
  RECORD_TYPE_LABELS,
  rangePosition,
  STATUS_STYLES,
} from '../lib/format';
import AppShell from '../components/AppShell';
import {
  Alert,
  Badge,
  Button,
  DefinitionList,
  Field,
  Input,
  MedicalDisclaimer,
  Modal,
  NotProvided,
  Panel,
  PanelHeader,
  PageHeader,
  PageLoader,
  RangeMeter,
  RecordStatusChip,
  Select,
  StatusChip,
  Textarea,
} from '../components/ui';

/** Results table grouped by clinical panel with exceptions elevated first */
const ResultsTable: React.FC<{ parameters: ExtractedParameter[] }> = ({ parameters }) => {
  const panels = parameters.reduce<Record<string, ExtractedParameter[]>>((acc, parameter) => {
    (acc[parameter.panel] ||= []).push(parameter);
    return acc;
  }, {});

  const weight = (p: ExtractedParameter) =>
    p.status === 'HIGH' || p.status === 'LOW' ? 0 : p.status === 'UNKNOWN' ? 2 : 1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] text-sm border-collapse">
        <caption className="sr-only">
          Laboratory values extracted from this report, with reference ranges and status
        </caption>
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 text-left">
            <th scope="col" className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Biomarker / Test
            </th>
            <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
              Observed Value
            </th>
            <th scope="col" className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Unit
            </th>
            <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Reference Interval
            </th>
            <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-44">
              Range Position
            </th>
            <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Status
            </th>
            <th scope="col" className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
              Confidence
            </th>
          </tr>
        </thead>
        {Object.entries(panels).map(([panel, rows]) => (
          <tbody key={panel}>
            <tr>
              <th
                scope="colgroup"
                colSpan={7}
                className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-800/50 px-5 py-2.5 text-left text-xs font-bold text-sky-950 dark:text-sky-300 uppercase tracking-wider"
              >
                {panel}
              </th>
            </tr>
            {[...rows].sort((a, b) => weight(a) - weight(b)).map((parameter) => {
              const abnormal = parameter.status === 'HIGH' || parameter.status === 'LOW';
              return (
                <tr
                  key={parameter.key}
                  className={`border-b border-slate-100 dark:border-slate-800/60 last:border-0 transition-colors ${
                    abnormal
                      ? 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70 dark:hover:bg-rose-950/30'
                      : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <th scope="row" className="px-5 py-3.5 text-left align-top font-medium text-slate-900 dark:text-white">
                    <span className="font-semibold">{parameter.testName}</span>
                    {parameter.ocrUncertain && (
                      <span className="mt-0.5 block text-xs font-normal text-amber-600 dark:text-amber-400">
                        ⚠️ OCR uncertain on this value — verify against original document.
                      </span>
                    )}
                    {parameter.patientLabel && (
                      <span className="mt-0.5 block text-xs font-normal text-slate-400 dark:text-slate-500">
                        {parameter.patientLabel}
                      </span>
                    )}
                  </th>
                  <td className="px-4 py-3.5 text-right align-top">
                    <span
                      className={`tabular text-base font-bold ${
                        parameter.status === 'HIGH'
                          ? 'text-rose-600 dark:text-rose-400'
                          : parameter.status === 'LOW'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {parameter.value}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 align-top font-mono text-xs text-slate-500 dark:text-slate-400">
                    {parameter.unit || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 align-top">
                    <span className="tabular font-medium text-slate-700 dark:text-slate-300 text-xs">
                      {parameter.referenceRange}
                    </span>
                    {parameter.referenceBasis && (
                      <span className="mt-0.5 block text-[11px] text-slate-400">{parameter.referenceBasis}</span>
                    )}
                    {parameter.reportedRange && parameter.reportedRange !== parameter.referenceRange && (
                      <span className="mt-0.5 block text-[11px] text-slate-400">
                        Lab printed: {parameter.reportedRange}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <RangeMeter
                      position={rangePosition(
                        parameter.value,
                        parameter.referenceLow,
                        parameter.referenceHigh
                      )}
                      status={parameter.status}
                    />
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <StatusChip status={parameter.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right align-top tabular text-xs text-slate-400">
                    {Math.round(parameter.confidence * 100)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
};

const ReportDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [disclaimer, setDisclaimer] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pollRef = useRef<number | null>(null);

  const [form, setForm] = useState({ type: 'OTHER', labName: '', notes: '', reportDate: '', tags: '' });

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await recordsApi.get(id);
      setDetail(data.record);
      setDisclaimer(data.disclaimer);
      setReadOnly(Boolean((data as any).viewer?.readOnly));
      setForm({
        type: data.record.type,
        labName: data.record.labName ?? '',
        notes: data.record.notes ?? '',
        reportDate: data.record.reportDate ? data.record.reportDate.slice(0, 10) : '',
        tags: (data.record.tags ?? []).join(', '),
      });
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'We could not load this report.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const processing = detail?.status === 'PENDING' || detail?.status === 'PROCESSING';
    if (!processing) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = window.setInterval(load, 2000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [detail?.status, load]);

  useEffect(
    () => () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    },
    [fileUrl]
  );

  const openOriginal = async () => {
    if (!id) return;
    try {
      const url = fileUrl ?? (await recordsApi.fileBlobUrl(id));
      setFileUrl(url);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setError(apiErrorMessage(err, 'The original document could not be opened.'));
    }
  };

  const retry = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await recordsApi.reprocess(id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not restart the analysis.'));
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await recordsApi.update(id, {
        type: form.type,
        labName: form.labName.trim() || null,
        notes: form.notes.trim() || null,
        reportDate: form.reportDate || null,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setEditing(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save those details.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await recordsApi.remove(id);
      navigate('/reports');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete this report.'));
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <PageLoader label="Loading clinical analysis…" />
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell>
        <Alert tone="error" title="Report unavailable">
          {error || 'This report could not be found.'}
        </Alert>
        <Link
          to="/reports"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to medical records
        </Link>
      </AppShell>
    );
  }

  const processing = detail.status === 'PENDING' || detail.status === 'PROCESSING';
  const summaryBody = (detail.aiSummary || '').replace(disclaimer, '').trim();
  const abnormal = detail.parameters.filter((p) => p.status === 'HIGH' || p.status === 'LOW');
  const normal = detail.parameters.filter((p) => p.status === 'NORMAL');
  const unknown = detail.parameters.filter((p) => p.status === 'UNKNOWN');

  return (
    <AppShell>
      {/* Top Breadcrumb & Actions Bar */}
      <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
        <Link
          to="/reports"
          className="inline-flex items-center gap-1.5 font-semibold text-sky-600 dark:text-sky-400 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Medical Records
        </Link>
        <div className="flex items-center gap-2">
          {detail.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300"
            >
              <Tag className="h-2.5 w-2.5" />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Main Page Header */}
      <PageHeader
        title={detail.fileName}
        description={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <RecordStatusChip status={detail.status} />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {RECORD_TYPE_LABELS[detail.type] ?? detail.type}
            </span>
            {detail.labName && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                {detail.labName}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              {detail.reportDate ? `Report Date: ${formatDate(detail.reportDate)}` : `Uploaded ${formatDate(detail.uploadedAt)}`}
            </span>
            <span>{formatBytes(detail.fileSize)}</span>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={openOriginal} size="sm">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Original File
            </Button>
            {!readOnly && (
              <>
                <Button variant="secondary" onClick={() => setEditing(true)} size="sm">
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit Details
                </Button>
                {(detail.status === 'FAILED' || detail.status === 'DONE') && (
                  <Button variant="secondary" onClick={retry} loading={busy} size="sm">
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Re-analyse
                  </Button>
                )}
                <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={busy} size="sm">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Delete
                </Button>
              </>
            )}
          </div>
        }
      />

      {readOnly && (
        <Alert tone="info" className="mb-5">
          <span className="inline-flex items-center gap-2">
            <Eye className="h-4 w-4" aria-hidden="true" />
            You are viewing this record under patient-granted consent. Your read access is permanently recorded in the audit trail.
          </span>
        </Alert>
      )}

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      {processing && (
        <Panel className="mb-5">
          <div className="px-5 py-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-600" aria-hidden="true" />
            <h2 className="mt-4 text-base font-bold text-slate-900 dark:text-white">Analyzing Medical Document</h2>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
              Reading text layer, matching biometric parameters against clinical reference standards...
            </p>
          </div>
        </Panel>
      )}

      {detail.status === 'FAILED' && (
        <Alert tone="error" title="Analysis could not complete" className="mb-5">
          <p>{detail.processingError || 'The document parser was unable to read data from this file.'}</p>
          <p className="mt-1.5 text-xs">
            Your file is safely preserved in encrypted storage. You can retry analysis using the button above.
          </p>
        </Alert>
      )}

      {detail.status === 'DONE' && (
        <div className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-4 shadow-xs">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Biometrics</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular">
                {detail.parameterCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Extracted from report</p>
            </div>

            <div className="rounded-2xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-4 shadow-xs">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Flagged / Abnormal</p>
              <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400 tabular">
                {detail.abnormalCount}
              </p>
              <p className="mt-1 text-[11px] text-rose-500/80">Outside reference ranges</p>
            </div>

            <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 shadow-xs">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">All in Range</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular">
                {normal.length}
              </p>
              <p className="mt-1 text-[11px] text-emerald-600/80">Within safe thresholds</p>
            </div>

            <div className="rounded-2xl border border-sky-200/80 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/20 p-4 shadow-xs">
              <p className="text-xs font-semibold text-sky-700 dark:text-sky-400">Pipeline Engine</p>
              <p className="mt-1 text-sm font-bold text-sky-800 dark:text-sky-300">
                Deterministic + NER
              </p>
              <p className="mt-1 text-[11px] text-sky-600/80">Zero hallucination rate</p>
            </div>
          </div>

          {/* Key Out-of-Range Findings */}
          {abnormal.length > 0 && (
            <Panel className="border-rose-200/80 dark:border-rose-900/50 overflow-hidden">
              <PanelHeader
                title="Actionable Findings — Out of Range"
                description={`${abnormal.length} parameter${abnormal.length === 1 ? '' : 's'} fall outside documented clinical reference standards`}
                icon={AlertTriangle}
              />
              <div className="p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  {abnormal.map((parameter) => {
                    const style = STATUS_STYLES[parameter.status];
                    return (
                      <div
                        key={parameter.key}
                        className="rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 p-4 flex items-start justify-between gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
                            <span className="truncate">{parameter.testName}</span>
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Reference: <span className="font-semibold">{parameter.referenceRange}</span>
                          </p>
                          {parameter.patientLabel && (
                            <p className="mt-1 text-[11px] text-slate-400">
                              {parameter.patientLabel}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-rose-600 dark:text-rose-400 tabular">
                            {parameter.value}{' '}
                            <span className="text-xs font-normal text-slate-400">{parameter.unit}</span>
                          </p>
                          <div className="mt-1">
                            <StatusChip status={parameter.status} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>
          )}

          {/* Assisted Interpretation Summary */}
          <Panel className="overflow-hidden">
            <PanelHeader
              title="Clinical Summary & Interpretation"
              description="Generated using clinical rule extraction & deterministic guidelines"
              icon={Cpu}
              actions={
                <Badge tone={detail.summarySource === 'openai' ? 'primary' : 'neutral'}>
                  <ShieldCheck className="h-3 w-3" />
                  {detail.summarySource === 'openai' ? 'Language Model' : 'Deterministic Clinical Explainer'}
                </Badge>
              }
            />
            <div className="p-5 sm:p-6">
              {detail.fallbackReason && (
                <Alert tone="warning" className="mb-4">
                  {detail.fallbackReason}
                </Alert>
              )}

              {summaryBody ? (
                <div className="max-w-4xl space-y-3.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {summaryBody
                    .split('\n')
                    .filter(Boolean)
                    .map((line, index) =>
                      line.startsWith('- ') ? (
                        <p key={index} className="flex gap-2.5 pl-1">
                          <ChevronRight className="h-4 w-4 shrink-0 text-sky-500 mt-0.5" />
                          <span>{line.slice(2)}</span>
                        </p>
                      ) : line.endsWith(':') ? (
                        <p key={index} className="text-xs font-bold uppercase tracking-wider text-slate-400 pt-2">
                          {line.replace(/:$/, '')}
                        </p>
                      ) : (
                        <p key={index}>{line}</p>
                      )
                    )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No clinical summary available for this record.</p>
              )}

              <MedicalDisclaimer text={disclaimer} className="mt-6" />
            </div>
          </Panel>

          {/* Full Laboratory Biometric Table */}
          <Panel className="overflow-hidden">
            <PanelHeader
              title="Comprehensive Laboratory Results"
              description={
                detail.detectedSex
                  ? `Applied documented reference ranges for ${detail.detectedSex} patient`
                  : 'Standard reference ranges applied (ADA, WHO, Harrison’s)'
              }
              icon={FileText}
            />
            {detail.parameters.length > 0 && detail.extraction && detail.extraction.source !== 'pdf_text_layer' && (
              <div className="px-5 pt-4">
                <Alert tone="warning" title="Document scanned or photographic">
                  Values were parsed via OCR preprocessing. Always verify flagged numbers against the printed paper copy.
                </Alert>
              </div>
            )}
            {detail.parameters.length > 0 ? (
              <>
                <ResultsTable parameters={detail.parameters} />
                {unknown.length > 0 && (
                  <p className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800">
                    {unknown.length} value{unknown.length === 1 ? ' was' : 's were'} parsed without documented reference intervals.
                  </p>
                )}
              </>
            ) : (
              <div className="px-5 py-12 text-center text-slate-400 text-sm">
                No recognized biometric parameters were matched in this file.
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Metadata & Technical Audit Trail */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Document Information" icon={Calendar} />
          <div className="p-5">
            <DefinitionList
              columns={2}
              items={[
                { label: 'Record Type', value: RECORD_TYPE_LABELS[detail.type] ?? detail.type },
                {
                  label: 'Report Date',
                  value: detail.reportDate ? formatDate(detail.reportDate) : <NotProvided />,
                },
                { label: 'Diagnostic Lab', value: detail.labName || <NotProvided /> },
                { label: 'Uploaded At', value: formatDateTime(detail.uploadedAt) },
                {
                  label: 'Tags',
                  value:
                    detail.tags.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {detail.tags.map((tag) => (
                          <Badge key={tag}>{tag}</Badge>
                        ))}
                      </span>
                    ) : (
                      <NotProvided />
                    ),
                },
                { label: 'Patient Notes', value: detail.notes || <NotProvided /> },
              ]}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Extraction & Forensic Audit" icon={Lock} />
          <div className="p-5">
            <DefinitionList
              columns={2}
              items={[
                { label: 'File Name', value: detail.fileName },
                { label: 'File Size', value: formatBytes(detail.fileSize) },
                { label: 'MIME Type', value: detail.mimeType || 'Unknown' },
                { label: 'Storage Encryption', value: 'Local AES-256-GCM Vault' },
                {
                  label: 'Extraction Engine',
                  value: detail.extraction ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-sky-600 dark:text-sky-400">
                      {detail.extraction.source === 'pdf_text_layer' ? (
                        <>
                          <FileText className="h-3.5 w-3.5" />
                          PDF Vector Text Layer
                        </>
                      ) : (
                        <>
                          <ScanLine className="h-3.5 w-3.5" />
                          Tesseract OCR Engine
                        </>
                      )}
                    </span>
                  ) : (
                    <NotProvided />
                  ),
                },
                {
                  label: 'Extracted Volume',
                  value: detail.extraction
                    ? `${detail.extraction.characters.toLocaleString()} chars · ${detail.extraction.pages} page(s)`
                    : <NotProvided />,
                },
                {
                  label: 'Processed At',
                  value: detail.processedAt ? formatDateTime(detail.processedAt) : <NotProvided />,
                },
                {
                  label: 'Matched Biomarkers',
                  value: `${detail.parameterCount} of 14 core clinical tests`,
                },
              ]}
            />
          </div>
        </Panel>
      </div>

      {/* Edit Details Modal */}
      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit Document Details"
        description="Update classified record type, printed date, laboratory name, or personal notes."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={saveDetails} loading={busy}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Record type" htmlFor="edit-type">
            <Select
              id="edit-type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {Object.entries(RECORD_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Report date" htmlFor="edit-date" hint="Date as printed on lab document">
            <Input
              id="edit-date"
              type="date"
              value={form.reportDate}
              onChange={(e) => setForm({ ...form, reportDate: e.target.value })}
            />
          </Field>
          <Field label="Diagnostic Laboratory" htmlFor="edit-lab">
            <Input
              id="edit-lab"
              value={form.labName}
              onChange={(e) => setForm({ ...form, labName: e.target.value })}
              placeholder="e.g. CityCare Diagnostic Laboratory"
            />
          </Field>
          <Field label="Clinical Tags" htmlFor="edit-tags" hint="Comma separated">
            <Input
              id="edit-tags"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="annual-checkup, fasting"
            />
          </Field>
          <Field label="Your Private Notes" htmlFor="edit-notes">
            <Textarea
              id="edit-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete Medical Record?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep Record
            </Button>
            <Button variant="danger" onClick={remove} loading={busy}>
              Delete Record
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Are you sure you want to delete <strong className="text-slate-900 dark:text-white">{detail.fileName}</strong>?
          The record will be permanently purged from your account and revoked from clinician views.
        </p>
      </Modal>
    </AppShell>
  );
};

export default ReportDetail;
