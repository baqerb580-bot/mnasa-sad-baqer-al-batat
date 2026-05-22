'use client';
import BarcodeScanner from '@/components/barcode-scanner';
import { Trash2 as Trash, Edit2 as Edit } from 'lucide-react';
import { CustomFieldsGrid, CustomFieldsDisplay } from '@/components/custom-fields';
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

export default function Products() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dialogTab, setDialogTab] = useState('basic'); // basic | pricing | compatibility
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchQuery, setSearchQuery] = useState({ q: '', device: '', origin: '', type: '', brand: '', inStock: false });
  const [allDevices, setAllDevices] = useState([]);
  const [scannerOpen, setScannerOpen] = useState(false);

  const blankForm = {
    name: '', sku: '', barcode: '', category: 'accessories', price: 0, cost: 0, stock: 0, lowStockAlert: 5, image: '📦',
    // Pro fields (smart compatibility)
    productType: 'general', // screen | cover | sticker | battery | cable | charger | accessory | spare | general
    origin: 'commercial', // original | oem | commercial | used
    brand: '', model: '', color: '',
    compatibleDevices: [], // array of strings
    branch: '', warehouse: '', shelf: '', cabinet: '', floor: '',
    description: '',
  };
  const [form, setForm] = useState(blankForm);
  const [newDevice, setNewDevice] = useState('');

  const load = () => api('products').then(setArr(setItems));
  useEffect(() => {
    load();
    api('products/devices').then(d => setAllDevices(safeArr(d)));
  }, []);

  const filtered = filter === 'all' ? items : items.filter(i => i.category === filter);

  const save = async () => {
    if (!form.name) { toast.error('الاسم مطلوب'); return; }
    const payload = {
      ...form,
      price: Number(form.price), cost: Number(form.cost),
      stock: Number(form.stock), lowStockAlert: Number(form.lowStockAlert),
      compatibleDevices: Array.isArray(form.compatibleDevices) ? form.compatibleDevices : [],
    };
    if (editing) {
      await api(`products/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast.success('تم التحديث');
    } else {
      await api('products', { method: 'POST', body: JSON.stringify(payload) });
      toast.success('تمت الإضافة');
    }
    setOpen(false); setEditing(null); setForm(blankForm); setDialogTab('basic');
    load();
  };

  const remove = async (id) => {
    if (!confirm('حذف المنتج نهائياً؟')) return;
    await api(`products/${id}`, { method: 'DELETE' });
    toast.success('تم الحذف'); load();
  };
  const startEdit = (p) => {
    setEditing(p);
    setForm({ ...blankForm, ...p, compatibleDevices: p.compatibleDevices || [] });
    setDialogTab('basic'); setOpen(true);
  };
  const startNew = () => { setEditing(null); setForm(blankForm); setDialogTab('basic'); setOpen(true); };

  const addDevice = () => {
    const d = newDevice.trim();
    if (!d) return;
    if (form.compatibleDevices.includes(d)) { toast.info('الجهاز موجود'); return; }
    setForm({ ...form, compatibleDevices: [...form.compatibleDevices, d] });
    setNewDevice('');
  };
  const removeDevice = (d) => setForm({ ...form, compatibleDevices: form.compatibleDevices.filter(x => x !== d) });

  const runSmartSearch = async () => {
    const params = new URLSearchParams();
    Object.entries(searchQuery).forEach(([k, v]) => { if (v && v !== false) params.set(k, v); });
    const r = await api(`products/search?${params.toString()}`);
    setSearchResults(r);
  };

  // ============ BARCODE SCANNER HANDLER ============
  const handleBarcodeDetected = async (code) => {
    setScannerOpen(false);
    toast.success(`📷 تم مسح: ${code}`);
    // Search by barcode first (exact match)
    const r = await api(`products/barcode/${encodeURIComponent(code)}`);
    if (r && !r.error && r.id) {
      // Found exact product → show in compatibility dialog
      setSearchOpen(true);
      setSearchQuery({ q: code, device: '', origin: '', type: '', brand: '', inStock: false });
      setSearchResults({ exact: [r], compatible: [], alternatives: [], total: 1 });
    } else {
      // Not found → run general smart search by code
      setSearchOpen(true);
      setSearchQuery({ q: code, device: '', origin: '', type: '', brand: '', inStock: false });
      const sr = await api(`products/search?q=${encodeURIComponent(code)}`);
      setSearchResults(sr);
      if (sr.total === 0) {
        toast.warning(`⚠️ المنتج بالباركود ${code} غير موجود في النظام. يمكنك إضافته يدوياً.`);
      }
    }
  };

  const originBadge = (o) => {
    const map = {
      original: { label: '✨ أصلي', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
      oem: { label: '🔧 OEM', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' },
      commercial: { label: '🛒 تجاري', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40' },
      used: { label: '♻️ مستعمل', color: 'bg-violet-500/20 text-violet-400 border-violet-500/40' },
    };
    return map[o] || map.commercial;
  };

  const productTypeLabel = (t) => ({
    screen: '📱 شاشة', cover: '🛡️ كفر', sticker: '🎨 ستيكر', battery: '🔋 بطارية',
    cable: '🔌 كيبل', charger: '⚡ شاحن', accessory: '🎧 إكسسوار', spare: '⚙️ قطعة غيار', general: '📦 عام',
  })[t] || '📦 عام';

  const locationStr = (p) => {
    const parts = [p.branch, p.warehouse, p.shelf && `رف ${p.shelf}`, p.cabinet && `خزانة ${p.cabinet}`].filter(Boolean);
    return parts.join(' · ') || null;
  };

  const renderProductCard = (p) => {
    const ob = originBadge(p.origin);
    const loc = locationStr(p);
    return (
      <Card key={p.id} className="glass-card border-gold-soft hover:border-gold/50 transition-all group">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="text-4xl flex-shrink-0">{p.image || '📦'}</div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={p.stock <= (p.lowStockAlert || 5) ? 'destructive' : 'secondary'} className="text-[10px]">{p.stock || 0} قطعة</Badge>
              {p.origin && <Badge className={`text-[9px] ${ob.color}`}>{ob.label}</Badge>}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight">{p.name}</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {p.brand && <span>{p.brand}</span>}
              {p.model && <span> · {p.model}</span>}
              {p.color && <span> · {p.color}</span>}
            </p>
            {p.productType && p.productType !== 'general' && (
              <Badge className="text-[9px] mt-1 bg-violet-500/15 text-violet-400 border-violet-500/30">{productTypeLabel(p.productType)}</Badge>
            )}
          </div>
          {(p.compatibleDevices?.length > 0) && (
            <div className="text-[10px] p-1.5 rounded bg-cyan-500/5 border border-cyan-500/20">
              <p className="text-cyan-400 font-bold">🔗 متوافق مع {p.compatibleDevices.length} جهاز</p>
              <p className="text-cyan-300/70 truncate text-[9px]">{p.compatibleDevices.slice(0, 3).join(' · ')}{p.compatibleDevices.length > 3 ? ' ...' : ''}</p>
            </div>
          )}
          {loc && (
            <div className="text-[10px] text-amber-400/80 flex items-center gap-1">
              📍 <span className="truncate">{loc}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-gold-soft">
            <div>
              <p className="text-[9px] text-muted-foreground">السعر</p>
              <p className="text-sm font-bold gold-text">{fmt(p.price)} د.ع</p>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p)}><Edit2 className="w-3 h-3" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-red-500" onClick={() => remove(p.id)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold gold-text">المنتجات والمخزون</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setScannerOpen(true)} className="border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-400">
            <Camera className="w-4 h-4 ml-1" /> 📷 مسح باركود
          </Button>
          <Button variant="outline" onClick={() => setSearchOpen(true)} className="border-cyan-500/40 hover:bg-cyan-500/10 text-cyan-400">
            <Search className="w-4 h-4 ml-1" /> بحث ذكي بالتوافقية
          </Button>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40 bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفئات</SelectItem>
              <SelectItem value="phones">الهواتف</SelectItem>
              <SelectItem value="accessories">الإكسسوارات</SelectItem>
              <SelectItem value="spare_parts">قطع الغيار</SelectItem>
              <SelectItem value="cameras">الكاميرات</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={startNew} className="btn-gold"><Plus className="w-4 h-4 ml-1" /> منتج جديد</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map(renderProductCard)}
      </div>

      {/* ============ SMART SEARCH DIALOG ============ */}
      <Dialog open={searchOpen} onOpenChange={(v) => { setSearchOpen(v); if (!v) setSearchResults(null); }}>
        <DialogContent className="glass-strong border-cyan-500/40 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 flex items-center gap-2"><Search className="w-5 h-5" /> البحث الذكي بالتوافقية</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div className="col-span-2 md:col-span-3">
                <Label className="text-xs">كلمة البحث (اسم، SKU، باركود، موديل)</Label>
                <Input value={searchQuery.q} onChange={e => setSearchQuery({ ...searchQuery, q: e.target.value })} placeholder="مثال: كفر، شاشة، iPhone 14" className="bg-input/30 border-cyan-500/30" />
              </div>
              <div>
                <Label className="text-xs">🔗 الجهاز المتوافق</Label>
                <Input list="all-devices" value={searchQuery.device} onChange={e => setSearchQuery({ ...searchQuery, device: e.target.value })} placeholder="iPhone 14 Pro Max" className="bg-input/30 border-cyan-500/30" />
                <datalist id="all-devices">{allDevices.map(d => <option key={d} value={d} />)}</datalist>
              </div>
              <div>
                <Label className="text-xs">الأصل</Label>
                <Select value={searchQuery.origin || 'any'} onValueChange={v => setSearchQuery({ ...searchQuery, origin: v === 'any' ? '' : v })}>
                  <SelectTrigger className="bg-input/30 border-cyan-500/30"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">كل الأصول</SelectItem>
                    <SelectItem value="original">✨ أصلي</SelectItem>
                    <SelectItem value="oem">🔧 OEM</SelectItem>
                    <SelectItem value="commercial">🛒 تجاري</SelectItem>
                    <SelectItem value="used">♻️ مستعمل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">النوع</Label>
                <Select value={searchQuery.type || 'any'} onValueChange={v => setSearchQuery({ ...searchQuery, type: v === 'any' ? '' : v })}>
                  <SelectTrigger className="bg-input/30 border-cyan-500/30"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">كل الأنواع</SelectItem>
                    <SelectItem value="screen">📱 شاشة</SelectItem>
                    <SelectItem value="cover">🛡️ كفر</SelectItem>
                    <SelectItem value="sticker">🎨 ستيكر</SelectItem>
                    <SelectItem value="battery">🔋 بطارية</SelectItem>
                    <SelectItem value="cable">🔌 كيبل</SelectItem>
                    <SelectItem value="charger">⚡ شاحن</SelectItem>
                    <SelectItem value="accessory">🎧 إكسسوار</SelectItem>
                    <SelectItem value="spare">⚙️ قطعة غيار</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">الشركة</Label>
                <Input value={searchQuery.brand} onChange={e => setSearchQuery({ ...searchQuery, brand: e.target.value })} placeholder="Apple / Samsung" className="bg-input/30 border-cyan-500/30" />
              </div>
              <div className="col-span-2 md:col-span-3 flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={searchQuery.inStock} onChange={e => setSearchQuery({ ...searchQuery, inStock: e.target.checked })} className="w-4 h-4 accent-cyan-500" /> ✅ المتوفر فقط</label>
                <Button onClick={runSmartSearch} className="btn-neon flex-1"><Search className="w-4 h-4 ml-2" /> بحث</Button>
                <Button variant="ghost" onClick={() => { setSearchQuery({ q: '', device: '', origin: '', type: '', brand: '', inStock: false }); setSearchResults(null); }}>🔄 مسح</Button>
              </div>
            </div>

            {searchResults && (
              <div className="space-y-3 mt-3">
                {searchResults.exact?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-2">✅ مطابق تماماً ({searchResults.exact.length})</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{searchResults.exact.map(renderProductCard)}</div>
                  </div>
                )}
                {searchResults.compatible?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-cyan-400 mb-2 flex items-center gap-2">🔗 متوافق ({searchResults.compatible.length})</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{searchResults.compatible.map(renderProductCard)}</div>
                  </div>
                )}
                {searchResults.alternatives?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-amber-400 mb-2 flex items-center gap-2">💡 بدائل مقترحة ({searchResults.alternatives.length})</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{searchResults.alternatives.map(renderProductCard)}</div>
                  </div>
                )}
                {searchResults.total === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto opacity-30 mb-2" />
                    <p>لا توجد نتائج. جرب توسيع البحث.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ NEW/EDIT PRODUCT DIALOG (3 TABS) ============ */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-gold/40 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="gold-text">{editing ? 'تعديل المنتج' : 'منتج جديد'}</DialogTitle></DialogHeader>
          <Tabs value={dialogTab} onValueChange={setDialogTab}>
            <TabsList className="bg-input/30 border border-gold-soft w-full">
              <TabsTrigger value="basic" className="flex-1">📝 المعلومات</TabsTrigger>
              <TabsTrigger value="pricing" className="flex-1">💰 السعر والمخزون</TabsTrigger>
              <TabsTrigger value="compatibility" className="flex-1">🔗 التوافقية</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>اسم المنتج</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-input/30 border-gold/20" /></div>
                <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className="bg-input/30 border-gold/20 font-mono text-xs" /></div>
                <div><Label>الباركود</Label><Input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} className="bg-input/30 border-gold/20 font-mono text-xs" /></div>
                <div>
                  <Label>الفئة</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phones">📱 الهواتف</SelectItem>
                      <SelectItem value="accessories">🎧 الإكسسوارات</SelectItem>
                      <SelectItem value="spare_parts">🔧 قطع الغيار</SelectItem>
                      <SelectItem value="cameras">📹 الكاميرات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>النوع التفصيلي</Label>
                  <Select value={form.productType} onValueChange={v => setForm({ ...form, productType: v })}>
                    <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">📦 عام</SelectItem>
                      <SelectItem value="screen">📱 شاشة</SelectItem>
                      <SelectItem value="cover">🛡️ كفر / غطاء</SelectItem>
                      <SelectItem value="sticker">🎨 ستيكر</SelectItem>
                      <SelectItem value="battery">🔋 بطارية</SelectItem>
                      <SelectItem value="cable">🔌 كيبل</SelectItem>
                      <SelectItem value="charger">⚡ شاحن</SelectItem>
                      <SelectItem value="accessory">🎧 إكسسوار</SelectItem>
                      <SelectItem value="spare">⚙️ قطعة غيار</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الأصل</Label>
                  <Select value={form.origin} onValueChange={v => setForm({ ...form, origin: v })}>
                    <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="original">✨ أصلي</SelectItem>
                      <SelectItem value="oem">🔧 OEM (مصنّع متفرع)</SelectItem>
                      <SelectItem value="commercial">🛒 تجاري</SelectItem>
                      <SelectItem value="used">♻️ مستعمل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>الشركة</Label><Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="Apple / Samsung" className="bg-input/30 border-gold/20" /></div>
                <div><Label>الموديل</Label><Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="iPhone 14 Pro Max" className="bg-input/30 border-gold/20" /></div>
                <div><Label>اللون</Label><Input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} placeholder="أسود / ذهبي" className="bg-input/30 border-gold/20" /></div>
                <div className="col-span-2"><Label>الأيقونة (Emoji)</Label><Input value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} placeholder="📱" className="bg-input/30 border-gold/20 text-2xl" /></div>
                <div className="col-span-2"><Label>الوصف</Label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full bg-input/30 border border-gold/20 rounded-md p-2 text-xs" /></div>
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>سعر البيع</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="bg-input/30 border-gold/20" /></div>
                <div><Label>سعر التكلفة</Label><Input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} className="bg-input/30 border-gold/20" /></div>
                <div><Label>الكمية المتوفرة</Label><Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="bg-input/30 border-gold/20" /></div>
                <div><Label>تنبيه نقص المخزون</Label><Input type="number" value={form.lowStockAlert} onChange={e => setForm({ ...form, lowStockAlert: e.target.value })} className="bg-input/30 border-gold/20" /></div>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/30 space-y-2">
                <p className="font-bold text-amber-400 text-xs flex items-center gap-2">📍 الموقع داخل المخزن</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div><Label className="text-[10px]">الفرع</Label><Input value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} placeholder="بغداد" className="bg-input/30 border-amber-500/30 h-8 text-xs" /></div>
                  <div><Label className="text-[10px]">المخزن</Label><Input value={form.warehouse} onChange={e => setForm({ ...form, warehouse: e.target.value })} placeholder="الرئيسي" className="bg-input/30 border-amber-500/30 h-8 text-xs" /></div>
                  <div><Label className="text-[10px]">الطابق</Label><Input value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })} placeholder="2" className="bg-input/30 border-amber-500/30 h-8 text-xs" /></div>
                  <div><Label className="text-[10px]">الرف</Label><Input value={form.shelf} onChange={e => setForm({ ...form, shelf: e.target.value })} placeholder="A-12" className="bg-input/30 border-amber-500/30 h-8 text-xs" /></div>
                  <div><Label className="text-[10px]">الخزانة</Label><Input value={form.cabinet} onChange={e => setForm({ ...form, cabinet: e.target.value })} placeholder="C" className="bg-input/30 border-amber-500/30 h-8 text-xs" /></div>
                </div>
                {(form.branch || form.shelf || form.cabinet) && (
                  <p className="text-[10px] text-amber-300 font-mono">📌 الموقع الكامل: {[form.branch, form.warehouse, form.floor && `طابق ${form.floor}`, form.shelf && `رف ${form.shelf}`, form.cabinet && `خزانة ${form.cabinet}`].filter(Boolean).join(' · ')}</p>
                )}
              </div>
              <CustomFieldsGrid entity="products" customFields={form.customFields} onUpdate={(cf) => setForm({ ...form, customFields: cf })} columns={2} />
            </TabsContent>

            <TabsContent value="compatibility" className="space-y-3 pt-3">
              <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/30 space-y-2">
                <p className="font-bold text-cyan-400 text-sm flex items-center gap-2">🔗 الأجهزة المتوافقة</p>
                <p className="text-[10px] text-cyan-300/70">أضف كل الأجهزة التي تتوافق معها هذه القطعة. مثال: ستيكر iPhone 14 Pro Max يتوافق مع iPhone 14 Pro و iPhone 13 Pro Max.</p>
                <div className="flex gap-2">
                  <Input
                    list="device-suggestions"
                    value={newDevice}
                    onChange={e => setNewDevice(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDevice())}
                    placeholder="iPhone 14 Pro Max"
                    className="bg-input/30 border-cyan-500/30 flex-1"
                  />
                  <datalist id="device-suggestions">{allDevices.map(d => <option key={d} value={d} />)}</datalist>
                  <Button onClick={addDevice} className="btn-neon">+ إضافة</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.compatibleDevices.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">لا توجد أجهزة مضافة بعد.</p>
                  ) : form.compatibleDevices.map(d => (
                    <Badge key={d} className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 cursor-pointer hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30" onClick={() => removeDevice(d)}>
                      {d} <span className="mr-1 opacity-70">×</span>
                    </Badge>
                  ))}
                </div>
              </div>
              {form.compatibleDevices.length > 0 && (
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/30 text-[10px] text-emerald-400">
                  ✅ هذه القطعة ستظهر في البحث عند البحث عن: {form.compatibleDevices.slice(0, 5).join(' · ')}{form.compatibleDevices.length > 5 ? ` و ${form.compatibleDevices.length - 5} جهاز آخر` : ''}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter><Button onClick={save} className="btn-gold w-full">💾 حفظ المنتج</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ BARCODE SCANNER ============ */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleBarcodeDetected}
        title="📷 مسح باركود المنتج"
      />
    </div>
  );
}
