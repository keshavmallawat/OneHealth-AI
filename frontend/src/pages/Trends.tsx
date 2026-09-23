import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight, ArrowUpRight, Minus, TrendingUp, Upload,
} from 'lucide-react';
import { recordsApi } from '../services/recordsApi';
import type { TrendSeries } from '../services/recordsApi';
import { apiErrorMessage } from '../services/apiClient';
import { formatDate, STATUS_STYLES } from '../lib/format';
import AppShell from '../components/AppShell';
import {
  Alert, Button, EmptyState, Panel, PanelHeader, PageHeader, PageLoader,
  StatusChip,
} from '../components/ui';

/**
 * Longitudinal chart for one parameter.
 *
 * Hand-rolled SVG rather than a charting dependency: one chart shape is needed,
 * and this keeps the bundle and the dependency list honest. The shaded band is
 * the reference interval, so "inside the band" is readable without decoding
 * colour, and each point is also labelled by status in the table below.
 */
const TrendChart: React.FC<{ series: TrendSeries }> = ({ series }) => {
  const width = 640;
  const height = 220;
  const pad = { top: 18, right: 20, bottom: 34, left: 52 };

  const values = series.points.map((p) => p.value);
  const bounds = [
    ...values,
    ...(series.referenceLow !== null ? [series.referenceLow] : []),
    ...(series.referenceHigh !== null ? [series.referenceHigh] : []),
  ];
  const rawMin = Math.min(...bounds);
  const rawMax = Math.max(...bounds);
  const padding = (rawMax - rawMin || Math.abs(rawMax) || 1) * 0.2;
  const min = rawMin - padding;
  const max = rawMax + padding;

  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const x = (index: number) =>
    pad.left + (series.points.length === 1 ? plotW / 2 : (index / (series.points.length - 1)) * plotW);
  const y = (value: number) => pad.top + plotH - ((value - min) / (max - min || 1)) * plotH;

  const path = series.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ');

  const bandTop = series.referenceHigh !== null ? y(series.referenceHigh) : pad.top;
  const bandBottom = series.referenceLow !== null ? y(series.referenceLow) : pad.top + plotH;

  const ticks = [rawMax, (rawMax + rawMin) / 2, rawMin];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label={`${series.testName} across ${series.points.length} reports. Most recent value ${
        series.points[series.points.length - 1]!.value
      } ${series.unit}, ${series.points[series.points.length - 1]!.status.toLowerCase()}.`}
    >
      {/* Reference band */}
      <rect
        x={pad.left}
        y={Math.min(bandTop, bandBottom)}
        width={plotW}
        height={Math.max(2, Math.abs(bandBottom - bandTop))}
        className="fill-normal/10"
      />
      <text
        x={pad.left + 6}
        y={Math.min(bandTop, bandBottom) + 12}
        className="fill-normal text-[9px]"
      >
        reference range
      </text>

      {/* Gridlines and y labels */}
      {ticks.map((tick, index) => (
        <g key={index}>
          <line
            x1={pad.left}
            y1={y(tick)}
            x2={width - pad.right}
            y2={y(tick)}
            className="stroke-[var(--color-line)]"
            strokeWidth={index === 2 ? 1 : 0.6}
            strokeDasharray={index === 1 ? '3 3' : undefined}
          />
          <text
            x={pad.left - 8}
            y={y(tick) + 3}
            textAnchor="end"
            className="fill-[var(--color-muted)] text-[10px] tabular"
          >
            {tick.toFixed(Math.abs(rawMax) < 10 ? 1 : 0)}
          </text>
        </g>
      ))}

      <path
        d={path}
        fill="none"
        className="stroke-primary"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {series.points.map((point, index) => (
        <g key={`${point.recordId}-${index}`}>
          <circle
            cx={x(index)}
            cy={y(point.value)}
            r={4.5}
            className="fill-surface stroke-2"
            style={{
              stroke:
                point.status === 'NORMAL'
                  ? 'var(--color-normal)'
                  : point.status === 'HIGH'
                  ? 'var(--color-high)'
                  : point.status === 'LOW'
                  ? 'var(--color-low)'
                  : 'var(--color-unknown)',
            }}
          />
          <title>{`${formatDate(point.date)} — ${point.value} ${series.unit} (${point.status})`}</title>
          <text
            x={x(index)}
            y={height - 10}
            textAnchor={index === 0 ? 'start' : index === series.points.length - 1 ? 'end' : 'middle'}
            className="fill-[var(--color-muted)] text-[10px]"
          >
            {formatDate(point.date)}
          </text>
        </g>
      ))}
    </svg>
  );
};

const DirectionIcon: React.FC<{ direction: string }> = ({ direction }) => {
  if (direction === 'INCREASED') return <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />;
  if (direction === 'DECREASED') return <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Minus className="h-3.5 w-3.5" aria-hidden="true" />;
};



const Trends: React.FC = () => {
  const [trends, setTrends] = useState<TrendSeries[]>([]);
  const [message, setMessage] = useState<string | undefined>();
  const [reportsAnalysed, setReportsAnalysed] = useState(0);
  const [singleReading, setSingleReading] = useState(0);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const trendData = await recordsApi.trends();
      setTrends(trendData.trends);
      setMessage(trendData.message);
      setReportsAnalysed(trendData.reportsAnalysed);
      setSingleReading(trendData.parametersWithOneReading ?? 0);
      if (trendData.trends.length > 0) setSelected(trendData.trends[0]!.key);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'We could not build your trends.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(() => trends.find((t) => t.key === selected), [trends, selected]);

  if (loading) {
    return (
      <AppShell>
        <PageLoader label="Building your trends" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Health trends"
        description={`How your values have moved across ${reportsAnalysed} analysed report${
          reportsAnalysed === 1 ? '' : 's'
        }. Every point comes from a report you uploaded.`}
      />

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      {trends.length === 0 ? (
        <Panel>
          <EmptyState
            icon={TrendingUp}
            title="Not enough data for a trend yet"
            description={
              message ||
              'A trend needs the same test in at least two analysed reports. Upload another report containing the same panel and the change over time will be charted here.'
            }
            action={
              <Link to="/upload">
                <Button>
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Add a record
                </Button>
              </Link>
            }
          />
          {singleReading > 0 && (
            <p className="border-t border-line px-5 py-3 text-center text-xs text-muted">
              {singleReading} parameter{singleReading === 1 ? ' has' : 's have'} a single reading on
              file — one point is not yet a trend.
            </p>
          )}
        </Panel>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
            {/* Parameter selector */}
            <Panel>
              <PanelHeader title={`Parameters (${trends.length})`} />
              <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
                {trends.map((series) => {
                  const last = series.points[series.points.length - 1]!;
                  const isActive = series.key === selected;
                  return (
                    <li key={series.key}>
                      <button
                        type="button"
                        onClick={() => setSelected(series.key)}
                        aria-current={isActive}
                        className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
                          isActive ? 'bg-primary-soft' : 'hover:bg-sunken'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_STYLES[last.status].dot}`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-[13px] ${
                              isActive ? 'font-medium text-primary-ink' : 'text-ink'
                            }`}
                          >
                            {series.testName}
                          </span>
                          <span className="block text-xs text-muted">
                            {series.points.length} readings
                          </span>
                        </span>
                        <span className="shrink-0 tabular text-[13px] font-medium text-ink">
                          {last.value}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            {/* Chart */}
            {active && (
              <Panel>
                <PanelHeader
                  title={active.testName}
                  description={`${active.panel} · reference ${active.referenceRange}`}
                  actions={<StatusChip status={active.points[active.points.length - 1]!.status} />}
                />
                <div className="p-5">
                  <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="tabular text-2xl font-semibold text-ink">
                      {active.points[active.points.length - 1]!.value}
                      <span className="ml-1 text-sm font-normal text-muted">{active.unit}</span>
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[13px] ${
                        active.observation.newlyAbnormal
                          ? 'text-high'
                          : active.observation.returnedToRange
                          ? 'text-normal'
                          : 'text-muted'
                      }`}
                    >
                      <DirectionIcon direction={active.observation.direction} />
                      {active.observation.delta === 0
                        ? 'no change'
                        : `${active.observation.delta > 0 ? '+' : ''}${active.observation.delta.toFixed(
                            Math.abs(active.observation.delta) < 1 ? 2 : 1
                          )} since previous`}
                    </span>
                  </div>

                  <TrendChart series={active} />

                  <div
                    className={`mt-4 rounded-md border px-3.5 py-3 text-sm ${
                      active.observation.newlyAbnormal
                        ? 'border-high-line bg-high-soft text-ink-soft'
                        : active.observation.returnedToRange
                        ? 'border-normal-line bg-normal-soft text-ink-soft'
                        : 'border-line bg-sunken text-ink-soft'
                    }`}
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                      Observation
                    </p>
                    {active.observation.note}
                  </div>

                  {/* Readings, so every point on the chart is traceable. */}
                  <div className="scroll-x mt-5">
                    <table className="w-full min-w-[30rem] text-sm">
                      <thead>
                        <tr className="border-b border-line text-left">
                          <th className="eyebrow py-2">Report</th>
                          <th className="eyebrow py-2">Date</th>
                          <th className="eyebrow py-2 pr-3 text-right">Value</th>
                          <th className="eyebrow py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...active.points].reverse().map((point, index) => (
                          <tr key={`${point.recordId}-${index}`} className="border-b border-line-soft last:border-0">
                            <td className="py-2.5 pr-3">
                              <Link
                                to={`/reports/${point.recordId}`}
                                className="truncate text-primary hover:underline"
                              >
                                {point.fileName}
                              </Link>
                            </td>
                            <td className="py-2.5 pr-3 text-muted">{formatDate(point.date)}</td>
                            <td className="py-2.5 pr-3 text-right tabular font-medium text-ink">
                              {point.value}
                            </td>
                            <td className="py-2.5">
                              <StatusChip status={point.status} />
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


        </div>
      )}
    </AppShell>
  );
};

export default Trends;
