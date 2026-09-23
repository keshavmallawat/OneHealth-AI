import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Lock, Mail, ShieldCheck, Stethoscope } from 'lucide-react';
import { authApi, apiErrorMessage } from '../services/authApi';
import { useAuth } from '../context/AuthContext';
import { Alert, Button, Field, Input } from '../components/ui';

/** Marketing-free brand panel: what the product is, in the product's own terms. */
const BrandPanel: React.FC = () => (
  <div className="hidden lg:flex flex-col justify-between bg-primary-ink p-12 text-white">
    <div className="flex items-center gap-3">
      <span className="h-10 w-10 rounded-md bg-white/10 grid place-items-center">
        <Activity className="h-5 w-5 text-white" aria-hidden="true" />
      </span>
      <span className="text-lg font-semibold tracking-tight">
        OneHealth <span className="font-normal text-white/60">AI</span>
      </span>
    </div>

    <div className="max-w-md">
      <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white text-balance">
        Your medical records, readable and in your control.
      </h2>
      <ul className="mt-7 space-y-4 text-sm text-white/75">
        <li className="flex gap-3">
          <ShieldCheck className="h-4.5 w-4.5 shrink-0 mt-0.5 text-white/50" aria-hidden="true" />
          <span>
            Lab values are extracted from your reports and compared against published reference
            ranges — never guessed by a language model.
          </span>
        </li>
        <li className="flex gap-3">
          <Stethoscope className="h-4.5 w-4.5 shrink-0 mt-0.5 text-white/50" aria-hidden="true" />
          <span>
            Share a record with a clinician for a set period, see exactly who opened it, and
            withdraw access at any time.
          </span>
        </li>
      </ul>
    </div>

    <p className="text-xs text-white/40 leading-relaxed max-w-sm">
      OneHealth AI provides informational decision support. It is not a diagnostic device and does
      not replace advice from a qualified healthcare professional.
    </p>
  </div>
);

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
    <div className="min-h-screen grid lg:grid-cols-2">
      <BrandPanel />

      <div className="flex items-center justify-center bg-canvas px-6 py-12 sm:px-12">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden mb-10 flex items-center gap-3">
            <span className="h-10 w-10 rounded-md bg-primary grid place-items-center">
              <Activity className="h-5 w-5 text-white" aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-ink">
              OneHealth <span className="font-normal text-muted">AI</span>
            </span>
          </div>

          <h1 className="text-2xl font-semibold text-ink tracking-tight">Sign in</h1>
          <p className="mt-1.5 text-[15px] text-muted">
            Access your health record, or your authorised patients.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            {error && <Alert tone="error">{error}</Alert>}

            <Field label="Email address" htmlFor="email">
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                  aria-hidden="true"
                />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  placeholder="you@example.com"
                />
              </div>
            </Field>

            <Field label="Password" htmlFor="password">
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                  aria-hidden="true"
                />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  placeholder="••••••••"
                />
              </div>
            </Field>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-[13px] font-medium text-primary hover:underline">
                Forgot your password?
              </Link>
            </div>

            <Button type="submit" loading={busy} className="w-full mt-2" size="md">
              Sign in
              {!busy && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted text-center">
            Don’t have an account?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
