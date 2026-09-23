/**
 * The patient's access history.
 *
 * Because the audit trail records both who acted and whose data it concerned,
 * this shows clinician access to the patient's records too — not only what the
 * patient did themselves. That is what makes the audit meaningful.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download, Eye, FileUp, MessageSquareText, PencilLine, QrCode, RefreshCw, ScrollText,
  Share2, ShieldCheck, ShieldX, Trash2, UserCog,
} from 'lucide-react';
import { recordsApi } from '../services/recordsApi';
import type { ActivityEntry } from '../services/recordsApi';
import { relativeTime } from '../lib/format';
import { Badge, Panel, PanelHeader, Skeleton } from './ui';

export const ACTION_META: Record<string, { label: string; icon: React.ElementType }> = {
  UPLOAD_RECORD: { label: 'uploaded', icon: FileUp },
  VIEW_RECORD_DETAILS: { label: 'opened', icon: Eye },
  DOWNLOAD_RECORD_FILE: { label: 'downloaded', icon: Download },
  UPDATE_RECORD: { label: 'edited the details of', icon: PencilLine },
  DELETE_RECORD: { label: 'deleted', icon: Trash2 },
  REPROCESS_RECORD: { label: 're-analysed', icon: RefreshCw },
  VIEW_PATIENT_SUMMARY: { label: 'opened the patient summary', icon: Eye },
  EXPORT_HEALTH_SUMMARY: { label: 'exported a health summary', icon: Download },
  CONSENT_REQUESTED: { label: 'requested access to this record', icon: ShieldCheck },
  CONSENT_APPROVED: { label: 'approved a clinician’s access', icon: ShieldCheck },
  CONSENT_REJECTED: { label: 'declined a clinician’s request', icon: ShieldX },
  CONSENT_REVOKED: { label: 'revoked a clinician’s access', icon: ShieldX },
  CONSENT_GRANTED: { label: 'granted a clinician access', icon: Share2 },
  SHARE_SESSION_CREATED: { label: 'created a share code', icon: QrCode },
  SHARE_SESSION_REVOKED: { label: 'cancelled a share code', icon: QrCode },
  SHARE_SESSION_REDEEMED: { label: 'used a share code to connect', icon: QrCode },
  UPDATE_PROFILE: { label: 'updated the profile', icon: UserCog },
  ASSISTANT_QUERY: { label: 'asked the health assistant', icon: MessageSquareText },
};

export const ActivityRow: React.FC<{ entry: ActivityEntry; bordered?: boolean }> = ({
  entry,
  bordered,
}) => {
  const meta = ACTION_META[entry.action] ?? {
    label: entry.action.toLowerCase().replace(/_/g, ' '),
    icon: ScrollText,
  };
  const Icon = meta.icon;
  return (
    <li className={`flex gap-3 px-5 py-3 ${bordered ? 'border-b border-line-soft' : ''}`}>
      <span
        className={`mt-0.5 h-6 w-6 shrink-0 rounded-full grid place-items-center border ${
          entry.byMe ? 'border-line bg-sunken text-muted' : 'border-primary-line bg-primary-soft text-primary-ink'
        }`}
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">
          <span className="font-medium">{entry.byMe ? 'You' : entry.actor.name}</span>{' '}
          <span className="text-ink-soft">{meta.label}</span>{' '}
          {entry.fileName ? (
            entry.recordId && !entry.recordDeleted ? (
              <Link to={`/reports/${entry.recordId}`} className="text-primary hover:underline">
                {entry.fileName}
              </Link>
            ) : (
              <span className="text-muted">{entry.fileName}</span>
            )
          ) : null}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">{relativeTime(entry.timestamp)}</span>
          {!entry.byMe && (
            <Badge tone="primary">{entry.actor.role === 'DOCTOR' ? 'Clinician' : entry.actor.role}</Badge>
          )}
        </div>
      </div>
    </li>
  );
};

const ActivityLog: React.FC<{ refreshKey?: number; limit?: number; columns?: 1 | 2 }> = ({
  refreshKey = 0,
  limit = 8,
  columns = 1,
}) => {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    recordsApi
      .activity(limit)
      .then((data) => active && setEntries(data))
      .catch(() => active && setEntries([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [refreshKey, limit]);

  return (
    <Panel>
      <PanelHeader
        title="Access history"
        icon={ShieldCheck}
        actions={
          <Link to="/activity" className="text-[13px] font-medium text-primary hover:underline">
            View all
          </Link>
        }
      />
      {loading ? (
        <div className="space-y-3 px-5 py-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-muted">No activity recorded yet.</p>
      ) : columns === 2 ? (
        <ul className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-6">
          {entries.map((entry) => (
            <ActivityRow key={entry.id} entry={entry} bordered />
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-line">
          {entries.map((entry) => (
            <ActivityRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </Panel>
  );
};

export default ActivityLog;
