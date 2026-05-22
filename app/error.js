'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('[App Error Boundary]', error);

    // Self-healing: if this error looks like a stale-cache issue
    // (something is "not defined" or undefined), force-update the SW
    // and clear all caches so the next reload gets fresh code.
    const msg = String(error?.message || '');
    const isStaleCacheError =
      /is not defined|Cannot read prop|Loading chunk|ChunkLoadError|Unexpected token/i.test(msg);

    if (isStaleCacheError && typeof window !== 'undefined') {
      (async () => {
        try {
          // Unregister all service workers
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
          }
          // Clear all caches
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
          console.log('[Self-Heal] Caches cleared, will reload in 1.5s');
          setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
          console.error('[Self-Heal] failed:', e);
        }
      })();
    }
  }, [error]);

  const msg = String(error?.message || '');
  const isStaleCacheError = /is not defined|Cannot read prop|Loading chunk|ChunkLoadError|Unexpected token/i.test(msg);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'system-ui, sans-serif' }} dir="rtl">
      <div style={{ maxWidth: 560, width: '100%', background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.25)', borderRadius: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{isStaleCacheError ? '🔄' : '⚠️'}</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#FFD700', marginBottom: 8 }}>
          {isStaleCacheError ? 'جاري تحديث النسخة…' : 'حدث خطأ غير متوقع'}
        </h1>
        <p style={{ fontSize: 13, color: '#aaa', marginBottom: 16, lineHeight: 1.7 }}>
          {isStaleCacheError
            ? 'تم اكتشاف نسخة قديمة في الذاكرة. جاري مسح المؤقت وتحميل النسخة الجديدة تلقائياً…'
            : 'عذراً، حدث خلل أثناء تحميل الصفحة. قد يكون السبب اتصال مؤقت بقاعدة البيانات.'}
        </p>
        {error?.message && (
          <pre style={{ fontSize: 11, color: '#f87171', background: 'rgba(0,0,0,0.4)', padding: 10, borderRadius: 8, overflow: 'auto', textAlign: 'left', direction: 'ltr', marginBottom: 16 }}>
            {String(error.message).slice(0, 400)}
            {error?.digest && `\n\nDigest: ${error.digest}`}
          </pre>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={async () => {
              // Manual recovery button: clear everything and reload
              try {
                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  await Promise.all(regs.map(r => r.unregister()));
                }
                if ('caches' in window) {
                  const keys = await caches.keys();
                  await Promise.all(keys.map(k => caches.delete(k)));
                }
              } catch {}
              window.location.reload();
            }}
            style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#000', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
          >
            🔄 إعادة تحميل النسخة الجديدة
          </button>
          <a
            href="/"
            style={{ background: 'transparent', color: '#FFD700', border: '1px solid rgba(255,215,0,0.4)', padding: '10px 20px', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}
          >
            🏠 الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}
