'use client';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast, Toaster } from 'sonner';
import { ShoppingCart, Plus, Minus, X, Search, Package, Phone, MapPin, CreditCard, CheckCircle2, Camera, Filter, SlidersHorizontal, Sparkles } from 'lucide-react';
import BarcodeScanner from '@/components/barcode-scanner';

const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const api = async (path, opts = {}) => {
  const r = await fetch(`/api/${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  return r.json();
};

const ORIGIN_BADGE = {
  original: { label: '✨ أصلي', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  oem: { label: '🔧 OEM', cls: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
  commercial: { label: '🛒 تجاري', cls: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40' },
  used: { label: '♻️ مستعمل', cls: 'bg-violet-500/20 text-violet-300 border-violet-500/40' },
};
const PRODUCT_TYPE_LABEL = {
  screen: '📱 شاشة', cover: '🛡️ كفر', sticker: '🎨 ستيكر', battery: '🔋 بطارية',
  cable: '🔌 كيبل', charger: '⚡ شاحن', accessory: '🎧 إكسسوار', spare: '⚙️ قطعة غيار', general: '📦 عام',
};

function Store() {
  const [products, setProducts] = useState([]);
  const [allDevices, setAllDevices] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    category: 'all', device: '', origin: '', productType: '', brand: '', color: '',
    inStockOnly: false, minPrice: '', maxPrice: '', sort: 'newest',
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [productDetail, setProductDetail] = useState(null);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerAddress: '', paymentMethod: 'cod', notes: '' });

  useEffect(() => {
    api('products').then(p => { if (Array.isArray(p)) setProducts(p); });
    api('products/devices').then(d => { if (Array.isArray(d)) setAllDevices(d); });
    try {
      const saved = localStorage.getItem('store_cart');
      if (saved) setCart(JSON.parse(saved));
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('store_cart', JSON.stringify(cart)); } catch {} }, [cart]);

  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean))), [products]);
  const brands = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(Boolean))).sort(), [products]);
  const colors = useMemo(() => Array.from(new Set(products.map(p => p.color).filter(Boolean))).sort(), [products]);

  const norm = (s) => String(s || '').toLowerCase();
  const filtered = useMemo(() => {
    let list = products.filter(p => {
      if (filters.category !== 'all' && p.category !== filters.category) return false;
      if (filters.origin && p.origin !== filters.origin) return false;
      if (filters.productType && p.productType !== filters.productType) return false;
      if (filters.brand && norm(p.brand) !== norm(filters.brand)) return false;
      if (filters.color && norm(p.color) !== norm(filters.color)) return false;
      if (filters.inStockOnly && Number(p.stock || 0) <= 0) return false;
      if (filters.minPrice && Number(p.price || 0) < Number(filters.minPrice)) return false;
      if (filters.maxPrice && Number(p.price || 0) > Number(filters.maxPrice)) return false;
      if (filters.device) {
        const d = norm(filters.device);
        const compat = (p.compatibleDevices || []).map(norm);
        const matches = compat.some(c => c.includes(d) || d.includes(c)) || norm(p.model).includes(d) || norm(p.name).includes(d);
        if (!matches) return false;
      }
      if (search) {
        const s = norm(search);
        const inText = norm(p.name).includes(s) || norm(p.brand).includes(s) || norm(p.model).includes(s) ||
                       norm(p.sku).includes(s) || norm(p.barcode).includes(s) ||
                       (p.compatibleDevices || []).some(d => norm(d).includes(s));
        if (!inText) return false;
      }
      return true;
    });
    // Sort
    if (filters.sort === 'price_asc') list = [...list].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    else if (filters.sort === 'price_desc') list = [...list].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    else if (filters.sort === 'name') list = [...list].sort((a, b) => norm(a.name).localeCompare(norm(b.name)));
    return list;
  }, [products, filters, search]);

  const activeFiltersCount = Object.entries(filters).filter(([k, v]) => v && v !== 'all' && v !== 'newest' && v !== true).length;

  const addToCart = (p) => {
    setCart(prev => {
      const ex = prev.find(x => x.id === p.id);
      if (ex) return prev.map(x => x.id === p.id ? { ...x, quantity: x.quantity + 1 } : x);
      return [...prev, { id: p.id, name: p.name, price: p.price, quantity: 1, image: p.image }];
    });
    toast.success(`✅ تمت إضافة ${p.name}`);
  };
  const changeQty = (id, delta) => {
    setCart(prev => prev.map(x => x.id === id ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x).filter(x => x.quantity > 0));
  };
  const removeItem = (id) => setCart(prev => prev.filter(x => x.id !== id));

  const subtotal = cart.reduce((s, x) => s + x.price * x.quantity, 0);
  const shipping = subtotal >= 50000 ? 0 : 5000;
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [validating, setValidating] = useState(false);
  const couponDiscount = appliedCoupon?.discount || 0;
  const total = Math.max(0, subtotal + shipping - couponDiscount);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidating(true);
    try {
      const r = await api('coupons/validate', { method: 'POST', body: JSON.stringify({ code: couponCode.trim(), orderTotal: subtotal }) });
      if (r?.valid) {
        setAppliedCoupon({ code: r.coupon.code, discount: r.discount, description: r.coupon.description });
        toast.success(`🎁 تم تطبيق الكوبون: خصم ${r.discount.toLocaleString('en-US')} د.ع`);
      } else {
        toast.error(r?.error || 'كوبون غير صالح');
        setAppliedCoupon(null);
      }
    } finally { setValidating(false); }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    toast.info('تم إزالة الكوبون');
  };

  const placeOrder = async () => {
    if (!form.customerName || !form.customerPhone) { toast.error('الاسم ورقم الهاتف مطلوبان'); return; }
    if (cart.length === 0) { toast.error('السلة فارغة'); return; }
    const payload = { ...form, items: cart };
    if (appliedCoupon) payload.couponCode = appliedCoupon.code;
    const r = await api('orders', { method: 'POST', body: JSON.stringify(payload) });
    if (r.error) toast.error(r.error);
    else {
      setOrderSuccess(r);
      setCart([]); setCheckoutOpen(false); setCartOpen(false);
      setForm({ customerName: '', customerPhone: '', customerAddress: '', paymentMethod: 'cod', notes: '' });
      setAppliedCoupon(null); setCouponCode('');
      try { localStorage.removeItem('store_cart'); } catch {}
    }
  };

  const handleScannerDetect = async (code) => {
    setScannerOpen(false);
    const p = await api(`products/barcode/${encodeURIComponent(code)}`);
    if (p?.error || !p?.id) {
      toast.error(`المنتج بالباركود ${code} غير موجود في المتجر`);
      return;
    }
    addToCart(p);
  };

  const resetFilters = () => setFilters({ category: 'all', device: '', origin: '', productType: '', brand: '', color: '', inStockOnly: true, minPrice: '', maxPrice: '', sort: 'newest' });

  return (
    <div className="min-h-screen bg-background grid-pattern" dir="rtl">
      {/* Header */}
      <header className="glass-strong border-b border-gold-soft sticky top-0 z-30 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/logo-icon.png" alt="مركز الغزلان" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="text-lg font-black gold-text leading-tight">متجر الغزلان</h1>
            <p className="text-[10px] text-muted-foreground">إلكترونيات · إكسسوارات · قطع غيار · صيانة</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setScannerOpen(true)} variant="outline" size="icon" className="border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-400" title="مسح باركود">
            <Camera className="w-4 h-4" />
          </Button>
          <Button onClick={() => setCartOpen(true)} className="btn-gold relative">
            <ShoppingCart className="w-4 h-4 ml-1" /> السلة
            {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">{cart.reduce((s, x) => s + x.quantity, 0)}</span>}
          </Button>
        </div>
      </header>

      <main className="p-4 max-w-7xl mx-auto space-y-4">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-gold/10 via-transparent to-cyan-500/10 border border-gold/40 p-6 text-center">
          <h2 className="text-2xl md:text-3xl font-black gold-text">🛒 تسوّق بسهولة - توصيل سريع</h2>
          <p className="text-sm text-muted-foreground mt-2">شحن مجاني للطلبات فوق 50,000 د.ع · دفع عند الاستلام · ضمان الأصلية</p>
          <div className="flex flex-wrap gap-2 justify-center mt-3 text-[10px]">
            <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">✨ أصلي مضمون</Badge>
            <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30">🔗 توافقية متعددة</Badge>
            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">📷 ابحث بالكاميرا</Badge>
            <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/30">🚚 توصيل خلال 24 ساعة</Badge>
          </div>
        </div>

        {/* Search + Quick Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث: اسم، باركود، موديل..." className="pr-10 bg-input/30 border-gold/20" />
          </div>
          <div className="relative w-48">
            <Sparkles className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400" />
            <Input list="device-list" value={filters.device} onChange={e => setFilters(f => ({ ...f, device: e.target.value }))} placeholder="🔗 الجهاز المتوافق" className="pr-10 bg-input/30 border-cyan-500/30" />
            <datalist id="device-list">{allDevices.map(d => <option key={d} value={d} />)}</datalist>
          </div>
          <Select value={filters.sort} onValueChange={v => setFilters(f => ({ ...f, sort: v }))}>
            <SelectTrigger className="w-44 bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">⏰ الأحدث</SelectItem>
              <SelectItem value="price_asc">💰 السعر تصاعدياً</SelectItem>
              <SelectItem value="price_desc">💎 السعر تنازلياً</SelectItem>
              <SelectItem value="name">🔠 الاسم</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setFiltersOpen(v => !v)} variant="outline" className="border-violet-500/40 hover:bg-violet-500/10 text-violet-400 relative">
            <SlidersHorizontal className="w-4 h-4 ml-1" /> فلاتر
            {activeFiltersCount > 0 && <Badge className="absolute -top-2 -right-2 bg-violet-500 text-white text-[9px] h-5 min-w-[20px] px-1">{activeFiltersCount}</Badge>}
          </Button>
        </div>

        {/* Advanced Filters Panel */}
        {filtersOpen && (
          <div className="p-4 rounded-xl border border-violet-500/30 bg-violet-500/5 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-[10px] text-violet-300">القسم</Label>
                <Select value={filters.category} onValueChange={v => setFilters(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-input/30 border-violet-500/30 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأقسام</SelectItem>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-violet-300">النوع التفصيلي</Label>
                <Select value={filters.productType || 'all'} onValueChange={v => setFilters(f => ({ ...f, productType: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="bg-input/30 border-violet-500/30 h-9 text-xs"><SelectValue placeholder="الكل" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {Object.entries(PRODUCT_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-violet-300">الأصل</Label>
                <Select value={filters.origin || 'all'} onValueChange={v => setFilters(f => ({ ...f, origin: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="bg-input/30 border-violet-500/30 h-9 text-xs"><SelectValue placeholder="الكل" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {Object.entries(ORIGIN_BADGE).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-violet-300">الشركة</Label>
                <Select value={filters.brand || 'all'} onValueChange={v => setFilters(f => ({ ...f, brand: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="bg-input/30 border-violet-500/30 h-9 text-xs"><SelectValue placeholder="الكل" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-violet-300">اللون</Label>
                <Select value={filters.color || 'all'} onValueChange={v => setFilters(f => ({ ...f, color: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="bg-input/30 border-violet-500/30 h-9 text-xs"><SelectValue placeholder="الكل" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {colors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-violet-300">السعر من</Label>
                <Input type="number" value={filters.minPrice} onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))} className="bg-input/30 border-violet-500/30 h-9 text-xs" placeholder="0" />
              </div>
              <div>
                <Label className="text-[10px] text-violet-300">السعر إلى</Label>
                <Input type="number" value={filters.maxPrice} onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))} className="bg-input/30 border-violet-500/30 h-9 text-xs" placeholder="∞" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={filters.inStockOnly} onChange={e => setFilters(f => ({ ...f, inStockOnly: e.target.checked }))} className="w-4 h-4 accent-violet-500" />
                  ✅ المتوفر فقط
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={resetFilters} variant="ghost" size="sm" className="text-violet-400">🔄 إعادة تعيين</Button>
              <span className="text-[10px] text-muted-foreground self-center">عدد النتائج: <strong className="text-violet-300">{filtered.length}</strong></span>
            </div>
          </div>
        )}

        {/* Products grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(p => {
            const ob = ORIGIN_BADGE[p.origin] || ORIGIN_BADGE.commercial;
            return (
              <Card key={p.id} className="glass-card border-gold-soft hover:border-gold/50 transition-all hover:shadow-gold-glow group cursor-pointer" onClick={() => setProductDetail(p)}>
                <CardContent className="p-3 space-y-2">
                  <div className="aspect-square bg-input/30 rounded-lg flex items-center justify-center overflow-hidden relative">
                    {p.image && p.image.length > 4 ? (
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <span className="text-5xl">{p.image || '📦'}</span>
                    )}
                    {p.origin && (
                      <Badge className={`absolute top-1 right-1 text-[8px] ${ob.cls}`}>{ob.label}</Badge>
                    )}
                    {Number(p.stock) <= 0 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Badge className="bg-red-500/30 text-red-300 border-red-500/50">نفد المخزون</Badge>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold line-clamp-2 min-h-[2.5rem]">{p.name}</h3>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                      {[p.brand, p.model, p.color].filter(Boolean).join(' · ') || p.category || '-'}
                    </p>
                  </div>
                  {p.compatibleDevices?.length > 0 && (
                    <Badge className="text-[9px] bg-cyan-500/15 text-cyan-300 border-cyan-500/30 w-full justify-center truncate">
                      🔗 متوافق مع {p.compatibleDevices.length} جهاز
                    </Badge>
                  )}
                  <div className="flex justify-between items-center">
                    <p className="text-base font-black gold-text">{fmt(p.price)} <span className="text-[9px]">د.ع</span></p>
                    <span className={`text-[9px] ${Number(p.stock || 0) > 5 ? 'text-emerald-400' : Number(p.stock || 0) > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                      {Number(p.stock || 0) > 0 ? `🟢 ${p.stock}` : '🔴 0'}
                    </span>
                  </div>
                  <Button onClick={(e) => { e.stopPropagation(); addToCart(p); }} disabled={!p.stock || p.stock < 1} className="btn-gold w-full h-8 text-xs">
                    <ShoppingCart className="w-3 h-3 ml-1" /> أضف للسلة
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <Package className="w-16 h-16 mx-auto text-gold/30" />
            <p className="text-sm text-muted-foreground">لا توجد منتجات تطابق الفلاتر الحالية</p>
            <Button variant="ghost" onClick={resetFilters} className="text-violet-400">🔄 مسح الفلاتر</Button>
          </div>
        )}
      </main>

      {/* Product Detail Dialog (compatibility view) */}
      <Dialog open={!!productDetail} onOpenChange={() => setProductDetail(null)}>
        <DialogContent className="glass-strong border-gold/40 max-w-lg">
          {productDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="gold-text">{productDetail.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="aspect-video bg-input/30 rounded-lg flex items-center justify-center overflow-hidden">
                  {productDetail.image && productDetail.image.length > 4 ? (
                    <img src={productDetail.image} alt={productDetail.name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-7xl">{productDetail.image || '📦'}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {productDetail.brand && <div className="p-2 rounded bg-input/30 border border-gold-soft"><span className="text-muted-foreground">الشركة:</span> <strong>{productDetail.brand}</strong></div>}
                  {productDetail.model && <div className="p-2 rounded bg-input/30 border border-gold-soft"><span className="text-muted-foreground">الموديل:</span> <strong>{productDetail.model}</strong></div>}
                  {productDetail.color && <div className="p-2 rounded bg-input/30 border border-gold-soft"><span className="text-muted-foreground">اللون:</span> <strong>{productDetail.color}</strong></div>}
                  {productDetail.productType && <div className="p-2 rounded bg-input/30 border border-gold-soft"><span className="text-muted-foreground">النوع:</span> <strong>{PRODUCT_TYPE_LABEL[productDetail.productType] || productDetail.productType}</strong></div>}
                  {productDetail.origin && <div className="p-2 rounded bg-input/30 border border-gold-soft col-span-2 flex items-center justify-between"><span className="text-muted-foreground">الأصل:</span> <Badge className={`text-[10px] ${(ORIGIN_BADGE[productDetail.origin] || ORIGIN_BADGE.commercial).cls}`}>{(ORIGIN_BADGE[productDetail.origin] || ORIGIN_BADGE.commercial).label}</Badge></div>}
                </div>
                {productDetail.compatibleDevices?.length > 0 && (
                  <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/30">
                    <p className="font-bold text-cyan-400 text-xs mb-2">🔗 متوافق مع {productDetail.compatibleDevices.length} جهاز:</p>
                    <div className="flex flex-wrap gap-1">
                      {productDetail.compatibleDevices.map(d => <Badge key={d} className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 text-[10px]">{d}</Badge>)}
                    </div>
                  </div>
                )}
                {productDetail.description && (
                  <div className="p-3 rounded bg-input/30 border border-gold-soft text-xs">
                    <p className="text-muted-foreground mb-1">الوصف:</p>
                    <p>{productDetail.description}</p>
                  </div>
                )}
                <div className="flex items-center justify-between p-3 rounded-lg bg-gold/10 border border-gold/30">
                  <p className="text-xl font-black gold-text">{fmt(productDetail.price)} د.ع</p>
                  <span className={`text-xs ${Number(productDetail.stock || 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {Number(productDetail.stock || 0) > 0 ? `🟢 متوفر (${productDetail.stock} قطعة)` : '🔴 نفد المخزون'}
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { addToCart(productDetail); setProductDetail(null); }} disabled={!productDetail.stock || productDetail.stock < 1} className="btn-gold w-full">
                  <ShoppingCart className="w-4 h-4 ml-1" /> أضف للسلة
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cart */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="glass-strong border-gold/40 max-w-md">
          <DialogHeader><DialogTitle className="gold-text">🛒 سلة التسوق</DialogTitle></DialogHeader>
          {cart.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">السلة فارغة</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {cart.map(it => (
                <div key={it.id} className="flex items-center gap-2 p-2 rounded-lg bg-input/30 border border-gold-soft">
                  <button onClick={() => removeItem(it.id)} className="text-red-400"><X className="w-4 h-4" /></button>
                  <div className="flex-1">
                    <p className="text-xs font-bold">{it.name}</p>
                    <p className="text-[10px] text-muted-foreground">{fmt(it.price)} × {it.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => changeQty(it.id, -1)}><Minus className="w-3 h-3" /></Button>
                    <span className="text-xs w-6 text-center font-bold">{it.quantity}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => changeQty(it.id, 1)}><Plus className="w-3 h-3" /></Button>
                  </div>
                  <span className="text-xs font-bold gold-text w-20 text-left">{fmt(it.price * it.quantity)}</span>
                </div>
              ))}
            </div>
          )}
          {cart.length > 0 && (
            <div className="border-t border-gold-soft pt-3 space-y-2 text-xs">
              {/* Coupon input */}
              <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                {!appliedCoupon ? (
                  <div className="flex gap-2 items-center">
                    <Input
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="🎟️ كود الكوبون"
                      className="bg-input/30 border-emerald-500/30 h-8 text-xs font-mono uppercase"
                    />
                    <Button onClick={applyCoupon} disabled={validating || !couponCode.trim()} size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white h-8">
                      {validating ? '⏳' : 'تطبيق'}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400">🎁</span>
                      <span className="font-mono font-bold text-emerald-400">{appliedCoupon.code}</span>
                      <span className="text-[10px] text-emerald-300">— خصم {fmt(appliedCoupon.discount)} د.ع</span>
                    </div>
                    <Button onClick={removeCoupon} size="sm" variant="ghost" className="h-6 text-red-400 hover:bg-red-500/10 text-[10px]">إزالة</Button>
                  </div>
                )}
              </div>
              <div className="flex justify-between"><span>المجموع الفرعي</span><span className="font-bold">{fmt(subtotal)} د.ع</span></div>
              <div className="flex justify-between"><span>الشحن</span><span className="font-bold">{shipping === 0 ? '🎉 مجاني' : `${fmt(shipping)} د.ع`}</span></div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-400"><span>خصم الكوبون</span><span className="font-bold">- {fmt(couponDiscount)} د.ع</span></div>
              )}
              <div className="flex justify-between text-base font-black gold-text"><span>الإجمالي</span><span>{fmt(total)} د.ع</span></div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCartOpen(false)}>متابعة التسوق</Button>
            <Button onClick={() => setCheckoutOpen(true)} disabled={cart.length === 0} className="btn-gold flex-1">
              <CheckCircle2 className="w-4 h-4 ml-1" /> إتمام الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="glass-strong border-gold/40">
          <DialogHeader><DialogTitle className="gold-text">إتمام الطلب</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">الاسم الكامل *</Label>
              <Input value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} className="bg-input/30 border-gold/20" />
            </div>
            <div>
              <Label className="text-xs">رقم الهاتف *</Label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gold" />
                <Input value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} className="pr-10 bg-input/30 border-gold/20 font-mono" dir="ltr" placeholder="07XXXXXXXXX" />
              </div>
            </div>
            <div>
              <Label className="text-xs">العنوان</Label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute right-3 top-3 text-gold" />
                <Textarea value={form.customerAddress} onChange={e => setForm({ ...form, customerAddress: e.target.value })} className="pr-10 bg-input/30 border-gold/20 h-20" placeholder="المحافظة، المنطقة، أقرب نقطة دالة..." />
              </div>
            </div>
            <div>
              <Label className="text-xs">طريقة الدفع</Label>
              <Select value={form.paymentMethod} onValueChange={v => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cod">💵 الدفع عند الاستلام</SelectItem>
                  <SelectItem value="zaincash">📱 ZainCash</SelectItem>
                  <SelectItem value="fastpay">⚡ FastPay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">ملاحظات</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-input/30 border-gold/20 h-16" />
            </div>
            <div className="p-3 rounded-lg bg-gold/10 border border-gold/30 text-xs">
              <div className="flex justify-between"><span>عدد المنتجات</span><span className="font-bold">{cart.length}</span></div>
              <div className="flex justify-between text-base font-black gold-text mt-1"><span>المبلغ الإجمالي</span><span>{fmt(total)} د.ع</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={placeOrder} className="btn-gold w-full">تأكيد الطلب</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success */}
      <Dialog open={!!orderSuccess} onOpenChange={() => setOrderSuccess(null)}>
        <DialogContent className="glass-strong border-emerald-500/40">
          <DialogHeader><DialogTitle className="text-emerald-400">✅ تم إنشاء طلبك بنجاح</DialogTitle></DialogHeader>
          <div className="space-y-2 text-center py-4">
            <div className="text-6xl">🎉</div>
            <p className="text-sm">رقم الطلب:</p>
            <p className="text-2xl font-black gold-text font-mono">{orderSuccess?.orderNumber}</p>
            <p className="text-xs text-muted-foreground">سيتواصل معك فريقنا قريباً لتأكيد الطلب</p>
            <p className="text-base font-bold mt-3">الإجمالي: <span className="gold-text">{fmt(orderSuccess?.total)} د.ع</span></p>
          </div>
          <DialogFooter>
            <Button onClick={() => setOrderSuccess(null)} className="btn-gold w-full">حسناً</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Camera Scanner */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleScannerDetect}
        title="📷 امسح باركود المنتج"
      />

      <Toaster position="top-center" theme="dark" richColors />
    </div>
  );
}

export default Store;
