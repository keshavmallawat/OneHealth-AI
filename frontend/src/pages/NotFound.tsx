import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui';

const NotFound: React.FC = () => {
  const { user } = useAuth();
  const home = !user ? '/login' : user.role === 'DOCTOR' ? '/provider' : '/dashboard';

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto mb-6 flex h-11 w-11 items-center justify-center rounded-md bg-primary">
          <Activity className="h-5 w-5 text-white" aria-hidden="true" />
        </span>
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-2 text-xl font-semibold text-ink">This page does not exist</h1>
        <p className="mt-2 text-sm text-muted">
          The link may be out of date, or the record may have been removed.
        </p>
        <Link to={home} className="mt-7 inline-block">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to {user ? 'your dashboard' : 'sign in'}
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
