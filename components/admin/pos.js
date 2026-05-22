'use client';
import BarcodeScanner from '@/components/barcode-scanner';
import { ScrollArea } from '@/components/ui/scroll-area';
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

export default function POS() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [surcharge, setSurcharge] = useState(0);
  const [surchargeReason, setSurchargeReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customer, setCustomer] = useState('');
  const [showInvoice, setShowInvoice] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [posCfg, setPosCfg] = useState({});
  const [overrideOpen, setOverrideOpen] = useState(null); // { error, payload }
  const [adminPin, setAdminPin] = useState('');
  const barcodeRef = useRef(null);

  useEffect(() => {
    api('products').then(setArr(setProducts));
    api('settings').then(s => setPosCfg(s?.pos || {}));
  }, []);

  const filtered = useMemo(() =>
    products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.includes(search) || p.barcode?.includes(search))
  , [products, search]);

  const subtotal = cart.reduce((s, x) => s + x.price * x.quantity, 0);
  const total = Math.max(0, subtotal - Number(discount || 0) + Number(surcharge || 0));

  const addToCart = (p) => {
    if (p.stock <= 0) { toast.error('المنتج نفد من المخزون'); return; }
    setCart(prev => {
      const ex = prev.find(x => x.id === p.id);
      if (ex) return prev.map(x => x.id === p.id ? { ...x, quantity: x.quantity + 1 } : x);
      return [...prev, { ...p, quantity: 1 }];
    });
  };

  const checkout = async (managerOverride = false) => {
    if (cart.length === 0) { toast.error('السلة فارغة'); return; }
    const payload = {
      items: cart,
      discount: Number(discount), discountReason,
      surcharge: Number(surcharge), surchargeReason,
      paymentMethod,
      customer: customer || 'زبون نقدي',
      managerOverride,
    };
    const r = await api('pos/checkout', { method: 'POST', body: JSON.stringify(payload) });
    if (r.error) {
      // Detect "needs manager approval" error and open override dialog
      if (typeof r.error === 'string' && (r.error.includes('موافقة المدير') || r.error.includes('يتجاوز الحد'))) {
        setOverrideOpen({ error: r.error });
        return;
      }
      toast.error(r.error);
      return;
    }
    toast.success('تم إصدار الفاتورة بنجاح');
    setShowInvoice(r);
    setCart([]); setDiscount(0); setDiscountReason(''); setSurcharge(0); setSurchargeReason(''); setCustomer('');
    setOverrideOpen(null); setAdminPin('');
    api('products').then(setArr(setProducts));
  };

  const tryManagerOverride = async () => {
    if (!adminPin) { toast.error('أدخل كلمة سر المدير'); return; }
    const r = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: adminPin }),
    });
    const d = await r.json();
    if (!d?.success) { toast.error('كلمة سر المدير غير صحيحة'); return; }
    await checkout(true);
  };

  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    const code = barcodeRef.current.value.trim();
    if (!code) return;
    const p = await api(`products/barcode/${code}`);
    if (p.error) toast.error(p.error);
    else { addToCart(p); barcodeRef.current.value = ''; }
  };

  // ============ CAMERA SCANNER → ADD TO CART ============
  const handleScannerDetected = async (code) => {
    setScannerOpen(false);
    const p = await api(`products/barcode/${encodeURIComponent(code)}`);
    if (p?.error || !p?.id) {
      toast.error(`❌ المنتج بالباركود ${code} غير موجود`);
      return;
    }
    addToCart(p);
    toast.success(`✅ تمت إضافة "${p.name}" للسلة`);
    try { sounds.success(); } catch {}
  };

  return (
    <div className="max-w-[1600px] mx-auto grid lg:grid-cols-3 gap-4 h-full">
      {/* Products */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="glass-strong border-gold-soft">
          <CardContent className="pt-6 space-y-3">
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <ScanLine className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gold" />
                <Input ref={barcodeRef} placeholder="امسح الباركود أو أدخله..." className="pr-10 bg-input/30 border-gold/20" autoFocus />
              </div>
              <Button type="button" onClick={() => setScannerOpen(true)} className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40" title="مسح بالكاميرا">
                <Camera className="w-4 h-4" />
              </Button>
              <Button type="submit" className="btn-neon">إضافة</Button>
            </form>
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو SKU..." className="pr-10 bg-input/30 border-gold/20" />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map(p => (
            <div key={p.id} onClick={() => addToCart(p)} className="glass-card rounded-xl p-3 cursor-pointer hover:border-gold/50 hover:scale-105 transition-all">
              <div className="text-4xl text-center mb-2">{p.image || '📦'}</div>
              <p className="text-xs font-semibold truncate">{p.name}</p>
              <p className="text-[10px] text-muted-foreground">{p.sku}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-bold text-gold">{fmt(p.price)}</span>
                <Badge variant={p.stock <= p.lowStockAlert ? 'destructive' : 'secondary'} className="text-[9px]">{p.stock}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart */}
      <Card className="glass-strong border-gold-soft flex flex-col max-h-[calc(100vh-150px)]">
        <CardHeader className="pb-3 border-b border-gold-soft">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-gold" /> السلة</span>
            <Badge className="bg-gold text-background">{cart.length}</Badge>
          </CardTitle>
        </CardHeader>
        <ScrollArea className="flex-1 px-4">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">السلة فارغة - اضغط على منتج للإضافة</p>
            </div>
          ) : (
            <div className="space-y-2 py-3">
              {cart.map((it, i) => (
                <div key={i} className="glass-card rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{it.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCart(c => c.filter((_, idx) => idx !== i))}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setCart(c => c.map((x, idx) => idx === i ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))}>-</Button>
                      <span className="w-8 text-center text-sm">{it.quantity}</span>
                      <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setCart(c => c.map((x, idx) => idx === i ? { ...x, quantity: x.quantity + 1 } : x))}>+</Button>
                    </div>
                    <span className="text-sm font-bold text-gold">{fmt(it.price * it.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t border-gold-soft p-4 space-y-3">
          <Input placeholder="اسم الزبون (اختياري)" value={customer} onChange={e => setCustomer(e.target.value)} className="bg-input/30 border-gold/20" />
          {/* Discount + Surcharge */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-rose-300">💸 خصم</Label>
              <Input type="number" min="0" placeholder="0" value={discount} onChange={e => setDiscount(e.target.value)} className="bg-input/30 border-rose-500/30 h-9" />
              {Number(discount) > 0 && (posCfg.requireDiscountReason !== false) && (
                <Input placeholder="سبب الخصم *" value={discountReason} onChange={e => setDiscountReason(e.target.value)} className="bg-input/30 border-rose-500/30 h-8 text-xs" />
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-emerald-300">💰 زيادة</Label>
              <Input type="number" min="0" placeholder="0" value={surcharge} onChange={e => setSurcharge(e.target.value)} className="bg-input/30 border-emerald-500/30 h-9" />
              {Number(surcharge) > 0 && (posCfg.requireIncreaseReason !== false) && (
                <Input placeholder="سبب الزيادة *" value={surchargeReason} onChange={e => setSurchargeReason(e.target.value)} className="bg-input/30 border-emerald-500/30 h-8 text-xs" />
              )}
            </div>
          </div>
          {/* Limit hints */}
          {(Number(discount) > 0 || Number(surcharge) > 0) && (
            <div className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded p-2 leading-relaxed">
              {posCfg.maxDiscountAmount > 0 && <div>الحد الأقصى للخصم: {posCfg.maxDiscountAmount.toLocaleString('en-US')} د.ع{posCfg.maxDiscountPercent > 0 && ` أو ${posCfg.maxDiscountPercent}%`}</div>}
              {posCfg.maxIncreaseAmount > 0 && <div>الحد الأقصى للزيادة: {posCfg.maxIncreaseAmount.toLocaleString('en-US')} د.ع{posCfg.maxIncreasePercent > 0 && ` أو ${posCfg.maxIncreasePercent}%`}</div>}
            </div>
          )}
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">نقد</SelectItem>
              <SelectItem value="card">بطاقة</SelectItem>
              <SelectItem value="transfer">حوالة</SelectItem>
              <SelectItem value="debt">آجل</SelectItem>
            </SelectContent>
          </Select>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>المجموع الفرعي:</span><span>{fmt(subtotal)}</span></div>
            {Number(discount) > 0 && <div className="flex justify-between text-rose-400"><span>الخصم:</span><span>-{fmt(discount || 0)}</span></div>}
            {Number(surcharge) > 0 && <div className="flex justify-between text-emerald-400"><span>الزيادة:</span><span>+{fmt(surcharge || 0)}</span></div>}
            <div className="flex justify-between text-lg font-bold gold-text"><span>الإجمالي:</span><span>{fmtCurrency(total)}</span></div>
          </div>
          <Button onClick={() => checkout(false)} className="w-full btn-gold h-12 text-base">
            <Receipt className="w-4 h-4 ml-2" /> إصدار الفاتورة
          </Button>
        </div>
      </Card>

      {/* Manager Override Dialog */}
      <Dialog open={!!overrideOpen} onOpenChange={(v) => { if (!v) { setOverrideOpen(null); setAdminPin(''); } }}>
        <DialogContent className="glass-strong border-amber-500/40 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2">⚠️ يحتاج موافقة المدير</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded p-2 text-xs">{overrideOpen?.error}</p>
            <div>
              <Label className="text-xs">كلمة سر المدير</Label>
              <Input
                type="password" value={adminPin}
                onChange={e => setAdminPin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && tryManagerOverride()}
                className="bg-input/30 border-amber-500/40 font-mono" dir="ltr"
                placeholder="••••"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setOverrideOpen(null); setAdminPin(''); }}>إلغاء</Button>
              <Button onClick={tryManagerOverride} className="flex-1 btn-gold">تأكيد ومتابعة</Button>
            </div>
            <p className="text-[10px] text-muted-foreground">سيُسجَّل هذا التعديل في سجل التعديلات مع علامة "موافقة مدير"</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <Dialog open={!!showInvoice} onOpenChange={() => setShowInvoice(null)}>
        <DialogContent className="glass-strong border-gold/40 max-w-md">
          <DialogHeader><DialogTitle className="gold-text text-center text-xl">🧾 فاتورة مبيعات</DialogTitle></DialogHeader>
          {showInvoice && (
            <div className="space-y-3 font-mono text-sm">
              <div className="text-center border-b border-gold-soft pb-2">
                <p className="text-lg font-bold gold-text">مركز الغزلان</p>
                <p className="text-xs text-muted-foreground">رقم الفاتورة: <span className="font-bold">{showInvoice.invoiceNumber}</span></p>
                <p className="text-xs text-muted-foreground">{new Date(showInvoice.createdAt).toLocaleString('ar-IQ')}</p>
                {showInvoice.cashierName && <p className="text-xs text-muted-foreground">الكاشير: {showInvoice.cashierName}</p>}
              </div>
              <div className="text-xs">👤 الزبون: <span className="font-bold">{showInvoice.customer}</span></div>
              <div className="border-t border-b border-gold-soft py-2 space-y-1">
                {showInvoice.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span>{it.name} × {it.quantity}</span>
                    <span className="font-bold">{fmt(it.price * it.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>المجموع:</span><span>{fmt(showInvoice.subtotal)}</span></div>
                {Number(showInvoice.discount) > 0 && <div className="flex justify-between text-red-400"><span>الخصم:</span><span>-{fmt(showInvoice.discount)}</span></div>}
                <div className="flex justify-between text-base font-bold gold-text border-t border-gold-soft pt-1"><span>الإجمالي:</span><span>{fmtCurrency(showInvoice.total)}</span></div>
                <div className="flex justify-between text-[10px] text-muted-foreground"><span>طريقة الدفع:</span><span>{showInvoice.paymentMethod || 'نقد'}</span></div>
              </div>
              <p className="text-center text-xs text-muted-foreground">شكراً لزيارتكم 🙏</p>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => printPOSInvoice(showInvoice)} className="btn-neon"><Printer className="w-4 h-4 ml-1" /> طباعة (A4)</Button>
                <Button onClick={() => printPOSReceipt(showInvoice)} className="btn-gold"><Receipt className="w-4 h-4 ml-1" /> وصل حراري 80mm</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ BARCODE SCANNER ============ */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleScannerDetected}
        title="📷 مسح المنتج للسلة"
      />
    </div>
  );
}
