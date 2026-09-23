import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowLeft, Mail } from 'lucide-react';
import { Alert, Panel } from '../components/ui';

/**
 * Password reset is not implemented in this build.
 *
 * Saying so plainly is deliberate: a screen that pretends to send a reset email
 * and silently does nothing is worse than one that tells the truth.
 */
const ForgotPassword: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
    <div className="w-full max-w-md">
      <div className="mb-8 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-primary">
          <Activity className="h-4.5 w-4.5 text-white" aria-hidden="true" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-ink">
          OneHealth <span className="font-normal text-muted">AI</span>
        </span>
      </div>

      <Panel className="p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <Mail className="h-4.5 w-4.5 text-muted" aria-hidden="true" />
          <h1 className="text-base font-semibold text-ink">Password reset</h1>
        </div>

        <Alert tone="info" title="Not available in this build">
          Self-service password reset needs an outbound email service, which this deployment does
          not have configured. Rather than showing a form that silently does nothing, we are telling
          you directly.
        </Alert>

        <p className="mt-4 text-sm text-ink-soft">
          If you cannot sign in, ask whoever administers this deployment to reset your password
          against the database.
        </p>

        <Link
          to="/login"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to sign in
        </Link>
      </Panel>
    </div>
  </div>
);

export default ForgotPassword;
