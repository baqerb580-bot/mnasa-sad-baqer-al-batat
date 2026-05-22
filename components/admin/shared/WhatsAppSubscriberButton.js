'use client';
import { useState } from 'react';
import { api } from '@/lib/page-shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MessageSquare, Send, CheckCircle2, XCircle, Clock } from 'lucide-react';

export function WhatsAppSubscriberButton({ subscriber }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMsg, setCustomMsg] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const d = await api(`whatsapp/history/${subscriber.id}`);
      setHistory(Array.isArray(d) ? d : []);
    } finally { setHistoryLoading(false); }
  };

  const sendTpl = async (templateKey, label, extraVars = {}) => {
    if (!subscriber?.phone) { toast.error('لا يوجد رقم هاتف'); return; }
    setSending(templateKey);
    try {
      const r = await api('whatsapp/send', { method: 'POST', body: JSON.stringify({ subscriberId: subscriber.id, templateKey, vars: extraVars }) });
      if (r?.success) toast.success(`📤 تم إرسال ${label}`);
      else if (r?.queued) toast.info('⏳ تم وضع الرسالة في الطابور (WhatsApp غير متصل)');
      else toast.error('فشل: ' + (r?.error || ''));
    } catch (e) {
      toast.error('خطأ: ' + e.message);
    } finally {
      setSending(null);
      setOpen(false);
    }
  };

  const sendCustom = async () => {
    if (!customMsg.trim()) return;
    setSending('custom');
    try {
      const r = await api('whatsapp/send', { method: 'POST', body: JSON.stringify({ subscriberId: subscriber.id, message: customMsg }) });
      if (r?.success) toast.success('📤 تم الإرسال');
      else if (r?.queued) toast.info('⏳ تم وضع الرسالة في الطابور');
      else toast.error('فشل: ' + (r?.error || ''));
      setCustomOpen(false);
      setCustomMsg('');
    } finally { setSending(null); }
  };

  if (!subscriber?.phone) return null;

  return (
    <>
      <div className="relative inline-block">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 hover:text-emerald-500 text-emerald-400"
          onClick={() => setOpen(!open)}
          title="إرسال واتساب"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </Button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute z-50 left-0 top-8 w-56 glass-strong border border-emerald-500/30 rounded-lg shadow-2xl p-1">
              <button onClick={() => sendTpl('activation', 'رسالة تفعيل')} disabled={!!sending} className="w-full text-right text-xs px-3 py-2 hover:bg-emerald-500/10 rounded flex items-center gap-2">
                <span>🎉</span> رسالة تفعيل
              </button>
              <button onClick={() => sendTpl('expiry', 'رسالة انتهاء')} disabled={!!sending} className="w-full text-right text-xs px-3 py-2 hover:bg-amber-500/10 rounded flex items-center gap-2">
                <span>⏰</span> رسالة انتهاء الاشتراك
              </button>
              <button onClick={() => sendTpl('expiry_alert', 'تنبيه قبل الانتهاء', { daysLeft: 5 })} disabled={!!sending} className="w-full text-right text-xs px-3 py-2 hover:bg-cyan-500/10 rounded flex items-center gap-2">
                <span>🔔</span> تنبيه قبل الانتهاء
              </button>
              <button onClick={() => sendTpl('debt', 'رسالة دين')} disabled={!!sending} className="w-full text-right text-xs px-3 py-2 hover:bg-red-500/10 rounded flex items-center gap-2">
                <span>💸</span> رسالة دين / مستحقات
              </button>
              <button onClick={() => sendTpl('receipt', 'وصل الاشتراك')} disabled={!!sending} className="w-full text-right text-xs px-3 py-2 hover:bg-violet-500/10 rounded flex items-center gap-2">
                <span>🧾</span> إرسال وصل الاشتراك
              </button>
              <div className="border-t border-gold-soft my-1"></div>
              <button onClick={() => { setOpen(false); setCustomOpen(true); }} className="w-full text-right text-xs px-3 py-2 hover:bg-gold/10 rounded flex items-center gap-2">
                <span>✍️</span> رسالة مخصصة
              </button>
              <button onClick={() => { setOpen(false); setHistoryOpen(true); loadHistory(); }} className="w-full text-right text-xs px-3 py-2 hover:bg-gold/10 rounded flex items-center gap-2">
                <span>📜</span> سجل رسائل هذا المشترك
              </button>
            </div>
          </>
        )}
      </div>
      {customOpen && (
        <Dialog open={customOpen} onOpenChange={setCustomOpen}>
          <DialogContent className="glass-strong border-emerald-500/30">
            <DialogHeader>
              <DialogTitle className="text-emerald-400 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> رسالة واتساب إلى {subscriber.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground">إلى: <span dir="ltr" className="font-mono text-cyan-400">{subscriber.phone}</span></p>
              <Textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)} rows={6} placeholder="اكتب رسالتك هنا..." className="bg-input/30 border-gold/20" />
            </div>
            <DialogFooter>
              <Button onClick={sendCustom} disabled={!customMsg.trim() || sending === 'custom'} className="btn-gold">
                <Send className="w-3 h-3 ml-1" /> إرسال
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {historyOpen && (
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="glass-strong border-emerald-500/30 max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-emerald-400 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> سجل رسائل {subscriber.name}
                <span className="text-[10px] text-muted-foreground" dir="ltr">({subscriber.phone})</span>
              </DialogTitle>
            </DialogHeader>
            {historyLoading ? <p className="text-center text-muted-foreground py-6">جاري التحميل…</p> :
            history.length === 0 ? <p className="text-center text-muted-foreground py-6">لا توجد رسائل بعد</p> :
            <div className="space-y-2">
              {history.map(m => (
                <div key={m.id} className={`glass-card rounded-lg p-3 text-xs border ${m.status === 'sent' ? 'border-emerald-500/30' : m.status === 'failed' ? 'border-red-500/30' : 'border-amber-500/30'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-[9px]">{m.type}</Badge>
                    <span className="text-[10px] text-muted-foreground">{m.createdAt ? new Date(m.createdAt).toLocaleString('ar-IQ') : ''}</span>
                  </div>
                  <p className="whitespace-pre-line text-[11px] mb-1">{m.message}</p>
                  <div className="flex items-center gap-2">
                    {m.status === 'sent' && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[9px]"><CheckCircle2 className="w-3 h-3 ml-1" /> مرسلة</Badge>}
                    {m.status === 'failed' && <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-[9px]"><XCircle className="w-3 h-3 ml-1" /> فاشلة</Badge>}
                    {m.status === 'queued' && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[9px]"><Clock className="w-3 h-3 ml-1" /> منتظرة</Badge>}
                    {m.error && <span className="text-[9px] text-red-400">⚠ {m.error}</span>}
                  </div>
                </div>
              ))}
            </div>}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
