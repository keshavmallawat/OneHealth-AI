import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowRight, BellRing, Check, CheckCircle2, Copy, Download,
  Eye, FileText, Loader2, QrCode, RefreshCw, Share2, Sparkles,
  Upload as UploadIcon,
} from 'lucide-react';
import { recordsApi } from '../services/recordsApi';
import type { HealthStats, IndicatorsResponse, RecordSummary } from '../services/recordsApi';
import { remindersApi } from '../services/remindersApi';
import type { Reminder } from '../services/remindersApi';
import { usersApi } from '../services/usersApi';
import type { UserProfile } from '../services/usersApi';
import { apiErrorMessage } from '../services/apiClient';
import { formatDate, formatDateTime, relativeTime, STATUS_STYLES } from '../lib/format';
import { useToast } from '../context/ToastContext';
import AppShell from '../components/AppShell';
import UploadPanel from '../components/UploadPanel';
import ReportList from '../components/ReportList';
import ActivityLog from '../components/ActivityLog';
import {
  Alert, Avatar, Badge, Button, FindingsBadge, Panel, PanelHeader, StatTile,
} from '../components/ui';

/** Compact identity capsule with health tags. */
const IdentityCard: React.FC<{ profile: UserProfile | null }> = ({ profile }) => {
  if (!profile) return null;
  const age = profile.dateOfBirth
    ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / 31_557_600_000)
    : null;

  return (
    <Panel className="p-5.5 relative overflow-hidden" glass hover>
      <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="flex items-start gap-4">
        <Avatar name={profile.name} className="h-12 w-12 text-sm shadow-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-base font-bold text-ink truncate tracking-tight">{profile.name}</p>
              <p className="text-xs text-muted truncate">{profile.email}</p>
            </div>
            <Link
              to="/profile"
              className="p-1.5 rounded-lg border border-line bg-surface hover:bg-sunken text-muted hover:text-ink text-xs font-semibold transition-colors shrink-0"
              title="Edit Profile"
            >
              Edit
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink">
              {age !== null ? `${age} yrs` : 'Age unset'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink">
              {profile.bloodType ? `Blood ${profile.bloodType}` : 'Blood unset'}
            </span>
            {profile.sex && (
              <span className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink">
                {profile.sex.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {(profile.allergies?.length ?? 0) > 0 && (
            <div className="mt-2.5 text-xs text-ink-soft flex items-baseline gap-1.5">
              <span className="font-semibold text-rose-500 uppercase text-[10px] tracking-wider">Allergies:</span>
              <span className="truncate">{profile.allergies!.join(', ')}</span>
            </div>
          )}

          {(profile.chronicConditions?.length ?? 0) > 0 && (
            <div className="mt-1 text-xs text-ink-soft flex items-baseline gap-1.5">
              <span className="font-semibold text-amber-500 uppercase text-[10px] tracking-wider">Conditions:</span>
              <span className="truncate">{profile.chronicConditions!.join(', ')}</span>
            </div>
          )}

          {!profile.bloodType && !profile.dateOfBirth && (
            <Link
              to="/profile"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Complete medical vitals <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </Panel>
  );
};

/** Guideline-anchored clinical indicators. */
const IndicatorsPanel: React.FC<{ data: IndicatorsResponse | null }> = ({ data }) => {
  if (!data || data.reportsConsidered === 0) return null;
  return (
    <Panel glass hover>
      <PanelHeader
        title="Clinical Watch Indicators"
        description="Biomarkers evaluated against published national clinical practice guidelines"
        icon={Eye}
        badge={
          <Badge tone={data.indicators.length > 0 ? 'warning' : 'success'}>
            {data.indicators.length} Active Observation{data.indicators.length === 1 ? '' : 's'}
          </Badge>
        }
      />
      {data.indicators.length === 0 ? (
        <div className="p-6 text-sm text-ink-soft text-center">
          <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
          <p className="font-semibold text-ink">All guideline markers within standard limits</p>
          <p className="text-xs text-muted mt-1 max-w-md mx-auto">
            None of your latest values fall into ranges flagged by published clinical thresholds.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {data.indicators.map((indicator) => {
            const isDiscuss = indicator.level === 'DISCUSS';
            return (
              <li key={indicator.id} className="p-5 transition-colors hover:bg-sunken/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isDiscuss ? 'bg-rose-500 shadow-xs shadow-rose-500/50' : 'bg-amber-500'
                      }`}
                    />
                    <p className="text-sm font-bold text-ink">{indicator.title}</p>
                  </div>
                  <Badge tone={isDiscuss ? 'danger' : 'warning'}>
                    {isDiscuss ? 'Discuss with Physician' : 'Monitor Over Time'}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-ink-soft leading-relaxed">{indicator.summary}</p>
                <div className="mt-3.5 rounded-xl border border-line bg-surface/80 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Supporting Laboratory Evidence
                  </p>
                  <ul className="space-y-1">
                    {indicator.basis.map((b) => (
                      <li key={`${b.testName}-${b.recordId}`} className="text-xs text-ink-soft flex items-center justify-between">
                        <Link
                          to={`/reports/${b.recordId}`}
                          className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {b.testName}: <span className="tabular font-bold">{b.value} {b.unit}</span>
                        </Link>
                        <span className="text-muted text-[11px]">
                          {formatDate(b.date)} — {b.note}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mt-2 text-[11px] text-muted italic">Clinical guideline: {indicator.source}</p>
              </li>
            );
          })}
        </ul>
      )}
      <div className="border-t border-line px-5 py-3 text-xs leading-relaxed text-muted bg-sunken/30">
        <p>{data.disclaimer}</p>
        <span className="mt-0.5 block text-[11px] opacity-80">Unassessed categories: {data.notAssessed.join('; ')}.</span>
      </div>
    </Panel>
  );
};

const Dashboard: React.FC = () => {
  const toast = useToast();
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [indicators, setIndicators] = useState<IndicatorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [activityKey, setActivityKey] = useState(0);
  const [copiedShareCode, setCopiedShareCode] = useState(false);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const [list, overview, me, reminderData, indicatorData] = await Promise.all([
        recordsApi.list({ limit: 5 }),
        recordsApi.stats(),
        usersApi.getProfile(),
        remindersApi.list().catch(() => ({ reminders: [], counts: { open: 0, overdue: 0 } })),
        recordsApi.indicators().catch(() => null),
      ]);
      setIndicators(indicatorData);
      setRecords(list.records);
      setStats(overview);
      setProfile(me);
      setReminders(reminderData.reminders.filter((r) => !r.completed).slice(0, 4));
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'We could not load your dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  // Polling while any record is PENDING or PROCESSING
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
    pollRef.current = window.setInterval(() => load(false), 2000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [records, load]);

  const exportSummary = async () => {
    setExporting(true);
    try {
      await recordsApi.downloadSummary();
      toast.success('Health summary exported successfully', 'Your comprehensive clinical PDF has downloaded.');
    } catch (err) {
      const msg = apiErrorMessage(err, 'The health summary could not be downloaded.');
      setError(msg);
      toast.error('Download failed', msg);
    } finally {
      setExporting(false);
    }
  };

  const copyShareCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedShareCode(true);
      toast.success('Share code copied', 'You can now share this code with your healthcare provider.');
      setTimeout(() => setCopiedShareCode(false), 2500);
    } catch {
      toast.error('Failed to copy', 'Please copy the code manually.');
    }
  };

  const latest = stats?.latestReport;
  const flagged = latest?.flagged ?? [];
  const overdue = reminders.filter((r) => r.overdue);

  // High priority attention alerts
  const attention: {
    key: string;
    text: string;
    to: string;
    tone: 'warning' | 'error';
    icon: React.ElementType;
    actionLabel: string;
  }[] = [];

  if ((stats?.pendingConsents ?? 0) > 0) {
    attention.push({
      key: 'consents',
      text: `${stats!.pendingConsents} clinician access request${stats!.pendingConsents === 1 ? '' : 's'} awaiting your decision`,
      to: '/sharing',
      tone: 'warning',
      icon: Share2,
      actionLabel: 'Decide Access',
    });
  }
  if ((latest?.abnormalCount ?? 0) > 0) {
    attention.push({
      key: 'flagged',
      text: `${latest!.abnormalCount} laboratory biomarker${latest!.abnormalCount === 1 ? '' : 's'} outside standard reference range`,
      to: `/reports/${latest!.id}`,
      tone: 'error',
      icon: AlertTriangle,
      actionLabel: 'Inspect Values',
    });
  }
  if (overdue.length > 0) {
    attention.push({
      key: 'reminders',
      text: `${overdue.length} follow-up medical reminder${overdue.length === 1 ? '' : 's'} past scheduled due date`,
      to: '/reminders',
      tone: 'warning',
      icon: BellRing,
      actionLabel: 'View Schedule',
    });
  }
  if ((stats?.failedReports ?? 0) > 0) {
    attention.push({
      key: 'failed',
      text: `${stats!.failedReports} uploaded report${stats!.failedReports === 1 ? '' : 's'} could not be processed`,
      to: '/reports?status=FAILED',
      tone: 'warning',
      icon: AlertTriangle,
      actionLabel: 'Retry Analysis',
    });
  }

  // Greeting by hour
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.name ? profile.name.split(' ')[0] : 'there';

  return (
    <AppShell>
      {/* Hero Welcome & Quick Action Bar */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-800 p-6 sm:p-8 text-white shadow-lg">
        {/* Decorative background glows */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md mb-3 border border-white/15">
              <Sparkles className="h-3.5 w-3.5 text-sky-300" />
              <span>AI-Assisted Digital Health Record</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
              {greeting}, {firstName}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-sky-100/90 max-w-xl leading-relaxed">
              {stats?.lastUploadAt
                ? `Last health record added ${relativeTime(stats.lastUploadAt)}. Your longitudinal biomarkers are up to date.`
                : 'Welcome to your unified clinical portal. Upload your first medical report to begin.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
            <Link to="/upload">
              <Button
                variant="secondary"
                size="md"
                className="bg-white text-slate-900 hover:bg-sky-50 border-0 font-bold shadow-md"
              >
                <UploadIcon className="h-4 w-4 text-sky-600" aria-hidden="true" />
                Upload Record
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="md"
              onClick={exportSummary}
              loading={exporting}
              disabled={(stats?.totalReports ?? 0) === 0}
              className="bg-white/15 text-white hover:bg-white/25 border border-white/20 font-semibold backdrop-blur-md"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export Summary (PDF)
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => load(true)}
              className="bg-white/10 text-white hover:bg-white/20 border border-white/15 p-2.5"
              aria-label="Refresh dashboard"
              title="Refresh dashboard"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      {error && <Alert tone="error" className="mb-6">{error}</Alert>}

      {/* Primary Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
        <StatTile
          label="Medical Records"
          value={stats?.totalReports ?? 0}
          hint={stats ? `${stats.analysedReports} fully analysed` : undefined}
          icon={FileText}
          loading={loading && !stats}
          tone="primary"
          badge={
            stats && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-primary-dark dark:text-primary">
                {stats.analysedReports}/{stats.totalReports} Done
              </span>
            )
          }
        />
        <StatTile
          label="Tracked Biomarkers"
          value={stats?.parametersTracked ?? 0}
          hint="Distinct laboratory tests on file"
          icon={Activity}
          loading={loading && !stats}
          tone="default"
          badge={
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-muted">
              14 Panels
            </span>
          }
        />
        <StatTile
          label="In Normal Range"
          value={latest?.normalCount ?? 0}
          hint={latest ? 'In newest analyzed report' : 'No reports analyzed'}
          icon={CheckCircle2}
          tone="good"
          loading={loading && !stats}
          badge={
            latest && latest.parameterCount > 0 ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                {Math.round((latest.normalCount / latest.parameterCount) * 100)}% Optimal
              </span>
            ) : undefined
          }
        />
        <StatTile
          label="Needs Attention"
          value={latest?.abnormalCount ?? 0}
          hint={latest ? 'Biomarkers outside reference range' : 'Nothing flagged'}
          icon={AlertTriangle}
          tone={(latest?.abnormalCount ?? 0) > 0 ? 'alert' : 'default'}
          loading={loading && !stats}
          badge={
            (latest?.abnormalCount ?? 0) > 0 ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                Action Recommended
              </span>
            ) : undefined
          }
        />
      </div>

      {/* Real-time processing banner */}
      {(stats?.processingReports ?? 0) > 0 && (
        <div className="mb-6 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4.5 backdrop-blur-md animate-in flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-sm shadow-sky-500/30">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">
                {stats!.processingReports} report{stats!.processingReports === 1 ? ' is' : 's are'} currently being analysed
              </p>
              <p className="text-xs text-muted">
                Extracting clinical parameters, matching reference ranges, and generating AI summaries. This dashboard updates live.
              </p>
            </div>
          </div>
          <Link to="/reports" className="shrink-0 text-xs font-bold text-primary hover:underline">
            View queue →
          </Link>
        </div>
      )}

      {/* Urgent Attention Center */}
      {attention.length > 0 && (
        <Panel className="mb-8 border-rose-500/20 bg-rose-500/5 dark:bg-rose-950/20" glass hover>
          <PanelHeader
            title="Action Required"
            description="Items in your health record requiring your clinical or consent review"
            icon={AlertTriangle}
            badge={<Badge tone="danger">{attention.length} Alert{attention.length === 1 ? '' : 's'}</Badge>}
          />
          <ul className="divide-y divide-line">
            {attention.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <Link
                    to={item.to}
                    className="flex items-center justify-between gap-4 p-4.5 sm:px-6 transition-all hover:bg-surface/60 group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${
                          item.tone === 'error'
                            ? 'border-rose-500/30 bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            : 'border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                      </span>
                      <span className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                        {item.text}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary shrink-0 group-hover:translate-x-1 transition-transform">
                      {item.actionLabel}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {/* Two-Column Master Layout */}
      <div className="grid gap-8 xl:grid-cols-3 xl:items-start">
        {/* Main Left Content: Latest Findings, Indicators & Recent Records */}
        <div className="min-w-0 xl:col-span-2 space-y-8">
          {/* Latest Findings Card */}
          {latest ? (
            <Panel glass hover>
              <PanelHeader
                title="Latest Laboratory Findings"
                description={`${latest.fileName} · ${formatDateTime(latest.reportDate ?? latest.uploadedAt)}`}
                icon={Activity}
                actions={
                  <Link
                    to={`/reports/${latest.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    Open Record Details <ArrowRight className="h-3 w-3" />
                  </Link>
                }
              />
              <div className="p-6">
                {/* Visual Ratio Progress Bar */}
                <div className="mb-6 rounded-xl border border-line bg-sunken/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <FindingsBadge abnormalCount={latest.abnormalCount} />
                      <span className="text-xs font-medium text-muted">
                        {latest.normalCount} of {latest.parameterCount} biomarkers in optimal range
                      </span>
                    </div>
                    <span className="text-xs font-bold tabular text-ink">
                      {latest.parameterCount > 0
                        ? `${Math.round((latest.normalCount / latest.parameterCount) * 100)}% in range`
                        : '0 values'}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                    <div
                      className="bg-emerald-500 transition-all duration-500"
                      style={{
                        width: `${latest.parameterCount > 0 ? (latest.normalCount / latest.parameterCount) * 100 : 0}%`,
                      }}
                      title={`${latest.normalCount} normal`}
                    />
                    <div
                      className="bg-rose-500 transition-all duration-500"
                      style={{
                        width: `${latest.parameterCount > 0 ? (latest.abnormalCount / latest.parameterCount) * 100 : 0}%`,
                      }}
                      title={`${latest.abnormalCount} out of range`}
                    />
                  </div>
                </div>

                {flagged.length > 0 ? (
                  <div>
                    <p className="eyebrow mb-3 text-rose-500 dark:text-rose-400">
                      Out of Range Biomarkers ({flagged.length})
                    </p>
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {flagged.slice(0, 6).map((item) => {
                        const style = STATUS_STYLES[item.status];
                        return (
                          <li
                            key={item.key}
                            className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 transition-all hover:bg-rose-500/10"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
                                <span className="truncate text-sm font-bold text-ink">{item.testName}</span>
                              </div>
                              <p className="mt-1 text-xs text-muted truncate">
                                Ref: {item.referenceRange}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-base font-extrabold tabular text-rose-600 dark:text-rose-400">
                                {item.value}
                              </span>
                              <span className="ml-1 text-xs text-muted">{item.unit}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-sm text-ink-soft flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <p className="font-medium">
                      Every extracted biomarker in this report falls safely within standard reference ranges.
                    </p>
                  </div>
                )}
              </div>
            </Panel>
          ) : (
            <Panel glass hover>
              <PanelHeader title="Latest Laboratory Findings" icon={Activity} />
              <div className="px-6 py-12 text-center">
                <FileText className="mx-auto h-8 w-8 text-faint mb-2" />
                <p className="text-sm font-semibold text-ink">No report analysed yet</p>
                <p className="text-xs text-muted max-w-sm mx-auto mt-1">
                  Upload a blood report, scan, or prescription to view automated parameter extraction and reference analysis.
                </p>
              </div>
            </Panel>
          )}

          {/* Guideline Indicators */}
          <IndicatorsPanel data={indicators} />

          {/* Recent Records Card */}
          <Panel glass hover>
            <PanelHeader
              title="Recent Medical Records"
              description="Your stored documents, scanned reports, and laboratory extracts"
              icon={FileText}
              actions={
                <Link
                  to="/reports"
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  View All ({stats?.totalReports ?? 0}) <ArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            <ReportList
              records={records}
              loading={loading && records.length === 0}
              emptyDescription="No medical documents on file yet. Upload a report to see it analyzed."
            />
          </Panel>
        </div>

        {/* Right Sidebar Column: Identity, Upload, Reminders, Sharing */}
        <div className="min-w-0 space-y-8">
          {/* Identity Capsule */}
          <IdentityCard profile={profile} />

          {/* Quick Upload Widget */}
          <Panel glass hover>
            <PanelHeader title="Quick Add Record" icon={UploadIcon} />
            <UploadPanel
              compact
              onUploaded={() => {
                load(false);
                setActivityKey((key) => key + 1);
                toast.success('Record uploaded', 'Your document is queued for AI analysis.');
              }}
            />
          </Panel>

          {/* Sharing & Doctor Access Snapshot */}
          <Panel glass hover>
            <PanelHeader
              title="Provider Sharing"
              icon={Share2}
              actions={
                <Link to="/sharing" className="text-xs font-bold text-primary hover:underline">
                  Manage →
                </Link>
              }
            />
            <div className="p-5 space-y-3.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Clinicians with access</span>
                <span className="tabular font-bold text-ink">{stats?.activeConsents ?? 0} active</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Requests awaiting approval</span>
                <span
                  className={`tabular font-bold ${
                    (stats?.pendingConsents ?? 0) > 0 ? 'text-rose-500' : 'text-ink'
                  }`}
                >
                  {stats?.pendingConsents ?? 0} pending
                </span>
              </div>

              {profile?.shareCode && (
                <div className="pt-3 border-t border-line">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="eyebrow">Your Patient Share Code</p>
                    <span className="text-[10px] text-muted">Give to doctor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-xl border border-line bg-sunken px-3 py-2 font-mono text-xs font-bold tracking-wider text-ink text-center">
                      {profile.shareCode}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyShareCode(profile.shareCode!)}
                      className="p-2 rounded-xl border border-line bg-surface hover:bg-sunken text-muted hover:text-ink transition-colors cursor-pointer"
                      title="Copy Share Code"
                      aria-label="Copy Share Code"
                    >
                      {copiedShareCode ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Link to="/sharing" className="w-full">
                  <Button variant="secondary" size="sm" className="w-full font-semibold">
                    <QrCode className="h-3.5 w-3.5" />
                    Show Single-Use QR Code
                  </Button>
                </Link>
              </div>
            </div>
          </Panel>

          {/* Follow-up Reminders */}
          <Panel glass hover>
            <PanelHeader
              title="Medical Reminders"
              icon={BellRing}
              actions={
                <Link to="/reminders" className="text-xs font-bold text-primary hover:underline">
                  Manage →
                </Link>
              }
            />
            {reminders.length === 0 ? (
              <p className="p-6 text-sm text-muted text-center">
                No active follow-up reminders.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {reminders.map((reminder) => (
                  <li key={reminder.id} className="p-4 transition-colors hover:bg-sunken/40">
                    <p className="text-sm font-semibold text-ink">{reminder.title}</p>
                    {reminder.notes && (
                      <p className="text-xs text-muted mt-0.5 truncate">{reminder.notes}</p>
                    )}
                    <p className={`mt-1.5 text-xs font-medium flex items-center gap-1 ${reminder.overdue ? 'text-rose-500' : 'text-muted'}`}>
                      {reminder.overdue && <AlertTriangle className="h-3 w-3" />}
                      {reminder.overdue ? 'Overdue · ' : 'Due '}
                      {formatDate(reminder.dueAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {/* Immutable Access History Trail */}
      <div className="mt-8">
        <ActivityLog refreshKey={activityKey + records.length} limit={8} columns={2} />
      </div>
    </AppShell>
  );
};

export default Dashboard;
