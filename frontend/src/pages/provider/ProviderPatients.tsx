import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  FileText,
  QrCode,
  Users,
  Search,
  ChevronRight,
  Droplet,
  ShieldAlert,
  Calendar,
  Activity,
} from 'lucide-react';
import { consentApi } from '../../services/consentApi';
import type { AuthorisedPatient, Consent } from '../../services/consentApi';
import { apiErrorMessage } from '../../services/apiClient';
import { formatDateTime, relativeTime } from '../../lib/format';
import AppShell from '../../components/AppShell';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelHeader,
  PageHeader,
  PageLoader,
  StatTile,
  Input,
} from '../../components/ui';

const ProviderPatients: React.FC = () => {
  const [patients, setPatients] = useState<AuthorisedPatient[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyAbnormal, setOnlyAbnormal] = useState(false);

  const load = useCallback(async () => {
    try {
      const [patientData, consentData] = await Promise.all([
        consentApi.patients(),
        consentApi.list(),
      ]);
      setPatients(patientData);
      setConsents(consentData.consents);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'We could not load your authorized patients.'));
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
        <PageLoader label="Loading patient directory and active consents" />
      </AppShell>
    );
  }

  const pending = consents.filter((c) => c.status === 'PENDING');
  const flaggedTotal = patients.reduce((sum, p) => sum + p.abnormalTotal, 0);
  const recordsTotal = patients.reduce((sum, p) => sum + p.recordCount, 0);

  const filteredPatients = patients.filter((entry) => {
    const matchesSearch =
      entry.patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.patient.bloodType && entry.patient.bloodType.toLowerCase().includes(searchQuery.toLowerCase())) ||
      entry.patient.allergies.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesAbnormal = onlyAbnormal ? entry.abnormalTotal > 0 : true;
    return matchesSearch && matchesAbnormal;
  });

  return (
    <AppShell>
      {/* Clinician Overview Banner */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-indigo-950 via-slate-900 to-teal-950 p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_80%_20%,rgba(14,165,233,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-3">
              <Activity className="h-3.5 w-3.5" />
              Clinician Diagnostic Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              Authorized Patient Registry
            </h1>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              Real-time patient charts shared under cryptographic consent. Access is time-bound, strictly read-only, and fully audited.
            </p>
          </div>
          <Link to="/provider/connect">
            <Button size="lg" className="shadow-lg shadow-teal-500/20 font-medium">
              <QrCode className="h-4 w-4" aria-hidden="true" />
              Connect New Patient
            </Button>
          </Link>
        </div>
      </div>

      <PageHeader
        title="Patient Directory"
        description="Patients who have actively shared their longitudinal medical history with your clinical account."
        actions={
          <div className="flex items-center gap-2">
            <Link to="/provider/requests">
              <Button variant="secondary" size="sm">
                <Clock className="h-4 w-4" aria-hidden="true" />
                Requests ({pending.length})
              </Button>
            </Link>
            <Link to="/provider/connect">
              <Button size="sm">
                <QrCode className="h-4 w-4" aria-hidden="true" />
                Scan QR Token
              </Button>
            </Link>
          </div>
        }
      />

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      {/* Metrics Row */}
      <div className="mb-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatTile
          label="Active Patients"
          value={patients.length}
          hint="Consents active right now"
          icon={Users}
        />
        <StatTile
          label="Shared Records"
          value={recordsTotal}
          hint="PDF reports & biometric panels"
          icon={FileText}
        />
        <StatTile
          label="Flagged Biomarkers"
          value={flaggedTotal}
          hint="Out-of-range clinical values"
          icon={AlertTriangle}
          tone={flaggedTotal > 0 ? 'alert' : 'default'}
        />
        <StatTile
          label="Awaiting Approval"
          value={pending.length}
          hint="Pending patient action"
          icon={Clock}
        />
      </div>

      {/* Search and Filters */}
      <div className="mb-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by patient name, blood type, or allergy..."
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={onlyAbnormal ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setOnlyAbnormal(!onlyAbnormal)}
          >
            <ShieldAlert className="h-3.5 w-3.5 mr-1" />
            {onlyAbnormal ? 'Showing Flagged Only' : 'Filter Out-of-Range'}
          </Button>
        </div>
      </div>

      {/* Patient List */}
      <Panel>
        <PanelHeader
          title={`Active Patient Charts (${filteredPatients.length})`}
          description="Click any patient to inspect diagnostic trends, range meter diffs, and generate clinical PDF summaries"
          icon={Users}
        />
        {filteredPatients.length === 0 ? (
          <EmptyState
            icon={Users}
            title={patients.length === 0 ? 'No patients connected yet' : 'No matching patients found'}
            description={
              patients.length === 0
                ? 'Ask a patient to show their OneHealth QR code, or send an access request using their unique share code.'
                : 'Try adjusting your search query or clear the out-of-range filter.'
            }
            action={
              patients.length === 0 ? (
                <Link to="/provider/connect">
                  <Button>
                    <QrCode className="h-4 w-4" aria-hidden="true" />
                    Connect a patient
                  </Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredPatients.map((entry) => (
              <li key={entry.consentId} className="group">
                <Link
                  to={`/provider/patients/${entry.patient.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 transition-all hover:bg-slate-50/80 dark:hover:bg-slate-900/60"
                >
                  <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                    <Avatar
                      name={entry.patient.name}
                      className="h-12 w-12 text-sm shrink-0 ring-2 ring-slate-200 dark:ring-slate-700"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5 mb-1">
                        <span className="font-bold text-base text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                          {entry.patient.name}
                        </span>
                        {entry.patient.bloodType && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                            <Droplet className="h-3 w-3 fill-rose-500 text-rose-500" />
                            {entry.patient.bloodType}
                          </span>
                        )}
                        {entry.abnormalTotal > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                            {entry.abnormalTotal} Flagged Values
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            All Normal
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5 text-slate-400" />
                          {entry.recordCount} diagnostic record{entry.recordCount === 1 ? '' : 's'}
                        </span>
                        {entry.lastUploadAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            Latest: {relativeTime(entry.lastUploadAt)}
                          </span>
                        )}
                      </div>

                      {entry.patient.allergies.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-medium text-slate-400">Allergies:</span>
                          {entry.patient.allergies.map((allergy) => (
                            <Badge key={allergy} tone="warning" className="text-[10px] py-0 px-1.5">
                              {allergy}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-left sm:text-right">
                      <p className="text-[11px] text-slate-400 font-medium">Consent Active Until</p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {formatDateTime(entry.expiresAt)}
                      </p>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-teal-500 group-hover:text-white transition-all shadow-xs">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
};

export default ProviderPatients;
