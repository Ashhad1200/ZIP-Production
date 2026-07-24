import axios from 'axios';

/**
 * Dedicated axios instance for the backoffice (platform) plane. Deliberately
 * separate from services/api.ts — that instance's 401 interceptor redirects
 * to /login and its offline-queue interceptor is tenant-specific; neither
 * applies to platform admin sessions (platform_token cookie).
 */
const platformApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/platform`
    : '/api/v1/platform',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export default platformApi;
