import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Stethoscope,
  User,
  ShieldCheck,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Building,
  MapPin,
  Award,
  Sparkles,
} from 'lucide-react';
import { authApi, apiErrorMessage } from '../services/authApi';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Alert } from '../components/ui';

type Role = 'PATIENT' | 'DOCTOR';

/** Elevated Role Selection Card */
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
    className={`flex-1 text-left rounded-2xl border p-4 transition-all duration-200 cursor-pointer ${
      active
        ? 'border-sky-500 bg-sky-50/80 dark:bg-sky-950/40 shadow-sm ring-1 ring-sky-500/30'
        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
    }`}
  >
    <div
      className={`h-9 w-9 rounded-xl grid place-items-center mb-3 transition-colors ${
        active
          ? 'bg-sky-600 text-white shadow-sm'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
      }`}
    >
      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
    </div>
    <p className={`text-sm font-bold ${active ? 'text-sky-950 dark:text-sky-200' : 'text-slate-900 dark:text-white'}`}>
      {title}
    </p>
    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
  </button>
);

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();

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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 sm:px-6 transition-colors duration-200">
      <div className="mx-auto w-full max-w-[500px]">
        {/* Top Bar with Brand & Theme Toggle */}
        <div className="mb-6 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-600/30">
              <Activity className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              OneHealth <span className="text-sky-600 dark:text-sky-400">AI</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 shadow-sm transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {theme === 'light' ? (
              <>
                <Moon className="h-3.5 w-3.5 text-slate-600" />
                <span>Dark</span>
              </>
            ) : (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span>Light</span>
              </>
            )}
          </button>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-8 sm:p-10 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200/60 dark:border-sky-800/60 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300 mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Fast Setup • 100% Free</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Choose your account role to unlock personalised health management tools.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
            {error && <Alert tone="error">{error}</Alert>}

            {/* Role Picker */}
            <div>
              <p className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                I am registering as
              </p>
              <div className="flex gap-3">
                <RoleCard
                  role="PATIENT"
                  active={role === 'PATIENT'}
                  onSelect={() => setRole('PATIENT')}
                  icon={User}
                  title="Patient"
                  description="Upload reports, analyze biomarkers & control who sees them."
                />
                <RoleCard
                  role="DOCTOR"
                  active={role === 'DOCTOR'}
                  onSelect={() => setRole('DOCTOR')}
                  icon={Stethoscope}
                  title="Clinician"
                  description="Access records patients have explicitly shared with you."
                />
              </div>
            </div>

            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Full name <span className="text-rose-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={set('name')}
                autoComplete="name"
                required
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 py-2.5 px-3.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all shadow-sm"
                placeholder={role === 'DOCTOR' ? 'Dr. Sarah Jenkins' : 'Alex Rivera'}
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Email address <span className="text-rose-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
                required
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 py-2.5 px-3.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all shadow-sm"
                placeholder="you@example.com"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="new-password"
                  required
                  className={`w-full rounded-xl border py-2.5 pl-3.5 pr-10 text-sm bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all shadow-sm ${
                    passwordProblem
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-300 dark:border-slate-700 focus:border-sky-500 focus:ring-sky-500/20'
                  }`}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {passwordProblem ? (
                <p className="mt-1 text-xs text-rose-500">{passwordProblem}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">At least 8 characters with a letter and a number.</p>
              )}
            </div>

            {/* Doctor Practice Details */}
            {role === 'DOCTOR' && (
              <div className="rounded-2xl border border-sky-200/80 dark:border-sky-800/60 bg-sky-50/50 dark:bg-sky-950/20 p-4 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-900 dark:text-sky-300">
                  <ShieldCheck className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  <span>Clinical Verification Details</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="specialization" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Specialisation
                    </label>
                    <input
                      id="specialization"
                      value={form.specialization}
                      onChange={set('specialization')}
                      placeholder="e.g. Cardiology"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="city" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      City
                    </label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        id="city"
                        value={form.city}
                        onChange={set('city')}
                        placeholder="e.g. Mumbai"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-8 pr-3 text-xs text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="clinicName" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Clinic / Hospital
                    </label>
                    <div className="relative">
                      <Building className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        id="clinicName"
                        value={form.clinicName}
                        onChange={set('clinicName')}
                        placeholder="e.g. CityCare Hospital"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-8 pr-3 text-xs text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="registrationNumber" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Registration / License #
                    </label>
                    <div className="relative">
                      <Award className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        id="registrationNumber"
                        value={form.registrationNumber}
                        onChange={set('registrationNumber')}
                        placeholder="e.g. MCI-104477"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-8 pr-3 text-xs text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/25 transition-all hover:from-sky-500 hover:to-indigo-500 hover:shadow-sky-600/35 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {busy ? (
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Creating account...</span>
                </div>
              ) : (
                <>
                  <span>Create {role === 'DOCTOR' ? 'Clinician' : 'Patient'} Account</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 border-t border-slate-200/70 dark:border-slate-800/70 pt-5 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-sky-600 dark:text-sky-400 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
