/** Consent and provider-access endpoints. */
import api from './apiClient';
import type { RecordSummary } from './recordsApi';

export type ConsentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED' | 'EXPIRED';

export interface DoctorSummary {
  id: string;
  name: string;
  specialization: string | null;
  clinicName: string | null;
  registrationNumber: string | null;
  city: string | null;
  existingStatus?: string | null;
}

export interface Consent {
  id: string;
  status: ConsentStatus;
  active: boolean;
  scope: string[];
  purpose: string | null;
  requestedBy: 'PATIENT' | 'DOCTOR';
  origin: 'DIRECT' | 'QR';
  createdAt: string;
  decidedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
  lastAccessedAt: string | null;
  accessCount: number;
  doctor: DoctorSummary | null;
  patient: { id: string; name: string } | null;
}

export interface AuthorisedPatient {
  consentId: string;
  expiresAt: string;
  scope: string[];
  purpose: string | null;
  lastAccessedAt: string | null;
  patient: {
    id: string;
    name: string;
    bloodType: string | null;
    sex: string | null;
    dateOfBirth: string | null;
    allergies: string[];
    chronicConditions: string[];
  };
  recordCount: number;
  abnormalTotal: number;
  lastUploadAt: string | null;
}

export interface PatientDetail {
  patient: AuthorisedPatient['patient'] & {
    email: string | null;
    emergencyName: string | null;
    emergencyPhone: string | null;
    abhaId: string | null;
  };
  records: RecordSummary[];
  access: { consentId: string | null; expiresAt: string | null; scope: string[]; readOnly: boolean };
}

export const consentApi = {
  list: () =>
    api.get('/consents').then((r) => r.data.data as {
      consents: Consent[];
      counts: { pending: number; active: number; total: number };
    }),

  directory: (q?: string) =>
    api.get('/consents/directory', { params: { q } }).then((r) => r.data.data.doctors as DoctorSummary[]),

  grant: (input: { doctorId: string; durationHours?: number; scope?: string[]; purpose?: string }) =>
    api.post('/consents/grant', input).then((r) => r.data),

  approve: (id: string, durationHours?: number) =>
    api.post(`/consents/${id}/approve`, { durationHours }).then((r) => r.data),

  reject: (id: string) => api.post(`/consents/${id}/reject`).then((r) => r.data),

  revoke: (id: string) => api.post(`/consents/${id}/revoke`).then((r) => r.data),

  // --- Clinician ---
  request: (input: { shareCode: string; purpose?: string }) =>
    api.post('/consents/request', input).then((r) => r.data),

  patients: () =>
    api.get('/consents/patients').then((r) => r.data.data.patients as AuthorisedPatient[]),

  patientDetail: (patientId: string) =>
    api.get(`/consents/patients/${patientId}`).then((r) => r.data.data as PatientDetail),
};
