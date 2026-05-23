'use client';
import { Trash2 as Trash } from 'lucide-react';
import { GPSMap } from '@/components/maps-barcode';
import { TaskAdvancedActions } from '@/components/admin/shared/TaskAdvancedActions';
import { TaskReviewDialog } from '@/components/admin/shared/TaskReviewDialog';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api, fmt, fmtCurrency, safeArr, setArr } from '@/lib/page-shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
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
  Building2, BarChart, PieChart as PieIcon, Boxes, ChevronDown, Printer, ListTodo, Check, XCircle, LogOut, MessageSquare, QrCode, Power, RefreshCw, Wallet, Brain, Eye
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart as RBarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadialBarChart, RadialBar
} from 'recharts';

export default function TasksManager() {
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [reviewTask, setReviewTask] = useState(null);
  const [mapTask, setMapTask] = useState(null);
  const blank = { title: '', description: '', priority: 'medium', dueDate: new Date().toISOString().slice(0, 10), assignedTo: '', notes: '', status: 'pending', progress: 0, attachments: [], taskType: 'general', subscriberId: '', subscriberName: '', subscriberPhone: '', subscriberAddress: '', subscriberLat: null, subscriberLng: null, faultDescription: '', recurrence: { enabled: false, type: 'weekly', interval: 1, endDate: '' } };
  const [form, setForm] = useState(blank);
  const [subSearch, setSubSearch] = useState('');
  const [subResults, setSubResults] = useState([]);
  const load = async () => {
    const [t, e] = await Promise.all([api('tasks'), api('employees')]);
    setItems(t); setEmployees(e);
  };
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, []);

  // Subscriber autocomplete search (only for subscriber_repair tasks)
  useEffect(() => {
    if (form.taskType !== 'subscriber_repair' || !subSearch || subSearch.length < 2) {
      setSubResults([]);
      return;
    }
    const t = setTimeout(() => {
      api(`subscribers/search?q=${encodeURIComponent(subSearch)}`).then(r => {
        if (Array.isArray(r)) setSubResults(r);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [subSearch, form.taskType]);

  const selectSubscriber = (s) => {
    setForm(f => ({
      ...f,
      subscriberId: s.id,
      subscriberName: s.name,
      subscriberPhone: s.phone || '',
      subscriberAddress: s.address || s.zoneName || '',
      subscriberLat: s.userLat ?? null,
      subscriberLng: s.userLng ?? null,
      title: f.title || `🔧 صيانة - ${s.name}`,
    }));
    setSubSearch('');
    setSubResults([]);
  };

  const filtered = statusFilter === 'all' ? items
    : statusFilter === 'awaiting_review' ? items.filter(t => t.status === 'pending_review')
    : items.filter(t => t.status === statusFilter);

  const save = async () => {
    if (!form.title || !form.assignedTo) { toast.error('العنوان والموظف مطلوبان'); return; }
    if (form.taskType === 'subscriber_repair' && !form.subscriberId) {
      toast.error('اختر المشترك من القائمة');
      return;
    }
    const emp = employees.find(e => e.id === form.assignedTo);
    await api('tasks', { method: 'POST', body: JSON.stringify({ ...form, assignedToName: emp?.name, createdBy: 'المدير', createdById: 'manager' }) });
    toast.success('✅ تم إنشاء المهمة وإرسال إشعار للموظف'); setOpen(false); setForm(blank); load();
  };
  const remove = async (id) => { await api(`tasks/${id}`, { method: 'DELETE' }); toast.success('تم الحذف'); load(); };

  const priorityCls = { high: 'bg-red-500/20 text-red-400 border-red-500/30', medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30', low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
  const statusCls = {
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    new: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    in_progress: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    pending_review: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    rejected_by_employee: 'bg-red-500/20 text-red-400 border-red-500/30',
    rejected_by_manager: 'bg-red-500/30 text-red-300 border-red-500/40',
    revision: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };
  const statusLabel = {
    pending: 'بانتظار القبول', new: 'بانتظار القبول',
    in_progress: 'جاري العمل', pending_review: 'بانتظار المراجعة',
    completed: 'مكتملة', rejected_by_employee: 'رفض الموظف',
    rejected_by_manager: 'مرفوضة', revision: 'إعادة تعديل',
  };

  const counts = {
    all: items.length,
    pending_review: items.filter(t => t.status === 'pending_review').length,
    pending: items.filter(t => ['pending', 'new'].includes(t.status)).length,
    in_progress: items.filter(t => t.status === 'in_progress').length,
    completed: items.filter(t => t.status === 'completed').length,
    rejected_by_employee: items.filter(t => t.status === 'rejected_by_employee').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { k: 'all', l: '📋 الكل', c: counts.all },
            { k: 'pending_review', l: '🟣 بانتظار المراجعة', c: counts.pending_review },
            { k: 'pending', l: '🟡 بانتظار القبول', c: counts.pending },
            { k: 'in_progress', l: '🔵 جاري العمل', c: counts.in_progress },
            { k: 'completed', l: '✅ مكتملة', c: counts.completed },
            { k: 'rejected_by_employee', l: '❌ رفض الموظف', c: counts.rejected_by_employee },
          ].map(b => (
            <button key={b.k} onClick={() => setStatusFilter(b.k)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${statusFilter === b.k ? 'bg-gold/20 border-gold text-gold' : 'bg-input/30 border-gold-soft text-muted-foreground hover:text-gold'}`}>
              {b.l} {b.c > 0 && <span className="font-bold">({b.c})</span>}
            </button>
          ))}
        </div>
        <Button onClick={() => { setForm(blank); setOpen(true); }} className="btn-gold"><Plus className="w-4 h-4 ml-1" /> مهمة جديدة</Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(t => (
          <Card key={t.id} className={`glass-card border-gold-soft hover:border-gold/50 ${t.status === 'pending_review' ? 'ring-2 ring-purple-500/40' : ''}`}>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-bold text-sm flex-1">{t.title}</h3>
                <Badge className={priorityCls[t.priority] + ' text-[9px]'}>{t.priority}</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>

              {t.taskType === 'subscriber_repair' && t.subscriberName && (
                <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-[10px] space-y-0.5">
                  <p className="font-bold text-cyan-400">📡 صيانة مشترك</p>
                  <p>👤 <span className="font-bold">{t.subscriberName}</span></p>
                  {t.subscriberPhone && <p>📞 <a href={`tel:${t.subscriberPhone}`} className="font-mono hover:text-gold" dir="ltr">{t.subscriberPhone}</a></p>}
                  {t.subscriberAddress && <p className="line-clamp-1">📍 {t.subscriberAddress}</p>}
                  {t.faultDescription && <p className="text-red-400">⚠️ {t.faultDescription}</p>}
                </div>
              )}

              <div className="flex justify-between text-[10px]">
                <span className="text-cyan-400">👤 {t.assignedToName}</span>
                <span className="text-muted-foreground">📅 {t.dueDate}</span>
              </div>

              {/* ============ TIME TRACKING (وقت البدء/الانتهاء/المدة) ============ */}
              {(t.startedAt || t.completedAt) && (
                <div className="grid grid-cols-3 gap-1 text-[9px] p-1.5 rounded bg-input/30 border border-gold-soft/30">
                  <div className="text-center">
                    <p className="text-muted-foreground">▶️ بدء</p>
                    <p className="font-mono text-cyan-400">{t.startedAt ? new Date(t.startedAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">✅ انتهاء</p>
                    <p className="font-mono text-emerald-400">{t.completedAt ? new Date(t.completedAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">⏱️ المدة</p>
                    <p className="font-bold gold-text">
                      {t.durationMin != null ? (
                        t.durationMin < 60 ? `${t.durationMin}د` : `${Math.floor(t.durationMin / 60)}س ${t.durationMin % 60}د`
                      ) : '—'}
                    </p>
                  </div>
                </div>
              )}

              {/* Recurrence badge */}
              {t.recurrence?.enabled && (
                <div className="text-[10px] p-1.5 rounded bg-violet-500/10 border border-violet-500/30 text-violet-400 flex items-center justify-between">
                  <span>🔁 مهمة دورية: {t.recurrence.type === 'daily' ? 'يومية' : t.recurrence.type === 'weekly' ? 'أسبوعية' : 'شهرية'} (كل {t.recurrence.interval || 1})</span>
                  {t.spawnedFromTaskId && <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[8px]">نسخة جديدة</Badge>}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">التقدم</span><span className="font-bold">{t.progress || 0}%</span></div>
                <Progress value={t.progress || 0} className="h-1.5" />
              </div>

              {t.status === 'rejected_by_employee' && t.rejectionReason && (
                <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-[10px]">
                  <span className="font-bold text-red-400">سبب الرفض: </span>{t.rejectionReason}
                </div>
              )}

              {t.report && (
                <div className="p-2 rounded bg-purple-500/10 border border-purple-500/30 text-[10px] space-y-1">
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-purple-400">📋 تقرير الإنجاز ({t.report.progress || 0}%):</p>
                    {t.report.attachments?.length > 0 && (
                      <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px]">📎 {t.report.attachments.length}</Badge>
                    )}
                  </div>
                  <p className="line-clamp-2">{t.report.summary}</p>
                  {/* Photo thumbnails — supports /uploads/*.jpg AND /api/files/{id} URLs */}
                  {t.report.attachments?.filter(a => {
                    const url = a.url || a.name || '';
                    const mime = a.mime || '';
                    return /\.(jpg|jpeg|png|webp|gif)$/i.test(url) || url.includes('/api/files/') || mime.startsWith('image/');
                  }).slice(0, 4).length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {t.report.attachments.filter(a => {
                        const url = a.url || a.name || '';
                        const mime = a.mime || '';
                        return /\.(jpg|jpeg|png|webp|gif)$/i.test(url) || url.includes('/api/files/') || mime.startsWith('image/');
                      }).slice(0, 4).map((a, i) => (
                        <img
                          key={i}
                          src={a.url}
                          alt={a.name || 'photo'}
                          className="w-12 h-12 object-cover rounded border border-purple-500/30 cursor-pointer hover:scale-110 transition-transform"
                          onClick={() => setReviewTask(t)}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {t.review && (t.status === 'completed' || t.status === 'rejected_by_manager') && t.review.rating && (
                <div className="text-[10px] grid grid-cols-2 gap-1 p-2 rounded bg-input/30 border border-gold-soft">
                  <span>السرعة: {'⭐'.repeat(t.review.rating.speed || 0)}</span>
                  <span>الجودة: {'⭐'.repeat(t.review.rating.quality || 0)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-gold-soft">
                <Badge className={statusCls[t.status] + ' text-[10px]'}>{statusLabel[t.status] || t.status}</Badge>
                <div className="flex gap-1">
                  {t.taskType === 'subscriber_repair' && (t.subscriberLat || t.subscriberLng) && (
                    <Button size="sm" variant="outline" className="h-7 text-[10px] border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400" onClick={() => setMapTask(t)}>
                      <MapPin className="w-3 h-3 ml-1" /> خريطة
                    </Button>
                  )}
                  {/* Show "مراجعة" button for any task with a report (pending review OR already reviewed - to view details) */}
                  {t.report && (
                    <Button
                      size="sm"
                      className={t.status === 'pending_review' ? 'btn-gold h-7 text-[10px] animate-pulse' : 'h-7 text-[10px] bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30'}
                      onClick={() => setReviewTask(t)}
                    >
                      <FileText className="w-3 h-3 ml-1" />
                      {t.status === 'pending_review' ? 'مراجعة الآن' : 'عرض المراجعة'}
                    </Button>
                  )}
                  <TaskAdvancedActions task={t} employees={employees} onRefresh={load} />
                  <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-red-500" onClick={() => remove(t.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Task Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-gold/40 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="gold-text">{form.taskType === 'subscriber_repair' ? '🔧 مهمة صيانة مشترك' : '📋 مهمة جديدة'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Task Type Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, taskType: 'general' })}
                className={`p-3 rounded-lg border-2 transition-all text-right ${form.taskType === 'general' ? 'border-gold bg-gold/10' : 'border-gold-soft bg-input/30 hover:border-gold/50'}`}
              >
                <div className="font-bold text-sm">📋 مهمة عامة</div>
                <div className="text-[10px] text-muted-foreground">مهمة داخلية عادية</div>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, taskType: 'subscriber_repair' })}
                className={`p-3 rounded-lg border-2 transition-all text-right ${form.taskType === 'subscriber_repair' ? 'border-cyan-500 bg-cyan-500/10' : 'border-gold-soft bg-input/30 hover:border-cyan-500/50'}`}
              >
                <div className="font-bold text-sm">🔧 صيانة مشترك</div>
                <div className="text-[10px] text-muted-foreground">مع موقع GPS تلقائي</div>
              </button>
            </div>

            {/* Subscriber Picker for subscriber_repair */}
            {form.taskType === 'subscriber_repair' && (
              <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/30 space-y-3">
                <div>
                  <Label className="text-xs flex items-center gap-1">
                    <Search className="w-3 h-3" /> ابحث عن المشترك (بالاسم/الهاتف/اليوزر)
                  </Label>
                  <div className="relative">
                    <Input
                      value={subSearch}
                      onChange={e => setSubSearch(e.target.value)}
                      placeholder="ابدأ الكتابة..."
                      className="bg-input/50 border-cyan-500/30"
                    />
                    {subResults.length > 0 && (
                      <div className="absolute z-50 top-full mt-1 right-0 left-0 max-h-64 overflow-y-auto rounded-lg bg-background border-2 border-cyan-500/50 shadow-xl">
                        {subResults.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => selectSubscriber(s)}
                            className="w-full text-right p-2 hover:bg-cyan-500/10 border-b border-gold-soft/30 last:border-0"
                          >
                            <div className="font-bold text-xs">{s.name}</div>
                            <div className="text-[10px] text-muted-foreground flex gap-2">
                              <span>📞 {s.phone || '-'}</span>
                              <span>📍 {s.zoneName || '-'}</span>
                              {(s.userLat && s.userLng) && <span className="text-emerald-400">🛰️ GPS</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {form.subscriberId && (
                  <div className="space-y-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex justify-between items-start">
                      <div className="text-xs">
                        <p className="font-bold gold-text">{form.subscriberName}</p>
                        <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">{form.subscriberPhone}</p>
                        <p className="text-[10px] text-muted-foreground">{form.subscriberAddress}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] hover:text-red-500" onClick={() => setForm({ ...form, subscriberId: '', subscriberName: '', subscriberPhone: '', subscriberAddress: '', subscriberLat: null, subscriberLng: null })}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    {form.subscriberLat && form.subscriberLng ? (
                      <div className="relative">
                        <GPSMap lat={form.subscriberLat} lng={form.subscriberLng} label={form.subscriberName} height={180} />
                        <Badge className="absolute top-2 right-2 bg-emerald-500/90 text-white border-0 z-[1000]">🛰️ موقع مدعوم</Badge>
                      </div>
                    ) : (
                      <p className="text-[10px] text-amber-400">⚠️ لا توجد إحداثيات GPS لهذا المشترك</p>
                    )}
                  </div>
                )}

                <div>
                  <Label className="text-xs">وصف العطل / المشكلة</Label>
                  <Textarea
                    value={form.faultDescription}
                    onChange={e => setForm({ ...form, faultDescription: e.target.value })}
                    placeholder="مثال: انقطاع الإنترنت، ضعف الإشارة، مشكلة بالكابل..."
                    className="bg-input/30 border-cyan-500/30 h-20"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>عنوان المهمة</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-input/30 border-gold/20" /></div>
              <div className="col-span-2"><Label>{form.taskType === 'subscriber_repair' ? 'تعليمات إضافية للفني' : 'الوصف'}</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-input/30 border-gold/20 h-20" /></div>
              <div><Label>{form.taskType === 'subscriber_repair' ? 'الفني المسؤول' : 'الموظف المسؤول'}</Label>
                <Select value={form.assignedTo} onValueChange={v => setForm({ ...form, assignedTo: v })}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="اختر موظف" /></SelectTrigger>
                  <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.photo} {e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>الأولوية</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">🔴 عالية</SelectItem>
                    <SelectItem value="medium">🟡 متوسطة</SelectItem>
                    <SelectItem value="low">🟢 منخفضة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>تاريخ التسليم</Label><Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="bg-input/30 border-gold/20" /></div>

              {/* ============ RECURRENCE (مهمة دورية / متكررة) ============ */}
              <div className="col-span-2 p-3 rounded-lg border border-violet-500/30 bg-violet-500/5 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-bold text-violet-400 flex items-center gap-2">🔁 مهمة متكررة (دورية)</span>
                  <input
                    type="checkbox"
                    checked={!!form.recurrence?.enabled}
                    onChange={e => setForm({ ...form, recurrence: { ...(form.recurrence || { type: 'weekly', interval: 1 }), enabled: e.target.checked } })}
                    className="w-4 h-4 accent-violet-500"
                  />
                </label>
                {form.recurrence?.enabled && (
                  <>
                    <p className="text-[10px] text-violet-300/80">عند إكمال المهمة، سيتم إنشاء نسخة جديدة تلقائياً للموظف نفسه بتاريخ تسليم محسوب.</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px]">التكرار</Label>
                        <Select value={form.recurrence?.type || 'weekly'} onValueChange={v => setForm({ ...form, recurrence: { ...form.recurrence, type: v } })}>
                          <SelectTrigger className="bg-input/30 border-violet-500/30 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">يومياً</SelectItem>
                            <SelectItem value="weekly">أسبوعياً</SelectItem>
                            <SelectItem value="monthly">شهرياً</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px]">كل (مرات)</Label>
                        <Input type="number" min="1" value={form.recurrence?.interval ?? 1} onChange={e => setForm({ ...form, recurrence: { ...form.recurrence, interval: Number(e.target.value) || 1 } })} className="bg-input/30 border-violet-500/30 h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px]">تاريخ الإيقاف (اختياري)</Label>
                        <Input type="date" value={form.recurrence?.endDate || ''} onChange={e => setForm({ ...form, recurrence: { ...form.recurrence, endDate: e.target.value } })} className="bg-input/30 border-violet-500/30 h-8 text-xs" />
                      </div>
                    </div>
                    <p className="text-[10px] text-amber-400">
                      💡 مثال: {form.recurrence?.type === 'daily' ? `كل ${form.recurrence?.interval || 1} يوم` :
                                form.recurrence?.type === 'weekly' ? `كل ${form.recurrence?.interval || 1} أسبوع` :
                                `كل ${form.recurrence?.interval || 1} شهر`}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={save} className="btn-gold w-full">{form.taskType === 'subscriber_repair' ? '🚀 إنشاء مهمة الصيانة وإرسالها للفني' : '✅ إنشاء المهمة وإرسال للموظف'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Map View Dialog */}
      <Dialog open={!!mapTask} onOpenChange={() => setMapTask(null)}>
        <DialogContent className="glass-strong border-cyan-500/40 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 flex items-center gap-2">
              <MapPin className="w-5 h-5" /> موقع المشترك - {mapTask?.subscriberName}
            </DialogTitle>
          </DialogHeader>
          {mapTask && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-input/30 border border-gold-soft">
                  <p className="text-muted-foreground text-[10px]">المشترك</p>
                  <p className="font-bold">{mapTask.subscriberName}</p>
                </div>
                <div className="p-2 rounded bg-input/30 border border-gold-soft">
                  <p className="text-muted-foreground text-[10px]">الهاتف</p>
                  <a href={`tel:${mapTask.subscriberPhone}`} className="font-bold font-mono hover:text-gold" dir="ltr">{mapTask.subscriberPhone}</a>
                </div>
                <div className="col-span-2 p-2 rounded bg-red-500/10 border border-red-500/30">
                  <p className="text-muted-foreground text-[10px]">وصف العطل</p>
                  <p className="font-bold text-red-400">{mapTask.faultDescription || mapTask.description}</p>
                </div>
              </div>
              <GPSMap lat={mapTask.subscriberLat} lng={mapTask.subscriberLng} label={mapTask.subscriberName} height={400} />
              <div className="flex gap-2 justify-end">
                <a href={`https://www.google.com/maps?q=${mapTask.subscriberLat},${mapTask.subscriberLng}`} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400">
                    🗺️ افتح في Google Maps
                  </Button>
                </a>
                <a href={`https://waze.com/ul?ll=${mapTask.subscriberLat},${mapTask.subscriberLng}&navigate=yes`} target="_blank" rel="noreferrer">
                  <Button className="btn-neon">
                    🚗 فتح في Waze
                  </Button>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TaskReviewDialog task={reviewTask} onClose={() => setReviewTask(null)} onDone={() => { setReviewTask(null); load(); }} />
    </div>
  );
}
