'use client';
import { useState, useEffect } from 'react';
import { api, fmt, safeArr } from '@/lib/page-shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, BellOff, Send, Smartphone, Trash2, CheckCircle2, AlertCircle, TestTube } from 'lucide-react';

// Convert base64 to Uint8Array for VAPID public key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = typeof window !== 'undefined' ? window.atob(base64) : '';
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function PushNotificationsPage() {
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [vapidKey, setVapidKey] = useState('');
  const [subs, setSubs] = useState([]);
  const [supported, setSupported] = useState(true);
  const [form, setForm] = useState({ title: 'مركز الغزلان', message: '', url: '/', tag: 'broadcast' });
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setSupported(false);
      return;
    }
    setPermission(Notification.permission);
    // Check current subscription
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(s => setSubscribed(!!s));
    // Fetch VAPID key + subs
    api('push/vapid-key').then(d => setVapidKey(d?.publicKey || ''));
    loadSubs();
  }, []);

  const loadSubs = async () => {
    const d = await api('push/subscriptions');
    setSubs(safeArr(d));
  };

  const enablePush = async () => {
    if (!supported) { toast.error('المتصفح لا يدعم Push Notifications'); return; }
    setSubscribing(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') { toast.error('لم يتم السماح بالإشعارات'); return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        if (!vapidKey) { toast.error('VAPID key غير متوفر'); return; }
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }
      // Send to backend
      const r = await api('push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ subscription: sub.toJSON(), label: 'متصفح المدير' }),
      });
      if (r?.success) {
        setSubscribed(true);
        toast.success('✅ تم تفعيل الإشعارات على هذا الجهاز');
        loadSubs();
      }
    } catch (e) {
      toast.error('خطأ: ' + e.message);
    } finally { setSubscribing(false); }
  };

  const disablePush = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api('push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success('🔕 تم إيقاف الإشعارات');
      loadSubs();
    } catch (e) { toast.error('خطأ'); }
  };

  const sendTest = async () => {
    setSending(true);
    try {
      const r = await api('push/test', { method: 'POST', body: JSON.stringify({}) });
      if (r?.error) { toast.error(r.error); return; }
      toast.success(`🧪 تم إرسال اختبار إلى ${r.sent} جهاز`);
    } finally { setSending(false); }
  };

  const sendBroadcast = async () => {
    if (!form.message.trim()) { toast.error('اكتب رسالة'); return; }
    setSending(true);
    try {
      const r = await api('push/send', { method: 'POST', body: JSON.stringify(form) });
      if (r?.error) { toast.error(r.error); return; }
      setLastResult(r);
      toast.success(`📤 تم الإرسال إلى ${r.sent}/${r.total} جهاز`);
      setForm({ ...form, message: '' });
    } finally { setSending(false); }
  };

  if (!supported) {
    return (
      <Card className="glass-strong border-red-500/40">
        <CardContent className="py-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-2" />
          <p className="text-lg font-bold text-red-400">المتصفح لا يدعم Push Notifications</p>
          <p className="text-xs text-muted-foreground mt-2">استخدم Chrome / Firefox / Edge / Safari (iOS 16.4+)</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="glass-strong border-gold/30">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="gold-text flex items-center gap-2 text-2xl">
                <Bell className="w-6 h-6" /> الإشعارات الفورية (Push)
              </CardTitle>
              <CardDescription className="mt-1">
                إشعارات فورية للموظفين والإدارة حتى لو كان التطبيق مغلقاً — تعمل في المتصفح وعلى الموبايل
              </CardDescription>
            </div>
            {subscribed ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
                <CheckCircle2 className="w-3 h-3 ml-1" /> مفعّل على هذا الجهاز
              </Badge>
            ) : (
              <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/40">
                <BellOff className="w-3 h-3 ml-1" /> غير مفعّل
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="enable" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-input/30">
          <TabsTrigger value="enable"><Bell className="w-3 h-3 ml-1" /> تفعيل / إيقاف</TabsTrigger>
          <TabsTrigger value="broadcast"><Send className="w-3 h-3 ml-1" /> إرسال إشعار</TabsTrigger>
          <TabsTrigger value="subs"><Smartphone className="w-3 h-3 ml-1" /> الأجهزة ({subs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="enable" className="space-y-3">
          <Card className="glass-card border-gold-soft">
            <CardHeader>
              <CardTitle className="text-base">حالة الإشعارات على هذا الجهاز</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg bg-input/30 border border-gold-soft text-xs space-y-1">
                <p>✅ الإذن: <span className={`font-bold ${permission === 'granted' ? 'text-emerald-400' : 'text-amber-400'}`}>{permission === 'granted' ? 'مسموح' : permission === 'denied' ? 'مرفوض' : 'لم يُطلب'}</span></p>
                <p>📡 الاشتراك: <span className={`font-bold ${subscribed ? 'text-emerald-400' : 'text-zinc-400'}`}>{subscribed ? 'نشط ✓' : 'غير نشط'}</span></p>
                <p>🔑 VAPID Key: <span className="font-mono text-cyan-400 text-[9px]">{vapidKey ? vapidKey.slice(0, 30) + '…' : '⚠️ غير متوفر'}</span></p>
              </div>
              {!subscribed ? (
                <Button onClick={enablePush} disabled={subscribing} className="btn-gold w-full h-12">
                  <Bell className="w-4 h-4 ml-2" />
                  {subscribing ? 'جاري التفعيل…' : 'تفعيل الإشعارات على هذا الجهاز'}
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={sendTest} disabled={sending} variant="outline" className="border-cyan-500/30 text-cyan-400 h-12">
                    <TestTube className="w-4 h-4 ml-2" /> إرسال اختبار
                  </Button>
                  <Button onClick={disablePush} variant="outline" className="border-red-500/30 text-red-400 h-12">
                    <BellOff className="w-4 h-4 ml-2" /> إيقاف
                  </Button>
                </div>
              )}
              {permission === 'denied' && (
                <p className="text-xs text-red-400 p-2 rounded bg-red-500/5 border border-red-500/20">
                  ⚠️ تم رفض الإشعارات — افتح إعدادات المتصفح وفعّل الإشعارات لهذا الموقع
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="broadcast" className="space-y-3">
          <Card className="glass-card border-gold-soft">
            <CardHeader>
              <CardTitle className="text-base">إرسال إشعار جماعي</CardTitle>
              <CardDescription>سيُرسل لجميع الأجهزة المشتركة ({subs.length} جهاز)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">العنوان</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-input/30 border-gold/20" />
              </div>
              <div>
                <Label className="text-xs">الرسالة *</Label>
                <Textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="bg-input/30 border-gold/20 h-24" placeholder="نص الإشعار…" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">الرابط عند الضغط</Label>
                  <Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="bg-input/30 border-gold/20" placeholder="/" />
                </div>
                <div>
                  <Label className="text-xs">Tag (تجميع)</Label>
                  <Input value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })} className="bg-input/30 border-gold/20" />
                </div>
              </div>
              <Button onClick={sendBroadcast} disabled={sending || !form.message.trim() || subs.length === 0} className="btn-gold w-full h-12">
                <Send className="w-4 h-4 ml-2" />
                {sending ? 'جاري الإرسال…' : `إرسال إلى ${subs.length} جهاز`}
              </Button>
              {lastResult && (
                <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1">
                  <p>✅ نجح: <span className="font-bold text-emerald-400">{lastResult.sent}</span></p>
                  <p>❌ فشل: <span className="font-bold text-red-400">{lastResult.failed}</span></p>
                  {lastResult.expired > 0 && <p>🗑️ تم تنظيف اشتراكات منتهية: <span className="font-bold text-amber-400">{lastResult.expired}</span></p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subs" className="space-y-2">
          {subs.length === 0 ? (
            <Card className="glass-card border-gold-soft">
              <CardContent className="py-8 text-center">
                <Smartphone className="w-12 h-12 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-muted-foreground text-sm">لا توجد أجهزة مشتركة بعد</p>
              </CardContent>
            </Card>
          ) : subs.map(s => (
            <Card key={s.id} className="glass-card border-gold-soft">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="text-2xl">📱</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{s.label || 'متصفح'}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{s.userAgent}</p>
                  <p className="text-[10px] text-muted-foreground">📅 {s.createdAt ? new Date(s.createdAt).toLocaleString('ar-IQ') : ''}</p>
                </div>
                {Array.isArray(s.tags) && s.tags.length > 0 && (
                  <div className="flex gap-1">
                    {s.tags.map(t => <Badge key={t} variant="outline" className="text-[9px]">{t}</Badge>)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
