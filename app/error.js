'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('[App Error Boundary]', error);
  }, [error]);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'system-ui, sans-serif' }} dir="rtl">
      <div style={{ maxWidth: 560, width: '100%', background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.25)', borderRadius: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#FFD700', marginBottom: 8 }}>حدث خطأ غير متوقع</h1>
        <p style={{ fontSize: 13, color: '#aaa', marginBottom: 16, lineHeight: 1.7 }}>
          عذراً، حدث خلل أثناء تحميل الصفحة. قد يكون السبب اتصال مؤقت بقاعدة البيانات.
          يمكنك المحاولة مرة أخرى، أو الرجوع للصفحة الرئيسية.
        </p>
        {error?.message && (
          <pre style={{ fontSize: 11, color: '#f87171', background: 'rgba(0,0,0,0.4)', padding: 10, borderRadius: 8, overflow: 'auto', textAlign: 'left', direction: 'ltr', marginBottom: 16 }}>
            {String(error.message).slice(0, 400)}
            {error?.digest && `\n\nDigest: ${error.digest}`}
          </pre>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => reset()}
            style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#000', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
          >
            🔄 إعادة المحاولة
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
