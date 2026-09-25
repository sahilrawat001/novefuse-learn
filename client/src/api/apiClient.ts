/**
 * NovaFuse Centralized API & WebSocket Client
 * Automatically handles:
 * 1. Base URL resolution for standalone deployments (e.g. Vercel frontend -> Render backend via VITE_API_URL).
 * 2. Authorization header persistence (Bearer JWT) alongside HTTP-only cookies.
 * 3. WebSocket URL protocol and host switching (http->ws, https->wss).
 */

export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('novafuse_auth_token');
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem('novafuse_auth_token', token);
    } else {
      localStorage.removeItem('novafuse_auth_token');
    }
  } catch (err) {
    console.warn('[API Client] Could not access localStorage:', err);
  }
}

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? endpoint
    : `${API_BASE}${cleanEndpoint}`;

  const headers = new Headers(options.headers || {});
  const token = getAuthToken();

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

export function getWebSocketUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (API_BASE) {
    const wsBase = API_BASE.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    return `${wsBase}${cleanPath}`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${cleanPath}`;
}
