'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/page-shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Send, RefreshCw, Wifi, WifiOff, QrCode, Power, PowerOff, Trash2, MessageSquare,
  CheckCircle2, XCircle, Clock, AlertCircle, Phone, Users, Filter, FileText, Save
} from 'lucide-react';

const STATUS_COLORS = {
  ready: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  authenticated: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
  qr: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  initializing: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
  disconnected: 'bg-red-500/20 text-red-400 border-red-500/40',
  auth_failure: 'bg-red-500/20 text-red-400 border-red-500/40',
};
const STATUS_AR = {
  ready: '🟢 متصل وجاهز',
  authenticated: '🔐 تم التحقق…',
  qr: '📲 بانتظار مسح QR',
  initializing: '⏳ جاري التهيئة…',
  disconnected: '⚪ غير متصل',
  auth_failure: '❌ فشل المصادقة',
};

export default function WhatsAppManager({ api }) {
  const [status, setStatus] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState({});
  const [defaults, setDefaults] = useState({});
  const [activeTpl, setActiveTpl] = useState('activation');
  const [tplText, setTplText] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);

  const [bulk, setBulk] = useState({ audience: 'active', templateKey: 'expiry_alert', message: '', zoneId: '', agentId: '', fatNumber: '' });
  const [zones, setZones] = useState([]);
  const [agents, setAgents] = useState([]);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  // Test send state
  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('مرحباً، رسالة اختبار من مركز الغزلان ERP');
  const [testSending, setTestSending] = useState(false);

  // Job state
  const [jobRunning, setJobRunning] = useState(null);
  const [jobResult, setJobResult] = useState(null);

  // WhatsApp stats
  const [waStats, setWaStats] = useState(null);

  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState({ status: '__all', type: '__all', q: '' });

  const pollRef = useRef(null);

  const loadStatus = async () => {
    const s = await api('whatsapp/status');
    setStatus(s);
    if (s?.status === 'qr') {
      const q = await api('whatsapp/qr');
      setQrData(q?.qrDataUrl ? q : null);
    } else if (s?.status === 'ready') {
      setQrData(null);
    }
  };

  const loadTemplates = async () => {
    const d = await api('whatsapp/templates');
    if (d && !d._failed) {
      setTemplates(d.templates || {});
      setDefaults(d.defaults || {});
      setTplText((d.templates || {})[activeTpl] || '');
    }
  };

  const loadMessages = async () => {
    const qs = new URLSearchParams();
    if (filter.status && filter.status !== '__all') qs.set('status', filter.status);
    if (filter.type && filter.type !== '__all') qs.set('type', filter.type);
    if (filter.q) qs.set('q', filter.q);
    qs.set('limit', '100');
    const d = await api(`whatsapp/messages?${qs.toString()}`);
    setMessages(Array.isArray(d) ? d : []);
  };

  useEffect(() => {
    loadStatus();
    loadTemplates();
    loadMessages();
    loadStats();
    api('zones').then(d => setZones(Array.isArray(d) ? d : []));
    api('agents').then(d => setAgents(Array.isArray(d) ? d : []));
    pollRef.current = setInterval(() => { loadStatus(); loadStats(); }, 4000);
    return () => clearInterval(pollRef.current);
  }, []);

  const loadStats = async () => {
    const s = await api('whatsapp/stats');
    if (s && !s._failed) setWaStats(s);
  };

  const handleTestSend = async () => {
    if (!testPhone.trim() || !testMsg.trim()) { toast.error('أكمل الرقم والرسالة'); return; }
    setTestSending(true);
    try {
      const r = await api('whatsapp/test-send', { method: 'POST', body: JSON.stringify({ phone: testPhone.trim(), message: testMsg.trim() }) });
      if (r?.success) toast.success('✅ تم الإرسال بنجاح');
      else toast.error('فشل: ' + (r?.error || 'تأكد من اتصال الواتساب'));
      await loadMessages(); await loadStats();
    } finally { setTestSending(false); }
  };

  const runJob = async (path, label, payload = {}) => {
    setJobRunning(path);
    setJobResult(null);
    try {
      const r = await api(path, { method: 'POST', body: JSON.stringify(payload) });
      setJobResult({ path, label, ...r });
      if (r?.success || r?.queued) toast.success(`📋 ${label}: ${r.sent || 0}/${r.total || 0}`);
      else toast.error(`فشل: ${r?.error || ''}`);
      await loadMessages(); await loadStats();
    } catch (e) {
      toast.error('خطأ: ' + e.message);
    } finally { setJobRunning(null); }
  };

  useEffect(() => {
    setTplText((templates || {})[activeTpl] || '');
  }, [activeTpl, templates]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const r = await api('whatsapp/connect', { method: 'POST', body: JSON.stringify({}) });
      if (r?.ok || r?.success) toast.success('🚀 بدأ الاتصال — انتظر ظهور QR');
      else toast.error('فشل بدء الاتصال: ' + (r?.error || ''));
      setTimeout(loadStatus, 2000);
    } finally { setLoading(false); }
  };
  const handleDisconnect = async (wipe = false) => {
    if (wipe && !confirm('⚠️ مسح الجلسة سيتطلب إعادة مسح QR من جديد. متابعة؟')) return;
    setLoading(true);
    try {
      await api('whatsapp/disconnect', { method: 'POST', body: JSON.stringify({ wipe }) });
      toast.success(wipe ? '🧹 تم قطع الاتصال ومسح الجلسة' : '🔌 تم قطع الاتصال');
      await loadStatus();
      setQrData(null);
    } finally { setLoading(false); }
  };

  const saveTemplate = async () => {
    setSavingTpl(true);
    try {
      const next = { ...templates, [activeTpl]: tplText };
      const r = await api('whatsapp/templates', { method: 'PUT', body: JSON.stringify({ templates: next }) });
      if (r?.success) {
        toast.success('✅ تم حفظ القالب');
        setTemplates(next);
      } else toast.error('فشل الحفظ');
    } finally { setSavingTpl(false); }
  };
  const resetTemplate = () => {
    if (!confirm('استعادة القالب الافتراضي؟')) return;
    setTplText(defaults[activeTpl] || '');
  };

  // Add new custom template (e.g., holiday, birthday, custom event)
  const addCustomTemplate = async () => {
    const key = prompt('🆕 مفتاح القالب الجديد (بالإنجليزية، بدون مسافات):\nمثل: eid_greeting, birthday, new_year, ramadan');
    if (!key) return;
    const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!cleanKey) { toast.error('مفتاح غير صحيح'); return; }
    if (templates[cleanKey] !== undefined || defaults[cleanKey] !== undefined) {
      toast.error('هذا المفتاح موجود مسبقاً');
      return;
    }
    const label = prompt('🏷️ اسم القالب للعرض (اختياري، بالعربية):') || cleanKey;
    const next = { ...templates, [cleanKey]: `🎉 *مرحباً {name}*\n\n[اكتب نص الرسالة هنا]\n\n*${label}*` };
    const r = await api('whatsapp/templates', { method: 'PUT', body: JSON.stringify({ templates: next }) });
    if (r?.success) {
      setTemplates(next);
      setActiveTpl(cleanKey);
      toast.success(`✅ تم إضافة القالب "${label}"`);
    } else toast.error('فشل');
  };

  // Holiday preset templates (one-click add)
  const HOLIDAY_PRESETS = {
    eid_fitr: {
      label: '🌙 عيد الفطر',
      text: `🌙 *عيد فطر مبارك* 🌙\n\nعزيزي *{name}*،\n\nيتشرف *مركز الغزلان* بتقديم أجمل التهاني بمناسبة عيد الفطر المبارك\n🎊 كل عام وأنتم بألف خير\n🤲 تقبل الله منا ومنكم صالح الأعمال\n\nمع تحيات: *مركز الغزلان*\n📞 {companyPhone}`,
    },
    eid_adha: {
      label: '🐑 عيد الأضحى',
      text: `🐑 *عيد أضحى مبارك* 🐑\n\nعزيزي *{name}*،\n\nأطيب التهاني بمناسبة عيد الأضحى المبارك\n🎊 كل عام وأنتم بخير\n🤲 تقبل الله منا ومنكم\n\n*مركز الغزلان*\n📞 {companyPhone}`,
    },
    new_year: {
      label: '🎆 السنة الجديدة',
      text: `🎆 *سنة جديدة سعيدة* 🎆\n\nعزيزي *{name}*،\n\nمع بداية عام جديد، نقدم لك أصدق التهاني والتمنيات بسنة مليئة بالنجاح والتوفيق ✨\n\nشكراً لثقتك بنا 🙏\n\n*مركز الغزلان* 🌟\n📞 {companyPhone}`,
    },
    ramadan: {
      label: '🌙 رمضان كريم',
      text: `🌙 *رمضان كريم* 🌙\n\nعزيزي *{name}*،\n\nيتقدم *مركز الغزلان* بأجمل التهاني بحلول شهر رمضان المبارك\n🤲 أعاده الله علينا وعليكم بالخير واليمن والبركات\n\nأوقات العمل في رمضان:\n⏰ 9 صباحاً - 3 ظهراً\n⏰ 8 مساءً - 12 منتصف الليل\n\n*مركز الغزلان* 🌟`,
    },
    birthday: {
      label: '🎂 عيد ميلاد',
      text: `🎂 *كل عام وأنت بخير* 🎂\n\nعزيزي *{name}*،\n\nيسعدنا في *مركز الغزلان* أن نهنئك بمناسبة عيد ميلادك 🎉\n🎁 لك خصم خاص 10% على أي خدمة هذا الشهر\n\n*مركز الغزلان* 🌟\n📞 {companyPhone}`,
    },
    promo: {
      label: '🎁 عرض خاص',
      text: `🎁 *عرض حصري لك* 🎁\n\nعزيزي *{name}*،\n\nيسعدنا تقديم عرض خاص:\n✨ [اكتب تفاصيل العرض هنا]\n📅 العرض ساري حتى: [تاريخ]\n\nللحجز والاستفسار:\n📞 {companyPhone}\n\n*مركز الغزلان*`,
    },
    follow_up: {
      label: '📞 متابعة',
      text: `مرحباً *{name}* 👋\n\nنود الاطمئنان عليك ومتابعة جودة خدمتنا معك.\n\nهل لديك أي ملاحظات أو استفسار؟ نحن هنا لخدمتك ✨\n\n*مركز الغزلان*\n📞 {companyPhone}`,
    },
    apology: {
      label: '🙏 اعتذار',
      text: `*اعتذار* 🙏\n\nعزيزي *{name}*،\n\nنعتذر عن الإزعاج الذي قد تواجهه بسبب [سبب الانقطاع].\n\n🛠️ فريقنا الفني يعمل على حل المشكلة بأسرع وقت ممكن.\n📅 الموعد المتوقع للإصلاح: [وقت]\n\nشكراً لتفهمك 🌟\n*مركز الغزلان*`,
    },
  };

  const addHolidayPreset = async (presetKey) => {
    const preset = HOLIDAY_PRESETS[presetKey];
    if (!preset) return;
    if (templates[presetKey] !== undefined) {
      if (!confirm(`القالب "${preset.label}" موجود — استبداله بالنسخة الافتراضية؟`)) return;
    }
    const next = { ...templates, [presetKey]: preset.text };
    const r = await api('whatsapp/templates', { method: 'PUT', body: JSON.stringify({ templates: next }) });
    if (r?.success) {
      setTemplates(next);
      setActiveTpl(presetKey);
      toast.success(`✅ تم إضافة قالب "${preset.label}"`);
    } else toast.error('فشل');
  };

  const deleteCustomTemplate = async () => {
    if (defaults[activeTpl] !== undefined) {
      toast.error('لا يمكن حذف القوالب الافتراضية. اضغط "استعادة الافتراضي" بدلاً من ذلك.');
      return;
    }
    if (!confirm(`حذف القالب "${activeTpl}" نهائياً؟`)) return;
    const next = { ...templates };
    delete next[activeTpl];
    const r = await api('whatsapp/templates', { method: 'PUT', body: JSON.stringify({ templates: next }) });
    if (r?.success) {
      setTemplates(next);
      setActiveTpl('activation');
      toast.success('🗑️ تم حذف القالب');
    } else toast.error('فشل');
  };

  // Live preview with sample data
  const previewText = (() => {
    const sampleVars = {
      name: 'محمد علي', username: 'mohammed123', package: 'باقة الذهبية',
      speed: '50 Mbps', amount: '50,000', paid: '40,000', remaining: '10,000',
      debt: '15,000', endDate: '2026-06-30', startDate: '2026-06-01',
      daysLeft: '5', receiptNo: 'REC-2026-1234', office: 'الفرع الرئيسي',
      companyName: 'مركز الغزلان', companyPhone: '07707889032',
    };
    return String(tplText || '').replace(/\{(\w+)\}/g, (_, k) => sampleVars[k] ?? `{${k}}`);
  })();


  const sendBulk = async () => {
    const isCustomTpl = !bulk.templateKey || bulk.templateKey === '__custom';
    if (isCustomTpl && !bulk.message?.trim()) {
      toast.error('اختر قالباً أو اكتب رسالة');
      return;
    }
    if (!confirm(`سيتم الإرسال إلى مجموعة: ${bulk.audience}. متابعة؟`)) return;
    setBulkSending(true);
    setBulkResult(null);
    try {
      const payload = { ...bulk };
      if (isCustomTpl) payload.templateKey = ''; // backend expects empty for custom
      const r = await api('whatsapp/send-bulk', { method: 'POST', body: JSON.stringify(payload) });
      setBulkResult(r);
      if (r?.success) toast.success(`📤 تم إرسال ${r.sent}/${r.total} رسالة`);
      else toast.error('فشل الإرسال الجماعي: ' + (r?.error || ''));
      await loadMessages();
    } finally { setBulkSending(false); }
  };

  const resendMessage = async (id) => {
    const r = await api(`whatsapp-messages/${id}/resend`, { method: 'POST' });
    if (r?.success) toast.success('✅ تم إعادة الإرسال');
    else toast.error('فشل: ' + (r?.error || r?.message || ''));
    loadMessages();
  };

  const statusBadge = STATUS_COLORS[status?.status] || STATUS_COLORS.disconnected;
  const statusLabel = STATUS_AR[status?.status] || '⚪ غير متصل';

  return (
    <div className="space-y-4">
      {/* HEADER: connection status */}
      <Card className="glass-strong border-gold-soft">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-2 gold-text">
              <MessageSquare className="w-5 h-5" /> إدارة واتساب
            </span>
            <Badge className={statusBadge}>{statusLabel}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="glass-card rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground">حالة الخدمة</p>
              <p className="text-sm font-bold flex items-center gap-1">
                {status?.serviceUp ? <><Wifi className="w-3 h-3 text-emerald-400" /> الخدمة تعمل</> : <><WifiOff className="w-3 h-3 text-red-400" /> الخدمة متوقفة</>}
              </p>
              {!status?.configured && <p className="text-[10px] text-amber-400 mt-1">WHATSAPP_SERVICE_URL غير مُعد</p>}
            </div>
            <div className="glass-card rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground">رقم الواتساب المتصل</p>
              <p className="text-sm font-bold gold-text flex items-center gap-1">
                <Phone className="w-3 h-3" /> {status?.phone ? `+${status.phone}` : '— غير متصل —'}
              </p>
              {status?.displayName && <p className="text-[10px] text-muted-foreground mt-1">{status.displayName}</p>}
            </div>
            <div className="glass-card rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground">جاهز منذ</p>
              <p className="text-sm font-bold">{status?.readyAt ? new Date(status.readyAt).toLocaleString('ar-IQ') : '—'}</p>
              {status?.lastError && <p className="text-[10px] text-red-400 mt-1 truncate" title={status.lastError}>⚠ {status.lastError}</p>}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {status?.status !== 'ready' && (
              <Button onClick={handleConnect} disabled={loading} className="btn-gold">
                <Power className="w-4 h-4 ml-2" /> بدء الاتصال / إظهار QR
              </Button>
            )}
            {status?.status === 'ready' && (
              <Button onClick={() => handleDisconnect(false)} disabled={loading} variant="outline" className="border-red-500/40">
                <PowerOff className="w-4 h-4 ml-2" /> قطع الاتصال
              </Button>
            )}
            <Button onClick={() => handleDisconnect(true)} disabled={loading} variant="outline" className="border-red-500/40 hover:bg-red-500/10">
              <Trash2 className="w-4 h-4 ml-2" /> مسح الجلسة
            </Button>
            <Button onClick={loadStatus} disabled={loading} variant="outline" className="border-gold/30">
              <RefreshCw className="w-4 h-4 ml-2" /> تحديث
            </Button>
          </div>

          {/* QR Code display */}
          {status?.status === 'qr' && qrData?.qrDataUrl && (
            <div className="mt-3 glass-card rounded-xl p-5 border border-gold/30 text-center">
              <p className="text-sm font-bold gold-text mb-3 flex items-center justify-center gap-2">
                <QrCode className="w-4 h-4" /> امسح هذا الـ QR من تطبيق واتساب على هاتفك
              </p>
              <img src={qrData.qrDataUrl} alt="QR" className="mx-auto rounded-lg border border-gold/20 bg-white p-2" style={{ width: 280, height: 280 }} />
              <p className="text-[10px] text-muted-foreground mt-3">
                الإعدادات في واتساب → الأجهزة المرتبطة → ربط جهاز
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="actions" className="w-full">
        <TabsList className="bg-input/30 border border-gold-soft">
          <TabsTrigger value="actions">⚡ إجراءات سريعة</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="w-3 h-3 ml-1" /> القوالب</TabsTrigger>
          <TabsTrigger value="bulk"><Users className="w-3 h-3 ml-1" /> إرسال جماعي</TabsTrigger>
          <TabsTrigger value="log"><MessageSquare className="w-3 h-3 ml-1" /> سجل الرسائل</TabsTrigger>
        </TabsList>

        {/* QUICK ACTIONS TAB */}
        <TabsContent value="actions">
          <div className="grid md:grid-cols-2 gap-3">
            {/* Stats card */}
            <Card className="glass-strong border-gold-soft">
              <CardHeader className="pb-2"><CardTitle className="text-base gold-text flex items-center gap-2">📊 إحصائيات الإرسال</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="glass-card rounded p-2"><p className="text-[10px] text-muted-foreground">اليوم</p><p className="text-xl font-bold gold-text">{waStats?.todaySent || 0}</p></div>
                  <div className="glass-card rounded p-2"><p className="text-[10px] text-muted-foreground">آخر أسبوع</p><p className="text-xl font-bold neon-text">{waStats?.weekSent || 0}</p></div>
                  <div className="glass-card rounded p-2"><p className="text-[10px] text-muted-foreground">✅ إجمالي مرسلة</p><p className="text-xl font-bold text-emerald-400">{waStats?.totalSent || 0}</p></div>
                  <div className="glass-card rounded p-2"><p className="text-[10px] text-muted-foreground">❌ فاشلة</p><p className="text-xl font-bold text-red-400">{waStats?.totalFailed || 0}</p></div>
                </div>
                {(waStats?.totalQueued || 0) > 0 && (
                  <p className="text-[10px] text-amber-400 mt-2">⏳ {waStats.totalQueued} رسالة بانتظار الإرسال</p>
                )}
              </CardContent>
            </Card>

            {/* Test send card */}
            <Card className="glass-strong border-gold-soft">
              <CardHeader className="pb-2"><CardTitle className="text-base gold-text flex items-center gap-2">🧪 اختبار سريع</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Input placeholder="07901234567 أو 9647901234567" value={testPhone} onChange={e => setTestPhone(e.target.value)} className="bg-input/30 border-gold/20 font-mono" dir="ltr" />
                <Textarea value={testMsg} onChange={e => setTestMsg(e.target.value)} rows={3} className="bg-input/30 border-gold/20 text-xs" />
                <Button onClick={handleTestSend} disabled={testSending || status?.status !== 'ready'} className="btn-gold w-full">
                  <Send className="w-3 h-3 ml-1" /> {testSending ? 'يتم الإرسال…' : 'إرسال اختبار'}
                </Button>
                {status?.status !== 'ready' && <p className="text-[10px] text-amber-400 text-center">يجب ربط واتساب أولاً</p>}
              </CardContent>
            </Card>

            {/* Scheduled jobs card */}
            <Card className="glass-strong border-gold-soft md:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-base gold-text flex items-center gap-2">⏰ مهام مجدولة (تشغيل الآن)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="grid md:grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className="border-cyan-500/40 hover:bg-cyan-500/10 h-auto py-3"
                    onClick={() => runJob('whatsapp/run-expiry-alerts', 'تنبيهات الانتهاء (5 أيام)', { daysAhead: 5 })}
                    disabled={!!jobRunning || status?.status !== 'ready'}
                  >
                    <div className="text-center w-full">
                      <div className="text-lg mb-1">🔔</div>
                      <div className="text-xs font-bold">تنبيهات الانتهاء</div>
                      <div className="text-[9px] text-muted-foreground">المشتركون المنتهون خلال 5 أيام</div>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="border-red-500/40 hover:bg-red-500/10 h-auto py-3"
                    onClick={() => runJob('whatsapp/run-debt-reminders', 'تذكير الديون')}
                    disabled={!!jobRunning || status?.status !== 'ready'}
                  >
                    <div className="text-center w-full">
                      <div className="text-lg mb-1">💸</div>
                      <div className="text-xs font-bold">تذكير بالديون</div>
                      <div className="text-[9px] text-muted-foreground">إرسال للمشتركين الذين عليهم ديون</div>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="border-amber-500/40 hover:bg-amber-500/10 h-auto py-3"
                    onClick={() => runJob('whatsapp/resend-failed', 'إعادة الرسائل الفاشلة')}
                    disabled={!!jobRunning || status?.status !== 'ready'}
                  >
                    <div className="text-center w-full">
                      <div className="text-lg mb-1">🔄</div>
                      <div className="text-xs font-bold">إعادة الفاشلة</div>
                      <div className="text-[9px] text-muted-foreground">حتى 200 رسالة فاشلة</div>
                    </div>
                  </Button>
                </div>
                {jobRunning && (
                  <p className="text-xs text-cyan-400 text-center animate-pulse">⚙️ جاري تنفيذ المهمة…</p>
                )}
                {jobResult && (
                  <div className="glass-card rounded-lg p-3 text-xs border border-emerald-500/30">
                    <p className="font-bold gold-text mb-1">📊 نتيجة "{jobResult.label}"</p>
                    <p>✅ مرسل: <span className="text-emerald-400 font-bold">{jobResult.sent || 0}</span></p>
                    <p>❌ فشل: <span className="text-red-400 font-bold">{jobResult.failed || 0}</span></p>
                    <p>📊 الإجمالي: <span className="gold-text font-bold">{jobResult.total || 0}</span></p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TEMPLATES TAB */}
        <TabsContent value="templates">
          <Card className="glass-strong border-gold-soft">
            <CardContent className="p-4 space-y-3">
              {/* Holiday preset suggestions (one-click add) */}
              <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <p className="text-xs font-bold text-purple-400 mb-2 flex items-center gap-1">
                  ✨ قوالب جاهزة — اضغط لإضافتها:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(HOLIDAY_PRESETS).map(([key, p]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant="outline"
                      onClick={() => addHolidayPreset(key)}
                      className={`text-[10px] h-7 ${templates[key] !== undefined ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-purple-500/30 hover:bg-purple-500/10'}`}
                      title={templates[key] !== undefined ? 'مُضاف بالفعل' : 'إضافة'}
                    >
                      {templates[key] !== undefined && '✓ '}{p.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex flex-wrap gap-2">
                  {Object.keys({ ...defaults, ...templates }).map(k => {
                    const isCustom = defaults[k] === undefined;
                    const presetLabel = HOLIDAY_PRESETS[k]?.label;
                    return (
                      <Button
                        key={k}
                        size="sm"
                        variant={activeTpl === k ? 'default' : 'outline'}
                        onClick={() => setActiveTpl(k)}
                        className={activeTpl === k ? 'btn-gold' : isCustom ? 'border-cyan-500/30' : 'border-gold/30'}
                      >
                        {presetLabel || ({activation:'تفعيل',expiry:'انتهاء',expiry_alert:'تنبيه قبل الانتهاء',debt:'دين',receipt:'وصل',generic:'عام'})[k] || k}
                        {isCustom && !presetLabel && <Badge variant="outline" className="mr-1 text-[8px] border-cyan-400/40 text-cyan-400">مخصص</Badge>}
                      </Button>
                    );
                  })}
                </div>
                <Button size="sm" onClick={addCustomTemplate} variant="outline" className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
                  ➕ قالب مخصص جديد
                </Button>
              </div>

              <p className="text-[10px] text-muted-foreground">
                المتغيرات المتاحة: <code className="bg-input/30 px-1 rounded">{'{name}'}</code> <code className="bg-input/30 px-1 rounded">{'{username}'}</code> <code className="bg-input/30 px-1 rounded">{'{package}'}</code> <code className="bg-input/30 px-1 rounded">{'{speed}'}</code> <code className="bg-input/30 px-1 rounded">{'{amount}'}</code> <code className="bg-input/30 px-1 rounded">{'{paid}'}</code> <code className="bg-input/30 px-1 rounded">{'{remaining}'}</code> <code className="bg-input/30 px-1 rounded">{'{debt}'}</code> <code className="bg-input/30 px-1 rounded">{'{endDate}'}</code> <code className="bg-input/30 px-1 rounded">{'{startDate}'}</code> <code className="bg-input/30 px-1 rounded">{'{daysLeft}'}</code> <code className="bg-input/30 px-1 rounded">{'{receiptNo}'}</code> <code className="bg-input/30 px-1 rounded">{'{office}'}</code> <code className="bg-input/30 px-1 rounded">{'{companyName}'}</code> <code className="bg-input/30 px-1 rounded">{'{companyPhone}'}</code>
              </p>

              {/* Side-by-side: Editor + Live Preview */}
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs flex items-center gap-1 mb-1">
                    <FileText className="w-3 h-3" /> المُحرر
                  </Label>
                  <Textarea value={tplText} onChange={e => setTplText(e.target.value)} rows={14} className="bg-input/30 border-gold/20 font-mono text-xs" dir="rtl" />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1 mb-1 text-emerald-400">
                    <MessageSquare className="w-3 h-3" /> معاينة مباشرة (بيانات تجريبية)
                  </Label>
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-md p-3 h-[calc(14*1.5em+1rem)] overflow-y-auto" dir="rtl">
                    <p className="whitespace-pre-line text-xs leading-relaxed text-foreground/90">{previewText}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button onClick={saveTemplate} disabled={savingTpl} className="btn-gold"><Save className="w-4 h-4 ml-1" /> حفظ القالب</Button>
                <Button onClick={resetTemplate} variant="outline" className="border-gold/30">استعادة الافتراضي</Button>
                {defaults[activeTpl] === undefined && (
                  <Button onClick={deleteCustomTemplate} variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4 ml-1" /> حذف هذا القالب
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BULK TAB */}
        <TabsContent value="bulk">
          <Card className="glass-strong border-gold-soft">
            <CardContent className="p-4 space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>الجمهور المستهدف</Label>
                  <Select value={bulk.audience} onValueChange={v => setBulk(b => ({ ...b, audience: v }))}>
                    <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">📢 كل المشتركين</SelectItem>
                      <SelectItem value="active">🟢 الفعالين فقط</SelectItem>
                      <SelectItem value="expired">⏰ المنتهية اشتراكاتهم</SelectItem>
                      <SelectItem value="debt">💸 أصحاب الديون</SelectItem>
                      <SelectItem value="by_zone">📍 حسب الزون</SelectItem>
                      <SelectItem value="by_agent">👨‍💼 حسب الوكيل</SelectItem>
                      <SelectItem value="by_fat">🔌 حسب الفاتة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>القالب</Label>
                  <Select value={bulk.templateKey} onValueChange={v => setBulk(b => ({ ...b, templateKey: v }))}>
                    <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(defaults).map(k => (
                        <SelectItem key={k} value={k}>{({activation:'تفعيل',expiry:'انتهاء',expiry_alert:'تنبيه قبل الانتهاء',debt:'دين',receipt:'وصل',generic:'عام'})[k] || k}</SelectItem>
                      ))}
                      <SelectItem value="__custom">رسالة مخصصة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {bulk.audience === 'by_zone' && (
                <div>
                  <Label>الزون</Label>
                  <Select value={bulk.zoneId} onValueChange={v => setBulk(b => ({ ...b, zoneId: v }))}>
                    <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="اختر..." /></SelectTrigger>
                    <SelectContent>{zones.map(z => <SelectItem key={z.id} value={z.id}>{z.number} - {z.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {bulk.audience === 'by_agent' && (
                <div>
                  <Label>الوكيل</Label>
                  <Select value={bulk.agentId} onValueChange={v => setBulk(b => ({ ...b, agentId: v }))}>
                    <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="اختر..." /></SelectTrigger>
                    <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {bulk.audience === 'by_fat' && (
                <div>
                  <Label>رقم الفاتة (مثلاً F-01-03)</Label>
                  <Input value={bulk.fatNumber} onChange={e => setBulk(b => ({ ...b, fatNumber: e.target.value }))} className="bg-input/30 border-gold/20" />
                </div>
              )}

              {(bulk.templateKey === '__custom' || !bulk.templateKey) && (
                <div>
                  <Label>الرسالة المخصصة (يمكنك استخدام المتغيرات {'{name}'} ...)</Label>
                  <Textarea value={bulk.message} onChange={e => setBulk(b => ({ ...b, message: e.target.value }))} rows={4} className="bg-input/30 border-gold/20" />
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={sendBulk} disabled={bulkSending || status?.status !== 'ready'} className="btn-gold">
                  <Send className="w-4 h-4 ml-1" /> {bulkSending ? 'جاري الإرسال...' : '📤 إرسال جماعي'}
                </Button>
                {status?.status !== 'ready' && <p className="text-[10px] text-amber-400 self-center">يجب ربط واتساب أولاً</p>}
              </div>

              {bulkResult && (
                <div className="glass-card rounded-lg p-3 text-xs">
                  <p>✅ تم بنجاح: <span className="text-emerald-400 font-bold">{bulkResult.sent || 0}</span></p>
                  <p>❌ فشل: <span className="text-red-400 font-bold">{bulkResult.failed || 0}</span></p>
                  <p>📊 الإجمالي: <span className="gold-text font-bold">{bulkResult.total || 0}</span></p>
                  {bulkResult.batchId && <p className="text-[9px] text-muted-foreground">Batch: {bulkResult.batchId}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* LOG TAB */}
        <TabsContent value="log">
          <Card className="glass-strong border-gold-soft">
            <CardContent className="p-4 space-y-3">
              <div className="grid md:grid-cols-5 gap-2">
                <Input placeholder="بحث (اسم/هاتف/رسالة)" value={filter.q} onChange={e => setFilter(f => ({ ...f, q: e.target.value }))} className="bg-input/30 border-gold/20" />
                <Select value={filter.status} onValueChange={v => setFilter(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="الحالة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">الكل</SelectItem>
                    <SelectItem value="sent">✅ مرسلة</SelectItem>
                    <SelectItem value="failed">❌ فاشلة</SelectItem>
                    <SelectItem value="queued">⏳ في الانتظار</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filter.type} onValueChange={v => setFilter(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="النوع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">الكل</SelectItem>
                    <SelectItem value="activation">تفعيل</SelectItem>
                    <SelectItem value="expiry">انتهاء</SelectItem>
                    <SelectItem value="expiry_alert">تنبيه</SelectItem>
                    <SelectItem value="debt">دين</SelectItem>
                    <SelectItem value="receipt">وصل</SelectItem>
                    <SelectItem value="manual">يدوي</SelectItem>
                    <SelectItem value="bulk">جماعي</SelectItem>
                    <SelectItem value="test">اختبار</SelectItem>
                    <SelectItem value="manager_alert">إشعار مدير</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={loadMessages} variant="outline" className="border-gold/30">
                  <Filter className="w-4 h-4 ml-1" /> تطبيق
                </Button>
                <Button
                  onClick={() => runJob('whatsapp/resend-failed', 'إعادة الفاشلة')}
                  disabled={!!jobRunning || status?.status !== 'ready' || (waStats?.totalFailed || 0) === 0}
                  className="btn-gold"
                >
                  <RefreshCw className="w-4 h-4 ml-1" /> إعادة الفاشلة ({waStats?.totalFailed || 0})
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-input/20 border-b border-gold-soft">
                    <tr>
                      <th className="p-2 text-right">المشترك</th>
                      <th className="p-2 text-right">الهاتف</th>
                      <th className="p-2 text-right">النوع</th>
                      <th className="p-2 text-right">الحالة</th>
                      <th className="p-2 text-right">التاريخ</th>
                      <th className="p-2 text-right">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.length === 0 ? (
                      <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد رسائل</td></tr>
                    ) : messages.map(m => (
                      <tr key={m.id} className="border-b border-gold-soft/20 hover:bg-input/20">
                        <td className="p-2">{m.subscriberName || '—'}</td>
                        <td className="p-2 font-mono ltr:text-left rtl:text-right" dir="ltr">{m.phone || '—'}</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-[9px]">{m.type}</Badge>
                        </td>
                        <td className="p-2">
                          {m.status === 'sent' && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[9px]"><CheckCircle2 className="w-3 h-3 ml-1" /> مرسلة</Badge>}
                          {m.status === 'failed' && <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-[9px]"><XCircle className="w-3 h-3 ml-1" /> فاشلة</Badge>}
                          {m.status === 'queued' && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[9px]"><Clock className="w-3 h-3 ml-1" /> منتظرة</Badge>}
                          {m.error && <p className="text-[9px] text-red-400 mt-1 truncate max-w-[180px]" title={m.error}>⚠ {m.error}</p>}
                        </td>
                        <td className="p-2 text-[10px] text-muted-foreground">{m.createdAt ? new Date(m.createdAt).toLocaleString('ar-IQ') : '—'}</td>
                        <td className="p-2">
                          {(m.status === 'failed' || m.status === 'queued') && m.phone && m.phone !== 'MANAGER' && (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] border-gold/30" onClick={() => resendMessage(m.id)}>
                              <RefreshCw className="w-3 h-3 ml-1" /> إعادة
                            </Button>
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
    </div>
  );
}
