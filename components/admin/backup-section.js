'use client';
import { Trash2 as Trash } from 'lucide-react';
import { Field } from '@/components/admin/shared/Field';
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
  const gd = b.googleDrive || {};
  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testingGd, setTestingGd] = useState(false);

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

  // Helper to update Google Drive nested settings
  const updateGd = (key, value) => {
    const merged = { ...gd, [key]: value };
    update('backup', 'googleDrive', merged);
  };

  // Validate Google Drive folder URL/ID
  const extractDriveFolderId = (input) => {
    if (!input) return '';
    const m = String(input).match(/(?:folders\/|id=|\/d\/)([a-zA-Z0-9_-]{20,})/);
    return m ? m[1] : String(input).trim();
  };

  const testGdConnection = async () => {
    if (!gd.folderUrl) { toast.error('أدخل رابط/مسار Google Drive أولاً'); return; }
    setTestingGd(true);
    try {
      const r = await api('settings/backup/gdrive-test', {
        method: 'POST',
        body: JSON.stringify({ folderUrl: gd.folderUrl, folderId: extractDriveFolderId(gd.folderUrl) }),
      });
      if (r?.success) {
        toast.success('✅ تم الاتصال — المجلد جاهز للاستخدام');
        updateGd('verified', true);
        updateGd('folderId', extractDriveFolderId(gd.folderUrl));
      } else {
        toast.warning(r?.message || 'تم الحفظ — يحتاج تفعيل OAuth لاحقاً');
        updateGd('verified', false);
      }
    } catch (e) {
      toast.error('فشل الاتصال: ' + (e?.message || ''));
    } finally {
      setTestingGd(false);
    }
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

      {/* ============ GOOGLE DRIVE INTEGRATION ============ */}
      <div className={`relative border-2 rounded-xl p-4 transition-all ${gd.enabled ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-gold-soft bg-input/10'}`}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all ${gd.enabled ? 'bg-emerald-500/20 ring-2 ring-emerald-500/50' : 'bg-zinc-500/10'}`}>
              ☁️
              {gd.enabled && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-bold animate-pulse">
                  ✓
                </span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                Google Drive
                {gd.enabled && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">🟢 مفعّل</Badge>}
                {gd.enabled && gd.verified && <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/40 text-[10px]">✓ متصل</Badge>}
              </h3>
              <p className="text-[11px] text-muted-foreground">رفع النسخ الاحتياطية تلقائياً إلى Google Drive</p>
            </div>
          </div>
          <Switch checked={!!gd.enabled} onCheckedChange={v => updateGd('enabled', v)} className="data-[state=checked]:bg-emerald-500" />
        </div>

        {gd.enabled && (
          <div className="space-y-3 mt-3">
            <div>
              <Label className="text-xs flex items-center gap-2 mb-1">
                🔗 رابط مجلد Google Drive
                <span className="text-[10px] text-muted-foreground">(أو معرّف Folder ID مباشرةً)</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={gd.folderUrl || ''}
                  onChange={e => { updateGd('folderUrl', e.target.value); updateGd('verified', false); }}
                  placeholder="https://drive.google.com/drive/folders/XXXXXXXXXXXX"
                  className="bg-input/30 border-gold/20 font-mono text-xs flex-1"
                  dir="ltr"
                />
                <Button
                  size="sm"
                  onClick={testGdConnection}
                  disabled={testingGd || !gd.folderUrl}
                  className="btn-gold whitespace-nowrap"
                >
                  {testingGd ? '⏳ جاري...' : '🔍 اختبار الاتصال'}
                </Button>
              </div>
              {gd.folderId && (
                <p className="text-[10px] text-cyan-400 mt-1 font-mono">📁 Folder ID: {gd.folderId}</p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">📧 بريد حساب الخدمة (Service Account)</Label>
                <Input
                  value={gd.serviceAccountEmail || ''}
                  onChange={e => updateGd('serviceAccountEmail', e.target.value)}
                  placeholder="backup@project.iam.gserviceaccount.com"
                  className="bg-input/30 border-gold/20 font-mono text-xs"
                  dir="ltr"
                />
                <p className="text-[10px] text-muted-foreground mt-1">شارك المجلد مع هذا البريد بصلاحية «محرّر»</p>
              </div>
              <div>
                <Label className="text-xs">📤 نمط الرفع</Label>
                <Select value={gd.uploadMode || 'auto'} onValueChange={v => updateGd('uploadMode', v)}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">🤖 تلقائي مع كل نسخة</SelectItem>
                    <SelectItem value="manual">👤 يدوي فقط</SelectItem>
                    <SelectItem value="daily">📅 مرة يومياً</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/30 text-[11px] text-amber-300">
              <p className="font-bold mb-1">📋 تعليمات الإعداد السريع:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-[10px]">
                <li>أنشئ مجلد على Google Drive وانسخ رابطه أعلاه</li>
                <li>(اختياري) أضف بريد حساب الخدمة وشارك المجلد معه بصلاحية محرّر</li>
                <li>اضغط «اختبار الاتصال» للتحقق</li>
                <li>كل نسخة احتياطية ستُرفع تلقائياً عند تفعيل النمط «تلقائي»</li>
              </ol>
            </div>
          </div>
        )}
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
