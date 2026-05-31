'use client';
import { Trash2 as Trash, Edit2 as Edit } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CustomFieldsGrid } from '@/components/custom-fields';
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

export default function Agents() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [statsDialog, setStatsDialog] = useState(null);
  const [tab, setTab] = useState('agents'); // agents | pending
  const [pending, setPending] = useState([]);
  const [packages, setPackages] = useState([]);
  const blankForm = {
    name: '', username: '', password: '', phone: '', branch: '',
    commission: 20, status: 'active',
    profitMode: 'percentage', // percentage | fixed_per_activation | fixed_per_package
    fixedProfitPerActivation: 5000,
    fixedProfitsByPackage: {},
    permissions: {
      canViewAllSubscribers: false,
      canActivate: true,
      canEditSubscribers: false,
      canDeleteSubscribers: false,
      requireAdminApproval: false,
      canViewProfits: true,
      canExportData: false,
      canSendWhatsapp: true,
    },
  };
  const [form, setForm] = useState(blankForm);
  const [dialogTab, setDialogTab] = useState('info'); // info | profits | permissions

  const load = async () => {
    const [a, pkgs] = await Promise.all([api('agents'), api('packages')]);
    setItems(safeArr(a));
    setPackages(safeArr(pkgs));
  };
  const loadPending = async () => {
    const r = await api('pending-activations?status=pending');
    setPending(safeArr(r));
  };
  useEffect(() => { load(); loadPending(); const i = setInterval(loadPending, 15000); return () => clearInterval(i); }, []);

  const save = async () => {
    const payload = {
      ...form,
      commission: Number(form.commission || 0),
      fixedProfitPerActivation: Number(form.fixedProfitPerActivation || 0),
    };
    if (editing) await api(`agents/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('agents', { method: 'POST', body: JSON.stringify({ ...payload, balance: 0, totalActivations: 0, totalProfit: 0 }) });
    toast.success('تم الحفظ'); setOpen(false); setEditing(null); load();
  };
  const remove = async (id) => { if (!confirm('حذف الوكيل؟')) return; await api(`agents/${id}`, { method: 'DELETE' }); toast.success('تم الحذف'); load(); };
  const openStats = async (id) => { const r = await api(`agents/${id}/stats`); setStatsDialog(r); };
  const portalLink = (a) => typeof window !== 'undefined' ? `${window.location.origin}/agent?u=${a.username}` : `/agent?u=${a.username}`;

  const startEdit = (a) => {
    setEditing(a);
    setForm({ ...blankForm, ...a, permissions: { ...blankForm.permissions, ...(a.permissions || {}) }, fixedProfitsByPackage: a.fixedProfitsByPackage || {} });
    setDialogTab('info');
    setOpen(true);
  };
  const startNew = () => {
    setEditing(null);
    setForm(blankForm);
    setDialogTab('info');
    setOpen(true);
  };

  const approvePending = async (p) => {
    const r = await api(`pending-activations/${p.id}/approve`, { method: 'POST', body: JSON.stringify({ approvedBy: 'المدير' }) });
    if (r?.success) { toast.success('✅ تمت الموافقة على التفعيل'); loadPending(); load(); }
    else toast.error('فشل: ' + (r?.error || ''));
  };
  const rejectPending = async (p) => {
    const reason = prompt('سبب الرفض:'); if (reason === null) return;
    const r = await api(`pending-activations/${p.id}/reject`, { method: 'POST', body: JSON.stringify({ reason, approvedBy: 'المدير' }) });
    if (r?.success) { toast.success('❌ تم الرفض'); loadPending(); }
    else toast.error('فشل: ' + (r?.error || ''));
  };

  const profitDisplay = (a) => {
    const mode = a.profitMode || 'percentage';
    if (mode === 'fixed_per_activation') return `${fmt(a.fixedProfitPerActivation || 0)} د.ع/تفعيل`;
    if (mode === 'fixed_per_package') {
      const count = Object.keys(a.fixedProfitsByPackage || {}).length;
      return `مخصص (${count} باقة)`;
    }
    return `${a.commission || 0}%`;
  };
  const profitModeLabel = (m) => ({
    percentage: 'نسبة %',
    fixed_per_activation: 'مبلغ ثابت',
    fixed_per_package: 'لكل باقة',
  })[m] || 'نسبة %';

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold gold-text flex items-center gap-2"><UserCheck className="w-6 h-6" /> الوكلاء</h1>
        <Button onClick={startNew} className="btn-gold"><Plus className="w-4 h-4 ml-1" /> وكيل جديد</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-input/30 border border-gold-soft">
          <TabsTrigger value="agents">👥 الوكلاء ({items.length})</TabsTrigger>
          <TabsTrigger value="pending">
            ⏳ طلبات تفعيل بانتظار الموافقة
            {pending.length > 0 && <Badge className="ml-2 bg-red-500/20 text-red-400 border-red-500/30">{pending.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4 mt-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي الوكلاء</p><p className="text-2xl font-bold gold-text">{items.length}</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي تفعيلاتهم</p><p className="text-2xl font-bold neon-text">{items.reduce((s, a) => s + (a.totalActivations || 0), 0)}</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي عمولاتهم</p><p className="text-xl font-bold text-purple-400">{fmtCurrency(items.reduce((s, a) => s + (a.totalProfit || 0), 0))}</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">رصيد إجمالي</p><p className="text-xl font-bold text-emerald-400">{fmtCurrency(items.reduce((s, a) => s + (a.balance || 0), 0))}</p></div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(a => (
              <Card key={a.id} className="glass-card border-gold-soft hover:border-gold/50">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-neon-gradient flex items-center justify-center text-2xl font-black text-background">{a.name[0]}</div>
                    <div className="flex-1">
                      <h3 className="font-bold">{a.name}</h3>
                      <p className="text-[10px] text-muted-foreground">@{a.username} · {a.branch}</p>
                      <p className="text-xs text-cyan-400">{a.phone}</p>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <Badge className={a.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}>{a.status === 'active' ? 'نشط' : 'موقف'}</Badge>
                      {a.permissions?.requireAdminApproval && (
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[8px]">⏳ يحتاج موافقة</Badge>
                      )}
                      {a.permissions?.canActivate === false && (
                        <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30 text-[8px]">👁️ عرض فقط</Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="glass-card rounded-lg p-2"><p className="text-[9px] text-muted-foreground">تفعيلات</p><p className="text-base font-bold gold-text">{a.totalActivations || 0}</p></div>
                    <div className="glass-card rounded-lg p-2" title={profitModeLabel(a.profitMode || 'percentage')}>
                      <p className="text-[9px] text-muted-foreground">{profitModeLabel(a.profitMode || 'percentage')}</p>
                      <p className="text-xs font-bold neon-text truncate">{profitDisplay(a)}</p>
                    </div>
                    <div className="glass-card rounded-lg p-2"><p className="text-[9px] text-muted-foreground">الرصيد</p><p className="text-xs font-bold text-emerald-400">{fmt(a.balance || 0)}</p></div>
                  </div>
                  <div className="p-2 rounded-lg bg-cyan-500/5 border border-cyan-500/20 text-[10px] flex items-center justify-between gap-2">
                    <span className="font-mono truncate">{portalLink(a)}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0" onClick={() => { navigator.clipboard?.writeText(portalLink(a)); toast.success('تم نسخ الرابط'); }}><FileText className="w-3 h-3" /></Button>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-gold-soft">
                    <Button size="sm" variant="outline" className="flex-1 border-gold/30" onClick={() => openStats(a.id)}><BarChart3 className="w-3 h-3 ml-1" /> إحصائيات</Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => startEdit(a)}><Edit2 className="w-3 h-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 hover:text-red-500" onClick={() => remove(a.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pending" className="space-y-3 mt-3">
          {pending.length === 0 ? (
            <Card className="glass-card border-gold-soft">
              <CardContent className="p-12 text-center text-muted-foreground">
                <CheckCircle2 className="w-16 h-16 mx-auto mb-3 text-emerald-400/50" />
                <p>لا توجد طلبات تفعيل بانتظار الموافقة</p>
              </CardContent>
            </Card>
          ) : pending.map(p => (
            <Card key={p.id} className="glass-card border-amber-500/30 hover:border-amber-500/50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-amber-400">⏳ طلب من الوكيل: {p.agentName}</p>
                    <p className="text-xs text-muted-foreground">منذ {new Date(p.requestedAt).toLocaleString('ar-IQ')}</p>
                  </div>
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">قيد الانتظار</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs pt-2 border-t border-gold-soft/30">
                  <div><p className="text-muted-foreground text-[10px]">المشترك</p><p className="font-bold">{p.subscriberName}</p></div>
                  <div><p className="text-muted-foreground text-[10px]">الباقة</p><p className="font-bold">{p.packageName}</p></div>
                  <div><p className="text-muted-foreground text-[10px]">المبلغ</p><p className="font-bold gold-text">{fmt(p.amount)} د.ع</p></div>
                  <div><p className="text-muted-foreground text-[10px]">عمولة الوكيل</p><p className="font-bold text-purple-400">{fmt(p.agentProfit)} د.ع</p></div>
                </div>
                <div className="flex gap-2 pt-2 border-t border-gold-soft/30">
                  <Button size="sm" onClick={() => approvePending(p)} className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40">
                    <CheckCircle2 className="w-3 h-3 ml-1" /> موافقة وتفعيل
                  </Button>
                  <Button size="sm" onClick={() => rejectPending(p)} variant="outline" className="border-red-500/40 hover:bg-red-500/10 text-red-400">
                    <XCircle className="w-3 h-3 ml-1" /> رفض
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-gold/40 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="gold-text">{editing ? 'تعديل الوكيل' : 'وكيل جديد'}</DialogTitle></DialogHeader>
          <Tabs value={dialogTab} onValueChange={setDialogTab}>
            <TabsList className="bg-input/30 border border-gold-soft w-full">
              <TabsTrigger value="info" className="flex-1">📝 المعلومات</TabsTrigger>
              <TabsTrigger value="profits" className="flex-1">💰 الأرباح</TabsTrigger>
              <TabsTrigger value="permissions" className="flex-1">🔒 الصلاحيات</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>اسم الوكيل</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-input/30 border-gold/20" /></div>
                <div><Label>اسم المستخدم</Label><Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="bg-input/30 border-gold/20 font-mono" /></div>
                <div><Label>كلمة المرور</Label><Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="bg-input/30 border-gold/20 font-mono" /></div>
                <div><Label>الهاتف</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-input/30 border-gold/20" /></div>
                <div><Label>الفرع</Label><Input value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} className="bg-input/30 border-gold/20" /></div>
                <div className="col-span-2">
                  <Label>الحالة</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="active">نشط</SelectItem><SelectItem value="suspended">موقف</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <CustomFieldsGrid entity="agents" customFields={form.customFields} onUpdate={(cf) => setForm({ ...form, customFields: cf })} columns={2} />
            </TabsContent>

            <TabsContent value="profits" className="space-y-3 pt-3">
              <div>
                <Label>طريقة احتساب أرباح الوكيل</Label>
                <Select value={form.profitMode || 'percentage'} onValueChange={v => setForm({ ...form, profitMode: v })}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">📊 نسبة مئوية من قيمة التفعيل</SelectItem>
                    <SelectItem value="fixed_per_activation">💵 مبلغ ثابت لكل تفعيل</SelectItem>
                    <SelectItem value="fixed_per_package">📦 مبلغ مخصص لكل باقة</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {form.profitMode === 'percentage' && 'يأخذ الوكيل نسبة % من المبلغ المدفوع'}
                  {form.profitMode === 'fixed_per_activation' && 'مبلغ ثابت بالدينار العراقي عن كل تفعيل/تجديد'}
                  {form.profitMode === 'fixed_per_package' && 'مبلغ مختلف حسب الباقة (يستخدم القيمة الافتراضية إذا الباقة غير مذكورة)'}
                </p>
              </div>

              {form.profitMode === 'percentage' && (
                <div>
                  <Label>نسبة العمولة %</Label>
                  <Input type="number" min="0" max="100" value={form.commission} onChange={e => setForm({ ...form, commission: e.target.value })} className="bg-input/30 border-gold/20" />
                  <p className="text-[10px] text-amber-400 mt-1">مثال: 20% من 50,000 د.ع = 10,000 د.ع للوكيل</p>
                </div>
              )}

              {form.profitMode === 'fixed_per_activation' && (
                <div>
                  <Label>المبلغ الثابت لكل تفعيل (د.ع)</Label>
                  <Input type="number" min="0" value={form.fixedProfitPerActivation} onChange={e => setForm({ ...form, fixedProfitPerActivation: e.target.value })} className="bg-input/30 border-gold/20" />
                  <p className="text-[10px] text-amber-400 mt-1">يحصل الوكيل على هذا المبلغ مهما كانت قيمة الباقة</p>
                </div>
              )}

              {form.profitMode === 'fixed_per_package' && (
                <div className="space-y-2">
                  <div>
                    <Label>المبلغ الافتراضي (لأي باقة غير مدرجة)</Label>
                    <Input type="number" min="0" value={form.fixedProfitPerActivation} onChange={e => setForm({ ...form, fixedProfitPerActivation: e.target.value })} className="bg-input/30 border-gold/20" />
                  </div>
                  <Label className="block pt-2">المبلغ لكل باقة (اتركه فارغاً لاستخدام الافتراضي):</Label>
                  <div className="border border-gold-soft rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-input/30">
                        <tr>
                          <th className="p-2 text-right">الباقة</th>
                          <th className="p-2 text-right">السعر</th>
                          <th className="p-2 text-right">عمولة الوكيل (د.ع)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packages.length === 0 ? (
                          <tr><td colSpan={3} className="p-3 text-center text-muted-foreground">لا توجد باقات</td></tr>
                        ) : packages.map(pkg => (
                          <tr key={pkg.id} className="border-b border-gold-soft/30">
                            <td className="p-2">{pkg.name}</td>
                            <td className="p-2 text-muted-foreground">{fmt(pkg.monthlyFee)} د.ع</td>
                            <td className="p-2">
                              <Input
                                type="number" min="0"
                                value={form.fixedProfitsByPackage?.[pkg.id] ?? ''}
                                onChange={e => {
                                  const v = e.target.value;
                                  const map = { ...(form.fixedProfitsByPackage || {}) };
                                  if (v === '' || v === null) delete map[pkg.id];
                                  else map[pkg.id] = Number(v);
                                  setForm({ ...form, fixedProfitsByPackage: map });
                                }}
                                placeholder="افتراضي"
                                className="bg-input/30 border-gold/20 h-7 text-xs"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="permissions" className="space-y-2 pt-3">
              <p className="text-xs text-muted-foreground mb-2">حدد ما يستطيع الوكيل عمله:</p>
              {[
                { k: 'canViewAllSubscribers', label: '👁️ عرض جميع المشتركين (وليس فقط مشتركيه)' },
                { k: 'canActivate', label: '✅ تفعيل/تجديد المشتركين' },
                { k: 'canEditSubscribers', label: '✏️ تعديل بيانات المشتركين' },
                { k: 'canDeleteSubscribers', label: '🗑️ حذف المشتركين' },
                { k: 'requireAdminApproval', label: '⏳ التفعيل يحتاج موافقة المدير (يضع الطلبات في قائمة الانتظار)', warn: true },
                { k: 'canViewProfits', label: '💰 عرض أرباحه ورصيده' },
                { k: 'canExportData', label: '📥 تصدير البيانات (Excel/PDF)' },
                { k: 'canSendWhatsapp', label: '📱 إرسال رسائل واتساب' },
              ].map(p => (
                <label key={p.k} className={`flex items-center justify-between gap-3 p-2 rounded-lg border cursor-pointer hover:bg-input/30 ${form.permissions?.[p.k] ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gold-soft/30'}`}>
                  <span className={`text-xs ${p.warn && form.permissions?.[p.k] ? 'text-amber-400 font-bold' : ''}`}>{p.label}</span>
                  <input
                    type="checkbox"
                    checked={!!form.permissions?.[p.k]}
                    onChange={e => setForm({ ...form, permissions: { ...form.permissions, [p.k]: e.target.checked } })}
                    className="w-4 h-4 accent-emerald-500"
                  />
                </label>
              ))}
              <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20 text-[10px] text-cyan-400 mt-3">
                💡 ملاحظة: عند تفعيل "يحتاج موافقة المدير"، كل عملية تفعيل/تجديد يقوم بها الوكيل ستظهر في تبويب "طلبات تفعيل بانتظار الموافقة" في صفحة الوكلاء.
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter><Button onClick={save} className="btn-gold w-full">💾 حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statsDialog} onOpenChange={() => setStatsDialog(null)}>
        <DialogContent className="glass-strong border-gold/40 max-w-2xl">
          <DialogHeader><DialogTitle className="gold-text">إحصائيات: {statsDialog?.agent?.name}</DialogTitle></DialogHeader>
          {statsDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="stat-card text-center"><p className="text-[10px] text-muted-foreground">المشتركون</p><p className="text-xl font-bold gold-text">{statsDialog.stats.totalSubscribers}</p></div>
                <div className="stat-card text-center"><p className="text-[10px] text-muted-foreground">النشط</p><p className="text-xl font-bold text-emerald-400">{statsDialog.stats.activeSubscribers}</p></div>
                <div className="stat-card text-center"><p className="text-[10px] text-muted-foreground">التفعيلات</p><p className="text-xl font-bold neon-text">{statsDialog.stats.totalActivations}</p></div>
                <div className="stat-card text-center"><p className="text-[10px] text-muted-foreground">إيراداته</p><p className="text-sm font-bold gold-text">{fmt(statsDialog.stats.totalRevenue)}</p></div>
                <div className="stat-card text-center"><p className="text-[10px] text-muted-foreground">عمولاته</p><p className="text-sm font-bold text-purple-400">{fmt(statsDialog.stats.totalProfit)}</p></div>
                <div className="stat-card text-center"><p className="text-[10px] text-muted-foreground">منتهية قريباً</p><p className="text-xl font-bold text-amber-400">{statsDialog.stats.expiringSoon}</p></div>
              </div>
              <div>
                <h4 className="text-sm font-bold mb-2">آخر التفعيلات:</h4>
                <ScrollArea className="h-48">
                  {statsDialog.activations.map(a => (
                    <div key={a.id} className="text-xs p-2 border-b border-gold-soft/30 flex justify-between">
                      <span>{a.subscriberName}</span>
                      <span className="font-bold gold-text">{fmt(a.amount)} د.ع</span>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
