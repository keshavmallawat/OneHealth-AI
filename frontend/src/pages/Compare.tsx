import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  GitCompareArrows,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  FileText,
  Sparkles,
} from 'lucide-react';
import { recordsApi } from '../services/recordsApi';
import type { Comparison, RecordSummary } from '../services/recordsApi';
import { apiErrorMessage } from '../services/apiClient';
import { formatDate } from '../lib/format';
import AppShell from '../components/AppShell';
import {
  Alert,
  Badge,
  Button,
  Panel,
  PanelHeader,
  PageHeader,
  PageLoader,
  Select,
  EmptyState,
} from '../components/ui';

const DirectionIcon: React.FC<{ direction: string }> = ({ direction }) => {
  if (direction === 'INCREASED') return <ArrowUpRight className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />;
  if (direction === 'DECREASED') return <ArrowDownRight className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />;
  return <Minus className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />;
};

const Compare: React.FC = () => {
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);

  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [result, setResult] = useState<Comparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await recordsApi.list({ limit: 50 });
        setRecords(data.records);
      } catch (err) {
        setError(apiErrorMessage(err, 'Failed to load reports for comparison.'));
      } finally {
        setLoadingRecords(false);
      }
    };
    load();
  }, []);

  const analysed = records.filter((r) => r.status === 'DONE');

  useEffect(() => {
    if (analysed.length >= 2 && !a && !b) {
      setA(analysed[1]!.id);
      setB(analysed[0]!.id);
    }
  }, [analysed, a, b]);

  const run = async () => {
    if (!a || !b || a === b) return;
    setBusy(true);
    setError('');
    try {
      setResult(await recordsApi.compare(a, b));
    } catch (err) {
      setError(apiErrorMessage(err, 'Those reports could not be compared.'));
    } finally {
      setBusy(false);
    }
  };

  if (loadingRecords) {
    return (
      <AppShell>
        <PageLoader label="Loading medical records for comparison…" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Compare Medical Reports"
        description="Deterministic side-by-side comparative analysis of laboratory biomarkers between two points in time."
      />

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      {analysed.length < 2 ? (
        <Panel>
          <EmptyState
            icon={GitCompareArrows}
            title="At Least Two Reports Required"
            description="Comparing biomarker movement requires two or more analysed records on file. Upload a second lab test to unlock side-by-side diffs."
          />
        </Panel>
      ) : (
        <div className="space-y-6">
          {/* Comparison Selector Card */}
          <Panel className="overflow-hidden shadow-xs">
            <PanelHeader
              title="Select Two Records to Compare"
              description="Choose an earlier baseline report and a later follow-up test"
              icon={GitCompareArrows}
            />
            <div className="p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr_auto] items-end">
                {/* Earlier Report */}
                <div>
                  <label htmlFor="compare-a" className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Baseline Report (Earlier)
                  </label>
                  <Select id="compare-a" value={a} onChange={(e) => setA(e.target.value)}>
                    {analysed.map((record) => (
                      <option key={record.id} value={record.id}>
                        {record.fileName} {record.reportDate ? `(${formatDate(record.reportDate)})` : ''}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Arrow Divider */}
                <div className="hidden sm:flex items-center justify-center h-10 w-10 text-slate-400">
                  <ArrowRight className="h-5 w-5" />
                </div>

                {/* Later Report */}
                <div>
                  <label htmlFor="compare-b" className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Comparison Report (Later)
                  </label>
                  <Select id="compare-b" value={b} onChange={(e) => setB(e.target.value)}>
                    {analysed.map((record) => (
                      <option key={record.id} value={record.id}>
                        {record.fileName} {record.reportDate ? `(${formatDate(record.reportDate)})` : ''}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Compare Button */}
                <Button onClick={run} loading={busy} disabled={!a || !b || a === b} className="h-10">
                  <GitCompareArrows className="h-4 w-4" />
                  Run Diff
                </Button>
              </div>

              {a === b && (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                  Please select two different reports to perform a comparison.
                </p>
              )}
            </div>
          </Panel>

          {/* Results Section */}
          {result && (
            <Panel className="overflow-hidden shadow-xs">
              <PanelHeader
                title="Biomarker Movement Analysis"
                description={`Compared: ${result.earlier.fileName} (${formatDate(result.earlier.date)}) → ${result.later.fileName} (${formatDate(result.later.date)})`}
                icon={Sparkles}
              />
              <div className="p-5 sm:p-6">
                {/* Summary Pills Bar */}
                <div className="mb-6 flex flex-wrap gap-2.5">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{result.summary.improved} Returned to Range</span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-1 text-xs font-bold text-rose-700 dark:text-rose-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>{result.summary.worsened} Newly Out of Range</span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>{result.summary.unchanged} Unchanged</span>
                  </div>

                  {result.summary.added > 0 && (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
                      <span>+{result.summary.added} Newly Tested</span>
                    </div>
                  )}

                  {result.summary.removed > 0 && (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-500">
                      <span>{result.summary.removed} Not Repeated</span>
                    </div>
                  )}
                </div>

                {/* Diff Table */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[48rem] text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 text-left">
                        <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Biomarker
                        </th>
                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                          <span className="flex items-center justify-end gap-1">
                            <Calendar className="h-3 w-3" />
                            Baseline ({formatDate(result.earlier.date)})
                          </span>
                        </th>
                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                          <span className="flex items-center justify-end gap-1">
                            <Calendar className="h-3 w-3" />
                            Later ({formatDate(result.later.date)})
                          </span>
                        </th>
                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                          Delta Change
                        </th>
                        <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Clinical Trend Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {result.rows.map((row) => (
                        <tr
                          key={row.key}
                          className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors ${
                            row.newlyAbnormal ? 'bg-rose-50/30 dark:bg-rose-950/20' : row.returnedToRange ? 'bg-emerald-50/30 dark:bg-emerald-950/20' : ''
                          }`}
                        >
                          <th scope="row" className="px-5 py-3.5 text-left font-semibold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 text-slate-400" />
                              <span>{row.testName}</span>
                            </div>
                            <span className="text-[11px] font-normal text-slate-400 font-mono ml-5">
                              {row.unit}
                            </span>
                          </th>

                          <td className="px-4 py-3.5 text-right tabular text-slate-600 dark:text-slate-300 font-mono">
                            {row.earlier ? row.earlier.value : <span className="text-slate-400">—</span>}
                          </td>

                          <td className="px-4 py-3.5 text-right tabular font-bold text-slate-900 dark:text-white font-mono">
                            {row.later ? row.later.value : <span className="text-slate-400">—</span>}
                          </td>

                          <td className="px-4 py-3.5 text-right tabular">
                            {row.delta === null ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <span
                                className={`font-mono font-bold ${
                                  row.newlyAbnormal
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : row.returnedToRange
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {row.delta > 0 ? `+${row.delta.toFixed(Math.abs(row.delta) < 1 ? 2 : 1)}` : row.delta.toFixed(Math.abs(row.delta) < 1 ? 2 : 1)}
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-3.5">
                            {row.direction === 'ADDED' ? (
                              <Badge tone="neutral">Newly Tested</Badge>
                            ) : row.direction === 'REMOVED' ? (
                              <Badge tone="neutral">Not Repeated</Badge>
                            ) : row.newlyAbnormal ? (
                              <Badge tone="danger">⚠️ Newly Out of Range</Badge>
                            ) : row.returnedToRange ? (
                              <Badge tone="success">✅ Back in Range</Badge>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                <DirectionIcon direction={row.direction} />
                                <span>
                                  {row.direction === 'STABLE'
                                    ? 'Stable'
                                    : row.direction === 'INCREASED'
                                      ? 'Increased'
                                      : 'Decreased'}
                                </span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>
          )}
        </div>
      )}
    </AppShell>
  );
};

export default Compare;
