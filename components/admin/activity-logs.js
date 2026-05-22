'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/page-shared';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ============ ACTIVITY LOGS + SESSIONS PAGE ============
export default function ActivityLogsPage() {
  const [tab, setTab] = useState('logs');
  const [logs, setLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const load = async () => {
    const params = new URLSearchParams({ limit: '300' });
    if (actionFilter) params.set('action', actionFilter);
    if (entityFilter) params.set('entity', entityFilter);
    const [l, s] = await Promise.all([
      api(`activity-logs?${params.toString()}`),
      api('sessions'),
    ]);
    if (Array.isArray(l)) setLogs(l);
    if (Array.isArray(s)) setSessions(s);
  };
  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [actionFilter, entityFilter]);

  const terminate = async (id) => {
    if (!confirm('إنهاء هذه الجلسة؟')) return;
    await api(`sessions/${id}/terminate`, { method: 'POST' });
    toast.success('تم إنهاء الجلسة'); load();
  };

  const actions = Array.from(new Set(logs.map(l => l.action))).filter(Boolean).sort();
  const entities = Array.from(new Set(logs.map(l => l.entity))).filter(Boolean).sort();

  const ACTION_META = {
    login_success: { c: 'bg-emerald-500/20 text-emerald-400', icon: '✅' },
    login_failed: { c: 'bg-red-500/20 text-red-400', icon: '❌' },
    logout: { c: 'bg-purple-500/20 text-purple-400', icon: '🚪' },
    attendance_checkin: { c: 'bg-cyan-500/20 text-cyan-400', icon: '📍' },
    attendance_checkout: { c: 'bg-purple-500/20 text-purple-400', icon: '🚪' },
    task_created: { c: 'bg-amber-500/20 text-amber-400', icon: '📋' },
    leave_request: { c: 'bg-amber-500/20 text-amber-400', icon: '📅' },
    advance_request: { c: 'bg-yellow-500/20 text-yellow-400', icon: '💰' },
    employee_created: { c: 'bg-emerald-500/20 text-emerald-400', icon: '👤' },
    employee_updated: { c: 'bg-cyan-500/20 text-cyan-400', icon: '✏️' },
    subscriber_created: { c: 'bg-emerald-500/20 text-emerald-400', icon: '🌐' },
    tg_user_created: { c: 'bg-emerald-500/20 text-emerald-400', icon: '✈️' },
    tg_user_deleted: { c: 'bg-red-500/20 text-red-400', icon: '🗑️' },
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black gold-text">📜 سجل النشاطات والجلسات</h1>
        <p className="text-sm text-muted-foreground mt-1">تتبع كامل لكل عملية تتم في النظام مع IP والوقت والمستخدم</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي الأحداث</p><p className="text-2xl font-bold gold-text">{logs.length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">جلسات نشطة</p><p className="text-2xl font-bold text-emerald-400">{sessions.filter(s => s.active).length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">دخول ناجح</p><p className="text-2xl font-bold text-cyan-400">{logs.filter(l => l.action === 'login_success').length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">محاولات فاشلة</p><p className="text-2xl font-bold text-red-400">{logs.filter(l => l.action === 'login_failed').length}</p></div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-input/30 border border-gold-soft">
          <TabsTrigger value="logs">📜 سجل النشاطات ({logs.length})</TabsTrigger>
          <TabsTrigger value="sessions">🔐 الجلسات ({sessions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Select value={actionFilter || 'all'} onValueChange={v => setActionFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="فلتر حسب الإجراء" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الإجراءات</SelectItem>
                {actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={entityFilter || 'all'} onValueChange={v => setEntityFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="فلتر حسب النوع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {entities.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card className="glass-strong border-gold-soft">
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card/95 backdrop-blur">
                  <tr className="border-b border-gold-soft">
                    <th className="p-2 text-right w-10"></th>
                    <th className="p-2 text-right">الإجراء</th>
                    <th className="p-2 text-right">المستخدم</th>
                    <th className="p-2 text-right">التفاصيل</th>
                    <th className="p-2 text-right">IP</th>
                    <th className="p-2 text-right">الوقت</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => {
                    const meta = ACTION_META[l.action] || { c: 'bg-muted text-muted-foreground', icon: '•' };
                    return (
                      <tr key={l.id} className="border-b border-gold-soft/30 hover:bg-gold/5">
                        <td className="p-2 text-base">{meta.icon}</td>
                        <td className="p-2"><Badge className={meta.c + ' text-[9px]'}>{l.action}</Badge></td>
                        <td className="p-2 font-bold">{l.user || '-'}</td>
                        <td className="p-2 text-muted-foreground">{l.details || '-'}</td>
                        <td className="p-2 font-mono text-[10px]">{l.ip || '-'}</td>
                        <td className="p-2 text-[10px] text-muted-foreground whitespace-nowrap">{new Date(l.timestamp).toLocaleString('ar-IQ')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {logs.length === 0 && <p className="p-6 text-center text-muted-foreground text-xs">لا توجد سجلات</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <Card className="glass-strong border-gold-soft">
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card/95 backdrop-blur">
                  <tr className="border-b border-gold-soft">
                    <th className="p-2 text-right">الحالة</th>
                    <th className="p-2 text-right">الموظف</th>
                    <th className="p-2 text-right">IP</th>
                    <th className="p-2 text-right">الجهاز</th>
                    <th className="p-2 text-right">بدأت</th>
                    <th className="p-2 text-right">آخر نشاط</th>
                    <th className="p-2 text-right">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id} className="border-b border-gold-soft/30 hover:bg-gold/5">
                      <td className="p-2"><Badge className={s.active ? 'bg-emerald-500/20 text-emerald-400 text-[9px]' : 'bg-muted text-muted-foreground text-[9px]'}>{s.active ? '🟢 نشطة' : '⚫ منتهية'}</Badge></td>
                      <td className="p-2 font-bold">{s.employeeName}</td>
                      <td className="p-2 font-mono text-[10px]">{s.ip}</td>
                      <td className="p-2 text-[10px] text-muted-foreground truncate max-w-[200px]" title={s.userAgent}>{(s.userAgent || '').slice(0, 30)}{s.userAgent?.length > 30 ? '...' : ''}</td>
                      <td className="p-2 text-[10px]">{new Date(s.createdAt).toLocaleString('ar-IQ')}</td>
                      <td className="p-2 text-[10px]">{s.lastActivity ? new Date(s.lastActivity).toLocaleString('ar-IQ') : '-'}</td>
                      <td className="p-2">
                        {s.active && <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-7 text-[10px]" onClick={() => terminate(s.id)}>إنهاء</Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sessions.length === 0 && <p className="p-6 text-center text-muted-foreground text-xs">لا توجد جلسات</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
