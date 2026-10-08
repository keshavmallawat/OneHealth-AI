import api from './apiClient';
import type { UserRole } from './authApi';

export interface UserProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  createdAt: string;
  // Patient fields
  shareCode?: string | null;
  abhaId?: string | null;
  bloodType?: string | null;
  sex?: string | null;
  dateOfBirth?: string | null;
  allergies?: string[];
  chronicConditions?: string[];
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  // Clinician fields
  specialization?: string | null;
  clinicName?: string | null;
  registrationNumber?: string | null;
  city?: string | null;
}

export const usersApi = {
  emergencyCard: (include: string[]) =>
    api
      .get('/users/me/emergency-card', { params: { include: include.join(',') } })
      .then((r) => r.data.data as { text: string; qrDataUrl: string; included: string[] }),

  getProfile: () =>
    api.get('/users/me/profile').then((r) => r.data.data.profile as UserProfile),

  updateProfile: (data: Partial<UserProfile>) =>
    api.patch('/users/me/profile', data).then((r) => r.data.data.profile as UserProfile),

  rotateShareCode: () =>
    api.post('/users/me/share-code/rotate').then((r) => r.data.data.shareCode as string),
};
