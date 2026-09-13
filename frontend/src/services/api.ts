import axios from 'axios';

const rawUrl = (import.meta as any).env?.VITE_API_URL;
const API_BASE_URL = (rawUrl && !rawUrl.startsWith('http://localhost') && !rawUrl.startsWith('http://127.0.0.1')) ? rawUrl : '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 180000, // 3 min — allows for AI question generation (60-120s) on Railway cold starts
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
  clearApiCache();
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

// In-memory cache and in-flight request deduplication for ultra-fast load times
const cacheMap = new Map<string, { res: any; timestamp: number }>();
const inFlightMap = new Map<string, Promise<any>>();

export const clearApiCache = () => {
  cacheMap.clear();
  inFlightMap.clear();
};

const rawGet = api.get.bind(api);
api.get = ((url: string, config?: any) => {
  // Option to skip cache if explicit
  if (config?.skipCache) {
    return rawGet(url, config);
  }

  const key = `${url}?${JSON.stringify(config?.params || {})}`;
  const now = Date.now();
  const ttl = config?.cacheTtl ?? 20000; // 20-second default cache for repeat visits / tab switching

  const cached = cacheMap.get(key);
  if (cached && now - cached.timestamp < ttl) {
    return Promise.resolve({ ...cached.res, fromCache: true });
  }

  // Deduplicate identical in-flight requests
  const existingInFlight = inFlightMap.get(key);
  if (existingInFlight) {
    return existingInFlight;
  }

  const reqPromise = rawGet(url, config)
    .then((response) => {
      cacheMap.set(key, { res: response, timestamp: Date.now() });
      return response;
    })
    .finally(() => {
      inFlightMap.delete(key);
    });

  inFlightMap.set(key, reqPromise);
  return reqPromise;
}) as typeof api.get;

// Auto-purge cache on write mutations to keep client data synchronized
const rawPost = api.post.bind(api);
api.post = ((...args: any[]) => {
  clearApiCache();
  return (rawPost as any)(...args);
}) as typeof api.post;

const rawPut = api.put.bind(api);
api.put = ((...args: any[]) => {
  clearApiCache();
  return (rawPut as any)(...args);
}) as typeof api.put;

const rawPatch = api.patch.bind(api);
api.patch = ((...args: any[]) => {
  clearApiCache();
  return (rawPatch as any)(...args);
}) as typeof api.patch;

const rawDelete = api.delete.bind(api);
api.delete = ((...args: any[]) => {
  clearApiCache();
  return (rawDelete as any)(...args);
}) as typeof api.delete;

export default api;

