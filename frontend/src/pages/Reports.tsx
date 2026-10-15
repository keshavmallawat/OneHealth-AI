import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Filter,
  Search,
  SlidersHorizontal,
  Upload,
  X,
  LayoutGrid,
  LayoutList,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';
import { recordsApi } from '../services/recordsApi';
import type { RecordSummary } from '../services/recordsApi';
import { apiErrorMessage } from '../services/apiClient';
import { RECORD_TYPE_LABELS } from '../lib/format';
import AppShell from '../components/AppShell';
import ReportList from '../components/ReportList';
import {
  Alert, Badge, Button, Field, Input, Panel, PageHeader, Select,
} from '../components/ui';

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'FLAGGED', label: 'Has flagged values' },
  { value: 'NORMAL', label: 'All values in range' },
  { value: 'PROCESSING', label: 'Still processing' },
  { value: 'FAILED', label: 'Failed to analyse' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'File name (A–Z)' },
  { value: 'flagged', label: 'Most flagged first' },
];

const Reports: React.FC = () => {
  const [params, setParams] = useSearchParams();

  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const pollRef = useRef<number | null>(null);

  // URL state persistence
  const search = params.get('search') ?? '';
  const type = params.get('type') ?? '';
  const status = params.get('status') ?? '';
  const tag = params.get('tag') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const sort = (params.get('sort') ?? 'newest') as 'newest' | 'oldest' | 'name' | 'flagged';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setPage(1);
  };

  const activeFilters = [type, status, tag, from, to].filter(Boolean).length;

  const clearFilters = () => {
    const next = new URLSearchParams();
    if (search) next.set('search', search);
    setParams(next, { replace: true });
    setPage(1);
  };

  const load = useCallback(async () => {
    try {
      const data = await recordsApi.list({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        type: type || undefined,
        status: status || undefined,
        tag: tag || undefined,
        from: from || undefined,
        to: to || undefined,
        sort,
      });
      setRecords(data.records);
      setTotalPages(data.totalPages);
      setTotal(data.total);
      setAvailableTags(data.availableTags ?? []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'We could not load your records.'));
    } finally {
      setLoading(false);
    }
  }, [page, search, type, status, tag, from, to, sort]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    const busy = records.some((r) => r.status === 'PENDING' || r.status === 'PROCESSING');
    if (!busy) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = window.setInterval(load, 2500);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [records, load]);

  // Quick filter presets
  const isStatusActive = (s: string) => status === s;

  return (
    <AppShell>
      {/* Top Page Header */}
      <PageHeader
        title="Medical Records"
        description={
          loading
            ? 'Accessing your health history…'
            : `${total} report${total === 1 ? '' : 's'}${
                activeFilters || search ? ' matching your active filters' : ' recorded in your account'
              }.`
        }
        actions={
          <div className="flex items-center gap-2.5">
            <Link to="/upload">
              <Button>
                <Upload className="h-4 w-4" aria-hidden="true" />
                Upload New Record
              </Button>
            </Link>
          </div>
        }
      />

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      {/* Quick Status Pill Filter Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setParam('status', '')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            !status
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          <span>All Records ({total})</span>
        </button>

        <button
          type="button"
          onClick={() => setParam('status', isStatusActive('FLAGGED') ? '' : 'FLAGGED')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            isStatusActive('FLAGGED')
              ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
              : 'border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Flagged / Abnormal</span>
        </button>

        <button
          type="button"
          onClick={() => setParam('status', isStatusActive('NORMAL') ? '' : 'NORMAL')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            isStatusActive('NORMAL')
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
              : 'border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>All in Range</span>
        </button>

        <button
          type="button"
          onClick={() => setParam('status', isStatusActive('PROCESSING') ? '' : 'PROCESSING')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            isStatusActive('PROCESSING')
              ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
              : 'border border-sky-200/80 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/20 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/40'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Processing</span>
        </button>
      </div>

      {/* Main Panel */}
      <Panel className="overflow-hidden">
        {/* Search & Action Bar */}
        <div className="border-b border-slate-200/80 dark:border-slate-800/80 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[16rem] flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setParam('search', e.target.value)}
                placeholder="Search file name, lab name, biomarker, or tag…"
                aria-label="Search records"
                className="pl-10 pr-8"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setParam('search', '')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Sort Select */}
            <Select
              value={sort}
              onChange={(e) => setParam('sort', e.target.value)}
              aria-label="Sort records"
              className="w-auto text-xs"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            {/* Filter Toggle Button */}
            <Button
              variant={showFilters || activeFilters ? 'secondary' : 'subtle'}
              onClick={() => setShowFilters((open) => !open)}
              aria-expanded={showFilters}
              size="sm"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Filters</span>
              {activeFilters > 0 && (
                <span className="ml-1 rounded-full bg-sky-600 px-1.5 py-0.2 text-[10px] font-bold text-white tabular">
                  {activeFilters}
                </span>
              )}
            </Button>

            {/* View Mode Toggle (List / Grid) */}
            <div className="hidden sm:flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/70 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
                aria-label="List view"
              >
                <LayoutList className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Expandable Filter Drawer */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-800/70 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Record type" htmlFor="filter-type">
                <Select id="filter-type" value={type} onChange={(e) => setParam('type', e.target.value)}>
                  <option value="">All types</option>
                  {Object.entries(RECORD_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Result status" htmlFor="filter-status">
                <Select
                  id="filter-status"
                  value={status}
                  onChange={(e) => setParam('status', e.target.value)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Uploaded from" htmlFor="filter-from">
                <Input
                  id="filter-from"
                  type="date"
                  value={from}
                  onChange={(e) => setParam('from', e.target.value)}
                />
              </Field>

              <Field label="Uploaded to" htmlFor="filter-to">
                <Input
                  id="filter-to"
                  type="date"
                  value={to}
                  onChange={(e) => setParam('to', e.target.value)}
                />
              </Field>

              {availableTags.length > 0 && (
                <div className="sm:col-span-2 lg:col-span-4 mt-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Filter by Tag
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setParam('tag', tag === value ? '' : value)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                          tag === value
                            ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        #{value}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeFilters > 0 && (
                <div className="sm:col-span-2 lg:col-span-4 pt-2">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Reset all filters
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Active Filter Badges */}
          {activeFilters > 0 && !showFilters && (
            <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 mr-1">
                <Filter className="h-3 w-3" />
                Active filters:
              </span>
              {type && <Badge tone="primary">{RECORD_TYPE_LABELS[type] ?? type}</Badge>}
              {status && (
                <Badge tone="primary">
                  {STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}
                </Badge>
              )}
              {tag && <Badge tone="primary">tag: #{tag}</Badge>}
              {from && <Badge tone="primary">from {from}</Badge>}
              {to && <Badge tone="primary">to {to}</Badge>}
              <button
                type="button"
                onClick={clearFilters}
                className="ml-2 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Report Records (List or Grid) */}
        <ReportList
          records={records}
          loading={loading}
          viewMode={viewMode}
          emptyTitle={search || activeFilters ? 'No matching medical records' : 'No medical records yet'}
          emptyDescription={
            search || activeFilters
              ? 'Try modifying your search query or removing active filters to see more results.'
              : 'Upload a laboratory test, prescription, or clinical summary to extract values and begin longitudinal trend analysis.'
          }
          emptyAction={
            search || activeFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <Link to="/upload">
                <Button>
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Add your first record
                </Button>
              </Link>
            )
          }
        />

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 dark:border-slate-800/80 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing <span className="font-bold text-slate-700 dark:text-slate-300">{(page - 1) * PAGE_SIZE + 1}</span> to{' '}
              <span className="font-bold text-slate-700 dark:text-slate-300">{Math.min(page * PAGE_SIZE, total)}</span> of{' '}
              <span className="font-bold text-slate-700 dark:text-slate-300">{total}</span> records
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </Button>
              <div className="px-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {page} / {totalPages}
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {/* Helpful Info Tip */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 px-2">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-sky-500" />
          Click any report row to view full OCR extraction, flagged biomarkers, and reference ranges.
        </span>
      </div>
    </AppShell>
  );
};

export default Reports;
