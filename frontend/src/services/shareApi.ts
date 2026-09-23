/** QR / link sharing endpoints. */
import api from './apiClient';

export interface ShareSession {
  id: string;
  token: string;
  url: string;
  scope: string[];
  purpose: string | null;
  expiresAt: string;
  grantDurationHrs: number;
  revoked: boolean;
  revokedAt: string | null;
  claimedAt: string | null;
  claimedBy: { id: string; name: string } | null;
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';
  createdAt: string;
}

export const shareApi = {
  list: () =>
    api.get('/share/sessions').then((r) => r.data.data.sessions as ShareSession[]),

  create: (input: {
    expiresInMinutes?: number;
    grantDurationHrs?: number;
    scope?: string[];
    purpose?: string;
  }) =>
    api.post('/share/sessions', input).then(
      (r) => r.data.data as { session: ShareSession; qrDataUrl: string }
    ),

  revoke: (id: string) => api.post(`/share/sessions/${id}/revoke`).then((r) => r.data),

  redeem: (token: string) => api.post('/share/redeem', { token }).then((r) => r.data),
};
