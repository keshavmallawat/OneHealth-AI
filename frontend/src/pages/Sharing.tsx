import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  QrCode,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  ShieldX,
  Stethoscope,
  X,
  Lock,
  History,
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
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  Panel,
  PanelHeader,
  PageHeader,
  PageLoader,
  Select,
  StatusBadge,
  Tabs,
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
      // Clipboard access can be blocked; value remains selectable
    }
  };
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 font-mono text-xs font-semibold tracking-wider text-slate-900 dark:text-white shadow-xs">
          {value}
        </code>
        <Button variant="secondary" size="sm" onClick={copy} className="shrink-0">
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Copy</span>
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
    <li className="px-5 py-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-400/30 grid place-items-center text-sky-600 dark:text-sky-400">
            <Stethoscope className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-slate-900 dark:text-white">{doctor?.name ?? 'Authorised Clinician'}</p>
              <StatusBadge kind="consent" status={consent.active ? 'ACTIVE' : consent.status} />
              {consent.origin === 'QR' && (
                <span className="rounded-md bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">
                  via QR Scan
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {[doctor?.specialization, doctor?.clinicName, doctor?.city].filter(Boolean).join(' • ') ||
                'Clinical practitioner'}
            </p>
            {doctor?.registrationNumber && (
              <p className="text-[11px] text-slate-400">License: {doctor.registrationNumber}</p>
            )}

            {consent.purpose && (
              <div className="mt-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-400">Purpose: </span>
                {consent.purpose}
              </div>
            )}

            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
              <span>Requested {relativeTime(consent.createdAt)}</span>
              {consent.active && <span className="font-semibold text-emerald-600 dark:text-emerald-400">Access valid until {formatDateTime(consent.expiresAt)}</span>}
              {consent.lastAccessedAt && (
                <span>
                  Last opened {relativeTime(consent.lastAccessedAt)} ({consent.accessCount} view{consent.accessCount === 1 ? '' : 's'})
                </span>
              )}
              {consent.revokedAt && <span className="text-rose-500">Revoked {relativeTime(consent.revokedAt)}</span>}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {consent.status === 'PENDING' && (
            <>
              <Select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                aria-label="Access period"
                className="w-auto py-1.5 text-xs font-medium"
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
                Approve Access
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
              Revoke Access
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
      setNotice(response?.message ?? 'Consent successfully updated.');
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
      setNotice(response?.message ?? 'Access granted successfully.');
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
      setNotice('That share code has been revoked and can no longer be used.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'The share code could not be revoked.'));
    }
  };

  const rotateCode = async () => {
    try {
      const next = await usersApi.rotateShareCode();
      setProfile((current) => (current ? { ...current, shareCode: next } : current));
      setNotice('A new permanent share code has been generated. The previous one is invalidated.');
    } catch (err) {
      setError(apiErrorMessage(err, 'A new share code could not be issued.'));
    }
  };

  if (loading) {
    return (
      <AppShell>
        <PageLoader label="Loading consent vault and sharing controls…" />
      </AppShell>
    );
  }

  const active = consents.filter((c) => c.active);
  const pending = consents.filter((c) => c.status === 'PENDING');
  const past = consents.filter((c) => !c.active && c.status !== 'PENDING');

  return (
    <AppShell>
      <PageHeader
        title="Consent & Data Sharing Vault"
        description="Explicit, revocable cryptographic access control. You decide which clinicians can inspect your records and for how long."
        actions={
          <Button onClick={() => setGranting(true)}>
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Grant Doctor Access
          </Button>
        }
      />

      {error && <Alert tone="error" className="mb-4" onDismiss={() => setError('')}>{error}</Alert>}
      {notice && <Alert tone="success" className="mb-4" onDismiss={() => setNotice('')}>{notice}</Alert>}

      <Tabs<TabKey>
        value={tab}
        onChange={setTab}
        className="mb-6"
        tabs={[
          { value: 'access', label: 'Active Clinicians', count: active.length },
          { value: 'requests', label: 'Pending Requests', count: pending.length },
          { value: 'qr', label: 'In-Person QR Share' },
          { value: 'history', label: 'Access Audit History', count: past.length },
        ]}
      />

      {/* Tab: Active Clinicians */}
      {tab === 'access' && (
        <Panel className="overflow-hidden shadow-xs">
          <PanelHeader
            title="Clinicians with Current Active Access"
            description="These verified doctors currently hold time-limited read permission to your records"
            icon={ShieldCheck}
          />
          {active.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title="Your Records are 100% Private"
              description="No clinician holds access to your records right now. When you visit a clinic or hospital, you can grant time-limited access."
              action={
                <Button onClick={() => setGranting(true)}>
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  Grant access to a clinician
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {active.map((consent) => (
                <ConsentRow key={consent.id} consent={consent} onDecide={decide} busyId={busyId} />
              ))}
            </ul>
          )}
        </Panel>
      )}

      {/* Tab: Pending Requests */}
      {tab === 'requests' && (
        <div className="space-y-6">
          <Panel className="overflow-hidden shadow-xs">
            <PanelHeader
              title="Incoming Access Requests"
              description="Doctor requests requiring your explicit consent before records are released"
              icon={Clock}
            />
            {pending.length === 0 ? (
              <EmptyState
                compact
                icon={Clock}
                title="No Pending Access Requests"
                description="When a healthcare provider looks up your share code, their request will appear here for you to accept or decline."
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {pending.map((consent) => (
                  <ConsentRow key={consent.id} consent={consent} onDecide={decide} busyId={busyId} />
                ))}
              </ul>
            )}
          </Panel>

          {profile?.shareCode && (
            <Panel className="overflow-hidden shadow-xs">
              <PanelHeader title="Your Permanent Share Code" icon={Lock} />
              <div className="space-y-4 p-5 sm:p-6">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
                  Provide this code to a clinic receptionist or doctor so they can send an access request. It references your records safely without ever revealing your personal email address.
                </p>
                <div className="max-w-md">
                  <CopyField value={profile.shareCode} label="Patient Share Code" />
                </div>
                <div>
                  <Button variant="secondary" size="sm" onClick={rotateCode}>
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Issue new share code
                  </Button>
                </div>
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* Tab: QR Share */}
      {tab === 'qr' && (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Panel className="overflow-hidden shadow-xs">
            <PanelHeader title="Generate In-Person QR Code" description="Instant single-use scan token" icon={QrCode} />
            <div className="space-y-5 p-5 sm:p-6">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Generate an ephemeral cryptographic token for a doctor to scan during an in-person consultation. The QR code contains no plaintext medical data and expires automatically.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="QR scan expires in" htmlFor="qr-minutes">
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
                <Field label="Grants doctor access for" htmlFor="qr-duration">
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

              <Button onClick={createQr} loading={qrBusy} className="w-full py-2.5">
                <QrCode className="h-4 w-4" aria-hidden="true" />
                Generate Single-Use QR Token
              </Button>

              {qr && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-6 text-center shadow-xs">
                  <img
                    src={qr.qrDataUrl}
                    alt="QR code containing a single-use share token"
                    className="mx-auto h-52 w-52 rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-3 shadow-md"
                  />
                  <p className="mt-4 text-sm font-bold text-slate-900 dark:text-white">
                    Scan to Redeem Access
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Expires {formatDateTime(qr.session.expiresAt)} • Grants {qr.session.grantDurationHrs}h access
                  </p>
                  <div className="mt-4 text-left max-w-sm mx-auto">
                    <CopyField value={qr.session.token} label="Direct Access Token" />
                  </div>
                  <div className="mt-4">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => revokeSession(qr.session.id)}
                    >
                      Revoke QR Code
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Panel>

          {/* Recent share codes */}
          <Panel className="overflow-hidden shadow-xs">
            <PanelHeader title="Active & Recent QR Sessions" icon={History} />
            {sessions.length === 0 ? (
              <EmptyState compact icon={QrCode} title="No Recent QR Sessions" />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {sessions.map((session) => (
                  <li key={session.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge kind="share" status={session.status} />
                        <span className="text-xs text-slate-400">
                          {relativeTime(session.createdAt)}
                        </span>
                      </div>
                      {session.claimedBy && (
                        <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Redeemed by {session.claimedBy.name} {relativeTime(session.claimedAt!)}
                        </p>
                      )}
                    </div>
                    {session.status === 'ACTIVE' && (
                      <Button size="sm" variant="ghost" onClick={() => revokeSession(session.id)}>
                        Revoke
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {/* Tab: History */}
      {tab === 'history' && (
        <Panel className="overflow-hidden shadow-xs">
          <PanelHeader title="Expired & Revoked Access History" icon={ShieldX} />
          {past.length === 0 ? (
            <EmptyState
              compact
              icon={ShieldX}
              title="No Past Consents"
              description="Historical expired, declined, and revoked access sessions will be recorded here for compliance."
            />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {past.map((consent) => (
                <ConsentRow key={consent.id} consent={consent} onDecide={decide} busyId={busyId} />
              ))}
            </ul>
          )}
        </Panel>
      )}

      {/* Grant Access Modal */}
      <Modal
        open={granting}
        onClose={() => setGranting(false)}
        title="Direct Clinician Consent Grant"
        description="Search for a verified clinician to grant time-limited read permission to your records."
        footer={
          <>
            <Button variant="secondary" onClick={() => setGranting(false)}>
              Cancel
            </Button>
            <Button onClick={grant} loading={grantBusy} disabled={!chosen}>
              Grant Access
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Search verified clinician" htmlFor="doctor-search">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <Input
                id="doctor-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by clinician name, clinic, or city…"
                className="pl-10"
              />
            </div>
          </Field>

          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {directory.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                No clinicians matching that query.
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
                    className={`w-full rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                      selected
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 ring-1 ring-sky-500'
                        : alreadyActive
                          ? 'cursor-not-allowed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 opacity-60'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {doctor.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {[doctor.specialization, doctor.clinicName, doctor.city]
                            .filter(Boolean)
                            .join(' • ') || 'Verified doctor'}
                        </p>
                      </div>
                      {alreadyActive && (
                        <Badge tone="success">Already Active</Badge>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <Field label="Access duration" htmlFor="grant-duration">
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
