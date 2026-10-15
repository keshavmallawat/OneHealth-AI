import React, { useCallback, useEffect, useState } from 'react';
import { ScrollText, ShieldCheck, UserCheck, Eye, ShieldAlert } from 'lucide-react';
import { recordsApi } from '../services/recordsApi';
import type { ActivityEntry } from '../services/recordsApi';
import { apiErrorMessage } from '../services/apiClient';
import AppShell from '../components/AppShell';
import { ActivityRow } from '../components/ActivityLog';
import {
  Alert, EmptyState, Panel, PanelHeader, PageHeader, SegmentedControl, Skeleton,
} from '../components/ui';

type Scope = 'all' | 'mine';

const ActivityHistory: React.FC = () => {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [scope, setScope] = useState<Scope>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await recordsApi.activity(100, scope));
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'We could not load your access history.'));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const byOthers = entries.filter((e) => !e.byMe).length;
  const byMe = entries.filter((e) => e.byMe).length;

  return (
    <AppShell>
      {/* Forensic Audit Banner */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 sm:p-8 text-white shadow-xl shadow-slate-950/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_80%_20%,rgba(20,184,166,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-semibold mb-3">
              <ShieldCheck className="h-3.5 w-3.5" />
              Immutable Cryptographic Ledger
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              Forensic Access & Audit Trail
            </h1>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              Every access request, record download, biometric parse, and clinician inspection is immutably timestamped and recorded. You maintain complete visibility over your health records.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-xs font-semibold">
              <Eye className="h-4 w-4 text-teal-400" />
              <span>{byOthers} Clinician Action{byOthers === 1 ? '' : 's'}</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-xs font-semibold">
              <UserCheck className="h-4 w-4 text-indigo-400" />
              <span>{byMe} Personal Action{byMe === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>
      </div>

      <PageHeader
        title="Access History"
        description="Comprehensive audit trail of every interaction with your diagnostic data."
      />

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl<Scope>
          value={scope}
          onChange={setScope}
          ariaLabel="Filter access history"
          options={[
            { value: 'all', label: `All Activity (${entries.length})` },
            { value: 'mine', label: 'Only My Actions' },
          ]}
        />
        {scope === 'all' && !loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {byOthers === 0 ? (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="h-4 w-4" />
                Zero external clinician accesses recorded
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                <ShieldAlert className="h-4 w-4" />
                {byOthers} verified clinician inspection{byOthers === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )}
      </div>

      <Panel>
        <PanelHeader
          title={scope === 'all' ? 'All Activity Ledger' : 'Patient Actions Ledger'}
          description="Chronological event log with timestamp, IP reference, and actor role"
          icon={ScrollText}
        />
        {loading ? (
          <div className="space-y-4 p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No activity recorded yet"
            description="Actions appear here automatically as soon as you or an authorized clinician interact with your medical files."
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {entries.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} bordered={false} />
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
};

export default ActivityHistory;
