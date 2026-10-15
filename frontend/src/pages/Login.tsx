import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Lock,
  Mail,
  ShieldCheck,
  Stethoscope,
  Eye,
  EyeOff,
  Sparkles,
  User,
  Sun,
  Moon,
  CheckCircle2,
  LockKeyhole,
} from 'lucide-react';
import { authApi, apiErrorMessage } from '../services/authApi';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Alert } from '../components/ui';

/** Left Brand Showcase Panel — Modern Healthcare AI aesthetic */
const BrandHeroPanel: React.FC = () => (
  <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-12 text-white border-r border-slate-800/60">
    {/* Decorative Ambient Glow Orbs */}
    <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-sky-500/15 blur-3xl" />
    <div className="pointer-events-none absolute top-1/2 -right-24 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl" />
    <div className="pointer-events-none absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

    {/* Brand Logo & Version Pill */}
    <div className="relative z-10 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 p-[1px] shadow-lg shadow-sky-500/20">
          <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-slate-950/80 backdrop-blur-sm">
            <Activity className="h-6 w-6 text-sky-400" aria-hidden="true" />
          </div>
        </div>
        <div>
          <span className="text-xl font-bold tracking-tight text-white">
            OneHealth <span className="bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">AI</span>
          </span>
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Intelligent Health Core
          </p>
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300 backdrop-blur-md">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Clinical v2.4 Live
      </div>
    </div>

    {/* Center Value Proposition */}
    <div className="relative z-10 my-auto max-w-lg py-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 mb-6 backdrop-blur-md">
        <Sparkles className="h-3.5 w-3.5 text-sky-400" />
        <span>Grounded Clinical Decision Support</span>
      </div>

      <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight tracking-tight text-white text-balance">
        Your complete medical history.{' '}
        <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
          Decoded, verified, and in your control.
        </span>
      </h1>

      <p className="mt-4 text-base text-slate-300 leading-relaxed">
        Upload lab panels and imaging reports. Experience deterministic biometric extraction,
        instant clinical range analysis, and secure time-limited doctor sharing.
      </p>

      {/* Feature Value Cards */}
      <div className="mt-8 space-y-3.5">
        <div className="flex items-start gap-3.5 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md transition-all hover:bg-white/[0.07]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Deterministic Range Validation</h4>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Biomarkers checked directly against WHO & ADA clinical reference standards — never fabricated by an LLM.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md transition-all hover:bg-white/[0.07]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Cryptographic Consent Vault</h4>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Grant expiring doctor access via QR tokens with complete, tamper-evident audit logging.
            </p>
          </div>
        </div>
      </div>

      {/* Trust Counters */}
      <div className="mt-8 grid grid-cols-3 gap-3 border-t border-white/10 pt-6">
        <div>
          <p className="text-2xl font-bold text-white">14+</p>
          <p className="text-xs text-slate-400">Biomarkers parsed</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">&lt;500ms</p>
          <p className="text-xs text-slate-400">Processing latency</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-emerald-400">100%</p>
          <p className="text-xs text-slate-400">Patient-owned data</p>
        </div>
      </div>
    </div>

    {/* Bottom Footer Notice */}
    <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-slate-400">
      <div className="flex items-center gap-2">
        <LockKeyhole className="h-3.5 w-3.5 text-sky-400" />
        <span>AES-256-GCM Encrypted at Rest</span>
      </div>
      <span>HIPAA & DPDP Aligned</span>
    </div>
  </div>
);

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Quick Demo Auto-fill Helper
  const fillDemoAccount = (demoRole: 'PATIENT' | 'DOCTOR') => {
    setError('');
    if (demoRole === 'PATIENT') {
      setEmail('patient@onehealth.ai');
      setPassword('Demo@12345');
    } else {
      setEmail('doctor@onehealth.ai');
      setPassword('Demo@12345');
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await authApi.login(email.trim(), password);
      login(data.accessToken, data.user);
      navigate(data.user?.role === 'DOCTOR' ? '/provider' : '/dashboard', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'We could not sign you in.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <BrandHeroPanel />

      {/* Right Form Container */}
      <div className="relative flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16 overflow-y-auto">
        {/* Top Header Controls (Theme Toggle & Mobile Brand) */}
        <div className="flex items-center justify-between w-full max-w-[460px] mx-auto mb-6">
          <div className="lg:hidden flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white shadow-md shadow-sky-600/30">
              <Activity className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              OneHealth <span className="text-sky-600 dark:text-sky-400">AI</span>
            </span>
          </div>

          <div className="ml-auto">
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
        </div>

        {/* Center Card */}
        <div className="w-full max-w-[460px] mx-auto my-auto">
          {/* Card Wrapper */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-8 sm:p-10 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
            {/* Title Section */}
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200/60 dark:border-sky-800/60 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300 mb-3">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Encrypted Patient & Doctor Portal</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Welcome back
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Sign in to manage your health records, view trend analytics, or access clinician tools.
              </p>
            </div>

            {/* Quick Demo Credentials Pill Bar */}
            <div className="mt-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 p-3">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 px-1">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-sky-500" />
                  Quick Demo Access
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Click to pre-fill</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fillDemoAccount('PATIENT')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-200/80 dark:border-sky-800/60 bg-white dark:bg-slate-800 py-2 px-3 text-xs font-semibold text-sky-700 dark:text-sky-300 shadow-sm transition hover:bg-sky-50 dark:hover:bg-slate-700 active:scale-[0.98]"
                >
                  <User className="h-3.5 w-3.5 text-sky-500" />
                  <span>Demo Patient</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoAccount('DOCTOR')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 bg-white dark:bg-slate-800 py-2 px-3 text-xs font-semibold text-indigo-700 dark:text-indigo-300 shadow-sm transition hover:bg-indigo-50 dark:hover:bg-slate-700 active:scale-[0.98]"
                >
                  <Stethoscope className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Demo Clinician</span>
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              {error && <Alert tone="error">{error}</Alert>}

              {/* Email field */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 py-2.5 pl-10 pr-3.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all shadow-sm"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 py-2.5 pl-10 pr-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all shadow-sm"
                    placeholder="••••••••"
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
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={busy}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/25 transition-all hover:from-sky-500 hover:to-indigo-500 hover:shadow-sky-600/35 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                {busy ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <>
                    <span>Sign in to Dashboard</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            {/* Register footer */}
            <div className="mt-6 border-t border-slate-200/70 dark:border-slate-800/70 pt-5 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Don’t have an account?{' '}
                <Link
                  to="/register"
                  className="font-bold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                >
                  Create account
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </p>
            </div>
          </div>

          {/* Trust badges below card */}
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              End-to-End Encryption
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-sky-500" />
              Role-Based Access
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" />
              Zero AI Hallucination
            </span>
          </div>
        </div>

        {/* Legal Disclaimer */}
        <div className="w-full max-w-[460px] mx-auto text-center mt-6">
          <p className="text-[11px] text-slate-400 dark:text-slate-600 leading-relaxed">
            OneHealth AI provides clinical decision support and data aggregation. It is not an automated diagnostic device.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
