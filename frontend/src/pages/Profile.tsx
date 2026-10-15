import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  ShieldCheck,
  Stethoscope,
  UserCog,
  X,
  AlertTriangle,
  Lock,
  Phone,
  Heart,
  Droplet,
  Calendar,
  Building,
  FileCheck2,
  Share2,
  Sparkles,
  Download,
} from 'lucide-react';
import { usersApi } from '../services/usersApi';
import type { UserProfile } from '../services/usersApi';
import { apiErrorMessage } from '../services/apiClient';
import { formatDate } from '../lib/format';
import AppShell from '../components/AppShell';
import { useToast } from '../context/ToastContext';
import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  NotProvided,
  Panel,
  PanelHeader,
  PageHeader,
  PageLoader,
  Select,
} from '../components/ui';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const SEXES = [
  { value: '', label: 'Not provided' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

/** Free-text tag editor used for allergies and chronic conditions */
const TagEditor: React.FC<{
  label: string;
  hint: string;
  placeholder: string;
  values: string[];
  theme: 'amber' | 'blue';
  onChange: (values: string[]) => void;
}> = ({ label, hint, placeholder, values, theme, onChange }) => {
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (!values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      onChange([...values, value]);
    }
    setDraft('');
  };

  const pillStyle =
    theme === 'amber'
      ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
      : 'border-sky-200 dark:border-sky-900/60 bg-sky-50/80 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200';

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">{label}</label>
        <span className="text-xs text-slate-400 font-medium">{values.length} recorded</span>
      </div>
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
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      {values.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {values.map((value) => (
            <li key={value}>
              <span className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-medium shadow-xs transition-colors ${pillStyle}`}>
                {value}
                <button
                  type="button"
                  onClick={() => onChange(values.filter((v) => v !== value))}
                  aria-label={`Remove ${value}`}
                  className="rounded-full p-0.5 opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
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

const CARD_FIELDS: Array<{ key: string; label: string; desc: string }> = [
  { key: 'name', label: 'Full name', desc: 'Identifies you directly' },
  { key: 'bloodType', label: 'Blood group', desc: 'Critical for transfusions' },
  { key: 'allergies', label: 'Allergies', desc: 'Prevents adverse drug reactions' },
  { key: 'conditions', label: 'Chronic conditions', desc: 'Current clinical context' },
  { key: 'emergencyContact', label: 'Emergency contact', desc: 'Primary next of kin' },
];

/** Printable emergency QR code panel */
const EmergencyCardPanel: React.FC = () => {
  const [include, setInclude] = useState<string[]>(CARD_FIELDS.map((f) => f.key));
  const [card, setCard] = useState<{ text: string; qrDataUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const toast = useToast();

  const toggle = (key: string) =>
    setInclude((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const generate = async () => {
    setBusy(true);
    setMessage('');
    try {
      const res = await usersApi.emergencyCard(include);
      setCard(res);
      toast.success('Emergency Card generated', 'Offline QR code is ready for printing or saving');
    } catch (err) {
      setCard(null);
      const msg = apiErrorMessage(err, 'The emergency card could not be created.');
      setMessage(msg);
      toast.error('Card generation failed', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="border-amber-200/60 dark:border-amber-900/40">
      <PanelHeader
        title="Emergency Medical Card"
        description="Offline QR readable by any paramedic or first responder without internet or sign-in"
        icon={QrCode}
      />
      <div className="space-y-4 p-5">
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 flex gap-3 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Physical Card Security Notice</p>
            <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed">
              Data is embedded directly into the matrix code. Select only the fields you wish first responders to access.
            </p>
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Fields to encode
          </legend>
          <div className="space-y-2">
            {CARD_FIELDS.map((f) => {
              const active = include.includes(f.key);
              return (
                <label
                  key={f.key}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-sm cursor-pointer transition-all ${
                    active
                      ? 'border-teal-500/40 bg-teal-50/40 dark:bg-teal-950/20 text-slate-800 dark:text-slate-100'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggle(f.key)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <span className="font-medium block">{f.label}</span>
                      <span className="text-[11px] text-slate-400">{f.desc}</span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Button
          variant="secondary"
          onClick={generate}
          disabled={busy || include.length === 0}
          className="w-full justify-center"
        >
          <QrCode className="h-4 w-4" aria-hidden="true" />
          {card ? 'Refresh Emergency Card' : 'Generate Emergency QR'}
        </Button>

        {message && <Alert tone="error">{message}</Alert>}

        {card && (
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white shadow-xs">
                <img
                  src={card.qrDataUrl}
                  alt="Emergency Medical QR Code"
                  className="h-40 w-40 object-contain"
                />
              </div>
              <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-[11px] font-semibold uppercase tracking-wider">
                  <Heart className="h-3 w-3 fill-rose-500 text-rose-500" /> Medical Emergency
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Print this card to keep in your wallet, phone case, or medical wristband.
                </p>
                <a
                  href={card.qrDataUrl}
                  download="onehealth-emergency-card.png"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download PNG image
                </a>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="block text-[11px] font-mono text-slate-400 mb-1">Encoded Payload Preview:</span>
              <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300 max-h-36 overflow-y-auto">
                {card.text}
              </pre>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
};

const Profile: React.FC = () => {
  const toast = useToast();
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
      toast.success('Profile updated', 'Your health record identity has been saved securely');
    } catch (err) {
      const msg = apiErrorMessage(err, 'Your profile could not be saved.');
      setError(msg);
      toast.error('Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const rotate = async () => {
    try {
      const next = await usersApi.rotateShareCode();
      setProfile((current) => (current ? { ...current, shareCode: next } : current));
      setNotice('A new share code has been issued. The previous one no longer works.');
      toast.info('Share code rotated', 'A new unique patient share token has been issued');
    } catch (err) {
      const msg = apiErrorMessage(err, 'A new share code could not be issued.');
      setError(msg);
      toast.error('Rotation failed', msg);
    }
  };

  const copyCode = async () => {
    if (!profile?.shareCode) return;
    try {
      await navigator.clipboard.writeText(profile.shareCode);
      setCopied(true);
      toast.success('Copied to clipboard', profile.shareCode);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback
    }
  };

  if (loading) {
    return (
      <AppShell>
        <PageLoader label="Loading your profile" />
      </AppShell>
    );
  }

  // Calculate age if DOB is provided
  const calculateAge = (dob: string) => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const age = form.dateOfBirth ? calculateAge(form.dateOfBirth) : null;

  return (
    <AppShell>
      {/* Hero Profile Banner */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-teal-900 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl shadow-teal-950/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(20,184,166,0.18),rgba(255,255,255,0))] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 font-bold text-2xl sm:text-3xl text-slate-950 shadow-lg shadow-teal-500/25 ring-4 ring-white/10">
              {profile?.name ? profile.name.slice(0, 2).toUpperCase() : 'OH'}
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-slate-900">
                <Check className="h-3 w-3 text-slate-950 stroke-[3]" />
              </span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  {profile?.name || 'Healthcare User'}
                </h1>
                <Badge tone={isDoctor ? 'primary' : 'success'}>
                  {isDoctor ? 'Licensed Clinician' : 'Verified Patient'}
                </Badge>
              </div>
              <p className="text-sm text-slate-300 font-mono flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-teal-400" />
                {profile?.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {form.bloodType && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-xs font-semibold">
                <Droplet className="h-3.5 w-3.5 text-rose-400 fill-rose-400" />
                <span>{form.bloodType}</span>
              </div>
            )}
            {age !== null && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-xs font-semibold">
                <Calendar className="h-3.5 w-3.5 text-teal-300" />
                <span>{age} yrs</span>
              </div>
            )}
            {form.abhaId && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-xs font-mono">
                <FileCheck2 className="h-3.5 w-3.5 text-indigo-300" />
                <span>ABHA Active</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <PageHeader
        title="Profile Settings"
        description={
          isDoctor
            ? 'Manage your clinician practice profile, verified registration numbers, and public credentials.'
            : 'Your comprehensive health identity. Data is encrypted and utilized only for clinical guidance with your explicit consent.'
        }
      />

      {error && <Alert tone="error" className="mb-4" onDismiss={() => setError('')}>{error}</Alert>}
      {notice && <Alert tone="success" className="mb-4" onDismiss={() => setNotice('')}>{notice}</Alert>}

      {!isDoctor && (!profile?.dateOfBirth || !profile?.sex || !profile?.bloodType) && (
        <Alert tone="warning" className="mb-5" title="Incomplete Health Profile">
          Completing your date of birth, sex, and blood type improves the precision of clinical biomarker reference ranges and personalized AI insights.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <form onSubmit={save} className="min-w-0 space-y-6 lg:col-span-2">
          {/* Identity Section */}
          <Panel>
            <PanelHeader
              title="Personal Identity"
              description="Basic credentials and contact information"
              icon={UserCog}
            />
            <div className="space-y-4 p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full legal name" htmlFor="name" required>
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
                  hint="Encrypted at rest with AES-256-GCM. Primary account identifier."
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
                  <Field label="Biological sex" htmlFor="sex" hint="Calibrates biomarker reference bands">
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
                  <Field label="Blood group" htmlFor="blood">
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
            /* Clinician Practice Details */
            <Panel>
              <PanelHeader
                title="Clinical Practice Credentials"
                description="Verified institutional affiliations and licensing"
                icon={Stethoscope}
              />
              <div className="grid gap-4 p-5 sm:p-6 sm:grid-cols-2">
                <Field label="Medical Specialisation" htmlFor="specialization">
                  <Input
                    id="specialization"
                    value={form.specialization}
                    onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                    placeholder="e.g. Internal Medicine, Cardiology"
                  />
                </Field>
                <Field label="Practice City / Region" htmlFor="city">
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="e.g. Mumbai, New Delhi"
                  />
                </Field>
                <Field label="Hospital / Clinic Affiliation" htmlFor="clinic">
                  <Input
                    id="clinic"
                    value={form.clinicName}
                    onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
                    placeholder="e.g. Apollo Medical Center"
                  />
                </Field>
                <Field
                  label="Medical Council Registration #"
                  htmlFor="registration"
                  hint="Publicly visible to patients when verifying clinical authorization"
                >
                  <Input
                    id="registration"
                    value={form.registrationNumber}
                    onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                    placeholder="e.g. MCI-2019-84729"
                  />
                </Field>
              </div>
            </Panel>
          ) : (
            /* Patient Clinical Details */
            <>
              <Panel>
                <PanelHeader
                  title="Clinical Health Profile"
                  description="Chronic diagnoses and documented allergies shared with authorized doctors"
                  icon={Heart}
                />
                <div className="space-y-6 p-5 sm:p-6">
                  <TagEditor
                    label="Documented Allergies"
                    hint="Add pharmaceuticals, food allergens, or environmental sensitivities."
                    placeholder="e.g. Penicillin, Sulfa drugs, Peanuts"
                    values={allergies}
                    theme="amber"
                    onChange={setAllergies}
                  />
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <TagEditor
                      label="Ongoing / Chronic Conditions"
                      hint="Active medical conditions under monitoring or prescription therapy."
                      placeholder="e.g. Type 2 Diabetes, Hypertension, Asthma"
                      values={conditions}
                      theme="blue"
                      onChange={setConditions}
                    />
                  </div>
                </div>
              </Panel>

              {/* Emergency Contact */}
              <Panel>
                <PanelHeader
                  title="Emergency Contact"
                  description="Primary designated person for urgent clinical notifications"
                  icon={Phone}
                />
                <div className="grid gap-4 p-5 sm:p-6 sm:grid-cols-2">
                  <Field label="Contact full name" htmlFor="emergency-name">
                    <Input
                      id="emergency-name"
                      value={form.emergencyName}
                      onChange={(e) => setForm({ ...form, emergencyName: e.target.value })}
                      placeholder="e.g. Sarah Jenkins (Spouse)"
                      maxLength={80}
                    />
                  </Field>
                  <Field label="Emergency phone number" htmlFor="emergency-phone">
                    <Input
                      id="emergency-phone"
                      value={form.emergencyPhone}
                      onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })}
                      placeholder="+91 98765 43210"
                      maxLength={20}
                    />
                  </Field>
                </div>
              </Panel>

              {/* ABHA Identifier */}
              <Panel>
                <PanelHeader
                  title="National Health ID (ABHA)"
                  description="Ayushman Bharat Digital Mission identifier mapping"
                  icon={Building}
                />
                <div className="p-5 sm:p-6">
                  <Field
                    label="ABHA Number / Address"
                    htmlFor="abha"
                    hint="Securely linked to your profile. ABDM gateway exchanges operate with zero-knowledge encryption."
                  >
                    <Input
                      id="abha"
                      value={form.abhaId}
                      onChange={(e) => setForm({ ...form, abhaId: e.target.value })}
                      placeholder="14-digit ABHA number or username@abdm"
                    />
                  </Field>
                </div>
              </Panel>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="submit" loading={saving} size="lg" className="shadow-lg shadow-teal-600/20">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save Changes
            </Button>
          </div>
        </form>

        {/* Right Sidebar Information Cards */}
        <div className="min-w-0 space-y-6">
          {/* Account Meta */}
          <Panel>
            <PanelHeader title="Account Details" icon={ShieldCheck} />
            <div className="p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 font-medium">Role</span>
                <Badge tone="primary">{isDoctor ? 'Practicing Clinician' : 'Patient'}</Badge>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 font-medium">Primary Email</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[170px]">
                  {profile?.email ?? <NotProvided />}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 font-medium">Phone</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {profile?.phone ?? <NotProvided />}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500 font-medium">Member Since</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {profile?.createdAt ? formatDate(profile.createdAt) : <NotProvided />}
                </span>
              </div>
            </div>
          </Panel>

          {/* Patient Share Code */}
          {!isDoctor && profile?.shareCode && (
            <Panel className="border-teal-200/70 dark:border-teal-900/40 bg-gradient-to-b from-teal-50/20 to-transparent">
              <PanelHeader
                title="Direct Share Code"
                description="Give this code to a doctor so they can request record access"
                icon={Share2}
              />
              <div className="space-y-4 p-5">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Allows verified doctors to look up your chart without exposing your email address or personal contact information.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-xl border border-teal-200 dark:border-teal-800/60 bg-teal-50/50 dark:bg-teal-950/40 px-3 py-2.5 font-mono text-sm tracking-wider font-semibold text-teal-800 dark:text-teal-200 shadow-xs">
                    {profile.shareCode}
                  </code>
                  <Button variant="secondary" size="md" onClick={copyCode} title="Copy share code">
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={rotate} className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                  Issue a new code (Revokes old)
                </Button>
              </div>
            </Panel>
          )}

          {/* Emergency Offline Card Generator */}
          {!isDoctor && <EmergencyCardPanel />}

          {/* Security & Compliance Info */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Sparkles className="h-4 w-4 text-teal-500" />
              <span>HIPAA & ABDM Compliance</span>
            </div>
            <ul className="space-y-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              <li className="flex items-start gap-1.5">
                <Check className="h-3.5 w-3.5 text-teal-500 shrink-0 mt-0.5" />
                <span>All biometric data points encrypted at rest with AES-256-GCM.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="h-3.5 w-3.5 text-teal-500 shrink-0 mt-0.5" />
                <span>Zero-knowledge role authorization governs all clinician requests.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="h-3.5 w-3.5 text-teal-500 shrink-0 mt-0.5" />
                <span>Immutable audit trails log every diagnostic access request.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Profile;
