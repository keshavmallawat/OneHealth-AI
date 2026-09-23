import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Filter, Search, SlidersHorizontal, Upload, X } from 'lucide-react';
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
  const pollRef = useRef<number | null>(null);

  // The URL is the source of truth for filters, so a filtered view can be
  // bookmarked, shared or reloaded without losing its state.
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

  // Debounce so typing in the search box does not fire a request per keystroke.
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

  return (
    <AppShell>
      <PageHeader
        title="Medical records"
        description={
          loading
            ? 'Loading your record history…'
            : `${total} record${total === 1 ? '' : 's'}${activeFilters || search ? ' matching your filters' : ' on file'}.`
        }
        actions={
          <Link to="/upload">
            <Button>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Add record
            </Button>
          </Link>
        }
      />

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      <Panel>
        <div className="border-b border-line p-4">
          <div className="flex flex-wrap gap-2.5">
            <div className="relative min-w-[15rem] flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setParam('search', e.target.value)}
                placeholder="Search file name, laboratory, notes or tag"
                aria-label="Search records"
                className="pl-9"
              />
            </div>

            <Select
              value={sort}
              onChange={(e) => setParam('sort', e.target.value)}
              aria-label="Sort records"
              className="w-auto"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <Button
              variant={showFilters || activeFilters ? 'secondary' : 'subtle'}
              onClick={() => setShowFilters((open) => !open)}
              aria-expanded={showFilters}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filters
              {activeFilters > 0 && (
                <span className="ml-0.5 rounded-full bg-primary px-1.5 py-px text-[11px] text-white tabular">
                  {activeFilters}
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                <div className="sm:col-span-2 lg:col-span-4">
                  <p className="eyebrow mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setParam('tag', tag === value ? '' : value)}
                        className={`rounded border px-2 py-0.5 text-xs font-medium transition-colors ${
                          tag === value
                            ? 'border-primary bg-primary-soft text-primary-ink'
                            : 'border-line bg-surface text-ink-soft hover:bg-sunken'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeFilters > 0 && (
                <div className="sm:col-span-2 lg:col-span-4">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Clear filters
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeFilters > 0 && !showFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              {type && <Badge tone="primary">{RECORD_TYPE_LABELS[type] ?? type}</Badge>}
              {status && (
                <Badge tone="primary">
                  {STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}
                </Badge>
              )}
              {tag && <Badge tone="primary">tag: {tag}</Badge>}
              {from && <Badge tone="primary">from {from}</Badge>}
              {to && <Badge tone="primary">to {to}</Badge>}
              <button
                type="button"
                onClick={clearFilters}
                className="ml-1 text-xs font-medium text-primary hover:underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <ReportList
          records={records}
          loading={loading}
          emptyTitle={search || activeFilters ? 'No matching records' : 'No records yet'}
          emptyDescription={
            search || activeFilters
              ? 'Try a different search term, or clear the filters.'
              : 'Upload your first medical report and the platform will read the values out of it.'
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
                  Add a record
                </Button>
              </Link>
            )
          }
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
            <p className="text-sm text-muted">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </AppShell>
  );
};

export default Reports;
