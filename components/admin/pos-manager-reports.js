'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { api, fmt, fmtCurrency, safeArr, setArr } from '@/lib/page-shared';
import { sounds } from '@/lib/sounds';
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

export default function POSManagerReports() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [filters, setFilters] = useState({ from: monthAgo, to: today, employeeId: '', paymentMethod: '', productId: '', invoice: '', minDiscount: '' });
  const [data, setData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState('summary');
  const [viewingSale, setViewingSale] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(null);

  const fmtCur = (v) => `${Number(v || 0).toLocaleString('en-US')} د.ع`;

  const load = async () => {
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) q.set(k, v); });
    const d = await api(`pos/manager-dashboard?${q.toString()}`);
    setData(d);
  };

  useEffect(() => {
    api('employees').then(d => Array.isArray(d) && setEmployees(d));
    api('products').then(d => Array.isArray(d) && setProducts(d));
  }, []);
  useEffect(() => { load(); }, []);

  const applyFilters = () => { load(); sounds.click(); };
  const reset = () => { setFilters({ from: monthAgo, to: today, employeeId: '', paymentMethod: '', productId: '', invoice: '', minDiscount: '' }); setTimeout(load, 50); };

  const cancelSale = async () => {
    if (!cancelling) return;
    if (!confirm(`تأكيد إلغاء فاتورة ${cancelling.invoiceNumber || cancelling.id}؟`)) return;
    const r = await api(`sales/${cancelling.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: cancelReason }) });
    if (r?.error) { toast.error(r.error); sounds.error(); return; }
    toast.success('🗑️ تم إلغاء الفاتورة واسترجاع المخزون');
    sounds.success();
    setCancelling(null); setCancelReason(''); setViewingSale(null);
    load();
  };

  const printInvoice = (s) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html dir="rtl"><head><title>فاتورة ${s.invoiceNumber}</title>
      <style>body{font-family:Cairo,sans-serif;padding:20px;max-width:400px;margin:auto}h1{text-align:center}table{width:100%;border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #ddd;text-align:right}.total{font-weight:bold;background:#eee}</style>
      </head><body>
      <h1>مركز الغزلان</h1>
      <p>فاتورة رقم: <b>${s.invoiceNumber || s.id}</b></p>
      <p>التاريخ: ${new Date(s.createdAt).toLocaleString('ar-IQ')}</p>
      <p>الموظف: ${s.cashierName || '-'}</p>
      <table>
        <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
        <tbody>${(s.items || []).map(it => `<tr><td>${it.name}</td><td>${it.quantity}</td><td>${Number(it.price).toLocaleString()}</td><td>${(Number(it.price) * Number(it.quantity)).toLocaleString()}</td></tr>`).join('')}</tbody>
      </table>
      <table style="margin-top:10px">
        <tr><td>المجموع الفرعي</td><td>${Number(s.subtotal || s.total + (s.discount || 0)).toLocaleString()} د.ع</td></tr>
        <tr><td>الخصم</td><td>-${Number(s.discount || 0).toLocaleString()} د.ع</td></tr>
        <tr class="total"><td>الإجمالي</td><td>${Number(s.total).toLocaleString()} د.ع</td></tr>
        <tr><td>الدفع</td><td>${s.paymentMethod || 'نقد'}</td></tr>
      </table>
      <script>window.print();</script>
      </body></html>`);
    w.document.close();
  };

  if (!data) return <div className="text-center py-12 text-muted-foreground">⏳ جاري تحميل التقارير...</div>;

  const sum = data.summary;

  return (
    <div className="max-w-[1700px] mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-black gold-text flex items-center gap-2">
          <BarChart3 className="w-6 h-6" /> لوحة المدير - تقارير POS الإدارية
        </h1>
        <p className="text-xs text-muted-foreground mt-1">كل تفاصيل البيع والخصومات والموظفين بشكل احترافي</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '💰 مبيعات اليوم', value: fmtCur(sum.todayTotal), sub: `${sum.todayCount} فاتورة`, color: 'from-emerald-500 to-teal-600' },
          { label: '📊 مبيعات الشهر', value: fmtCur(sum.monthTotal), sub: `${sum.monthCount} فاتورة`, color: 'from-cyan-500 to-blue-600' },
          { label: '🎯 الفلترة الحالية', value: fmtCur(sum.rangeTotal), sub: `${sum.rangeCount} فاتورة`, color: 'from-amber-500 to-yellow-600' },
          { label: '💵 صافي الربح (الفترة)', value: fmtCur(sum.rangeProfit), sub: `خصم ${fmtCur(sum.rangeDiscount)}`, color: 'from-fuchsia-500 to-purple-600' },
          { label: '🏆 أكثر موظف بيعاً', value: sum.topEmployee?.name || '-', sub: sum.topEmployee ? fmtCur(sum.topEmployee.totalSales) : '', color: 'from-orange-500 to-red-600' },
          { label: '⭐ أكثر منتج مبيعاً', value: sum.topProduct?.name || '-', sub: sum.topProduct ? `${sum.topProduct.qty} قطعة` : '', color: 'from-pink-500 to-rose-600' },
          { label: '🎁 خصومات اليوم', value: fmtCur(sum.todayDiscount), sub: 'مجموع خصومات اليوم', color: 'from-rose-500 to-red-600' },
          { label: '📋 خصومات الشهر', value: fmtCur(sum.monthDiscount), sub: 'مجموع خصومات الشهر', color: 'from-violet-500 to-fuchsia-600' },
        ].map((c, i) => (
          <div key={i} className="stat-card">
            <p className={`text-[10px] bg-gradient-to-r ${c.color} bg-clip-text text-transparent font-bold mb-1`}>{c.label}</p>
            <p className="text-lg font-black text-foreground truncate">{c.value}</p>
            {c.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card className="glass-strong border-gold-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 gold-text">🔍 الفلترة المتقدمة</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div><Label className="text-[10px]">من تاريخ</Label><Input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} className="bg-input/30 border-gold/20 h-9" /></div>
          <div><Label className="text-[10px]">إلى تاريخ</Label><Input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} className="bg-input/30 border-gold/20 h-9" /></div>
          <div>
            <Label className="text-[10px]">الموظف</Label>
            <Select value={filters.employeeId || 'all'} onValueChange={v => setFilters({ ...filters, employeeId: v === 'all' ? '' : v })}>
              <SelectTrigger className="bg-input/30 border-gold/20 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الموظفين</SelectItem>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.photo} {e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">طريقة الدفع</Label>
            <Select value={filters.paymentMethod || 'all'} onValueChange={v => setFilters({ ...filters, paymentMethod: v === 'all' ? '' : v })}>
              <SelectTrigger className="bg-input/30 border-gold/20 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="cash">نقد</SelectItem>
                <SelectItem value="card">بطاقة</SelectItem>
                <SelectItem value="zaincash">Zain Cash</SelectItem>
                <SelectItem value="debt">دين</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">المنتج</Label>
            <Select value={filters.productId || 'all'} onValueChange={v => setFilters({ ...filters, productId: v === 'all' ? '' : v })}>
              <SelectTrigger className="bg-input/30 border-gold/20 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المنتجات</SelectItem>
                {products.slice(0, 100).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-[10px]">رقم الفاتورة</Label><Input value={filters.invoice} onChange={e => setFilters({ ...filters, invoice: e.target.value })} placeholder="INV-..." className="bg-input/30 border-gold/20 h-9 font-mono" /></div>
          <div><Label className="text-[10px]">حد أدنى للخصم</Label><Input type="number" value={filters.minDiscount} onChange={e => setFilters({ ...filters, minDiscount: e.target.value })} placeholder="1000" className="bg-input/30 border-gold/20 h-9" /></div>
          <div className="flex items-end gap-2">
            <Button onClick={applyFilters} className="btn-gold flex-1 h-9 text-xs">🔍 تطبيق</Button>
            <Button onClick={reset} variant="outline" className="border-gold/30 h-9 text-xs">↩️</Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { k: 'summary', l: '📊 الفواتير' },
          { k: 'employees', l: '👥 مبيعات الموظفين' },
          { k: 'products', l: '⭐ أعلى المنتجات' },
          { k: 'discounts', l: '🎁 الخصومات' },
          { k: 'payments', l: '💳 طرق الدفع' },
        ].map(b => (
          <button key={b.k} onClick={() => setTab(b.k)}
            className={`px-4 py-2 rounded-lg text-xs border transition-all ${tab === b.k ? 'bg-gold/20 border-gold text-gold' : 'bg-input/30 border-gold-soft text-muted-foreground hover:text-gold'}`}>
            {b.l}
          </button>
        ))}
      </div>

      {/* TAB: SALES LIST */}
      {tab === 'summary' && (
        <Card className="glass-strong border-gold-soft">
          <CardHeader className="pb-2"><CardTitle className="text-sm">قائمة الفواتير ({data.sales.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gold-soft text-right text-muted-foreground"><th className="p-2">الفاتورة</th><th>التاريخ والوقت</th><th>الموظف</th><th>منتجات</th><th>الإجمالي</th><th>الخصم</th><th>الدفع</th><th>الحالة</th><th></th></tr></thead>
                <tbody>
                  {data.sales.length === 0 && <tr><td colSpan="9" className="text-center py-6 text-muted-foreground">لا توجد فواتير مطابقة</td></tr>}
                  {data.sales.map(s => (
                    <tr key={s.id} className={`border-b border-gold-soft/30 hover:bg-gold/5 ${s.cancelled ? 'opacity-50' : ''}`}>
                      <td className="p-2 font-mono font-bold text-cyan-400">{s.invoiceNumber || s.id?.slice(0, 8)}</td>
                      <td className="text-[10px]">{new Date(s.createdAt).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>{s.cashierName || '-'}</td>
                      <td className="text-[10px]">{(s.items || []).length} صنف · {(s.items || []).reduce((a, it) => a + Number(it.quantity || 0), 0)} قطعة</td>
                      <td className="font-bold gold-text">{fmtCur(s.total)}</td>
                      <td className={Number(s.discount) > 0 ? 'text-red-400 font-bold' : ''}>{Number(s.discount) > 0 ? `-${fmtCur(s.discount)}` : '-'}</td>
                      <td><Badge className="text-[10px]">{s.paymentMethod || 'cash'}</Badge></td>
                      <td>{s.cancelled ? <Badge className="bg-red-500/20 text-red-400 text-[10px]">ملغاة</Badge> : <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">مكتملة</Badge>}</td>
                      <td><Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setViewingSale(s)}>عرض</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB: EMPLOYEES */}
      {tab === 'employees' && (
        <Card className="glass-strong border-gold-soft">
          <CardHeader className="pb-2"><CardTitle className="text-sm">تقرير مبيعات الموظفين</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gold-soft text-right text-muted-foreground"><th className="p-2">#</th><th>الموظف</th><th>عدد الفواتير</th><th>إجمالي القطع المباعة</th><th>إجمالي المبيعات</th><th>الخصومات</th><th>متوسط الفاتورة</th></tr></thead>
              <tbody>
                {data.employeesReport.length === 0 && <tr><td colSpan="7" className="text-center py-6 text-muted-foreground">لا توجد بيانات</td></tr>}
                {data.employeesReport.map((e, i) => (
                  <tr key={e.id} className="border-b border-gold-soft/30 hover:bg-gold/5">
                    <td className="p-2 font-bold gold-text">#{i + 1}</td>
                    <td className="font-bold">{i === 0 && '🏆 '}{e.name}</td>
                    <td className="font-bold text-cyan-400">{e.invoices}</td>
                    <td>{e.totalItems}</td>
                    <td className="font-black gold-text">{fmtCur(e.totalSales)}</td>
                    <td className="text-red-400">{fmtCur(e.totalDiscount)}</td>
                    <td className="text-emerald-400">{fmtCur(e.invoices ? e.totalSales / e.invoices : 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* TAB: TOP PRODUCTS */}
      {tab === 'products' && (
        <Card className="glass-strong border-gold-soft">
          <CardHeader className="pb-2"><CardTitle className="text-sm">المنتجات الأكثر مبيعاً</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gold-soft text-right text-muted-foreground"><th className="p-2">#</th><th>المنتج</th><th>SKU</th><th>الكمية المباعة</th><th>الإيرادات</th></tr></thead>
              <tbody>
                {data.topProducts.length === 0 && <tr><td colSpan="5" className="text-center py-6 text-muted-foreground">لا توجد بيانات</td></tr>}
                {data.topProducts.map((p, i) => (
                  <tr key={p.id} className="border-b border-gold-soft/30 hover:bg-gold/5">
                    <td className="p-2 font-bold gold-text">#{i + 1}</td>
                    <td className="font-bold">{i === 0 && '⭐ '}{p.name}</td>
                    <td className="font-mono text-[10px]">{p.sku || '-'}</td>
                    <td className="font-bold text-cyan-400">{p.qty}</td>
                    <td className="font-black gold-text">{fmtCur(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* TAB: DISCOUNTS */}
      {tab === 'discounts' && (
        <Card className="glass-strong border-rose-500/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-rose-400">🎁 تقرير الخصومات الكامل ({data.discounts.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gold-soft text-right text-muted-foreground"><th className="p-2">الفاتورة</th><th>الموظف</th><th>قبل الخصم</th><th>قيمة الخصم</th><th>بعد الخصم</th><th>السبب</th><th>صلاحية</th><th>الوقت</th></tr></thead>
                <tbody>
                  {data.discounts.length === 0 && <tr><td colSpan="8" className="text-center py-6 text-muted-foreground">لا توجد خصومات مطابقة</td></tr>}
                  {data.discounts.map(d => (
                    <tr key={d.saleId} className="border-b border-gold-soft/30 hover:bg-rose-500/5">
                      <td className="p-2 font-mono font-bold text-cyan-400">{d.invoiceNumber || d.saleId.slice(0, 8)}</td>
                      <td>{d.cashierName}</td>
                      <td>{fmtCur(d.subtotal)}</td>
                      <td className="text-red-400 font-bold">-{fmtCur(d.discount)}</td>
                      <td className="font-bold gold-text">{fmtCur(d.total)}</td>
                      <td className="text-[10px]">{d.reason || <span className="text-muted-foreground italic">بدون سبب</span>}</td>
                      <td>
                        {d.requiresApproval
                          ? (d.approved
                              ? <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">✅ بموافقة</Badge>
                              : <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">⚠️ بدون موافقة</Badge>)
                          : <Badge className="bg-cyan-500/20 text-cyan-400 text-[10px]">ضمن الصلاحية</Badge>}
                      </td>
                      <td className="text-[10px]">{new Date(d.createdAt).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB: PAYMENTS */}
      {tab === 'payments' && (
        <Card className="glass-strong border-gold-soft">
          <CardHeader className="pb-2"><CardTitle className="text-sm">📊 توزيع طرق الدفع</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.byPayment.map(p => (
                <div key={p.method} className="stat-card">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">{p.method}</p>
                  <p className="text-xl font-black gold-text">{fmtCur(p.total)}</p>
                  <p className="text-[10px] text-cyan-400 mt-1">{p.count} فاتورة</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sale Detail Dialog */}
      <Dialog open={!!viewingSale} onOpenChange={() => setViewingSale(null)}>
        <DialogContent className="glass-strong border-gold/40 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="gold-text">🧾 تفاصيل الفاتورة - {viewingSale?.invoiceNumber || viewingSale?.id?.slice(0, 8)}</DialogTitle></DialogHeader>
          {viewingSale && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-input/30 border border-gold-soft">
                  <p className="text-[10px] text-muted-foreground">رقم الفاتورة</p>
                  <p className="font-mono font-bold text-cyan-400">{viewingSale.invoiceNumber || viewingSale.id}</p>
                </div>
                <div className="p-2 rounded bg-input/30 border border-gold-soft">
                  <p className="text-[10px] text-muted-foreground">التاريخ والوقت</p>
                  <p className="font-bold">{new Date(viewingSale.createdAt).toLocaleString('ar-IQ')}</p>
                </div>
                <div className="p-2 rounded bg-input/30 border border-gold-soft">
                  <p className="text-[10px] text-muted-foreground">الموظف</p>
                  <p className="font-bold">{viewingSale.cashierName || '-'}</p>
                </div>
                <div className="p-2 rounded bg-input/30 border border-gold-soft">
                  <p className="text-[10px] text-muted-foreground">طريقة الدفع</p>
                  <p className="font-bold">{viewingSale.paymentMethod || 'cash'}</p>
                </div>
              </div>

              <div className="p-2 rounded bg-input/30 border border-gold-soft">
                <p className="text-[10px] text-muted-foreground mb-2 font-bold">🛒 المنتجات</p>
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gold-soft text-right text-muted-foreground"><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
                  <tbody>
                    {(viewingSale.items || []).map((it, i) => (
                      <tr key={i} className="border-b border-gold-soft/30">
                        <td className="py-1">{it.name}</td>
                        <td className="py-1 font-bold">{it.quantity}</td>
                        <td className="py-1">{fmtCur(it.price)}</td>
                        <td className="py-1 font-bold gold-text">{fmtCur(Number(it.price) * Number(it.quantity))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 rounded bg-emerald-500/5 border border-emerald-500/20 space-y-1 text-sm">
                <div className="flex justify-between"><span>المجموع الفرعي:</span><span className="font-bold">{fmtCur(Number(viewingSale.total) + Number(viewingSale.discount || 0))}</span></div>
                {Number(viewingSale.discount) > 0 && <div className="flex justify-between text-red-400"><span>الخصم{viewingSale.discountReason ? ` (${viewingSale.discountReason})` : ''}:</span><span className="font-bold">-{fmtCur(viewingSale.discount)}</span></div>}
                <div className="flex justify-between text-base pt-1 border-t border-gold-soft"><span className="font-bold">الإجمالي:</span><span className="font-black gold-text">{fmtCur(viewingSale.total)}</span></div>
              </div>

              {viewingSale.cancelled && (
                <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-xs">
                  <p className="text-red-400 font-bold">❌ فاتورة ملغاة</p>
                  {viewingSale.cancelReason && <p className="text-muted-foreground mt-1">السبب: {viewingSale.cancelReason}</p>}
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button onClick={() => printInvoice(viewingSale)} className="btn-gold flex-1">🖨️ طباعة</Button>
                {!viewingSale.cancelled && (
                  <Button onClick={() => setCancelling(viewingSale)} className="bg-red-500 hover:bg-red-600 text-white">🗑️ إلغاء الفاتورة</Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelling} onOpenChange={() => { setCancelling(null); setCancelReason(''); }}>
        <DialogContent className="glass-strong border-red-500/40">
          <DialogHeader><DialogTitle className="text-red-400">⚠️ إلغاء فاتورة</DialogTitle></DialogHeader>
          <p className="text-xs">سيتم إلغاء الفاتورة <span className="font-bold gold-text">{cancelling?.invoiceNumber}</span> واسترجاع المنتجات للمخزون.</p>
          <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="سبب الإلغاء (اختياري)..." className="bg-input/30 border-gold/20 h-20" />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCancelling(null); setCancelReason(''); }}>إلغاء</Button>
            <Button onClick={cancelSale} className="bg-red-500 hover:bg-red-600 text-white flex-1">تأكيد الإلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
