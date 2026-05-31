'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/page-shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  RefreshCw, Settings, FileSpreadsheet, Upload, Download, CheckCircle2, XCircle, AlertTriangle, Plus, Edit2, GitMerge, EyeOff, Eye, Printer, History, Trash2, Filter, Search, Send, Loader2
} from 'lucide-react';

const STATUS_CFG = {
  synced:         { label: 'متزامن',          color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40', icon: '🟢' },
  new:            { label: 'جديد',            color: 'bg-sky-500/15 text-sky-400 border-sky-500/40',             icon: '🔵' },
  needs_update:   { label: 'يحتاج تحديث',     color: 'bg-amber-500/15 text-amber-400 border-amber-500/40',       icon: '🟡' },
  conflict:       { label: 'تعارض خطير',     color: 'bg-red-500/15 text-red-400 border-red-500/40',             icon: '🔴' },
  missing_in_isp: { label: 'غير موجود بالإنترنت', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/40',     icon: '⚪' },
};

export default function IspSyncCenter({ open, onClose, api }) {
  const [tab, setTab] = useState('scan');
  const [config, setConfig] = useState(null);
  const [savingCfg, setSavingCfg] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [pasteJson, setPasteJson] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [applying, setApplying] = useState(false);
  const fileRef = useRef(null);

  const loadConfig = async () => {
    const c = await api('isp-sync/config');
    if (c && !c._failed) setConfig(c);
  };
  const loadLogs = async () => {
    const l = await api('isp-sync/logs');
    setLogs(Array.isArray(l) ? l : []);
  };

  useEffect(() => {
    if (open) { loadConfig(); loadLogs(); }
  }, [open]);

  const saveConfig = async () => {
    setSavingCfg(true);
    try {
      const r = await api('isp-sync/config', { method: 'PUT', body: JSON.stringify(config) });
      if (r?.success) { toast.success('✅ تم حفظ الإعدادات'); setConfig(r); }
      else toast.error('فشل الحفظ');
    } finally { setSavingCfg(false); }
  };

  // ============ Data loading methods ============
  const onExcelFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const json = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
      if (!Array.isArray(json) || json.length === 0) { toast.error('الملف فارغ أو لا يمكن قراءته'); return; }
      await runScan(json, 'excel');
    } catch (err) {
      toast.error('خطأ في قراءة الملف: ' + err.message);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const fromJson = async () => {
    if (!pasteJson.trim()) { toast.error('الصق JSON أولاً'); return; }
    try {
      const data = JSON.parse(pasteJson);
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.subscribers) ? data.subscribers : null);
      if (!arr) { toast.error('JSON يجب أن يكون مصفوفة'); return; }
      await runScan(arr, 'json_paste');
    } catch (err) {
      toast.error('JSON غير صالح: ' + err.message);
    }
  };

  const runScan = async (externalSubs, source) => {
    setScanning(true);
    setScanResult(null);
    setSelected(new Set());
    try {
      const r = await api('isp-sync/scan', { method: 'POST', body: JSON.stringify({ externalSubs, source }) });
      if (r && !r._failed) {
        setScanResult(r);
        toast.success(`✅ تم الفحص: ${r.counts.externals} من الإنترنت ↔ ${r.counts.platforms} بالمنصة`);
        loadLogs();
      } else {
        toast.error('فشل الفحص: ' + (r?.error || ''));
      }
    } finally { setScanning(false); }
  };

  const exportExcel = () => {
    if (!scanResult?.rows?.length) return;
    const rows = filteredRows.map(r => ({
      'الحالة': STATUS_CFG[r.status]?.label || r.status,
      'الاسم (الإنترنت)': r.external?.name || '',
      'الاسم (المنصة)': r.platform?.name || '',
      'اليوزر (الإنترنت)': r.external?.username || '',
      'اليوزر (المنصة)': r.platform?.username || '',
      'الهاتف (الإنترنت)': r.external?.phone || '',
      'الهاتف (المنصة)': r.platform?.phone || '',
      'الباقة (الإنترنت)': r.external?.package || '',
      'الباقة (المنصة)': r.platform?.package || '',
      'تاريخ الانتهاء (الإنترنت)': r.external?.endDate || '',
      'تاريخ الانتهاء (المنصة)': r.platform?.endDate || '',
      'الوكيل (الإنترنت)': r.external?.agentName || '',
      'الوكيل (المنصة)': r.platform?.agentName || '',
      'نوع الاختلاف': (r.changes || []).map(c => c.label).join('، '),
      'الإجراء المقترح': ({create: 'إضافة', update: 'تحديث', merge: 'دمج', ignore: 'تجاهل', review: 'مراجعة'})[r.suggestedAction] || r.suggestedAction,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ISP Sync');
    XLSX.writeFile(wb, `isp-sync-${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success('📥 تم تصدير التقرير');
  };

  const printReport = () => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { toast.error('السماح بالنوافذ المنبثقة'); return; }
    const stats = scanResult?.counts || {};
    const rowsHtml = filteredRows.map(r => `
      <tr style="border-bottom:1px solid #ddd">
        <td style="padding:6px">${STATUS_CFG[r.status]?.icon || ''} ${STATUS_CFG[r.status]?.label || r.status}</td>
        <td style="padding:6px">${r.external?.name || r.platform?.name || '-'}</td>
        <td style="padding:6px">${r.external?.username || r.platform?.username || '-'}</td>
        <td style="padding:6px" dir="ltr">${r.external?.phone || r.platform?.phone || '-'}</td>
        <td style="padding:6px">${(r.changes || []).map(c => c.label).join('، ') || '-'}</td>
      </tr>`).join('');
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>تقرير المزامنة</title>
      <style>body{font-family:Arial;padding:20px}h1{color:#b8860b}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}th{background:#f5f0d8;padding:8px}.s{display:flex;gap:10px;margin:10px 0;flex-wrap:wrap}.s div{padding:8px 14px;border:1px solid #ddd;border-radius:6px;font-size:12px}</style>
      </head><body>
      <h1>تقرير مركز مزامنة مشتركين الإنترنت</h1>
      <p>تاريخ: ${new Date().toLocaleString('ar-IQ')}</p>
      <div class="s">
        <div>📊 الإجمالي: <b>${stats.total}</b></div>
        <div style="background:#d1fae5">🟢 متزامن: <b>${stats.synced}</b></div>
        <div style="background:#dbeafe">🔵 جديد: <b>${stats.new}</b></div>
        <div style="background:#fef3c7">🟡 تحديث: <b>${stats.needs_update}</b></div>
        <div style="background:#fee2e2">🔴 تعارض: <b>${stats.conflict}</b></div>
        <div style="background:#f3f4f6">⚪ غير موجود: <b>${stats.missing_in_isp}</b></div>
      </div>
      <table><thead><tr><th>الحالة</th><th>الاسم</th><th>اليوزر</th><th>الهاتف</th><th>الاختلافات</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table>
      <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
      </body></html>`);
    w.document.close();
  };

  // ============ Filter ============
  const filteredRows = (scanResult?.rows || []).filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const inExt = JSON.stringify(r.external || {}).toLowerCase().includes(q);
      const inPlat = JSON.stringify(r.platform || {}).toLowerCase().includes(q);
      if (!inExt && !inPlat) return false;
    }
    return true;
  });

  // ============ Row actions ============
  const applyOne = async (row, action) => {
    setApplying(true);
    try {
      const r = await api('isp-sync/apply', {
        method: 'POST',
        body: JSON.stringify({ runId: scanResult.runId, actions: [{ rowId: row.rowId, action }] }),
      });
      if (r?.success) {
        const res = r.results;
        toast.success(`✅ ${({ create: 'تمت الإضافة', update: 'تم التحديث', merge: 'تم الدمج', ignore: 'تم التجاهل' })[action] || 'تم'}`);
        // Update local row state
        setScanResult(prev => ({ ...prev, rows: prev.rows.map(rr => rr.rowId === row.rowId ? { ...rr, status: action === 'ignore' ? rr.status : 'synced', changes: action === 'ignore' ? rr.changes : [] } : rr) }));
      } else toast.error('فشل: ' + (r?.error || ''));
    } finally { setApplying(false); }
  };

  const applyBulkMatching = async () => {
    const updates = filteredRows.filter(r => r.status === 'needs_update');
    if (updates.length === 0) { toast.info('لا توجد تحديثات قابلة للتطبيق'); return; }
    if (!confirm(`تحديث ${updates.length} مشترك متطابق (بدون تعارض)؟`)) return;
    setApplying(true);
    try {
      const r = await api('isp-sync/apply', {
        method: 'POST',
        body: JSON.stringify({ runId: scanResult.runId, actions: updates.map(u => ({ rowId: u.rowId, action: 'update' })) }),
      });
      if (r?.success) {
        toast.success(`✅ تم تحديث ${r.results.updated}، تم تجاهل ${r.results.ignored}، أخطاء: ${r.results.errors.length}`);
        // Refresh scan to recompute
        // Easier: mark them synced locally
        setScanResult(prev => ({
          ...prev,
          rows: prev.rows.map(rr => updates.find(u => u.rowId === rr.rowId) ? { ...rr, status: 'synced', changes: [] } : rr),
        }));
      }
    } finally { setApplying(false); }
  };

  const sendWhatsApp = async (row) => {
    const phone = row.external?.phone || row.platform?.phone;
    const subId = row.platform?.id;
    if (!phone) { toast.error('لا يوجد هاتف'); return; }
    if (subId) {
      const r = await api('whatsapp/send', { method: 'POST', body: JSON.stringify({ subscriberId: subId, templateKey: 'expiry_alert', vars: { daysLeft: 0 } }) });
      if (r?.success) toast.success('📤 تم إرسال واتساب');
      else if (r?.queued) toast.info('⏳ تم وضع الرسالة في الطابور');
      else toast.error('فشل: ' + (r?.error || ''));
    } else {
      const msg = `مرحباً ${row.external?.name || ''}، نود تحديث بياناتك في نظامنا.`;
      const r = await api('whatsapp/send', { method: 'POST', body: JSON.stringify({ phone, message: msg }) });
      if (r?.success) toast.success('📤 تم الإرسال');
    }
  };

  if (!open) return null;
  const stats = scanResult?.counts || {};

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-strong border-gold-soft max-w-[1400px] w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl gold-text flex items-center gap-2">
            <RefreshCw className="w-5 h-5" /> مركز مزامنة مشتركين الإنترنت
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-input/30 border border-gold-soft">
            <TabsTrigger value="scan">🔍 الفحص والمقارنة</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="w-3 h-3 ml-1" /> الإعدادات</TabsTrigger>
            <TabsTrigger value="logs"><History className="w-3 h-3 ml-1" /> سجل المزامنة</TabsTrigger>
          </TabsList>

          {/* SCAN TAB */}
          <TabsContent value="scan">
            <div className="space-y-3">
              {/* Data load */}
              <Card className="glass-strong border-gold-soft">
                <CardHeader className="pb-2"><CardTitle className="text-sm gold-text">📥 جلب بيانات صفحة الإنترنت</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">رفع ملف Excel/CSV من صفحة الإنترنت</Label>
                      <Input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onExcelFile} disabled={scanning} className="bg-input/30 border-gold/20 mt-1" />
                      <p className="text-[10px] text-muted-foreground mt-1">يدعم أعمدة: username, name, phone, package, endDate, status, fee, debt, agentName</p>
                    </div>
                    <div>
                      <Label className="text-xs">أو الصق JSON من API</Label>
                      <Textarea value={pasteJson} onChange={e => setPasteJson(e.target.value)} placeholder='[{"username":"user1","name":"...","phone":"07..."}]' rows={3} className="bg-input/30 border-gold/20 mt-1 font-mono text-[10px]" dir="ltr" />
                      <Button size="sm" onClick={fromJson} disabled={scanning || !pasteJson.trim()} className="mt-1 btn-gold w-full">
                        {scanning ? <Loader2 className="w-3 h-3 ml-1 animate-spin" /> : <Search className="w-3 h-3 ml-1" />} فحص ومقارنة
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stats + result */}
              {scanResult && (
                <>
                  <Card className="glass-strong border-gold-soft">
                    <CardContent className="p-3">
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center">
                        <div className="glass-card rounded p-2"><p className="text-[10px] text-muted-foreground">الإجمالي</p><p className="text-xl font-bold gold-text">{stats.total}</p></div>
                        <div className="glass-card rounded p-2 cursor-pointer hover:bg-emerald-500/10" onClick={() => setFilter('synced')}><p className="text-[10px] text-muted-foreground">🟢 متزامن</p><p className="text-xl font-bold text-emerald-400">{stats.synced}</p></div>
                        <div className="glass-card rounded p-2 cursor-pointer hover:bg-sky-500/10" onClick={() => setFilter('new')}><p className="text-[10px] text-muted-foreground">🔵 جديد</p><p className="text-xl font-bold text-sky-400">{stats.new}</p></div>
                        <div className="glass-card rounded p-2 cursor-pointer hover:bg-amber-500/10" onClick={() => setFilter('needs_update')}><p className="text-[10px] text-muted-foreground">🟡 تحديث</p><p className="text-xl font-bold text-amber-400">{stats.needs_update}</p></div>
                        <div className="glass-card rounded p-2 cursor-pointer hover:bg-red-500/10" onClick={() => setFilter('conflict')}><p className="text-[10px] text-muted-foreground">🔴 تعارض</p><p className="text-xl font-bold text-red-400">{stats.conflict}</p></div>
                        <div className="glass-card rounded p-2 cursor-pointer hover:bg-zinc-500/10" onClick={() => setFilter('missing_in_isp')}><p className="text-[10px] text-muted-foreground">⚪ غير موجود</p><p className="text-xl font-bold text-zinc-400">{stats.missing_in_isp}</p></div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="glass-strong border-gold-soft">
                    <CardContent className="p-3">
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Input placeholder="🔍 بحث..." value={search} onChange={e => setSearch(e.target.value)} className="bg-input/30 border-gold/20 max-w-xs h-8" />
                        <Select value={filter} onValueChange={setFilter}>
                          <SelectTrigger className="bg-input/30 border-gold/20 w-44 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">📋 الكل</SelectItem>
                            <SelectItem value="synced">🟢 متزامن</SelectItem>
                            <SelectItem value="new">🔵 جديد</SelectItem>
                            <SelectItem value="needs_update">🟡 يحتاج تحديث</SelectItem>
                            <SelectItem value="conflict">🔴 تعارض</SelectItem>
                            <SelectItem value="missing_in_isp">⚪ غير موجود</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={applyBulkMatching} disabled={applying} className="btn-gold h-8">
                          <CheckCircle2 className="w-3 h-3 ml-1" /> تحديث الكل المتطابق
                        </Button>
                        <Button size="sm" onClick={exportExcel} variant="outline" className="border-gold/30 h-8">
                          <Download className="w-3 h-3 ml-1" /> تصدير Excel
                        </Button>
                        <Button size="sm" onClick={printReport} variant="outline" className="border-gold/30 h-8">
                          <Printer className="w-3 h-3 ml-1" /> طباعة
                        </Button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead className="bg-input/30 border-b border-gold-soft">
                            <tr>
                              <th className="p-2 text-right">الحالة</th>
                              <th className="p-2 text-right">الاسم</th>
                              <th className="p-2 text-right">اليوزر</th>
                              <th className="p-2 text-right">الهاتف</th>
                              <th className="p-2 text-right">الباقة (إنترنت/منصة)</th>
                              <th className="p-2 text-right">الانتهاء (إنترنت/منصة)</th>
                              <th className="p-2 text-right">الوكيل</th>
                              <th className="p-2 text-right">نوع الاختلاف</th>
                              <th className="p-2 text-right">الإجراء</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRows.length === 0 ? (
                              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">لا توجد نتائج</td></tr>
                            ) : filteredRows.map(r => {
                              const cfg = STATUS_CFG[r.status] || STATUS_CFG.synced;
                              return (
                                <tr key={r.rowId} className="border-b border-gold-soft/20 hover:bg-input/10">
                                  <td className="p-2"><Badge className={`text-[9px] ${cfg.color}`}>{cfg.icon} {cfg.label}</Badge></td>
                                  <td className="p-2">
                                    <p className="font-semibold">{r.external?.name || r.platform?.name || '—'}</p>
                                    {r.external?.name && r.platform?.name && r.external.name !== r.platform.name && (
                                      <p className="text-[9px] text-muted-foreground">(منصة: {r.platform.name})</p>
                                    )}
                                  </td>
                                  <td className="p-2 font-mono text-[10px]" dir="ltr">{r.external?.username || r.platform?.username || '—'}</td>
                                  <td className="p-2 font-mono text-[10px]" dir="ltr">{r.external?.phone || r.platform?.phone || '—'}</td>
                                  <td className="p-2">
                                    <p>{r.external?.package || '—'}</p>
                                    {r.platform?.package && r.external?.package !== r.platform?.package && (
                                      <p className="text-[9px] text-amber-400">↔ {r.platform.package}</p>
                                    )}
                                  </td>
                                  <td className="p-2 text-[10px]">
                                    <p>{r.external?.endDate || '—'}</p>
                                    {r.platform?.endDate && r.external?.endDate !== r.platform?.endDate && (
                                      <p className="text-[9px] text-amber-400">↔ {r.platform.endDate}</p>
                                    )}
                                  </td>
                                  <td className="p-2">{r.external?.agentName || r.platform?.agentName || '—'}</td>
                                  <td className="p-2 max-w-[180px]">
                                    {r.changes?.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {r.changes.map((c, i) => (
                                          <Badge key={i} variant="outline" className={`text-[9px] ${c.severity === 'critical' ? 'border-red-500/40 text-red-400' : c.severity === 'warning' ? 'border-amber-500/40 text-amber-400' : 'border-zinc-500/40 text-zinc-400'}`} title={`${c.label}: ${c.external} → ${c.platform}`}>
                                            {c.label}
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : <span className="text-[10px] text-muted-foreground">—</span>}
                                  </td>
                                  <td className="p-2">
                                    <div className="flex gap-1">
                                      {r.status === 'new' && (
                                        <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-emerald-400" onClick={() => applyOne(r, 'create')} disabled={applying} title="إضافة للمنصة">
                                          <Plus className="w-3 h-3" />
                                        </Button>
                                      )}
                                      {(r.status === 'needs_update' || r.status === 'conflict') && (
                                        <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-amber-400" onClick={() => applyOne(r, 'update')} disabled={applying} title="تحديث بيانات المشترك">
                                          <Edit2 className="w-3 h-3" />
                                        </Button>
                                      )}
                                      {(r.external?.phone || r.platform?.phone) && (
                                        <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-cyan-400 text-cyan-400" onClick={() => sendWhatsApp(r)} title="إرسال واتساب">
                                          <Send className="w-3 h-3" />
                                        </Button>
                                      )}
                                      <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-zinc-400" onClick={() => applyOne(r, 'ignore')} disabled={applying} title="تجاهل">
                                        <EyeOff className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings">
            {!config ? <p className="text-center text-muted-foreground py-6">جاري التحميل…</p> :
            <Card className="glass-strong border-gold-soft">
              <CardContent className="p-4 space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">نوع النظام</Label>
                    <Select value={config.sourceType} onValueChange={v => setConfig({ ...config, sourceType: v })}>
                      <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mynet">MyNet</SelectItem>
                        <SelectItem value="halasat">Halasat</SelectItem>
                        <SelectItem value="custom">مخصص (Custom)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">طريقة الجلب</Label>
                    <Select value={config.fetchMethod} onValueChange={v => setConfig({ ...config, fetchMethod: v })}>
                      <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">يدوي (لصق JSON)</SelectItem>
                        <SelectItem value="excel">رفع Excel</SelectItem>
                        <SelectItem value="api">API مباشر</SelectItem>
                        <SelectItem value="scraping">Web Scraping</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">رابط صفحة المنجمنت</Label>
                    <Input value={config.sourceUrl || ''} onChange={e => setConfig({ ...config, sourceUrl: e.target.value })} placeholder="https://your-isp.com/admin" className="bg-input/30 border-gold/20" dir="ltr" />
                  </div>
                  <div>
                    <Label className="text-xs">اسم المستخدم</Label>
                    <Input value={config.username || ''} onChange={e => setConfig({ ...config, username: e.target.value })} className="bg-input/30 border-gold/20" dir="ltr" />
                  </div>
                  <div>
                    <Label className="text-xs">كلمة المرور</Label>
                    <Input type="password" value={config.password || ''} onChange={e => setConfig({ ...config, password: e.target.value })} placeholder="•••" className="bg-input/30 border-gold/20" dir="ltr" />
                  </div>
                </div>
                <div className="border-t border-gold-soft pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">تشغيل مزامنة تلقائية يومياً</Label>
                    <Switch checked={!!config.autoDaily} onCheckedChange={v => setConfig({ ...config, autoDaily: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">تحديث تلقائي للمشتركين المتطابقين فقط</Label>
                    <Switch checked={!!config.autoUpdateMatching} onCheckedChange={v => setConfig({ ...config, autoUpdateMatching: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">منع التحديث التلقائي عند وجود تعارض (موصى به)</Label>
                    <Switch checked={config.blockOnConflict !== false} onCheckedChange={v => setConfig({ ...config, blockOnConflict: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">تفعيل المزامنة</Label>
                    <Switch checked={!!config.enabled} onCheckedChange={v => setConfig({ ...config, enabled: v })} />
                  </div>
                </div>
                <Button onClick={saveConfig} disabled={savingCfg} className="btn-gold w-full">
                  {savingCfg ? 'جاري الحفظ…' : '💾 حفظ الإعدادات'}
                </Button>
              </CardContent>
            </Card>}
          </TabsContent>

          {/* LOGS TAB */}
          <TabsContent value="logs">
            <Card className="glass-strong border-gold-soft">
              <CardContent className="p-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-input/30 border-b border-gold-soft">
                      <tr>
                        <th className="p-2 text-right">التاريخ</th>
                        <th className="p-2 text-right">المصدر</th>
                        <th className="p-2 text-right">المنفذ</th>
                        <th className="p-2 text-right">الإجمالي</th>
                        <th className="p-2 text-right">جديد</th>
                        <th className="p-2 text-right">محدث</th>
                        <th className="p-2 text-right">تعارض</th>
                        <th className="p-2 text-right">طُبّق</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.length === 0 ? <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">لا توجد عمليات مزامنة سابقة</td></tr> :
                      logs.map(l => (
                        <tr key={l.runId || l.id} className="border-b border-gold-soft/20 hover:bg-input/10">
                          <td className="p-2 text-[10px]">{l.ranAt ? new Date(l.ranAt).toLocaleString('ar-IQ') : '-'}</td>
                          <td className="p-2"><Badge variant="outline" className="text-[9px]">{l.source}</Badge></td>
                          <td className="p-2 text-[10px]">{l.ranBy || 'admin'}</td>
                          <td className="p-2 font-bold gold-text">{l.counts?.total || 0}</td>
                          <td className="p-2 text-sky-400">{l.counts?.new || 0}</td>
                          <td className="p-2 text-amber-400">{l.counts?.needs_update || 0}</td>
                          <td className="p-2 text-red-400">{l.counts?.conflict || 0}</td>
                          <td className="p-2">
                            {l.applied ? (
                              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/40 text-[9px]">
                                <CheckCircle2 className="w-3 h-3 ml-1" /> نعم ({(l.appliedResults?.created || 0) + (l.appliedResults?.updated || 0) + (l.appliedResults?.merged || 0)})
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] text-zinc-400">لا</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
