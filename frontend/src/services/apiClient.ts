/**
 * Shared axios instance for the whole app.
 *
 * The access token lives in memory (and is mirrored to localStorage so a page
 * refresh does not sign the user out). The refresh token is an HttpOnly cookie
 * the browser holds - it is never readable from JavaScript.
 *
 * A single response interceptor transparently refreshes an expired access token
 * and replays the original request, so no page has to think about token expiry.
 */
import axios from 'axios';
import type { AxiosError, AxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

let accessToken = '';
let onAuthFailure: (() => void) | null = null;

export function setAccessToken(token: string) {
  accessToken = token;
  if (token) localStorage.setItem('accessToken', token);
  else localStorage.removeItem('accessToken');
}

export function getAccessToken(): string {
  return accessToken || localStorage.getItem('accessToken') || '';
}

export function setAuthFailureHandler(handler: () => void) {
  onAuthFailure = handler;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Ensure concurrent 401s trigger only one refresh call.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post('/api/auth/refresh', {}, { withCredentials: true })
      .then((response) => {
        const token = response.data?.accessToken as string;
        if (!token) throw new Error('No access token returned');
        setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retried?: boolean };
    const isAuthCall = original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/register') ||
      original?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      try {
        await refreshAccessToken();
        return api(original);
      } catch {
        setAccessToken('');
        onAuthFailure?.();
      }
    }
    return Promise.reject(error);
  }
);

/** Pull a human-readable message out of any API error shape. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  const axiosError = error as AxiosError<any>;
  if (axiosError?.code === 'ERR_NETWORK') {
    return 'Cannot reach the server. Is the backend running on port 3001?';
  }
  const data = axiosError?.response?.data;
  if (typeof data?.message === 'string' && data.message) return data.message;
  if (typeof data?.error === 'string') return data.error;
  // zod flattened errors from the auth controller
  const fieldErrors = data?.error?.fieldErrors;
  if (fieldErrors && typeof fieldErrors === 'object') {
    const first = Object.values(fieldErrors).flat()[0];
    if (typeof first === 'string') return first;
  }
  if (typeof data?.error?.formErrors?.[0] === 'string') return data.error.formErrors[0];
  return axiosError?.message || fallback;
}

export default api;
