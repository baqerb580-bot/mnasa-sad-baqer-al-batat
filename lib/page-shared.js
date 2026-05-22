// Shared utilities for page.js and extracted section components.
// Keep this file SMALL — only pure helpers, no React.

// Formatting
export const fmt = (n) => Number(n || 0).toLocaleString('en-US');
export const fmtCurrency = (n) => `${fmt(n)} د.ع`;

// Safe array helper — guarantees an array is set even if API returns error object
export const safeArr = (d) => Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : (Array.isArray(d?.items) ? d.items : []));
export const setArr = (setter) => (d) => setter(safeArr(d));

// API base URL — supports separated backend deployment via NEXT_PUBLIC_API_URL
const API_BASE = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL)
  ? String(process.env.NEXT_PUBLIC_API_URL).replace(/\/+$/, '')
  : '';

// Safe API helper — NEVER throws, always returns an object/array.
export const api = async (path, opts = {}) => {
  const url = API_BASE ? `${API_BASE}/api/${path}` : `/api/${path}`;
  // Attach auth token if available
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('gz_token') : null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeout || 30000);
    const r = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(opts.headers || {})
      },
      signal: controller.signal,
      ...opts,
    });
    clearTimeout(timeoutId);
    const ct = r.headers.get('content-type') || '';
    let body;
    try {
      body = ct.includes('application/json') ? await r.json() : await r.text();
    } catch {
      body = null;
    }
    if (!r.ok) {
      console.warn(`[api] ${r.status} ${path}:`, body);
      if (body && typeof body === 'object') return { ...body, _failed: true, _status: r.status };
      return { error: `HTTP ${r.status}`, _failed: true, _status: r.status };
    }
    return body ?? {};
  } catch (e) {
    console.warn(`[api] network error for ${path}:`, e?.message);
    return { error: e?.message || 'Network error', _failed: true, _network: true };
  }
};
