'use client';
import { GPSMap } from '@/components/maps-barcode';
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

export default function LocationRequestsPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [viewing, setViewing] = useState(null);
  const [rejectItem, setRejectItem] = useState(null);
  const [reason, setReason] = useState('');

  const load = () => api(`location-update-requests${filter === 'all' ? '' : `?status=${filter}`}`).then(d => {
    if (Array.isArray(d)) setItems(d);
  });
  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, [filter]);

  const approve = async (r) => {
    const res = await api(`location-update-requests/${r.id}/approve`, { method: 'POST' });
    if (res?.error) toast.error(res.error);
    else { sounds.success(); toast.success('✅ تم تطبيق الموقع الجديد'); load(); }
  };
  const reject = async () => {
    if (!rejectItem) return;
    const res = await api(`location-update-requests/${rejectItem.id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
    if (res?.error) toast.error(res.error);
    else { toast.success('❌ تم رفض الطلب'); setRejectItem(null); setReason(''); load(); }
  };

  const statusLabel = { pending: '🟡 بانتظار المراجعة', approved: '✅ مقبول', rejected: '❌ مرفوض' };
  const counts = {
    pending: items.filter(x => x.status === 'pending').length,
    approved: items.filter(x => x.status === 'approved').length,
    rejected: items.filter(x => x.status === 'rejected').length,
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-black gold-text flex items-center gap-2">
            <MapPin className="w-6 h-6" /> طلبات تعديل مواقع المشتركين
          </h1>
          <p className="text-xs text-muted-foreground mt-1">طلبات من الموظفين لتعديل إحداثيات GPS للمشتركين</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { k: 'pending', l: '🟡 بانتظار المراجعة', c: counts.pending },
          { k: 'approved', l: '✅ مقبولة', c: counts.approved },
          { k: 'rejected', l: '❌ مرفوضة', c: counts.rejected },
          { k: 'all', l: '📋 الكل', c: items.length },
        ].map(b => (
          <button key={b.k} onClick={() => setFilter(b.k)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${filter === b.k ? 'bg-gold/20 border-gold text-gold' : 'bg-input/30 border-gold-soft text-muted-foreground hover:text-gold'}`}>
            {b.l} <span className="font-bold">({b.c})</span>
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <Card className="glass-strong border-gold-soft">
          <CardContent className="py-12 text-center text-muted-foreground">
            <MapPin className="w-12 h-12 mx-auto opacity-30 mb-3" />
            <p className="text-sm">لا توجد طلبات</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {items.map(r => (
            <Card key={r.id} className={`glass-card ${r.status === 'pending' ? 'border-amber-500/40 ring-1 ring-amber-500/20' : 'border-gold-soft'}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold gold-text">{r.subscriberName}</h3>
                    <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">{r.subscriberPhone || '-'}</p>
                  </div>
                  <Badge className="text-[10px]">{statusLabel[r.status]}</Badge>
                </div>

                <div className="text-xs">
                  <p>👤 الموظف: <span className="font-bold">{r.employeeName}</span></p>
                  <p className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleString('ar-IQ')}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="p-2 rounded bg-red-500/10 border border-red-500/30">
                    <p className="text-muted-foreground">الموقع القديم</p>
                    <p className="font-mono" dir="ltr">{r.oldLat?.toFixed?.(5) || '-'}, {r.oldLng?.toFixed?.(5) || '-'}</p>
                  </div>
                  <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30">
                    <p className="text-muted-foreground">الموقع الجديد</p>
                    <p className="font-mono text-emerald-400" dir="ltr">{r.newLat?.toFixed?.(5)}, {r.newLng?.toFixed?.(5)}</p>
                  </div>
                </div>

                {r.notes && <p className="text-[10px] text-muted-foreground p-2 rounded bg-input/30">📝 {r.notes}</p>}

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1" onClick={() => setViewing(r)}>
                    🗺️ خريطة مقارنة
                  </Button>
                  {r.status === 'pending' && (
                    <>
                      <Button size="sm" className="h-7 text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => approve(r)}>✅ قبول</Button>
                      <Button size="sm" className="h-7 text-[10px] bg-red-500 hover:bg-red-600 text-white" onClick={() => { setRejectItem(r); setReason(''); }}>❌ رفض</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="glass-strong border-cyan-500/40 max-w-3xl">
          <DialogHeader><DialogTitle className="text-cyan-400">🗺️ خريطة مقارنة - {viewing?.subscriberName}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">الموقع القديم</p>
                  {viewing.oldLat && viewing.oldLng
                    ? <GPSMap lat={viewing.oldLat} lng={viewing.oldLng} label="القديم" height={300} />
                    : <div className="h-[300px] rounded bg-input/30 flex items-center justify-center text-xs text-muted-foreground">لا يوجد موقع قديم</div>}
                </div>
                <div>
                  <p className="text-xs text-emerald-400 mb-1">الموقع الجديد المقترح</p>
                  <GPSMap lat={viewing.newLat} lng={viewing.newLng} label="الجديد" height={300} />
                </div>
              </div>
              <a href={`https://www.google.com/maps/dir/${viewing.oldLat || ''},${viewing.oldLng || ''}/${viewing.newLat},${viewing.newLng}`} target="_blank" rel="noreferrer">
                <Button className="w-full btn-neon">🗺️ افتح المقارنة في Google Maps</Button>
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectItem} onOpenChange={() => { setRejectItem(null); setReason(''); }}>
        <DialogContent className="glass-strong border-red-500/40">
          <DialogHeader><DialogTitle className="text-red-400">رفض طلب تعديل الموقع</DialogTitle></DialogHeader>
          <p className="text-xs">المشترك: <span className="font-bold">{rejectItem?.subscriberName}</span></p>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب الرفض..." className="bg-input/30 border-gold/20 h-24" />
          <DialogFooter><Button onClick={reject} className="bg-red-500 hover:bg-red-600 text-white w-full">إرسال الرفض</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
