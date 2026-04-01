import axios from 'axios';
import { mutationQueue } from './offlineQueue';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

const WRITE_METHODS = ['post', 'put', 'patch', 'delete'];

// Response interceptor for 401 handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Avoid redirect loop on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// Offline queue interceptor — queues write mutations on network failure
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as typeof error.config & { _skipOfflineQueue?: boolean };

    // Skip if explicitly opted out (e.g. during replay)
    if (config?._skipOfflineQueue) {
      return Promise.reject(error);
    }

    const method = (config?.method ?? '').toLowerCase();
    const isWriteOp = WRITE_METHODS.includes(method);
    const isNetworkError = !error.response || error.response.status === 0;

    if (isWriteOp && isNetworkError) {
      try {
        await mutationQueue.queue({
          method: method.toUpperCase(),
          url: config.url ?? '',
          data: config.data ? JSON.parse(config.data) : undefined,
          headers: config.headers as Record<string, string> | undefined,
        });

        // Return synthetic success so the UI doesn't break
        return {
          data: { _offlineQueued: true },
          status: 202,
          statusText: 'Queued Offline',
          headers: {},
          config,
        };
      } catch {
        // Queue full or DB error — let original error propagate
      }
    }

    return Promise.reject(error);
  },
);

export default api;
