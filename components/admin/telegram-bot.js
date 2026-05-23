'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { api, fmt, fmtCurrency, safeArr, setArr } from '@/lib/page-shared';
import { TG_ROLES, TG_PERMS } from '@/lib/telegram-constants';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  LayoutDashboard, ShoppingCart, Package, Wrench, Users, Network, Camera,
  BarChart3, Sparkles, Settings, Search, Plus, Trash2, Edit2, Phone,
  Wifi, MapPin, Activity, AlertTriangle, TrendingUp, DollarSign, Zap,
  Send, Bot, Menu, Bell, ChevronLeft, ChevronRight, Box, CreditCard, FileText, X,
  CheckCircle2, Clock, AlertCircle, Globe, Smartphone, Headphones,
  HardDrive, Plug, Battery, ScanLine, Receipt, ShoppingBag, UserCheck,
  Building2, BarChart, PieChart as PieIcon, Boxes, ChevronDown, Printer, ListTodo, Check, XCircle, LogOut, MessageSquare, QrCode, Power, RefreshCw, Wallet, Brain
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart as RBarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadialBarChart, RadialBar
} from 'recharts';

export default function TelegramBotPage() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [webhookInfo, setWebhookInfo] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const blank = { telegramId: '', name: '', role: 'employee', permissions: ['employees'], enabled: true };
  const [form, setForm] = useState(blank);

  const load = async () => {
    const [u, l, w] = await Promise.all([
      api('telegram-users'),
      api('telegram-logs?limit=200'),
      api('telegram/webhook-info'),
    ]);
    if (Array.isArray(u)) setUsers(u);
    if (Array.isArray(l)) setLogs(l);
    setWebhookInfo(w);
  };
  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, []);

  const save = async () => {
    if (!form.telegramId || !form.name || !form.role) { toast.error('الحقول الأساسية مطلوبة'); return; }
    const r = editing
      ? await api(`telegram-users/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
      : await api('telegram-users', { method: 'POST', body: JSON.stringify(form) });
    if (r.error) toast.error(r.error);
    else { toast.success('✅ تم الحفظ'); setOpen(false); setEditing(null); setForm(blank); load(); }
  };
  const remove = async (id) => {
    if (!confirm('حذف هذا المستخدم؟')) return;
    await api(`telegram-users/${id}`, { method: 'DELETE' });
    toast.success('تم الحذف'); load();
  };
  const toggle = async (u) => {
    await api(`telegram-users/${u.id}`, { method: 'PUT', body: JSON.stringify({ enabled: !u.enabled }) });
    toast.success(u.enabled ? 'تم التعطيل' : 'تم التفعيل'); load();
  };
  const editUser = (u) => {
    setEditing(u);
    setForm({ telegramId: u.telegramId, name: u.name, role: u.role, permissions: u.permissions || [], enabled: u.enabled });
    setOpen(true);
  };

  const setupWebhook = async () => {
    const r = await api('telegram/setup-webhook', { method: 'POST' });
    if (r.success) {
      toast.success(r.message || '✅ تم ربط الويب هوك - البوت يعمل الآن', { duration: 6000 });
      load();
    } else {
      toast.error(r.message || ('فشل: ' + (r.response?.description || '')), { duration: 8000 });
    }
  };
  const deleteWebhook = async () => {
    if (!confirm('إيقاف الويب هوك؟ سيتوقف البوت عن العمل')) return;
    await api('telegram/delete-webhook', { method: 'POST' });
    toast.success('تم إيقاف الويب هوك'); load();
  };
  const onRoleChange = (role) => {
    const def = TG_ROLES.find(r => r.id === role);
    setForm({ ...form, role, permissions: def?.defaults || [] });
  };
  const togglePerm = (p) => {
    const perms = form.permissions.includes(p)
      ? form.permissions.filter(x => x !== p)
      : [...form.permissions, p];
    setForm({ ...form, permissions: perms });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black gold-text">✈️ بوت إحصائيات تيليجرام</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة Telegram IDs وصلاحيات البوت + سجلات الاستخدام</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={setupWebhook} className="btn-neon"><Plug className="w-4 h-4 ml-1" /> ربط الويب هوك</Button>
          <Button onClick={deleteWebhook} variant="outline" className="border-red-500/30 text-red-400">إيقاف</Button>
        </div>
      </div>

      {/* Webhook Status */}
      <Card className="glass-strong border-gold/40">
        <CardContent className="p-4 grid md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">حالة البوت</p>
            <p className="font-bold text-lg flex items-center gap-2">
              {webhookInfo?.result?.url ? <><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> <span className="text-emerald-400">يعمل</span></> : <><span className="w-2 h-2 rounded-full bg-red-400"></span> <span className="text-red-400">متوقف</span></>}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">المستخدمون المصرَّح بهم</p>
            <p className="font-bold gold-text text-2xl">{users.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">طلبات اليوم</p>
            <p className="font-bold neon-text text-2xl">{logs.filter(l => l.timestamp?.startsWith(new Date().toISOString().slice(0, 10))).length}</p>
          </div>
          {webhookInfo?.result?.url && (() => {
            const url = webhookInfo.result.url;
            const isVercel = url.includes('vercel.app');
            const isEmergent = url.includes('emergent.host');
            const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
            const platformLabel = isVercel ? '🚀 Vercel' : isEmergent ? '⚡ Emergent' : isLocal ? '🏠 Local' : '🌐 مخصص';
            const platformColor = isVercel ? 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10' :
                                   isEmergent ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' :
                                   isLocal ? 'text-red-400 border-red-500/40 bg-red-500/10' :
                                   'text-gold border-gold/40 bg-input/30';
            return (
              <div className="md:col-span-3 space-y-2">
                <div className={`flex items-center gap-2 p-3 rounded-lg border-2 ${platformColor}`}>
                  <span className="text-lg font-bold">{platformLabel}</span>
                  <span className="text-xs flex-1 text-right">
                    {isVercel && 'البوت متصل بنسخة Vercel — Production جاهز'}
                    {isEmergent && 'البوت متصل بنسخة Emergent — للاختبار'}
                    {isLocal && '⚠️ البوت متصل بـ localhost — لن يعمل خارج جهازك'}
                    {!isVercel && !isEmergent && !isLocal && 'البوت متصل بنطاق مخصص'}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono break-all p-2 bg-input/30 rounded">
                  🔗 <strong>الـ Webhook URL:</strong> {url}
                </div>
                {webhookInfo.result.pending_update_count > 0 && (
                  <p className="text-[10px] text-amber-400">⏳ في الانتظار: {webhookInfo.result.pending_update_count} رسالة</p>
                )}
                {webhookInfo.result.last_error_message && (
                  <p className="text-[10px] text-red-400">❌ آخر خطأ: {webhookInfo.result.last_error_message}</p>
                )}
              </div>
            );
          })()}
          {!webhookInfo?.result?.url && (
            <div className="md:col-span-3 p-3 rounded-lg border-2 border-amber-500/40 bg-amber-500/10">
              <p className="text-amber-400 font-bold text-sm mb-1">⚠️ البوت غير مربوط بعد</p>
              <p className="text-xs text-amber-200">اضغط زر <strong>"ربط الويب هوك"</strong> أعلاه ليبدأ البوت في استقبال الرسائل.</p>
              <p className="text-[10px] text-amber-300 mt-1">📌 يجب أن يكون <code className="bg-amber-500/20 px-1 rounded">TELEGRAM_BOT_TOKEN</code> و <code className="bg-amber-500/20 px-1 rounded">NEXT_PUBLIC_BASE_URL</code> مضبوطين في Vercel أولاً.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-input/30 border border-gold-soft">
          <TabsTrigger value="users">👥 المستخدمون ({users.length})</TabsTrigger>
          <TabsTrigger value="logs">📜 السجلات ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => { setEditing(null); setForm(blank); setOpen(true); }} className="btn-gold"><Plus className="w-4 h-4 ml-1" /> إضافة Telegram ID</Button>
          </div>

          {users.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">لا يوجد مستخدمون. أضف Telegram ID للبدء.</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {users.map(u => {
                const role = TG_ROLES.find(r => r.id === u.role);
                return (
                  <Card key={u.id} className={`glass-card border-gold-soft hover:border-gold/50 ${!u.enabled ? 'opacity-50' : ''}`}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">{u.name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{u.telegramId}</p>
                        </div>
                        <Badge className={u.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>{u.enabled ? '✅ مفعّل' : '⛔ معطّل'}</Badge>
                      </div>
                      <p className="text-xs">{role?.label || u.role}</p>
                      <div className="flex flex-wrap gap-1">
                        {(u.permissions || []).slice(0, 6).map(p => (
                          <span key={p} className="text-[9px] px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">{p}</span>
                        ))}
                        {u.permissions?.length > 6 && <span className="text-[9px] text-muted-foreground">+{u.permissions.length - 6}</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground space-y-0.5">
                        <p>📊 {u.totalRequests || 0} طلب</p>
                        {u.lastActivity && <p>🕐 آخر نشاط: {new Date(u.lastActivity).toLocaleString('ar-IQ')}</p>}
                        {u.failedAttempts > 0 && <p className="text-red-400">⚠️ محاولات فاشلة: {u.failedAttempts}</p>}
                      </div>
                      <div className="grid grid-cols-3 gap-1 pt-2 border-t border-gold-soft">
                        <Button size="sm" variant="ghost" onClick={() => editUser(u)} className="h-7 text-[10px]">تعديل</Button>
                        <Button size="sm" variant="ghost" onClick={() => toggle(u)} className="h-7 text-[10px]">{u.enabled ? 'تعطيل' : 'تفعيل'}</Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(u.id)} className="h-7 text-[10px] text-red-400">حذف</Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card className="glass-strong border-gold-soft">
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card/95 backdrop-blur">
                  <tr className="border-b border-gold-soft">
                    <th className="p-2 text-right">الحالة</th>
                    <th className="p-2 text-right">Telegram ID</th>
                    <th className="p-2 text-right">المستخدم</th>
                    <th className="p-2 text-right">الإجراء</th>
                    <th className="p-2 text-right">التفاصيل</th>
                    <th className="p-2 text-right">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} className="border-b border-gold-soft/30">
                      <td className="p-2">{l.success ? '✅' : '❌'}</td>
                      <td className="p-2 font-mono">{l.telegramId}</td>
                      <td className="p-2">{l.userName}</td>
                      <td className="p-2"><Badge className={l.action === 'unauthorized_access' ? 'bg-red-500/20 text-red-400 text-[9px]' : 'bg-cyan-500/20 text-cyan-400 text-[9px]'}>{l.action}</Badge></td>
                      <td className="p-2 text-muted-foreground">{l.details || '-'}</td>
                      <td className="p-2 text-[10px]">{new Date(l.timestamp).toLocaleString('ar-IQ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length === 0 && <p className="p-6 text-center text-muted-foreground text-xs">لا توجد سجلات</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-gold/40 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="gold-text">{editing ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Telegram ID *</Label><Input dir="ltr" type="text" value={form.telegramId} onChange={e => setForm({ ...form, telegramId: e.target.value })} className="bg-input/30 border-gold/20 font-mono" disabled={!!editing} /></div>
            <div><Label className="text-xs">الاسم *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div className="col-span-2">
              <Label className="text-xs">نوع الحساب *</Label>
              <Select value={form.role} onValueChange={onRoleChange}>
                <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                <SelectContent>{TG_ROLES.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">عند تغيير النوع، تُحدّث الصلاحيات افتراضياً، يمكنك تعديلها يدوياً</p>
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-2 block">الصلاحيات (يُحدد ما يظهر في البوت)</Label>
              <div className="grid md:grid-cols-2 gap-2">
                {TG_PERMS.map(p => {
                  const checked = form.permissions.includes(p.id);
                  return (
                    <button key={p.id} type="button" onClick={() => togglePerm(p.id)}
                      className={`text-right p-3 rounded-lg border transition-all ${checked ? 'bg-gold/10 border-gold' : 'bg-input/30 border-gold-soft'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold">{p.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{p.desc}</p>
                        </div>
                        <span className={`text-lg ${checked ? 'text-gold' : 'text-muted-foreground/30'}`}>{checked ? '✅' : '⬜'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="col-span-2">
              <Switch checked={form.enabled} onChange={v => setForm({ ...form, enabled: v })} label="🟢 الحساب مفعّل (إذا تم إيقافه لن يستطيع الدخول)" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} className="btn-gold w-full">{editing ? 'حفظ التعديلات' : 'إضافة المستخدم'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
