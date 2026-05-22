'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api, fmt, fmtCurrency, safeArr, setArr } from '@/lib/page-shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { GPSMap } from '@/components/maps-barcode';
import {
  Search, Plus, Trash2 as Trash, Edit2 as Edit, X, ChevronDown, ChevronLeft, ChevronRight, CheckCircle2,
  AlertTriangle, AlertCircle, Activity, Send, MapPin, FileText, Camera, Clock, RefreshCw, Receipt
} from 'lucide-react';

export function TaskAdvancedActions({ task, employees, onRefresh }) {
  const [busy, setBusy] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [dupsOpen, setDupsOpen] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [transferTo, setTransferTo] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [reviewForm, setReviewForm] = useState({ rating: 80, success: true, notes: '' });

  const canStart = !task.startedAt && task.status !== 'completed' && task.status !== 'pending_review';
  const canComplete = task.startedAt && !task.completedAt && task.status !== 'completed';
  const canTransfer = task.status !== 'completed' && task.status !== 'pending_review';
  const canReview = (task.status === 'completed' || task.status === 'pending_review' || task.completedAt);

  const doStart = async () => {
    setBusy('start');
    try {
      const r = await api(`tasks/${task.id}/start`, { method: 'POST', body: JSON.stringify({ userName: 'المدير' }) });
      if (r?.success) toast.success('▶️ بدأت المهمة'); else toast.error(r?.error || 'فشل');
      onRefresh && onRefresh();
    } finally { setBusy(null); }
  };
  const doComplete = async () => {
    const note = prompt('ملاحظة إكمال (اختيارية):') || '';
    setBusy('complete');
    try {
      const r = await api(`tasks/${task.id}/admin-complete`, { method: 'POST', body: JSON.stringify({ note, userName: 'المدير' }) });
      if (r?.success) toast.success(`✅ تم الإكمال (${r.durationMin} دقيقة)`);
      onRefresh && onRefresh();
    } finally { setBusy(null); }
  };
  const doTransfer = async () => {
    if (!transferTo) { toast.error('اختر موظفاً'); return; }
    setBusy('transfer');
    try {
      const emp = employees.find(e => e.id === transferTo);
      const r = await api(`tasks/${task.id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ toEmployeeId: transferTo, toEmployeeName: emp?.name, reason: transferReason, by: { id: 'manager', name: 'المدير' } }),
      });
      if (r?.success) { toast.success('🔄 تم التحويل'); setTransferOpen(false); setTransferTo(''); setTransferReason(''); }
      onRefresh && onRefresh();
    } finally { setBusy(null); }
  };
  const doReview = async () => {
    setBusy('review');
    try {
      const r = await api(`tasks/${task.id}/rate`, {
        method: 'POST',
        body: JSON.stringify({ rating: Number(reviewForm.rating), success: reviewForm.success, notes: reviewForm.notes, by: { id: 'manager', name: 'المدير' } }),
      });
      if (r?.success) { toast.success('🏆 تم التقييم'); setReviewOpen(false); }
      onRefresh && onRefresh();
    } finally { setBusy(null); }
  };
  const loadDups = async () => {
    const d = await api(`tasks/${task.id}/duplicates`);
    setDuplicates(Array.isArray(d) ? d : []);
    setDupsOpen(true);
  };

  return (
    <>
      {canStart && (
        <Button size="sm" variant="outline" className="h-7 text-[10px] border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10" onClick={doStart} disabled={busy === 'start'}>
          ▶️ بدء
        </Button>
      )}
      {canComplete && (
        <Button size="sm" variant="outline" className="h-7 text-[10px] border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10" onClick={doComplete} disabled={busy === 'complete'}>
          ✅ إنهاء
        </Button>
      )}
      {canTransfer && (
        <Button size="sm" variant="outline" className="h-7 text-[10px] border-violet-500/40 text-violet-400 hover:bg-violet-500/10" onClick={() => setTransferOpen(true)}>
          🔄 تحويل
        </Button>
      )}
      {canReview && (
        <Button size="sm" variant="outline" className="h-7 text-[10px] border-amber-500/40 text-amber-400 hover:bg-amber-500/10" onClick={() => setReviewOpen(true)}>
          🏆 تقييم
        </Button>
      )}
      <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-orange-400" onClick={loadDups} title="مهام مكررة">
        <span className="text-sm">🔁</span>
      </Button>

      {/* Transfer dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="glass-strong border-violet-500/30">
          <DialogHeader><DialogTitle className="text-violet-400">🔄 تحويل المهمة</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">إلى موظف</Label>
            <Select value={transferTo} onValueChange={setTransferTo}>
              <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="اختر..." /></SelectTrigger>
              <SelectContent>
                {employees.filter(e => e.id !== task.assignedTo).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Label className="text-xs">سبب التحويل</Label>
            <Textarea value={transferReason} onChange={e => setTransferReason(e.target.value)} rows={3} className="bg-input/30 border-gold/20" placeholder="مثلاً: الموظف الحالي غير متاح" />
          </div>
          <DialogFooter>
            <Button onClick={doTransfer} disabled={busy === 'transfer'} className="btn-gold">تأكيد التحويل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="glass-strong border-amber-500/30">
          <DialogHeader><DialogTitle className="text-amber-400">🏆 تقييم المهمة</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">نسبة النجاح: {reviewForm.rating}%</Label>
            <input type="range" min="0" max="100" value={reviewForm.rating} onChange={e => setReviewForm(f => ({ ...f, rating: e.target.value }))} className="w-full" />
            <div className="flex gap-2">
              <Button size="sm" variant={reviewForm.success ? 'default' : 'outline'} onClick={() => setReviewForm(f => ({ ...f, success: true }))} className={reviewForm.success ? 'btn-gold' : ''}>✅ ناجحة</Button>
              <Button size="sm" variant={!reviewForm.success ? 'default' : 'outline'} onClick={() => setReviewForm(f => ({ ...f, success: false }))} className={!reviewForm.success ? 'bg-red-500/20 text-red-400' : ''}>❌ فاشلة</Button>
            </div>
            <Label className="text-xs">ملاحظات المدير</Label>
            <Textarea value={reviewForm.notes} onChange={e => setReviewForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="bg-input/30 border-gold/20" />
          </div>
          <DialogFooter>
            <Button onClick={doReview} disabled={busy === 'review'} className="btn-gold">حفظ التقييم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicates dialog */}
      <Dialog open={dupsOpen} onOpenChange={setDupsOpen}>
        <DialogContent className="glass-strong border-orange-500/30 max-w-2xl">
          <DialogHeader><DialogTitle className="text-orange-400">🔁 مهام مكررة لـ "{task.title}"</DialogTitle></DialogHeader>
          {duplicates.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">لا توجد مهام مكررة في آخر 180 يوماً</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {duplicates.map(d => (
                <div key={d.id} className="glass-card rounded-lg p-3 border border-orange-500/30">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold">{d.title}</p>
                    <Badge variant="outline" className="text-[9px]">{d.status}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">📅 {new Date(d.createdAt).toLocaleString('ar-IQ')}</p>
                  <p className="text-[10px] text-muted-foreground">👤 {d.assignedToName}</p>
                  {d.review && (
                    <div className="mt-1 p-2 bg-amber-500/5 rounded border border-amber-500/30">
                      <p className="text-[10px] text-amber-400">🏆 تقييم المدير السابق: {d.review.rating}%</p>
                      {d.review.notes && <p className="text-[10px] italic mt-0.5">📝 {d.review.notes}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
