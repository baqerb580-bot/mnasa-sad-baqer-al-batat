'use client';
import { Trash2 as Trash, Edit2 as Edit } from 'lucide-react';
import { CustomFieldsGrid, CustomFieldsDisplay } from '@/components/custom-fields';
import IspSyncCenter from '@/components/isp-sync-center';
import { ColumnHeader } from '@/components/admin/shared/ColumnHeader';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api, fmt, fmtCurrency, safeArr, setArr } from '@/lib/page-shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
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
  Building2, BarChart, PieChart as PieIcon, Boxes, ChevronDown, Printer, ListTodo, Check, XCircle, LogOut, MessageSquare, QrCode, Power, RefreshCw, Wallet, Brain, Eye
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart as RBarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadialBarChart, RadialBar
} from 'recharts';

export default function Subscribers() {
  const [items, setItems] = useState([]);
  const [zones, setZones] = useState([]);
  const [agents, setAgents] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [packages, setPackages] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [networkFilter, setNetworkFilter] = useState('all');
  const [fatFilter, setFatFilter] = useState('');
  // Column-level search and sort
  const [colSearch, setColSearch] = useState({});
  const [activeColSearch, setActiveColSearch] = useState(null); // which column header has popup open
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activatingSub, setActivatingSub] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', username: '', address: '', zoneId: '', networkId: '', fatNumber: '', agentId: '', package: '50 Mbps', fee: 35000, ipAddress: '', macAddress: '', status: 'active', debt: 0, dueDate: '', userLat: 33.31, userLng: 44.40, cabinetLat: 33.31, cabinetLng: 44.40 });

  const load = async () => {
    const [s, z, a, n, p] = await Promise.all([
      api('subscribers'), api('zones'), api('agents'), api('networks'), api('packages')
    ]);
    setItems(s); setZones(z); setAgents(a); setNetworks(n); setPackages(p);
  };
  useEffect(() => { load(); }, []);

  // Map column key -> accessor function
  const colAccessor = {
    name: (s) => `${s.name || ''} ${s.username || ''}`,
    phone: (s) => s.phone || '',
    package: (s) => s.package || '',
    zone: (s) => `${s.zoneNumber || ''} ${s.zoneName || ''}`,
    fat: (s) => s.fatNumber || '',
    agent: (s) => s.agentName || '',
    ip: (s) => s.ipAddress || '',
    status: (s) => s.status || '',
    endDate: (s) => s.endDate || s.dueDate || '',
    debt: (s) => Number(s.debt || 0),
  };

  // Filter
  let filtered = items.filter(i =>
    (statusFilter === 'all' || i.status === statusFilter) &&
    (zoneFilter === 'all' || i.zoneId === zoneFilter) &&
    (agentFilter === 'all' || i.agentId === agentFilter) &&
    (networkFilter === 'all' || i.networkId === networkFilter) &&
    (!fatFilter || (i.fatNumber || '').toLowerCase().includes(fatFilter.toLowerCase())) &&
    (!search ||
      i.name?.includes(search) ||
      i.username?.toLowerCase().includes(search.toLowerCase()) ||
      i.phone?.includes(search) ||
      i.ipAddress?.includes(search) ||
      i.zoneNumber?.toLowerCase().includes(search.toLowerCase()) ||
      i.fatNumber?.toLowerCase().includes(search.toLowerCase())
    )
  );

  // Apply per-column search
  Object.entries(colSearch).forEach(([col, q]) => {
    if (!q) return;
    const acc = colAccessor[col];
    if (!acc) return;
    const lc = String(q).toLowerCase();
    filtered = filtered.filter(it => String(acc(it)).toLowerCase().includes(lc));
  });

  // Apply sort
  if (sortBy && colAccessor[sortBy]) {
    const acc = colAccessor[sortBy];
    filtered = [...filtered].sort((a, b) => {
      const va = acc(a);
      const vb = acc(b);
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      return sortDir === 'asc' ? sa.localeCompare(sb, 'ar') : sb.localeCompare(sa, 'ar');
    });
  }

  const toggleSort = (col) => {
    if (sortBy === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortBy(null); setSortDir('asc'); }
    } else {
      setSortBy(col); setSortDir('asc');
    }
  };
  const updateColSearch = (col, v) => setColSearch(s => ({ ...s, [col]: v }));

  const save = async () => {
    const zone = zones.find(z => z.id === form.zoneId);
    const network = networks.find(n => n.id === form.networkId);
    const agent = agents.find(a => a.id === form.agentId);
    const payload = {
      ...form,
      zoneName: zone?.name,
      zoneNumber: zone?.number,
      fatNumber: network?.number || form.fatNumber,
      agentName: agent?.name,
      fee: Number(form.fee),
      debt: Number(form.debt),
      userLat: form.userLat ? Number(form.userLat) : null,
      userLng: form.userLng ? Number(form.userLng) : null,
      cabinetLat: form.cabinetLat ? Number(form.cabinetLat) : null,
      cabinetLng: form.cabinetLng ? Number(form.cabinetLng) : null,
    };
    if (editing) await api(`subscribers/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('subscribers', { method: 'POST', body: JSON.stringify(payload) });
    toast.success('تم الحفظ'); setOpen(false); setEditing(null); load();
  };
  const remove = async (id) => { await api(`subscribers/${id}`, { method: 'DELETE' }); toast.success('تم الحذف'); load(); };
  const startEdit = (s) => { setEditing(s); setForm({ ...s, userLat: s.userLat || 33.31, userLng: s.userLng || 44.40, cabinetLat: s.cabinetLat || 33.31, cabinetLng: s.cabinetLng || 44.40 }); setOpen(true); };
  const [syncOpen, setSyncOpen] = useState(false);
  const [viewingCustom, setViewingCustom] = useState(null);

  const activeCount = items.filter(i => i.status === 'active').length;
  const totalDebt = items.reduce((s, x) => s + (x.debt || 0), 0);
  const monthlyIncome = items.filter(i => i.status === 'active').reduce((s, x) => s + (x.fee || 0), 0);

  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setZoneFilter('all'); setAgentFilter('all'); setNetworkFilter('all'); setFatFilter(''); };
  const hasActiveFilters = search || statusFilter !== 'all' || zoneFilter !== 'all' || agentFilter !== 'all' || networkFilter !== 'all' || fatFilter;

  const formZoneNetworks = networks.filter(n => !form.zoneId || n.zoneId === form.zoneId);
  const filterZoneNetworks = networks.filter(n => zoneFilter === 'all' || n.zoneId === zoneFilter);

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold gold-text">مشتركو الإنترنت</h1>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setSyncOpen(true)} variant="outline" className="border-cyan-500/40 hover:bg-cyan-500/10 text-cyan-400">
            <RefreshCw className="w-4 h-4 ml-1" /> مزامنة مشتركين الإنترنت
          </Button>
          <Button onClick={() => { setEditing(null); setForm({ name: '', phone: '', username: '', address: '', zoneId: zones[0]?.id || '', networkId: '', fatNumber: '', agentId: agents[0]?.id || '', package: '50 Mbps', fee: 35000, ipAddress: '', macAddress: '', status: 'active', debt: 0, dueDate: '', userLat: 33.31, userLng: 44.40, cabinetLat: 33.31, cabinetLng: 44.40 }); setOpen(true); }} className="btn-gold">
            <Plus className="w-4 h-4 ml-1" /> مشترك جديد
          </Button>
        </div>
      </div>
      <IspSyncCenter open={syncOpen} onClose={() => { setSyncOpen(false); load(); }} api={api} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي المشتركين</p><p className="text-2xl font-bold gold-text">{items.length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">نشط</p><p className="text-2xl font-bold text-emerald-400">{activeCount}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">الدخل الشهري</p><p className="text-xl font-bold neon-text">{fmtCurrency(monthlyIncome)}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي الديون</p><p className="text-xl font-bold text-red-400">{fmtCurrency(totalDebt)}</p></div>
      </div>

      <Card className="glass-strong border-gold-soft">
        <CardContent className="pt-6 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث شامل: اسم/يوزر/هاتف/IP/زون/فاتة..." className="pr-10 bg-input/30 border-gold/20" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 p-3 rounded-xl bg-gold/5 border border-gold-soft">
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">رقم الزون</Label>
              <Select value={zoneFilter} onValueChange={(v) => { setZoneFilter(v); setNetworkFilter('all'); }}>
                <SelectTrigger className="bg-input/30 border-gold/20 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {zones.map(z => <SelectItem key={z.id} value={z.id}><span className="font-mono text-gold">{z.number}</span> · {z.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">الشبكة/الفاتة</Label>
              <Select value={networkFilter} onValueChange={setNetworkFilter}>
                <SelectTrigger className="bg-input/30 border-gold/20 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="all">الكل</SelectItem>
                  {filterZoneNetworks.map(n => <SelectItem key={n.id} value={n.id}><span className="font-mono text-purple-400">{n.number}</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">رقم الفاتة (نص)</Label>
              <Input value={fatFilter} onChange={e => setFatFilter(e.target.value)} placeholder="F-01" className="bg-input/30 border-gold/20 h-9 text-xs font-mono" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">الوكيل</Label>
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="bg-input/30 border-gold/20 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">الحالة</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-input/30 border-gold/20 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="suspended">موقف</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={clearFilters} variant="outline" size="sm" disabled={!hasActiveFilters} className="w-full h-9 text-xs border-gold/30 disabled:opacity-40">
                <X className="w-3 h-3 ml-1" /> مسح
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">عدد النتائج: <span className="text-gold font-bold">{filtered.length}</span> من {items.length} {sortBy && <span className="text-cyan-400 mx-2">⇅ ترتيب: {({name:'الاسم',phone:'الهاتف',package:'الباقة',zone:'الزون',fat:'الفاتة',agent:'الوكيل',ip:'IP',status:'الحالة',endDate:'الانتهاء',debt:'الدين'})[sortBy]} ({sortDir === 'asc' ? '⬆️' : '⬇️'})</span>}</p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold-soft text-right text-xs text-muted-foreground">
                  {[
                    { k: 'name', label: 'المشترك / اليوزر' },
                    { k: 'phone', label: 'الهاتف' },
                    { k: 'package', label: 'الباقة' },
                    { k: 'zone', label: 'الزون' },
                    { k: 'fat', label: 'الفاتة' },
                    { k: 'agent', label: 'الوكيل' },
                    { k: 'ip', label: 'IP' },
                    { k: 'status', label: 'الحالة' },
                    { k: 'endDate', label: 'ينتهي' },
                    { k: 'debt', label: 'الدين' },
                  ].map(col => (
                    <ColumnHeader
                      key={col.k}
                      colKey={col.k}
                      label={col.label}
                      sortBy={sortBy}
                      sortDir={sortDir}
                      toggleSort={toggleSort}
                      colSearch={colSearch[col.k] || ''}
                      onColSearch={(v) => updateColSearch(col.k, v)}
                      open={activeColSearch === col.k}
                      setOpen={(v) => setActiveColSearch(v ? col.k : null)}
                    />
                  ))}
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="11" className="text-center py-8 text-muted-foreground">لا توجد نتائج 🔍</td></tr>
                ) : filtered.map(s => (
                  <tr key={s.id} className="border-b border-gold-soft/30 hover:bg-gold/5">
                    <td className="p-2">
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-[10px] font-mono text-cyan-400">@{s.username || '—'}</div>
                    </td>
                    <td className="text-xs">{s.phone}</td>
                    <td><Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-[10px]">{s.package}</Badge></td>
                    <td><span className="font-mono text-xs text-gold">{s.zoneNumber || '—'}</span></td>
                    <td><Badge variant="outline" className="border-purple-500/30 text-purple-400 font-mono text-[10px]">{s.fatNumber || '—'}</Badge></td>
                    <td className="text-[10px] text-muted-foreground">{s.agentName || '—'}</td>
                    <td className="text-xs font-mono">{s.ipAddress}</td>
                    <td><Badge className={s.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}>{s.status === 'active' ? 'نشط' : 'موقف'}</Badge></td>
                    <td className="text-[10px] text-muted-foreground">{s.dueDate || '—'}</td>
                    <td className={s.debt > 0 ? 'text-red-400 font-bold' : 'text-muted-foreground'}>{fmt(s.debt)}</td>
                    <td>
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => setActivatingSub(s)} className="h-7 text-[10px] btn-gold px-2"><Zap className="w-3 h-3 ml-1" /> تفعيل</Button>
                        <WhatsAppSubscriberButton subscriber={s} />
                        {s.customFields && Object.keys(s.customFields).length > 0 && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-violet-400" onClick={() => setViewingCustom(s)} title="حقول مخصصة">
                            <span className="text-sm">📋</span>
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(s)}><Edit2 className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-red-500" onClick={() => remove(s.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-gold/40 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="gold-text">{editing ? 'تعديل المشترك' : 'مشترك جديد'}</DialogTitle></DialogHeader>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid grid-cols-3 bg-input/30">
              <TabsTrigger value="basic">معلومات أساسية</TabsTrigger>
              <TabsTrigger value="network">الشبكة</TabsTrigger>
              <TabsTrigger value="location">المواقع GPS</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="grid grid-cols-2 gap-3 mt-3">
              <div className="col-span-2"><Label>الاسم</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-input/30 border-gold/20" /></div>
              <div><Label>اليوزر</Label><Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="user_1234" className="bg-input/30 border-gold/20 font-mono" /></div>
              <div><Label>الهاتف</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-input/30 border-gold/20" /></div>
              <div className="col-span-2"><Label>العنوان</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="bg-input/30 border-gold/20" /></div>
              <div><Label>الباقة</Label>
                <Select value={form.package} onValueChange={v => setForm({ ...form, package: v, fee: v === '25 Mbps' ? 25000 : v === '50 Mbps' ? 35000 : v === '100 Mbps' ? 50000 : 75000 })}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25 Mbps">25 Mbps</SelectItem>
                    <SelectItem value="50 Mbps">50 Mbps</SelectItem>
                    <SelectItem value="100 Mbps">100 Mbps</SelectItem>
                    <SelectItem value="200 Mbps">200 Mbps</SelectItem>
                    <SelectItem value="500 Mbps">500 Mbps</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>الرسوم الشهرية</Label><Input type="number" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} className="bg-input/30 border-gold/20" /></div>
              <div><Label>الحالة</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">نشط</SelectItem><SelectItem value="suspended">موقف</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>الدين</Label><Input type="number" value={form.debt} onChange={e => setForm({ ...form, debt: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            </TabsContent>
            <TabsContent value="network" className="grid grid-cols-2 gap-3 mt-3">
              <div><Label>الوكيل</Label>
                <Select value={form.agentId} onValueChange={v => setForm({ ...form, agentId: v })}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="اختر وكيل" /></SelectTrigger>
                  <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>الزون</Label>
                <Select value={form.zoneId} onValueChange={v => setForm({ ...form, zoneId: v, networkId: '' })}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="اختر زون" /></SelectTrigger>
                  <SelectContent>{zones.map(z => <SelectItem key={z.id} value={z.id}><span className="font-mono text-gold">{z.number}</span> · {z.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>الشبكة / الفاتة</Label>
                <Select value={form.networkId} onValueChange={v => { const n = networks.find(x => x.id === v); setForm({ ...form, networkId: v, fatNumber: n?.number || '', cabinetLat: n?.lat || form.cabinetLat, cabinetLng: n?.lng || form.cabinetLng }); }}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="اختر فاتة" /></SelectTrigger>
                  <SelectContent className="max-h-80">{formZoneNetworks.map(n => <SelectItem key={n.id} value={n.id}><span className="font-mono text-purple-400">{n.number}</span> · {n.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>IP Address</Label><Input value={form.ipAddress} onChange={e => setForm({ ...form, ipAddress: e.target.value })} placeholder="10.10.1.1" className="bg-input/30 border-gold/20 font-mono" /></div>
              <div><Label>MAC Address</Label><Input value={form.macAddress} onChange={e => setForm({ ...form, macAddress: e.target.value })} className="bg-input/30 border-gold/20 font-mono" /></div>
            </TabsContent>
            <TabsContent value="location" className="grid grid-cols-2 gap-3 mt-3">
              <div className="col-span-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <p className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> موقع المشترك (اليوز)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[10px]">خط العرض (Lat)</Label><Input type="number" step="0.000001" value={form.userLat} onChange={e => setForm({ ...form, userLat: e.target.value })} className="bg-input/30 border-gold/20 font-mono text-xs" /></div>
                  <div><Label className="text-[10px]">خط الطول (Lng)</Label><Input type="number" step="0.000001" value={form.userLng} onChange={e => setForm({ ...form, userLng: e.target.value })} className="bg-input/30 border-gold/20 font-mono text-xs" /></div>
                </div>
                <Button size="sm" type="button" onClick={() => navigator.geolocation?.getCurrentPosition(p => setForm(f => ({ ...f, userLat: p.coords.latitude, userLng: p.coords.longitude })))} className="mt-2 w-full text-[10px] h-7 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30">
                  <MapPin className="w-3 h-3 ml-1" /> استخدم موقعي الحالي
                </Button>
              </div>
              <div className="col-span-2 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <p className="text-xs font-bold text-purple-400 mb-2 flex items-center gap-1"><Plug className="w-3 h-3" /> موقع الكابينة / الفاتة</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[10px]">خط العرض (Lat)</Label><Input type="number" step="0.000001" value={form.cabinetLat} onChange={e => setForm({ ...form, cabinetLat: e.target.value })} className="bg-input/30 border-gold/20 font-mono text-xs" /></div>
                  <div><Label className="text-[10px]">خط الطول (Lng)</Label><Input type="number" step="0.000001" value={form.cabinetLng} onChange={e => setForm({ ...form, cabinetLng: e.target.value })} className="bg-input/30 border-gold/20 font-mono text-xs" /></div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">💡 يتم تعبئته تلقائياً عند اختيار الفاتة</p>
              </div>
              {(form.userLat && form.userLng) && (
                <a href={`https://www.openstreetmap.org/?mlat=${form.userLat}&mlon=${form.userLng}#map=17/${form.userLat}/${form.userLng}`} target="_blank" rel="noreferrer" className="col-span-2 text-center text-xs text-cyan-400 underline hover:text-cyan-300">🗺️ عرض موقع المشترك على الخريطة</a>
              )}
            </TabsContent>
          </Tabs>

          <CustomFieldsGrid
            entity="subscribers"
            customFields={form.customFields}
            onUpdate={(cf) => setForm({ ...form, customFields: cf })}
            columns={2}
          />

          <DialogFooter><Button onClick={save} className="btn-gold w-full">حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ActivationDialog
        subscriber={activatingSub}
        packages={packages}
        agents={agents}
        onClose={() => setActivatingSub(null)}
        onDone={() => { setActivatingSub(null); load(); }}
      />

      {/* Custom Fields Viewer Dialog */}
      <Dialog open={!!viewingCustom} onOpenChange={() => setViewingCustom(null)}>
        <DialogContent className="glass-strong border-violet-500/40">
          <DialogHeader>
            <DialogTitle className="text-violet-400 flex items-center gap-2">
              📋 الحقول المخصصة - {viewingCustom?.name}
            </DialogTitle>
          </DialogHeader>
          {viewingCustom && (
            <div className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
              <CustomFieldsDisplay entity="subscribers" customFields={viewingCustom.customFields} />
              {(!viewingCustom.customFields || Object.keys(viewingCustom.customFields).length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4">لا توجد حقول مخصصة مُعبّأة</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => { const v = viewingCustom; setViewingCustom(null); startEdit(v); }} className="btn-gold w-full">
              <Edit2 className="w-3 h-3 ml-1" /> تعديل القيم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
