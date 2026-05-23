'use client';

import { useState, useEffect, useRef } from 'react';
import { GPSMap } from '@/components/maps-barcode';
import { whatsappLink } from '@/lib/messaging';
import { sounds } from '@/lib/sounds';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { toast, Toaster } from 'sonner';
import {
  User, Lock, LogIn, LogOut, Activity, Calendar, Clock,
  CheckCircle2, AlertCircle, X, Bell, Star, Upload, Image as ImageIcon,
  Check, XCircle, FileText, Send, ListTodo, Wallet, Home, Award,
  Wrench, ShoppingCart, BadgeCheck, Users, Camera, CalendarDays, Printer,
  Plus
} from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('en-US');
function formatLateDuration(minutes) {
  const m = Math.max(0, Math.floor(minutes || 0));
  if (m === 0) return '';
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (hours === 0) return `${mins} دقيقة`;
  if (mins === 0) return hours === 1 ? 'ساعة واحدة' : hours === 2 ? 'ساعتان' : `${hours} ساعات`;
  const hourPart = hours === 1 ? 'ساعة واحدة' : hours === 2 ? 'ساعتان' : `${hours} ساعات`;
  return `${hourPart} و ${mins} دقيقة`;
}
const getToken = () => {
  try {
    const s = typeof window !== 'undefined' ? localStorage.getItem('emp_session') : null;
    return s ? (JSON.parse(s).token || '') : '';
  } catch { return ''; }
};
const api = async (path, opts = {}) => {
  const headers = { 'Content-Type': 'application/json', 'X-Emp-Token': getToken(), ...(opts.headers || {}) };
  const r = await fetch(`/api/${path}`, { ...opts, headers });
  return r.json();
};
const uploadFile = async (file) => {
  try {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/upload', {
      method: 'POST',
      body: fd,
      headers: { 'X-Emp-Token': getToken() }, // ⚠️ Don't set Content-Type — browser sets multipart boundary
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      let json = {}; try { json = JSON.parse(text); } catch {}
      throw new Error(json?.error || `فشل الرفع (HTTP ${r.status})`);
    }
    const data = await r.json();
    if (!data.success || !data.url) throw new Error(data?.error || 'لم يتم استلام رابط الصورة');
    return data;
  } catch (e) {
    return { error: e?.message || 'فشل رفع الصورة — تحقق من الاتصال' };
  }
};

// ============================== LOGIN ==============================
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!username || !password) { toast.error('املأ الحقول'); return; }
    setLoading(true);
    const r = await api('employees/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    setLoading(false);
    if (r.error) { toast.error(r.error); return; }
    localStorage.setItem('emp_session', JSON.stringify({ employee: r.employee, token: r.token }));
    toast.success('✅ تم الدخول');
    onLogin(r.employee);
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-background grid-pattern p-4">
      <Card className="glass-strong border-gold/40 w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gold-gradient flex items-center justify-center text-3xl font-black animate-pulse-glow mb-3">غ</div>
          <CardTitle className="gold-text text-2xl">لوحة الموظف</CardTitle>
          <p className="text-xs text-muted-foreground">مركز الغزلان - HR Portal</p>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div>
            <Label className="text-xs">اسم المستخدم</Label>
            <div className="relative mt-1">
              <User className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gold" />
              <Input value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="username" className="pr-10 bg-input/30 border-gold/20 font-mono" dir="ltr" />
            </div>
          </div>
          <div>
            <Label className="text-xs">كلمة المرور</Label>
            <div className="relative mt-1">
              <Lock className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gold" />
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="password" className="pr-10 bg-input/30 border-gold/20 font-mono" dir="ltr" />
            </div>
          </div>
          <Button onClick={submit} disabled={loading} className="btn-gold w-full h-12">
            {loading ? 'جاري الدخول...' : <><LogIn className="w-4 h-4 ml-2" /> دخول</>}
          </Button>
          <p className="text-[10px] text-center text-muted-foreground">
            تواصل مع المدير للحصول على بيانات الدخول
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================== NOTIFICATIONS BELL ==============================
const NOTIF_COLORS = {
  task_new: 'border-cyan-500/30 bg-cyan-500/5',
  task_accepted: 'border-emerald-500/30 bg-emerald-500/5',
  task_rejected: 'border-red-500/30 bg-red-500/5',
  task_submitted: 'border-purple-500/30 bg-purple-500/5',
  task_approve: 'border-emerald-500/30 bg-emerald-500/5',
  task_reject: 'border-red-500/30 bg-red-500/5',
  task_revise: 'border-orange-500/30 bg-orange-500/5',
  leave_request: 'border-cyan-500/30 bg-cyan-500/5',
  leave_approve: 'border-emerald-500/30 bg-emerald-500/5',
  leave_reject: 'border-red-500/30 bg-red-500/5',
  advance_request: 'border-amber-500/30 bg-amber-500/5',
  advance_approve: 'border-emerald-500/30 bg-emerald-500/5',
  advance_reject: 'border-red-500/30 bg-red-500/5',
  attendance_late: 'border-orange-500/30 bg-orange-500/5',
};
const playBeep = () => {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start(); o.stop(ctx.currentTime + 0.4);
  } catch {}
};

function EmpThemeToggle() {
  const [theme, setTheme] = useState('dark');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('app_theme') || 'dark';
    setTheme(saved);
    if (saved === 'light') document.documentElement.classList.add('theme-light');
    else document.documentElement.classList.remove('theme-light');
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('app_theme', next); } catch {}
    if (next === 'light') document.documentElement.classList.add('theme-light');
    else document.documentElement.classList.remove('theme-light');
    sounds.click();
    toast.success(next === 'light' ? '☀️ الثيم الفاتح' : '🌙 الثيم الداكن');
  };
  return (
    <Button
      variant="ghost"
      onClick={toggle}
      className="hover:bg-gold/10 px-2 gap-1.5 h-9"
      title={theme === 'dark' ? 'تبديل إلى الثيم الفاتح' : 'تبديل إلى الثيم الداكن'}
    >
      <span className="text-base">{theme === 'dark' ? '☀️' : '🌙'}</span>
      <span className="hidden sm:inline text-[10px] font-bold">{theme === 'dark' ? 'فاتح' : 'داكن'}</span>
    </Button>
  );
}

function NotificationsBell({ employeeId, onTaskClick }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const lastCountRef = useRef(0);
  const load = async () => {
    if (!employeeId) return;
    const data = await api(`notifications?userId=${employeeId}`);
    if (Array.isArray(data)) {
      setItems(data);
      const unread = data.filter(n => !n.read).length;
      if (unread > lastCountRef.current && lastCountRef.current > 0) playBeep();
      lastCountRef.current = unread;
    }
  };
  useEffect(() => {
    load();
    const i = setInterval(load, 15000);
    return () => clearInterval(i);
  }, [employeeId]);
  const unread = items.filter(n => !n.read).length;
  const markRead = async (id) => { await api(`notifications/${id}/read`, { method: 'POST' }); load(); };
  const markAllRead = async () => { await api('notifications/read-all', { method: 'POST', body: JSON.stringify({ userId: employeeId }) }); load(); };
  return (
    <div className="relative">
      <Button onClick={() => setOpen(!open)} variant="ghost" size="icon" className="relative">
        <Bell className={`w-5 h-5 text-gold ${unread > 0 ? 'animate-pulse' : ''}`} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold animate-bounce">{unread}</span>
        )}
      </Button>
      {open && (
        <div className="absolute top-12 left-0 w-80 max-h-96 overflow-y-auto glass-strong border border-gold/30 rounded-xl shadow-2xl z-50">
          <div className="p-3 border-b border-gold-soft flex justify-between items-center">
            <p className="text-sm font-bold gold-text">الإشعارات</p>
            {unread > 0 && <button onClick={markAllRead} className="text-[10px] text-cyan-400 hover:underline">قراءة الكل</button>}
          </div>
          {items.length === 0 ? (
            <p className="p-6 text-xs text-center text-muted-foreground">لا توجد إشعارات</p>
          ) : items.map(n => {
            const colorCls = NOTIF_COLORS[n.type] || 'border-gold-soft/30';
            return (
              <div key={n.id} onClick={() => { markRead(n.id); if (n.taskId && onTaskClick) onTaskClick(n.taskId); setOpen(false); }}
                className={`p-3 border-l-4 border-b border-gold-soft/30 cursor-pointer hover:bg-input/20 ${colorCls} ${!n.read ? 'font-semibold' : ''}`}>
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-1 w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0 animate-pulse" />}
                  <div className="flex-1">
                    <p className="text-xs font-bold">{n.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-[9px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString('ar-IQ')}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================== TASK CARD ==============================
const STATUS_META = {
  pending: { label: 'بانتظار القبول', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  new: { label: 'بانتظار القبول', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  in_progress: { label: 'جاري العمل', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  pending_review: { label: 'بانتظار مراجعة المدير', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  completed: { label: '✅ مقبولة', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  rejected_by_employee: { label: 'رفضتَها', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  rejected_by_manager: { label: '❌ مرفوضة من المدير', color: 'bg-red-500/30 text-red-300 border-red-500/40' },
  revision: { label: '🔄 إعادة تعديل', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
};
const PRIORITY_META = {
  high: { label: '🔴 عالية', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  medium: { label: '🟡 متوسطة', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  low: { label: '🟢 منخفضة', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
};

function TaskCard({ task, onAccept, onReject, onComplete, onShareLocation, onEditSubLocation, onCallSub }) {
  const meta = STATUS_META[task.status] || STATUS_META.pending;
  const prio = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const isSubTask = task.taskType === 'subscriber_repair';
  return (
    <Card className={`glass-card ${isSubTask ? 'border-cyan-500/40 ring-1 ring-cyan-500/20' : 'border-gold-soft'}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <h3 className="font-bold text-base flex items-center gap-2">
              {isSubTask && <span className="text-cyan-400">🔧</span>}
              {task.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
          </div>
          <Badge className={prio.color + ' text-[10px] whitespace-nowrap'}>{prio.label}</Badge>
        </div>

        {/* Subscriber info block */}
        {isSubTask && task.subscriberName && (
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-xs space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-bold">👤 {task.subscriberName}</span>
              {task.subscriberPhone && (
                <Button size="sm" className="h-6 text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white px-2" onClick={() => onCallSub && onCallSub(task)}>
                  📞 اتصال
                </Button>
              )}
            </div>
            {task.subscriberPhone && (
              <p className="font-mono text-[10px] text-muted-foreground" dir="ltr">{task.subscriberPhone}</p>
            )}
            {task.subscriberAddress && <p className="text-[10px]">📍 {task.subscriberAddress}</p>}
            {task.faultDescription && <p className="text-[10px] text-red-400">⚠️ {task.faultDescription}</p>}
            {(task.subscriberLat && task.subscriberLng) && (
              <div className="mt-2 grid grid-cols-2 gap-1">
                <a href={`https://waze.com/ul?ll=${task.subscriberLat},${task.subscriberLng}&navigate=yes`} target="_blank" rel="noreferrer">
                  <Button size="sm" className="h-7 w-full text-[10px] bg-cyan-500 hover:bg-cyan-600 text-white">🚗 Waze</Button>
                </a>
                <a href={`https://www.google.com/maps?q=${task.subscriberLat},${task.subscriberLng}`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" className="h-7 w-full text-[10px] border-cyan-500/30">🗺️ Maps</Button>
                </a>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>📅 {task.dueDate}</span>
          <span>👤 من: {task.createdBy}</span>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1"><span>التقدم</span><span className="font-bold">{task.progress || 0}%</span></div>
          <Progress value={task.progress || 0} className="h-2" />
        </div>

        <Badge className={meta.color + ' w-full justify-center py-2 text-xs'}>{meta.label}</Badge>

        {/* Pending → Accept/Reject */}
        {(task.status === 'pending' || task.status === 'new') && (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => onAccept(task)} className="btn-gold h-9 text-xs"><Check className="w-3 h-3 ml-1" /> قبول</Button>
            <Button onClick={() => onReject(task)} variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-9 text-xs"><XCircle className="w-3 h-3 ml-1" /> رفض</Button>
          </div>
        )}

        {/* In progress → Complete + share location + edit subscriber location (only subscriber_repair) */}
        {(task.status === 'in_progress' || task.status === 'revision') && (
          <div className="space-y-2">
            {isSubTask && (
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => onShareLocation && onShareLocation(task)} size="sm" variant="outline" className="h-8 text-[10px] border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400">
                  🛰️ مشاركة موقعي
                </Button>
                <Button onClick={() => onEditSubLocation && onEditSubLocation(task)} size="sm" variant="outline" className="h-8 text-[10px] border-amber-500/30 hover:bg-amber-500/10 text-amber-400">
                  📍 تعديل موقع المشترك
                </Button>
              </div>
            )}
            <Button onClick={() => onComplete(task)} className="btn-neon w-full"><Send className="w-4 h-4 ml-1" /> إنهاء المهمة وإرسال التقرير</Button>
          </div>
        )}

        {/* Show revision notes */}
        {task.status === 'revision' && task.review?.notes && (
          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-xs">
            <p className="font-bold text-orange-400 mb-1">📝 ملاحظات المدير:</p>
            <p>{task.review.notes}</p>
          </div>
        )}

        {/* Rejection reason (own) */}
        {task.status === 'rejected_by_employee' && task.rejectionReason && (
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs">
            <p className="font-bold text-red-400 mb-1">سبب رفضك:</p>
            <p>{task.rejectionReason}</p>
          </div>
        )}

        {/* Manager review */}
        {(task.status === 'completed' || task.status === 'rejected_by_manager') && task.review && (
          <div className="p-2 rounded-lg bg-input/30 border border-gold-soft text-xs space-y-1">
            <p className="font-bold gold-text">📋 تقييم المدير</p>
            {task.review.notes && <p className="text-muted-foreground">{task.review.notes}</p>}
            {task.review.rating && (
              <div className="grid grid-cols-2 gap-1 mt-2 text-[10px]">
                <div className="flex justify-between"><span>السرعة:</span> <span className="font-bold">{'⭐'.repeat(task.review.rating.speed || 0)}</span></div>
                <div className="flex justify-between"><span>الجودة:</span> <span className="font-bold">{'⭐'.repeat(task.review.rating.quality || 0)}</span></div>
                <div className="flex justify-between"><span>الالتزام:</span> <span className="font-bold">{'⭐'.repeat(task.review.rating.commitment || 0)}</span></div>
                <div className="flex justify-between"><span>عدم التأخير:</span> <span className="font-bold">{'⭐'.repeat(task.review.rating.delay || 0)}</span></div>
              </div>
            )}
          </div>
        )}

        {/* Submitted report preview */}
        {task.status === 'pending_review' && task.report && (
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs">
            <p className="font-bold text-purple-400 mb-1">📤 تقريرك أُرسل</p>
            <p className="text-muted-foreground line-clamp-2">{task.report.summary}</p>
            {task.report.attachments?.length > 0 && <p className="text-[10px] mt-1">📎 {task.report.attachments.length} مرفق</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================== REJECT DIALOG ==============================
function RejectDialog({ task, open, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-strong border-gold/40">
        <DialogHeader><DialogTitle className="text-red-400">رفض المهمة</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">المهمة: <span className="font-bold">{task?.title}</span></p>
        <div>
          <Label className="text-xs">سبب الرفض *</Label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} className="bg-input/30 border-gold/20 h-24 mt-1" placeholder="اشرح بشكل واضح سبب عدم قدرتك على تنفيذ المهمة..." />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => { if (reason.trim().length < 3) { toast.error('السبب قصير جداً'); return; } onSubmit(reason); }} className="bg-red-500 hover:bg-red-600 text-white">إرسال الرفض</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================== COMPLETE TASK DIALOG ==============================
function CompleteDialog({ task, open, onClose, onSubmit }) {
  const [summary, setSummary] = useState('');
  const [notes, setNotes] = useState('');
  const [problems, setProblems] = useState('');
  const [progress, setProgress] = useState(100);
  const [files, setFiles] = useState([]); // [{url,name,size}]
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  useEffect(() => { if (open) { setSummary(''); setNotes(''); setProblems(''); setProgress(task?.progress || 100); setFiles([]); } }, [open, task]);

  const handleFiles = async (e) => {
    const list = Array.from(e.target.files || []);
    if (list.length === 0) return;
    setUploading(true);
    for (const f of list) {
      const r = await uploadFile(f);
      if (r.error) toast.error('فشل رفع: ' + f.name);
      else setFiles(prev => [...prev, { url: r.url, name: r.name, size: r.size, mime: r.mime }]);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };
  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-strong border-gold/40 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="gold-text">إنهاء المهمة - تقرير الإنجاز</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">المهمة: <span className="font-bold">{task?.title}</span></p>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">شرح ما تم إنجازه *</Label>
            <Textarea value={summary} onChange={e => setSummary(e.target.value)} className="bg-input/30 border-gold/20 h-20 mt-1" placeholder="اشرح بالتفصيل ما أنجزته..." />
          </div>
          <div>
            <Label className="text-xs">ملاحظات إضافية</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="bg-input/30 border-gold/20 h-16 mt-1" placeholder="ملاحظات للمدير..." />
          </div>
          <div>
            <Label className="text-xs">المشاكل التي واجهتك</Label>
            <Textarea value={problems} onChange={e => setProblems(e.target.value)} className="bg-input/30 border-gold/20 h-16 mt-1" placeholder="عوائق، مواد ناقصة، تأخير..." />
          </div>
          <div>
            <Label className="text-xs">نسبة الإنجاز: <span className="font-bold gold-text">{progress}%</span></Label>
            <input type="range" min="0" max="100" value={progress} onChange={e => setProgress(Number(e.target.value))} className="w-full mt-2 accent-amber-500" />
          </div>

          <div>
            <Label className="text-xs flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> صور / ملفات الإنجاز
            </Label>
            <input ref={fileRef} type="file" multiple accept="image/*,application/pdf,.doc,.docx" onChange={handleFiles} className="hidden" />
            <Button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} variant="outline" className="w-full mt-1 border-gold/30 hover:bg-gold/10">
              <Upload className="w-4 h-4 ml-1" /> {uploading ? 'جاري الرفع...' : 'اختر ملفات (صور قبل/بعد، توقيع، PDF)'}
            </Button>
            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {files.map((f, i) => {
                  const url = f.url || '';
                  const mime = f.mime || '';
                  const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(url) || url.includes('/api/files/') || mime.startsWith('image/');
                  return (
                    <div key={i} className="relative p-2 rounded-lg bg-input/30 border border-gold/20 group">
                      {isImage ? (
                        <img
                          src={f.url}
                          alt={f.name}
                          className="w-full h-20 object-cover rounded"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-20 flex items-center justify-center"><FileText className="w-8 h-8 text-cyan-400" /></div>
                      )}
                      <p className="text-[9px] truncate mt-1">{f.name}</p>
                      <button onClick={() => removeFile(i)} className="absolute top-1 right-1 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100"><X className="w-3 h-3 text-white" /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button
            onClick={() => {
              if (summary.trim().length < 3) { toast.error('شرح الإنجاز مطلوب'); return; }
              onSubmit({ summary, notes, problems, progress, attachments: files });
            }}
            className="btn-gold flex-1">
            <Send className="w-4 h-4 ml-1" /> إرسال التقرير
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================== TASKS SECTION ==============================
function TasksSection({ employeeId }) {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [rejectTask, setRejectTask] = useState(null);
  const [completeTask, setCompleteTask] = useState(null);
  const [editLocTask, setEditLocTask] = useState(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const liveLocRef = useRef({ taskId: null, watchId: null });

  const load = async () => {
    const t = await api(`employees/${employeeId}/tasks`);
    if (Array.isArray(t)) setTasks(t);
  };
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [employeeId]);

  const accept = async (task) => {
    const r = await api(`tasks/${task.id}/accept`, { method: 'POST', body: JSON.stringify({ employeeId }) });
    if (r.error) toast.error(r.error); else { sounds.success(); toast.success('✅ تم قبول المهمة'); load(); }
  };
  const submitReject = async (reason) => {
    const r = await api(`tasks/${rejectTask.id}/reject`, { method: 'POST', body: JSON.stringify({ employeeId, reason }) });
    if (r.error) toast.error(r.error); else { toast.success('تم إرسال الرفض للمدير'); setRejectTask(null); load(); }
  };
  const submitComplete = async (payload) => {
    const r = await api(`tasks/${completeTask.id}/complete`, { method: 'POST', body: JSON.stringify({ employeeId, ...payload }) });
    if (r.error) toast.error(r.error); else {
      sounds.success();
      toast.success('✅ تم إرسال التقرير للمدير');
      setCompleteTask(null);
      // Stop live location tracking if this was the tracked task
      if (liveLocRef.current.taskId === completeTask.id && liveLocRef.current.watchId !== null) {
        try { navigator.geolocation.clearWatch(liveLocRef.current.watchId); } catch {}
        liveLocRef.current = { taskId: null, watchId: null };
      }
      load();
    }
  };

  // Share live location for a task
  const shareLocation = (task) => {
    if (!('geolocation' in navigator)) {
      toast.error('المتصفح لا يدعم تحديد الموقع');
      return;
    }
    toast.info('📡 جاري الحصول على موقعك...');
    // First get a quick fix
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const r = await api(`employees/${employeeId}/location`, {
        method: 'POST',
        body: JSON.stringify({ lat: latitude, lng: longitude, accuracy, taskId: task.id, source: 'task_share' }),
      });
      if (r?.error) { toast.error(r.error); return; }
      sounds.success();
      toast.success(`✅ تم إرسال موقعك (دقة ${Math.round(accuracy || 0)}م)`);
      load();
      // Start live tracking watch
      if (liveLocRef.current.watchId !== null) {
        try { navigator.geolocation.clearWatch(liveLocRef.current.watchId); } catch {}
      }
      const watchId = navigator.geolocation.watchPosition(async (p) => {
        try {
          await api(`employees/${employeeId}/location`, {
            method: 'POST',
            body: JSON.stringify({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, taskId: task.id, source: 'live' }),
          });
        } catch {}
      }, () => {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
      liveLocRef.current = { taskId: task.id, watchId };
    }, (err) => {
      toast.error('فشل الحصول على الموقع: ' + (err.message || 'غير معروف'));
    }, { enableHighAccuracy: true, timeout: 15000 });
  };

  const callSub = (task) => {
    if (task.subscriberPhone) window.open(`tel:${task.subscriberPhone}`, '_self');
  };

  const counts = {
    all: tasks.length,
    pending: tasks.filter(t => ['pending', 'new'].includes(t.status)).length,
    in_progress: tasks.filter(t => ['in_progress', 'revision'].includes(t.status)).length,
    pending_review: tasks.filter(t => t.status === 'pending_review').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    rejected: tasks.filter(t => ['rejected_by_employee', 'rejected_by_manager'].includes(t.status)).length,
  };
  const filtered = filter === 'all' ? tasks
    : filter === 'pending' ? tasks.filter(t => ['pending', 'new'].includes(t.status))
    : filter === 'in_progress' ? tasks.filter(t => ['in_progress', 'revision'].includes(t.status))
    : tasks.filter(t => t.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { k: 'all', l: 'الكل', c: counts.all },
            { k: 'pending', l: '🟡 بانتظار القبول', c: counts.pending },
            { k: 'in_progress', l: '🔵 جاري العمل', c: counts.in_progress },
            { k: 'pending_review', l: '🟣 بانتظار المراجعة', c: counts.pending_review },
            { k: 'completed', l: '✅ مكتملة', c: counts.completed },
            { k: 'rejected', l: '❌ مرفوضة', c: counts.rejected },
          ].map(b => (
            <button key={b.k} onClick={() => setFilter(b.k)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${filter === b.k ? 'bg-gold/20 border-gold text-gold' : 'bg-input/30 border-gold-soft text-muted-foreground hover:text-gold'}`}>
              {b.l} ({b.c})
            </button>
          ))}
        </div>
        <Button onClick={() => setAddTaskOpen(true)} className="btn-gold h-8 px-3 text-xs">
          <Plus className="w-3.5 h-3.5 ml-1" /> مهمة شخصية
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <ListTodo className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">لا توجد مهام في هذه الفئة</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map(t => (
            <TaskCard key={t.id} task={t}
              onAccept={accept}
              onReject={setRejectTask}
              onComplete={setCompleteTask}
              onShareLocation={shareLocation}
              onEditSubLocation={setEditLocTask}
              onCallSub={callSub}
            />
          ))}
        </div>
      )}

      <RejectDialog task={rejectTask} open={!!rejectTask} onClose={() => setRejectTask(null)} onSubmit={submitReject} />
      <CompleteDialog task={completeTask} open={!!completeTask} onClose={() => setCompleteTask(null)} onSubmit={submitComplete} />
      <EditSubscriberLocationDialog task={editLocTask} employeeId={employeeId} open={!!editLocTask} onClose={() => setEditLocTask(null)} />
      <AddSelfTaskDialog
        open={addTaskOpen}
        employeeId={employeeId}
        onClose={() => setAddTaskOpen(false)}
        onCreated={() => { setAddTaskOpen(false); load(); }}
      />
    </div>
  );
}

// ============================== ADD SELF-TASK DIALOG ==============================
function AddSelfTaskDialog({ open, employeeId, onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium',
    dueDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({
      title: '', description: '', priority: 'medium',
      dueDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10),
    });
  }, [open]);

  const submit = async () => {
    if (!form.title.trim()) { toast.error('يرجى إدخال عنوان المهمة'); return; }
    setSaving(true);
    const r = await api(`employees/${employeeId}/tasks/create`, {
      method: 'POST',
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (r?.error) { toast.error(r.error); return; }
    sounds.success();
    toast.success('✅ تم إنشاء المهمة الشخصية وإشعار المدير');
    onCreated && onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-strong border-gold/40 max-w-md">
        <DialogHeader>
          <DialogTitle className="gold-text flex items-center gap-2">
            <Plus className="w-4 h-4" /> مهمة شخصية جديدة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">عنوان المهمة *</Label>
            <Input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="مثال: صيانة جهاز موزّع 4G"
              className="bg-input/30 border-gold/20"
            />
          </div>
          <div>
            <Label className="text-xs">الوصف</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="تفاصيل العمل المطلوب..."
              className="bg-input/30 border-gold/20 min-h-20"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">الأولوية</Label>
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">🟢 منخفضة</SelectItem>
                  <SelectItem value="medium">🟡 متوسطة</SelectItem>
                  <SelectItem value="high">🟠 عالية</SelectItem>
                  <SelectItem value="urgent">🔴 عاجلة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">تاريخ الإنجاز</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={e => setForm({ ...form, dueDate: e.target.value })}
                className="bg-input/30 border-gold/20"
              />
            </div>
          </div>
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-[11px] text-cyan-300">
            💡 سيتم إشعار المدير بهذه المهمة فور الإنشاء، وستُضاف مباشرة إلى قائمة "جاري العمل".
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} disabled={saving} className="btn-gold">
            {saving ? 'جاري الحفظ...' : <><Send className="w-4 h-4 ml-1" /> إنشاء المهمة</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================== EDIT SUBSCRIBER LOCATION DIALOG ==============================
function EditSubscriberLocationDialog({ task, employeeId, open, onClose }) {
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && task) {
      setLat(task.subscriberLat ?? null);
      setLng(task.subscriberLng ?? null);
      setNotes('');
    }
  }, [open, task]);

  if (!task) return null;

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) { toast.error('المتصفح لا يدعم GPS'); return; }
    toast.info('📡 جاري قراءة موقعك...');
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
      toast.success(`✅ تم تحديد الموقع (دقة ${Math.round(pos.coords.accuracy)}م)`);
      sounds.success();
    }, (err) => toast.error('فشل: ' + err.message), { enableHighAccuracy: true, timeout: 15000 });
  };

  const submit = async () => {
    if (lat === null || lng === null) { toast.error('حدد الموقع أولاً'); return; }
    setBusy(true);
    const r = await api('location-update-requests', {
      method: 'POST',
      body: JSON.stringify({
        subscriberId: task.subscriberId,
        newLat: Number(lat),
        newLng: Number(lng),
        employeeId,
        employeeName: task.assignedToName,
        taskId: task.id,
        notes,
      }),
    });
    setBusy(false);
    if (r?.error) { toast.error(r.error); return; }
    toast.success('✅ تم إرسال طلب التعديل للمدير');
    sounds.success();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-strong border-amber-500/40 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-amber-400 flex items-center gap-2">📍 تعديل موقع المشترك - {task.subscriberName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded bg-input/30 border border-gold-soft">
              <p className="text-muted-foreground text-[10px]">الموقع القديم</p>
              <p className="font-mono" dir="ltr">{task.subscriberLat?.toFixed?.(5) || '-'}, {task.subscriberLng?.toFixed?.(5) || '-'}</p>
            </div>
            <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-muted-foreground text-[10px]">الموقع الجديد</p>
              <p className="font-mono text-emerald-400" dir="ltr">{lat?.toFixed?.(5) || '-'}, {lng?.toFixed?.(5) || '-'}</p>
            </div>
          </div>

          <Button onClick={useMyLocation} className="w-full btn-neon">
            🛰️ استخدام موقعي الحالي (GPS)
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Latitude</Label>
              <Input type="number" step="0.000001" value={lat ?? ''} onChange={e => setLat(e.target.value === '' ? null : Number(e.target.value))} className="bg-input/30 border-gold/20 font-mono" dir="ltr" />
            </div>
            <div>
              <Label className="text-xs">Longitude</Label>
              <Input type="number" step="0.000001" value={lng ?? ''} onChange={e => setLng(e.target.value === '' ? null : Number(e.target.value))} className="bg-input/30 border-gold/20 font-mono" dir="ltr" />
            </div>
          </div>

          {(lat && lng) && <GPSMap lat={Number(lat)} lng={Number(lng)} label={`${task.subscriberName} (مقترح)`} height={250} />}

          <div>
            <Label className="text-xs">ملاحظات للمدير</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="مثلاً: الموقع المسجل خاطئ، الموقع الصحيح هو..." className="bg-input/30 border-gold/20 h-20" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} disabled={busy || lat === null || lng === null} className="btn-gold flex-1">
            {busy ? '...' : '📤 إرسال طلب التعديل للمدير'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================== CAMERA ATTENDANCE MODAL ==============================
function CameraModal({ open, mode, onClose, onCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      // Stop stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      return;
    }
    (async () => {
      setError('');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 480 } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        setError('تعذّر تشغيل الكاميرا: ' + e.message);
      }
    })();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [open]);

  const snapAndUpload = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setBusy(true);
    try {
      const v = videoRef.current;
      const c = canvasRef.current;
      c.width = v.videoWidth || 480;
      c.height = v.videoHeight || 480;
      const ctx = c.getContext('2d');
      ctx.drawImage(v, 0, 0, c.width, c.height);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, c.height - 30, c.width, 30);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText(new Date().toLocaleString('ar-IQ'), 10, c.height - 10);
      const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
      const file = new File([blob], `att_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const r = await uploadFile(file);
      if (r.error) { toast.error(r.error); setBusy(false); return; }
      // Try to get geolocation (optional, doesn't block)
      let lat = null, lng = null;
      try {
        const pos = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error('no geolocation'));
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: true });
        });
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch (e) { /* ignore - GPS optional */ }
      onCapture(r.url, lat, lng);
    } catch (e) {
      toast.error('فشل الالتقاط: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-strong border-gold/40 max-w-md">
        <DialogHeader>
          <DialogTitle className="gold-text">
            {mode === 'in' ? '📸 صورة الحضور' : '📸 صورة الانصراف'}
          </DialogTitle>
        </DialogHeader>
        {error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
        ) : (
          <>
            <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-gold-soft">
              <video ref={videoRef} className="w-full" playsInline muted />
              <div className="absolute inset-0 border-[3px] border-gold/30 rounded-2xl pointer-events-none" />
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <p className="text-[10px] text-center text-muted-foreground">📍 ضع وجهك في الإطار - سيتم حفظ الصورة مع الوقت</p>
          </>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>إلغاء</Button>
          <Button onClick={snapAndUpload} disabled={busy || !!error} className="btn-gold flex-1">
            <Camera className="w-4 h-4 ml-1" /> {busy ? 'جاري الرفع...' : 'التقاط وتسجيل'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================== ATTENDANCE BANNER ==============================
function AttendanceBanner({ employee, todayAtt, onRefresh }) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState('in');
  const [serverTime, setServerTime] = useState(null);

  // 🕐 Fetch authoritative Baghdad time from server every 30s
  useEffect(() => {
    let alive = true;
    const fetchTime = async () => {
      try {
        const r = await api('server-time');
        if (alive && r?.localTime) setServerTime(r);
      } catch {}
    };
    fetchTime();
    const interval = setInterval(fetchTime, 30000);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  // Local ticking clock that increments every second using server offset
  const [tickTime, setTickTime] = useState('--:--');
  useEffect(() => {
    if (!serverTime) return;
    const offset = serverTime.epoch - Date.now(); // server vs client clock skew
    const update = () => {
      const adjusted = new Date(Date.now() + offset);
      // Convert to Baghdad HH:MM:SS
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: serverTime.timezone || 'Asia/Baghdad',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      });
      const parts = {}; for (const p of fmt.formatToParts(adjusted)) if (p.type !== 'literal') parts[p.type] = p.value;
      setTickTime(`${parts.hour}:${parts.minute}:${parts.second}`);
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, [serverTime]);

  // Compute time-until-shift-start (or how late they are)
  const shiftInfo = (() => {
    if (!employee?.shiftStart || !serverTime) return null;
    const [sh, sm] = String(employee.shiftStart).split(':').map(Number);
    const shiftMin = sh * 60 + sm;
    const [nh, nm] = tickTime.split(':').map(Number);
    if (isNaN(nh)) return null;
    const nowMin = nh * 60 + nm;
    const diff = nowMin - shiftMin;
    return { shiftStart: employee.shiftStart, diff };
  })();

  const handleCapture = async (photoUrl, lat, lng) => {
    setCameraOpen(false);
    if (cameraMode === 'in') {
      const r = await api('attendance/checkin', { method: 'POST', body: JSON.stringify({ employeeId: employee.id, photoUrl, lat, lng }) });
      if (r.error) toast.error(r.error);
      else { toast.success(r.record?.isLate ? `⏰ حضور متأخر بـ ${formatLateDuration(r.record.lateMinutes)}` : '✅ تم تسجيل الحضور'); onRefresh(); }
    } else {
      const r = await api('attendance/checkout', { method: 'POST', body: JSON.stringify({ employeeId: employee.id, photoUrl, lat, lng }) });
      if (r.error) toast.error(r.error);
      else { toast.success(`✅ تم الانصراف - عملت ${r.hoursWorked} ساعة`); onRefresh(); }
    }
  };

  // Format check-in time: prefer stored Baghdad time, fallback to UTC conversion
  const formatCheckTime = (rec, kind = 'in') => {
    if (kind === 'in' && rec?.checkInLocal) return rec.checkInLocal;
    if (kind === 'out' && rec?.checkOutLocal) return rec.checkOutLocal;
    const iso = kind === 'in' ? rec?.checkIn : rec?.checkOut;
    if (!iso) return '--:--';
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Baghdad', hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(new Date(iso));
    } catch { return '--:--'; }
  };

  return (
    <>
      {/* 🕐 Baghdad time clock — always visible */}
      <div className="bg-zinc-900/80 border-b border-cyan-500/30 px-4 py-2 flex items-center justify-center gap-4 flex-wrap text-xs">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400">🕐 وقت بغداد:</span>
          <span className="font-mono font-bold text-cyan-300 text-base">{tickTime}</span>
        </div>
        {employee?.shiftStart && (
          <div className="text-muted-foreground">
            <span>بدء الدوام:</span> <span className="font-mono font-bold text-amber-300">{employee.shiftStart}</span>
            {shiftInfo && shiftInfo.diff < 0 && !todayAtt && (
              <span className="mr-2 text-emerald-400">• متبقي {Math.abs(shiftInfo.diff)} دقيقة</span>
            )}
            {shiftInfo && shiftInfo.diff > 10 && !todayAtt && (
              <span className="mr-2 text-red-400 font-bold animate-pulse">⚠️ متأخر {shiftInfo.diff} دقيقة</span>
            )}
            {shiftInfo && shiftInfo.diff >= 0 && shiftInfo.diff <= 10 && !todayAtt && (
              <span className="mr-2 text-amber-400">• ضمن فترة السماح</span>
            )}
          </div>
        )}
      </div>

      {!todayAtt ? (
        <div className="bg-amber-500/10 border-y border-amber-500/30 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-amber-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> يجب تسجيل الحضور بصورة قبل البدء بالعمل</p>
          <Button onClick={() => { setCameraMode('in'); setCameraOpen(true); }} className="btn-gold">
            <Camera className="w-4 h-4 ml-1 animate-pulse" /> بصمة حضور بالصورة
          </Button>
        </div>
      ) : !todayAtt.checkOut ? (
        <div className="bg-emerald-500/10 border-y border-emerald-500/30 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            أنت حالياً في الدوام - بدأت في <span className="font-mono font-bold mx-1">{formatCheckTime(todayAtt, 'in')}</span> (بغداد)
            {todayAtt.isLate && (
              <span className="text-red-400 font-bold">• تأخير {todayAtt.lateMinutes}د</span>
            )}
          </p>
          <Button onClick={() => { setCameraMode('out'); setCameraOpen(true); }} className="btn-neon">
            <Camera className="w-4 h-4 ml-1" /> بصمة انصراف بالصورة
          </Button>
        </div>
      ) : (
        <div className="bg-purple-500/10 border-y border-purple-500/30 px-4 py-3 text-center text-sm text-purple-400">
          ✅ تم إنهاء الدوام اليومي - شكراً لك! (انصرفت في <span className="font-mono font-bold">{formatCheckTime(todayAtt, 'out')}</span>)
        </div>
      )}
      <CameraModal open={cameraOpen} mode={cameraMode} onClose={() => setCameraOpen(false)} onCapture={handleCapture} />
    </>
  );
}

// ============================== HOME ==============================
function HomeTab({ employee, todayAtt, tasks, payroll }) {
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const pendingAcceptance = tasks.filter(t => ['pending', 'new'].includes(t.status)).length;
  const activeTasks = tasks.filter(t => ['in_progress', 'revision'].includes(t.status)).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card"><p className="text-xs text-muted-foreground">ساعات اليوم</p><p className="text-2xl font-bold gold-text">{todayAtt?.hoursWorked || (todayAtt?.checkIn && !todayAtt?.checkOut ? ((Date.now() - new Date(todayAtt.checkIn)) / 3600000).toFixed(1) : 0)}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">بانتظار القبول</p><p className="text-2xl font-bold text-amber-400">{pendingAcceptance}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">قيد العمل</p><p className="text-2xl font-bold neon-text">{activeTasks}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">منجزة</p><p className="text-2xl font-bold text-emerald-400">{completedTasks}</p></div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="glass-strong border-gold-soft">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4 text-gold" /> سجل حضور اليوم</CardTitle></CardHeader>
          <CardContent>
            {todayAtt ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="glass-card rounded-lg p-3 text-center"><p className="text-[10px] text-muted-foreground">الدخول</p><p className="text-lg font-bold text-emerald-400 font-mono">{new Date(todayAtt.checkIn).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</p></div>
                <div className="glass-card rounded-lg p-3 text-center"><p className="text-[10px] text-muted-foreground">الخروج</p><p className="text-lg font-bold text-cyan-400 font-mono">{todayAtt.checkOut ? new Date(todayAtt.checkOut).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) : '—'}</p></div>
                <div className="glass-card rounded-lg p-3 text-center"><p className="text-[10px] text-muted-foreground">الحالة</p><Badge className={todayAtt.status === 'late' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}>{todayAtt.status === 'late' ? `متأخر ${formatLateDuration(todayAtt.lateMinutes)}` : 'حاضر'}</Badge></div>
              </div>
            ) : <p className="text-sm text-muted-foreground text-center py-2">لم يتم تسجيل حضور بعد</p>}
          </CardContent>
        </Card>

        <Card className="glass-strong border-gold-soft">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Award className="w-4 h-4 text-purple-400" /> أدائي</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">KPI</span>
              <span className="text-2xl font-bold text-purple-400">{employee.kpi || 0}%</span>
            </div>
            <Progress value={employee.kpi || 0} className="h-2" />
            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gold-soft">
              <div>
                <p className="text-muted-foreground">المهام المنجزة</p>
                <p className="font-bold text-emerald-400">{employee.tasksCompleted || completedTasks}</p>
              </div>
              <div>
                <p className="text-muted-foreground">نقاط التقييم</p>
                <p className="font-bold gold-text">{employee.ratingPoints || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-strong border-gold-soft">
        <CardHeader><CardTitle className="text-base">📋 مهام بحاجة لاهتمامك</CardTitle></CardHeader>
        <CardContent>
          {tasks.filter(t => ['pending', 'new', 'revision'].includes(t.status)).slice(0, 5).map(t => (
            <div key={t.id} className="flex justify-between items-center p-3 rounded-lg bg-input/30 border border-gold-soft mb-2">
              <div className="flex-1">
                <h4 className="text-sm font-bold">{t.title}</h4>
                <p className="text-xs text-muted-foreground">📅 {t.dueDate}</p>
              </div>
              <Badge className={(STATUS_META[t.status] || STATUS_META.pending).color + ' text-[10px]'}>{(STATUS_META[t.status] || STATUS_META.pending).label}</Badge>
            </div>
          ))}
          {tasks.filter(t => ['pending', 'new', 'revision'].includes(t.status)).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">🎉 لا توجد مهام تحتاج اهتمامك!</p>}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================== PAYROLL TAB (own only) ==============================
function PayrollTab({ payroll, employee }) {
  if (!payroll) return <p className="text-sm text-muted-foreground text-center py-8">جاري التحميل...</p>;
  const handlePrint = () => {
    window.print();
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Button onClick={handlePrint} className="btn-neon"><Printer className="w-4 h-4 ml-1" /> طباعة / حفظ PDF</Button>
      </div>
      <div id="payslip-print" className="payslip-area space-y-4">
        {/* Header for print */}
        <div className="hidden print:block text-center border-b-2 border-black pb-3 mb-3">
          <h1 className="text-3xl font-black">مركز الغزلان</h1>
          <p className="text-sm">كشف راتب الموظف</p>
          <p className="text-xs">شهر {payroll.month}</p>
        </div>

        <Card className="glass-strong border-gold/40 print:border-black print:bg-white">
          <CardContent className="pt-6 text-center space-y-3 print:text-black">
            <p className="text-xs text-muted-foreground print:text-black">راتب شهر {payroll.month}</p>
            <p className="text-5xl font-black gold-text print:text-black">{fmt(payroll.finalSalary)}</p>
            <p className="text-xs text-muted-foreground print:text-black">صافي الراتب (د.ع)</p>
            <div className="text-right border-t border-gold-soft pt-3 mt-3 print:border-black">
              <p className="text-xs">الاسم: <span className="font-bold">{employee?.name}</span></p>
              <p className="text-xs">الرقم الوظيفي: <span className="font-mono">{employee?.employeeId}</span></p>
              <p className="text-xs">المنصب: <span className="font-bold">{employee?.role}</span></p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="stat-card text-center print:border print:border-black"><p className="text-[10px] text-muted-foreground print:text-black">الراتب الأساسي</p><p className="text-base font-bold print:text-black">{fmt(payroll.baseSalary)}</p></div>
          <div className="stat-card text-center print:border print:border-black"><p className="text-[10px] text-muted-foreground print:text-black">مكافآت</p><p className="text-base font-bold text-emerald-400 print:text-black">+{fmt(payroll.bonuses)}</p></div>
          <div className="stat-card text-center print:border print:border-black"><p className="text-[10px] text-muted-foreground print:text-black">خصم التأخير</p><p className="text-base font-bold text-red-400 print:text-black">-{fmt(payroll.lateDeductions || 0)}</p></div>
          <div className="stat-card text-center print:border print:border-black"><p className="text-[10px] text-muted-foreground print:text-black">قسط السلف</p><p className="text-base font-bold text-orange-400 print:text-black">-{fmt(payroll.advanceDeduction || 0)}</p></div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="stat-card text-center print:border print:border-black"><p className="text-[10px] text-muted-foreground print:text-black">حضور</p><p className="text-base font-bold text-emerald-400 print:text-black">{payroll.presentDays}</p></div>
          <div className="stat-card text-center print:border print:border-black"><p className="text-[10px] text-muted-foreground print:text-black">تأخير</p><p className="text-base font-bold text-amber-400 print:text-black">{payroll.lateDays}</p></div>
          <div className="stat-card text-center print:border print:border-black"><p className="text-[10px] text-muted-foreground print:text-black">غياب</p><p className="text-base font-bold text-red-400 print:text-black">{payroll.absentDays}</p></div>
        </div>

        {payroll.activeAdvances && payroll.activeAdvances.length > 0 && (
          <Card className="glass-strong border-orange-500/30 print:border-black">
            <CardHeader><CardTitle className="text-sm print:text-black">💳 السلف النشطة</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {payroll.activeAdvances.map(a => (
                <div key={a.id} className="flex justify-between text-xs p-2 border-b border-gold-soft/30 print:text-black">
                  <span>{fmt(a.amount)} د.ع</span>
                  <span>{a.paid}/{a.installments} قسط</span>
                  <span className="font-bold text-red-400 print:text-black">-{fmt(a.perInstallment)} د.ع/شهر</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="glass-strong border-gold-soft print:border-black">
          <CardHeader><CardTitle className="text-sm print:text-black">📋 قيود الشهر</CardTitle></CardHeader>
          <CardContent>
            {(payroll.entries || []).length === 0 ? <p className="text-xs text-muted-foreground text-center py-4 print:text-black">لا توجد قيود</p> :
              payroll.entries.map(e => (
                <div key={e.id} className="flex justify-between items-center p-2 border-b border-gold-soft/30 print:text-black">
                  <div>
                    <p className="text-xs font-bold">{e.reason}</p>
                    <p className="text-[10px] text-muted-foreground print:text-black">{e.date}</p>
                  </div>
                  <span className={`font-bold ${e.type === 'bonus' ? 'text-emerald-400' : 'text-red-400'} print:text-black`}>{e.type === 'bonus' ? '+' : '-'}{fmt(e.amount)}</span>
                </div>
              ))}
          </CardContent>
        </Card>

        <div className="hidden print:flex justify-between mt-8 text-xs">
          <div><p>توقيع الموظف</p><div className="border-b border-black w-40 h-12 mt-2"></div></div>
          <div><p>توقيع المدير</p><div className="border-b border-black w-40 h-12 mt-2"></div></div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #payslip-print, #payslip-print * { visibility: visible; }
          #payslip-print { position: absolute; left: 0; top: 0; width: 100%; background: white !important; color: black !important; padding: 20px; }
          .glass-strong, .glass-card, .stat-card { background: white !important; border: 1px solid #d4af37 !important; }
        }
      `}</style>
    </div>
  );
}

// ============================== LEAVES SECTION ==============================
function MyLeavesSection({ employee }) {
  const [items, setItems] = useState([]);
  const [balance, setBalance] = useState({ allowance: 24, used: 0, pending: 0, remaining: 24 });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'annual', reason: '', startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10), days: 1 });

  const load = async () => {
    const [list, bal] = await Promise.all([
      api(`leaves?employeeId=${employee.id}`),
      api(`employees/${employee.id}/leave-balance`),
    ]);
    if (Array.isArray(list)) setItems(list);
    if (bal && !bal.error) setBalance(bal);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.startDate || !form.days) { toast.error('املأ الحقول'); return; }
    const r = await api('leaves', { method: 'POST', body: JSON.stringify({ ...form, employeeId: employee.id, days: Number(form.days) }) });
    if (r.error) toast.error(r.error);
    else { toast.success('✅ تم إرسال طلب الإجازة للمدير'); setOpen(false); load(); }
  };

  const TYPE_LABEL = { annual: 'سنوية', sick: 'مرضية', emergency: 'طارئة', unpaid: 'بدون راتب', other: 'أخرى' };
  const STATUS_META = {
    pending: { l: 'قيد المراجعة', c: 'bg-amber-500/20 text-amber-400' },
    approved: { l: '✅ موافق', c: 'bg-emerald-500/20 text-emerald-400' },
    rejected: { l: '❌ مرفوض', c: 'bg-red-500/20 text-red-400' },
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card"><p className="text-xs text-muted-foreground">الرصيد السنوي</p><p className="text-2xl font-bold gold-text">{balance.allowance}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">مستخدمة</p><p className="text-2xl font-bold text-amber-400">{balance.used}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">قيد الموافقة</p><p className="text-2xl font-bold text-cyan-400">{balance.pending}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">المتبقي</p><p className="text-2xl font-bold text-emerald-400">{balance.remaining}</p></div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-bold text-base gold-text">طلباتي ({items.length})</h3>
        <Button onClick={() => setOpen(true)} className="btn-gold"><CalendarDays className="w-4 h-4 ml-1" /> طلب إجازة جديد</Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12"><CalendarDays className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" /><p className="text-sm text-muted-foreground">لا توجد طلبات إجازة</p></div>
      ) : (
        <div className="space-y-2">
          {items.map(l => {
            const meta = STATUS_META[l.status] || STATUS_META.pending;
            return (
              <Card key={l.id} className="glass-card border-gold-soft">
                <CardContent className="p-4 flex justify-between items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-bold">{TYPE_LABEL[l.type] || l.type} · {l.days} يوم</p>
                    <p className="text-xs text-muted-foreground">{l.startDate} → {l.endDate}</p>
                    {l.reason && <p className="text-xs mt-1">📝 {l.reason}</p>}
                    {l.rejectionReason && <p className="text-xs mt-1 text-red-400">سبب الرفض: {l.rejectionReason}</p>}
                  </div>
                  <Badge className={meta.c}>{meta.l}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-gold/40">
          <DialogHeader><DialogTitle className="gold-text">طلب إجازة جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">نوع الإجازة</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">سنوية</SelectItem>
                  <SelectItem value="sick">مرضية</SelectItem>
                  <SelectItem value="emergency">طارئة</SelectItem>
                  <SelectItem value="unpaid">بدون راتب</SelectItem>
                  <SelectItem value="other">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">من تاريخ</Label><Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="bg-input/30 border-gold/20" /></div>
              <div><Label className="text-xs">إلى تاريخ</Label><Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            </div>
            <div>
              <Label className="text-xs">عدد الأيام</Label>
              <Input type="number" min="1" value={form.days} onChange={e => setForm({ ...form, days: e.target.value })} className="bg-input/30 border-gold/20" />
            </div>
            <div>
              <Label className="text-xs">السبب</Label>
              <Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="bg-input/30 border-gold/20 h-20" placeholder="اشرح سبب الإجازة..." />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submit} className="btn-gold w-full">إرسال للمدير</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================== ADVANCES SECTION ==============================
function MyAdvancesSection({ employee }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: 100000, reason: '', installments: 1 });

  const load = async () => {
    const list = await api(`advances?employeeId=${employee.id}`);
    if (Array.isArray(list)) setItems(list);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.amount) { toast.error('املأ المبلغ'); return; }
    const r = await api('advances', { method: 'POST', body: JSON.stringify({ ...form, employeeId: employee.id, amount: Number(form.amount), installments: Number(form.installments) }) });
    if (r.error) toast.error(r.error);
    else { toast.success('✅ تم إرسال طلب السلفة للمدير'); setOpen(false); load(); }
  };

  const STATUS_META = {
    pending: { l: 'قيد المراجعة', c: 'bg-amber-500/20 text-amber-400' },
    approved: { l: '✅ موافق - قيد التسديد', c: 'bg-emerald-500/20 text-emerald-400' },
    rejected: { l: '❌ مرفوض', c: 'bg-red-500/20 text-red-400' },
    paid: { l: '🎉 مسددة', c: 'bg-purple-500/20 text-purple-400' },
  };

  const totalActive = items.filter(a => a.status === 'approved').reduce((s, a) => s + (a.remainingAmount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="stat-card"><p className="text-xs text-muted-foreground">عدد الطلبات</p><p className="text-2xl font-bold gold-text">{items.length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">قيد التسديد</p><p className="text-2xl font-bold text-amber-400">{items.filter(a => a.status === 'approved').length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">المتبقي عليّ</p><p className="text-xl font-bold text-red-400">{fmt(totalActive)} <span className="text-xs">د.ع</span></p></div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-bold text-base gold-text">سلفي ({items.length})</h3>
        <Button onClick={() => setOpen(true)} className="btn-gold"><Wallet className="w-4 h-4 ml-1" /> طلب سلفة جديدة</Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12"><Wallet className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" /><p className="text-sm text-muted-foreground">لا توجد طلبات سلف</p></div>
      ) : (
        <div className="space-y-2">
          {items.map(a => {
            const meta = STATUS_META[a.status] || STATUS_META.pending;
            return (
              <Card key={a.id} className="glass-card border-gold-soft">
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-bold text-lg gold-text">{fmt(a.amount)} د.ع</p>
                      <p className="text-xs text-muted-foreground">{a.installments} قسط × {fmt(a.perInstallment)} د.ع</p>
                    </div>
                    <Badge className={meta.c}>{meta.l}</Badge>
                  </div>
                  {a.status === 'approved' && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span>المُسدَّد: {a.paidInstallments}/{a.installments}</span>
                        <span>المتبقي: <span className="font-bold text-red-400">{fmt(a.remainingAmount)} د.ع</span></span>
                      </div>
                      <Progress value={(a.paidInstallments / a.installments) * 100} className="h-2" />
                    </>
                  )}
                  {a.reason && <p className="text-xs text-muted-foreground">📝 {a.reason}</p>}
                  {a.rejectionReason && <p className="text-xs text-red-400">سبب الرفض: {a.rejectionReason}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-gold/40">
          <DialogHeader><DialogTitle className="gold-text">طلب سلفة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">المبلغ (د.ع)</Label>
              <Input type="number" min="1000" step="10000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="bg-input/30 border-gold/20 text-lg font-bold" />
            </div>
            <div>
              <Label className="text-xs">عدد الأقساط</Label>
              <Select value={String(form.installments)} onValueChange={v => setForm({ ...form, installments: Number(v) })}>
                <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'دفعة واحدة' : 'أقساط'}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">قسط الشهر: <span className="font-bold gold-text">{fmt(Math.round((Number(form.amount) || 0) / Math.max(1, Number(form.installments))))} د.ع</span></p>
            </div>
            <div>
              <Label className="text-xs">السبب</Label>
              <Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="bg-input/30 border-gold/20 h-20" placeholder="اشرح سبب الحاجة للسلفة..." />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submit} className="btn-gold w-full">إرسال للمدير</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 1) POS - record sale + view own sales
function MyPOSSection({ employee }) {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customer, setCustomer] = useState('');
  const [sales, setSales] = useState([]);
  const [total, setTotal] = useState(0);

  const load = async () => {
    const [p, s] = await Promise.all([api('products'), api(`employees/${employee.id}/sales`)]);
    setProducts(Array.isArray(p) ? p : []);
    if (s && !s.error) { setSales(s.sales || []); setTotal(s.total || 0); }
  };
  useEffect(() => { load(); }, []);

  const filtered = products.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search));
  const addItem = (p) => {
    setCart(prev => {
      const ex = prev.find(x => x.id === p.id);
      if (ex) return prev.map(x => x.id === p.id ? { ...x, quantity: x.quantity + 1 } : x);
      return [...prev, { id: p.id, name: p.name, price: p.price, quantity: 1 }];
    });
  };
  const removeItem = (id) => setCart(prev => prev.filter(x => x.id !== id));
  const changeQty = (id, q) => setCart(prev => prev.map(x => x.id === id ? { ...x, quantity: Math.max(1, q) } : x));
  const subtotal = cart.reduce((s, x) => s + x.price * x.quantity, 0);
  const finalTotal = Math.max(0, subtotal - discount);

  const checkout = async () => {
    if (cart.length === 0) { toast.error('السلة فارغة'); return; }
    const r = await api(`employees/${employee.id}/sales`, { method: 'POST', body: JSON.stringify({ items: cart, discount, paymentMethod, customer }) });
    if (r.error) toast.error(r.error);
    else { toast.success(`✅ تم الدفع - ${r.invoiceNumber}`); setCart([]); setDiscount(0); setCustomer(''); load(); }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-3">
        <Input placeholder="🔍 ابحث عن منتج أو باركود..." value={search} onChange={e => setSearch(e.target.value)} className="bg-input/30 border-gold/20" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto">
          {filtered.slice(0, 30).map(p => (
            <Card key={p.id} onClick={() => addItem(p)} className="glass-card border-gold-soft hover:border-gold cursor-pointer transition-all">
              <CardContent className="p-3">
                <p className="text-xs font-bold truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">{p.barcode}</p>
                <p className="text-sm gold-text font-bold mt-1">{fmt(p.price)} د.ع</p>
                <p className="text-[9px] text-muted-foreground">المخزون: {p.stock}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="glass-strong border-gold-soft">
          <CardHeader><CardTitle className="text-sm">📊 مبيعاتي ({sales.length} - إجمالي {fmt(total)} د.ع)</CardTitle></CardHeader>
          <CardContent className="space-y-1 max-h-48 overflow-y-auto">
            {sales.slice(0, 10).map(s => (
              <div key={s.id} className="flex justify-between text-xs py-1 border-b border-gold-soft/30">
                <span className="font-mono">{s.invoiceNumber}</span>
                <span className="gold-text font-bold">{fmt(s.total)} د.ع</span>
                <span className="text-muted-foreground">{new Date(s.createdAt).toLocaleString('ar-IQ', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
              </div>
            ))}
            {sales.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">لا توجد مبيعات</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-strong border-gold/40 h-fit sticky top-20">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-gold" /> السلة ({cart.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {cart.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">السلة فارغة</p>
          ) : cart.map(it => (
            <div key={it.id} className="flex items-center gap-2 text-xs">
              <button onClick={() => removeItem(it.id)} className="text-red-400"><X className="w-3 h-3" /></button>
              <div className="flex-1">
                <p className="font-bold truncate">{it.name}</p>
                <p className="text-[10px] text-muted-foreground">{fmt(it.price)} د.ع</p>
              </div>
              <Input type="number" min="1" value={it.quantity} onChange={e => changeQty(it.id, Number(e.target.value))} className="w-14 h-7 text-xs bg-input/30 border-gold/20" />
              <span className="w-16 text-left font-bold gold-text">{fmt(it.price * it.quantity)}</span>
            </div>
          ))}

          <div className="border-t border-gold-soft pt-2 space-y-2">
            <Input type="number" placeholder="خصم" value={discount} onChange={e => setDiscount(Number(e.target.value))} className="bg-input/30 border-gold/20 h-8 text-xs" />
            <Input placeholder="اسم الزبون (اختياري)" value={customer} onChange={e => setCustomer(e.target.value)} className="bg-input/30 border-gold/20 h-8 text-xs" />
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="bg-input/30 border-gold/20 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">نقدي</SelectItem>
                <SelectItem value="master">ماستركارد</SelectItem>
                <SelectItem value="fastpay">FastPay</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex justify-between text-xs"><span>المجموع</span><span className="font-bold">{fmt(subtotal)} د.ع</span></div>
            <div className="flex justify-between text-base font-bold gold-text"><span>الإجمالي</span><span>{fmt(finalTotal)} د.ع</span></div>
            <Button onClick={checkout} className="btn-gold w-full">دفع وإصدار فاتورة</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 2) Repairs - my tickets, update status
function MyRepairsSection({ employee }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const load = async () => {
    const r = await api(`employees/${employee.id}/repairs`);
    if (Array.isArray(r)) setItems(r);
    else if (r.error) toast.error(r.error);
  };
  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? items : items.filter(r => r.status === filter);

  const updateStatus = async (id, status) => {
    const r = await api(`employees/${employee.id}/repairs/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    if (r.error) toast.error(r.error);
    else { toast.success('✅ تم التحديث'); load(); }
  };

  const statusCls = {
    pending: 'bg-amber-500/20 text-amber-400',
    in_progress: 'bg-cyan-500/20 text-cyan-400',
    completed: 'bg-emerald-500/20 text-emerald-400',
    cancelled: 'bg-red-500/20 text-red-400',
  };
  const statusLabel = { pending: 'بالانتظار', in_progress: 'جاري الصيانة', completed: 'مكتمل', cancelled: 'ملغي' };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {['all', 'pending', 'in_progress', 'completed'].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs border ${filter === s ? 'bg-gold/20 border-gold text-gold' : 'bg-input/30 border-gold-soft text-muted-foreground'}`}>
            {s === 'all' ? `📋 الكل (${items.length})` : `${statusLabel[s]} (${items.filter(x => x.status === s).length})`}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-12"><Wrench className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" /><p className="text-sm text-muted-foreground">لا توجد تذاكر صيانة مخصصة لك</p></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map(r => (
            <Card key={r.id} className="glass-card border-gold-soft">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between">
                  <div>
                    <p className="font-mono text-sm gold-text">{r.ticketNumber}</p>
                    <p className="text-xs font-bold mt-1">{r.device}</p>
                  </div>
                  <Badge className={statusCls[r.status] || 'bg-muted'}>{statusLabel[r.status] || r.status}</Badge>
                </div>
                <div className="text-xs space-y-1">
                  <p><span className="text-muted-foreground">العميل:</span> {r.customerName}</p>
                  <p><span className="text-muted-foreground">المشكلة:</span> {r.issue}</p>
                  <p><span className="text-muted-foreground">التكلفة:</span> <span className="gold-text font-bold">{fmt(r.cost)} د.ع</span></p>
                </div>
                {r.status !== 'completed' && r.status !== 'cancelled' && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gold-soft">
                    {r.status === 'pending' && <Button onClick={() => updateStatus(r.id, 'in_progress')} size="sm" className="btn-neon h-8 text-xs">بدء العمل</Button>}
                    {r.status === 'in_progress' && <Button onClick={() => updateStatus(r.id, 'completed')} size="sm" className="btn-gold h-8 text-xs">✅ إنهاء</Button>}
                    <Button onClick={() => updateStatus(r.id, 'cancelled')} variant="outline" size="sm" className="border-red-500/30 text-red-400 h-8 text-xs">إلغاء</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// 3) Reports - personal performance
function MyReportsSection({ employee }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api(`employees/${employee.id}/report?month=${month}`).then(r => {
      if (r.error) { setErr(r.error); setData(null); }
      else { setErr(null); setData(r); }
    });
  }, [month]);

  if (err) return <div className="text-center py-12 text-red-400">{err}</div>;
  if (!data) return <p className="text-center text-sm text-muted-foreground py-8">جاري التحميل...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-lg font-bold gold-text">📊 تقرير الأداء الشخصي</h2>
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-44 bg-input/30 border-gold/20" />
      </div>

      <Card className="glass-strong border-gold/40">
        <CardContent className="pt-6 text-center">
          <p className="text-xs text-muted-foreground">نقاط الأداء الكلي (KPI)</p>
          <p className="text-6xl font-black gold-text mt-2">{data.kpi}<span className="text-2xl">%</span></p>
          <p className="text-[10px] text-muted-foreground mt-2">نقاط التقييم: <span className="font-bold gold-text">{data.ratingPoints}</span> · مهام منجزة كلياً: <span className="font-bold">{data.tasksCompletedAllTime}</span></p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Card className="glass-card border-gold-soft">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-cyan-400" /> الحضور</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-xs">
            <div><p className="text-muted-foreground">حاضر</p><p className="font-bold text-emerald-400 text-lg">{data.attendance.present}</p></div>
            <div><p className="text-muted-foreground">متأخر</p><p className="font-bold text-amber-400 text-lg">{data.attendance.late}</p></div>
            <div><p className="text-muted-foreground">غياب</p><p className="font-bold text-red-400 text-lg">{data.attendance.absent}</p></div>
            <div><p className="text-muted-foreground">الساعات</p><p className="font-bold gold-text text-lg">{data.attendance.totalHours}</p></div>
          </CardContent>
        </Card>

        <Card className="glass-card border-gold-soft">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ListTodo className="w-4 h-4 text-purple-400" /> المهام</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-xs">
            <div><p className="text-muted-foreground">منجزة</p><p className="font-bold text-emerald-400 text-lg">{data.tasks.completed}</p></div>
            <div><p className="text-muted-foreground">قيد العمل</p><p className="font-bold text-cyan-400 text-lg">{data.tasks.inProgress}</p></div>
            <div><p className="text-muted-foreground">بانتظار القبول</p><p className="font-bold text-amber-400 text-lg">{data.tasks.pending}</p></div>
            <div><p className="text-muted-foreground">قيد المراجعة</p><p className="font-bold text-purple-400 text-lg">{data.tasks.underReview}</p></div>
          </CardContent>
        </Card>

        <Card className="glass-card border-gold-soft">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-emerald-400" /> المبيعات</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">عدد الفواتير</p>
            <p className="font-bold text-2xl">{data.sales.count}</p>
            <p className="text-xs text-muted-foreground mt-2">الإجمالي</p>
            <p className="font-bold gold-text text-lg">{fmt(data.sales.total)} د.ع</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-gold-soft">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Wrench className="w-4 h-4 text-amber-400" /> الصيانة</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-xs">
            <div><p className="text-muted-foreground">منجزة</p><p className="font-bold text-emerald-400 text-lg">{data.repairs.completed}</p></div>
            <div><p className="text-muted-foreground">معلقة</p><p className="font-bold text-amber-400 text-lg">{data.repairs.pending}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-gold-soft">
        <CardHeader><CardTitle className="text-sm">💰 الراتب لهذا الشهر</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">مكافآت</p>
            <p className="text-lg font-bold text-emerald-400">+{fmt(data.payroll.bonuses)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">خصومات</p>
            <p className="text-lg font-bold text-red-400">-{fmt(data.payroll.deductions)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 4) ISP - read-only zones/networks
function MyIspSection({ employee }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    api(`employees/${employee.id}/isp`).then(r => {
      if (r.error) { setErr(r.error); }
      else setData(r);
    });
  }, []);
  if (err) return <div className="text-center py-12 text-red-400">{err}</div>;
  if (!data) return <p className="text-center text-sm text-muted-foreground py-8">جاري التحميل...</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card text-center"><p className="text-xs text-muted-foreground">الزونات</p><p className="text-2xl font-bold gold-text">{data.zones.length}</p></div>
        <div className="stat-card text-center"><p className="text-xs text-muted-foreground">شبكات نشطة</p><p className="text-2xl font-bold text-emerald-400">{data.networks.filter(n => n.status === 'active').length}</p></div>
        <div className="stat-card text-center"><p className="text-xs text-muted-foreground">شبكات معطلة</p><p className="text-2xl font-bold text-red-400">{data.networks.filter(n => n.status !== 'active').length}</p></div>
      </div>
      <Card className="glass-strong border-gold-soft">
        <CardHeader><CardTitle className="text-sm">🌐 الزونات</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-2">
          {data.zones.map(z => (
            <div key={z.id} className="flex justify-between items-center p-2 rounded bg-input/30 border border-gold-soft">
              <div>
                <p className="text-sm font-bold">{z.name}</p>
                <p className="text-[10px] text-muted-foreground">{z.fats || 0} فاتة · {z.subscribers || 0} مشترك</p>
              </div>
              <Badge className={z.status === 'online' ? 'bg-emerald-500/20 text-emerald-400' : z.status === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}>{z.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="glass-strong border-gold-soft">
        <CardHeader><CardTitle className="text-sm">🔌 الشبكات / الفاتات</CardTitle></CardHeader>
        <CardContent className="max-h-96 overflow-y-auto space-y-1">
          {data.networks.slice(0, 50).map(n => (
            <div key={n.id} className="flex justify-between text-xs p-2 border-b border-gold-soft/30">
              <span className="font-mono">{n.number}</span>
              <span>{n.zoneName}</span>
              <span>{n.subscribers}/{n.capacity}</span>
              <Badge className={n.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 text-[9px]' : 'bg-amber-500/20 text-amber-400 text-[9px]'}>{n.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// 5) Subscribers - read-only filtered by me
function MySubscribersSection({ employee }) {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState(null);
  useEffect(() => {
    api(`employees/${employee.id}/subscribers`).then(r => {
      if (r.error) setErr(r.error);
      else if (Array.isArray(r)) setItems(r);
    });
  }, []);
  if (err) return <div className="text-center py-12 text-red-400">{err}</div>;
  if (items.length === 0) return <div className="text-center py-12"><Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" /><p className="text-sm text-muted-foreground">لا يوجد مشتركون مخصصون لك</p></div>;
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {items.map(s => (
        <Card key={s.id} className="glass-card border-gold-soft">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between">
              <p className="font-bold">{s.name}</p>
              <Badge className={s.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>{s.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{s.zoneName} · {s.fatNumber}</p>
            <p className="text-xs">السرعة: <span className="font-bold">{s.speed || '-'}</span></p>
            <p className="text-xs">انتهاء: <span className="gold-text">{s.dueDate || '-'}</span></p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================== MY RATINGS SECTION ==============================
function MyRatingsSection({ employee }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await api(`employees/${employee.id}/ratings`);
    setLoading(false);
    if (!r?.error) setData(r);
  };
  useEffect(() => { load(); }, [employee.id]);

  if (loading) return <div className="text-center py-12 text-sm text-muted-foreground">جاري التحميل...</div>;
  if (!data || data.ratedTasksCount === 0) {
    return (
      <Card className="glass-strong border-gold-soft">
        <CardContent className="p-8 text-center">
          <Star className="w-16 h-16 mx-auto text-gold/30 mb-3" />
          <h3 className="text-lg font-bold gold-text">لا توجد تقييمات بعد</h3>
          <p className="text-xs text-muted-foreground mt-2">سيظهر هنا متوسط تقييماتك بعد أن يقيّم المدير مهامك المُنجزة</p>
        </CardContent>
      </Card>
    );
  }

  const StarBar = ({ value, label, color }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-bold ${color}`}>{value.toFixed(2)} / 5</span>
      </div>
      <div className="h-2 rounded-full bg-input/30 overflow-hidden">
        <div className={`h-full ${color.replace('text-', 'bg-')}/60`} style={{ width: `${(value / 5) * 100}%` }} />
      </div>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} className={`w-3 h-3 ${i <= Math.round(value) ? `${color} fill-current` : 'text-muted-foreground/30'}`} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass-strong border-emerald-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] text-muted-foreground">المعدل الكلي</p>
            <p className="text-3xl font-black text-emerald-400">{data.kpiPct}<span className="text-sm">%</span></p>
            <Progress value={data.kpiPct} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card className="glass-strong border-cyan-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] text-muted-foreground">مهام مُقيَّمة</p>
            <p className="text-3xl font-black text-cyan-400">{data.ratedTasksCount}</p>
            <p className="text-[9px] text-muted-foreground mt-1">من إجمالي {data.employee.tasksCompleted || 0} منجزة</p>
          </CardContent>
        </Card>
        <Card className="glass-strong border-amber-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] text-muted-foreground">نقاط التقييم</p>
            <p className="text-3xl font-black gold-text">{data.employee.ratingPoints || 0}</p>
            <p className="text-[9px] text-muted-foreground mt-1">نقطة</p>
          </CardContent>
        </Card>
        <Card className="glass-strong border-purple-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] text-muted-foreground">المتوسط (من 5)</p>
            <p className="text-3xl font-black text-purple-400">{data.averages.overall.toFixed(1)}</p>
            <div className="flex justify-center gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className={`w-3 h-3 ${i <= Math.round(data.averages.overall) ? 'text-purple-400 fill-current' : 'text-muted-foreground/30'}`} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed averages */}
      <Card className="glass-strong border-gold-soft">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="w-4 h-4 text-gold" /> تفاصيل التقييم
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StarBar value={data.averages.speed} label="⚡ السرعة" color="text-cyan-400" />
          <StarBar value={data.averages.quality} label="💎 الجودة" color="text-emerald-400" />
          <StarBar value={data.averages.commitment} label="🎯 الالتزام" color="text-amber-400" />
          <StarBar value={data.averages.delay} label="⏰ عدم التأخير" color="text-purple-400" />
        </CardContent>
      </Card>

      {/* Monthly trend */}
      {data.monthly?.length > 0 && (
        <Card className="glass-strong border-gold-soft">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" /> الاتجاه الشهري (آخر 6 أشهر)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-32">
              {data.monthly.map(m => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-cyan-400">{m.avgScore}%</span>
                  <div
                    className="w-full bg-gradient-to-t from-cyan-500/60 to-cyan-300/80 rounded-t-md transition-all"
                    style={{ height: `${Math.max(8, m.avgScore)}%` }}
                    title={`${m.count} مهمة`}
                  />
                  <span className="text-[9px] text-muted-foreground font-mono">{m.month.slice(5)}</span>
                  <span className="text-[8px] text-muted-foreground">({m.count})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent reviews */}
      <Card className="glass-strong border-gold-soft">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" /> أحدث المراجعات ({data.recent.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.recent.map(rev => (
            <div key={rev.taskId} className="p-3 rounded-lg bg-input/30 border border-gold-soft space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <h4 className="text-sm font-bold">{rev.title}</h4>
                  <p className="text-[10px] text-muted-foreground">
                    📅 {rev.reviewedAt ? new Date(rev.reviewedAt).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                    · 👤 {rev.reviewerName}
                  </p>
                </div>
                <Badge className={`${rev.score >= 80 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : rev.score >= 60 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                  {rev.score}%
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                <span>⚡ السرعة: {'⭐'.repeat(rev.rating.speed)}</span>
                <span>💎 الجودة: {'⭐'.repeat(rev.rating.quality)}</span>
                <span>🎯 الالتزام: {'⭐'.repeat(rev.rating.commitment)}</span>
                <span>⏰ عدم التأخير: {'⭐'.repeat(rev.rating.delay)}</span>
              </div>
              {rev.notes && (
                <p className="text-xs text-muted-foreground italic border-r-2 border-gold/40 pr-2">
                  💬 {rev.notes}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// 6) Unauthorized fallback
function Unauthorized({ permission }) {
  return (
    <div className="text-center py-16">
      <Lock className="w-20 h-20 mx-auto text-red-500/40 mb-4" />
      <h3 className="text-2xl font-bold text-red-400">⛔ غير مصرح لك</h3>
      <p className="text-sm text-muted-foreground mt-2">لا تملك صلاحية الوصول إلى قسم <span className="font-bold gold-text">{permission}</span></p>
      <p className="text-xs text-muted-foreground mt-1">تواصل مع المدير للحصول على الصلاحية</p>
    </div>
  );
}

// ============================== PERMISSION-BASED PLACEHOLDER TABS ==============================
function PermissionPlaceholder({ icon: Icon, label, hint }) {
  return (
    <div className="text-center py-16">
      <Icon className="w-16 h-16 mx-auto text-gold/40 mb-4" />
      <h3 className="text-lg font-bold gold-text">{label}</h3>
      <p className="text-xs text-muted-foreground mt-2">{hint}</p>
    </div>
  );
}

// ============================== DASHBOARD ==============================
function EmployeeDashboard({ employee, onLogout }) {
  const [tab, setTab] = useState('home');
  const [todayAtt, setTodayAtt] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [payroll, setPayroll] = useState(null);
  const [selfData, setSelfData] = useState(employee);

  const loadAll = async () => {
    const [att, ts, pr, self] = await Promise.all([
      api('attendance/today').then(r => Array.isArray(r) ? r.find(x => x.employeeId === employee.id) : null),
      api(`employees/${employee.id}/tasks`),
      api(`employees/${employee.id}/payroll?month=${new Date().toISOString().slice(0, 7)}`),
      api(`employees/${employee.id}/self`),
    ]);
    setTodayAtt(att); setTasks(Array.isArray(ts) ? ts : []); setPayroll(pr);
    if (self && !self.error) {
      setSelfData(self);
      // Preserve the existing token in localStorage; only update employee object
      try {
        const cur = JSON.parse(localStorage.getItem('emp_session') || '{}');
        localStorage.setItem('emp_session', JSON.stringify({ ...cur, employee: self }));
      } catch {}
    }
  };
  useEffect(() => { loadAll(); const i = setInterval(loadAll, 30000); return () => clearInterval(i); }, []);

  const requireAttendance = !todayAtt;
  const perms = selfData.permissions || ['tasks'];

  // Build dynamic tabs based on permissions
  const allTabs = [
    { key: 'home', label: 'الرئيسية', icon: Home, perm: null }, // always
    { key: 'tasks', label: 'المهام', icon: ListTodo, perm: 'tasks', badge: tasks.filter(t => ['pending', 'new'].includes(t.status)).length },
    { key: 'ratings', label: 'تقييماتي', icon: Star, perm: null }, // always for self
    { key: 'leaves', label: 'إجازاتي', icon: CalendarDays, perm: null }, // always for self
    { key: 'advances', label: 'سُلفي', icon: Wallet, perm: null }, // always for self
    { key: 'payroll', label: 'راتبي', icon: BadgeCheck, perm: null }, // always for self
    { key: 'pos', label: 'نقاط البيع', icon: ShoppingCart, perm: 'pos' },
    { key: 'repairs', label: 'الصيانة', icon: Wrench, perm: 'repairs' },
    { key: 'isp', label: 'الإنترنت', icon: Activity, perm: 'isp' },
    { key: 'subscribers', label: 'مشتركيني', icon: Users, perm: 'subscribers' },
    { key: 'reports', label: 'تقاريري', icon: Award, perm: 'reports' },
  ];
  const visibleTabs = allTabs.filter(t => !t.perm || perms.includes(t.perm) || perms.includes('all'));
  const hasPerm = (p) => perms.includes(p) || perms.includes('all');

  return (
    <div className="min-h-screen bg-background grid-pattern">
      {/* Header */}
      <header className="glass-strong border-b border-gold-soft px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold-gradient flex items-center justify-center text-xl">{selfData.photo || '👤'}</div>
          <div>
            <p className="text-sm font-bold gold-text">{selfData.name}</p>
            <p className="text-[10px] text-muted-foreground">{selfData.employeeId} · {selfData.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EmpThemeToggle />
          <NotificationsBell employeeId={employee.id} onTaskClick={() => setTab('tasks')} />
          <Button onClick={onLogout} variant="outline" size="sm" className="border-red-500/30 text-red-400 hover:bg-red-500/10">
            <LogOut className="w-3 h-3 ml-1" /> خروج
          </Button>
        </div>
      </header>

      <AttendanceBanner employee={selfData} todayAtt={todayAtt} onRefresh={loadAll} />

      <main className="p-4 max-w-7xl mx-auto">
        {requireAttendance ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto rounded-2xl bg-gold-gradient flex items-center justify-center text-4xl animate-float mb-4">⏰</div>
            <h2 className="text-xl font-bold gold-text mb-2">سجّل حضورك للبدء</h2>
            <p className="text-sm text-muted-foreground">لن تتمكن من الوصول لمهامك حتى تسجل الحضور</p>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-input/30 border border-gold-soft w-full flex flex-wrap h-auto gap-1">
              {visibleTabs.map(t => {
                const Icon = t.icon;
                return (
                  <TabsTrigger key={t.key} value={t.key} className="text-xs gap-1 flex-1 min-w-[100px]">
                    <Icon className="w-3.5 h-3.5" /> {t.label}
                    {t.badge > 0 && <Badge className="bg-red-500 text-white text-[9px] h-4 px-1.5 ml-1">{t.badge}</Badge>}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="home" className="mt-4">
              <HomeTab employee={selfData} todayAtt={todayAtt} tasks={tasks} payroll={payroll} />
            </TabsContent>

            {hasPerm('tasks') ? (
              <TabsContent value="tasks" className="mt-4">
                <TasksSection employeeId={employee.id} />
              </TabsContent>
            ) : null}

            <TabsContent value="payroll" className="mt-4">
              <PayrollTab payroll={payroll} employee={selfData} />
            </TabsContent>

            <TabsContent value="ratings" className="mt-4">
              <MyRatingsSection employee={selfData} />
            </TabsContent>

            <TabsContent value="leaves" className="mt-4">
              <MyLeavesSection employee={selfData} />
            </TabsContent>

            <TabsContent value="advances" className="mt-4">
              <MyAdvancesSection employee={selfData} />
            </TabsContent>

            {hasPerm('pos') ? (
              <TabsContent value="pos" className="mt-4">
                <MyPOSSection employee={selfData} />
              </TabsContent>
            ) : null}

            {hasPerm('repairs') ? (
              <TabsContent value="repairs" className="mt-4">
                <MyRepairsSection employee={selfData} />
              </TabsContent>
            ) : null}

            {hasPerm('isp') ? (
              <TabsContent value="isp" className="mt-4">
                <MyIspSection employee={selfData} />
              </TabsContent>
            ) : null}

            {hasPerm('subscribers') ? (
              <TabsContent value="subscribers" className="mt-4">
                <MySubscribersSection employee={selfData} />
              </TabsContent>
            ) : null}

            {hasPerm('reports') ? (
              <TabsContent value="reports" className="mt-4">
                <MyReportsSection employee={selfData} />
              </TabsContent>
            ) : null}
          </Tabs>
        )}
      </main>
    </div>
  );
}

// ============================== IDLE LOGOUT HOOK ==============================
function useIdleLogout(onLogout, timeoutMs = 10 * 60 * 1000) {
  useEffect(() => {
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { onLogout(true); }, timeoutMs);
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, reset));
    reset();
    // Session validation every 60s
    const ival = setInterval(async () => {
      const t = getToken();
      if (!t) return;
      const r = await api('sessions/validate', { method: 'POST', body: JSON.stringify({ token: t }) });
      if (r.error) onLogout(true);
    }, 60000);
    return () => {
      clearTimeout(timer);
      clearInterval(ival);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [onLogout, timeoutMs]);
}

// ============================== ROOT ==============================
function EmployeePortal() {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const s = typeof window !== 'undefined' ? localStorage.getItem('emp_session') : null;
    if (s) try { setEmployee(JSON.parse(s).employee); } catch {}
    setLoading(false);
  }, []);
  const logout = async (idle = false) => {
    const t = getToken();
    if (t) await api('sessions/logout', { method: 'POST', body: JSON.stringify({ token: t }) }).catch(() => null);
    localStorage.removeItem('emp_session');
    setEmployee(null);
    if (idle) toast.error('🔒 تم تسجيل الخروج تلقائياً بسبب الخمول');
  };
  useIdleLogout(logout);

  if (loading) return null;

  return (
    <>
      {employee ? <EmployeeDashboard employee={employee} onLogout={() => logout(false)} /> : <LoginScreen onLogin={setEmployee} />}
      <Toaster position="top-center" theme="dark" richColors />
    </>
  );
}

export default EmployeePortal;
