import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { KeyRound, QrCode, Send, ShieldCheck } from 'lucide-react';
import { consentApi } from '../../services/consentApi';
import { shareApi } from '../../services/shareApi';
import { apiErrorMessage } from '../../services/apiClient';
import AppShell from '../../components/AppShell';
import {
  Alert, Button, Field, Input, Panel, PanelHeader, PageHeader, Textarea,
} from '../../components/ui';

/**
 * Two ways to reach a patient, both patient-initiated:
 *   1. Redeem a QR/share token the patient generated — immediate access.
 *   2. Ask, using the patient's share code — access only after they approve.
 */
const ProviderConnect: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ token?: string }>();

  const [token, setToken] = useState(params.token ?? '');
  const [shareCode, setShareCode] = useState('');
  const [purpose, setPurpose] = useState('');
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const redeem = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setRedeemBusy(true);
    try {
      const response = await shareApi.redeem(token.trim());
      setNotice(response?.message ?? 'Access granted.');
      const patientId = response?.data?.patient?.id;
      if (patientId) setTimeout(() => navigate(`/provider/patients/${patientId}`), 700);
    } catch (err) {
      setError(apiErrorMessage(err, 'That share code could not be redeemed.'));
    } finally {
      setRedeemBusy(false);
    }
  };

  const request = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setRequestBusy(true);
    try {
      const response = await consentApi.request({
        shareCode: shareCode.trim(),
        purpose: purpose.trim() || undefined,
      });
      setNotice(response?.message ?? 'Request sent.');
      setShareCode('');
      setPurpose('');
    } catch (err) {
      setError(apiErrorMessage(err, 'That request could not be sent.'));
    } finally {
      setRequestBusy(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Connect a patient"
        description="A patient must invite you. You cannot search for patients, and nothing is visible to you until they agree."
      />

      {error && <Alert tone="error" className="mb-4" onDismiss={() => setError('')}>{error}</Alert>}
      {notice && <Alert tone="success" className="mb-4" onDismiss={() => setNotice('')}>{notice}</Alert>}

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Panel>
          <PanelHeader title="Redeem a share code" icon={QrCode} />
          <form onSubmit={redeem} className="space-y-4 p-5">
            <p className="text-sm text-ink-soft">
              The patient generates a single-use code in their app and shows it to you. Entering it
              here grants read-only access immediately — creating the code was their act of consent.
            </p>
            <Field
              label="Share token"
              htmlFor="share-token"
              hint="Scan the patient's QR code, or type the token shown beneath it."
            >
              <Input
                id="share-token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste or scan the token"
                required
              />
            </Field>
            <Button type="submit" loading={redeemBusy} disabled={!token.trim()} className="w-full">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Redeem and open record
            </Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader title="Request access by share code" icon={KeyRound} />
          <form onSubmit={request} className="space-y-4 p-5">
            <p className="text-sm text-ink-soft">
              If the patient is not with you, ask for their OneHealth share code. They will see your
              request in their app and decide whether to approve it, and for how long.
            </p>
            <Field
              label="Patient share code"
              htmlFor="patient-code"
              hint="Looks like OH-ABC-DEF-GHJ. It is not their email address."
            >
              <Input
                id="patient-code"
                value={shareCode}
                onChange={(e) => setShareCode(e.target.value.toUpperCase())}
                placeholder="OH-ABC-DEF-GHJ"
                required
              />
            </Field>
            <Field
              label="Reason for the request"
              htmlFor="purpose"
              hint="Shown to the patient. Optional, but it helps them decide."
            >
              <Textarea
                id="purpose"
                rows={3}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Reviewing recent blood work ahead of a follow-up consultation."
                maxLength={200}
              />
            </Field>
            <Button
              type="submit"
              variant="secondary"
              loading={requestBusy}
              disabled={!shareCode.trim()}
              className="w-full"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Send request
            </Button>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
};

export default ProviderConnect;
