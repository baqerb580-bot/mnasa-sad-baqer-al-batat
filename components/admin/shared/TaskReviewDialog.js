'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/page-shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileText } from 'lucide-react';

export function TaskReviewDialog({ task, onClose, onDone }) {
  const [notes, setNotes] = useState('');
  const [speed, setSpeed] = useState(4);
  const [quality, setQuality] = useState(4);
  const [commitment, setCommitment] = useState(4);
  const [delay, setDelay] = useState(4);
  useEffect(() => { if (task) { setNotes(''); setSpeed(4); setQuality(4); setCommitment(4); setDelay(4); } }, [task]);
  if (!task) return null;

  const submit = async (action) => {
    const rating = { speed, quality, commitment, delay };
    const r = await api(`tasks/${task.id}/review`, { method: 'POST', body: JSON.stringify({ action, rating, notes, reviewerName: 'المدير' }) });
    if (r.error) toast.error(r.error);
    else { toast.success(action === 'approve' ? '✅ تم قبول المهمة' : action === 'revise' ? '🔄 طُلِب التعديل' : '❌ تم الرفض'); onDone(); }
  };

  const StarBar = ({ label, value, onChange }) => (
    <div>
      <Label className="text-xs flex justify-between">
        <span>{label}</span>
        <span className="font-bold gold-text">{value}/5</span>
      </Label>
      <div className="flex gap-1 mt-1">
        {[1, 2, 3, 4, 5].map(i => (
          <button key={i} type="button" onClick={() => onChange(i)} className={`text-2xl transition-all ${i <= value ? 'opacity-100' : 'opacity-30'}`}>⭐</button>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={!!task} onOpenChange={onClose}>
      <DialogContent className="glass-strong border-gold/40 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="gold-text">📋 مراجعة المهمة</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className="p-3 rounded bg-input/30 border border-gold-soft">
            <h3 className="font-bold">{task.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
            <p className="text-[10px] text-cyan-400 mt-1">👤 {task.assignedToName} · 📅 {task.dueDate}</p>
          </div>

          {task.report && (
            <div className="p-3 rounded bg-purple-500/10 border border-purple-500/30 space-y-2">
              <p className="font-bold text-purple-400 text-sm">📋 تقرير الموظف</p>
              <div>
                <p className="text-[10px] text-muted-foreground">ما تم إنجازه:</p>
                <p className="text-xs">{task.report.summary}</p>
              </div>
              {task.report.notes && (
                <div>
                  <p className="text-[10px] text-muted-foreground">ملاحظات:</p>
                  <p className="text-xs">{task.report.notes}</p>
                </div>
              )}
              {task.report.problems && (
                <div>
                  <p className="text-[10px] text-muted-foreground">مشاكل واجهها:</p>
                  <p className="text-xs">{task.report.problems}</p>
                </div>
              )}
              <p className="text-[10px]">نسبة الإنجاز: <span className="font-bold gold-text">{task.report.progress}%</span></p>
              {task.report.attachments?.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">📎 المرفقات ({task.report.attachments.length}):</p>
                  <div className="grid grid-cols-4 gap-2">
                    {task.report.attachments.map((f, i) => {
                      const url = f.url || '';
                      const mime = f.mime || '';
                      const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(url) || url.includes('/api/files/') || mime.startsWith('image/');
                      return (
                        <a key={i} href={f.url} target="_blank" rel="noreferrer" className="block">
                          {isImage ? (
                            <img
                              src={f.url}
                              alt={f.name}
                              className="w-full h-16 object-cover rounded border border-gold/20"
                              onError={(e) => { e.currentTarget.outerHTML = `<div class="w-full h-16 flex items-center justify-center bg-amber-500/10 border border-amber-500/30 rounded text-[9px] text-amber-400">⚠️ غير متاح</div>`; }}
                            />
                          ) : (
                            <div className="w-full h-16 flex items-center justify-center bg-input/30 rounded border border-gold/20">
                              <FileText className="w-6 h-6 text-cyan-400" />
                            </div>
                          )}
                          <p className="text-[9px] truncate mt-1">{f.name}</p>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 p-3 rounded border border-gold-soft">
            <p className="col-span-2 font-bold text-sm gold-text">⭐ تقييم الموظف</p>
            <StarBar label="سرعة الإنجاز" value={speed} onChange={setSpeed} />
            <StarBar label="جودة العمل" value={quality} onChange={setQuality} />
            <StarBar label="الالتزام" value={commitment} onChange={setCommitment} />
            <StarBar label="عدم التأخير" value={delay} onChange={setDelay} />
          </div>

          <div>
            <Label className="text-xs">ملاحظات المدير (للموظف)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="bg-input/30 border-gold/20 h-20 mt-1" placeholder="ملاحظاتك ستظهر للموظف..." />
          </div>
        </div>

        <DialogFooter className="grid grid-cols-3 gap-2">
          <Button onClick={() => submit('reject')} variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10">❌ رفض</Button>
          <Button onClick={() => submit('revise')} variant="outline" className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10">🔄 إعادة تعديل</Button>
          <Button onClick={() => submit('approve')} className="btn-gold">✅ قبول</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
