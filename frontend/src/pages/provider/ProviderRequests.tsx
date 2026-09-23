import React, { useCallback, useEffect, useState } from 'react';
import { Clock, ScrollText, ShieldCheck, ShieldX } from 'lucide-react';
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
  <li className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-ink">{consent.patient?.name ?? 'Patient'}</p>
        <Badge tone={STATUS_TONE[consent.status] ?? 'neutral'}>
          {consent.active ? 'active' : consent.status.toLowerCase()}
        </Badge>
        {consent.origin === 'QR' && <Badge tone="primary">via QR</Badge>}
      </div>
      {consent.purpose && (
        <p className="mt-1 text-sm text-ink-soft">
          <span className="text-muted">Purpose: </span>
          {consent.purpose}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>Requested {relativeTime(consent.createdAt)}</span>
        {consent.decidedAt && <span>Decided {relativeTime(consent.decidedAt)}</span>}
        {consent.active && <span>Access ends {formatDateTime(consent.expiresAt)}</span>}
      </div>
    </div>
    {consent.status === 'PENDING' && (
      <p className="max-w-xs text-xs text-muted">
        Waiting for the patient to approve. Nothing of theirs is visible to you before then.
      </p>
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
        <PageLoader label="Loading your access requests" />
      </AppShell>
    );
  }

  const pending = consents.filter((c) => c.status === 'PENDING');
  const decided = consents.filter((c) => c.status !== 'PENDING');

  return (
    <AppShell>
      <PageHeader
        title="Access requests"
        description="Requests you have made, and the decisions patients took on them."
      />

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      <div className="space-y-5">
        <Panel>
          <PanelHeader title={`Awaiting a decision (${pending.length})`} icon={Clock} />
          {pending.length === 0 ? (
            <EmptyState
              compact
              icon={ShieldCheck}
              title="Nothing pending"
              description="Requests you send appear here until the patient approves or declines them."
            />
          ) : (
            <ul className="divide-y divide-line">
              {pending.map((consent) => (
                <Row key={consent.id} consent={consent} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Decided" icon={ScrollText} />
          {decided.length === 0 ? (
            <EmptyState compact icon={ShieldX} title="No decisions yet" />
          ) : (
            <ul className="divide-y divide-line">
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
