'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { api, fmt, fmtCurrency, safeArr, setArr } from '@/lib/page-shared';
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

export default function AccountingPage() {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);

  const load = async () => {
    const r = await api(`accounting/summary?period=${period}`);
    if (!r.error) setData(r);
  };
  useEffect(() => { load(); const i = setInterval(load, 60000); return () => clearInterval(i); }, [period]);

  const handlePrint = () => window.print();

  if (!data) return <div className="text-center py-12 text-sm text-muted-foreground">جاري التحميل...</div>;

  const maxRev = Math.max(...data.breakdown.map(b => b.revenue), 1);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-black gold-text">💼 المحاسبة المالية</h1>
          <p className="text-sm text-muted-foreground mt-1">الأرباح، المصروفات، الديون، والتقارير المالية</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40 bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">📅 اليوم</SelectItem>
              <SelectItem value="month">📆 الشهر الحالي</SelectItem>
              <SelectItem value="year">🗓️ السنة الحالية</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handlePrint} className="btn-neon"><Printer className="w-4 h-4 ml-1" /> طباعة / PDF</Button>
        </div>
      </div>

      <div id="accounting-print" className="space-y-4">
        <div className="hidden print:block text-center border-b-2 border-black pb-3 mb-3">
          <h1 className="text-3xl font-black">مركز الغزلان</h1>
          <p className="text-sm">التقرير المالي - {period === 'day' ? 'اليوم' : period === 'month' ? 'الشهر' : 'السنة'} ({data.prefix})</p>
        </div>

        {/* Top cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="glass-strong border-emerald-500/30 print:border-black"><CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground print:text-black">💵 الإيرادات</p>
            <p className="text-2xl font-bold text-emerald-400 print:text-black">{fmt(data.revenue.total)}</p>
            <p className="text-[10px] text-muted-foreground print:text-black">د.ع</p>
          </CardContent></Card>
          <Card className="glass-strong border-red-500/30 print:border-black"><CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground print:text-black">💸 المصروفات</p>
            <p className="text-2xl font-bold text-red-400 print:text-black">{fmt(data.expenses.total)}</p>
            <p className="text-[10px] text-muted-foreground print:text-black">د.ع</p>
          </CardContent></Card>
          <Card className={`glass-strong ${data.netProfit >= 0 ? 'border-gold/40' : 'border-red-500/40'} print:border-black`}><CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground print:text-black">📈 صافي الربح</p>
            <p className={`text-2xl font-bold ${data.netProfit >= 0 ? 'gold-text' : 'text-red-400'} print:text-black`}>{fmt(data.netProfit)}</p>
            <p className="text-[10px] text-muted-foreground print:text-black">د.ع</p>
          </CardContent></Card>
          <Card className="glass-strong border-amber-500/30 print:border-black"><CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground print:text-black">💰 الديون المستحقة</p>
            <p className="text-2xl font-bold text-amber-400 print:text-black">{fmt(data.debts.total)}</p>
            <p className="text-[10px] text-muted-foreground print:text-black">من {data.debts.count} مدين</p>
          </CardContent></Card>
        </div>

        {/* Revenue breakdown */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="glass-strong border-gold-soft print:border-black">
            <CardHeader><CardTitle className="text-base print:text-black">💵 تفصيل الإيرادات</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm"><span>🧾 مبيعات</span><span className="font-bold">{fmt(data.revenue.sales)} د.ع <span className="text-[10px] text-muted-foreground">({data.counts.sales} فاتورة)</span></span></div>
              <div className="flex justify-between text-sm"><span>🚀 تفعيل اشتراكات</span><span className="font-bold">{fmt(data.revenue.activations)} د.ع <span className="text-[10px] text-muted-foreground">({data.counts.activations} تفعيل)</span></span></div>
              <div className="flex justify-between text-sm"><span>🛠 صيانة</span><span className="font-bold">{fmt(data.revenue.repairs)} د.ع <span className="text-[10px] text-muted-foreground">({data.counts.repairs} تذكرة)</span></span></div>
              <div className="border-t border-gold-soft pt-2 flex justify-between font-bold text-base"><span>الإجمالي</span><span className="text-emerald-400 print:text-black">{fmt(data.revenue.total)} د.ع</span></div>
            </CardContent>
          </Card>

          <Card className="glass-strong border-gold-soft print:border-black">
            <CardHeader><CardTitle className="text-base print:text-black">💸 تفصيل المصروفات</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm"><span>🎁 مكافآت</span><span className="font-bold">{fmt(data.expenses.bonuses)} د.ع</span></div>
              <div className="flex justify-between text-sm"><span>💰 رواتب</span><span className="font-bold">{fmt(data.expenses.salaries)} د.ع</span></div>
              <div className="flex justify-between text-sm"><span>💳 أقساط سلف</span><span className="font-bold">{fmt(data.expenses.advances)} د.ع</span></div>
              <div className="border-t border-gold-soft pt-2 flex justify-between font-bold text-base"><span>الإجمالي</span><span className="text-red-400 print:text-black">{fmt(data.expenses.total)} د.ع</span></div>
            </CardContent>
          </Card>
        </div>

        {/* Breakdown chart (simple) */}
        {data.breakdown && data.breakdown.length > 0 && (
          <Card className="glass-strong border-gold-soft print:border-black">
            <CardHeader><CardTitle className="text-base print:text-black">📊 الإيرادات خلال الفترة</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-1 h-40 mt-2">
                {data.breakdown.map((b, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group" title={`${b.label}: ${fmt(b.revenue)} د.ع`}>
                    <div
                      className="w-full bg-gradient-to-t from-gold/60 to-gold rounded-t transition-all hover:opacity-80 print:bg-black"
                      style={{ height: `${(b.revenue / maxRev) * 100}%`, minHeight: b.revenue > 0 ? '4px' : '1px' }}
                    />
                    <span className="text-[8px] text-muted-foreground print:text-black -rotate-45 origin-left whitespace-nowrap">{b.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debtors */}
        {data.debts.topDebtors.length > 0 && (
          <Card className="glass-strong border-amber-500/30 print:border-black">
            <CardHeader><CardTitle className="text-base print:text-black">💸 أكبر المدينين</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold-soft text-right text-xs text-muted-foreground print:text-black">
                    <th className="p-2">#</th><th>الاسم</th><th>المنطقة</th><th>المبلغ المستحق</th>
                  </tr>
                </thead>
                <tbody>
                  {data.debts.topDebtors.map((d, i) => (
                    <tr key={d.id} className="border-b border-gold-soft/30 hover:bg-amber-500/5">
                      <td className="p-2 font-bold gold-text print:text-black">{i + 1}</td>
                      <td className="p-2 font-bold">{d.name}</td>
                      <td className="p-2 text-muted-foreground print:text-black">{d.zone || '-'}</td>
                      <td className="p-2 font-bold text-red-400 print:text-black">{fmt(d.amount)} د.ع</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <div className="hidden print:flex justify-between mt-8 text-xs">
          <div><p>توقيع المحاسب</p><div className="border-b border-black w-40 h-12 mt-2"></div></div>
          <div><p>توقيع المدير</p><div className="border-b border-black w-40 h-12 mt-2"></div></div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #accounting-print, #accounting-print * { visibility: visible; }
          #accounting-print { position: absolute; left: 0; top: 0; width: 100%; background: white !important; color: black !important; padding: 20px; }
          .glass-strong { background: white !important; border: 1px solid #d4af37 !important; }
        }
      `}</style>
    </div>
  );
}
