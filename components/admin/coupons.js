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
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gift, Plus, Trash2, Edit2, Copy, Percent, DollarSign, Calendar, Users, ChevronDown, ChevronUp, Search } from 'lucide-react';

const TYPE_LABELS = { percent: '% خصم نسبي', fixed: 'د.ع خصم ثابت' };

export default function CouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api('coupons');
      setCoupons(safeArr(d));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search) return coupons;
    const q = search.toLowerCase();
    return coupons.filter(c => (c.code || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q));
  }, [coupons, search]);

  const stats = useMemo(() => {
    const active = coupons.filter(c => c.active).length;
    const inactive = coupons.length - active;
    const totalUses = coupons.reduce((s, c) => s + (c.usedCount || 0), 0);
    const expired = coupons.filter(c => c.expiresAt && new Date(c.expiresAt) < new Date()).length;
    return { total: coupons.length, active, inactive, totalUses, expired };
  }, [coupons]);

  const toggleActive = async (c) => {
    await api(`coupons/${c.id}`, { method: 'PUT', body: JSON.stringify({ active: !c.active }) });
    toast.success(c.active ? '⏸️ تم إيقاف الكوبون' : '✅ تم تفعيل الكوبون');
    load();
  };

  const delCoupon = async (c) => {
    if (!confirm(`حذف الكوبون "${c.code}"؟`)) return;
    await api(`coupons/${c.id}`, { method: 'DELETE' });
    toast.success('🗑️ تم الحذف');
    load();
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success(`📋 ${code}`);
  };

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <Card className="glass-strong border-gold/30">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="gold-text flex items-center gap-2 text-2xl">
                <Gift className="w-6 h-6" /> الكوبونات والعروض
              </CardTitle>
              <CardDescription className="mt-1">
                أنشئ كوبونات خصم تستخدم في المتجر الإلكتروني — خصم نسبي أو ثابت، حد أدنى، عدد استخدامات، تاريخ انتهاء
              </CardDescription>
            </div>
            <Button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-gold">
              <Plus className="w-4 h-4 ml-1" /> كوبون جديد
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'الكل', value: stats.total, icon: '🎫', color: 'gold' },
          { label: 'نشطة', value: stats.active, icon: '✅', color: 'emerald' },
          { label: 'موقفة', value: stats.inactive, icon: '⏸️', color: 'zinc' },
          { label: 'منتهية', value: stats.expired, icon: '⏰', color: 'red' },
          { label: 'إجمالي الاستخدامات', value: stats.totalUses, icon: '🛒', color: 'cyan' },
        ].map((s, i) => (
          <Card key={i} className={`glass-card border-${s.color}-500/20`}>
            <CardContent className="p-3 text-center">
              <p className="text-xl">{s.icon}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
              <p className="text-2xl font-bold gold-text">{fmt(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SEARCH */}
      <Card className="glass-card border-gold-soft">
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="بحث (كود/وصف)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pr-10 bg-input/30 border-gold/20"
            />
          </div>
        </CardContent>
      </Card>

      {/* LIST */}
      <div className="space-y-2">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">جاري التحميل…</p>
        ) : filtered.length === 0 ? (
          <Card className="glass-card border-gold-soft">
            <CardContent className="py-8 text-center">
              <Gift className="w-12 h-12 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-muted-foreground text-sm">لا توجد كوبونات بعد. أنشئ أول كوبون.</p>
            </CardContent>
          </Card>
        ) : filtered.map(c => {
          const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
          const usedUp = c.maxUses > 0 && c.usedCount >= c.maxUses;
          const status = !c.active ? 'inactive' : expired ? 'expired' : usedUp ? 'used_up' : 'active';
          const statusBadge = {
            active: <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40">✅ نشط</Badge>,
            inactive: <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/40">⏸️ موقف</Badge>,
            expired: <Badge className="bg-red-500/20 text-red-400 border-red-500/40">⏰ منتهي</Badge>,
            used_up: <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/40">🚫 مستنفد</Badge>,
          }[status];
          return (
            <Card key={c.id} className={`glass-card ${status === 'active' ? 'border-emerald-500/20' : 'border-gold-soft'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={() => copyCode(c.code)} className="text-2xl font-mono font-bold gold-text hover:scale-105 transition cursor-pointer">
                    🎟️ {c.code}
                  </button>
                  <Badge className={c.type === 'percent' ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'}>
                    {c.type === 'percent' ? <><Percent className="w-3 h-3 ml-1" /> {c.value}%</> : <>{fmt(c.value)} د.ع</>}
                  </Badge>
                  {statusBadge}
                  <div className="flex-1"></div>
                  <Switch checked={c.active} onCheckedChange={() => toggleActive(c)} />
                  <Button size="icon" variant="ghost" onClick={() => copyCode(c.code)} className="h-8 w-8 hover:text-cyan-400">
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setShowForm(true); }} className="h-8 w-8 hover:text-amber-400">
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => delCoupon(c)} className="h-8 w-8 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {c.description && (
                  <p className="text-xs text-muted-foreground mt-2">{c.description}</p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-[10px]">
                  <div className="p-2 rounded bg-input/30 border border-gold-soft text-center">
                    <p className="text-muted-foreground">حد أدنى للطلب</p>
                    <p className="font-bold">{c.minOrder ? `${fmt(c.minOrder)} د.ع` : 'بدون'}</p>
                  </div>
                  <div className="p-2 rounded bg-input/30 border border-gold-soft text-center">
                    <p className="text-muted-foreground">الاستخدامات</p>
                    <p className="font-bold">{c.usedCount || 0}{c.maxUses > 0 ? `/${c.maxUses}` : ' (غير محدود)'}</p>
                  </div>
                  <div className="p-2 rounded bg-input/30 border border-gold-soft text-center">
                    <p className="text-muted-foreground">تاريخ الانتهاء</p>
                    <p className="font-bold">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('ar-IQ') : 'بدون'}</p>
                  </div>
                  <div className="p-2 rounded bg-input/30 border border-gold-soft text-center">
                    <p className="text-muted-foreground">أُنشئ</p>
                    <p className="font-bold">{c.createdAt ? new Date(c.createdAt).toLocaleDateString('ar-IQ') : '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FORM DIALOG */}
      {showForm && (
        <CouponForm
          coupon={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function CouponForm({ coupon, onClose, onSaved }) {
  const [form, setForm] = useState({
    code: coupon?.code || '',
    type: coupon?.type || 'percent',
    value: coupon?.value || 10,
    minOrder: coupon?.minOrder || 0,
    maxUses: coupon?.maxUses || 0,
    expiresAt: coupon?.expiresAt ? coupon.expiresAt.slice(0, 10) : '',
    description: coupon?.description || '',
    active: coupon?.active !== false,
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!coupon && !form.code.trim()) { toast.error('أدخل كود الكوبون'); return; }
    if (!form.value || form.value <= 0) { toast.error('قيمة الخصم غير صحيحة'); return; }
    if (form.type === 'percent' && form.value > 100) { toast.error('النسبة يجب أن تكون 1-100'); return; }
    setSaving(true);
    try {
      const payload = { ...form, value: Number(form.value), minOrder: Number(form.minOrder), maxUses: Number(form.maxUses) };
      if (form.expiresAt) payload.expiresAt = new Date(form.expiresAt).toISOString();
      else payload.expiresAt = null;

      if (coupon) {
        await api(`coupons/${coupon.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        toast.success('✅ تم تحديث الكوبون');
      } else {
        const r = await api('coupons', { method: 'POST', body: JSON.stringify(payload) });
        if (r?.error) { toast.error(r.error); return; }
        toast.success(`🎉 تم إنشاء الكوبون: ${r.code}`);
      }
      onSaved();
    } finally { setSaving(false); }
  };

  const genRandom = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setForm({ ...form, code });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="glass-strong border-gold/40 max-w-lg">
        <DialogHeader>
          <DialogTitle className="gold-text flex items-center gap-2">
            <Gift className="w-5 h-5" /> {coupon ? 'تعديل الكوبون' : 'كوبون جديد'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">كود الكوبون</Label>
            <div className="flex gap-2">
              <Input
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="EID2026"
                className="bg-input/30 border-gold/20 font-mono uppercase"
                disabled={!!coupon}
              />
              {!coupon && (
                <Button type="button" variant="outline" size="sm" onClick={genRandom} className="border-cyan-500/30 text-cyan-400 shrink-0">
                  🎲 عشوائي
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">نوع الخصم</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">نسبة مئوية (%)</SelectItem>
                  <SelectItem value="fixed">مبلغ ثابت (د.ع)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">القيمة {form.type === 'percent' ? '(1-100%)' : '(د.ع)'}</Label>
              <Input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className="bg-input/30 border-gold/20 font-bold text-lg gold-text" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">حد أدنى للطلب (د.ع)</Label>
              <Input type="number" value={form.minOrder} onChange={e => setForm({ ...form, minOrder: e.target.value })} className="bg-input/30 border-gold/20" />
              <p className="text-[9px] text-muted-foreground mt-1">0 = بدون حد</p>
            </div>
            <div>
              <Label className="text-xs">أقصى عدد استخدامات</Label>
              <Input type="number" value={form.maxUses} onChange={e => setForm({ ...form, maxUses: e.target.value })} className="bg-input/30 border-gold/20" />
              <p className="text-[9px] text-muted-foreground mt-1">0 = غير محدود</p>
            </div>
          </div>
          <div>
            <Label className="text-xs">تاريخ الانتهاء (اختياري)</Label>
            <Input type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} className="bg-input/30 border-gold/20" />
          </div>
          <div>
            <Label className="text-xs">الوصف (اختياري)</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-input/30 border-gold/20 h-16" placeholder="مثال: عرض عيد الفطر — خصم على جميع منتجات الإكسسوارات" />
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-input/30 border border-gold-soft">
            <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
            <Label className="text-xs">الكوبون مفعّل</Label>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button onClick={onClose} variant="outline" className="border-gold/30">إلغاء</Button>
          <Button onClick={submit} disabled={saving} className="btn-gold">
            {saving ? 'جاري الحفظ…' : (coupon ? '💾 تحديث' : '✨ إنشاء')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
