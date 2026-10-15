import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  TrendingUp,
  Upload,
  Search,
  Calendar,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { recordsApi } from '../services/recordsApi';
import type { TrendSeries } from '../services/recordsApi';
import { apiErrorMessage } from '../services/apiClient';
import { formatDate, STATUS_STYLES } from '../lib/format';
import AppShell from '../components/AppShell';
import {
  Alert,
  Button,
  EmptyState,
  Panel,
  PanelHeader,
  PageHeader,
  PageLoader,
  StatusChip,
} from '../components/ui';

/** Hand-rolled SVG longitudinal chart with reference bands and gradient fills */
const TrendChart: React.FC<{ series: TrendSeries }> = ({ series }) => {
  const width = 640;
  const height = 230;
  const pad = { top: 22, right: 24, bottom: 38, left: 56 };

  const values = series.points.map((p) => p.value);
  const bounds = [
    ...values,
    ...(series.referenceLow !== null ? [series.referenceLow] : []),
    ...(series.referenceHigh !== null ? [series.referenceHigh] : []),
  ];
  const rawMin = Math.min(...bounds);
  const rawMax = Math.max(...bounds);
  const padding = (rawMax - rawMin || Math.abs(rawMax) || 1) * 0.22;
  const min = Math.max(0, rawMin - padding);
  const max = rawMax + padding;

  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const x = (index: number) =>
    pad.left + (series.points.length === 1 ? plotW / 2 : (index / (series.points.length - 1)) * plotW);
  const y = (value: number) => pad.top + plotH - ((value - min) / (max - min || 1)) * plotH;

  const path = series.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ');

  // Gradient area fill
  const areaPath =
    series.points.length > 1
      ? `${path} L ${x(series.points.length - 1)} ${pad.top + plotH} L ${x(0)} ${pad.top + plotH} Z`
      : '';

  const bandTop = series.referenceHigh !== null ? y(series.referenceHigh) : pad.top;
  const bandBottom = series.referenceLow !== null ? y(series.referenceLow) : pad.top + plotH;

  const ticks = [rawMax, (rawMax + rawMin) / 2, rawMin];

  return (
    <div className="relative w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto drop-shadow-xs"
        role="img"
        aria-label={`${series.testName} trend chart across ${series.points.length} measurements`}
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Reference Range Band */}
        <rect
          x={pad.left}
          y={Math.min(bandTop, bandBottom)}
          width={plotW}
          height={Math.max(4, Math.abs(bandBottom - bandTop))}
          className="fill-emerald-500/10 dark:fill-emerald-500/15"
          rx={4}
        />
        <text
          x={pad.left + 8}
          y={Math.min(bandTop, bandBottom) + 13}
          className="fill-emerald-600 dark:fill-emerald-400 text-[9px] font-bold tracking-wider uppercase"
        >
          Clinical Target Range
        </text>

        {/* Gridlines & Y-Axis Labels */}
        {ticks.map((tick, index) => (
          <g key={index}>
            <line
              x1={pad.left}
              y1={y(tick)}
              x2={width - pad.right}
              y2={y(tick)}
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-800"
              strokeWidth={index === 2 ? 1.2 : 0.8}
              strokeDasharray={index === 1 ? '4 4' : undefined}
            />
            <text
              x={pad.left - 10}
              y={y(tick) + 3.5}
              textAnchor="end"
              className="fill-slate-400 text-[10px] font-mono tabular"
            >
              {tick.toFixed(Math.abs(rawMax) < 10 ? 1 : 0)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        {areaPath && <path d={areaPath} fill="url(#areaGradient)" />}

        {/* Connecting Line */}
        <path
          d={path}
          fill="none"
          className="stroke-sky-600 dark:stroke-sky-400"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {series.points.map((point, index) => {
          const isHigh = point.status === 'HIGH';
          const isLow = point.status === 'LOW';
          const isNormal = point.status === 'NORMAL';
          const dotColor = isHigh
            ? '#e11d48'
            : isLow
              ? '#d97706'
              : isNormal
                ? '#10b981'
                : '#64748b';

          return (
            <g key={`${point.recordId}-${index}`} className="group cursor-pointer">
              <circle
                cx={x(index)}
                cy={y(point.value)}
                r={6}
                fill="#ffffff"
                stroke={dotColor}
                strokeWidth={3}
                className="transition-transform group-hover:scale-125"
              />
              <title>{`${formatDate(point.date)}: ${point.value} ${series.unit} (${point.status})`}</title>
              <text
                x={x(index)}
                y={height - 12}
                textAnchor={index === 0 ? 'start' : index === series.points.length - 1 ? 'end' : 'middle'}
                className="fill-slate-400 text-[10px] font-medium"
              >
                {formatDate(point.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const DirectionIcon: React.FC<{ direction: string }> = ({ direction }) => {
  if (direction === 'INCREASED') return <ArrowUpRight className="h-4 w-4" aria-hidden="true" />;
  if (direction === 'DECREASED') return <ArrowDownRight className="h-4 w-4" aria-hidden="true" />;
  return <Minus className="h-4 w-4" aria-hidden="true" />;
};

const Trends: React.FC = () => {
  const [trends, setTrends] = useState<TrendSeries[]>([]);
  const [message, setMessage] = useState<string | undefined>();
  const [reportsAnalysed, setReportsAnalysed] = useState(0);
  const [singleReading, setSingleReading] = useState(0);
  const [selected, setSelected] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState('');
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

  const filteredTrends = useMemo(() => {
    if (!searchFilter.trim()) return trends;
    const q = searchFilter.toLowerCase();
    return trends.filter(
      (t) => t.testName.toLowerCase().includes(q) || t.panel.toLowerCase().includes(q)
    );
  }, [trends, searchFilter]);

  if (loading) {
    return (
      <AppShell>
        <PageLoader label="Synthesising longitudinal biomarker trends…" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Biomarker Trends"
        description={`Longitudinal tracking across ${reportsAnalysed} analysed report${
          reportsAnalysed === 1 ? '' : 's'
        }. Every measurement is mathematically extracted from your uploaded records.`}
        actions={
          <Link to="/upload">
            <Button>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Add Report
            </Button>
          </Link>
        }
      />

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      {trends.length === 0 ? (
        <Panel>
          <EmptyState
            icon={TrendingUp}
            title="Longitudinal Trend Data Accumulating"
            description={
              message ||
              'A trend requires identical biomarker measurements across at least two analysed reports. Upload a follow-up test to generate progression charts.'
            }
            action={
              <Link to="/upload">
                <Button>
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Upload a follow-up record
                </Button>
              </Link>
            }
          />
          {singleReading > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-3.5 text-center text-xs text-slate-400">
              <span className="font-semibold text-slate-600 dark:text-slate-300">{singleReading}</span> biomarker{singleReading === 1 ? ' has' : 's have'} 1 reading on file. Upload another report to unlock trends for them.
            </div>
          )}
        </Panel>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
            {/* Left Parameter Selector */}
            <Panel className="overflow-hidden shadow-xs">
              <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Tracked Biomarkers
                  </span>
                  <span className="rounded-full bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 text-[11px] font-bold text-sky-600 dark:text-sky-400">
                    {trends.length}
                  </span>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search test name…"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <ul className="max-h-[32rem] divide-y divide-slate-100 dark:divide-slate-800/80 overflow-y-auto">
                {filteredTrends.map((series) => {
                  const last = series.points[series.points.length - 1]!;
                  const isActive = series.key === selected;
                  return (
                    <li key={series.key}>
                      <button
                        type="button"
                        onClick={() => setSelected(series.key)}
                        aria-current={isActive}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-all cursor-pointer ${
                          isActive
                            ? 'bg-sky-50/80 dark:bg-sky-950/40 border-l-4 border-sky-600'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 border-l-4 border-transparent'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${STATUS_STYLES[last.status].dot}`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-xs font-bold ${
                              isActive ? 'text-sky-950 dark:text-sky-200' : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {series.testName}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {series.points.length} measurements
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="tabular text-xs font-bold text-slate-900 dark:text-white">
                            {last.value}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">{series.unit}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            {/* Right Chart & Observations Area */}
            {active && (
              <div className="space-y-5">
                <Panel className="overflow-hidden shadow-xs">
                  <PanelHeader
                    title={active.testName}
                    description={`${active.panel} • Clinical Reference: ${active.referenceRange}`}
                    actions={<StatusChip status={active.points[active.points.length - 1]!.status} />}
                  />
                  <div className="p-5 sm:p-6">
                    {/* Header Big Metric + Movement */}
                    <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-2">
                      <span className="tabular text-3xl font-extrabold text-slate-900 dark:text-white">
                        {active.points[active.points.length - 1]!.value}
                        <span className="ml-1.5 text-sm font-normal text-slate-400">{active.unit}</span>
                      </span>

                      <div
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                          active.observation.newlyAbnormal
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                            : active.observation.returnedToRange
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        <DirectionIcon direction={active.observation.direction} />
                        <span>
                          {active.observation.delta === 0
                            ? 'No change'
                            : `${active.observation.delta > 0 ? '+' : ''}${active.observation.delta.toFixed(
                                Math.abs(active.observation.delta) < 1 ? 2 : 1
                              )} ${active.unit} vs previous`}
                        </span>
                      </div>
                    </div>

                    {/* Chart Component */}
                    <TrendChart series={active} />

                    {/* Clinical Observation Note */}
                    <div
                      className={`mt-6 rounded-2xl border p-4 text-xs leading-relaxed ${
                        active.observation.newlyAbnormal
                          ? 'border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200'
                          : active.observation.returnedToRange
                            ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200'
                            : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] mb-1">
                        <Sparkles className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                        <span>Clinical Progression Insight</span>
                      </div>
                      <p>{active.observation.note}</p>
                    </div>

                    {/* Chronological Measurements Table */}
                    <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                        Historical Traceability
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-400">
                              <th className="py-2.5 font-bold uppercase">Report Document</th>
                              <th className="py-2.5 font-bold uppercase">Collection Date</th>
                              <th className="py-2.5 font-bold uppercase text-right pr-4">Measured Value</th>
                              <th className="py-2.5 font-bold uppercase">Clinical Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {[...active.points].reverse().map((point, index) => (
                              <tr key={`${point.recordId}-${index}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="py-3 pr-3 font-semibold text-slate-900 dark:text-white">
                                  <Link
                                    to={`/reports/${point.recordId}`}
                                    className="hover:text-sky-600 dark:hover:text-sky-400 inline-flex items-center gap-1"
                                  >
                                    <span>{point.fileName}</span>
                                    <ChevronRight className="h-3 w-3" />
                                  </Link>
                                </td>
                                <td className="py-3 text-slate-500 dark:text-slate-400">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3 text-slate-400" />
                                    {formatDate(point.date)}
                                  </span>
                                </td>
                                <td className="py-3 text-right pr-4 font-mono font-bold text-slate-900 dark:text-white tabular">
                                  {point.value} {active.unit}
                                </td>
                                <td className="py-3">
                                  <StatusChip status={point.status} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </Panel>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default Trends;
