import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute, { homeFor } from './components/ProtectedRoute';
import { PageLoader } from './components/ui';

import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import ReportDetail from './pages/ReportDetail';
import UploadRecord from './pages/UploadRecord';
import Trends from './pages/Trends';
import Compare from './pages/Compare';
import Sharing from './pages/Sharing';
import Assistant from './pages/Assistant';
import ActivityHistory from './pages/ActivityHistory';
import Reminders from './pages/Reminders';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

import ProviderPatients from './pages/provider/ProviderPatients';
import ProviderPatient from './pages/provider/ProviderPatient';
import ProviderRequests from './pages/provider/ProviderRequests';
import ProviderConnect from './pages/provider/ProviderConnect';

/** Keeps signed-in users away from the auth screens. */
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader label="Checking your session" />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
};

/** Whichever home matches the signed-in role. */
const RoleHome: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader label="Checking your session" />;
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<RoleHome />} />

    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
    <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
    <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

    {/* Patient */}
    <Route element={<ProtectedRoute roles={['PATIENT']} />}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/upload" element={<UploadRecord />} />
      <Route path="/trends" element={<Trends />} />
      <Route path="/compare" element={<Compare />} />
      <Route path="/sharing" element={<Sharing />} />
      <Route path="/assistant" element={<Assistant />} />
      <Route path="/reminders" element={<Reminders />} />
      <Route path="/activity" element={<ActivityHistory />} />
    </Route>

    {/* Either role: a clinician opens a record from the patient view, and the
        API decides whether they may see it. */}
    <Route element={<ProtectedRoute />}>
      <Route path="/reports/:id" element={<ReportDetail />} />
      <Route path="/profile" element={<Profile />} />
    </Route>

    {/* Clinician */}
    <Route element={<ProtectedRoute roles={['DOCTOR']} />}>
      <Route path="/provider" element={<ProviderPatients />} />
      <Route path="/provider/requests" element={<ProviderRequests />} />
      <Route path="/provider/connect" element={<ProviderConnect />} />
      <Route path="/provider/patients/:patientId" element={<ProviderPatient />} />
      {/* Target of a scanned QR code: the token is carried straight into the
          redeem form, and redeeming still requires a signed-in clinician. */}
      <Route path="/share/:token" element={<ProviderConnect />} />
    </Route>

    <Route path="*" element={<NotFound />} />
  </Routes>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
