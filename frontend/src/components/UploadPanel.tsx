/** Drag-and-drop upload (one or several files) with client-side validation and progress. */
import React, { useCallback, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  FileText,
  Image as ImageIcon,
  Upload,
  X,
  Sparkles,
  CloudUpload,
  ArrowRight,
} from 'lucide-react';
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
      setQueue((q) => q.filter((x) => x.state !== 'done'));
      onUploaded();
    }
  };

  const remove = (id: number) => setQueue((q) => q.filter((x) => x.id !== id));
  const waiting = queue.filter((item) => item.state === 'ready' || item.state === 'failed').length;

  return (
    <form onSubmit={submit} className="p-5 sm:p-6 space-y-5">
      {/* Elevated Drop Zone */}
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
        className={`group relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 overflow-hidden ${
          dragging
            ? 'border-sky-500 bg-sky-500/10 scale-[1.01] shadow-lg shadow-sky-500/10'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 hover:border-sky-400 dark:hover:border-sky-600 hover:bg-sky-50/30 dark:hover:bg-sky-950/20'
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
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-400/30 grid place-items-center mb-3 group-hover:scale-105 transition-transform">
            <CloudUpload className="h-7 w-7 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          </div>
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            Drag and drop medical documents, or{' '}
            <span className="text-sky-600 dark:text-sky-400 underline underline-offset-2">browse files</span>
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            Supports digital PDF reports, photos, and scanned blood panels.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            <span className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-2 py-0.5">PDF</span>
            <span className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-2 py-0.5">JPEG / PNG</span>
            <span className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-2 py-0.5">TIFF / WebP</span>
            <span>•</span>
            <span>Max {MAX_MB} MB</span>
            <span>•</span>
            <span>Up to {MAX_FILES} files</span>
          </div>
        </div>
      </div>

      {/* Queued Files List */}
      {queue.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Files in Queue ({queue.length})
          </p>
          <ul className="space-y-2" aria-label="Files waiting to upload">
            {queue.map((item) => {
              const isPdf = item.file.type === 'application/pdf';
              const Icon = isPdf ? FileText : ImageIcon;
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-xs"
                >
                  <div
                    className={`h-9 w-9 shrink-0 rounded-lg grid place-items-center ${
                      isPdf ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' : 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400'
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {item.file.name}
                    </p>
                    <p
                      className={`text-xs ${
                        item.state === 'failed'
                          ? 'text-rose-600 dark:text-rose-400 font-medium'
                          : 'text-slate-400'
                      }`}
                    >
                      {item.state === 'uploading'
                        ? 'Uploading & extracting biometrics…'
                        : item.state === 'failed'
                          ? item.message ?? 'Upload failed'
                          : formatBytes(item.file.size)}
                    </p>
                  </div>

                  {item.state === 'failed' && (
                    <span className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-semibold">
                      <AlertCircle className="h-4 w-4" aria-hidden="true" />
                      Failed
                    </span>
                  )}
                  {item.state === 'done' && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Ready
                    </span>
                  )}
                  {item.state !== 'uploading' && item.state !== 'done' && (
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      aria-label={`Remove ${item.file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Metadata Fields */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 p-4 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3.5">
          Document Details & Classification
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Record type" htmlFor="record-type">
            <Select id="record-type" value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(RECORD_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Collection / Report Date" htmlFor="record-date" hint="As shown on printed report">
            <Input
              id="record-date"
              type="date"
              value={reportDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setReportDate(e.target.value)}
            />
          </Field>

          {!compact && (
            <Field label="Diagnostic Laboratory / Hospital" htmlFor="record-lab" hint="Optional">
              <Input
                id="record-lab"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                placeholder="e.g. CityCare Diagnostic Labs"
              />
            </Field>
          )}

          <Field label="Clinical Tags" htmlFor="record-tags" hint="Comma-separated">
            <Input
              id="record-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. lipid-panel, annual-checkup, fasting"
            />
          </Field>
        </div>
      </div>

      {/* Progress Bar when uploading */}
      {busy && progress > 0 && (
        <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/30 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-900 dark:text-sky-300">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-sky-500 animate-pulse" />
              <span>{progress < 100 ? 'Uploading to encrypted storage…' : 'Parsing clinical biometrics…'}</span>
            </span>
            <span>{progress}%</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-sky-200 dark:bg-sky-900"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={waiting === 0}
        loading={busy}
        className="w-full py-3"
      >
        <Upload className="h-4 w-4" aria-hidden="true" />
        {busy ? (
          'Analyzing and extracting values…'
        ) : waiting > 1 ? (
          `Upload and process ${waiting} reports`
        ) : (
          <>
            <span>Upload and analyze report</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
};

export default UploadPanel;
