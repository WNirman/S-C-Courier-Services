const ENV_API_URL = (import.meta.env?.VITE_API_URL || '').trim().replace(/\/+$/, '');

function isLocalHostname() {
  if (typeof window === 'undefined' || !window.location) return false;
  const host = (window.location.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.nip.io');
}

// In production builds (import.meta.env.DEV === false), never fall back to localhost.
export const API_BASE = ENV_API_URL || (import.meta.env?.DEV && isLocalHostname() ? 'http://localhost:5000' : '');

export function apiUrl(path = '') {
  if (!API_BASE) {
    throw new Error('Backend API URL is not configured (set VITE_API_URL).');
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}
