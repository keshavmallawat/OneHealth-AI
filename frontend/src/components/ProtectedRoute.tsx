/**
 * Route guards.
 *
 * These keep the UI coherent — a clinician should not land on a patient's
 * upload page — but they are not the security boundary. Every protected API
 * call is authorised again on the server, so reaching a page by URL grants
 * nothing on its own.
 */
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from './ui';

export const homeFor = (role?: string) => (role === 'DOCTOR' ? '/provider' : '/dashboard');

const ProtectedRoute: React.FC<{ roles?: ('PATIENT' | 'DOCTOR' | 'ADMIN')[] }> = ({ roles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Checking your session" />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role as 'PATIENT' | 'DOCTOR' | 'ADMIN')) {
    return <Navigate to={homeFor(user.role)} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
