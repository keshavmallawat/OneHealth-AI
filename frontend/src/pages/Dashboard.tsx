import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, BellRing, CheckCircle2, Download, Eye, FileText, Loader2,
  RefreshCw, Share2, Upload as UploadIcon,
} from 'lucide-react';
import { recordsApi } from '../services/recordsApi';
import type { HealthStats, IndicatorsResponse, RecordSummary } from '../services/recordsApi';
import { remindersApi } from '../services/remindersApi';
import type { Reminder } from '../services/remindersApi';
import { usersApi } from '../services/usersApi';
import type { UserProfile } from '../services/usersApi';
import { apiErrorMessage } from '../services/apiClient';
import { formatDate, formatDateTime, relativeTime, STATUS_STYLES } from '../lib/format';
import AppShell from '../components/AppShell';
import UploadPanel from '../components/UploadPanel';
import ReportList from '../components/ReportList';
import ActivityLog from '../components/ActivityLog';
import {
  Alert, Avatar, Badge, Button, FindingsBadge, Panel, PanelHeader, PageHeader, StatTile,
} from '../components/ui';

/** Compact identity strip — who this record belongs to, at a glance. */
const IdentityCard: React.FC<{ profile: UserProfile | null }> = ({ profile }) => {
  if (!profile) return null;
  const age = profile.dateOfBirth
    ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / 31_557_600_000)
    : null;

  return (
    <Panel className="p-5">
      <div className="flex items-start gap-3.5">
        <Avatar name={profile.name} className="h-10 w-10 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink truncate">{profile.name}</p>
          <p className="text-xs text-muted truncate">{profile.email}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge>{age !== null ? `${age} years` : 'Age not set'}</Badge>
            <Badge>{profile.bloodType ? `Blood ${profile.bloodType}` : 'Blood type not set'}</Badge>
            {profile.sex && <Badge>{profile.sex.replace(/_/g, ' ')}</Badge>}
          </div>
          {(profile.allergies?.length ?? 0) > 0 && (
            <p className="mt-2.5 text-xs text-ink-soft">
              <span className="text-muted">Allergies: </span>
              {profile.allergies!.join(', ')}
            </p>
          )}
          {(profile.chronicConditions?.length ?? 0) > 0 && (
            <p className="mt-1 text-xs text-ink-soft">
              <span className="text-muted">Conditions: </span>
              {profile.chronicConditions!.join(', ')}
            </p>
          )}
          {!profile.bloodType && !profile.dateOfBirth && (
            <Link
              to="/profile"
              className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
            >
              Complete your health profile →
            </Link>
          )}
        </div>
      </div>
    </Panel>
  );
};

/**
 * Watch indicators: guideline thresholds applied to the newest value of each test.
 * Deliberately modest in tone - "worth watching" / "worth discussing", never a diagnosis.
 */
const IndicatorsPanel: React.FC<{ data: IndicatorsResponse | null }> = ({ data }) => {
  if (!data || data.reportsConsidered === 0) return null;
  return (
    <Panel>
      <PanelHeader
        title="Worth watching"
        description="Your latest values compared with published guideline thresholds"
        icon={Eye}
      />
      {data.indicators.length === 0 ? (
        <div className="p-5 text-sm text-ink-soft">
          None of your latest values fall in a range these guidelines flag. This covers only the tests
          printed on your uploaded reports.
        </div>
      ) : (
        <ul className="divide-y divide-line-soft">
          {data.indicators.map((indicator) => (
            <li key={indicator.id} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink">{indicator.title}</p>
                <Badge tone={indicator.level === 'DISCUSS' ? 'danger' : 'neutral'}>
                  {indicator.level === 'DISCUSS' ? 'Worth discussing with a clinician' : 'Worth keeping an eye on'}
                </Badge>
              </div>
              <p className="mt-1.5 text-sm text-ink-soft">{indicator.summary}</p>
              <ul className="mt-3 space-y-1.5">
                {indicator.basis.map((b) => (
                  <li key={`${b.testName}-${b.recordId}`} className="text-[13px] text-muted">
                    <Link to={`/reports/${b.recordId}`} className="font-medium text-ink hover:underline">
                      {b.testName} {b.value} {b.unit}
                    </Link>{' '}
                    ({formatDate(b.date)}) — {b.note}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">Source: {indicator.source}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-line-soft px-5 py-3 text-xs leading-relaxed text-muted">
        {data.disclaimer}
        <span className="mt-1 block">Not assessed: {data.notAssessed.join('; ')}.</span>
      </div>
    </Panel>
  );
};

const Dashboard: React.FC = () => {
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [indicators, setIndicators] = useState<IndicatorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [activityKey, setActivityKey] = useState(0);
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

  /* While anything is still being analysed, poll so status chips and the health
     overview update themselves without the patient refreshing. */
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
    } catch (err) {
      setError(apiErrorMessage(err, 'The health summary could not be downloaded.'));
    } finally {
      setExporting(false);
    }
  };

  const latest = stats?.latestReport;
  const flagged = latest?.flagged ?? [];
  const overdue = reminders.filter((r) => r.overdue);

  // "What needs attention" is assembled from real state only — nothing is shown
  // here unless there is a corresponding row in the database.
  const attention: {
    key: string;
    text: string;
    to: string;
    tone: 'warning' | 'error';
    icon: React.ElementType;
  }[] = [];
  if ((stats?.pendingConsents ?? 0) > 0) {
    attention.push({
      key: 'consents',
      text: `${stats!.pendingConsents} clinician access request${stats!.pendingConsents === 1 ? '' : 's'} awaiting your decision`,
      to: '/sharing',
      tone: 'warning',
      icon: Share2,
    });
  }
  if ((latest?.abnormalCount ?? 0) > 0) {
    attention.push({
      key: 'flagged',
      text: `${latest!.abnormalCount} value${latest!.abnormalCount === 1 ? '' : 's'} outside the reference range in your latest report`,
      to: `/reports/${latest!.id}`,
      tone: 'error',
      icon: AlertTriangle,
    });
  }
  if (overdue.length > 0) {
    attention.push({
      key: 'reminders',
      text: `${overdue.length} reminder${overdue.length === 1 ? '' : 's'} past their due date`,
      to: '/reminders',
      tone: 'warning',
      icon: BellRing,
    });
  }
  if ((stats?.failedReports ?? 0) > 0) {
    attention.push({
      key: 'failed',
      text: `${stats!.failedReports} report${stats!.failedReports === 1 ? '' : 's'} could not be analysed`,
      to: '/reports?status=FAILED',
      tone: 'warning',
      icon: AlertTriangle,
    });
  }

  return (
    <AppShell>
      <PageHeader
        title="Health overview"
        description={
          stats?.lastUploadAt
            ? `Last record added ${relativeTime(stats.lastUploadAt)}.`
            : 'Upload your first medical report to get started.'
        }
        actions={
          <>
            <Button variant="secondary" size="md" onClick={() => load(true)}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button
              variant="secondary"
              onClick={exportSummary}
              loading={exporting}
              disabled={(stats?.totalReports ?? 0) === 0}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export summary
            </Button>
            <Button onClick={() => document.getElementById('record-upload-input')?.click()}>
              <UploadIcon className="h-4 w-4" aria-hidden="true" />
              Add record
            </Button>
          </>
        }
      />

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      <Panel className="mb-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-line">
          <StatTile
            label="Records"
            value={stats?.totalReports ?? 0}
            hint={stats ? `${stats.analysedReports} analysed` : undefined}
            icon={FileText}
            loading={loading && !stats}
          />
          <StatTile
            label="Values tracked"
            value={stats?.parametersTracked ?? 0}
            hint="distinct tests on file"
            icon={Activity}
            loading={loading && !stats}
          />
          <StatTile
            label="In range"
            value={latest?.normalCount ?? 0}
            hint={latest ? 'in latest report' : 'no analysed report yet'}
            icon={CheckCircle2}
            tone="good"
            loading={loading && !stats}
          />
          <StatTile
            label="Needs attention"
            value={latest?.abnormalCount ?? 0}
            hint={latest ? 'in latest report' : 'nothing flagged'}
            icon={AlertTriangle}
            tone={(latest?.abnormalCount ?? 0) > 0 ? 'alert' : 'default'}
            loading={loading && !stats}
          />
        </div>
      </Panel>

      {(stats?.processingReports ?? 0) > 0 && (
        <Alert tone="info" className="mb-5">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {stats!.processingReports} record{stats!.processingReports === 1 ? ' is' : 's are'} being
            analysed. This page updates itself.
          </span>
        </Alert>
      )}

      {attention.length > 0 && (
        <Panel className="mb-5">
          <PanelHeader title="Needs your attention" icon={AlertTriangle} />
          <ul className="divide-y divide-line">
            {attention.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <Link
                    to={item.to}
                    className="flex items-center gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-sunken"
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${
                        item.tone === 'error'
                          ? 'border-high-line bg-high-soft text-high'
                          : 'border-low-line bg-low-soft text-low'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="flex-1 text-ink">{item.text}</span>
                    <span className="shrink-0 text-xs font-medium text-primary">Review →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <div className="grid gap-6 xl:grid-cols-3 xl:items-start">
        <div className="min-w-0 xl:col-span-2 space-y-6">
          {latest ? (
            <Panel>
              <PanelHeader
                title="Latest findings"
                description={`${latest.fileName} · ${formatDateTime(latest.reportDate ?? latest.uploadedAt)}`}
                icon={Activity}
                actions={
                  <Link
                    to={`/reports/${latest.id}`}
                    className="text-[13px] font-medium text-primary hover:underline"
                  >
                    Open record
                  </Link>
                }
              />
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-3 mb-5">
                  <FindingsBadge abnormalCount={latest.abnormalCount} />
                  <span className="text-sm font-medium text-muted">
                    {latest.normalCount} of {latest.parameterCount} values within range
                  </span>
                </div>

                {flagged.length > 0 ? (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {flagged.slice(0, 6).map((item) => {
                      const style = STATUS_STYLES[item.status];
                      return (
                        <li
                          key={item.key}
                          className="flex items-center justify-between gap-3 rounded border border-line bg-surface p-4 shadow-sm"
                        >
                          <span className="flex min-w-0 items-center gap-2 text-sm">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                              aria-hidden="true"
                            />
                            <span className="truncate font-medium text-ink">{item.testName}</span>
                          </span>
                          <span className="shrink-0 text-[15px] tabular font-semibold text-ink">
                            {item.value}
                            <span className="ml-1 text-[13px] font-normal text-muted">{item.unit}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="rounded border border-line-soft bg-canvas p-4 text-sm text-ink-soft">
                    Every extracted value in this report falls inside its clinical reference range.
                  </div>
                )}
              </div>
            </Panel>
          ) : (
            <Panel>
              <PanelHeader title="Latest findings" icon={Activity} />
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-muted max-w-sm mx-auto">
                  Once you upload a report, the values read from it — and anything outside its
                  reference range — appear here.
                </p>
              </div>
            </Panel>
          )}

          <IndicatorsPanel data={indicators} />

          <Panel>
            <PanelHeader
              title="Recent records"
              icon={FileText}
              actions={
                <Link to="/reports" className="text-[13px] font-medium text-primary hover:underline">
                  View all
                </Link>
              }
            />
            <ReportList
              records={records}
              loading={loading && records.length === 0}
              emptyDescription="Nothing on file yet. Upload a report to see it analysed here."
            />
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <IdentityCard profile={profile} />

          <Panel>
            <PanelHeader title="Add a medical record" icon={UploadIcon} />
            <UploadPanel
              compact
              onUploaded={() => {
                load(false);
                setActivityKey((key) => key + 1);
              }}
            />
          </Panel>

          <Panel>
            <PanelHeader
              title="Reminders"
              icon={BellRing}
              actions={
                <Link to="/reminders" className="text-[13px] font-medium text-primary hover:underline">
                  Manage
                </Link>
              }
            />
            {reminders.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted text-center">
                No open reminders.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {reminders.map((reminder) => (
                  <li key={reminder.id} className="px-5 py-3">
                    <p className="text-sm text-ink">{reminder.title}</p>
                    <p className={`mt-0.5 text-xs ${reminder.overdue ? 'text-high' : 'text-muted'}`}>
                      {reminder.overdue ? 'Overdue · ' : 'Due '}
                      {formatDate(reminder.dueAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Sharing"
              icon={Share2}
              actions={
                <Link to="/sharing" className="text-[13px] font-medium text-primary hover:underline">
                  Manage
                </Link>
              }
            />
            <div className="px-5 py-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Clinicians with access</span>
                <span className="tabular font-medium text-ink">{stats?.activeConsents ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Requests awaiting you</span>
                <span
                  className={`tabular font-medium ${
                    (stats?.pendingConsents ?? 0) > 0 ? 'text-high' : 'text-ink'
                  }`}
                >
                  {stats?.pendingConsents ?? 0}
                </span>
              </div>
              {profile?.shareCode && (
                <div className="pt-2 mt-1 border-t border-line">
                  <p className="eyebrow">Your share code</p>
                  <p className="mt-1 font-mono text-[13px] tracking-wide text-ink">
                    {profile.shareCode}
                  </p>
                </div>
              )}
            </div>
          </Panel>

        </div>
      </div>

      <div className="mt-5">
        <ActivityLog refreshKey={activityKey + records.length} limit={8} columns={2} />
      </div>
    </AppShell>
  );
};

export default Dashboard;
