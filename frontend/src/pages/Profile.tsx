import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Plus, QrCode, RefreshCw, Save, ShieldCheck, Stethoscope, UserCog, X } from 'lucide-react';
import { usersApi } from '../services/usersApi';
import type { UserProfile } from '../services/usersApi';
import { apiErrorMessage } from '../services/apiClient';
import { formatDate } from '../lib/format';
import AppShell from '../components/AppShell';
import {
  Alert, Badge, Button, DefinitionList, Field, Input, NotProvided, Panel, PanelHeader,
  PageHeader, PageLoader, Select,
} from '../components/ui';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const SEXES = [
  { value: '', label: 'Not provided' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

/** Free-text list editor used for allergies and chronic conditions. */
const TagEditor: React.FC<{
  label: string;
  hint: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}> = ({ label, hint, placeholder, values, onChange }) => {
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (!values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      onChange([...values, value]);
    }
    setDraft('');
  };

  return (
    <div>
      <p className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</p>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          maxLength={80}
          aria-label={label}
        />
        <Button type="button" variant="secondary" onClick={add} disabled={!draft.trim()}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-muted">{hint}</p>
      {values.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <li key={value}>
              <span className="inline-flex items-center gap-1.5 rounded border border-line bg-sunken px-2 py-1 text-xs text-ink">
                {value}
                <button
                  type="button"
                  onClick={() => onChange(values.filter((v) => v !== value))}
                  aria-label={`Remove ${value}`}
                  className="text-muted transition-colors hover:text-high"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const CARD_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'name', label: 'My name' },
  { key: 'bloodType', label: 'Blood group' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'conditions', label: 'Ongoing conditions' },
  { key: 'emergencyContact', label: 'Emergency contact' },
];

/** Printable emergency QR. The patient picks what goes on it; the code is readable offline. */
const EmergencyCardPanel: React.FC = () => {
  const [include, setInclude] = useState<string[]>(CARD_FIELDS.map((f) => f.key));
  const [card, setCard] = useState<{ text: string; qrDataUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const toggle = (key: string) =>
    setInclude((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const generate = async () => {
    setBusy(true);
    setMessage('');
    try {
      setCard(await usersApi.emergencyCard(include));
    } catch (err) {
      setCard(null);
      setMessage(apiErrorMessage(err, 'The emergency card could not be created.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Emergency card"
        description="A QR code a first responder can scan with any phone camera, with no sign-in or internet"
        icon={QrCode}
      />
      <div className="space-y-4 p-5">
        <Alert tone="warning" title="Anyone who holds the printed code can read it">
          The details are stored in the code itself. Include only what you are comfortable with, and
          keep the printout somewhere you control. Save your profile first so the card uses your latest details.
        </Alert>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Show on the card</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {CARD_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={include.includes(f.key)}
                  onChange={() => toggle(f.key)}
                  className="h-4 w-4 rounded border-line"
                />
                {f.label}
              </label>
            ))}
          </div>
        </fieldset>
        <Button variant="secondary" onClick={generate} disabled={busy || include.length === 0}>
          <QrCode className="h-4 w-4" aria-hidden="true" />
          {card ? 'Update card' : 'Create card'}
        </Button>
        {message && <Alert tone="error">{message}</Alert>}
        {card && (
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <img
              src={card.qrDataUrl}
              alt="Emergency card QR code"
              className="h-44 w-44 rounded-md border border-line bg-white p-1"
            />
            <div className="min-w-0 space-y-2">
              <pre className="whitespace-pre-wrap rounded-md border border-line bg-sunken p-3 font-mono text-xs text-ink">
                {card.text}
              </pre>
              <a
                href={card.qrDataUrl}
                download="onehealth-emergency-card.png"
                className="inline-block text-[13px] font-medium text-primary hover:underline"
              >
                Download the QR image to print
              </a>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
};

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    name: '',
    bloodType: '',
    sex: '',
    dateOfBirth: '',
    abhaId: '',
    emergencyName: '',
    emergencyPhone: '',
    specialization: '',
    clinicName: '',
    registrationNumber: '',
    city: '',
  });
  const [allergies, setAllergies] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);

  const hydrate = useCallback((data: UserProfile) => {
    setProfile(data);
    setForm({
      name: data.name ?? '',
      bloodType: data.bloodType ?? '',
      sex: data.sex ?? '',
      dateOfBirth: data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : '',
      abhaId: data.abhaId ?? '',
      emergencyName: data.emergencyName ?? '',
      emergencyPhone: data.emergencyPhone ?? '',
      specialization: data.specialization ?? '',
      clinicName: data.clinicName ?? '',
      registrationNumber: data.registrationNumber ?? '',
      city: data.city ?? '',
    });
    setAllergies(data.allergies ?? []);
    setConditions(data.chronicConditions ?? []);
  }, []);

  useEffect(() => {
    usersApi
      .getProfile()
      .then(hydrate)
      .catch((err) => setError(apiErrorMessage(err, 'We could not load your profile.')))
      .finally(() => setLoading(false));
  }, [hydrate]);

  const isDoctor = profile?.role === 'DOCTOR';

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const payload = isDoctor
        ? {
            name: form.name.trim(),
            specialization: form.specialization.trim() || null,
            clinicName: form.clinicName.trim() || null,
            registrationNumber: form.registrationNumber.trim() || null,
            city: form.city.trim() || null,
          }
        : {
            name: form.name.trim(),
            bloodType: form.bloodType || null,
            sex: form.sex || null,
            dateOfBirth: form.dateOfBirth || null,
            abhaId: form.abhaId.trim() || null,
            emergencyName: form.emergencyName.trim() || null,
            emergencyPhone: form.emergencyPhone.trim() || null,
            allergies,
            chronicConditions: conditions,
          };
      const updated = await usersApi.updateProfile(payload as Partial<UserProfile>);
      hydrate(updated);
      setNotice('Your profile has been saved.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Your profile could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const rotate = async () => {
    try {
      const next = await usersApi.rotateShareCode();
      setProfile((current) => (current ? { ...current, shareCode: next } : current));
      setNotice('A new share code has been issued. The previous one no longer works.');
    } catch (err) {
      setError(apiErrorMessage(err, 'A new share code could not be issued.'));
    }
  };

  const copyCode = async () => {
    if (!profile?.shareCode) return;
    try {
      await navigator.clipboard.writeText(profile.shareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked; the code is visible on screen regardless.
    }
  };

  if (loading) {
    return (
      <AppShell>
        <PageLoader label="Loading your profile" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Profile"
        description={
          isDoctor
            ? 'Your practice details are shown to patients deciding whether to share their records with you.'
            : 'Your health identity. Nothing here is filled in for you — what you do not enter stays blank.'
        }
      />

      {error && <Alert tone="error" className="mb-4" onDismiss={() => setError('')}>{error}</Alert>}
      {notice && <Alert tone="success" className="mb-4" onDismiss={() => setNotice('')}>{notice}</Alert>}
      
      {!isDoctor && (!profile?.dateOfBirth || !profile?.sex || !profile?.bloodType) && (
        <Alert tone="warning" className="mb-5" title="Incomplete Health Profile">
          Completing your date of birth, sex, and blood type improves the accuracy of reference ranges and the AI health assistant.
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        <form onSubmit={save} className="min-w-0 space-y-5 lg:col-span-2">
          <Panel>
            <PanelHeader title="Identity" icon={UserCog} />
            <div className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" htmlFor="name" required>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    maxLength={80}
                  />
                </Field>
                <Field
                  label="Email address"
                  htmlFor="email"
                  hint="Held encrypted and used to sign in. It cannot be changed here."
                >
                  <Input id="email" value={profile?.email ?? ''} disabled />
                </Field>
              </div>

              {!isDoctor && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Date of birth" htmlFor="dob">
                    <Input
                      id="dob"
                      type="date"
                      value={form.dateOfBirth}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                    />
                  </Field>
                  <Field label="Sex" htmlFor="sex" hint="Used to pick sex-specific ranges">
                    <Select
                      id="sex"
                      value={form.sex}
                      onChange={(e) => setForm({ ...form, sex: e.target.value })}
                    >
                      {SEXES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Blood type" htmlFor="blood">
                    <Select
                      id="blood"
                      value={form.bloodType}
                      onChange={(e) => setForm({ ...form, bloodType: e.target.value })}
                    >
                      <option value="">Not provided</option>
                      {BLOOD_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              )}
            </div>
          </Panel>

          {isDoctor ? (
            <Panel>
              <PanelHeader title="Practice details" icon={Stethoscope} />
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <Field label="Specialisation" htmlFor="specialization">
                  <Input
                    id="specialization"
                    value={form.specialization}
                    onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                    placeholder="General Medicine"
                  />
                </Field>
                <Field label="City" htmlFor="city">
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </Field>
                <Field label="Clinic or hospital" htmlFor="clinic">
                  <Input
                    id="clinic"
                    value={form.clinicName}
                    onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
                  />
                </Field>
                <Field
                  label="Registration number"
                  htmlFor="registration"
                  hint="Shown to patients so they can verify who you are"
                >
                  <Input
                    id="registration"
                    value={form.registrationNumber}
                    onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                  />
                </Field>
              </div>
            </Panel>
          ) : (
            <>
              <Panel>
                <PanelHeader
                  title="Health information"
                  description="Shown to clinicians you share your record with"
                />
                <div className="space-y-5 p-5">
                  <TagEditor
                    label="Known allergies"
                    hint="Press Enter or Add after each one. Leave empty if you have none recorded."
                    placeholder="e.g. Penicillin"
                    values={allergies}
                    onChange={setAllergies}
                  />
                  <TagEditor
                    label="Ongoing conditions"
                    hint="Conditions you are being treated for or monitored on."
                    placeholder="e.g. Hypothyroidism"
                    values={conditions}
                    onChange={setConditions}
                  />
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Emergency contact" />
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  <Field label="Contact name" htmlFor="emergency-name">
                    <Input
                      id="emergency-name"
                      value={form.emergencyName}
                      onChange={(e) => setForm({ ...form, emergencyName: e.target.value })}
                      maxLength={80}
                    />
                  </Field>
                  <Field label="Contact number" htmlFor="emergency-phone">
                    <Input
                      id="emergency-phone"
                      value={form.emergencyPhone}
                      onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })}
                      maxLength={20}
                    />
                  </Field>
                </div>
              </Panel>

              <Panel>
                <PanelHeader
                  title="ABHA"
                  description="Ayushman Bharat Health Account"
                />
                <div className="p-5">
                  <Field
                    label="ABHA number or address"
                    htmlFor="abha"
                    hint="Stored on your profile as an identifier. This build does not connect to ABDM — no data is exchanged with the national health registry."
                  >
                    <Input
                      id="abha"
                      value={form.abhaId}
                      onChange={(e) => setForm({ ...form, abhaId: e.target.value })}
                      placeholder="14-digit number, or name@abdm"
                    />
                  </Field>
                </div>
              </Panel>
            </>
          )}

          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save changes
            </Button>
          </div>
        </form>

        <div className="min-w-0 space-y-5">
          <Panel>
            <PanelHeader title="Account" />
            <div className="p-5">
              <DefinitionList
                columns={1}
                items={[
                  { label: 'Role', value: <Badge tone="primary">{isDoctor ? 'Clinician' : 'Patient'}</Badge> },
                  { label: 'Email', value: profile?.email ?? <NotProvided /> },
                  { label: 'Phone', value: profile?.phone ?? <NotProvided /> },
                  {
                    label: 'Member since',
                    value: profile?.createdAt ? formatDate(profile.createdAt) : <NotProvided />,
                  },
                ]}
              />
            </div>
          </Panel>

          {!isDoctor && profile?.shareCode && (
            <Panel>
              <PanelHeader title="Share code" icon={ShieldCheck} />
              <div className="space-y-3 p-5">
                <p className="text-sm text-ink-soft">
                  Give this to a clinician so they can request access to your records. It identifies
                  you without revealing your email address.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md border border-line bg-sunken px-3 py-2 font-mono text-[13px] tracking-wide text-ink">
                    {profile.shareCode}
                  </code>
                  <Button variant="secondary" size="sm" onClick={copyCode}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={rotate}>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Issue a new code
                </Button>
              </div>
            </Panel>
          )}

          {!isDoctor && <EmergencyCardPanel />}

          <Panel>
            <PanelHeader title="How your data is held" />
            <ul className="space-y-2.5 p-5 text-xs leading-relaxed text-muted">
              <li>Your email and phone number are encrypted at rest.</li>
              <li>Your password is stored only as a bcrypt hash and is never recoverable.</li>
              <li>Uploaded documents are served only through an authenticated request that re-checks ownership every time.</li>
              <li>Every read of your records is written to your access history.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
};

export default Profile;
