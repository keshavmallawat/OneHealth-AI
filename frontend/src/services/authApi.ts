/**
 * Auth endpoints. A thin named-export layer over the shared client so pages
 * never build URLs by hand.
 */
import api, { setAccessToken, getAccessToken, setAuthFailureHandler, apiErrorMessage } from './apiClient';

export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Patients only: the code they give a clinician to request access. */
  shareCode?: string | null;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: 'PATIENT' | 'DOCTOR';
  phone?: string;
  specialization?: string;
  clinicName?: string;
  registrationNumber?: string;
  city?: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),

  register: (input: RegisterInput) => api.post('/auth/register', input).then((r) => r.data),

  me: () => api.get('/auth/me').then((r) => r.data),

  refresh: () => api.post('/auth/refresh').then((r) => r.data),

  logout: () => api.post('/auth/logout').then((r) => r.data),
};

export { setAccessToken, getAccessToken, setAuthFailureHandler, apiErrorMessage };
export default api;
