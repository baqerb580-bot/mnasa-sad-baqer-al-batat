'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthCtx = createContext({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  refresh: async () => {},
  token: null,
});

const TOKEN_KEY = 'gz_token';
const USER_KEY = 'gz_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Wrap fetch to auto-attach Authorization header
  const authFetch = useCallback(async (path, opts = {}) => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (stored) headers['Authorization'] = `Bearer ${stored}`;
    const url = path.startsWith('http') || path.startsWith('/api/') ? path : `/api/${path}`;
    const res = await fetch(url, { ...opts, headers, credentials: 'include' });
    return res;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
      if (!stored) { setUser(null); setToken(null); setLoading(false); return; }
      setToken(stored);
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${stored}` },
        credentials: 'include',
      });
      if (!res.ok) {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(USER_KEY);
        setUser(null); setToken(null);
      } else {
        const u = await res.json();
        setUser(u);
        window.localStorage.setItem(USER_KEY, JSON.stringify(u));
      }
    } catch (e) {
      console.warn('[auth] refresh failed:', e);
      setUser(null); setToken(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Restore from localStorage immediately for fast UX
    if (typeof window !== 'undefined') {
      const cachedUser = window.localStorage.getItem(USER_KEY);
      if (cachedUser) {
        try { setUser(JSON.parse(cachedUser)); } catch {}
      }
    }
    refresh();
  }, [refresh]);

  const login = useCallback(async (username, password, remember = true) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      // 🛑 Special handling for DB connection issues (Vercel deployments missing MONGO_URL)
      if (res.status === 503 || data?._dbNotConnected) {
        const msg = data?.error || '⚠️ قاعدة البيانات غير متصلة';
        const hint = data?._hint || 'افتح /setup للتشخيص الكامل';
        throw new Error(`${msg}\n\n💡 ${hint}`);
      }
      throw new Error(data?.error || 'فشل تسجيل الدخول');
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TOKEN_KEY, data.token);
      window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      // Also set cookie for SSR compatibility (30 days)
      const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
      document.cookie = `gz_token=${encodeURIComponent(data.token)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    }
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
      });
    } catch {}
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
      document.cookie = 'gz_token=; Path=/; Max-Age=0; SameSite=Lax';
    }
    setToken(null);
    setUser(null);
  }, [token]);

  return (
    <AuthCtx.Provider value={{ user, token, loading, login, logout, refresh, authFetch }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}

// Helper: requires the user to be authenticated, optionally with a minimum role
export function RequireAuth({ children, minRole, fallback = null }) {
  const { user, loading } = useAuth();
  if (loading) return fallback;
  if (!user) {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
      window.location.href = '/admin/login?next=' + encodeURIComponent(window.location.pathname);
    }
    return fallback;
  }
  if (minRole) {
    const levels = { super_admin: 100, manager: 80, hr: 60, agent: 50, employee: 30 };
    if ((levels[user.role] || 0) < (levels[minRole] || 0)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f0f19] text-white p-6" dir="rtl">
          <div className="text-center">
            <div className="text-6xl mb-3">🔒</div>
            <h2 className="text-2xl font-bold text-[#d4af37] mb-2">صلاحياتك لا تسمح</h2>
            <p className="text-sm text-gray-400">هذا القسم يتطلب صلاحية أعلى ({minRole})</p>
          </div>
        </div>
      );
    }
  }
  return children;
}
