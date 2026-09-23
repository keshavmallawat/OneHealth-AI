/** Small presentation helpers shared across pages. */

export type ParameterStatus = 'NORMAL' | 'LOW' | 'HIGH' | 'UNKNOWN';
export type RecordStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED' | 'DELETED';

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDate(date)}, ${date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} d ago`;
  return formatDate(date);
}

export const RECORD_TYPE_LABELS: Record<string, string> = {
  BLOOD_TEST: 'Blood test',
  IMAGING: 'Imaging',
  PRESCRIPTION: 'Prescription',
  DISCHARGE: 'Discharge summary',
  OTHER: 'Other',
};

/**
 * Status dot colour and short label, for the compact places that show a status
 * without the full `StatusChip`. The background/border chip styling lives in the
 * `StatusChip` component; colour is never the only signal here either — every
 * caller pairs the dot with the test name or the `label`.
 */
export const STATUS_STYLES: Record<ParameterStatus, { dot: string; label: string }> = {
  NORMAL:  { dot: 'bg-normal',  label: 'Normal' },
  LOW:     { dot: 'bg-low',     label: 'Low' },
  HIGH:    { dot: 'bg-high',    label: 'High' },
  UNKNOWN: { dot: 'bg-unknown', label: 'Not checked' },
};

/**
 * Position of a value inside its reference range, as a 0-1 fraction, for the
 * inline range bar. Open-ended ranges get a sensible synthetic span so the
 * marker still communicates "below" / "above".
 */
export function rangePosition(
  value: number,
  low: number | null,
  high: number | null
): number | null {
  if (low === null && high === null) return null;
  const lo = low ?? (high !== null ? high * 0.4 : 0);
  const hi = high ?? (low !== null ? low * 2.2 : 1);
  if (hi <= lo) return null;
  const span = hi - lo;
  const padded = (value - (lo - span * 0.35)) / (span * 1.7);
  return Math.max(0, Math.min(1, padded));
}
