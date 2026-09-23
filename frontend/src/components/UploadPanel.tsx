/** Drag-and-drop upload with client-side validation and progress. */
import React, { useCallback, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Upload, X } from 'lucide-react';
import { recordsApi } from '../services/recordsApi';
import { apiErrorMessage } from '../services/apiClient';
import { formatBytes, RECORD_TYPE_LABELS } from '../lib/format';
import { Alert, Button, Field, Input, Select } from './ui';

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/tiff'];
const MAX_MB = 25;

const UploadPanel: React.FC<{ onUploaded: () => void; compact?: boolean }> = ({
  onUploaded,
  compact,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
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

  const choose = useCallback((candidate: File | undefined) => {
    if (!candidate) return;
    const problem = validate(candidate);
    setError(problem);
    setFile(problem ? null : candidate);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    setProgress(0);
    try {
      await recordsApi.upload(file, type, tags, setProgress, {
        labName: labName.trim() || undefined,
        reportDate: reportDate || undefined,
      });
      setFile(null);
      setTags('');
      setLabName('');
      setReportDate('');
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
      onUploaded();
    } catch (err) {
      setError(apiErrorMessage(err, 'The upload failed. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const FileIcon = file?.type === 'application/pdf' ? FileText : ImageIcon;

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
          choose(e.dataTransfer.files?.[0]);
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
        aria-label="Choose a report to upload"
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
          onChange={(e) => choose(e.target.files?.[0])}
        />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <span className="h-9 w-9 shrink-0 rounded-md border border-line bg-surface grid place-items-center">
              <FileIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            </span>
            <div className="text-left min-w-0">
              <p className="text-sm font-medium text-ink truncate max-w-[13rem]">{file.name}</p>
              <p className="text-xs text-muted">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="ml-1 rounded p-1 text-muted hover:bg-line-soft hover:text-ink transition-colors"
              aria-label="Remove selected file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <span className="h-9 w-9 rounded-md border border-line bg-surface grid place-items-center mb-2.5">
              <Upload className="h-4 w-4 text-muted" aria-hidden="true" />
            </span>
            <p className="text-sm text-ink">
              Drop a report here, or <span className="text-primary font-medium">browse</span>
            </p>
            <p className="mt-1 text-xs text-muted">PDF, JPEG, PNG or TIFF · up to {MAX_MB} MB</p>
          </div>
        )}
      </div>
      
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

      <Button type="submit" disabled={!file} loading={busy} className="w-full">
        <Upload className="h-4 w-4" aria-hidden="true" />
        {busy ? 'Uploading…' : 'Upload and analyse'}
      </Button>
    </form>
  );
};

export default UploadPanel;
