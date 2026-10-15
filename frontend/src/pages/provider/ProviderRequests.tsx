import React, { useCallback, useEffect, useState } from 'react';
import { Clock, ScrollText, ShieldCheck, ShieldX, CheckCircle2, QrCode } from 'lucide-react';
import { consentApi } from '../../services/consentApi';
import type { Consent } from '../../services/consentApi';
import { apiErrorMessage } from '../../services/apiClient';
import { formatDateTime, relativeTime } from '../../lib/format';
import AppShell from '../../components/AppShell';
import {
  Alert, Badge, EmptyState, Panel, PanelHeader, PageHeader, PageLoader,
} from '../../components/ui';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  APPROVED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
  REVOKED: 'danger',
  EXPIRED: 'neutral',
};

const Row: React.FC<{ consent: Consent }> = ({ consent }) => (
  <li className="flex flex-wrap items-start justify-between gap-4 p-5 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
        <p className="text-base font-bold text-slate-900 dark:text-slate-100">
          {consent.patient?.name ?? 'Patient Record'}
        </p>
        <Badge tone={STATUS_TONE[consent.status] ?? 'neutral'}>
          {consent.active ? 'ACTIVE' : consent.status}
        </Badge>
        {consent.origin === 'QR' && (
          <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300">
            <QrCode className="h-3 w-3" />
            In-Person QR
          </span>
        )}
      </div>

      {consent.purpose && (
        <div className="mt-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300">
          <span className="font-semibold text-slate-500 dark:text-slate-400">Clinical Purpose: </span>
          {consent.purpose}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>Requested {relativeTime(consent.createdAt)}</span>
        {consent.decidedAt && <span>Decided {relativeTime(consent.decidedAt)}</span>}
        {consent.active && (
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            Access active until {formatDateTime(consent.expiresAt)}
          </span>
        )}
      </div>
    </div>

    {consent.status === 'PENDING' && (
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 px-3.5 py-2 text-xs text-amber-800 dark:text-amber-300 max-w-xs shrink-0">
        <p className="font-semibold">Awaiting Patient Authorization</p>
        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
          Patient has been notified. Records unlock automatically once accepted.
        </p>
      </div>
    )}

    {consent.active && (
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 px-3.5 py-2 text-xs text-emerald-800 dark:text-emerald-300 max-w-xs shrink-0 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        <span>Granted & Verified</span>
      </div>
    )}
  </li>
);

const ProviderRequests: React.FC = () => {
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await consentApi.list();
      setConsents(data.consents);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'We could not load your access requests.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <AppShell>
        <PageLoader label="Loading access requests audit log" />
      </AppShell>
    );
  }

  const pending = consents.filter((c) => c.status === 'PENDING');
  const decided = consents.filter((c) => c.status !== 'PENDING');

  return (
    <AppShell>
      <PageHeader
        title="Consent Requests"
        description="Chronological log of diagnostic access requests sent to patients and their approval statuses."
      />

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      <div className="space-y-6">
        <Panel>
          <PanelHeader
            title={`Awaiting Patient Decision (${pending.length})`}
            description="Requests currently awaiting patient approval"
            icon={Clock}
          />
          {pending.length === 0 ? (
            <EmptyState
              compact
              icon={ShieldCheck}
              title="No Pending Outbound Requests"
              description="When you request access via a patient's share code, it will remain tracked here until approved."
            />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {pending.map((consent) => (
                <Row key={consent.id} consent={consent} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title={`Historical Decisions (${decided.length})`}
            description="Completed, expired, or revoked access requests"
            icon={ScrollText}
          />
          {decided.length === 0 ? (
            <EmptyState compact icon={ShieldX} title="No Historical Requests" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {decided.map((consent) => (
                <Row key={consent.id} consent={consent} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
};

export default ProviderRequests;
