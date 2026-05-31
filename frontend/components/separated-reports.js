'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/page-shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { TrendingUp, TrendingDown, ShoppingCart, Wifi, Wrench, CreditCard, Receipt, Users, Download, Printer, RefreshCw, Calendar, BarChart3, DollarSign, Calculator } from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const CHART_COLORS = ['#FFD700', '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#a855f7'];

export default function SeparatedReports({ api }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(todayStr);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api(`reports/separated?from=${from}&to=${to}`);
      if (d && !d._failed) setData(d);
      else toast.error('فشل تحميل التقرير');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const applyPreset = (preset) => {
    const today = new Date();
    let f, t;
    if (preset === 'today') { f = t = todayStr; }
    else if (preset === 'yesterday') {
      const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      f = t = y;
    }
    else if (preset === 'week') { f = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10); t = todayStr; }
    else if (preset === 'month') { f = monthAgo; t = todayStr; }
    else if (preset === 'this_month') { f = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10); t = todayStr; }
    else if (preset === 'year') { f = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10); t = todayStr; }
    setFrom(f); setTo(t);
    setTimeout(load, 50);
  };

  const exportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    // Summary
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { القسم: 'المبيعات', الإجمالي: data.sales.total, الربح: data.sales.profit, العدد: data.sales.count },
      { القسم: 'الاشتراكات', الإجمالي: data.subscriptions.total, المدفوع: data.subscriptions.paid, العدد: data.subscriptions.count },
      { القسم: 'الصيانة', الإجمالي: data.repairs.revenue, التكلفة: data.repairs.cost, العدد: data.repairs.count },
      { القسم: 'الديون المسددة', الإجمالي: data.debts.paidInRange },
      { القسم: 'الصرفيات', الإجمالي: -data.expenses.total },
      { القسم: 'صافي الربح', الإجمالي: data.net.profit },
    ]), 'الملخص');
    // Agents
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.agents.map(a => ({
      الوكيل: a.name, الإيراد: a.revenue, الربح: a.profit, 'عدد التفعيلات': a.activationsCount, 'عدد المشتركين': a.subscribersCount, الرصيد: a.balance,
    }))), 'الوكلاء');
    // Daily chart data
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.chart.map(d => ({
      التاريخ: d.date, المبيعات: d.sales, الاشتراكات: d.subscriptions, الصيانة: d.repairs, الصرفيات: d.expenses,
    }))), 'التفاصيل اليومية');
    XLSX.writeFile(wb, `reports-${from}_to_${to}.xlsx`);
    toast.success('📥 تم التصدير');
  };

  const printReport = () => {
    if (!data) return;
    const w = window.open('', '_blank', 'width=1000,height=800');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>التقرير المالي</title>
      <style>body{font-family:Arial;padding:20px}h1{color:#b8860b}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.c{border:1px solid #ddd;border-radius:8px;padding:15px}.c h3{margin:0;font-size:14px;color:#666}.c .n{font-size:28px;font-weight:bold;margin:5px 0}.gold{color:#b8860b}.green{color:#10b981}.red{color:#dc2626}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #ddd;padding:8px;text-align:right;font-size:12px}th{background:#f5f0d8}</style>
      </head><body>
      <h1>📊 التقرير المالي المُنفصل</h1>
      <p>الفترة: ${from} → ${to} (${data.period.days} يوم)</p>
      <div class="g">
        <div class="c"><h3>إجمالي المبيعات (POS)</h3><p class="n green">${fmt(data.sales.total)} د.ع</p><small>${data.sales.count} عملية | ربح: ${fmt(data.sales.profit)}</small></div>
        <div class="c"><h3>إجمالي الاشتراكات</h3><p class="n green">${fmt(data.subscriptions.total)} د.ع</p><small>${data.subscriptions.count} تفعيل</small></div>
        <div class="c"><h3>إيرادات الصيانة</h3><p class="n green">${fmt(data.repairs.revenue)} د.ع</p><small>${data.repairs.count} طلب</small></div>
        <div class="c"><h3>الديون المسددة</h3><p class="n green">${fmt(data.debts.paidInRange)} د.ع</p></div>
        <div class="c"><h3>الصرفيات</h3><p class="n red">-${fmt(data.expenses.total)} د.ع</p></div>
        <div class="c"><h3>💰 صافي الربح</h3><p class="n ${data.net.profit >= 0 ? 'gold' : 'red'}">${fmt(data.net.profit)} د.ع</p></div>
      </div>
      <h2>الوكلاء</h2>
      <table><thead><tr><th>الوكيل</th><th>الإيراد</th><th>الربح</th><th>التفعيلات</th><th>المشتركون</th><th>الرصيد</th></tr></thead>
      <tbody>${data.agents.map(a => `<tr><td>${a.name}</td><td>${fmt(a.revenue)}</td><td>${fmt(a.profit)}</td><td>${a.activationsCount}</td><td>${a.subscribersCount}</td><td>${fmt(a.balance)}</td></tr>`).join('')}</tbody>
      </table>
      <script>window.onload=()=>setTimeout(()=>window.print(),400);</script>
      </body></html>`);
    w.document.close();
  };

  if (!data && loading) return <p className="text-center py-12">جاري التحميل...</p>;
  if (!data) return <p className="text-center py-12 text-muted-foreground">لا توجد بيانات</p>;

  const pieData = [
    { name: 'مبيعات', value: data.sales.total, color: '#FFD700' },
    { name: 'اشتراكات', value: data.subscriptions.total, color: '#10b981' },
    { name: 'صيانة', value: data.repairs.revenue, color: '#3b82f6' },
    { name: 'ديون مسددة', value: data.debts.paidInRange, color: '#f59e0b' },
  ].filter(x => x.value > 0);

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold gold-text flex items-center gap-2">
          <BarChart3 className="w-6 h-6" /> التقارير المُنفصلة
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={exportExcel} variant="outline" className="border-emerald-500/40 text-emerald-400"><Download className="w-4 h-4 ml-1" /> Excel</Button>
          <Button onClick={printReport} variant="outline" className="border-gold/30"><Printer className="w-4 h-4 ml-1" /> طباعة</Button>
          <Button onClick={load} variant="outline" className="border-gold/30" disabled={loading}><RefreshCw className={`w-4 h-4 ml-1 ${loading ? 'animate-spin' : ''}`} /></Button>
        </div>
      </div>

      {/* Date filter + presets */}
      <Card className="glass-strong border-gold-soft">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-[10px]">من</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="bg-input/30 border-gold/20 h-9" />
            </div>
            <div>
              <Label className="text-[10px]">إلى</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="bg-input/30 border-gold/20 h-9" />
            </div>
            <Button onClick={load} className="btn-gold h-9">تطبيق</Button>
            <div className="flex gap-1 flex-wrap mr-2">
              {[
                ['today', 'اليوم'], ['yesterday', 'أمس'], ['week', 'آخر 7 أيام'],
                ['month', 'آخر 30 يوم'], ['this_month', 'هذا الشهر'], ['year', 'هذه السنة']
              ].map(([k, lbl]) => (
                <Button key={k} size="sm" variant="outline" className="h-8 text-[10px] border-gold/30" onClick={() => applyPreset(k)}>{lbl}</Button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            <Calendar className="w-3 h-3 inline ml-1" /> الفترة: {data.period.from} → {data.period.to} ({data.period.days} يوم)
          </p>
        </CardContent>
      </Card>

      {/* HERO STATS - 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <StatCard icon={<ShoppingCart className="w-4 h-4" />} title="المبيعات (POS)" value={data.sales.total} sub={`${data.sales.count} عملية`} color="text-gold" border="border-gold/40" />
        <StatCard icon={<Wifi className="w-4 h-4" />} title="الاشتراكات" value={data.subscriptions.total} sub={`${data.subscriptions.count} تفعيل`} color="text-emerald-400" border="border-emerald-500/40" />
        <StatCard icon={<Wrench className="w-4 h-4" />} title="الصيانة" value={data.repairs.revenue} sub={`${data.repairs.count} طلب`} color="text-blue-400" border="border-blue-500/40" />
        <StatCard icon={<CreditCard className="w-4 h-4" />} title="ديون مسددة" value={data.debts.paidInRange} sub={`المتبقي: ${fmt(data.debts.outstanding)}`} color="text-amber-400" border="border-amber-500/40" />
        <StatCard icon={<TrendingDown className="w-4 h-4" />} title="الصرفيات" value={-data.expenses.total} sub={`${data.expenses.count} عملية`} color="text-red-400" border="border-red-500/40" />
        <StatCard icon={<Calculator className="w-4 h-4" />} title="💰 صافي الربح" value={data.net.profit} sub={data.net.profit >= 0 ? '✅ ربح' : '⚠ خسارة'} color={data.net.profit >= 0 ? 'text-emerald-400' : 'text-red-400'} border="border-gold/60" bg="bg-gold/5" />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-input/30 border border-gold-soft">
          <TabsTrigger value="overview">📈 نظرة عامة</TabsTrigger>
          <TabsTrigger value="categories">🗂️ تفاصيل الأقسام</TabsTrigger>
          <TabsTrigger value="agents">👨‍💼 الوكلاء</TabsTrigger>
          <TabsTrigger value="net">💰 الربح الصافي</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview">
          <div className="grid lg:grid-cols-3 gap-3">
            <Card className="glass-strong border-gold-soft lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm gold-text">📊 الإيرادات اليومية</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.chart}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FFD700" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="label" stroke="#888" style={{ fontSize: '10px' }} />
                    <YAxis stroke="#888" style={{ fontSize: '10px' }} />
                    <Tooltip contentStyle={{ background: '#1a1a1f', border: '1px solid #FFD700' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" dataKey="sales" stroke="#FFD700" fillOpacity={1} fill="url(#g1)" name="مبيعات" />
                    <Area type="monotone" dataKey="subscriptions" stroke="#10b981" fillOpacity={1} fill="url(#g2)" name="اشتراكات" />
                    <Area type="monotone" dataKey="repairs" stroke="#3b82f6" fillOpacity={1} fill="url(#g3)" name="صيانة" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-strong border-gold-soft">
              <CardHeader className="pb-2"><CardTitle className="text-sm gold-text">🥧 توزيع الإيرادات</CardTitle></CardHeader>
              <CardContent>
                {pieData.length === 0 ? <p className="text-center text-muted-foreground py-12">لا توجد بيانات</p> :
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}: ${Math.round((e.value / data.net.totalRevenue) * 100)}%`}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1a1a1f', border: '1px solid #FFD700' }} />
                  </PieChart>
                </ResponsiveContainer>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CATEGORIES DETAIL */}
        <TabsContent value="categories">
          <div className="grid md:grid-cols-2 gap-3">
            <DetailCard title="🛒 المبيعات (POS)" color="border-gold/40 bg-gold/5" lines={[
              { label: 'إجمالي البيع', value: data.sales.total, bold: true },
              { label: 'إجمالي التكلفة', value: data.sales.cost },
              { label: 'الربح', value: data.sales.profit, success: true },
              { label: 'عدد العمليات', value: data.sales.count, plain: true },
            ]} />
            <DetailCard title="📡 الاشتراكات" color="border-emerald-500/40 bg-emerald-500/5" lines={[
              { label: 'الإجمالي المُفعَّل', value: data.subscriptions.total, bold: true },
              { label: 'المُحصَّل', value: data.subscriptions.paid, success: true },
              { label: 'الدين المتبقي', value: data.subscriptions.debt, danger: true },
              { label: 'عدد التفعيلات', value: data.subscriptions.count, plain: true },
            ]} />
            <DetailCard title="🔧 الصيانة" color="border-blue-500/40 bg-blue-500/5" lines={[
              { label: 'الإيرادات', value: data.repairs.revenue, bold: true },
              { label: 'تكلفة القطع', value: data.repairs.cost, danger: true },
              { label: 'صافي الربح', value: data.repairs.profit, success: true },
              { label: 'إجمالي الطلبات', value: data.repairs.count, plain: true },
              { label: 'المُكتمل', value: data.repairs.completed, plain: true },
            ]} />
            <DetailCard title="💸 الصرفيات" color="border-red-500/40 bg-red-500/5" lines={[
              { label: 'إجمالي الصرفيات', value: data.expenses.total, danger: true, bold: true },
              { label: 'عدد العمليات', value: data.expenses.count, plain: true },
              ...Object.entries(data.expenses.byCategory).map(([k, v]) => ({ label: `↳ ${k === 'general' ? 'عام' : k}`, value: v })),
            ]} />
            <DetailCard title="💰 الديون" color="border-amber-500/40 bg-amber-500/5" lines={[
              { label: 'إجمالي الديون المستحقة (حالياً)', value: data.debts.outstanding, danger: true, bold: true },
              { label: 'المسدَّد خلال الفترة', value: data.debts.paidInRange, success: true },
            ]} />
            <Card className="glass-strong border-violet-500/40 bg-violet-500/5">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-violet-400">📊 ملخص المُدخلات/المُخرجات</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-xs">
                <div className="flex justify-between"><span>💚 إجمالي الإيرادات</span><span className="font-bold text-emerald-400">+{fmt(data.net.totalRevenue)} د.ع</span></div>
                <div className="flex justify-between"><span>❤️ إجمالي التكاليف</span><span className="font-bold text-red-400">-{fmt(data.net.totalCost)} د.ع</span></div>
                <hr className="border-gold-soft my-2" />
                <div className="flex justify-between text-base"><span className="font-bold">💎 صافي الربح</span><span className={`font-bold ${data.net.profit >= 0 ? 'gold-text' : 'text-red-400'}`}>{fmt(data.net.profit)} د.ع</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AGENTS */}
        <TabsContent value="agents">
          <Card className="glass-strong border-gold-soft">
            <CardContent className="p-3">
              <table className="w-full text-xs">
                <thead className="bg-input/30 border-b border-gold-soft">
                  <tr>
                    <th className="p-2 text-right">الوكيل</th>
                    <th className="p-2 text-right">الإيراد</th>
                    <th className="p-2 text-right">الربح المُحتسب</th>
                    <th className="p-2 text-right">عدد التفعيلات</th>
                    <th className="p-2 text-right">إجمالي المشتركين</th>
                    <th className="p-2 text-right">رصيد الوكيل</th>
                  </tr>
                </thead>
                <tbody>
                  {data.agents.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا يوجد وكلاء</td></tr> :
                  data.agents.map(a => (
                    <tr key={a.id} className="border-b border-gold-soft/20 hover:bg-input/10">
                      <td className="p-2 font-bold">{a.name}</td>
                      <td className="p-2 text-emerald-400 font-bold">+{fmt(a.revenue)}</td>
                      <td className="p-2 gold-text font-bold">{fmt(a.profit)}</td>
                      <td className="p-2">{a.activationsCount}</td>
                      <td className="p-2">{a.subscribersCount}</td>
                      <td className={`p-2 ${a.balance < 0 ? 'text-red-400' : 'text-cyan-400'} font-bold`}>{fmt(a.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NET PROFIT BIG VIEW */}
        <TabsContent value="net">
          <Card className="glass-strong border-gold-soft">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">صافي الربح للفترة من {from} إلى {to}</p>
              <p className={`text-6xl font-black mb-4 ${data.net.profit >= 0 ? 'gold-text' : 'text-red-400'}`}>
                {fmt(data.net.profit)} <span className="text-xl">د.ع</span>
              </p>
              <div className="grid md:grid-cols-2 gap-3 max-w-2xl mx-auto mt-6">
                <Card className="bg-emerald-500/10 border-emerald-500/30">
                  <CardContent className="p-3 text-center">
                    <TrendingUp className="w-6 h-6 mx-auto text-emerald-400 mb-1" />
                    <p className="text-xs text-muted-foreground">إجمالي الإيرادات</p>
                    <p className="text-2xl font-bold text-emerald-400">+{fmt(data.net.totalRevenue)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-500/10 border-red-500/30">
                  <CardContent className="p-3 text-center">
                    <TrendingDown className="w-6 h-6 mx-auto text-red-400 mb-1" />
                    <p className="text-xs text-muted-foreground">إجمالي التكاليف</p>
                    <p className="text-2xl font-bold text-red-400">-{fmt(data.net.totalCost)}</p>
                  </CardContent>
                </Card>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                الصيغة: ربح المبيعات + الاشتراكات + الصيانة + الديون المسددة − الصرفيات − تكلفة الصيانة
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon, title, value, sub, color, border, bg }) {
  return (
    <Card className={`glass-strong ${border} ${bg || ''}`}>
      <CardContent className="p-3">
        <div className={`flex items-center gap-1 text-[10px] text-muted-foreground mb-1 ${color}`}>{icon} {title}</div>
        <p className={`text-xl font-bold ${color}`}>{fmt(value)}</p>
        <p className="text-[9px] text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function DetailCard({ title, color, lines }) {
  return (
    <Card className={`glass-strong ${color}`}>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1 text-xs">
        {lines.map((l, i) => (
          <div key={i} className="flex justify-between">
            <span className={l.bold ? 'font-bold' : ''}>{l.label}</span>
            <span className={`${l.bold ? 'font-bold' : ''} ${l.success ? 'text-emerald-400' : l.danger ? 'text-red-400' : l.plain ? '' : 'gold-text'}`}>
              {l.plain ? l.value : fmt(l.value)} {l.plain ? '' : 'د.ع'}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
