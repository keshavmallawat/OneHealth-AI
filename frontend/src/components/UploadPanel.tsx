/** Drag-and-drop upload (one or several files) with client-side validation and progress. */
import React, { useCallback, useRef, useState } from 'react';
import { AlertCircle, Check, FileText, Image as ImageIcon, Upload, X } from 'lucide-react';
import { recordsApi } from '../services/recordsApi';
import { apiErrorMessage } from '../services/apiClient';
import { formatBytes, RECORD_TYPE_LABELS } from '../lib/format';
import { Alert, Button, Field, Input, Select } from './ui';

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/tiff'];
const MAX_MB = 25;
const MAX_FILES = 10;

type QueueItem = { id: number; file: File; state: 'ready' | 'uploading' | 'done' | 'failed'; message?: string };
let nextQueueId = 1;

const UploadPanel: React.FC<{ onUploaded: () => void; compact?: boolean }> = ({
  onUploaded,
  compact,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [type, setType] = useState('BLOOD_TEST');
  const [tags, setTags] = useState('');
  const [labName, setLabName] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const validate = (candidate: File): string => {
    if (!ACCEPTED.includes(candidate.type)) {
      return 'That file type is not supported. Upload a PDF, JPEG, PNG, WebP or TIFF.';
    }
    if (candidate.size > MAX_MB * 1024 * 1024) {
      return `That file is ${formatBytes(candidate.size)}. The maximum is ${MAX_MB} MB.`;
    }
    if (candidate.size === 0) return 'That file appears to be empty.';
    return '';
  };

  const choose = useCallback((candidates: FileList | File[] | null | undefined) => {
    const incoming = Array.from(candidates ?? []);
    if (incoming.length === 0) return;
    const problems: string[] = [];
    setQueue((current) => {
      const room = MAX_FILES - current.length;
      const accepted: QueueItem[] = [];
      for (const candidate of incoming) {
        const problem = validate(candidate);
        if (problem) {
          problems.push(`${candidate.name}: ${problem}`);
        } else if (accepted.length >= room) {
          problems.push(`${candidate.name}: at most ${MAX_FILES} files can be queued at once.`);
        } else {
          accepted.push({ id: nextQueueId++, file: candidate, state: 'ready' });
        }
      }
      return [...current, ...accepted];
    });
    // The state updater above runs synchronously enough for `problems` to be filled
    // before the next render; show them together.
    setError(problems.join(' '));
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const pending = queue.filter((item) => item.state === 'ready' || item.state === 'failed');
    if (pending.length === 0) return;
    setBusy(true);
    setError('');
    let anyUploaded = false;
    // One at a time: the API analyses each report as it arrives, and sequential
    // uploads keep the progress bar meaningful and the server load predictable.
    for (const item of pending) {
      setProgress(0);
      setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, state: 'uploading', message: undefined } : x)));
      try {
        await recordsApi.upload(item.file, type, tags, setProgress, {
          labName: labName.trim() || undefined,
          reportDate: reportDate || undefined,
        });
        anyUploaded = true;
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, state: 'done' } : x)));
      } catch (err) {
        const message = apiErrorMessage(err, 'The upload failed. Please try again.');
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, state: 'failed', message } : x)));
      }
    }
    setProgress(0);
    setBusy(false);
    if (anyUploaded) {
      // Finished files leave the queue; failed ones stay so they can be retried.
      setQueue((q) => q.filter((x) => x.state !== 'done'));
      onUploaded();
    }
  };

  const remove = (id: number) => setQueue((q) => q.filter((x) => x.id !== id));
  const waiting = queue.filter((item) => item.state === 'ready' || item.state === 'failed').length;

  return (
    <form onSubmit={submit} className="p-5 space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          choose(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Choose reports to upload"
        className={`rounded-md border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragging ? 'border-primary bg-primary-soft' : 'border-line hover:border-line-strong hover:bg-canvas'
        }`}
      >
        <input
          id="record-upload-input"
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPTED.join(',')}
          multiple
          onChange={(e) => choose(e.target.files)}
        />
        <div className="flex flex-col items-center">
          <span className="h-9 w-9 rounded-md border border-line bg-surface grid place-items-center mb-2.5">
            <Upload className="h-4 w-4 text-muted" aria-hidden="true" />
          </span>
          <p className="text-sm text-ink">
            Drop reports here, or <span className="text-primary font-medium">browse</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            PDF, JPEG, PNG or TIFF · up to {MAX_MB} MB each · up to {MAX_FILES} files
          </p>
        </div>
      </div>

      {queue.length > 0 && (
        <ul className="space-y-1.5" aria-label="Files waiting to upload">
          {queue.map((item) => {
            const Icon = item.file.type === 'application/pdf' ? FileText : ImageIcon;
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2"
              >
                <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink truncate">{item.file.name}</p>
                  <p className={`text-xs ${item.state === 'failed' ? 'text-high' : 'text-muted'}`}>
                    {item.state === 'uploading'
                      ? 'Uploading…'
                      : item.state === 'failed'
                        ? item.message ?? 'Upload failed'
                        : formatBytes(item.file.size)}
                  </p>
                </div>
                {item.state === 'failed' && <AlertCircle className="h-4 w-4 text-high" aria-hidden="true" />}
                {item.state === 'done' && <Check className="h-4 w-4 text-normal" aria-hidden="true" />}
                {item.state !== 'uploading' && item.state !== 'done' && (
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="rounded p-1 text-muted hover:bg-line-soft hover:text-ink transition-colors"
                    aria-label={`Remove ${item.file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className={`grid gap-4 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2'}`}>
        <Field label="Record type" htmlFor="record-type">
          <Select id="record-type" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(RECORD_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Report date" htmlFor="record-date" hint="Optional">
          <Input
            id="record-date"
            type="date"
            value={reportDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setReportDate(e.target.value)}
          />
        </Field>
        {!compact && (
          <Field label="Laboratory" htmlFor="record-lab" hint="Optional">
            <Input
              id="record-lab"
              value={labName}
              onChange={(e) => setLabName(e.target.value)}
              placeholder="e.g. CityCare Diagnostics"
            />
          </Field>
        )}
        <Field label="Tags" htmlFor="record-tags" hint="Comma separated, optional">
          <Input
            id="record-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="annual-checkup, fasting"
          />
        </Field>
      </div>

      {busy && progress > 0 && (
        <div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {progress < 100 ? `Uploading… ${progress}%` : 'Starting analysis…'}
          </p>
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      <Button type="submit" disabled={waiting === 0} loading={busy} className="w-full">
        <Upload className="h-4 w-4" aria-hidden="true" />
        {busy ? 'Uploading…' : waiting > 1 ? `Upload and analyse ${waiting} reports` : 'Upload and analyse'}
      </Button>
    </form>
  );
};

export default UploadPanel;
