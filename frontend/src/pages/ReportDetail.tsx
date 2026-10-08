import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Cpu, ExternalLink, Eye, FileText, Info, Loader2, Pencil,
  RefreshCw, ScanLine, Trash2,
} from 'lucide-react';
import { recordsApi } from '../services/recordsApi';
import type { ExtractedParameter, RecordDetail as Detail } from '../services/recordsApi';
import { apiErrorMessage } from '../services/apiClient';
import {
  formatBytes, formatDate, formatDateTime, RECORD_TYPE_LABELS, rangePosition, STATUS_STYLES,
} from '../lib/format';
import AppShell from '../components/AppShell';
import {
  Alert, Badge, Breadcrumb, Button, DefinitionList, Field, Input, MedicalDisclaimer, Modal,
  NotProvided, Panel, PanelHeader, PageHeader, PageLoader, RangeMeter, RecordStatusChip, Select,
  StatusChip, Textarea,
} from '../components/ui';

/**
 * Results table.
 *
 * Grouped by clinical panel and, within each panel, out-of-range values first —
 * a clinician reading this wants the exceptions, not alphabetical order.
 */
const ResultsTable: React.FC<{ parameters: ExtractedParameter[] }> = ({ parameters }) => {
  const panels = parameters.reduce<Record<string, ExtractedParameter[]>>((acc, parameter) => {
    (acc[parameter.panel] ||= []).push(parameter);
    return acc;
  }, {});

  const weight = (p: ExtractedParameter) =>
    p.status === 'HIGH' || p.status === 'LOW' ? 0 : p.status === 'UNKNOWN' ? 2 : 1;

  return (
    <div className="scroll-x">
      <table className="w-full min-w-[52rem] text-sm border-collapse">
        <caption className="sr-only">
          Laboratory values extracted from this report, with reference ranges and status
        </caption>
        <thead>
          <tr className="border-b border-line bg-sunken text-left font-clinical">
            <th scope="col" className="eyebrow px-5 py-2.5 font-semibold">Test</th>
            <th scope="col" className="eyebrow px-3 py-2.5 font-semibold text-right">Result</th>
            <th scope="col" className="eyebrow px-3 py-2.5 font-semibold">Unit</th>
            <th scope="col" className="eyebrow px-3 py-2.5 font-semibold">Reference range</th>
            <th scope="col" className="eyebrow px-3 py-2.5 font-semibold w-36">Position</th>
            <th scope="col" className="eyebrow px-3 py-2.5 font-semibold">Status</th>
            <th scope="col" className="eyebrow px-5 py-2.5 font-semibold text-right">Confidence</th>
          </tr>
        </thead>
        {Object.entries(panels).map(([panel, rows]) => (
          <tbody key={panel}>
            <tr>
              <th
                scope="colgroup"
                colSpan={7}
                className="border-b border-line bg-sunken/60 px-5 py-2 text-left text-xs font-semibold text-ink-soft"
              >
                {panel}
              </th>
            </tr>
            {[...rows].sort((a, b) => weight(a) - weight(b)).map((parameter) => {
              const abnormal = parameter.status === 'HIGH' || parameter.status === 'LOW';
              return (
                <tr
                  key={parameter.key}
                  className={`border-b border-line-soft last:border-0 ${abnormal ? 'bg-high-soft/25' : ''}`}
                >
                  <th scope="row" className="px-5 py-3 text-left align-top font-medium text-ink font-clinical">
                    {parameter.testName}
                    {parameter.ocrUncertain && (
                      <span className="mt-0.5 block text-[13px] font-normal text-low font-sans">
                        This number may have been misread from the scan. Please check it against your original report.
                      </span>
                    )}
                    {parameter.patientLabel && (
                      <span className="mt-0.5 block text-[13px] font-normal text-muted font-sans">
                        {parameter.patientLabel}
                      </span>
                    )}
                  </th>
                  <td className="px-3 py-3 text-right align-top">
                    <span
                      className={`tabular text-[15px] font-semibold ${abnormal ? 'text-high' : 'text-ink'}`}
                    >
                      {parameter.value}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 align-top font-clinical text-muted">
                    {parameter.unit || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 align-top font-clinical">
                    <span className="tabular text-ink-soft">{parameter.referenceRange}</span>
                    {parameter.referenceBasis && (
                      <span className="mt-0.5 block text-[13px] text-muted font-sans">{parameter.referenceBasis}</span>
                    )}
                    {parameter.reportedRange && parameter.reportedRange !== parameter.referenceRange && (
                      <span className="mt-0.5 block text-xs text-muted">
                        Lab printed: {parameter.reportedRange}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <RangeMeter
                      position={rangePosition(
                        parameter.value,
                        parameter.referenceLow,
                        parameter.referenceHigh
                      )}
                      status={parameter.status}
                    />
                  </td>
                  <td className="px-3 py-3 align-top">
                    <StatusChip status={parameter.status} />
                  </td>
                  <td className="px-5 py-3 text-right align-top tabular text-xs text-muted">
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

  // Edit form state
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

  // Poll while the pipeline is still working on this record.
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

  // Release the object URL on unmount so the blob is not retained.
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
        <PageLoader label="Loading report" />
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
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
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
  const unknown = detail.parameters.filter((p) => p.status === 'UNKNOWN');

  return (
    <AppShell>
      <PageHeader
        breadcrumb={<Breadcrumb to="/reports">Medical records</Breadcrumb>}
        title={detail.fileName}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <RecordStatusChip status={detail.status} />
            <span>
              {RECORD_TYPE_LABELS[detail.type] ?? detail.type} ·{' '}
              {detail.reportDate
                ? `Report dated ${formatDate(detail.reportDate)}`
                : `Uploaded ${formatDate(detail.uploadedAt)}`}
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={openOriginal}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Original document
            </Button>
            {!readOnly && (
              <>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit details
                </Button>
                {(detail.status === 'FAILED' || detail.status === 'DONE') && (
                  <Button variant="secondary" onClick={retry} loading={busy}>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Re-analyse
                  </Button>
                )}
                <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete
                </Button>
              </>
            )}
          </>
        }
      />

      {readOnly && (
        <Alert tone="info" className="mb-5">
          <span className="inline-flex items-center gap-2">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            You are viewing this record under a consent granted by the patient. It is read-only, and
            your access is recorded in the patient’s access history.
          </span>
        </Alert>
      )}

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      {processing && (
        <Panel className="mb-5">
          <div className="px-5 py-10 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" aria-hidden="true" />
            <h2 className="mt-3.5 text-sm font-semibold text-ink">Analysing this report</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
              Reading the document, extracting laboratory values and comparing them against
              reference ranges. This page updates itself.
            </p>
          </div>
        </Panel>
      )}

      {detail.status === 'FAILED' && (
        <Alert tone="error" title="This report could not be analysed" className="mb-5">
          <p>{detail.processingError || 'The analysis did not complete.'}</p>
          <p className="mt-1.5">
            Your uploaded document is safe and can still be opened. You can retry the analysis above.
          </p>
        </Alert>
      )}

      {detail.status === 'DONE' && (
        <div className="space-y-5">
          {/* Key findings — the exceptions, before the full table. */}
          <Panel>
            <PanelHeader
              title="Key findings"
              description={`${detail.parameterCount} values extracted · ${detail.abnormalCount} outside reference range`}
              icon={AlertTriangle}
            />
            <div className="p-5">
              {abnormal.length === 0 ? (
                <p className="text-sm text-ink-soft">
                  Every value extracted from this report falls inside its clinical reference range.
                </p>
              ) : (
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {abnormal.map((parameter) => {
                    const style = STATUS_STYLES[parameter.status];
                    return (
                      <li
                        key={parameter.key}
                        className="rounded-md border border-line bg-sunken px-3.5 py-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2.5 text-sm font-medium text-ink">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                                aria-hidden="true"
                              />
                              <span className="truncate">{parameter.testName}</span>
                            </p>
                            <p className="mt-1 text-xs text-muted ml-4">
                              Reference {parameter.referenceRange}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="tabular text-[17px] font-semibold text-ink">
                              {parameter.value}
                              <span className="ml-1 text-xs font-normal text-muted">
                                {parameter.unit}
                              </span>
                            </p>
                            <StatusChip status={parameter.status} className="mt-1" />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {unknown.length > 0 && (
                <p className="mt-4 text-xs text-muted">
                  {unknown.length} value{unknown.length === 1 ? ' was' : 's were'} read but could not
                  be compared against a reference range, so {unknown.length === 1 ? 'it is' : 'they are'}{' '}
                  reported without a status rather than guessed.
                </p>
              )}
            </div>
          </Panel>

          {/* Assisted interpretation */}
          <Panel>
            <PanelHeader
              title="Assisted interpretation"
              icon={Info}
              actions={
                <Badge tone={detail.summarySource === 'openai' ? 'primary' : 'neutral'}>
                  <Cpu className="h-3 w-3" aria-hidden="true" />
                  {detail.summarySource === 'openai'
                    ? 'Language model'
                    : 'Deterministic explainer'}
                </Badge>
              }
            />
            <div className="p-5">
              {detail.fallbackReason && (
                <Alert tone="warning" className="mb-4">
                  {detail.fallbackReason}
                </Alert>
              )}

              {summaryBody ? (
                <div className="max-w-3xl space-y-4 text-[15px] leading-relaxed text-ink-soft font-clinical">
                  {summaryBody
                    .split('\n')
                    .filter(Boolean)
                    .map((line, index) =>
                      line.startsWith('- ') ? (
                        <p key={index} className="flex gap-2.5 pl-1">
                          <span
                            className="mt-2 h-1 w-1 shrink-0 rounded-full bg-faint"
                            aria-hidden="true"
                          />
                          <span>{line.slice(2)}</span>
                        </p>
                      ) : line.endsWith(':') ? (
                        <p key={index} className="eyebrow pt-2">
                          {line.replace(/:$/, '')}
                        </p>
                      ) : (
                        <p key={index}>{line}</p>
                      )
                    )}
                </div>
              ) : (
                <p className="text-sm text-muted">No interpretation was generated for this record.</p>
              )}

              <MedicalDisclaimer text={disclaimer} className="mt-5" />
            </div>
          </Panel>

          {/* Full results */}
          <Panel>
            <PanelHeader
              title="Laboratory results"
              description={
                detail.detectedSex
                  ? `Reference ranges applied for a ${detail.detectedSex} patient, as printed on the report`
                  : 'Standard adult reference ranges applied'
              }
              icon={FileText}
            />
            {detail.parameters.length > 0 && detail.extraction && detail.extraction.source !== 'pdf_text_layer' && (
              <div className="px-5 pt-4">
                <Alert tone="warning" title="Read from a scanned image">
                  Text recognition can misread digits, especially in photos. Please compare each value with
                  your original report before relying on it. Values the system is unsure about are marked
                  &ldquo;not compared&rdquo; rather than guessed.
                </Alert>
              </div>
            )}
            {detail.parameters.length > 0 ? (
              <ResultsTable parameters={detail.parameters} />
            ) : (
              <div className="px-5 py-10 text-center">
                <p className="mx-auto max-w-lg text-sm text-muted">
                  The document was read, but none of the laboratory parameters this platform
                  recognises were found in it. The original document can still be opened above.
                </p>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Metadata — always shown, whatever the processing state. */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Record details" />
          <div className="p-5">
            <DefinitionList
              columns={2}
              items={[
                { label: 'Record type', value: RECORD_TYPE_LABELS[detail.type] ?? detail.type },
                {
                  label: 'Report date',
                  value: detail.reportDate ? formatDate(detail.reportDate) : <NotProvided />,
                },
                { label: 'Laboratory', value: detail.labName || <NotProvided /> },
                { label: 'Uploaded', value: formatDateTime(detail.uploadedAt) },
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
                { label: 'Your notes', value: detail.notes || <NotProvided /> },
              ]}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Source document and processing" />
          <div className="p-5">
            <DefinitionList
              columns={2}
              items={[
                { label: 'File name', value: detail.fileName },
                { label: 'File size', value: formatBytes(detail.fileSize) },
                { label: 'File type', value: detail.mimeType || 'Unknown' },
                { label: 'Storage', value: detail.storageDriver === 's3' ? 'Object storage (S3)' : 'Local encrypted storage' },
                {
                  label: 'Text source',
                  value: detail.extraction ? (
                    <span className="inline-flex items-center gap-1.5">
                      {detail.extraction.source === 'pdf_text_layer' ? (
                        <>
                          <FileText className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                          PDF text layer
                        </>
                      ) : (
                        <>
                          <ScanLine className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                          Optical character recognition
                        </>
                      )}
                    </span>
                  ) : (
                    <NotProvided />
                  ),
                },
                {
                  label: 'Text extracted',
                  value: detail.extraction
                    ? `${detail.extraction.characters.toLocaleString()} characters · ${detail.extraction.pages} page(s)`
                    : <NotProvided />,
                },
                {
                  label: 'Analysed at',
                  value: detail.processedAt ? formatDateTime(detail.processedAt) : <NotProvided />,
                },
                {
                  label: 'Values recognised',
                  value: `${detail.parameterCount} of the platform’s supported parameters`,
                },
              ]}
            />
            {detail.extraction?.warnings?.length ? (
              <Alert tone="warning" className="mt-4" title="Extraction warnings">
                <ul className="list-disc pl-4 space-y-0.5">
                  {detail.extraction.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}
          </div>
        </Panel>
      </div>

      {/* Edit details */}
      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit record details"
        description="The extractor makes a best guess; these fields are yours to correct."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={saveDetails} loading={busy}>
              Save changes
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
          <Field label="Report date" htmlFor="edit-date" hint="The date printed on the report">
            <Input
              id="edit-date"
              type="date"
              value={form.reportDate}
              onChange={(e) => setForm({ ...form, reportDate: e.target.value })}
            />
          </Field>
          <Field label="Laboratory" htmlFor="edit-lab">
            <Input
              id="edit-lab"
              value={form.labName}
              onChange={(e) => setForm({ ...form, labName: e.target.value })}
              placeholder="e.g. CityCare Diagnostics"
            />
          </Field>
          <Field label="Tags" htmlFor="edit-tags" hint="Comma separated">
            <Input
              id="edit-tags"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="annual-checkup, fasting"
            />
          </Field>
          <Field label="Your notes" htmlFor="edit-notes" hint="Only you and clinicians you authorise can see these">
            <Textarea
              id="edit-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this record?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={remove} loading={busy}>
              Delete record
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          <span className="font-medium text-ink">{detail.fileName}</span> will be removed from your
          record list and will no longer be visible to any clinician you have shared with. The audit
          trail of who accessed it is retained.
        </p>
      </Modal>
    </AppShell>
  );
};

export default ReportDetail;
