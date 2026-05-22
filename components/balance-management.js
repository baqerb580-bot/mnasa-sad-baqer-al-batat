'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/page-shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Minus, ArrowLeftRight, Trash2, History, TrendingUp, TrendingDown, Wallet, RefreshCw, Edit2 } from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('en-US');

export default function BalanceManagement({ api }) {
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opDialog, setOpDialog] = useState(null); // { account, mode: 'deposit'|'withdraw' }
  const [opForm, setOpForm] = useState({ amount: '', description: '' });
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({ fromAccountId: '', toAccountId: '', amount: '', description: '' });
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', type: 'other', icon: '💰', color: '#888' });
  const [ispPresetsOpen, setIspPresetsOpen] = useState(false);
  const [ispAdding, setIspAdding] = useState(false);
  const [filterAcc, setFilterAcc] = useState('__all');
  const [filterType, setFilterType] = useState('__all');

  const load = async () => {
    setLoading(true);
    try {
      const a = await api('balance/accounts');
      setAccounts(Array.isArray(a) ? a : []);
      const s = await api('balance/summary');
      setSummary(Array.isArray(s) ? s : []);
      await loadTx();
    } finally { setLoading(false); }
  };

  const loadTx = async () => {
    const qs = new URLSearchParams();
    if (filterAcc && filterAcc !== '__all') qs.set('accountId', filterAcc);
    if (filterType && filterType !== '__all') qs.set('type', filterType);
    qs.set('limit', '300');
    const t = await api(`balance/transactions?${qs.toString()}`);
    setTransactions(Array.isArray(t) ? t : []);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadTx(); }, [filterAcc, filterType]);

  const submitOp = async () => {
    const amt = Number(opForm.amount);
    if (!amt || amt <= 0) { toast.error('أدخل مبلغاً صحيحاً'); return; }
    const endpoint = opDialog.mode === 'deposit' ? 'balance/deposit' : 'balance/withdraw';
    const r = await api(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        accountId: opDialog.account.id,
        amount: amt,
        description: opForm.description,
        by: { id: 'manager', name: 'المدير' },
      }),
    });
    if (r?.success) {
      toast.success(`✅ ${opDialog.mode === 'deposit' ? 'تمت التعبئة' : 'تم الصرف'} — الرصيد: ${fmt(r.newBalance)} د.ع`);
      setOpDialog(null);
      setOpForm({ amount: '', description: '' });
      load();
    } else {
      toast.error(r?.error || 'فشلت العملية');
    }
  };

  const submitTransfer = async () => {
    const amt = Number(transferForm.amount);
    if (!amt || amt <= 0 || !transferForm.fromAccountId || !transferForm.toAccountId) {
      toast.error('أكمل الحقول'); return;
    }
    const r = await api('balance/transfer', {
      method: 'POST',
      body: JSON.stringify({ ...transferForm, amount: amt, by: { id: 'manager', name: 'المدير' } }),
    });
    if (r?.success) {
      toast.success('✅ تم التحويل');
      setTransferOpen(false); setTransferForm({ fromAccountId: '', toAccountId: '', amount: '', description: '' });
      load();
    } else toast.error(r?.error || 'فشل');
  };

  const submitNewAccount = async () => {
    if (!newAccount.name?.trim()) { toast.error('الاسم مطلوب'); return; }
    const r = await api('balance/accounts', { method: 'POST', body: JSON.stringify(newAccount) });
    if (r?.id) {
      toast.success('✅ تمت الإضافة');
      setAddAccountOpen(false); setNewAccount({ name: '', type: 'other', icon: '💰', color: '#888' });
      load();
    }
  };

  // ISP Provider presets - Internet companies (Halasat, Watani, Earthlink, Dish Network)
  const ISP_PRESETS = [
    { key: 'halasat',  name: 'رصيد هالة سات',  icon: '🛰️', color: '#3b82f6', type: 'isp_provider' },
    { key: 'watani',   name: 'رصيد وطني',       icon: '🇮🇶', color: '#10b981', type: 'isp_provider' },
    { key: 'earthlink',name: 'رصيد إيرثلنك',    icon: '🌐', color: '#f59e0b', type: 'isp_provider' },
    { key: 'dish',     name: 'رصيد دش نتورك',   icon: '📡', color: '#a855f7', type: 'isp_provider' },
  ];
  const addIspProviders = async (selectedKeys) => {
    setIspAdding(true);
    const existingKeys = new Set(accounts.map(a => a.key));
    const toAdd = ISP_PRESETS.filter(p => selectedKeys.includes(p.key) && !existingKeys.has(p.key));
    if (toAdd.length === 0) { toast.warning('كل المزودين المختارين موجودون مسبقاً'); setIspAdding(false); setIspPresetsOpen(false); return; }
    let added = 0;
    for (const p of toAdd) {
      const r = await api('balance/accounts', { method: 'POST', body: JSON.stringify(p) });
      if (r?.id) added++;
    }
    toast.success(`✅ تمت إضافة ${added} مزود إنترنت بحساب منفصل`);
    setIspPresetsOpen(false);
    setIspAdding(false);
    load();
  };

  const deleteTransaction = async (tx) => {
    if (!confirm(`حذف هذه المعاملة (${tx.type === 'deposit' ? '+' : '-'}${fmt(tx.amount)})؟ سيتم إرجاع الرصيد للحالة السابقة.`)) return;
    const r = await api(`balance/transactions/${tx.id}`, { method: 'DELETE' });
    if (r?.success) { toast.success('🗑️ تم الحذف'); load(); }
  };

  const TX_TYPE_CFG = {
    deposit:      { label: '➕ تعبئة',          color: 'text-emerald-400', sign: '+' },
    withdraw:     { label: '➖ صرف',           color: 'text-red-400',     sign: '-' },
    auto_deduct:  { label: '🤖 تسقيط تلقائي',  color: 'text-orange-400',  sign: '-' },
    transfer_in:  { label: '⬅️ تحويل وارد',    color: 'text-cyan-400',    sign: '+' },
    transfer_out: { label: '➡️ تحويل صادر',    color: 'text-purple-400',  sign: '-' },
  };

  // Compute combined stats across all accounts
  const totalBalance = accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const todayIn = summary.reduce((s, a) => s + (Number(a.todayDeposit) || 0), 0);
  const todayOut = summary.reduce((s, a) => s + (Number(a.todayWithdraw) || 0), 0);

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold gold-text flex items-center gap-2">
          <Wallet className="w-6 h-6" /> إدارة الرصيد والصرفيات
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10" onClick={() => setTransferOpen(true)}>
            <ArrowLeftRight className="w-4 h-4 ml-1" /> تحويل بين الحسابات
          </Button>
          <Button variant="outline" className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10" onClick={() => setIspPresetsOpen(true)}>
            🛰️ مزودي إنترنت
          </Button>
          <Button variant="outline" className="border-gold/30" onClick={() => setAddAccountOpen(true)}>
            <Plus className="w-4 h-4 ml-1" /> حساب جديد
          </Button>
          <Button variant="outline" className="border-gold/30" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ml-1 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Top-line stats */}
      <div className="grid md:grid-cols-3 gap-3">
        <Card className="glass-strong border-gold-soft">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">إجمالي الأرصدة</p>
            <p className="text-2xl font-bold gold-text">{fmt(totalBalance)} د.ع</p>
          </CardContent>
        </Card>
        <Card className="glass-strong border-emerald-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">إيداع اليوم</p>
            <p className="text-2xl font-bold text-emerald-400">+{fmt(todayIn)} د.ع</p>
          </CardContent>
        </Card>
        <Card className="glass-strong border-red-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">صرف اليوم</p>
            <p className="text-2xl font-bold text-red-400">-{fmt(todayOut)} د.ع</p>
          </CardContent>
        </Card>
      </div>

      {/* Account cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {accounts.filter(a => a.enabled !== false).map(a => {
          const s = summary.find(x => x.id === a.id) || {};
          const overdrawn = Number(a.balance) < 0;
          return (
            <Card key={a.id} className={`glass-strong ${overdrawn ? 'border-red-500/50' : 'border-gold-soft'}`} style={{ borderColor: overdrawn ? undefined : `${a.color}40` }}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                  <span className="flex items-center gap-2 text-sm">
                    <span className="text-2xl">{a.icon || '💰'}</span>
                    <span style={{ color: a.color }}>{a.name}</span>
                  </span>
                  {overdrawn && <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-[9px]">⚠ في السالب</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className={`text-3xl font-bold ${overdrawn ? 'text-red-400' : ''}`} style={{ color: overdrawn ? undefined : a.color }}>
                  {fmt(a.balance)} <span className="text-sm font-normal text-muted-foreground">د.ع</span>
                </p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="glass-card rounded p-2">
                    <p className="text-muted-foreground">إيداع اليوم</p>
                    <p className="font-bold text-emerald-400">+{fmt(s.todayDeposit)}</p>
                  </div>
                  <div className="glass-card rounded p-2">
                    <p className="text-muted-foreground">صرف اليوم</p>
                    <p className="font-bold text-red-400">-{fmt(s.todayWithdraw)}</p>
                  </div>
                  <div className="glass-card rounded p-2">
                    <p className="text-muted-foreground">إيداع الشهر</p>
                    <p className="font-bold text-emerald-400">+{fmt(s.monthDeposit)}</p>
                  </div>
                  <div className="glass-card rounded p-2">
                    <p className="text-muted-foreground">صرف الشهر</p>
                    <p className="font-bold text-red-400">-{fmt(s.monthWithdraw)}</p>
                  </div>
                </div>
                <div className="flex gap-1 pt-2">
                  <Button size="sm" className="flex-1 btn-gold" onClick={() => { setOpDialog({ account: a, mode: 'deposit' }); setOpForm({ amount: '', description: '' }); }}>
                    <Plus className="w-3 h-3 ml-1" /> تعبئة
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 border-red-500/40 text-red-400 hover:bg-red-500/10" onClick={() => { setOpDialog({ account: a, mode: 'withdraw' }); setOpForm({ amount: '', description: '' }); }}>
                    <Minus className="w-3 h-3 ml-1" /> صرف
                  </Button>
                </div>
                <p className="text-[9px] text-muted-foreground text-center mt-1">{s.txCount || 0} معاملة</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Transactions log */}
      <Card className="glass-strong border-gold-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-base gold-text flex items-center gap-2"><History className="w-4 h-4" /> سجل المعاملات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3 flex-wrap">
            <Select value={filterAcc} onValueChange={setFilterAcc}>
              <SelectTrigger className="bg-input/30 border-gold/20 w-44 h-8 text-xs"><SelectValue placeholder="كل الحسابات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">كل الحسابات</SelectItem>
                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="bg-input/30 border-gold/20 w-44 h-8 text-xs"><SelectValue placeholder="كل الأنواع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">كل الأنواع</SelectItem>
                <SelectItem value="deposit">➕ إيداع</SelectItem>
                <SelectItem value="withdraw">➖ صرف</SelectItem>
                <SelectItem value="auto_deduct">🤖 تسقيط تلقائي</SelectItem>
                <SelectItem value="transfer_in">⬅️ تحويل وارد</SelectItem>
                <SelectItem value="transfer_out">➡️ تحويل صادر</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-input/30 border-b border-gold-soft">
                <tr>
                  <th className="p-2 text-right">التاريخ</th>
                  <th className="p-2 text-right">الحساب</th>
                  <th className="p-2 text-right">النوع</th>
                  <th className="p-2 text-right">المبلغ</th>
                  <th className="p-2 text-right">الرصيد بعدها</th>
                  <th className="p-2 text-right">الوصف</th>
                  <th className="p-2 text-right">المُنفّذ</th>
                  <th className="p-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">لا توجد معاملات</td></tr>
                ) : transactions.map(tx => {
                  const cfg = TX_TYPE_CFG[tx.type] || { label: tx.type, color: 'text-zinc-400', sign: '' };
                  return (
                    <tr key={tx.id} className="border-b border-gold-soft/20 hover:bg-input/10">
                      <td className="p-2 text-[10px]">{new Date(tx.createdAt).toLocaleString('ar-IQ')}</td>
                      <td className="p-2 font-semibold">{tx.accountName}</td>
                      <td className={`p-2 font-bold ${cfg.color}`}>{cfg.label}</td>
                      <td className={`p-2 font-bold ${cfg.color}`}>{cfg.sign}{fmt(tx.amount)}</td>
                      <td className="p-2">{fmt(tx.balanceAfter)}</td>
                      <td className="p-2 max-w-[260px] truncate" title={tx.description}>
                        {tx.description}
                        {tx.linkedEntity === 'activation' && tx.subscriberName && (
                          <span className="block text-[9px] text-cyan-400">👤 {tx.subscriberName}</span>
                        )}
                      </td>
                      <td className="p-2 text-[10px] text-muted-foreground">{tx.createdByName || tx.createdBy}</td>
                      <td className="p-2">
                        {tx.type !== 'auto_deduct' && (
                          <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-red-400" onClick={() => deleteTransaction(tx)} title="حذف">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Deposit/Withdraw dialog */}
      <Dialog open={!!opDialog} onOpenChange={(v) => !v && setOpDialog(null)}>
        <DialogContent className="glass-strong border-gold-soft">
          <DialogHeader>
            <DialogTitle className={opDialog?.mode === 'deposit' ? 'text-emerald-400' : 'text-red-400'}>
              {opDialog?.mode === 'deposit' ? '➕ تعبئة' : '➖ صرف من'} {opDialog?.account?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">الرصيد الحالي: <span className="gold-text font-bold">{fmt(opDialog?.account?.balance)} د.ع</span></p>
            <Label className="text-xs">المبلغ (د.ع)</Label>
            <Input type="number" value={opForm.amount} onChange={e => setOpForm({ ...opForm, amount: e.target.value })} className="bg-input/30 border-gold/20 text-lg font-bold" autoFocus />
            <Label className="text-xs">الوصف / السبب</Label>
            <Textarea value={opForm.description} onChange={e => setOpForm({ ...opForm, description: e.target.value })} rows={2} className="bg-input/30 border-gold/20" placeholder={opDialog?.mode === 'deposit' ? 'مثلاً: تعبئة من شركة الإنترنت' : 'مثلاً: دفع مصاريف مكتب'} />
            {opDialog?.mode === 'withdraw' && Number(opForm.amount) > Number(opDialog?.account?.balance || 0) && (
              <p className="text-[10px] text-amber-400">⚠ المبلغ أكبر من الرصيد المتوفر — سيصبح الرصيد بالسالب</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={submitOp} className={opDialog?.mode === 'deposit' ? 'btn-gold' : 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'}>
              تأكيد {opDialog?.mode === 'deposit' ? 'التعبئة' : 'الصرف'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="glass-strong border-cyan-500/30">
          <DialogHeader><DialogTitle className="text-cyan-400">🔀 تحويل بين الحسابات</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">من حساب</Label>
            <Select value={transferForm.fromAccountId} onValueChange={v => setTransferForm({ ...transferForm, fromAccountId: v })}>
              <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="اختر..." /></SelectTrigger>
              <SelectContent>
                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name} ({fmt(a.balance)})</SelectItem>)}
              </SelectContent>
            </Select>
            <Label className="text-xs">إلى حساب</Label>
            <Select value={transferForm.toAccountId} onValueChange={v => setTransferForm({ ...transferForm, toAccountId: v })}>
              <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="اختر..." /></SelectTrigger>
              <SelectContent>
                {accounts.filter(a => a.id !== transferForm.fromAccountId).map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Label className="text-xs">المبلغ</Label>
            <Input type="number" value={transferForm.amount} onChange={e => setTransferForm({ ...transferForm, amount: e.target.value })} className="bg-input/30 border-gold/20" />
            <Label className="text-xs">الوصف (اختياري)</Label>
            <Input value={transferForm.description} onChange={e => setTransferForm({ ...transferForm, description: e.target.value })} className="bg-input/30 border-gold/20" />
          </div>
          <DialogFooter>
            <Button onClick={submitTransfer} className="btn-gold">تأكيد التحويل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New account dialog */}
      <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
        <DialogContent className="glass-strong border-gold-soft">
          <DialogHeader><DialogTitle className="gold-text">➕ حساب جديد</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">اسم الحساب</Label>
            <Input value={newAccount.name} onChange={e => setNewAccount({ ...newAccount, name: e.target.value })} className="bg-input/30 border-gold/20" placeholder="مثلاً: رصيد آسياسيل" />
            <Label className="text-xs">النوع</Label>
            <Select value={newAccount.type} onValueChange={v => setNewAccount({ ...newAccount, type: v })}>
              <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="other">عام</SelectItem>
                <SelectItem value="cash">كاش</SelectItem>
                <SelectItem value="box">صندوق</SelectItem>
                <SelectItem value="bank">بنك</SelectItem>
                <SelectItem value="isp_provider">🛰️ مزود إنترنت</SelectItem>
                <SelectItem value="other_provider">مزود آخر</SelectItem>
              </SelectContent>
            </Select>
            <Label className="text-xs">الأيقونة (Emoji)</Label>
            <Input value={newAccount.icon} onChange={e => setNewAccount({ ...newAccount, icon: e.target.value })} className="bg-input/30 border-gold/20 text-xl" />
            <Label className="text-xs">اللون</Label>
            <Input type="color" value={newAccount.color} onChange={e => setNewAccount({ ...newAccount, color: e.target.value })} className="bg-input/30 border-gold/20 h-10" />
          </div>
          <DialogFooter>
            <Button onClick={submitNewAccount} className="btn-gold">إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ISP Providers quick-add dialog */}
      <IspPresetsDialog
        open={ispPresetsOpen}
        onOpenChange={setIspPresetsOpen}
        presets={ISP_PRESETS}
        existingKeys={new Set(accounts.map(a => a.key))}
        onConfirm={addIspProviders}
        loading={ispAdding}
      />
    </div>
  );
}

// =============================================================
// ISP Presets Dialog — quick add ISP providers with separate balances
// =============================================================
function IspPresetsDialog({ open, onOpenChange, presets, existingKeys, onConfirm, loading }) {
  const [selected, setSelected] = useState(() => new Set(presets.map(p => p.key)));

  useEffect(() => {
    if (open) {
      // Pre-select only those NOT already added
      const fresh = new Set(presets.filter(p => !existingKeys.has(p.key)).map(p => p.key));
      setSelected(fresh.size > 0 ? fresh : new Set(presets.map(p => p.key)));
    }
  }, [open]);

  const toggle = (key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-blue-500/40 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-blue-400 flex items-center gap-2">
            🛰️ إضافة مزودي إنترنت
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            اختر المزودين الذين تريد إضافتهم — كل واحد له <span className="font-bold text-blue-400">حساب رصيد منفصل</span> مع تعبئة وصرف خاصة.
          </p>
          <div className="grid grid-cols-1 gap-2 mt-3">
            {presets.map(p => {
              const exists = existingKeys.has(p.key);
              const checked = selected.has(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  disabled={exists}
                  onClick={() => !exists && toggle(p.key)}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                    exists
                      ? 'bg-zinc-500/10 border-zinc-500/30 opacity-50 cursor-not-allowed'
                      : checked
                        ? 'bg-blue-500/10 border-blue-500/60'
                        : 'bg-input/30 border-gold-soft hover:border-gold/40'
                  }`}
                  style={{ borderColor: checked && !exists ? `${p.color}80` : undefined }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{p.icon}</span>
                    <div className="text-right">
                      <p className="font-bold" style={{ color: !exists ? p.color : undefined }}>{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">حساب رصيد منفصل</p>
                    </div>
                  </div>
                  <div className="text-2xl">
                    {exists ? '✅ موجود' : checked ? '☑️' : '⬜'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => onConfirm(Array.from(selected))}
            disabled={loading || selected.size === 0}
            className="btn-gold w-full"
          >
            {loading ? 'جاري الإضافة...' : `إضافة المُختار (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
