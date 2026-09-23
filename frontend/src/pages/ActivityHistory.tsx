import React, { useCallback, useEffect, useState } from 'react';
import { ScrollText, ShieldCheck } from 'lucide-react';
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

  return (
    <AppShell>
      <PageHeader
        title="Access history"
        description="Every action taken on your health record is logged, including access by clinicians you have shared with."
      />

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl<Scope>
          value={scope}
          onChange={setScope}
          ariaLabel="Filter access history"
          options={[
            { value: 'all', label: 'Everything on my record' },
            { value: 'mine', label: 'Only my own actions' },
          ]}
        />
        {scope === 'all' && !loading && (
          <p className="text-sm text-muted">
            {byOthers === 0
              ? 'No one else has accessed your records.'
              : `${byOthers} action${byOthers === 1 ? '' : 's'} by someone other than you.`}
          </p>
        )}
      </div>

      <Panel>
        <PanelHeader
          title={scope === 'all' ? 'All activity on your record' : 'Your own actions'}
          icon={ShieldCheck}
        />
        {loading ? (
          <div className="space-y-3 px-5 py-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Nothing logged yet"
            description="Actions appear here as soon as you or a clinician you have authorised touch your records."
          />
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
};

export default ActivityHistory;
