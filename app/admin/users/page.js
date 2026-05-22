'use client';
import { useState, useEffect } from 'react';
import AdminLayoutClient from '@/components/admin-layout-client';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Key, Power, ShieldCheck, ShieldOff, Users as UsersIcon, Search, Activity, ArrowRight } from 'lucide-react';

function UsersManagementPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pwReset, setPwReset] = useState(null);
  const [historyUser, setHistoryUser] = useState(null);

  const auth = (path, opts = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('gz_token') : null;
    return fetch(`/api/${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}), ...(opts.headers || {}) },
    }).then(r => r.json());
  };

  const load = async () => {
    setLoading(true);
    const r = await auth('users');
    setLoading(false);
    if (r?.error) { toast.error(r.error); return; }
    setUsers(Array.isArray(r) ? r : []);
  };
  useEffect(() => { load(); }, []);

  const filtered = users.filter(u =>
    !search ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = async (u) => {
    const r = await auth(`users/${u.id}/toggle-active`, { method: 'POST' });
    if (r?.error) { toast.error(r.error); return; }
    toast.success(r.active ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب');
    load();
  };

  const remove = async (u) => {
    if (!confirm(`حذف المستخدم ${u.name}؟ لا يمكن التراجع.`)) return;
    const r = await auth(`users/${u.id}`, { method: 'DELETE' });
    if (r?.error) { toast.error(r.error); return; }
    toast.success('تم الحذف');
    load();
  };

  const roleLabel = (r) => ({ super_admin: '👑 مدير عام', manager: '⭐ مدير', hr: '👥 موارد بشرية', agent: '🤝 وكيل', employee: '👤 موظف' }[r] || r);
  const roleColor = (r) => ({
    super_admin: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    manager: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
    hr: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    agent: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
    employee: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
  }[r] || 'bg-gray-500/20 text-gray-400 border-gray-500/40');

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white p-6 pt-16" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <a href="/" className="text-[#d4af37] hover:underline text-sm flex items-center gap-1"><ArrowRight className="w-4 h-4" /> العودة</a>
            <div className="w-px h-6 bg-white/10" />
            <h1 className="text-2xl font-black flex items-center gap-2 bg-gradient-to-r from-[#f4d35e] to-[#d4af37] bg-clip-text text-transparent">
              <UsersIcon className="w-6 h-6 text-[#d4af37]" /> إدارة المستخدمين
            </h1>
          </div>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-gradient-to-r from-[#b8860b] to-[#d4af37] text-black font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 hover:opacity-90 transition">
            <Plus className="w-4 h-4" /> مستخدم جديد
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ابحث بالاسم، اسم المستخدم، أو البريد..."
            className="w-full pr-10 pl-3 py-2.5 rounded-xl bg-black/40 border border-[#d4af37]/20 focus:border-[#d4af37] outline-none transition"
          />
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-12">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <UsersIcon className="w-16 h-16 mx-auto opacity-30 mb-3" />
            <p>لا يوجد مستخدمون مطابقون</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(u => (
              <div key={u.id} className={`bg-[#13131f] border ${u.active === false ? 'border-red-500/30 opacity-60' : 'border-[#d4af37]/20'} rounded-2xl p-4 hover:border-[#d4af37]/50 transition`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#d4af37] to-[#b8860b] text-black font-black flex items-center justify-center text-lg">
                      {u.avatar && u.avatar.startsWith('/') ? <img src={u.avatar} className="w-full h-full rounded-full object-cover" alt="" /> : (u.name || u.username).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-white truncate">{u.name}</h3>
                        {u.twoFactorEnabled && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" title="2FA مفعّل" />}
                        {u.active === false && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold">معطّل</span>}
                      </div>
                      <p className="text-xs text-gray-400 truncate">@{u.username} · {u.email || 'بلا بريد'}</p>
                      {u.lastLoginAt && (
                        <p className="text-[10px] text-gray-500 mt-0.5">آخر دخول: {new Date(u.lastLoginAt).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })} من {u.lastLoginIp || '?'}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-bold ${roleColor(u.role)}`}>{roleLabel(u.role)}</span>
                    <button onClick={() => setHistoryUser(u)} className="p-2 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-cyan-400 transition" title="سجل الدخول"><Activity className="w-4 h-4" /></button>
                    <button onClick={() => setPwReset(u)} className="p-2 rounded-lg bg-white/5 hover:bg-amber-500/20 text-amber-400 transition" title="إعادة تعيين كلمة المرور"><Key className="w-4 h-4" /></button>
                    <button onClick={() => { setEditing(u); setShowForm(true); }} className="p-2 rounded-lg bg-white/5 hover:bg-blue-500/20 text-blue-400 transition" title="تعديل"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => toggle(u)} disabled={u.id === me?.id} className="p-2 rounded-lg bg-white/5 hover:bg-purple-500/20 text-purple-400 disabled:opacity-30 transition" title={u.active === false ? 'تفعيل' : 'تعطيل'}><Power className="w-4 h-4" /></button>
                    {u.id !== me?.id && (
                      <button onClick={() => remove(u)} className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-red-400 transition" title="حذف"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && <UserForm me={me} user={editing} onClose={() => { setShowForm(false); setEditing(null); }} onSaved={() => { setShowForm(false); setEditing(null); load(); }} auth={auth} />}
      {pwReset && <PasswordResetDialog user={pwReset} onClose={() => setPwReset(null)} auth={auth} />}
      {historyUser && <LoginHistoryDialog user={historyUser} onClose={() => setHistoryUser(null)} auth={auth} />}
    </div>
  );
}

function UserForm({ me, user, onClose, onSaved, auth }) {
  const isEdit = !!user;
  const [form, setForm] = useState(user || { username: '', name: '', email: '', phone: '', role: 'employee', password: '', active: true, mustChangePassword: false });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const r = isEdit
      ? await auth(`users/${user.id}`, { method: 'PUT', body: JSON.stringify(form) })
      : await auth('users', { method: 'POST', body: JSON.stringify(form) });
    setSaving(false);
    if (r?.error) { toast.error(r.error); return; }
    toast.success(isEdit ? 'تم التحديث' : 'تم إنشاء المستخدم');
    onSaved();
  };

  const F = (k, l, type = 'text') => (
    <div>
      <label className="text-xs text-[#d4af37]/80 font-bold block mb-1">{l}</label>
      <input type={type} value={form[k] || ''} onChange={e => setForm({...form, [k]: e.target.value})}
        className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-[#d4af37]/20 focus:border-[#d4af37] outline-none transition"
        dir={type === 'password' || k === 'username' ? 'ltr' : 'rtl'} />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={onClose} dir="rtl">
      <div className="bg-gradient-to-br from-[#13131f] to-[#0f0f19] border border-[#d4af37]/40 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[#d4af37] mb-4 flex items-center gap-2">
          {isEdit ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {isEdit ? 'تعديل المستخدم' : 'مستخدم جديد'}
        </h2>
        <div className="space-y-3">
          {F('name', 'الاسم الكامل')}
          {F('username', 'اسم المستخدم')}
          {F('email', 'البريد الإلكتروني', 'email')}
          {F('phone', 'رقم الهاتف')}
          {!isEdit && F('password', 'كلمة المرور', 'password')}
          <div>
            <label className="text-xs text-[#d4af37]/80 font-bold block mb-1">الدور</label>
            <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-[#d4af37]/20 focus:border-[#d4af37] outline-none transition">
              {me?.role === 'super_admin' && <option value="super_admin">👑 مدير عام</option>}
              <option value="manager">⭐ مدير</option>
              <option value="hr">👥 موارد بشرية</option>
              <option value="agent">🤝 وكيل</option>
              <option value="employee">👤 موظف</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active !== false} onChange={e => setForm({...form, active: e.target.checked})} className="w-4 h-4 accent-[#d4af37]" />
            حساب نشط
          </label>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white transition">إلغاء</button>
          <button onClick={submit} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#b8860b] to-[#d4af37] text-black font-bold hover:opacity-90 disabled:opacity-50 transition">{saving ? 'جاري الحفظ...' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}

function PasswordResetDialog({ user, onClose, auth }) {
  const [pw, setPw] = useState('');
  const submit = async () => {
    if (pw.length < 6) { toast.error('6+ أحرف مطلوبة'); return; }
    const r = await auth(`users/${user.id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword: pw }) });
    if (r?.error) { toast.error(r.error); return; }
    toast.success('✅ تم إعادة تعيين كلمة المرور. سيُجبر المستخدم على تغييرها عند أول دخول.');
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4" onClick={onClose} dir="rtl">
      <div className="bg-[#13131f] border border-amber-500/40 rounded-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2 mb-3"><Key className="w-5 h-5" /> إعادة تعيين كلمة المرور</h3>
        <p className="text-xs text-gray-400 mb-3">للمستخدم <strong className="text-white">{user.name}</strong></p>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="كلمة المرور الجديدة (6+ أحرف)" className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-amber-500/30 focus:border-amber-500 outline-none mb-4" dir="ltr" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition">إلغاء</button>
          <button onClick={submit} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-bold hover:bg-amber-400 transition">إعادة التعيين</button>
        </div>
      </div>
    </div>
  );
}

function LoginHistoryDialog({ user, onClose, auth }) {
  const [items, setItems] = useState([]);
  useEffect(() => { auth(`users/${user.id}/login-history`).then(r => Array.isArray(r) && setItems(r)); }, [user.id]);
  return (
    <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4" onClick={onClose} dir="rtl">
      <div className="bg-[#13131f] border border-cyan-500/40 rounded-2xl max-w-xl w-full p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-cyan-400 mb-1 flex items-center gap-2"><Activity className="w-5 h-5" /> سجل الدخول</h3>
        <p className="text-xs text-gray-400 mb-4">{user.name} ({items.length} محاولة)</p>
        <div className="space-y-1.5 text-xs">
          {items.length === 0 ? <p className="text-center text-gray-500 py-6">لا توجد محاولات</p> : items.map(a => (
            <div key={a.id} className={`p-2.5 rounded-lg border ${a.success ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'} flex items-center justify-between gap-2`}>
              <div className="flex-1">
                <p className={`font-bold ${a.success ? 'text-emerald-400' : 'text-red-400'}`}>{a.success ? '✅ نجاح' : '❌ فشل'} · {a.browser} on {a.os}</p>
                <p className="text-[10px] text-gray-500 font-mono">{a.ip} · {a.device}</p>
              </div>
              <p className="text-[10px] text-gray-400 whitespace-nowrap">{new Date(a.ts).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })}</p>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-4 py-2.5 rounded-xl bg-cyan-500 text-black font-bold hover:bg-cyan-400 transition">إغلاق</button>
      </div>
    </div>
  );
}

export default function UsersPage() {
  return (
    <AdminLayoutClient>
      <UsersManagementPage />
    </AdminLayoutClient>
  );
}
