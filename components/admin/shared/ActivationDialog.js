'use client';
import { useState, useEffect } from 'react';
import { api, fmt, safeArr } from '@/lib/page-shared';
import { sounds } from '@/lib/sounds';
import { whatsappLink } from '@/lib/messaging';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, Send, CheckCircle2, Wallet } from 'lucide-react';

export function ActivationDialog({ subscriber, packages, agents, onClose, onDone }) {
  const [pkgId, setPkgId] = useState('');
  const [speed, setSpeed] = useState('');
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [durationMonths, setDurationMonths] = useState(1);
  const [agentId, setAgentId] = useState('');
  const [notes, setNotes] = useState('');
  const [sendChannel, setSendChannel] = useState('whatsapp');
  const [editableMessage, setEditableMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [balanceAccounts, setBalanceAccounts] = useState([]);

  useEffect(() => {
    if (subscriber) {
      setPkgId(''); setSpeed(subscriber.package || ''); setAmount(subscriber.fee || 0);
      setPaymentMethod('cash'); setDurationMonths(1);
      setAgentId(subscriber.agentId || (agents[0]?.id) || '');
      setNotes(''); setResult(null); setSendChannel('whatsapp'); setEditableMessage('');
      api('balance/accounts').then(d => setBalanceAccounts(safeArr(d)));
    }
  }, [subscriber, agents]);

  if (!subscriber) return null;

  const onPkgChange = (id) => {
    setPkgId(id);
    const p = packages.find(x => x.id === id);
    if (p) { setSpeed(p.speed); setAmount(p.monthlyFee * durationMonths); }
  };

  const onDurationChange = (m) => {
    setDurationMonths(Number(m));
    const p = packages.find(x => x.id === pkgId);
    if (p) setAmount(p.monthlyFee * Number(m));
  };

  const endDate = new Date(Date.now() + durationMonths * 30 * 86400000).toLocaleDateString('ar-IQ');

  const balanceKeyMap = { fastpay: 'fast', master: 'master', transfer: 'management', cash: 'cash' };
  const balanceMethodLabel = { fastpay: '⚡ فاست باي', master: '💳 ماستر كارد', transfer: '🏦 تحويل (الإدارة)', cash: '💵 كاش' };
  const targetKey = balanceKeyMap[paymentMethod];
  const targetAccount = balanceAccounts.find(a => a.key === targetKey && a.enabled !== false);
  const currentBalance = Number(targetAccount?.balance || 0);
  const amountNum = Number(amount || 0);
  const newBalance = currentBalance - amountNum;
  const willGoNegative = newBalance < 0;
  const balanceWarning = targetAccount && targetAccount.alertThreshold != null && newBalance < Number(targetAccount.alertThreshold);

  const submit = async () => {
    setLoading(true);
    const r = await api(`subscribers/${subscriber.id}/activate`, {
      method: 'POST',
      body: JSON.stringify({ packageId: pkgId, speed, amount: Number(amount), paymentMethod, durationMonths, agentId: agentId || null, notes }),
    });
    setLoading(false);
    if (r.error) { toast.error(r.error); sounds.error(); return; }
    if (r.pending) {
      sounds.notification();
      toast.info('⏳ تم إرسال طلب التفعيل للمدير للموافقة', { description: r.message || 'الطلب في قائمة الانتظار' });
      onClose();
      onDone?.();
      return;
    }
    sounds.activation();
    toast.success('✅ تم التفعيل بنجاح');
    setResult(r);
    setEditableMessage(r.whatsappMessage || '');
    if (sendChannel === 'whatsapp' && subscriber.phone && r.whatsappMessage) {
      const url = whatsappLink(subscriber.phone, r.whatsappMessage);
      if (url) setTimeout(() => window.open(url, '_blank'), 600);
    } else if (sendChannel === 'telegram' && subscriber.phone) {
      const url = `https://t.me/share/url?url=${encodeURIComponent(' ')}&text=${encodeURIComponent(r.whatsappMessage || '')}`;
      setTimeout(() => window.open(url, '_blank'), 600);
    }
  };

  return (
    <Dialog open={!!subscriber} onOpenChange={(o) => { if (!o) { onClose(); if (result) onDone(); } }}>
      <DialogContent className="glass-strong border-gold/40 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="gold-text flex items-center gap-2">
            <Zap className="w-5 h-5" /> تفعيل اشتراك - {subscriber.name}
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <>
            <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20 text-xs space-y-1">
              <p><strong>المشترك:</strong> {subscriber.name} · <span className="font-mono text-cyan-400">@{subscriber.username}</span></p>
              <p><strong>الهاتف:</strong> {subscriber.phone} · <strong>الزون:</strong> {subscriber.zoneName} · <strong>الفاتة:</strong> {subscriber.fatNumber}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>اختر الباقة</Label>
                <Select value={pkgId} onValueChange={onPkgChange}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="اختر باقة" /></SelectTrigger>
                  <SelectContent>
                    {packages.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="font-bold text-gold">{p.name}</span> · {p.speed} · {p.monthlyFee.toLocaleString()} د.ع
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>السرعة</Label><Input value={speed} onChange={e => setSpeed(e.target.value)} placeholder="50 Mbps" className="bg-input/30 border-gold/20" /></div>
              <div>
                <Label>المدة</Label>
                <Select value={String(durationMonths)} onValueChange={onDurationChange}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">شهر واحد</SelectItem>
                    <SelectItem value="3">3 أشهر</SelectItem>
                    <SelectItem value="6">6 أشهر</SelectItem>
                    <SelectItem value="12">سنة كاملة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>المبلغ الإجمالي</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="bg-input/30 border-gold/20 text-lg font-bold gold-text" /></div>
              <div>
                <Label>طريقة الدفع</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">💵 كاش</SelectItem>
                    <SelectItem value="master">💳 ماستر كارد</SelectItem>
                    <SelectItem value="fastpay">⚡ فاست باي</SelectItem>
                    <SelectItem value="transfer">🏦 تحويل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>الوكيل</Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="اختر الوكيل" /></SelectTrigger>
                  <SelectContent>
                    {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name} (عمولة {a.commission}%)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} className="bg-input/30 border-gold/20 h-16" placeholder="اختياري..." /></div>
              <div className="col-span-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-400">
                ✅ تاريخ الانتهاء التلقائي: <strong className="text-emerald-300">{endDate}</strong>
              </div>

              {paymentMethod !== 'cash' && targetAccount && (
                <div className={`col-span-2 p-3 rounded-lg border text-xs space-y-1 ${willGoNegative ? 'bg-red-500/10 border-red-500/40' : balanceWarning ? 'bg-amber-500/10 border-amber-500/40' : 'bg-cyan-500/5 border-cyan-500/20'}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-bold flex items-center gap-1">
                      <Wallet className="w-3 h-3" />
                      حساب: {balanceMethodLabel[paymentMethod]} ({targetAccount.name})
                    </p>
                    {willGoNegative && <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-[9px]">⚠️ سيدخل في السالب!</Badge>}
                    {!willGoNegative && balanceWarning && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[9px]">⚠️ تحت الحد الأدنى</Badge>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-current/20">
                    <div>
                      <p className="text-[10px] opacity-60">الرصيد الحالي</p>
                      <p className={`text-sm font-bold ${currentBalance < 0 ? 'text-red-400' : 'text-cyan-300'}`}>{fmt(currentBalance)} د.ع</p>
                    </div>
                    <div>
                      <p className="text-[10px] opacity-60">سيُخصم</p>
                      <p className="text-sm font-bold text-amber-400">- {fmt(amountNum)} د.ع</p>
                    </div>
                    <div>
                      <p className="text-[10px] opacity-60">الرصيد بعد الخصم</p>
                      <p className={`text-sm font-bold ${willGoNegative ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(newBalance)} د.ع</p>
                    </div>
                  </div>
                </div>
              )}
              {paymentMethod !== 'cash' && !targetAccount && (
                <div className="col-span-2 p-2 rounded-lg bg-zinc-500/10 border border-zinc-500/30 text-[10px] text-zinc-400">
                  ℹ️ لا يوجد حساب رصيد مرتبط بطريقة الدفع هذه — لن يتم خصم تلقائي
                </div>
              )}

              <div className="col-span-2">
                <Label className="text-xs mb-2 block">📤 طريقة إرسال الإشعار للمشترك</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: 'whatsapp', icon: '💚', label: 'WhatsApp', color: 'emerald' },
                    { v: 'telegram', icon: '📨', label: 'Telegram', color: 'cyan' },
                    { v: 'none', icon: '🔕', label: 'بدون إرسال', color: 'gray' },
                  ].map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setSendChannel(opt.v)}
                      className={`p-2 rounded-lg border-2 transition-all text-center ${sendChannel === opt.v ? `border-${opt.color}-500 bg-${opt.color}-500/20` : 'border-gold-soft bg-input/30 hover:border-gold/50'}`}
                    >
                      <div className="text-lg">{opt.icon}</div>
                      <div className="text-[10px] font-bold mt-0.5">{opt.label}</div>
                    </button>
                  ))}
                </div>
                {sendChannel === 'whatsapp' && (
                  <p className="text-[10px] text-emerald-400 mt-1.5">✅ سيفتح WhatsApp مباشرة مع الرسالة جاهزة بعد التفعيل</p>
                )}
                {sendChannel === 'telegram' && (
                  <p className="text-[10px] text-cyan-400 mt-1.5">📨 سيفتح Telegram مع نص الرسالة جاهزة</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={submit} disabled={loading || !amount} className="btn-gold w-full h-12 text-base">
                {loading ? 'جاري التفعيل...' : <><Zap className="w-4 h-4 ml-2" /> تفعيل الاشتراك وإرسال إشعار</>}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-emerald-400" />
              <h3 className="text-lg font-bold text-emerald-400">تم التفعيل بنجاح</h3>
              <p className="text-xs text-muted-foreground">المبلغ: <span className="font-bold gold-text">{Number(result.activation?.amount || 0).toLocaleString('en-US')} د.ع</span> · ينتهي: <span className="font-bold">{new Date(result.activation?.endDate).toLocaleDateString('ar-IQ')}</span></p>
            </div>
            <div className="p-3 rounded-lg bg-input/30 border border-gold-soft space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-[10px] text-muted-foreground">📱 الرسالة (قابلة للتعديل قبل الإرسال):</p>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] hover:text-gold" onClick={() => setEditableMessage(result.whatsappMessage || '')}>
                  ↩️ النص الأصلي
                </Button>
              </div>
              <Textarea
                value={editableMessage}
                onChange={e => setEditableMessage(e.target.value)}
                className="bg-background/50 border-gold/20 text-xs font-mono h-48 leading-relaxed"
                dir="rtl"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a href={whatsappLink(subscriber.phone, editableMessage) || '#'} target="_blank" rel="noreferrer">
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                  <Send className="w-4 h-4 ml-1" /> فتح WhatsApp وإرسال
                </Button>
              </a>
              <Button onClick={() => { navigator.clipboard?.writeText(editableMessage); toast.success('📋 تم نسخ النص'); }} variant="outline" className="border-gold/30">
                📋 نسخ النص
              </Button>
            </div>
            <DialogFooter className="gap-2">
              <Button onClick={() => { onClose(); onDone(); }} className="btn-gold flex-1">إغلاق</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
