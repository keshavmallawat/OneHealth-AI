/** Reusable list of report rows/cards with empty and loading states. */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Upload,
  Calendar,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Tag,
} from 'lucide-react';
import type { RecordSummary } from '../services/recordsApi';
import { formatBytes, formatDate, relativeTime, RECORD_TYPE_LABELS } from '../lib/format';
import { Badge, EmptyState, FindingsBadge, RecordStatusChip, Skeleton } from './ui';

export const ReportRow: React.FC<{ record: RecordSummary; to?: string }> = ({ record, to }) => {
  const isPdf = record.mimeType?.includes('pdf');
  const Icon = isPdf ? FileText : ImageIcon;
  const processing = record.status === 'PENDING' || record.status === 'PROCESSING';

  return (
    <Link
      to={to ?? `/reports/${record.id}`}
      className="group flex items-center gap-4 px-5 py-4 transition-all duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
    >
      {/* Icon Badge */}
      <div
        className={`h-11 w-11 shrink-0 rounded-xl grid place-items-center transition-colors border ${
          isPdf
            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200/60 dark:border-rose-900/40 text-rose-600 dark:text-rose-400'
            : 'bg-sky-50 dark:bg-sky-950/30 border-sky-200/60 dark:border-sky-900/40 text-sky-600 dark:text-sky-400'
        }`}
      >
        <Icon className="h-5 w-5 transition-transform group-hover:scale-110" aria-hidden="true" />
      </div>

      {/* Main Metadata */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate max-w-full sm:max-w-[26rem] text-sm font-semibold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
            {record.fileName}
          </p>
          <RecordStatusChip status={record.status} />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {RECORD_TYPE_LABELS[record.type] ?? record.type}
          </span>
          {record.labName && (
            <span className="flex items-center gap-1 text-slate-500">
              <Building2 className="h-3 w-3 text-slate-400" />
              {record.labName}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-slate-400" />
            {record.reportDate ? formatDate(record.reportDate) : relativeTime(record.uploadedAt)}
          </span>
          <span className="tabular text-slate-400">
            {formatBytes(record.fileSize)}
          </span>
        </div>

        {record.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {record.tags.slice(0, 3).map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
            {record.tags.length > 3 && (
              <span className="text-[11px] text-slate-400 self-center">
                +{record.tags.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Findings & Biometrics Count */}
      <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0">
        {record.status === 'DONE' ? (
          <>
            <FindingsBadge abnormalCount={record.abnormalCount} />
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular font-medium">
              {record.parameterCount} biomarker{record.parameterCount === 1 ? '' : 's'} read
            </span>
          </>
        ) : processing ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-400">
            <Clock className="h-3.5 w-3.5 animate-spin" />
            <span>AI analyzing…</span>
          </div>
        ) : record.status === 'FAILED' ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Needs retry
          </span>
        ) : null}
      </div>

      <ChevronRight
        className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-all group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
};

export const ReportCard: React.FC<{ record: RecordSummary; to?: string }> = ({ record, to }) => {
  const isPdf = record.mimeType?.includes('pdf');
  const Icon = isPdf ? FileText : ImageIcon;
  const processing = record.status === 'PENDING' || record.status === 'PROCESSING';

  return (
    <Link
      to={to ?? `/reports/${record.id}`}
      className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md hover:border-sky-300 dark:hover:border-sky-800 transition-all duration-200"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div
            className={`h-10 w-10 shrink-0 rounded-xl grid place-items-center border ${
              isPdf
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200/60 dark:border-rose-900/40 text-rose-600 dark:text-rose-400'
                : 'bg-sky-50 dark:bg-sky-950/30 border-sky-200/60 dark:border-sky-900/40 text-sky-600 dark:text-sky-400'
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <RecordStatusChip status={record.status} />
        </div>

        <h3 className="mt-4 font-semibold text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
          {record.fileName}
        </h3>

        <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
          <p className="font-medium text-slate-700 dark:text-slate-300">
            {RECORD_TYPE_LABELS[record.type] ?? record.type}
          </p>
          {record.labName && (
            <p className="flex items-center gap-1 truncate">
              <Building2 className="h-3 w-3 shrink-0 text-slate-400" />
              {record.labName}
            </p>
          )}
          <p className="flex items-center gap-1">
            <Calendar className="h-3 w-3 shrink-0 text-slate-400" />
            {record.reportDate ? formatDate(record.reportDate) : relativeTime(record.uploadedAt)}
          </p>
        </div>

        {record.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {record.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-400"
              >
                <Tag className="h-2.5 w-2.5" />
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-slate-100 dark:border-slate-800/80 pt-3 flex items-center justify-between">
        {record.status === 'DONE' ? (
          <>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {record.parameterCount} values
            </span>
            {record.abnormalCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
                <AlertTriangle className="h-3 w-3" />
                {record.abnormalCount} flagged
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                All in range
              </span>
            )}
          </>
        ) : processing ? (
          <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">Processing…</span>
        ) : (
          <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">Needs retry</span>
        )}
      </div>
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
  viewMode?: 'list' | 'grid';
}> = ({
  records,
  loading,
  emptyTitle,
  emptyDescription,
  emptyAction,
  linkPrefix,
  viewMode = 'list',
}) => {
  if (loading) {
    if (viewMode === 'grid') {
      return (
        <div className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-6 w-full rounded-md mt-4" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full hidden sm:block" />
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

  if (viewMode === 'grid') {
    return (
      <div className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {records.map((record) => (
          <ReportCard
            key={record.id}
            record={record}
            to={linkPrefix ? `${linkPrefix}/${record.id}` : undefined}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
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
