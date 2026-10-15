import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { KeyRound, QrCode, ShieldCheck, ArrowRight, Sparkles, Send } from 'lucide-react';
import { consentApi } from '../../services/consentApi';
import { shareApi } from '../../services/shareApi';
import { apiErrorMessage } from '../../services/apiClient';
import AppShell from '../../components/AppShell';
import { useToast } from '../../context/ToastContext';
import {
  Alert, Button, Field, Input, Panel, PanelHeader, PageHeader, Textarea,
} from '../../components/ui';

/**
 * Two ways to connect a patient, both patient-initiated:
 *   1. Redeem an in-person QR / share token the patient generated — immediate access.
 *   2. Request access using the patient's share code — access granted once patient approves.
 */
const ProviderConnect: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ token?: string }>();
  const toast = useToast();

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
      const msg = response?.message ?? 'Access granted successfully.';
      setNotice(msg);
      toast.success('Patient Record Unlocked', msg);
      const patientId = response?.data?.patient?.id;
      if (patientId) {
        setTimeout(() => navigate(`/provider/patients/${patientId}`), 600);
      }
    } catch (err) {
      const msg = apiErrorMessage(err, 'That share code could not be redeemed or has expired.');
      setError(msg);
      toast.error('Redeem Failed', msg);
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
      const msg = response?.message ?? 'Access request sent to patient.';
      setNotice(msg);
      toast.success('Request Dispatched', 'Patient will receive notification in their OneHealth app');
      setShareCode('');
      setPurpose('');
    } catch (err) {
      const msg = apiErrorMessage(err, 'That request could not be sent.');
      setError(msg);
      toast.error('Request Failed', msg);
    } finally {
      setRequestBusy(false);
    }
  };

  return (
    <AppShell>
      {/* Header Banner */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-teal-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl shadow-teal-950/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_80%_20%,rgba(20,184,166,0.18),transparent)] pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-semibold mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            Zero-Trust Consent Architecture
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Establish Patient Connection
          </h1>
          <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
            In compliance with medical data privacy, clinicians cannot browse unshared directories. Choose an in-person instantaneous QR scan or send an explicit access request.
          </p>
        </div>
      </div>

      <PageHeader
        title="Connect a Patient"
        description="Verify and decrypt patient diagnostic records through patient-authorized tokens."
      />

      {error && <Alert tone="error" className="mb-5" onDismiss={() => setError('')}>{error}</Alert>}
      {notice && <Alert tone="success" className="mb-5" onDismiss={() => setNotice('')}>{notice}</Alert>}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Method 1: Instant QR / Token Redeem */}
        <Panel className="border-teal-200/60 dark:border-teal-900/40">
          <PanelHeader
            title="Method 1: Instant Token / QR Scan"
            description="Immediate read-only access for in-clinic consultations"
            icon={QrCode}
          />
          <form onSubmit={redeem} className="space-y-5 p-5 sm:p-6">
            <div className="rounded-xl border border-teal-100 dark:border-teal-900/40 bg-teal-50/50 dark:bg-teal-950/20 p-3.5 text-xs text-teal-800 dark:text-teal-300 leading-relaxed">
              When a patient generates a temporary QR code or token on their phone, scanning it or pasting the token here grants instant decryption without awaiting manual confirmation.
            </div>

            <Field
              label="Ephemeral Share Token"
              htmlFor="share-token"
              hint="Paste the alphanumeric token or scan with your barcode/webcam reader"
              required
            >
              <Input
                id="share-token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="e.g. 64-character encrypted token"
                required
                className="font-mono text-xs"
              />
            </Field>

            <Button
              type="submit"
              loading={redeemBusy}
              disabled={!token.trim()}
              className="w-full justify-center shadow-md shadow-teal-500/20"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Redeem Token & Open Chart
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </form>
        </Panel>

        {/* Method 2: Share Code Request */}
        <Panel className="border-indigo-200/60 dark:border-indigo-900/40">
          <PanelHeader
            title="Method 2: Request by Patient Share Code"
            description="For remote or scheduled follow-ups awaiting patient approval"
            icon={KeyRound}
          />
          <form onSubmit={request} className="space-y-5 p-5 sm:p-6">
            <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
              Ask your patient for their OneHealth Share Code (e.g. <span className="font-mono font-semibold">OH-ABC-DEF</span>). The patient will receive a prompt in their dashboard to approve access and set the duration.
            </div>

            <Field
              label="Patient Share Code"
              htmlFor="patient-code"
              hint="Format: OH-XXXX-XXXX. Completely protects patient's email."
              required
            >
              <Input
                id="patient-code"
                value={shareCode}
                onChange={(e) => setShareCode(e.target.value.toUpperCase())}
                placeholder="OH-ABC-DEF-GHJ"
                required
                className="font-mono tracking-wider font-semibold uppercase"
              />
            </Field>

            <Field
              label="Clinical Purpose / Consultation Note"
              htmlFor="purpose"
              hint="Shown to the patient so they can verify clinical intent"
            >
              <Textarea
                id="purpose"
                rows={3}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Pre-consultation review of latest lipid profile and fasting glucose levels."
                maxLength={200}
              />
            </Field>

            <Button
              type="submit"
              variant="secondary"
              loading={requestBusy}
              disabled={!shareCode.trim()}
              className="w-full justify-center"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Send Access Request to Patient
            </Button>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
};

export default ProviderConnect;
