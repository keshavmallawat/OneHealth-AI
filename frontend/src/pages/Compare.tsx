import React, { useEffect, useState } from 'react';
import { ArrowRight, GitCompareArrows } from 'lucide-react';
import { recordsApi } from '../services/recordsApi';
import type { Comparison, RecordSummary } from '../services/recordsApi';
import { apiErrorMessage } from '../services/apiClient';
import { formatDate } from '../lib/format';
import AppShell from '../components/AppShell';
import {
  Alert, Badge, Button, Panel, PanelHeader, PageHeader, PageLoader, Select, EmptyState
} from '../components/ui';

const DirectionIcon: React.FC<{ direction: string }> = ({ direction }) => {
  if (direction === 'INCREASED') return <span aria-hidden="true">↗</span>;
  if (direction === 'DECREASED') return <span aria-hidden="true">↘</span>;
  return <span aria-hidden="true">-</span>;
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
        <PageLoader label="Loading reports..." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Compare Reports"
        description="Deterministic difference between the values in two of your reports"
      />

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      {analysed.length < 2 ? (
        <Panel>
          <EmptyState
            icon={GitCompareArrows}
            title="Not enough analysed reports"
            description="You need at least two analysed reports to compare them."
          />
        </Panel>
      ) : (
        <Panel>
          <PanelHeader
            title="Compare two reports"
            icon={GitCompareArrows}
          />
          <div className="p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[13rem] flex-1">
                <label htmlFor="compare-a" className="mb-1.5 block text-[13px] font-medium text-ink-soft">
                  Earlier report
                </label>
                <Select id="compare-a" value={a} onChange={(e) => setA(e.target.value)}>
                  {analysed.map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.fileName}
                    </option>
                  ))}
                </Select>
              </div>
              <ArrowRight className="mb-2.5 h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
              <div className="min-w-[13rem] flex-1">
                <label htmlFor="compare-b" className="mb-1.5 block text-[13px] font-medium text-ink-soft">
                  Later report
                </label>
                <Select id="compare-b" value={b} onChange={(e) => setB(e.target.value)}>
                  {analysed.map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.fileName}
                    </option>
                  ))}
                </Select>
              </div>
              <Button onClick={run} loading={busy} disabled={!a || !b || a === b}>
                Compare
              </Button>
            </div>

            {result && (
              <div className="mt-5">
                <div className="mb-4 flex flex-wrap gap-2">
                  <Badge tone="success">{result.summary.improved} returned to range</Badge>
                  <Badge tone="danger">{result.summary.worsened} newly out of range</Badge>
                  <Badge>{result.summary.unchanged} unchanged</Badge>
                  {result.summary.added > 0 && <Badge>{result.summary.added} newly tested</Badge>}
                  {result.summary.removed > 0 && <Badge>{result.summary.removed} not repeated</Badge>}
                </div>

                <div className="scroll-x">
                  <table className="w-full min-w-[42rem] text-sm">
                    <thead>
                      <tr className="border-b border-line bg-sunken text-left">
                        <th className="eyebrow px-4 py-2.5">Test</th>
                        <th className="eyebrow px-3 py-2.5 text-right">
                          {formatDate(result.earlier.date)}
                        </th>
                        <th className="eyebrow px-3 py-2.5 text-right">
                          {formatDate(result.later.date)}
                        </th>
                        <th className="eyebrow px-3 py-2.5 text-right">Change</th>
                        <th className="eyebrow px-4 py-2.5">Movement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row) => (
                        <tr key={row.key} className="border-b border-line-soft last:border-0">
                          <th scope="row" className="px-4 py-2.5 text-left font-medium text-ink">
                            {row.testName}
                            <span className="ml-1.5 text-xs font-normal text-muted">{row.unit}</span>
                          </th>
                          <td className="px-3 py-2.5 text-right tabular text-ink-soft">
                            {row.earlier ? row.earlier.value : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular font-medium text-ink">
                            {row.later ? row.later.value : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular text-ink-soft">
                            {row.delta === null
                              ? '—'
                              : `${row.delta > 0 ? '+' : ''}${row.delta.toFixed(Math.abs(row.delta) < 1 ? 2 : 1)}`}
                          </td>
                          <td className="px-4 py-2.5">
                            {row.direction === 'ADDED' ? (
                              <Badge>Newly tested</Badge>
                            ) : row.direction === 'REMOVED' ? (
                              <Badge>Not repeated</Badge>
                            ) : row.newlyAbnormal ? (
                              <Badge tone="danger">Newly out of range</Badge>
                            ) : row.returnedToRange ? (
                              <Badge tone="success">Back in range</Badge>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                                <DirectionIcon direction={row.direction} />
                                {row.direction === 'STABLE'
                                  ? 'Unchanged'
                                  : row.direction === 'INCREASED'
                                  ? 'Increased'
                                  : 'Decreased'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Panel>
      )}
    </AppShell>
  );
};

export default Compare;
