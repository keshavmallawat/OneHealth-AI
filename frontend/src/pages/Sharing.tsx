import React, { useCallback, useEffect, useState } from 'react';
import {
  Check, Clock, Copy, QrCode, RefreshCw, Search, Share2, ShieldCheck, ShieldX, Stethoscope, X,
} from 'lucide-react';
import { consentApi } from '../services/consentApi';
import type { Consent, DoctorSummary } from '../services/consentApi';
import { shareApi } from '../services/shareApi';
import type { ShareSession } from '../services/shareApi';
import { usersApi } from '../services/usersApi';
import type { UserProfile } from '../services/usersApi';
import { apiErrorMessage } from '../services/apiClient';
import { formatDateTime, relativeTime } from '../lib/format';
import AppShell from '../components/AppShell';
import {
  Alert, Badge, Button, EmptyState, Field, Input, Modal, Panel, PanelHeader, PageHeader,
  PageLoader, Select, StatusBadge, Tabs,
} from '../components/ui';

type TabKey = 'access' | 'requests' | 'qr' | 'history';

const DURATIONS = [
  { value: 24, label: '24 hours' },
  { value: 72, label: '3 days' },
  { value: 168, label: '7 days' },
  { value: 720, label: '30 days' },
];

/** Copyable text with confirmation, used for the share code. */
const CopyField: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the value stays selectable on screen.
    }
  };
  return (
    <div>
      <p className="eyebrow mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border border-line bg-sunken px-3 py-2 font-mono text-[13px] tracking-wide text-ink">
          {value}
        </code>
        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copy
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

const ConsentRow: React.FC<{
  consent: Consent;
  onDecide: (id: string, action: 'approve' | 'reject' | 'revoke', duration?: number) => void;
  busyId: string | null;
}> = ({ consent, onDecide, busyId }) => {
  const doctor = consent.doctor;
  const busy = busyId === consent.id;
  const [duration, setDuration] = useState(72);

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ink">{doctor?.name ?? 'Unknown clinician'}</p>
            <StatusBadge kind="consent" status={consent.active ? 'ACTIVE' : consent.status} />
            {consent.origin === 'QR' && <Badge tone="primary">via QR</Badge>}
          </div>

          <p className="mt-0.5 text-xs text-muted">
            {[doctor?.specialization, doctor?.clinicName, doctor?.city].filter(Boolean).join(' · ') ||
              'No practice details provided'}
          </p>
          {doctor?.registrationNumber && (
            <p className="text-xs text-muted">Registration {doctor.registrationNumber}</p>
          )}

          {consent.purpose && (
            <p className="mt-2 text-sm text-ink-soft">
              <span className="text-muted">Purpose: </span>
              {consent.purpose}
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>Requested {relativeTime(consent.createdAt)}</span>
            {consent.active && <span>Access ends {formatDateTime(consent.expiresAt)}</span>}
            {consent.lastAccessedAt && (
              <span>
                Last opened {relativeTime(consent.lastAccessedAt)} · {consent.accessCount} view
                {consent.accessCount === 1 ? '' : 's'}
              </span>
            )}
            {consent.revokedAt && <span>Revoked {relativeTime(consent.revokedAt)}</span>}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {consent.status === 'PENDING' && (
            <>
              <Select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                aria-label="Access period"
                className="w-auto py-1.5 text-xs"
              >
                {DURATIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                onClick={() => onDecide(consent.id, 'approve', duration)}
                loading={busy}
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onDecide(consent.id, 'reject')}
                disabled={busy}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Decline
              </Button>
            </>
          )}
          {consent.active && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => onDecide(consent.id, 'revoke')}
              loading={busy}
            >
              <ShieldX className="h-3.5 w-3.5" aria-hidden="true" />
              Revoke access
            </Button>
          )}
        </div>
      </div>
    </li>
  );
};

const Sharing: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('access');
  const [consents, setConsents] = useState<Consent[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<ShareSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Grant flow
  const [granting, setGranting] = useState(false);
  const [directory, setDirectory] = useState<DoctorSummary[]>([]);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<DoctorSummary | null>(null);
  const [grantDuration, setGrantDuration] = useState(72);
  const [grantBusy, setGrantBusy] = useState(false);

  // QR flow
  const [qr, setQr] = useState<{ session: ShareSession; qrDataUrl: string } | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrMinutes, setQrMinutes] = useState(15);
  const [qrDuration, setQrDuration] = useState(72);

  const load = useCallback(async () => {
    try {
      const [consentData, me, sessionData] = await Promise.all([
        consentApi.list(),
        usersApi.getProfile(),
        shareApi.list().catch(() => [] as ShareSession[]),
      ]);
      setConsents(consentData.consents);
      setProfile(me);
      setSessions(sessionData);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'We could not load your sharing settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!granting) return;
    const timer = setTimeout(() => {
      consentApi.directory(query || undefined).then(setDirectory).catch(() => setDirectory([]));
    }, query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [granting, query]);

  const decide = async (id: string, action: 'approve' | 'reject' | 'revoke', duration?: number) => {
    setBusyId(id);
    setError('');
    try {
      const response =
        action === 'approve'
          ? await consentApi.approve(id, duration)
          : action === 'reject'
          ? await consentApi.reject(id)
          : await consentApi.revoke(id);
      setNotice(response?.message ?? 'Updated.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'That request could not be updated.'));
    } finally {
      setBusyId(null);
    }
  };

  const grant = async () => {
    if (!chosen) return;
    setGrantBusy(true);
    setError('');
    try {
      const response = await consentApi.grant({ doctorId: chosen.id, durationHours: grantDuration });
      setNotice(response?.message ?? 'Access granted.');
      setGranting(false);
      setChosen(null);
      setQuery('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Access could not be granted.'));
    } finally {
      setGrantBusy(false);
    }
  };

  const createQr = async () => {
    setQrBusy(true);
    setError('');
    try {
      setQr(await shareApi.create({ expiresInMinutes: qrMinutes, grantDurationHrs: qrDuration }));
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'The share code could not be created.'));
    } finally {
      setQrBusy(false);
    }
  };

  const revokeSession = async (id: string) => {
    try {
      await shareApi.revoke(id);
      setQr(null);
      setNotice('That share code no longer works.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'The share code could not be revoked.'));
    }
  };

  const rotateCode = async () => {
    try {
      const next = await usersApi.rotateShareCode();
      setProfile((current) => (current ? { ...current, shareCode: next } : current));
      setNotice('A new share code has been issued. The previous one no longer works.');
    } catch (err) {
      setError(apiErrorMessage(err, 'A new share code could not be issued.'));
    }
  };

  if (loading) {
    return (
      <AppShell>
        <PageLoader label="Loading your sharing settings" />
      </AppShell>
    );
  }

  const active = consents.filter((c) => c.active);
  const pending = consents.filter((c) => c.status === 'PENDING');
  const past = consents.filter((c) => !c.active && c.status !== 'PENDING');

  return (
    <AppShell>
      <PageHeader
        title="Sharing & consent"
        description="You decide which clinicians can see your records, for how long, and you can withdraw access at any moment."
        actions={
          <Button onClick={() => setGranting(true)}>
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Share with a clinician
          </Button>
        }
      />

      {error && <Alert tone="error" className="mb-4" onDismiss={() => setError('')}>{error}</Alert>}
      {notice && <Alert tone="success" className="mb-4" onDismiss={() => setNotice('')}>{notice}</Alert>}

      <Tabs<TabKey>
        value={tab}
        onChange={setTab}
        className="mb-5"
        tabs={[
          { value: 'access', label: 'Who has access', count: active.length },
          { value: 'requests', label: 'Requests', count: pending.length },
          { value: 'qr', label: 'Share by QR' },
          { value: 'history', label: 'Past access', count: past.length },
        ]}
      />

      {tab === 'access' && (
        <Panel>
          <PanelHeader title="Clinicians with current access" icon={ShieldCheck} />
          {active.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title="No one has access right now"
              description="Nobody can see your records except you. Share with a clinician when you need them to review something."
              action={
                <Button onClick={() => setGranting(true)}>
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  Share with a clinician
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {active.map((consent) => (
                <ConsentRow key={consent.id} consent={consent} onDecide={decide} busyId={busyId} />
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === 'requests' && (
        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Requests awaiting your decision" icon={Clock} />
            {pending.length === 0 ? (
              <EmptyState
                compact
                icon={Clock}
                title="No pending requests"
                description="When a clinician asks for access using your share code, it will appear here for you to approve or decline."
              />
            ) : (
              <ul className="divide-y divide-line">
                {pending.map((consent) => (
                  <ConsentRow key={consent.id} consent={consent} onDecide={decide} busyId={busyId} />
                ))}
              </ul>
            )}
          </Panel>

          {profile?.shareCode && (
            <Panel>
              <PanelHeader title="Your share code" />
              <div className="space-y-4 p-5">
                <p className="text-sm text-ink-soft">
                  Give this code to a clinician so they can request access. It identifies you without
                  revealing your email address, and a request still needs your approval before
                  anything is shared.
                </p>
                <CopyField value={profile.shareCode} label="Share code" />
                <Button variant="secondary" size="sm" onClick={rotateCode}>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Issue a new code
                </Button>
              </div>
            </Panel>
          )}
        </div>
      )}

      {tab === 'qr' && (
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <Panel>
            <PanelHeader title="Share in person by QR" icon={QrCode} />
            <div className="space-y-4 p-5">
              <p className="text-sm text-ink-soft">
                Generate a short-lived code for a clinician to scan during a consultation. The code
                carries nothing but a random token — no name, no identifier and no medical
                information — and it can only be used once.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Code is valid for" htmlFor="qr-minutes">
                  <Select
                    id="qr-minutes"
                    value={qrMinutes}
                    onChange={(e) => setQrMinutes(Number(e.target.value))}
                  >
                    <option value={5}>5 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={60}>1 hour</option>
                  </Select>
                </Field>
                <Field label="Grants access for" htmlFor="qr-duration">
                  <Select
                    id="qr-duration"
                    value={qrDuration}
                    onChange={(e) => setQrDuration(Number(e.target.value))}
                  >
                    {DURATIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Button onClick={createQr} loading={qrBusy} className="w-full">
                <QrCode className="h-4 w-4" aria-hidden="true" />
                Generate share code
              </Button>

              {qr && (
                <div className="rounded-md border border-line bg-sunken p-5 text-center">
                  <img
                    src={qr.qrDataUrl}
                    alt="QR code containing a single-use share token"
                    className="mx-auto h-48 w-48 rounded-md border border-line bg-white p-2"
                  />
                  <p className="mt-3 text-sm text-ink">
                    Expires {formatDateTime(qr.session.expiresAt)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Single use · grants {qr.session.grantDurationHrs} hours of read-only access
                  </p>
                  <div className="mt-4 text-left">
                    <CopyField value={qr.session.token} label="Or read this code aloud" />
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    className="mt-3"
                    onClick={() => revokeSession(qr.session.id)}
                  >
                    Cancel this code
                  </Button>
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Recent share codes" />
            {sessions.length === 0 ? (
              <EmptyState compact icon={QrCode} title="No share codes yet" />
            ) : (
              <ul className="divide-y divide-line">
                {sessions.map((session) => (
                  <li key={session.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge kind="share" status={session.status} />
                        <span className="text-xs text-muted">
                          created {relativeTime(session.createdAt)}
                        </span>
                      </div>
                      {session.claimedBy && (
                        <p className="mt-1 text-sm text-ink">
                          Used by {session.claimedBy.name} {relativeTime(session.claimedAt!)}
                        </p>
                      )}
                    </div>
                    {session.status === 'ACTIVE' && (
                      <Button size="sm" variant="ghost" onClick={() => revokeSession(session.id)}>
                        Cancel
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {tab === 'history' && (
        <Panel>
          <PanelHeader title="Access that has ended" />
          {past.length === 0 ? (
            <EmptyState compact icon={ShieldX} title="Nothing here yet" description="Expired, declined and revoked access appears here." />
          ) : (
            <ul className="divide-y divide-line">
              {past.map((consent) => (
                <ConsentRow key={consent.id} consent={consent} onDecide={decide} busyId={busyId} />
              ))}
            </ul>
          )}
        </Panel>
      )}

      {/* Grant access directly */}
      <Modal
        open={granting}
        onClose={() => setGranting(false)}
        title="Share your records with a clinician"
        description="Access is read-only, time limited, and you can revoke it at any moment."
        footer={
          <>
            <Button variant="secondary" onClick={() => setGranting(false)}>
              Cancel
            </Button>
            <Button onClick={grant} loading={grantBusy} disabled={!chosen}>
              Grant access
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Find a clinician" htmlFor="doctor-search">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                aria-hidden="true"
              />
              <Input
                id="doctor-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, speciality, clinic or city"
                className="pl-9"
              />
            </div>
          </Field>

          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {directory.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                No clinicians match that search.
              </p>
            ) : (
              directory.map((doctor) => {
                const selected = chosen?.id === doctor.id;
                const alreadyActive = doctor.existingStatus === 'ACTIVE';
                return (
                  <button
                    key={doctor.id}
                    type="button"
                    disabled={alreadyActive}
                    onClick={() => setChosen(doctor)}
                    className={`w-full rounded-md border px-3.5 py-2.5 text-left transition-colors ${
                      selected
                        ? 'border-primary bg-primary-soft'
                        : alreadyActive
                        ? 'cursor-not-allowed border-line bg-sunken opacity-70'
                        : 'border-line hover:bg-sunken'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{doctor.name}</p>
                        <p className="truncate text-xs text-muted">
                          {[doctor.specialization, doctor.clinicName, doctor.city]
                            .filter(Boolean)
                            .join(' · ') || 'No practice details provided'}
                        </p>
                      </div>
                      {alreadyActive && <Badge tone="success">Already has access</Badge>}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <Field label="Access period" htmlFor="grant-duration">
            <Select
              id="grant-duration"
              value={grantDuration}
              onChange={(e) => setGrantDuration(Number(e.target.value))}
            >
              {DURATIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </AppShell>
  );
};

export default Sharing;
