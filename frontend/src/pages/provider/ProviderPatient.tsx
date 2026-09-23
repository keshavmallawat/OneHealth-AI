import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Clock, Download, Eye, FileText, HeartPulse, Users,
} from 'lucide-react';
import { consentApi } from '../../services/consentApi';
import type { PatientDetail } from '../../services/consentApi';
import api, { apiErrorMessage } from '../../services/apiClient';
import { formatDate, formatDateTime } from '../../lib/format';
import AppShell from '../../components/AppShell';
import ReportList from '../../components/ReportList';
import {
  Alert, Avatar, Badge, Button, DefinitionList, NotProvided, Panel, PanelHeader, PageHeader,
  PageLoader, StatTile,
} from '../../components/ui';

const ProviderPatient: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

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
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      setError(apiErrorMessage(err, 'The summary could not be downloaded.'));
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <PageLoader label="Loading patient record" />
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell>
        <Alert tone="error" title="Record unavailable">
          {error || 'This patient has not granted you access, or the access has ended.'}
        </Alert>
        <Link
          to="/provider"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
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
      <PageHeader
        breadcrumb={
          <Link
            to="/provider"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            My patients
          </Link>
        }
        title={patient.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone="primary">
              <Eye className="h-3 w-3" aria-hidden="true" />
              Read-only
            </Badge>
            {access.expiresAt && (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Access ends {formatDateTime(access.expiresAt)}
              </span>
            )}
          </span>
        }
        actions={
          <Button variant="secondary" onClick={exportSummary} loading={exporting}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export summary
          </Button>
        }
      />

      <Alert tone="info" className="mb-5">
        You are viewing this record under a consent this patient granted. It is read-only, and every
        record you open is written to the patient’s own access history.
      </Alert>

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Records shared" value={records.length} icon={FileText} />
        <StatTile label="Analysed" value={analysed.length} icon={HeartPulse} />
        <StatTile
          label="Flagged values"
          value={flagged}
          hint="across all shared records"
          icon={AlertTriangle}
          tone={flagged > 0 ? 'alert' : 'default'}
        />
        <StatTile
          label="Latest record"
          value={
            records[0] ? formatDate(records[0].reportDate ?? records[0].uploadedAt) : '—'
          }
          icon={Clock}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        <Panel className="min-w-0 lg:col-span-2">
          <PanelHeader title="Shared records" icon={FileText} />
          <ReportList
            records={records}
            emptyTitle="No records shared"
            emptyDescription="This patient has granted access but has no records on file yet."
          />
        </Panel>

        <div className="min-w-0 space-y-5">
          <Panel>
            <PanelHeader title="Patient summary" icon={Users} />
            <div className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <Avatar name={patient.name} className="h-10 w-10 text-sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{patient.name}</p>
                  <p className="text-xs text-muted">
                    {age !== null ? `${age} years` : 'Age not recorded'}
                    {patient.sex ? ` · ${patient.sex.replace(/_/g, ' ')}` : ''}
                  </p>
                </div>
              </div>

              <DefinitionList
                columns={1}
                items={[
                  { label: 'Blood type', value: patient.bloodType || <NotProvided /> },
                  {
                    label: 'Known allergies',
                    value:
                      patient.allergies.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {patient.allergies.map((allergy) => (
                            <Badge key={allergy} tone="warning">
                              {allergy}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        <NotProvided />
                      ),
                  },
                  {
                    label: 'Ongoing conditions',
                    value:
                      patient.chronicConditions.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {patient.chronicConditions.map((condition) => (
                            <Badge key={condition}>{condition}</Badge>
                          ))}
                        </span>
                      ) : (
                        <NotProvided />
                      ),
                  },
                  { label: 'ABHA ID', value: patient.abhaId || <NotProvided /> },
                  { label: 'Contact', value: patient.email || <NotProvided /> },
                  {
                    label: 'Emergency contact',
                    value: patient.emergencyName ? (
                      <>
                        {patient.emergencyName}
                        {patient.emergencyPhone ? ` — ${patient.emergencyPhone}` : ''}
                      </>
                    ) : (
                      <NotProvided />
                    ),
                  },
                ]}
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Your access" />
            <div className="p-5">
              <DefinitionList
                columns={1}
                items={[
                  {
                    label: 'Scope granted',
                    value: (
                      <span className="flex flex-wrap gap-1">
                        {access.scope.map((scope) => (
                          <Badge key={scope}>{scope.toLowerCase()}</Badge>
                        ))}
                      </span>
                    ),
                  },
                  {
                    label: 'Expires',
                    value: access.expiresAt ? formatDateTime(access.expiresAt) : <NotProvided />,
                  },
                  { label: 'Permission', value: 'Read-only. You cannot edit or delete anything.' },
                ]}
              />
              <p className="mt-4 text-xs leading-relaxed text-muted">
                The patient can end this access at any moment, and it also ends automatically at the
                expiry above.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
};

export default ProviderPatient;
