/** Reusable list of report rows with empty and loading states. */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FileText, Image as ImageIcon, Upload } from 'lucide-react';
import type { RecordSummary } from '../services/recordsApi';
import { formatBytes, formatDate, relativeTime, RECORD_TYPE_LABELS } from '../lib/format';
import { Badge, EmptyState, FindingsBadge, RecordStatusChip, Skeleton } from './ui';

export const ReportRow: React.FC<{ record: RecordSummary; to?: string }> = ({ record, to }) => {
  const Icon = record.mimeType?.includes('pdf') ? FileText : ImageIcon;
  const processing = record.status === 'PENDING' || record.status === 'PROCESSING';

  return (
    <Link
      to={to ?? `/reports/${record.id}`}
      className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-sunken"
    >
      <span className="h-9 w-9 shrink-0 rounded-md border border-line bg-surface grid place-items-center">
        <Icon className="h-4 w-4 text-muted group-hover:text-primary transition-colors" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate max-w-full sm:max-w-[24rem] text-sm font-medium text-ink group-hover:text-primary transition-colors">
            {record.fileName}
          </p>
          <RecordStatusChip status={record.status} />
        </div>
        <p className="mt-1 text-xs text-muted">
          {RECORD_TYPE_LABELS[record.type] ?? record.type}
          {record.labName ? ` · ${record.labName}` : ''}
          {' · '}
          {record.reportDate ? formatDate(record.reportDate) : relativeTime(record.uploadedAt)}
          {' · '}
          {formatBytes(record.fileSize)}
        </p>
        {record.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {record.tags.slice(0, 3).map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        )}
      </div>

      <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
        {record.status === 'DONE' ? (
          <FindingsBadge abnormalCount={record.abnormalCount} />
        ) : processing ? (
          <span className="text-xs text-muted">Processing…</span>
        ) : record.status === 'FAILED' ? (
          <span className="text-xs font-medium text-high">Needs retry</span>
        ) : null}
        {record.status === 'DONE' && (
          <span className="text-xs text-muted tabular">{record.parameterCount} values</span>
        )}
      </div>

      <ChevronRight
        className="h-4 w-4 shrink-0 text-faint group-hover:text-primary transition-colors"
        aria-hidden="true"
      />
    </Link>
  );
};

const ReportList: React.FC<{
  records: RecordSummary[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  linkPrefix?: string;
}> = ({ records, loading, emptyTitle, emptyDescription, emptyAction, linkPrefix }) => {
  if (loading) {
    return (
      <div className="divide-y divide-line">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3.5 px-5 py-3.5">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-52" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <EmptyState
        icon={Upload}
        title={emptyTitle ?? 'No medical records yet'}
        description={
          emptyDescription ??
          'Upload a laboratory report or medical document. The platform extracts the values and flags anything outside its reference range.'
        }
        action={emptyAction}
      />
    );
  }

  return (
    <div className="divide-y divide-line">
      {records.map((record) => (
        <ReportRow
          key={record.id}
          record={record}
          to={linkPrefix ? `${linkPrefix}/${record.id}` : undefined}
        />
      ))}
    </div>
  );
};

export default ReportList;
