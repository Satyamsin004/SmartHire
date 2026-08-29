import axios from 'axios';

const rawUrl = (import.meta as any).env?.VITE_API_URL;
const API_BASE_URL = (rawUrl && !rawUrl.startsWith('http://localhost') && !rawUrl.startsWith('http://127.0.0.1')) ? rawUrl : '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

// REQUEST INTERCEPTOR: Always attach freshest token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Deduplicated token refresh promise to prevent parallel request race conditions
let refreshPromise: Promise<string> | null = null;

const clearAuthData = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_data');
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('refresh_token');
  sessionStorage.removeItem('user_data');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('token');
  delete api.defaults.headers.common['Authorization'];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Log errors for debugging
    if (error.response) {
      console.warn(
        `🚨 [API ERROR] ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url}`,
        `| Status: ${error.response.status}`,
        `| Detail:`, error.response.data?.detail || error.response.data
      );
    }

    // Only attempt refresh once per request on 401 Unauthorized
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Ignore auth endpoints from triggering self-refresh loops
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');

      // If no refresh token exists, reject without destroying session state
      if (!refreshToken) {
        return Promise.reject(error);
      }

      // Deduplicate refresh calls: share the active refreshPromise if one is already in-flight
      if (!refreshPromise) {
        refreshPromise = (async () => {
          try {
            const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
            const newAccessToken = res.data.tokens?.access_token || res.data.access_token;
            const newRefreshToken = res.data.tokens?.refresh_token || res.data.refresh_token;

            if (newAccessToken) {
              localStorage.setItem('access_token', newAccessToken);
              localStorage.setItem('token', newAccessToken);
              if (newRefreshToken) {
                localStorage.setItem('refresh_token', newRefreshToken);
              }
              api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
              return newAccessToken;
            } else {
              throw new Error('Invalid refresh payload');
            }
          } catch (refreshErr) {
            clearAuthData();
            throw refreshErr;
          } finally {
            refreshPromise = null;
          }
        })();
      }

      try {
        const newAccessToken = await refreshPromise;
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (err) {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
