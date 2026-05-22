'use client';
import { useState, useEffect } from 'react';

export default function SetupDiagnosticPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const runSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/setup', { cache: 'no-store' });
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e?.message || 'Network error');
    }
    setLoading(false);
  };

  useEffect(() => { runSetup(); }, []);

  const ok = (b) => b ? '✅' : '❌';
  const dbConnected = !!data?.database?.connected;
  const mongoSet = !!data?.env?.MONGO_URL_set;
  const ready = data?.status === '✅ Ready';

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a0a14] text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-6">
          <div className="inline-block bg-gradient-to-br from-[#d4af37] to-[#b8860b] rounded-2xl p-1 mb-3">
            <div className="bg-[#0a0a14] rounded-xl px-6 py-3">
              <h1 className="text-3xl font-black bg-gradient-to-r from-[#d4af37] to-[#f0c850] bg-clip-text text-transparent">
                🔧 تشخيص النظام
              </h1>
            </div>
          </div>
          <p className="text-gray-400 text-sm">مركز الغزلان ERP — Vercel Deployment Health Check</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block w-12 h-12 border-4 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin"></div>
            <p className="mt-4 text-sm text-gray-400">جاري التشخيص...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-6 mb-6">
            <p className="text-red-400 font-bold">❌ خطأ في الاتصال بـ API:</p>
            <p className="text-sm text-red-300 mt-1 font-mono">{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* Overall Status Banner */}
            <div className={`rounded-2xl p-6 mb-6 border-2 ${
              ready
                ? 'bg-emerald-500/10 border-emerald-500/50'
                : 'bg-amber-500/10 border-amber-500/50'
            }`}>
              <h2 className={`text-2xl font-bold flex items-center gap-3 ${ready ? 'text-emerald-400' : 'text-amber-400'}`}>
                {ready ? '✅ النظام جاهز للاستخدام' : '⚠️ النظام يحتاج إعداد'}
              </h2>
              {ready && (
                <div className="mt-4 grid md:grid-cols-3 gap-3">
                  <a href="/admin/login" className="bg-[#d4af37] text-black p-4 rounded-xl text-center font-bold hover:bg-[#f0c850] transition-all">
                    🛡️ تسجيل دخول المدير
                  </a>
                  <a href="/employee" className="bg-cyan-500 text-black p-4 rounded-xl text-center font-bold hover:bg-cyan-400 transition-all">
                    👔 بوابة الموظفين
                  </a>
                  <a href="/" className="bg-purple-500 text-white p-4 rounded-xl text-center font-bold hover:bg-purple-400 transition-all">
                    🏠 لوحة الإدارة
                  </a>
                </div>
              )}
              {ready && (
                <div className="mt-4 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/30">
                  <p className="text-emerald-300 text-sm font-bold mb-2">🔑 بيانات الدخول الافتراضية:</p>
                  <p className="text-emerald-200 text-sm font-mono">المستخدم: <strong>admin</strong></p>
                  <p className="text-emerald-200 text-sm font-mono">كلمة السر: <strong>admin1982</strong></p>
                </div>
              )}
            </div>

            {/* Environment Variables Status */}
            <div className="bg-zinc-900/50 border border-zinc-700 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-bold mb-4 text-[#d4af37]">⚙️ Environment Variables</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-lg">
                  <span className="font-mono">MONGO_URL</span>
                  <span className={mongoSet ? 'text-emerald-400' : 'text-red-400'}>
                    {ok(mongoSet)} {mongoSet ? `(${data.env.MONGO_URL_type})` : 'مفقود'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-lg">
                  <span className="font-mono">DB_NAME</span>
                  <span className={data.env.DB_NAME_set ? 'text-emerald-400' : 'text-amber-400'}>
                    {data.env.DB_NAME}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-lg">
                  <span className="font-mono">NEXT_PUBLIC_BASE_URL</span>
                  <span className="text-gray-300 text-xs font-mono break-all">{data.env.NEXT_PUBLIC_BASE_URL}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-lg">
                  <span className="font-mono">VERCEL</span>
                  <span className={data.env.VERCEL ? 'text-emerald-400' : 'text-gray-400'}>
                    {data.env.VERCEL ? '✅ Yes' : '❌ Local'}
                  </span>
                </div>
              </div>
            </div>

            {/* Database Status */}
            <div className="bg-zinc-900/50 border border-zinc-700 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-bold mb-4 text-[#d4af37]">🗄️ Database Connection</h3>
              <div className={`p-4 rounded-lg border ${dbConnected ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-red-500/10 border-red-500/40'}`}>
                <p className="text-lg font-bold mb-2">
                  {dbConnected ? '✅ متصل بنجاح' : '❌ غير متصل'}
                </p>
                {!dbConnected && !mongoSet && (
                  <p className="text-sm text-red-300">⚠️ يجب إضافة <code className="bg-red-500/20 px-2 py-0.5 rounded">MONGO_URL</code> في Vercel Environment Variables</p>
                )}
                {!dbConnected && mongoSet && (
                  <p className="text-sm text-amber-300">⚠️ MONGO_URL مضافة لكن الاتصال فشل — تحقق من IP Whitelist (0.0.0.0/0) في MongoDB Atlas</p>
                )}
              </div>
              {data.collections && Object.keys(data.collections).length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(data.collections).map(([name, count]) => (
                    <div key={name} className="bg-zinc-800/50 p-3 rounded-lg text-center">
                      <p className="text-[10px] text-gray-400">{name}</p>
                      <p className="font-bold text-lg text-[#d4af37]">{count}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Auth Test */}
            {data.auth_test && Object.keys(data.auth_test).length > 0 && (
              <div className="bg-zinc-900/50 border border-zinc-700 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-bold mb-4 text-[#d4af37]">🔐 اختبار تسجيل الدخول</h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(data.auth_test).map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-lg">
                      <span className="font-mono text-xs">{key}</span>
                      <span className={String(val).includes('✅') ? 'text-emerald-400' : 'text-red-400'}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seed Results */}
            {data.seed?.seeded?.length > 0 && (
              <div className="bg-cyan-500/10 border border-cyan-500/40 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-bold mb-3 text-cyan-400">🌱 الحسابات التي تم إنشاؤها</h3>
                <ul className="space-y-1">
                  {data.seed.seeded.map(s => (
                    <li key={s} className="text-cyan-200 font-mono text-sm">✅ {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Setup Instructions (only if not ready) */}
            {!ready && (
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-2 border-amber-500/40 rounded-2xl p-6 mb-6">
                <h3 className="text-xl font-bold mb-4 text-amber-400">📋 خطوات الإعداد المطلوبة</h3>

                {!mongoSet && (
                  <div className="space-y-4">
                    <p className="text-amber-200 mb-4">⚠️ يجب إعداد قاعدة البيانات MongoDB Atlas وإضافة المتغيرات في Vercel:</p>

                    <div className="bg-black/40 rounded-xl p-4 space-y-3">
                      <div>
                        <p className="font-bold text-amber-300 mb-1">1️⃣ أنشئ MongoDB Atlas (مجاناً)</p>
                        <a href="https://www.mongodb.com/cloud/atlas/register" target="_blank" rel="noopener" className="text-cyan-400 hover:underline text-sm">
                          → mongodb.com/cloud/atlas/register
                        </a>
                      </div>

                      <div>
                        <p className="font-bold text-amber-300 mb-1">2️⃣ اختر M0 Free Cluster + سجّل username/password</p>
                        <p className="text-gray-400 text-xs">⚠️ احفظ كلمة السر في مكان آمن</p>
                      </div>

                      <div>
                        <p className="font-bold text-amber-300 mb-1">3️⃣ Network Access → أضف IP: <code className="bg-amber-500/20 px-2 py-0.5 rounded">0.0.0.0/0</code></p>
                        <p className="text-gray-400 text-xs">مهم جداً — Vercel ما يقدر يتصل بدون هذا</p>
                      </div>

                      <div>
                        <p className="font-bold text-amber-300 mb-1">4️⃣ Connect → Drivers → انسخ Connection String</p>
                        <p className="text-gray-400 text-xs font-mono">mongodb+srv://user:pass@cluster.xxx.mongodb.net/...</p>
                      </div>

                      <div>
                        <p className="font-bold text-amber-300 mb-1">5️⃣ في Vercel Dashboard → Settings → Environment Variables:</p>
                        <div className="bg-black/50 rounded p-3 mt-2 space-y-1 text-xs font-mono">
                          <p><span className="text-cyan-400">MONGO_URL</span> = <span className="text-gray-300">(الـ string من الخطوة 4 مع كلمة السر)</span></p>
                          <p><span className="text-cyan-400">DB_NAME</span> = <span className="text-gray-300">ghazlan_erp</span></p>
                          <p><span className="text-cyan-400">NEXT_PUBLIC_BASE_URL</span> = <span className="text-gray-300">https://your-app.vercel.app</span></p>
                        </div>
                      </div>

                      <div>
                        <p className="font-bold text-amber-300 mb-1">6️⃣ Vercel → Deployments → آخر deployment → ⋯ → Redeploy</p>
                      </div>

                      <div>
                        <p className="font-bold text-amber-300 mb-1">7️⃣ ارجع لهذه الصفحة وحدّث</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Refresh button */}
            <div className="text-center mt-8">
              <button
                onClick={runSetup}
                className="bg-[#d4af37] text-black px-6 py-3 rounded-xl font-bold hover:bg-[#f0c850] transition-all"
              >
                🔄 إعادة الفحص
              </button>
            </div>

            {/* Raw JSON (collapsible) */}
            <details className="mt-8 bg-zinc-900/30 rounded-lg p-4">
              <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-200">📄 عرض البيانات الخام (JSON)</summary>
              <pre className="mt-3 text-xs text-gray-400 overflow-auto max-h-96 bg-black/50 p-3 rounded">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
