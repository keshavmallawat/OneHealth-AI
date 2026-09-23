import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Stethoscope, User } from 'lucide-react';
import { authApi, apiErrorMessage } from '../services/authApi';
import { useAuth } from '../context/AuthContext';
import { Alert, Button, Field, Input } from '../components/ui';

type Role = 'PATIENT' | 'DOCTOR';

/** The account type changes what the product is, so it is the first choice made. */
const RoleCard: React.FC<{
  role: Role;
  active: boolean;
  onSelect: () => void;
  icon: React.ElementType;
  title: string;
  description: string;
}> = ({ active, onSelect, icon: Icon, title, description }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={active}
    className={`flex-1 text-left rounded-md border p-3.5 transition-colors ${
      active
        ? 'border-primary bg-primary-soft'
        : 'border-line bg-surface hover:border-faint hover:bg-sunken'
    }`}
  >
    <Icon
      className={`h-4.5 w-4.5 mb-2 ${active ? 'text-primary' : 'text-muted'}`}
      aria-hidden="true"
    />
    <p className={`text-sm font-medium ${active ? 'text-primary-ink' : 'text-ink'}`}>{title}</p>
    <p className="mt-0.5 text-xs text-muted leading-relaxed">{description}</p>
  </button>
);

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [role, setRole] = useState<Role>('PATIENT');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    specialization: '',
    clinicName: '',
    registrationNumber: '',
    city: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const passwordProblem =
    form.password && (form.password.length < 8 || !/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password))
      ? 'Use at least 8 characters, including a letter and a number.'
      : undefined;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passwordProblem) return;
    setError('');
    setBusy(true);
    try {
      const data = await authApi.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role,
        ...(role === 'DOCTOR'
          ? {
              specialization: form.specialization.trim() || undefined,
              clinicName: form.clinicName.trim() || undefined,
              registrationNumber: form.registrationNumber.trim() || undefined,
              city: form.city.trim() || undefined,
            }
          : {}),
      });
      login(data.accessToken, data.user);
      navigate(role === 'DOCTOR' ? '/provider' : '/dashboard', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'We could not create your account.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-[440px]">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-md bg-primary grid place-items-center">
            <Activity className="h-4.5 w-4.5 text-white" aria-hidden="true" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink">
            OneHealth <span className="font-normal text-muted">AI</span>
          </span>
        </div>

        <h1 className="text-xl font-semibold text-ink">Create your account</h1>
        <p className="mt-1 text-sm text-muted">This takes about a minute.</p>

        <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
          {error && <Alert tone="error">{error}</Alert>}

          <div>
            <p className="block text-[13px] font-medium text-ink-soft mb-2">I am registering as</p>
            <div className="flex gap-2.5">
              <RoleCard
                role="PATIENT"
                active={role === 'PATIENT'}
                onSelect={() => setRole('PATIENT')}
                icon={User}
                title="A patient"
                description="Store my reports and control who sees them."
              />
              <RoleCard
                role="DOCTOR"
                active={role === 'DOCTOR'}
                onSelect={() => setRole('DOCTOR')}
                icon={Stethoscope}
                title="A clinician"
                description="View records patients have shared with me."
              />
            </div>
          </div>

          <Field label="Full name" htmlFor="name" required>
            <Input
              id="name"
              value={form.name}
              onChange={set('name')}
              autoComplete="name"
              required
              placeholder={role === 'DOCTOR' ? 'Dr. A. Menon' : 'Ananya Sharma'}
            />
          </Field>

          <Field label="Email address" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            required
            error={passwordProblem}
            hint="At least 8 characters, including a letter and a number."
          >
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              aria-invalid={Boolean(passwordProblem)}
              required
            />
          </Field>

          {role === 'DOCTOR' && (
            <div className="rounded-md border border-line bg-sunken p-4 space-y-4">
              <p className="text-[13px] font-medium text-ink-soft">
                Practice details
                <span className="ml-1.5 font-normal text-muted">— shown to patients deciding whether to share</span>
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Specialisation" htmlFor="specialization">
                  <Input
                    id="specialization"
                    value={form.specialization}
                    onChange={set('specialization')}
                    placeholder="General Medicine"
                  />
                </Field>
                <Field label="City" htmlFor="city">
                  <Input id="city" value={form.city} onChange={set('city')} placeholder="Pune" />
                </Field>
                <Field label="Clinic or hospital" htmlFor="clinicName">
                  <Input
                    id="clinicName"
                    value={form.clinicName}
                    onChange={set('clinicName')}
                    placeholder="Sunrise Clinic"
                  />
                </Field>
                <Field label="Registration number" htmlFor="registrationNumber">
                  <Input
                    id="registrationNumber"
                    value={form.registrationNumber}
                    onChange={set('registrationNumber')}
                    placeholder="MCI-123456"
                  />
                </Field>
              </div>
            </div>
          )}

          <Button type="submit" loading={busy} className="w-full">
            Create account
            {!busy && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted text-center">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
