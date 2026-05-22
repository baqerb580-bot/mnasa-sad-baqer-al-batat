'use client';
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2, User, LogOut, Shield, KeyRound, Users, Smartphone, ChevronDown, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

// ===========================================================
// AdminLayoutClient — wraps children, enforces auth, provides
// header widget (user avatar + logout + settings + 2FA)
// ===========================================================

function HeaderUserWidget() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onClick = (e) => { if (!e.target.closest('[data-user-widget]')) setOpen(false); };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  if (!user) return null;

  const initials = (user.name || user.username || '').slice(0, 2).toUpperCase();
  const roleLabel = { super_admin: 'مدير عام', manager: 'مدير', hr: 'موارد بشرية', agent: 'وكيل', employee: 'موظف' }[user.role] || user.role;

  const doLogout = async () => {
    await logout();
    toast.success('تم تسجيل الخروج');
    router.replace('/admin/login');
  };

  return (
    <>
      <div className="fixed top-3 left-3 z-[80]" data-user-widget>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-[#d4af37]/30 hover:border-[#d4af37]/60 rounded-full px-3 py-1.5 shadow-lg transition group"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#d4af37] to-[#b8860b] text-black font-black text-xs flex items-center justify-center">
            {user.avatar && user.avatar.startsWith('/') ? <img src={user.avatar} className="w-full h-full rounded-full object-cover" alt="" /> : initials}
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-xs text-white font-bold leading-tight">{user.name}</div>
            <div className="text-[9px] text-[#d4af37] flex items-center gap-0.5">
              {user.twoFactorEnabled && <ShieldCheck className="w-2.5 h-2.5" />}
              {roleLabel}
            </div>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-[#d4af37] transition ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-2 w-64 bg-[#13131f] border border-[#d4af37]/30 rounded-2xl shadow-2xl overflow-hidden" dir="rtl">
            <div className="p-3 border-b border-[#d4af37]/10 bg-[#d4af37]/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d4af37] to-[#b8860b] text-black font-black flex items-center justify-center">
                  {user.avatar && user.avatar.startsWith('/') ? <img src={user.avatar} className="w-full h-full rounded-full" alt="" /> : initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{user.name}</div>
                  <div className="text-[10px] text-gray-400 truncate">{user.email || `@${user.username}`}</div>
                </div>
              </div>
              <div className="flex gap-1.5 mt-2.5 flex-wrap">
                <span className="text-[9px] bg-[#d4af37]/20 text-[#d4af37] px-2 py-0.5 rounded-full font-bold">{roleLabel}</span>
                {user.twoFactorEnabled ? (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><ShieldCheck className="w-2.5 h-2.5" /> 2FA مفعّل</span>
                ) : (
                  <span className="text-[9px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">2FA معطّل</span>
                )}
              </div>
            </div>
            <div className="p-1.5">
              <button onClick={() => { setOpen(false); setShowProfile(true); }} className="w-full text-right px-3 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2 text-sm text-gray-200 transition">
                <User className="w-4 h-4 text-gray-400" /> الملف الشخصي والأمان
              </button>
              <a href="/admin/users" onClick={() => setOpen(false)} className="w-full text-right px-3 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2 text-sm text-gray-200 transition">
                <Users className="w-4 h-4 text-gray-400" /> إدارة المستخدمين
              </a>
              <div className="border-t border-white/5 my-1.5" />
              <button onClick={doLogout} className="w-full text-right px-3 py-2 rounded-lg hover:bg-red-500/10 flex items-center gap-2 text-sm text-red-400 transition">
                <LogOut className="w-4 h-4" /> تسجيل الخروج
              </button>
            </div>
          </div>
        )}
      </div>
      {showProfile && <ProfileDialog onClose={() => setShowProfile(false)} />}
    </>
  );
}

// ===========================================================
// PROFILE / 2FA SETUP DIALOG
// ===========================================================
function ProfileDialog({ onClose }) {
  const { user, refresh } = useAuth();
  const [tab, setTab] = useState('profile');
  const [step, setStep] = useState('idle'); // for 2fa setup
  const [setupData, setSetupData] = useState(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });

  const auth = (path, opts = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('gz_token') : null;
    return fetch(`/api/${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}), ...(opts.headers || {}) },
    }).then(r => r.json());
  };

  const start2FA = async () => {
    const r = await auth('auth/2fa/setup', { method: 'POST' });
    if (r?.error) { toast.error(r.error); return; }
    setSetupData(r);
    setStep('verify');
  };

  const verify2FA = async () => {
    const r = await auth('auth/2fa/verify', { method: 'POST', body: JSON.stringify({ code }) });
    if (r?.error) { toast.error(r.error); return; }
    setRecoveryCodes(r.recoveryCodes);
    setStep('codes');
    refresh();
    toast.success('🎉 تم تفعيل المصادقة الثنائية');
  };

  const disable2FA = async () => {
    if (!disablePassword) { toast.error('أدخل كلمة المرور'); return; }
    const r = await auth('auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password: disablePassword }) });
    if (r?.error) { toast.error(r.error); return; }
    setDisablePassword('');
    refresh();
    toast.success('تم تعطيل المصادقة الثنائية');
  };

  const changePassword = async () => {
    if (pwForm.next !== pwForm.confirm) { toast.error('كلمتا المرور غير متطابقتين'); return; }
    if (pwForm.next.length < 6) { toast.error('كلمة المرور قصيرة (6+ أحرف)'); return; }
    const r = await auth('auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }) });
    if (r?.error) { toast.error(r.error); return; }
    setPwForm({ current: '', next: '', confirm: '' });
    toast.success('تم تغيير كلمة المرور — قد تحتاج لتسجيل الدخول مجدداً');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={onClose} dir="rtl">
      <div className="bg-gradient-to-br from-[#13131f] to-[#0f0f19] border border-[#d4af37]/40 rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#d4af37] flex items-center gap-2">
            <Shield className="w-5 h-5" /> الملف الشخصي والأمان
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="flex gap-1 mb-4 bg-black/40 p-1 rounded-lg">
          {[{k:'profile',l:'الملف'},{k:'password',l:'كلمة المرور'},{k:'2fa',l:'المصادقة الثنائية'}].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} className={`flex-1 py-2 text-xs rounded-md transition ${tab===t.k?'bg-[#d4af37] text-black font-bold':'text-gray-400 hover:text-white'}`}>{t.l}</button>
          ))}
        </div>

        {tab === 'profile' && (
          <div className="space-y-3 text-sm">
            <Field label="الاسم" value={user?.name} />
            <Field label="اسم المستخدم" value={user?.username} mono />
            <Field label="البريد الإلكتروني" value={user?.email || '-'} />
            <Field label="الدور" value={user?.role} />
            <Field label="آخر دخول" value={user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('ar-IQ') : '-'} />
            <Field label="IP" value={user?.lastLoginIp || '-'} mono />
            <Field label="الجهاز الحالي" value={user?.session ? `${user.session.browser} on ${user.session.os}` : '-'} />
          </div>
        )}

        {tab === 'password' && (
          <div className="space-y-3">
            <Input label="كلمة المرور الحالية" type="password" value={pwForm.current} onChange={v => setPwForm({...pwForm, current: v})} />
            <Input label="كلمة المرور الجديدة" type="password" value={pwForm.next} onChange={v => setPwForm({...pwForm, next: v})} />
            <Input label="تأكيد كلمة المرور" type="password" value={pwForm.confirm} onChange={v => setPwForm({...pwForm, confirm: v})} />
            <button onClick={changePassword} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#b8860b] to-[#d4af37] text-black font-bold hover:opacity-90 transition">تغيير كلمة المرور</button>
          </div>
        )}

        {tab === '2fa' && (
          <div className="space-y-3 text-sm">
            {user?.twoFactorEnabled ? (
              <div>
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
                  <ShieldCheck className="w-12 h-12 mx-auto text-emerald-400 mb-2" />
                  <p className="font-bold text-emerald-400">✅ المصادقة الثنائية مفعّلة</p>
                  <p className="text-[10px] text-gray-400 mt-1">رموز الاستعادة المتبقية: {user?.recoveryCodesRemaining ?? 0}</p>
                </div>
                <div className="mt-4 space-y-2">
                  <Input label="أدخل كلمة المرور للتعطيل" type="password" value={disablePassword} onChange={setDisablePassword} />
                  <button onClick={disable2FA} className="w-full py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 font-bold hover:bg-red-500/30 transition">تعطيل 2FA</button>
                </div>
              </div>
            ) : (
              <>
                {step === 'idle' && (
                  <div className="text-center">
                    <Smartphone className="w-12 h-12 mx-auto text-[#d4af37] mb-3" />
                    <h3 className="font-bold text-white mb-1">حماية إضافية لحسابك</h3>
                    <p className="text-xs text-gray-400 mb-4 leading-relaxed">فعّل المصادقة الثنائية باستخدام تطبيق مثل Google Authenticator أو Microsoft Authenticator أو Authy.</p>
                    <button onClick={start2FA} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#b8860b] to-[#d4af37] text-black font-bold hover:opacity-90 transition">ابدأ التفعيل</button>
                  </div>
                )}
                {step === 'verify' && setupData && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-400 text-center">امسح هذا الرمز عبر تطبيق المصادقة</p>
                    <div className="flex justify-center p-3 bg-white rounded-xl">
                      <img src={setupData.qrDataUrl} alt="QR" className="w-48 h-48" />
                    </div>
                    <div className="bg-black/40 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-gray-500">أو أدخل المفتاح يدوياً:</p>
                      <p className="text-xs font-mono text-[#d4af37] mt-0.5 break-all">{setupData.secret}</p>
                    </div>
                    <Input label="أدخل الرمز من تطبيقك (6 أرقام)" value={code} onChange={setCode} placeholder="123456" />
                    <button onClick={verify2FA} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#b8860b] to-[#d4af37] text-black font-bold hover:opacity-90 transition">تحقّق وفعّل</button>
                    <button onClick={() => setStep('idle')} className="w-full text-xs text-gray-400 hover:text-white">إلغاء</button>
                  </div>
                )}
                {step === 'codes' && recoveryCodes && (
                  <div className="space-y-3">
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">
                      ⚠️ <strong>احفظ هذه الرموز في مكان آمن</strong>. تستخدم مرة واحدة فقط لاستعادة حسابك إن فقدت تطبيق المصادقة.
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                      {recoveryCodes.map((c, i) => (
                        <div key={i} className="bg-black/60 border border-[#d4af37]/30 rounded-lg p-2 text-center text-[#d4af37]">{c}</div>
                      ))}
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(recoveryCodes.join('\n')); toast.success('تم النسخ'); }} className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white transition">📋 نسخ كل الرموز</button>
                    <button onClick={() => { setStep('idle'); setRecoveryCodes(null); onClose(); }} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#b8860b] to-[#d4af37] text-black font-bold hover:opacity-90 transition">حفظت الرموز - إنهاء</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-white/5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-sm text-white ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#d4af37]/80 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-[#d4af37]/20 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 outline-none text-white placeholder-gray-600 transition"
        dir={type === 'password' || /^\d/.test(value) ? 'ltr' : 'rtl'}
      />
    </div>
  );
}

// ===========================================================
// Main exported wrapper — used by admin pages
// ===========================================================
export default function AdminLayoutClient({ children }) {
  return (
    <AuthProvider>
      <AdminGate>{children}</AdminGate>
    </AuthProvider>
  );
}

function AdminGate({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user && typeof window !== 'undefined') {
      router.replace('/admin/login?next=' + encodeURIComponent(window.location.pathname));
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center text-[#d4af37]">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }
  return (
    <>
      {children}
      <HeaderUserWidget />
    </>
  );
}
