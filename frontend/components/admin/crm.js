'use client';
import { useState, useEffect, useMemo } from 'react';
import { api, fmt, fmtCurrency, safeArr } from '@/lib/page-shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Users, TrendingUp, AlertTriangle, Crown, Sparkles, Search,
  Phone, MapPin, Wallet, ShoppingCart, Calendar, ChevronRight,
  Star, Award, Gift, MessageSquare, Eye, Plus, Trash2,
  DollarSign, Activity, BadgeCheck
} from 'lucide-react';

const TIER_COLORS = {
  bronze: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  silver: { bg: 'bg-slate-400/10', text: 'text-slate-300', border: 'border-slate-400/30' },
  gold: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  platinum: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
};

const RISK_COLORS = {
  low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  high: 'bg-red-500/20 text-red-400 border-red-500/40',
  unknown: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40',
};

const RISK_LABELS = {
  low: '✅ آمن',
  medium: '⚠️ متوسط',
  high: '🚨 عالي',
  unknown: '❓ غير معروف',
};

export default function CRMPage() {
  const [overview, setOverview] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [ov, cs] = await Promise.all([api('crm/overview'), api('crm/customers')]);
      setOverview(ov);
      setCustomers(safeArr(cs?.customers));
    } catch (e) {
      toast.error('فشل تحميل بيانات CRM');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let arr = customers;
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(c => (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.username || '').toLowerCase().includes(q));
    }
    if (tierFilter !== 'all') arr = arr.filter(c => c.tier === tierFilter);
    if (riskFilter !== 'all') arr = arr.filter(c => c.riskLevel === riskFilter);
    return arr;
  }, [customers, search, tierFilter, riskFilter]);

  const KPI = ({ icon, label, value, sub, color = 'gold' }) => (
    <Card className={`glass-card border-${color}-500/20`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-muted-foreground">{label}</p>
          <span className="text-lg">{icon}</span>
        </div>
        <p className={`text-2xl font-bold gold-text`}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Card className="glass-strong border-gold/30">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="gold-text flex items-center gap-2 text-2xl">
                <Users className="w-6 h-6" /> CRM إدارة علاقات العملاء
              </CardTitle>
              <CardDescription className="mt-1">
                تحليل ذكي لقاعدة العملاء — نقاط ولاء، تصنيفات، عملاء بخطر، أعلى المنفقين
              </CardDescription>
            </div>
            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/40">
              <Sparkles className="w-3 h-3 ml-1" /> محسوب تلقائياً
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <KPI icon="👥" label="إجمالي العملاء" value={fmt(overview.totals.totalCustomers)} sub={`+${overview.totals.newThisMonth} هذا الشهر`} />
          <KPI icon="💰" label="القيمة الكلية" value={fmtCurrency(overview.totals.totalLTV)} sub="LTV إجمالي" />
          <KPI icon="📊" label="متوسط القيمة" value={fmtCurrency(overview.totals.avgLTV)} sub="LTV / عميل" />
          <KPI icon="⭐" label="نقاط الولاء" value={fmt(overview.totals.totalLoyaltyPoints)} sub="مجموع نقاط الكل" />
          <KPI icon="🚨" label="عملاء بخطر" value={fmt(overview.byRisk.high + overview.byRisk.medium)} sub={`${overview.byRisk.high} عالي + ${overview.byRisk.medium} متوسط`} />
        </div>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-input/30">
          <TabsTrigger value="overview"><TrendingUp className="w-3 h-3 ml-1" /> نظرة عامة</TabsTrigger>
          <TabsTrigger value="all"><Users className="w-3 h-3 ml-1" /> جميع العملاء ({customers.length})</TabsTrigger>
          <TabsTrigger value="top"><Crown className="w-3 h-3 ml-1" /> كبار الزبائن</TabsTrigger>
          <TabsTrigger value="risk"><AlertTriangle className="w-3 h-3 ml-1" /> عملاء بخطر</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-3">
          {overview && (
            <>
              <Card className="glass-card border-gold-soft">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Award className="w-4 h-4 text-gold" /> توزيع التصنيفات (Tiers)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { key: 'platinum', icon: '💎', label: 'بلاتيني', range: '5M+ د.ع', count: overview.byTier.platinum },
                      { key: 'gold', icon: '🥇', label: 'ذهبي', range: '2M-5M د.ع', count: overview.byTier.gold },
                      { key: 'silver', icon: '🥈', label: 'فضي', range: '500K-2M د.ع', count: overview.byTier.silver },
                      { key: 'bronze', icon: '🥉', label: 'برونزي', range: '<500K د.ع', count: overview.byTier.bronze },
                    ].map(t => {
                      const colors = TIER_COLORS[t.key];
                      return (
                        <div key={t.key} className={`p-4 rounded-xl border ${colors.bg} ${colors.border} text-center`}>
                          <div className="text-3xl mb-1">{t.icon}</div>
                          <p className={`text-xs font-bold ${colors.text}`}>{t.label}</p>
                          <p className="text-2xl font-bold mt-1">{t.count}</p>
                          <p className="text-[9px] text-muted-foreground mt-1">{t.range}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-cyan-500/20">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-400" /> توزيع المخاطر</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { key: 'low', label: '✅ آمن', desc: '< 60 يوم', count: overview.byRisk.low },
                      { key: 'medium', label: '⚠️ متوسط', desc: '60-90 يوم', count: overview.byRisk.medium },
                      { key: 'high', label: '🚨 عالي', desc: '> 90 يوم / منتهي', count: overview.byRisk.high },
                      { key: 'unknown', label: '❓ غير معروف', desc: 'لا يوجد نشاط', count: overview.byRisk.unknown },
                    ].map(r => (
                      <div key={r.key} className={`p-3 rounded-lg border text-center ${RISK_COLORS[r.key]}`}>
                        <p className="text-xs font-bold">{r.label}</p>
                        <p className="text-3xl font-bold mt-1">{r.count}</p>
                        <p className="text-[9px] opacity-70 mt-1">{r.desc}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-gold-soft">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Crown className="w-4 h-4 text-amber-400" /> Top 5 عملاء</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(overview.top10 || []).slice(0, 5).map((c, i) => (
                    <CustomerRow key={c.subscriberId} customer={c} rank={i + 1} onSelect={() => setSelectedCustomer(c)} />
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ALL CUSTOMERS */}
        <TabsContent value="all" className="space-y-3">
          <Card className="glass-card border-gold-soft">
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-2 mb-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="بحث بالاسم/الهاتف/اليوزر..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pr-10 bg-input/30 border-gold/20"
                  />
                </div>
                <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} className="bg-input/30 border border-gold/20 rounded-md px-3 text-xs">
                  <option value="all">جميع التصنيفات</option>
                  <option value="platinum">💎 بلاتيني</option>
                  <option value="gold">🥇 ذهبي</option>
                  <option value="silver">🥈 فضي</option>
                  <option value="bronze">🥉 برونزي</option>
                </select>
                <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} className="bg-input/30 border border-gold/20 rounded-md px-3 text-xs">
                  <option value="all">جميع المخاطر</option>
                  <option value="low">✅ آمن</option>
                  <option value="medium">⚠️ متوسط</option>
                  <option value="high">🚨 عالي</option>
                  <option value="unknown">❓ غير معروف</option>
                </select>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">لا توجد نتائج</p>
                ) : filtered.map((c, i) => (
                  <CustomerRow key={c.subscriberId} customer={c} rank={i + 1} onSelect={() => setSelectedCustomer(c)} />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TOP CUSTOMERS */}
        <TabsContent value="top" className="space-y-2">
          {overview?.top10?.length ? overview.top10.map((c, i) => (
            <CustomerRow key={c.subscriberId} customer={c} rank={i + 1} onSelect={() => setSelectedCustomer(c)} expanded />
          )) : <p className="text-center text-muted-foreground py-8 text-sm">لا توجد بيانات</p>}
        </TabsContent>

        {/* AT-RISK */}
        <TabsContent value="risk" className="space-y-2">
          {overview?.atRisk?.length ? (
            <>
              <Card className="glass-card border-red-500/30 bg-red-500/5">
                <CardContent className="pt-4 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p>هؤلاء عملاء لم يقوموا بأي معاملة منذ أكثر من 60 يوماً أو لديهم اشتراك منتهي. تواصل معهم لاستعادتهم.</p>
                </CardContent>
              </Card>
              {overview.atRisk.map((c, i) => (
                <CustomerRow key={c.subscriberId} customer={c} rank={i + 1} onSelect={() => setSelectedCustomer(c)} expanded showRisk />
              ))}
            </>
          ) : <p className="text-center text-muted-foreground py-8 text-sm">🎉 لا يوجد عملاء بخطر</p>}
        </TabsContent>
      </Tabs>

      {/* CUSTOMER DETAIL DIALOG */}
      {selectedCustomer && (
        <CustomerDetailDialog
          customerId={selectedCustomer.subscriberId}
          onClose={() => setSelectedCustomer(null)}
          onUpdate={load}
        />
      )}
    </div>
  );
}

function CustomerRow({ customer, rank, onSelect, expanded, showRisk }) {
  const colors = TIER_COLORS[customer.tier] || TIER_COLORS.bronze;
  return (
    <div
      onClick={onSelect}
      className={`p-3 rounded-lg border ${colors.border} ${colors.bg} hover:scale-[1.01] transition-all cursor-pointer flex items-center gap-3`}
    >
      <div className="text-2xl">{customer.tierIcon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {rank && <Badge variant="outline" className="text-[9px] shrink-0">#{rank}</Badge>}
          <h4 className="font-bold text-sm truncate">{customer.name}</h4>
          <Badge className={`text-[9px] ${colors.bg} ${colors.text} ${colors.border}`}>{customer.tierLabel}</Badge>
          {showRisk && <Badge className={`text-[9px] ${RISK_COLORS[customer.riskLevel]}`}>{RISK_LABELS[customer.riskLevel]}</Badge>}
        </div>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
          {customer.phone && <span dir="ltr" className="font-mono">{customer.phone}</span>}
          {customer.zoneName && <span><MapPin className="w-2.5 h-2.5 inline" /> {customer.zoneName}</span>}
          <span><ShoppingCart className="w-2.5 h-2.5 inline" /> {customer.transactionsCount} معاملة</span>
          {customer.daysSinceLast !== null && <span><Calendar className="w-2.5 h-2.5 inline" /> آخر نشاط منذ {customer.daysSinceLast} يوم</span>}
        </div>
      </div>
      <div className="text-left shrink-0">
        <p className="font-bold gold-text text-sm">{fmtCurrency(customer.lifetimeValue)}</p>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
          <Star className="w-2.5 h-2.5" /> {customer.loyaltyPoints} نقطة
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground rtl:rotate-180" />
    </div>
  );
}

function CustomerDetailDialog({ customerId, onClose, onUpdate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api(`crm/customers/${customerId}`);
      setData(d);
    } catch (e) {
      toast.error('فشل تحميل بيانات العميل');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [customerId]);

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      const r = await api(`crm/customers/${customerId}/note`, { method: 'POST', body: JSON.stringify({ text: noteText }) });
      if (r?.success) {
        toast.success('✅ تم إضافة الملاحظة');
        setNoteText('');
        await load();
        onUpdate?.();
      }
    } catch (e) { toast.error('خطأ'); }
    finally { setSaving(false); }
  };

  const delNote = async (noteId) => {
    if (!confirm('حذف الملاحظة؟')) return;
    await api(`crm/customers/${customerId}/note/${noteId}`, { method: 'DELETE' });
    toast.success('🗑️ تم الحذف');
    await load();
  };

  if (loading || !data) return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="glass-strong border-gold/40">
        <p className="text-center py-8 text-muted-foreground">جاري التحميل…</p>
      </DialogContent>
    </Dialog>
  );

  const colors = TIER_COLORS[data.tier] || TIER_COLORS.bronze;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="glass-strong border-gold/40 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="gold-text flex items-center gap-2 text-xl">
            <span className="text-3xl">{data.tierIcon}</span>
            {data.name}
            <Badge className={`${colors.bg} ${colors.text} ${colors.border}`}>{data.tierLabel}</Badge>
            <Badge className={RISK_COLORS[data.riskLevel]}>{RISK_LABELS[data.riskLevel]}</Badge>
          </DialogTitle>
          <DialogDescription>
            <span dir="ltr" className="font-mono text-cyan-400">{data.phone}</span> · {data.username && `@${data.username} · `}{data.zoneName}
          </DialogDescription>
        </DialogHeader>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center">
            <p className="text-[10px] text-emerald-400">القيمة الكلية</p>
            <p className="text-lg font-bold gold-text">{fmtCurrency(data.lifetimeValue)}</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center">
            <p className="text-[10px] text-amber-400">نقاط الولاء</p>
            <p className="text-lg font-bold text-amber-300 flex items-center justify-center gap-1">
              <Star className="w-4 h-4" /> {fmt(data.loyaltyPoints)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-center">
            <p className="text-[10px] text-cyan-400">معاملات الإنترنت</p>
            <p className="text-lg font-bold text-cyan-300">{data.activationsCount} · {fmt(data.activationsTotal)} د.ع</p>
          </div>
          <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/30 text-center">
            <p className="text-[10px] text-violet-400">مبيعات POS</p>
            <p className="text-lg font-bold text-violet-300">{data.salesCount} · {fmt(data.salesTotal)} د.ع</p>
          </div>
        </div>

        <Tabs defaultValue="notes" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-input/30">
            <TabsTrigger value="notes">📝 الملاحظات</TabsTrigger>
            <TabsTrigger value="sales">🛒 المبيعات</TabsTrigger>
            <TabsTrigger value="activations">⚡ التفعيلات</TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="space-y-2">
            <div className="flex gap-2">
              <Textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="أضف ملاحظة جديدة (مثلاً: عميل VIP، تفضيلات، تذكير...)"
                className="bg-input/30 border-gold/20 h-20"
              />
              <Button onClick={addNote} disabled={saving || !noteText.trim()} className="btn-gold self-end">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {(data.notes || []).length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-xs">لا توجد ملاحظات</p>
            ) : (
              <div className="space-y-2">
                {(data.notes || []).map(n => (
                  <div key={n.id} className="p-3 rounded-lg bg-input/30 border border-gold-soft text-xs">
                    <p className="whitespace-pre-line">{n.text}</p>
                    <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                      <span>👤 {n.author} · {n.createdAt ? new Date(n.createdAt).toLocaleString('ar-IQ') : ''}</span>
                      <Button size="icon" variant="ghost" className="h-5 w-5 hover:text-red-400" onClick={() => delNote(n.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sales">
            {(data.sales || []).length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-xs">لا توجد مبيعات</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {data.sales.map(s => (
                  <div key={s.id} className="p-2 rounded bg-input/30 border border-gold-soft text-xs flex justify-between">
                    <div>
                      <p className="font-mono text-cyan-400">{s.invoiceNumber}</p>
                      <p className="text-[10px] text-muted-foreground">{s.createdAt ? new Date(s.createdAt).toLocaleString('ar-IQ') : ''}</p>
                    </div>
                    <p className="font-bold gold-text">{fmtCurrency(s.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activations">
            {(data.activations || []).length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-xs">لا توجد تفعيلات</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {data.activations.map(a => (
                  <div key={a.id} className="p-2 rounded bg-input/30 border border-gold-soft text-xs flex justify-between">
                    <div>
                      <p className="font-bold">{a.packageName || a.speed || 'تفعيل'}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {a.startDate} → {a.endDate}
                      </p>
                    </div>
                    <p className="font-bold gold-text">{fmtCurrency(a.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={onClose} className="btn-gold">إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
