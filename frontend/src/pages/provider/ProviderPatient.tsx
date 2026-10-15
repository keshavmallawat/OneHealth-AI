import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Download,
  Eye,
  FileText,
  HeartPulse,
  Users,
  ShieldCheck,
  Phone,
  Droplet,
  Calendar,
  Building,
  Heart,
  FileCheck2,
} from 'lucide-react';
import { consentApi } from '../../services/consentApi';
import type { PatientDetail } from '../../services/consentApi';
import api, { apiErrorMessage } from '../../services/apiClient';
import { formatDate, formatDateTime } from '../../lib/format';
import AppShell from '../../components/AppShell';
import ReportList from '../../components/ReportList';
import { useToast } from '../../context/ToastContext';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  DefinitionList,
  NotProvided,
  Panel,
  PanelHeader,
  PageHeader,
  PageLoader,
  StatTile,
} from '../../components/ui';

const ProviderPatient: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    if (!patientId) return;
    try {
      setDetail(await consentApi.patientDetail(patientId));
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'You do not have access to this patient record.'));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const exportSummary = async () => {
    if (!patientId) return;
    setExporting(true);
    try {
      const response = await api.get(`/records/patients/${patientId}/summary.pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `OneHealth-Summary-${detail?.patient.name ?? 'patient'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Clinical Summary Exported', 'Downloaded comprehensive patient record summary PDF');
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      const msg = apiErrorMessage(err, 'The summary could not be downloaded.');
      setError(msg);
      toast.error('Export failed', msg);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <PageLoader label="Retrieving encrypted patient record and biomarkers" />
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell>
        <Alert tone="error" title="Record unavailable">
          {error || 'This patient has not granted you access, or the consent period has expired.'}
        </Alert>
        <Link
          to="/provider"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 dark:text-teal-400 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to my patients
        </Link>
      </AppShell>
    );
  }

  const { patient, records, access } = detail;
  const analysed = records.filter((r) => r.status === 'DONE');
  const flagged = analysed.reduce((sum, r) => sum + r.abnormalCount, 0);
  const age = patient.dateOfBirth
    ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 31_557_600_000)
    : null;

  return (
    <AppShell>
      {/* Patient Dossier Header Banner */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-900 via-teal-950 to-indigo-950 p-6 sm:p-8 text-white shadow-xl shadow-slate-950/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_20%_20%,rgba(20,184,166,0.18),transparent)] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4 sm:gap-5">
            <Avatar
              name={patient.name}
              className="h-16 w-16 sm:h-20 sm:w-20 text-2xl font-bold rounded-2xl ring-4 ring-white/10 shrink-0"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  {patient.name}
                </h1>
                <Badge tone="primary" className="bg-teal-500/20 text-teal-300 border-teal-400/30">
                  <Eye className="h-3 w-3 mr-1" /> Read-Only Access
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300">
                {age !== null && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-teal-400" />
                    {age} yrs {patient.sex ? `(${patient.sex.replace(/_/g, ' ')})` : ''}
                  </span>
                )}
                {patient.bloodType && (
                  <span className="flex items-center gap-1.5">
                    <Droplet className="h-3.5 w-3.5 text-rose-400 fill-rose-400" />
                    Blood {patient.bloodType}
                  </span>
                )}
                {patient.abhaId && (
                  <span className="flex items-center gap-1.5 font-mono text-xs text-indigo-300">
                    <FileCheck2 className="h-3.5 w-3.5" />
                    ABHA: {patient.abhaId}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/provider"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Patient Registry
            </Link>
            <Button
              variant="primary"
              onClick={exportSummary}
              loading={exporting}
              className="shadow-lg shadow-teal-500/20"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export Clinical PDF
            </Button>
          </div>
        </div>
      </div>

      <PageHeader
        title="Electronic Health Record"
        description={
          access.expiresAt
            ? `Cryptographic consent verified. This session expires on ${formatDateTime(access.expiresAt)}.`
            : 'Authorized patient chart.'
        }
      />

      {/* Audit Reassurance Alert */}
      <div className="mb-6 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/70 dark:bg-teal-950/30 p-3.5 flex items-center justify-between gap-4 text-xs text-teal-900 dark:text-teal-200">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <span>
            Strict zero-trust consent: Every diagnostic view or PDF export is logged directly to {patient.name}’s immutable audit trail.
          </span>
        </div>
        <span className="font-semibold text-teal-700 dark:text-teal-300 shrink-0 hidden sm:inline">
          HIPAA & ABDM Compliant
        </span>
      </div>

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      {/* Metrics Row */}
      <div className="mb-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatTile
          label="Shared Records"
          value={records.length}
          hint="Laboratory panels & scans"
          icon={FileText}
        />
        <StatTile
          label="AI Analysed"
          value={analysed.length}
          hint="Biomarkers parsed"
          icon={HeartPulse}
        />
        <StatTile
          label="Flagged Values"
          value={flagged}
          hint="Out of standard reference ranges"
          icon={AlertTriangle}
          tone={flagged > 0 ? 'alert' : 'default'}
        />
        <StatTile
          label="Latest Upload"
          value={
            records[0] ? formatDate(records[0].reportDate ?? records[0].uploadedAt) : 'None'
          }
          hint="Most recent diagnostic date"
          icon={Clock}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {/* Left 2 Cols: Shared Records */}
        <Panel className="min-w-0 lg:col-span-2">
          <PanelHeader
            title={`Diagnostic Records (${records.length})`}
            description="All diagnostic documents and blood panels shared with your clinician profile"
            icon={FileText}
          />
          <ReportList
            records={records}
            emptyTitle="No records shared yet"
            emptyDescription="This patient has granted access but has not yet uploaded diagnostic files to their repository."
          />
        </Panel>

        {/* Right Col: Patient Summary Dossier & Scope */}
        <div className="min-w-0 space-y-6">
          <Panel>
            <PanelHeader title="Patient Medical Summary" icon={Users} />
            <div className="p-5 space-y-5">
              {/* Emergency Contact Card */}
              {patient.emergencyName && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 p-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-800 dark:text-rose-300 mb-1">
                    <Phone className="h-3.5 w-3.5 text-rose-500" />
                    Emergency Contact
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {patient.emergencyName}
                  </p>
                  {patient.emergencyPhone && (
                    <p className="text-xs text-rose-700 dark:text-rose-400 font-mono mt-0.5">
                      {patient.emergencyPhone}
                    </p>
                  )}
                </div>
              )}

              {/* Allergies Highlight */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Known Allergies
                </p>
                {patient.allergies.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {patient.allergies.map((allergy) => (
                      <span
                        key={allergy}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300"
                      >
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        {allergy}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">No drug or food allergies on file</span>
                )}
              </div>

              {/* Chronic Conditions */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Chronic Conditions
                </p>
                {patient.chronicConditions.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {patient.chronicConditions.map((condition) => (
                      <span
                        key={condition}
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-200 dark:border-sky-900/60 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 text-xs font-medium text-sky-800 dark:text-sky-300"
                      >
                        <Heart className="h-3 w-3 text-sky-500" />
                        {condition}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">No chronic diagnoses documented</span>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <DefinitionList
                  columns={1}
                  items={[
                    { label: 'Biological Sex', value: patient.sex ? patient.sex.replace(/_/g, ' ') : <NotProvided /> },
                    { label: 'Date of Birth', value: patient.dateOfBirth ? formatDate(patient.dateOfBirth) : <NotProvided /> },
                    { label: 'Blood Group', value: patient.bloodType || <NotProvided /> },
                    { label: 'ABHA Number', value: patient.abhaId || <NotProvided /> },
                  ]}
                />
              </div>
            </div>
          </Panel>

          {/* Clinician Access Scope Panel */}
          <Panel>
            <PanelHeader title="Active Authorization Scope" icon={Building} />
            <div className="p-5 space-y-4 text-xs">
              <div>
                <p className="text-slate-500 font-medium mb-1.5">Permitted Scopes:</p>
                <div className="flex flex-wrap gap-1.5">
                  {access.scope.map((scope) => (
                    <Badge key={scope} tone="primary">
                      {scope.toLowerCase()}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-slate-500 font-medium mb-1">Session Expiration:</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {access.expiresAt ? formatDateTime(access.expiresAt) : 'Revocable at any time'}
                </p>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                Data access is strictly non-destructive. You may view and analyze trends, but cannot delete or alter patient records.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
};

export default ProviderPatient;
