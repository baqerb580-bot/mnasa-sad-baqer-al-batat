'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0a0a0f', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ maxWidth: 560, width: '100%', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛑</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#FFD700', marginBottom: 8 }}>تعذّر تشغيل التطبيق</h1>
          <p style={{ fontSize: 13, color: '#aaa', marginBottom: 16, lineHeight: 1.7 }}>
            حدث خطأ جسيم. تأكد من إعداد متغيرات البيئة على المنصة، خاصة <code style={{ color: '#FFD700' }}>MONGO_URL</code>.
          </p>
          {error?.message && (
            <pre style={{ fontSize: 11, color: '#f87171', background: 'rgba(0,0,0,0.4)', padding: 10, borderRadius: 8, overflow: 'auto', textAlign: 'left', direction: 'ltr', marginBottom: 16 }}>{String(error.message).slice(0, 400)}</pre>
          )}
          <button
            onClick={() => reset()}
            style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#000', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
          >
            🔄 إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
