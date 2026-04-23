import axios from 'axios';

// Configure axios
const authApi = axios.create({
  baseURL: '/api/auth', // using proxy in vite config
  withCredentials: true, // important for cookies
});

// Interceptor to attach access token if we had one in memory,
// but usually we rely on HttpOnly cookies for refresh and 
// we might store the access token in memory or in a secure cookie.
// Since the backend sets HttpOnly cookies for refreshToken,
// and returns accessToken in JSON, we need to handle it.

let currentAccessToken = '';

export const setAccessToken = (token: string) => {
  currentAccessToken = token;
};

authApi.interceptors.request.use(
  (config) => {
    if (currentAccessToken) {
      config.headers.Authorization = `Bearer ${currentAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default authApi;
