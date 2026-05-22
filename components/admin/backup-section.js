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

export default function BackupSection({ draft, update, runBackup }) {
  const b = draft.backup || {};
  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadList = async () => {
    setLoadingList(true);
    const r = await api('settings/backup/list');
    setList(safeArr(r));
    setLoadingList(false);
  };
  useEffect(() => { loadList(); }, []);

  const triggerNow = async () => {
    setBusy(true);
    await runBackup();
    await loadList();
    setBusy(false);
  };

  const downloadBackup = (id, filename) => {
    const url = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/settings/backup/download/${id}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const deleteBackup = async (id) => {
    if (!confirm('حذف هذه النسخة الاحتياطية نهائياً؟')) return;
    const r = await api(`settings/backup/${id}`, { method: 'DELETE' });
    if (r?.success) { toast.success('🗑️ تم الحذف'); loadList(); }
    else toast.error('فشل الحذف');
  };

  const formatSize = (kb) => kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(2)} MB`;

  // Compute next scheduled backup time
  const computeNext = () => {
    if (!b.enabled) return 'معطّل';
    const last = b.lastBackup ? new Date(b.lastBackup) : null;
    const map = { hourly: 1, daily: 24, weekly: 168, monthly: 720 };
    const hrs = map[b.schedule || 'daily'] || 24;
    if (!last) return 'خلال 30 ثانية (التشغيل الأول)';
    const next = new Date(last.getTime() + hrs * 3600000);
    if (next < new Date()) return 'قريباً (خلال 5 دقائق)';
    return next.toLocaleString('ar-IQ');
  };

  return (
    <div className="space-y-4">
      <Switch checked={b.enabled} onChange={v => update('backup', 'enabled', v)} label="🟢 تفعيل النسخ الاحتياطي التلقائي" />

      {b.enabled && (
        <div className="grid md:grid-cols-3 gap-2 text-xs">
          <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/30">
            <p className="text-[10px] text-emerald-400/70 mb-1">آخر نسخة</p>
            <p className="font-bold text-emerald-400">{b.lastBackup ? new Date(b.lastBackup).toLocaleString('ar-IQ') : 'لم تُنفّذ بعد'}</p>
          </div>
          <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/30">
            <p className="text-[10px] text-cyan-400/70 mb-1">⏰ النسخة التالية المقررة</p>
            <p className="font-bold text-cyan-400">{computeNext()}</p>
          </div>
          <div className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/30">
            <p className="text-[10px] text-violet-400/70 mb-1">عدد النسخ المحفوظة</p>
            <p className="font-bold text-violet-400">{list.length} نسخة</p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="الجدولة">
          <Select value={b.schedule} onValueChange={v => update('backup', 'schedule', v)}>
            <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">⏱️ كل ساعة</SelectItem>
              <SelectItem value="daily">📅 يومي</SelectItem>
              <SelectItem value="weekly">📆 أسبوعي</SelectItem>
              <SelectItem value="monthly">🗓️ شهري</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="فترة الاحتفاظ (يوم)"><Input type="number" value={b.retentionDays || 30} onChange={e => update('backup', 'retentionDays', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
        <Field label="📦 صيغة الملف">
          <div className="px-3 py-2 rounded-md bg-input/30 border border-gold/20 text-xs flex items-center gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">XLSX (Excel)</Badge>
            <span className="text-muted-foreground">جدول لكل مجموعة بيانات</span>
          </div>
        </Field>
        <Field label="📂 مكان التخزين">
          <div className="px-3 py-2 rounded-md bg-input/30 border border-gold/20 text-xs flex items-center gap-2">
            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">محلي</Badge>
            <span className="text-muted-foreground font-mono dir-ltr">/app/backups/</span>
          </div>
        </Field>
      </div>

      <Button onClick={triggerNow} disabled={busy} className="btn-gold w-full">
        <HardDrive className="w-4 h-4 ml-2" />
        {busy ? 'جاري الإنشاء...' : '⚡ إنشاء نسخة احتياطية الآن (Excel)'}
      </Button>

      {/* ============ BACKUP HISTORY LIST ============ */}
      <div className="border border-gold-soft rounded-lg overflow-hidden">
        <div className="bg-gold/5 p-3 border-b border-gold-soft flex items-center justify-between">
          <h3 className="text-sm font-bold gold-text flex items-center gap-2">
            <FileText className="w-4 h-4" /> سجل النسخ الاحتياطية
          </h3>
          <Button size="sm" variant="ghost" onClick={loadList} disabled={loadingList} className="h-7 text-xs">
            🔄 {loadingList ? 'تحميل...' : 'تحديث'}
          </Button>
        </div>
        {list.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            <HardDrive className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>لا توجد نسخ احتياطية بعد</p>
            <p className="text-[10px] mt-1">انقر "إنشاء نسخة احتياطية الآن" أو فعّل الجدولة التلقائية</p>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-input/30 sticky top-0">
                <tr>
                  <th className="p-2 text-right">التاريخ</th>
                  <th className="p-2 text-right">الحجم</th>
                  <th className="p-2 text-right">عدد المستندات</th>
                  <th className="p-2 text-right">المصدر</th>
                  <th className="p-2 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {list.map(bk => (
                  <tr key={bk.id} className="border-b border-gold-soft/30 hover:bg-gold/5">
                    <td className="p-2 font-mono text-[11px]">{new Date(bk.createdAt).toLocaleString('ar-IQ')}</td>
                    <td className="p-2 text-cyan-400 font-bold">{formatSize(bk.sizeKB)}</td>
                    <td className="p-2 text-emerald-400 font-bold">{bk.totalDocs?.toLocaleString('en-US')} مستند</td>
                    <td className="p-2">
                      <Badge className={bk.triggeredBy === 'auto' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px]' : 'bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]'}>
                        {bk.triggeredBy === 'auto' ? '🤖 تلقائي' : '👤 يدوي'}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" onClick={() => downloadBackup(bk.id, bk.filename)} className="h-7 text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 px-2">
                          ⬇️ تنزيل
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteBackup(bk.id)} className="h-7 w-7 text-red-400 hover:text-red-500 hover:bg-red-500/10">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
