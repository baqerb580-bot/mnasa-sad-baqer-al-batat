'use client';
import { useState, useEffect, useMemo } from 'react';
import { api, fmt, fmtCurrency, safeArr } from '@/lib/page-shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Truck, Plus, Trash2, Edit2, Phone, Mail, MapPin, DollarSign, Search,
  ShoppingCart, FileText, Wallet, AlertTriangle, CheckCircle2, Package
} from 'lucide-react';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [pos, setPOs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showSupForm, setShowSupForm] = useState(false);
  const [editingSup, setEditingSup] = useState(null);
  const [showPOForm, setShowPOForm] = useState(false);
  const [showPayForm, setShowPayForm] = useState(null);
  const [statementOf, setStatementOf] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, p, po] = await Promise.all([
        api('suppliers'),
        api('products'),
        api('purchase-orders'),
      ]);
      setSuppliers(safeArr(s));
      setProducts(safeArr(p));
      setPOs(safeArr(po));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(s => (s.name || '').toLowerCase().includes(q) || (s.phone || '').includes(q));
  }, [suppliers, search]);

  const stats = useMemo(() => {
    const totalDebt = suppliers.reduce((sum, s) => sum + Math.max(0, Number(s.balance) || 0), 0);
    const totalCredit = suppliers.reduce((sum, s) => sum + Math.max(0, -(Number(s.balance) || 0)), 0);
    const totalPurchases = pos.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
    return { total: suppliers.length, totalDebt, totalCredit, totalPOs: pos.length, totalPurchases };
  }, [suppliers, pos]);

  const delSupplier = async (s) => {
    if (!confirm(`حذف المورد "${s.name}"؟`)) return;
    const r = await api(`suppliers/${s.id}`, { method: 'DELETE' });
    if (r?.error) toast.error(r.error);
    else { toast.success('🗑️ تم الحذف'); load(); }
  };

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <Card className="glass-strong border-gold/30">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="gold-text flex items-center gap-2 text-2xl">
                <Truck className="w-6 h-6" /> الموردون والمشتريات
              </CardTitle>
              <CardDescription className="mt-1">
                إدارة الموردين، فواتير الشراء، تسديد المستحقات، وكشف الحساب
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowPOForm(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                <ShoppingCart className="w-4 h-4 ml-1" /> فاتورة شراء جديدة
              </Button>
              <Button onClick={() => { setEditingSup(null); setShowSupForm(true); }} className="btn-gold">
                <Plus className="w-4 h-4 ml-1" /> مورد جديد
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="glass-card border-gold-soft"><CardContent className="p-3 text-center">
          <p className="text-xl">🏭</p><p className="text-[10px] text-muted-foreground mt-1">عدد الموردين</p>
          <p className="text-2xl font-bold gold-text">{fmt(stats.total)}</p>
        </CardContent></Card>
        <Card className="glass-card border-red-500/20"><CardContent className="p-3 text-center">
          <p className="text-xl">💸</p><p className="text-[10px] text-muted-foreground mt-1">ديون علينا</p>
          <p className="text-xl font-bold text-red-400">{fmt(stats.totalDebt)}</p>
        </CardContent></Card>
        <Card className="glass-card border-emerald-500/20"><CardContent className="p-3 text-center">
          <p className="text-xl">💚</p><p className="text-[10px] text-muted-foreground mt-1">رصيد لنا</p>
          <p className="text-xl font-bold text-emerald-400">{fmt(stats.totalCredit)}</p>
        </CardContent></Card>
        <Card className="glass-card border-cyan-500/20"><CardContent className="p-3 text-center">
          <p className="text-xl">📋</p><p className="text-[10px] text-muted-foreground mt-1">فواتير شراء</p>
          <p className="text-2xl font-bold text-cyan-400">{fmt(stats.totalPOs)}</p>
        </CardContent></Card>
        <Card className="glass-card border-amber-500/20"><CardContent className="p-3 text-center">
          <p className="text-xl">📊</p><p className="text-[10px] text-muted-foreground mt-1">إجمالي مشتريات</p>
          <p className="text-lg font-bold text-amber-400">{fmt(stats.totalPurchases)}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="suppliers" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-input/30">
          <TabsTrigger value="suppliers">🏭 الموردون ({suppliers.length})</TabsTrigger>
          <TabsTrigger value="pos">📋 فواتير الشراء ({pos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers" className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="بحث عن مورد..." value={search} onChange={e => setSearch(e.target.value)} className="pr-10 bg-input/30 border-gold/20" />
          </div>
          {loading ? <p className="text-center text-muted-foreground py-8">جاري التحميل…</p> :
           filtered.length === 0 ? <p className="text-center text-muted-foreground py-8">لا يوجد موردون</p> :
           filtered.map(s => (
            <Card key={s.id} className={`glass-card ${s.balance > 0 ? 'border-red-500/30' : s.balance < 0 ? 'border-emerald-500/30' : 'border-gold-soft'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center text-2xl">🏭</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold gold-text">{s.name}</h4>
                      {s.category && <Badge variant="outline" className="text-[9px]">{s.category}</Badge>}
                      {!s.active && <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/40 text-[9px]">موقوف</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1 flex-wrap">
                      {s.phone && <span><Phone className="w-2.5 h-2.5 inline" /> <span dir="ltr">{s.phone}</span></span>}
                      {s.contactPerson && <span>👤 {s.contactPerson}</span>}
                      {s.address && <span><MapPin className="w-2.5 h-2.5 inline" /> {s.address}</span>}
                      {s.paymentTerms && <span><Wallet className="w-2.5 h-2.5 inline" /> {s.paymentTerms}</span>}
                    </div>
                  </div>
                  <div className="text-left">
                    {s.balance > 0 ? (
                      <>
                        <p className="text-[10px] text-red-400">المستحق علينا</p>
                        <p className="text-lg font-bold text-red-400">{fmt(s.balance)} د.ع</p>
                      </>
                    ) : s.balance < 0 ? (
                      <>
                        <p className="text-[10px] text-emerald-400">دفعة مقدمة</p>
                        <p className="text-lg font-bold text-emerald-400">{fmt(-s.balance)} د.ع</p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">✓ مسوّى</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {s.balance > 0 && (
                      <Button size="sm" onClick={() => setShowPayForm(s)} className="bg-emerald-500 hover:bg-emerald-600 text-white h-7 text-[10px]">
                        💰 تسديد
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setStatementOf(s)} className="h-7 text-[10px] border-cyan-500/30 text-cyan-400">
                      📊 كشف
                    </Button>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditingSup(s); setShowSupForm(true); }} className="h-6 w-6 hover:text-amber-400">
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => delSupplier(s)} className="h-6 w-6 hover:text-red-400">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="pos" className="space-y-2">
          {pos.length === 0 ? <p className="text-center text-muted-foreground py-8">لا توجد فواتير شراء</p> :
           pos.map(p => (
            <Card key={p.id} className={`glass-card ${p.status === 'paid' ? 'border-emerald-500/20' : p.status === 'partial' ? 'border-amber-500/20' : 'border-red-500/20'}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-2xl">📋</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-cyan-400">{p.poNumber}</span>
                      <Badge className={p.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[9px]' : p.status === 'partial' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 text-[9px]' : 'bg-red-500/20 text-red-400 border-red-500/40 text-[9px]'}>
                        {p.status === 'paid' ? '✅ مدفوع' : p.status === 'partial' ? '⚠️ جزئي' : '❌ غير مدفوع'}
                      </Badge>
                    </div>
                    <p className="text-xs mt-1">🏭 {p.supplierName} · 📦 {p.items?.length || 0} منتج</p>
                    <p className="text-[10px] text-muted-foreground">📅 {p.createdAt ? new Date(p.createdAt).toLocaleString('ar-IQ') : ''}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-bold gold-text">{fmt(p.total)} د.ع</p>
                    {p.remaining > 0 && <p className="text-[10px] text-red-400">باقي: {fmt(p.remaining)}</p>}
                    {p.paid > 0 && <p className="text-[10px] text-emerald-400">مدفوع: {fmt(p.paid)}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {showSupForm && <SupplierForm supplier={editingSup} onClose={() => { setShowSupForm(false); setEditingSup(null); }} onSaved={() => { setShowSupForm(false); setEditingSup(null); load(); }} />}
      {showPOForm && <PurchaseOrderForm suppliers={suppliers} products={products} onClose={() => setShowPOForm(false)} onSaved={() => { setShowPOForm(false); load(); }} />}
      {showPayForm && <SupplierPaymentForm supplier={showPayForm} onClose={() => setShowPayForm(null)} onSaved={() => { setShowPayForm(null); load(); }} />}
      {statementOf && <SupplierStatement supplierId={statementOf.id} onClose={() => setStatementOf(null)} />}
    </div>
  );
}

function SupplierForm({ supplier, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: supplier?.name || '',
    phone: supplier?.phone || '',
    email: supplier?.email || '',
    address: supplier?.address || '',
    contactPerson: supplier?.contactPerson || '',
    category: supplier?.category || 'عام',
    paymentTerms: supplier?.paymentTerms || 'نقدي',
    notes: supplier?.notes || '',
    balance: supplier?.balance || 0,
    active: supplier?.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.name) { toast.error('الاسم مطلوب'); return; }
    setSaving(true);
    try {
      if (supplier) {
        await api(`suppliers/${supplier.id}`, { method: 'PUT', body: JSON.stringify(form) });
        toast.success('✅ تم التحديث');
      } else {
        const r = await api('suppliers', { method: 'POST', body: JSON.stringify(form) });
        if (r?.error) { toast.error(r.error); return; }
        toast.success('🎉 تم الإضافة');
      }
      onSaved();
    } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="glass-strong border-gold/40 max-w-lg">
        <DialogHeader><DialogTitle className="gold-text">{supplier ? 'تعديل مورد' : 'مورد جديد'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">اسم المورد *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-input/30 border-gold/20" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">الهاتف</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-input/30 border-gold/20" dir="ltr" /></div>
            <div><Label className="text-xs">جهة الاتصال</Label><Input value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} className="bg-input/30 border-gold/20" /></div>
          </div>
          <div><Label className="text-xs">العنوان</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="bg-input/30 border-gold/20" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">الفئة</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="bg-input/30 border-gold/20" placeholder="هواتف، شبكات، إكسسوارات" /></div>
            <div>
              <Label className="text-xs">طريقة الدفع</Label>
              <Select value={form.paymentTerms} onValueChange={v => setForm({ ...form, paymentTerms: v })}>
                <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="نقدي">💵 نقدي</SelectItem>
                  <SelectItem value="آجل 30 يوم">📅 آجل 30 يوم</SelectItem>
                  <SelectItem value="آجل 60 يوم">📅 آجل 60 يوم</SelectItem>
                  <SelectItem value="آجل 90 يوم">📅 آجل 90 يوم</SelectItem>
                  <SelectItem value="حسب الاتفاق">🤝 حسب الاتفاق</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">الرصيد الافتتاحي (موجب = ندين له)</Label><Input type="number" value={form.balance} onChange={e => setForm({ ...form, balance: Number(e.target.value) })} className="bg-input/30 border-gold/20" /></div>
          <div><Label className="text-xs">ملاحظات</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-input/30 border-gold/20 h-16" /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button onClick={onClose} variant="outline" className="border-gold/30">إلغاء</Button>
          <Button onClick={submit} disabled={saving} className="btn-gold">{saving ? '⏳' : '💾 حفظ'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseOrderForm({ suppliers, products, onClose, onSaved }) {
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([{ productId: '', name: '', quantity: 1, cost: 0 }]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paid, setPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [updateStock, setUpdateStock] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const subtotal = items.reduce((s, it) => s + (Number(it.quantity) * Number(it.cost)), 0);
  const total = Math.max(0, subtotal + Number(tax) - Number(discount));
  const remaining = Math.max(0, total - Number(paid));

  const updateItem = (idx, key, val) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it));
  };
  const onSelectProduct = (idx, prodId) => {
    const p = products.find(x => x.id === prodId);
    if (p) updateItem(idx, 'name', p.name); else updateItem(idx, 'name', '');
    updateItem(idx, 'productId', prodId);
    if (p?.lastCost) updateItem(idx, 'cost', p.lastCost);
  };

  const submit = async () => {
    if (!supplierId) { toast.error('اختر مورد'); return; }
    const valid = items.filter(it => (it.productId || it.name) && Number(it.quantity) > 0);
    if (valid.length === 0) { toast.error('أضف منتج واحد على الأقل'); return; }
    setSaving(true);
    try {
      const r = await api('purchase-orders', {
        method: 'POST',
        body: JSON.stringify({ supplierId, items: valid, discount: Number(discount), tax: Number(tax), paid: Number(paid), paymentMethod, updateStock, notes }),
      });
      if (r?.error) { toast.error(r.error); return; }
      toast.success(`🎉 تم إنشاء فاتورة ${r.poNumber}`);
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="glass-strong border-gold/40 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="gold-text">فاتورة شراء جديدة</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">المورد *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="اختر مورد..." /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1 block">المنتجات</Label>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-1 items-center p-2 rounded bg-input/30 border border-gold-soft">
                  <div className="col-span-4">
                    <Select value={it.productId} onValueChange={v => onSelectProduct(idx, v)}>
                      <SelectTrigger className="bg-background/50 border-gold/20 h-9"><SelectValue placeholder="منتج موجود..." /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input value={it.name} onChange={e => updateItem(idx, 'name', e.target.value)} placeholder="أو اسم يدوي" className="col-span-3 bg-background/50 border-gold/20 h-9" />
                  <Input type="number" value={it.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} placeholder="كمية" className="col-span-2 bg-background/50 border-gold/20 h-9 text-center" min="1" />
                  <Input type="number" value={it.cost} onChange={e => updateItem(idx, 'cost', Number(e.target.value))} placeholder="سعر التكلفة" className="col-span-2 bg-background/50 border-gold/20 h-9 text-center" />
                  <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="col-span-1 h-9 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={() => setItems([...items, { productId: '', name: '', quantity: 1, cost: 0 }])} className="border-gold/30 mt-2">
              <Plus className="w-3 h-3 ml-1" /> إضافة منتج
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">خصم</Label><Input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="bg-input/30 border-gold/20" /></div>
            <div><Label className="text-xs">ضريبة</Label><Input type="number" value={tax} onChange={e => setTax(e.target.value)} className="bg-input/30 border-gold/20" /></div>
            <div><Label className="text-xs">المدفوع الآن</Label><Input type="number" value={paid} onChange={e => setPaid(e.target.value)} className="bg-input/30 border-gold/20 font-bold text-emerald-400" /></div>
            <div>
              <Label className="text-xs">طريقة الدفع</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">💵 نقدي</SelectItem>
                  <SelectItem value="master">💳 ماستر</SelectItem>
                  <SelectItem value="fastpay">⚡ فاست باي</SelectItem>
                  <SelectItem value="transfer">🏦 تحويل</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-gold/5 border border-gold-soft space-y-1 text-sm">
            <div className="flex justify-between"><span>المجموع الفرعي:</span><span className="font-bold">{fmt(subtotal)} د.ع</span></div>
            <div className="flex justify-between"><span>ضريبة:</span><span>+ {fmt(tax)}</span></div>
            <div className="flex justify-between text-red-400"><span>خصم:</span><span>- {fmt(discount)}</span></div>
            <div className="flex justify-between text-base font-bold gold-text border-t border-gold-soft pt-1"><span>الإجمالي:</span><span>{fmt(total)} د.ع</span></div>
            <div className="flex justify-between text-emerald-400"><span>مدفوع:</span><span>{fmt(paid)} د.ع</span></div>
            <div className={`flex justify-between font-bold ${remaining > 0 ? 'text-red-400' : 'text-emerald-400'}`}><span>المتبقي:</span><span>{fmt(remaining)} د.ع</span></div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded bg-input/30 border border-gold-soft">
            <input type="checkbox" checked={updateStock} onChange={e => setUpdateStock(e.target.checked)} id="upd-stock" className="w-4 h-4" />
            <Label htmlFor="upd-stock" className="text-xs cursor-pointer">📦 تحديث مخزون المنتجات تلقائياً</Label>
          </div>
          <div><Label className="text-xs">ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} className="bg-input/30 border-gold/20 h-16" /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button onClick={onClose} variant="outline" className="border-gold/30">إلغاء</Button>
          <Button onClick={submit} disabled={saving} className="btn-gold">{saving ? '⏳' : '💾 إنشاء الفاتورة'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupplierPaymentForm({ supplier, onClose, onSaved }) {
  const [amount, setAmount] = useState(supplier.balance || 0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!amount || amount <= 0) { toast.error('المبلغ غير صحيح'); return; }
    setSaving(true);
    try {
      const r = await api(`suppliers/${supplier.id}/pay`, { method: 'POST', body: JSON.stringify({ amount: Number(amount), paymentMethod, notes }) });
      if (r?.error) { toast.error(r.error); return; }
      toast.success(`✅ تم تسديد ${Number(amount).toLocaleString('en-US')} د.ع`);
      onSaved();
    } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="glass-strong border-emerald-500/40 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-emerald-400">💰 تسديد للمورد: {supplier.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-center">
            <p className="text-[10px] text-red-400">المستحق الحالي</p>
            <p className="text-2xl font-bold text-red-400">{fmt(supplier.balance)} د.ع</p>
          </div>
          <div><Label className="text-xs">المبلغ المدفوع</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="bg-input/30 border-emerald-500/30 text-2xl font-bold text-emerald-400 text-center" /></div>
          <div>
            <Label className="text-xs">طريقة الدفع</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">💵 نقدي</SelectItem>
                <SelectItem value="master">💳 ماستر</SelectItem>
                <SelectItem value="fastpay">⚡ فاست باي</SelectItem>
                <SelectItem value="transfer">🏦 تحويل</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} className="bg-input/30 border-gold/20 h-16" /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button onClick={onClose} variant="outline" className="border-gold/30">إلغاء</Button>
          <Button onClick={submit} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 text-white">{saving ? '⏳' : '💰 تأكيد التسديد'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupplierStatement({ supplierId, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => { api(`suppliers/${supplierId}/statement`).then(setData); }, [supplierId]);
  if (!data) return (
    <Dialog open onOpenChange={onClose}><DialogContent><p className="text-center py-8">جاري التحميل…</p></DialogContent></Dialog>
  );
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="glass-strong border-gold/40 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="gold-text">📊 كشف حساب: {data.supplier.name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-center">
            <p className="text-[10px]">إجمالي المشتريات</p>
            <p className="font-bold gold-text">{fmt(data.totalPurchased)} د.ع</p>
          </div>
          <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/30 text-center">
            <p className="text-[10px]">إجمالي المسدد</p>
            <p className="font-bold text-emerald-400">{fmt(data.totalPaid)} د.ع</p>
          </div>
          <div className={`p-3 rounded text-center ${data.currentBalance > 0 ? 'bg-red-500/10 border border-red-500/30' : 'bg-emerald-500/10 border border-emerald-500/30'}`}>
            <p className="text-[10px]">الرصيد الحالي</p>
            <p className={`font-bold ${data.currentBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(data.currentBalance)} د.ع</p>
          </div>
        </div>
        <Tabs defaultValue="pos">
          <TabsList className="grid w-full grid-cols-2 bg-input/30">
            <TabsTrigger value="pos">📋 الفواتير ({data.pos.length})</TabsTrigger>
            <TabsTrigger value="payments">💰 المدفوعات ({data.payments.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pos" className="space-y-1 max-h-64 overflow-y-auto">
            {data.pos.map(p => (
              <div key={p.id} className="p-2 rounded bg-input/30 border border-gold-soft text-xs flex justify-between">
                <div>
                  <p className="font-mono font-bold text-cyan-400">{p.poNumber}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(p.createdAt).toLocaleString('ar-IQ')}</p>
                </div>
                <p className="font-bold gold-text">{fmt(p.total)} د.ع</p>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="payments" className="space-y-1 max-h-64 overflow-y-auto">
            {data.payments.map(p => (
              <div key={p.id} className="p-2 rounded bg-emerald-500/5 border border-emerald-500/20 text-xs flex justify-between">
                <div>
                  <p>{p.paymentMethod}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(p.createdAt).toLocaleString('ar-IQ')}</p>
                </div>
                <p className="font-bold text-emerald-400">{fmt(p.amount)} د.ع</p>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
