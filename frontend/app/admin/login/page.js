'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { Eye, EyeOff, LogIn, Loader2, Shield, ShieldCheck, KeyRound, User } from 'lucide-react';
import { toast } from 'sonner';

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { login, user, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);

  // If already logged in, redirect
  useEffect(() => {
    if (!loading && user) {
      const next = sp?.get('next') || '/';
      router.replace(next);
    }
  }, [user, loading, router, sp]);

  // Restore remembered username
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const u = window.localStorage.getItem('gz_remember_user');
      if (u) setUsername(u);
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password, remember);
      if (remember && typeof window !== 'undefined') {
        window.localStorage.setItem('gz_remember_user', username.trim());
      } else if (!remember && typeof window !== 'undefined') {
        window.localStorage.removeItem('gz_remember_user');
      }
      toast.success(`🎉 مرحباً بك مجدداً ${username.trim()}`);
      const next = sp?.get('next') || '/';
      router.replace(next);
    } catch (e) {
      const msg = e?.message || 'فشل تسجيل الدخول';
      setError(msg);
      // If DB is not connected, show a clearer toast with link to /setup
      if (msg.includes('قاعدة البيانات') || msg.includes('MONGO_URL') || msg.includes('غير متصلة')) {
        toast.error('⚠️ قاعدة البيانات غير معدّة — افتح /setup للتشخيص', { duration: 10000 });
      } else {
        toast.error(msg);
      }
    }
    setSubmitting(false);
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#0a0a14]">
      {/* Animated gold mesh background */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-0 -left-32 w-[600px] h-[600px] bg-[#d4af37]/30 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 -right-32 w-[600px] h-[600px] bg-[#b8860b]/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#f0c850]/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '0.8s' }} />
      </div>

      {/* Pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #d4af37 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo header */}
        <div className="text-center mb-8">
          <div className="inline-block relative mb-4">
            <div className="absolute inset-0 bg-[#d4af37]/30 rounded-full blur-2xl animate-pulse" />
            <img
              src="/logo-icon.png"
              alt="مركز الغزلان"
              className="relative w-24 h-24 object-contain drop-shadow-[0_0_30px_rgba(212,175,55,0.5)]"
            />
          </div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-[#f4d35e] via-[#d4af37] to-[#b8860b] bg-clip-text text-transparent mb-1">
            مركز الغزلان
          </h1>
          <p className="text-xs text-gray-500 tracking-widest font-mono">ERP · NOC · POS · AI</p>
        </div>

        {/* Card */}
        <div className="relative">
          {/* Gold border glow */}
          <div className="absolute -inset-px bg-gradient-to-r from-[#d4af37]/40 via-[#f4d35e]/20 to-[#d4af37]/40 rounded-3xl blur-sm" />

          <div className="relative bg-gradient-to-br from-[#13131f] via-[#0f0f19] to-[#13131f] border border-[#d4af37]/30 rounded-3xl p-7 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#d4af37]" />
                  تسجيل الدخول الآمن
                </h2>
                <p className="text-xs text-gray-500 mt-1">ادخل بياناتك للوصول إلى المنصة</p>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {/* Username */}
              <div className="relative group">
                <label className="block text-xs font-bold text-[#d4af37]/80 mb-1.5">
                  اسم المستخدم
                </label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-[#d4af37] transition" />
                  <input
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="superadmin"
                    className="w-full pr-10 pl-3 py-3 rounded-xl bg-black/40 border border-[#d4af37]/20 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 outline-none text-white placeholder-gray-600 transition"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="relative group">
                <label className="block text-xs font-bold text-[#d4af37]/80 mb-1.5">
                  كلمة المرور
                </label>
                <div className="relative">
                  <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-[#d4af37] transition" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-10 pl-10 py-3 rounded-xl bg-black/40 border border-[#d4af37]/20 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 outline-none text-white placeholder-gray-600 transition font-mono"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#d4af37] transition"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none text-gray-300 hover:text-white transition">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#d4af37]"
                  />
                  تذكّرني
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-[#d4af37]/80 hover:text-[#d4af37] hover:underline transition"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="text-xs bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg p-2.5 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="relative w-full py-3.5 rounded-xl bg-gradient-to-r from-[#b8860b] via-[#d4af37] to-[#f4d35e] hover:from-[#a07509] hover:via-[#c4a030] hover:to-[#e4c350] text-black font-black text-base shadow-lg shadow-[#d4af37]/20 transition disabled:opacity-60 disabled:cursor-not-allowed group overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> جاري الدخول...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" /> دخول آمن
                    </>
                  )}
                </span>
                <span className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition" />
              </button>
            </form>

            {/* Security note */}
            <div className="mt-5 pt-5 border-t border-[#d4af37]/10 text-center">
              <p className="text-[10px] text-gray-500 flex items-center justify-center gap-1.5">
                <Shield className="w-3 h-3 text-emerald-400" />
                اتصال مشفّر · bcrypt + Sessions · حماية ضد محاولات الاختراق
              </p>
              {/* Setup helper link — only shown if there's a DB error */}
              {error && (error.includes('قاعدة البيانات') || error.includes('MONGO_URL') || error.includes('null')) && (
                <a
                  href="/setup"
                  className="inline-flex items-center gap-1.5 mt-3 text-xs text-amber-400 hover:text-amber-300 underline"
                >
                  🔧 افتح صفحة التشخيص والإعداد
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-gray-600 mt-6">
          © {new Date().getFullYear()} مركز الغزلان · جميع الحقوق محفوظة
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowForgot(false)}
        >
          <div
            className="bg-gradient-to-br from-[#13131f] to-[#0f0f19] border border-[#d4af37]/40 rounded-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <h3 className="text-lg font-bold text-[#d4af37] mb-3 flex items-center gap-2">
              🔑 استعادة كلمة المرور
            </h3>
            <div className="text-sm text-gray-300 space-y-2.5 leading-relaxed">
              <p>لاستعادة كلمة المرور، يجب التواصل مع <strong className="text-[#d4af37]">المدير العام</strong>:</p>
              <ul className="space-y-1.5 text-xs text-gray-400 mr-4 list-disc">
                <li>سيقوم المدير بإعادة تعيين كلمة مرور مؤقتة لك</li>
                <li>ستُجبر على تغييرها عند أول دخول</li>
                <li>كل المحاولات الفاشلة تُسجَّل تلقائياً</li>
              </ul>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-3 text-xs text-amber-300">
                💡 <strong>للمدير العام:</strong> إن نسيت كلمة المرور، ادخل إلى MongoDB مباشرة وأعد ضبط <code className="bg-black/30 px-1 rounded">users.passwordHash</code> أو احذف السجل وأعد تشغيل السيرفر لإعادة إنشاء الحساب الافتراضي.
              </div>
            </div>
            <button
              onClick={() => setShowForgot(false)}
              className="mt-5 w-full bg-[#d4af37] hover:bg-[#c4a030] text-black font-bold py-2.5 rounded-xl transition"
            >
              فهمت
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="min-h-screen bg-[#0a0a14] flex items-center justify-center text-[#d4af37]"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
        <LoginForm />
      </Suspense>
    </AuthProvider>
  );
}
