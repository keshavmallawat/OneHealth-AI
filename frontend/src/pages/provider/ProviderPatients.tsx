import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, FileText, QrCode, Users } from 'lucide-react';
import { consentApi } from '../../services/consentApi';
import type { AuthorisedPatient, Consent } from '../../services/consentApi';
import { apiErrorMessage } from '../../services/apiClient';
import { formatDateTime, relativeTime } from '../../lib/format';
import AppShell from '../../components/AppShell';
import {
  Alert, Avatar, Badge, Button, EmptyState, Panel, PanelHeader, PageHeader, PageLoader, StatTile,
} from '../../components/ui';

const ProviderPatients: React.FC = () => {
  const [patients, setPatients] = useState<AuthorisedPatient[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      setError(apiErrorMessage(err, 'We could not load your patients.'));
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
        <PageLoader label="Loading your patients" />
      </AppShell>
    );
  }

  const pending = consents.filter((c) => c.status === 'PENDING');
  const flaggedTotal = patients.reduce((sum, p) => sum + p.abnormalTotal, 0);

  return (
    <AppShell>
      <PageHeader
        title="My patients"
        description="Patients who have granted you read-only access to their health record."
        actions={
          <Link to="/provider/connect">
            <Button>
              <QrCode className="h-4 w-4" aria-hidden="true" />
              Connect a patient
            </Button>
          </Link>
        }
      />

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active patients" value={patients.length} icon={Users} />
        <StatTile
          label="Records available"
          value={patients.reduce((sum, p) => sum + p.recordCount, 0)}
          icon={FileText}
        />
        <StatTile
          label="Flagged values"
          value={flaggedTotal}
          hint="across all shared records"
          icon={AlertTriangle}
          tone={flaggedTotal > 0 ? 'alert' : 'default'}
        />
        <StatTile
          label="Requests pending"
          value={pending.length}
          hint="awaiting patient approval"
          icon={Clock}
        />
      </div>

      <Panel>
        <PanelHeader title="Authorised patients" icon={Users} />
        {patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No patients have shared with you yet"
            description="Ask a patient for their OneHealth share code, or scan the QR code they generate in their app."
            action={
              <Link to="/provider/connect">
                <Button>
                  <QrCode className="h-4 w-4" aria-hidden="true" />
                  Connect a patient
                </Button>
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {patients.map((entry) => (
              <li key={entry.consentId}>
                <Link
                  to={`/provider/patients/${entry.patient.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-sunken"
                >
                  <Avatar name={entry.patient.name} className="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{entry.patient.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {entry.recordCount} record{entry.recordCount === 1 ? '' : 's'}
                      {entry.lastUploadAt ? ` · last upload ${relativeTime(entry.lastUploadAt)}` : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {entry.patient.bloodType && <Badge>Blood {entry.patient.bloodType}</Badge>}
                      {entry.patient.allergies.slice(0, 2).map((allergy) => (
                        <Badge key={allergy} tone="warning">
                          {allergy}
                        </Badge>
                      ))}
                      {entry.abnormalTotal > 0 && (
                        <Badge tone="danger">{entry.abnormalTotal} flagged values</Badge>
                      )}
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-xs text-muted">Access ends</p>
                    <p className="text-[13px] text-ink">{formatDateTime(entry.expiresAt)}</p>
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
