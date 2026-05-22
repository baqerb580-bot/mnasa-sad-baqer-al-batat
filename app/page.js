'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { GPSMap, Barcode } from '@/components/maps-barcode';
import { CustomFieldsGrid, CustomFieldsDisplay } from '@/components/custom-fields';
import WhatsAppManager from '@/components/whatsapp-manager';
import IspSyncCenter from '@/components/isp-sync-center';
import BalanceManagement from '@/components/balance-management';
import SeparatedReports from '@/components/separated-reports';
import BarcodeScanner from '@/components/barcode-scanner';
import { sounds, getSoundSettings, setSoundSettings, browserNotify, requestNotificationPermission } from '@/lib/sounds';
import { useRealtimeEvents } from '@/lib/useRealtime';
import { whatsappLink, telegramLink, defaultWhatsAppTemplates, fillTemplate } from '@/lib/messaging';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  LayoutDashboard, ShoppingCart, Package, Wrench, Users, Network, Camera,
  BarChart3, Sparkles, Settings, Search, Plus, Trash2, Edit2, Phone,
  Wifi, MapPin, Activity, AlertTriangle, TrendingUp, DollarSign, Zap,
  Send, Bot, Menu, Bell, ChevronLeft, ChevronRight, Box, CreditCard, FileText, X,
  CheckCircle2, Clock, AlertCircle, Globe, Smartphone, Headphones,
  HardDrive, Plug, Battery, ScanLine, Receipt, ShoppingBag, UserCheck,
  Building2, BarChart, PieChart as PieIcon, Boxes, ChevronDown, Printer, ListTodo, Check, XCircle, LogOut, MessageSquare, QrCode, Power, RefreshCw, Wallet, Brain
} from 'lucide-react';
import AdminLayoutClient from '@/components/admin-layout-client';
import {
  LineChart, Line, AreaChart, Area, BarChart as RBarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadialBarChart, RadialBar
} from 'recharts';

// ============ HELPERS ============
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const fmtCurrency = (n) => `${fmt(n)} د.ع`;

// Safe array helper — guarantees an array is set even if API returns error object
const safeArr = (d) => Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : (Array.isArray(d?.items) ? d.items : []));
const setArr = (setter) => (d) => setter(safeArr(d));

// API base URL — supports separated backend deployment via NEXT_PUBLIC_API_URL
// If not set, falls back to relative '/api/' (same-origin, works on Vercel/Render/etc).
const API_BASE = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL)
  ? String(process.env.NEXT_PUBLIC_API_URL).replace(/\/+$/, '')
  : '';

// Safe API helper — NEVER throws, always returns an object/array.
// On network error or non-2xx response, returns { error, _failed: true } so the UI can guard.
const api = async (path, opts = {}) => {
  const url = API_BASE ? `${API_BASE}/api/${path}` : `/api/${path}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeout || 30000);
    const r = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      signal: controller.signal,
      ...opts,
    });
    clearTimeout(timeoutId);
    const ct = r.headers.get('content-type') || '';
    let body;
    try {
      body = ct.includes('application/json') ? await r.json() : await r.text();
    } catch {
      body = null;
    }
    if (!r.ok) {
      console.warn(`[api] ${r.status} ${path}:`, body);
      // Preserve original shape when possible
      if (body && typeof body === 'object') return { ...body, _failed: true, _status: r.status };
      return { error: `HTTP ${r.status}`, _failed: true, _status: r.status };
    }
    return body ?? {};
  } catch (e) {
    console.warn(`[api] network error for ${path}:`, e?.message);
    return { error: e?.message || 'Network error', _failed: true, _network: true };
  }
};

const MENU = [
  { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard, color: 'gold' },
  {
    id: 'group-pos', label: 'نقطة البيع POS', icon: ShoppingCart, color: 'gold', group: true,
    children: [
      { id: 'pos', label: 'POS نقطة البيع', icon: ShoppingCart },
      { id: 'pos-reports', label: 'الإدارة / تقارير POS', icon: BarChart3 },
      { id: 'products', label: 'المنتجات والمخزون', icon: Package },
    ]
  },
  {
    id: 'group-subscribers', label: 'مشتركو الإنترنت', icon: Wifi, color: 'neon', group: true,
    children: [
      { id: 'subscribers', label: 'مشتركو الإنترنت', icon: Wifi },
      { id: 'activations', label: 'سجل التفعيلات', icon: CheckCircle2 },
      { id: 'agents', label: 'الوكلاء', icon: UserCheck },
      { id: 'networks', label: 'الشبكات / الفاتات', icon: Plug },
      { id: 'zones', label: 'الزونات', icon: Network },
      { id: 'noc', label: 'مراقبة الشبكة NOC', icon: Activity },
    ]
  },
  { id: 'whatsapp', label: 'سجل الواتساب', icon: Send, color: 'gold' },
  { id: 'whatsapp-manager', label: 'إدارة واتساب (QR + إرسال)', icon: MessageSquare, color: 'gold' },
  { id: 'repairs', label: 'صيانة الهواتف', icon: Wrench, color: 'gold' },
  { id: 'cameras', label: 'الكاميرات', icon: Camera, color: 'gold' },
  { id: 'employees', label: 'الموظفون', icon: Users, color: 'gold' },
  { id: 'tasks', label: 'المهام', icon: ListTodo, color: 'neon' },
  { id: 'reports', label: 'التقارير والتحليلات', icon: BarChart3, color: 'neon' },
  { id: 'ai', label: 'المساعد الذكي AI', icon: Sparkles, color: 'gold' },
  { id: 'tg-bot', label: 'بوت الإحصائيات (تليجرام)', icon: Send, color: 'neon' },
  { id: 'orders', label: 'المتجر والطلبات', icon: ShoppingCart, color: 'gold' },
  { id: 'location-requests', label: 'طلبات تعديل المواقع', icon: MapPin, color: 'neon' },
  { id: 'accounting', label: 'المحاسبة المالية', icon: CreditCard, color: 'gold' },
  { id: 'balance', label: 'إدارة الرصيد (Fast/Master)', icon: Wallet, color: 'gold' },
  { id: 'activity', label: 'سجل النشاطات والجلسات', icon: Activity, color: 'rose' },
  { id: 'settings', label: 'الإعدادات', icon: Settings, color: 'neon' },
];

// ============ MAIN APP ============
function App() {
  const [active, setActive] = useState('dashboard');
  const [sidebarOpen, setSidebarOpenRaw] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('sidebar_open') : null;
    if (saved !== null) setSidebarOpenRaw(saved === '1');
    // Request notification permission once
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      setTimeout(() => requestNotificationPermission().catch(() => {}), 2000);
    }
  }, []);

  // Real-time event listener (SSE)
  useRealtimeEvents({
    task_new: (data) => {
      sounds.newTask();
      toast.success(`📋 مهمة جديدة: ${data.title}`, { description: `للموظف: ${data.assignedToName || '-'}` });
      browserNotify('📋 مهمة جديدة', { body: data.title });
      setRefreshKey(k => k + 1);
    },
    subscriber_activated: (data) => {
      sounds.activation();
      toast.success(`✅ تفعيل: ${data.subscriberName}`, { description: `${data.packageName} - ${(data.amount || 0).toLocaleString('en-US')} د.ع` });
      browserNotify('✅ تفعيل مشترك', { body: `${data.subscriberName} - ${data.packageName}` });
      setRefreshKey(k => k + 1);
    },
    attendance_late: (data) => {
      sounds.late();
      toast.warning(`⏰ تأخير: ${data.employeeName}`, { description: `بـ ${data.lateMinutes} دقيقة - خصم ${(data.deductionAmount || 0).toLocaleString('en-US')}` });
      browserNotify('⏰ تأخير موظف', { body: `${data.employeeName} - ${data.lateMinutes}د` });
      setRefreshKey(k => k + 1);
    },
    attendance_checkin: (data) => {
      sounds.checkin();
      toast.info(`📍 حضور: ${data.employeeName}`);
      setRefreshKey(k => k + 1);
    },
    attendance_checkout: (data) => {
      sounds.checkout();
      toast.info(`🚪 انصراف: ${data.employeeName}`, { description: `${data.hoursWorked} ساعة` });
      setRefreshKey(k => k + 1);
    },
    location_request_new: (data) => {
      sounds.notification();
      toast.warning(`📍 طلب تعديل موقع`, { description: `من ${data.employeeName} للمشترك ${data.subscriberName}` });
      browserNotify('📍 طلب تعديل موقع مشترك', { body: `${data.employeeName} → ${data.subscriberName}` });
      setRefreshKey(k => k + 1);
    },
    order_new: (data) => {
      sounds.message();
      toast.success(`🛒 طلب جديد`, { description: data.orderNumber || '' });
      browserNotify('🛒 طلب متجر جديد');
      setRefreshKey(k => k + 1);
    },
  });

  const setSidebarOpen = (v) => {
    const val = typeof v === 'function' ? v(sidebarOpen) : v;
    setSidebarOpenRaw(val);
    try { localStorage.setItem('sidebar_open', val ? '1' : '0'); } catch {}
  };

  return (
    <div className="min-h-screen flex bg-background grid-pattern">
      {/* Sidebar */}
      <Sidebar active={active} setActive={setActive} open={sidebarOpen} setOpen={setSidebarOpen} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar setActive={setActive} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-auto scrollbar-thin p-6">
          {active === 'dashboard' && <Dashboard setActive={setActive} />}
          {active === 'pos' && <POS />}
          {active === 'pos-reports' && <POSManagerReports />}
          {active === 'products' && <Products />}
          {active === 'subscribers' && <Subscribers />}
          {active === 'activations' && <ActivationsLog />}
          {active === 'agents' && <Agents />}
          {active === 'networks' && <Networks />}
          {active === 'zones' && <Zones />}
          {active === 'noc' && <NOC />}
          {active === 'whatsapp' && <WhatsAppLog />}
          {active === 'whatsapp-manager' && <WhatsAppManager api={api} />}
          {active === 'repairs' && <Repairs />}
          {active === 'cameras' && <Cameras />}
          {active === 'employees' && <Employees />}
          {active === 'reports' && <Reports />}
          {active === 'tasks' && <TasksManager />}
          {active === 'ai' && <AIAssistant />}
          {active === 'tg-bot' && <TelegramBotPage />}
          {active === 'orders' && <OrdersAdminPage />}
          {active === 'location-requests' && <LocationRequestsPage />}
          {active === 'accounting' && <AccountingPage />}
          {active === 'balance' && <BalanceManagement api={api} />}
          {active === 'activity' && <ActivityLogsPage />}
          {active === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

// ============ SIDEBAR ============
function Sidebar({ active, setActive, open, setOpen }) {
  // Tracks which group is expanded - auto-expand the group containing the active page
  const [expanded, setExpanded] = useState(() => {
    const init = {};
    MENU.forEach(m => {
      if (m.group && m.children?.some(c => c.id === active)) init[m.id] = true;
    });
    return init;
  });

  // Keep expanded state in sync when active changes (e.g., via dashboard quick access)
  useEffect(() => {
    MENU.forEach(m => {
      if (m.group && m.children?.some(c => c.id === active) && !expanded[m.id]) {
        setExpanded(e => ({ ...e, [m.id]: true }));
      }
    });
  }, [active]);

  const toggleGroup = (gid) => {
    if (!open) { setOpen(true); setTimeout(() => setExpanded(e => ({ ...e, [gid]: true })), 50); return; }
    setExpanded(e => ({ ...e, [gid]: !e[gid] }));
  };

  return (
    <aside className={`glass-strong border-l border-gold-soft transition-all duration-300 ${open ? 'w-72' : 'w-20'} flex flex-col relative`}>
      {/* Collapse Toggle */}
      <button
        onClick={() => setOpen(!open)}
        title={open ? 'إخفاء الشريط' : 'إظهار الشريط'}
        className="absolute -left-3 top-7 w-7 h-7 rounded-full bg-gold-gradient shadow-gold-glow flex items-center justify-center hover:scale-110 transition-transform z-30 border-2 border-background"
      >
        {open ? <ChevronRight className="w-4 h-4 text-background" /> : <ChevronLeft className="w-4 h-4 text-background" />}
      </button>
      {/* Logo */}
      <div className="p-5 border-b border-gold-soft flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-gold-glow overflow-hidden bg-background">
          <img src="/logo-icon.png" alt="مركز الغزلان" className="w-full h-full object-contain" />
        </div>
        {open && (
          <div>
            <h1 className="text-lg font-black gold-text leading-tight">مركز الغزلان</h1>
            <p className="text-[10px] text-muted-foreground">ERP · NOC · POS · AI</p>
          </div>
        )}
      </div>

      {/* Menu */}
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {MENU.map((item) => {
            const Icon = item.icon;

            // Group with children
            if (item.group) {
              const isOpen = !!expanded[item.id];
              const childActive = item.children?.some(c => c.id === active);
              return (
                <div key={item.id}>
                  <div
                    onClick={() => toggleGroup(item.id)}
                    className={`sidebar-item ${childActive ? 'active' : ''} ${!open ? 'justify-center' : ''} cursor-pointer`}
                    title={item.label}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${childActive ? 'text-gold' : ''}`} />
                    {open && (
                      <>
                        <span className="truncate flex-1">{item.label}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                      </>
                    )}
                  </div>
                  {open && isOpen && (
                    <div className="mr-3 mt-1 mb-2 pr-3 border-r-2 border-gold/30 space-y-0.5">
                      {item.children.map(c => {
                        const CIcon = c.icon;
                        const cActive = active === c.id;
                        return (
                          <div
                            key={c.id}
                            onClick={() => setActive(c.id)}
                            className={`sidebar-item ${cActive ? 'active' : ''}`}
                            title={c.label}
                          >
                            <CIcon className={`w-4 h-4 flex-shrink-0 ${cActive ? 'text-gold' : ''}`} />
                            <span className="truncate text-[13px]">{c.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Regular item
            const isActive = active === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setActive(item.id)}
                className={`sidebar-item ${isActive ? 'active' : ''} ${!open ? 'justify-center' : ''}`}
                title={item.label}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-gold' : ''}`} />
                {open && <span className="truncate">{item.label}</span>}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-gold-soft">
        <div className={`glass-card rounded-xl p-3 ${!open && 'text-center'}`}>
          <div className={`flex items-center gap-2 ${!open && 'justify-center'}`}>
            <div className="w-9 h-9 rounded-full bg-neon-gradient flex items-center justify-center">
              <span className="text-sm font-bold">ك</span>
            </div>
            {open && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">كرار الغزلان</p>
                <p className="text-[10px] text-muted-foreground">مدير عام</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

// ============ TOP BAR ============
function TopBar({ setActive, sidebarOpen, setSidebarOpen }) {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, []);

  return (
    <header className="glass-strong border-b border-gold-soft px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="hover:bg-gold/10">
          <Menu className="w-5 h-5 text-gold" />
        </Button>
        <div>
          <h2 className="text-lg font-bold gold-text">منصة إدارة الأعمال الذكية</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            النظام يعمل · {time}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-2 px-4 py-2 glass-card rounded-xl">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث سريع..." className="border-0 bg-transparent w-48 focus-visible:ring-0" />
        </div>
        <Button variant="ghost" size="icon" className="relative hover:bg-gold/10" onClick={() => setActive('ai')}>
          <Sparkles className="w-5 h-5 text-gold" />
        </Button>
        <ThemeToggle />
        <AdminNotificationsBell setActive={setActive} />
      </div>
    </header>
  );
}

// ============ THEME TOGGLE ============
function ThemeToggle() {
  const [theme, setTheme] = useState('dark');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('app_theme') || 'dark';
    setTheme(saved);
    if (saved === 'light') document.documentElement.classList.add('theme-light');
    else document.documentElement.classList.remove('theme-light');
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('app_theme', next); } catch {}
    if (next === 'light') document.documentElement.classList.add('theme-light');
    else document.documentElement.classList.remove('theme-light');
    sounds.click();
    toast.success(next === 'light' ? '☀️ الثيم الفاتح (أبيض حليبي + ذهبي)' : '🌙 الثيم الداكن (أسود + ذهبي)');
  };
  return (
    <Button
      variant="ghost"
      onClick={toggle}
      className="relative hover:bg-gold/10 px-3 gap-1.5 h-9"
      title={theme === 'dark' ? 'تبديل إلى الثيم الفاتح' : 'تبديل إلى الثيم الداكن'}
    >
      <span className="text-base">{theme === 'dark' ? '☀️' : '🌙'}</span>
      <span className="hidden md:inline text-xs font-bold">{theme === 'dark' ? 'فاتح' : 'داكن'}</span>
    </Button>
  );
}

// ============ ADMIN NOTIFICATIONS BELL ============
function AdminNotificationsBell({ setActive }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('unread'); // unread | all | resolved
  const lastCountRef = useRef(0);

  const playBeep = () => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = 1000;
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o.start(); o.stop(ctx.currentTime + 0.5);
    } catch {}
  };

  const load = async () => {
    const data = await api('notifications/admin');
    if (Array.isArray(data)) {
      setItems(data);
      const unread = data.filter(n => !n.read && !n.resolved).length;
      if (unread > lastCountRef.current && lastCountRef.current > 0) playBeep();
      lastCountRef.current = unread;
    }
  };
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, []);

  const unread = items.filter(n => !n.read && !n.resolved).length;
  const markAllRead = async (e) => { e?.stopPropagation(); await api('notifications/admin/read-all', { method: 'POST' }); load(); };

  // ============ Click navigates to entity ============
  const handleClick = async (n) => {
    try {
      const r = await api(`notifications/${n.id}/click`, { method: 'POST' });
      // Navigate to entity if there's an actionUrl/entityType
      if (r?.entityType) {
        const routeMap = {
          task: 'tasks',
          subscriber: 'subscribers',
          order: 'ecommerce',
          repair: 'repairs',
          activation: 'subscribers',
          agent: 'agents',
          employee: 'employees',
          whatsapp: 'whatsapp-manager',
          location_request: 'location-requests',
          leave: 'employees',
          advance: 'employees',
        };
        const route = routeMap[r.entityType];
        if (route && setActive) {
          setActive(route);
          setOpen(false);
        }
      }
    } catch {}
    load();
  };

  // ============ Resolve / Reopen / Delete ============
  const resolveNotif = async (e, n) => {
    e.stopPropagation();
    const note = prompt('ملاحظة المعالجة (اختيارية):') || '';
    const r = await api(`notifications/${n.id}/resolve`, { method: 'POST', body: JSON.stringify({ note, resolvedBy: 'المدير' }) });
    if (r?.success) toast.success('✅ تمت معالجة الإشعار');
    load();
  };
  const reopenNotif = async (e, n) => {
    e.stopPropagation();
    await api(`notifications/${n.id}/reopen`, { method: 'POST' });
    toast.info('🔁 تم إعادة فتح الإشعار');
    load();
  };
  const deleteNotif = async (e, n) => {
    e.stopPropagation();
    if (!confirm('حذف هذا الإشعار؟')) return;
    await api(`notifications/${n.id}`, { method: 'DELETE' });
    load();
  };

  // ============ Quick action buttons (type-specific) ============
  const quickAction = async (e, n, action) => {
    e.stopPropagation();
    let endpoint, body = {}, successMsg = '✅ تم';
    try {
      if (action === 'approve_leave') {
        endpoint = `leaves/${n.entityId}/approve`;
        body = { approvedBy: 'المدير' };
        successMsg = '✅ تمت الموافقة على الإجازة';
      } else if (action === 'reject_leave') {
        const reason = prompt('سبب الرفض (اختياري):') || '';
        endpoint = `leaves/${n.entityId}/reject`;
        body = { reason };
        successMsg = '❌ تم رفض الإجازة';
      } else if (action === 'approve_advance') {
        endpoint = `advances/${n.entityId}/approve`;
        body = { approvedBy: 'المدير' };
        successMsg = '✅ تمت الموافقة على السلفة';
      } else if (action === 'reject_advance') {
        const reason = prompt('سبب الرفض (اختياري):') || '';
        endpoint = `advances/${n.entityId}/reject`;
        body = { reason };
        successMsg = '❌ تم رفض السلفة';
      } else if (action === 'approve_task') {
        endpoint = `tasks/${n.entityId}/review`;
        body = { action: 'approve', reviewerName: 'المدير' };
        successMsg = '✅ تم قبول المهمة';
      } else if (action === 'revise_task') {
        const notes = prompt('ملاحظات للتعديل:') || '';
        if (!notes) return;
        endpoint = `tasks/${n.entityId}/review`;
        body = { action: 'revise', notes, reviewerName: 'المدير' };
        successMsg = '↻ طُلِب التعديل';
      } else if (action === 'reject_task') {
        const notes = prompt('سبب الرفض:') || '';
        if (!notes) return;
        endpoint = `tasks/${n.entityId}/review`;
        body = { action: 'reject', notes, reviewerName: 'المدير' };
        successMsg = '❌ تم رفض المهمة';
      } else return;

      const r = await api(endpoint, { method: 'POST', body: JSON.stringify(body) });
      if (r?.success || (!r?._failed && !r?.error)) {
        toast.success(successMsg);
        // Auto-resolve the notification
        await api(`notifications/${n.id}/resolve`, { method: 'POST', body: JSON.stringify({ note: action, resolvedBy: 'المدير' }) });
      } else {
        toast.error('فشل: ' + (r?.error || 'خطأ غير معروف'));
      }
    } catch (err) {
      toast.error('خطأ: ' + (err?.message || ''));
    } finally { load(); }
  };

  const NOTIF_COLOR = {
    attendance_late: 'border-orange-500/40 bg-orange-500/5',
    attendance_checkin: 'border-cyan-500/40 bg-cyan-500/5',
    attendance_checkout: 'border-purple-500/40 bg-purple-500/5',
    leave_request: 'border-amber-500/40 bg-amber-500/5',
    advance_request: 'border-yellow-500/40 bg-yellow-500/5',
    task_new: 'border-gold/40 bg-gold/5',
    task_started: 'border-cyan-500/40 bg-cyan-500/5',
    task_completed: 'border-emerald-500/40 bg-emerald-500/5',
    task_transferred: 'border-violet-500/40 bg-violet-500/5',
    task_transferred_in: 'border-violet-500/40 bg-violet-500/5',
    task_transferred_out: 'border-zinc-500/40 bg-zinc-500/5',
    task_reviewed: 'border-amber-500/40 bg-amber-500/5',
    task_submitted: 'border-purple-500/40 bg-purple-500/5',
    task_accepted: 'border-emerald-500/40 bg-emerald-500/5',
    task_rejected: 'border-red-500/40 bg-red-500/5',
  };

  const filtered = items.filter(n => {
    if (n.deleted) return false;
    if (tab === 'unread') return !n.read && !n.resolved;
    if (tab === 'resolved') return n.resolved;
    return true;
  });

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" className="relative hover:bg-gold/10" onClick={() => setOpen(!open)}>
        <Bell className={`w-5 h-5 text-gold ${unread > 0 ? 'animate-pulse' : ''}`} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold animate-bounce">{unread}</span>
        )}
      </Button>
      {open && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[150]" onClick={() => setOpen(false)} />
          <div className="fixed left-4 top-16 w-[440px] max-h-[80vh] overflow-y-auto border border-gold/40 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.85)] z-[200]" style={{ backgroundColor: 'rgb(15, 15, 25)' }}>
            <div className="p-3 border-b border-gold-soft sticky top-0 z-10" style={{ backgroundColor: 'rgb(15, 15, 25)' }}>
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-bold gold-text flex items-center gap-2"><Bell className="w-4 h-4" /> الإشعارات ({unread} غير مقروء)</p>
                {unread > 0 && <button onClick={markAllRead} className="text-[10px] text-cyan-400 hover:underline">قراءة الكل</button>}
              </div>
              <div className="flex gap-1 text-[10px]">
                <button onClick={(e) => { e.stopPropagation(); setTab('unread'); }} className={`px-2 py-1 rounded ${tab === 'unread' ? 'bg-gold/20 text-gold' : 'hover:bg-input/30'}`}>غير مقروء ({items.filter(n => !n.read && !n.resolved && !n.deleted).length})</button>
                <button onClick={(e) => { e.stopPropagation(); setTab('all'); }} className={`px-2 py-1 rounded ${tab === 'all' ? 'bg-gold/20 text-gold' : 'hover:bg-input/30'}`}>الكل</button>
                <button onClick={(e) => { e.stopPropagation(); setTab('resolved'); }} className={`px-2 py-1 rounded ${tab === 'resolved' ? 'bg-gold/20 text-gold' : 'hover:bg-input/30'}`}>تمت المعالجة ({items.filter(n => n.resolved).length})</button>
              </div>
            </div>
            {filtered.length === 0 ? (
              <p className="p-6 text-xs text-center text-muted-foreground">لا توجد إشعارات</p>
            ) : filtered.map(n => {
              const c = NOTIF_COLOR[n.type] || 'border-gold-soft/30';
              const canClick = !!n.entityType && n.entityType !== 'generic';
              return (
                <div key={n.id}
                  onClick={() => canClick && handleClick(n)}
                  className={`p-3 border-l-4 border-b border-gold-soft/30 ${canClick ? 'cursor-pointer hover:bg-input/30' : 'cursor-default'} ${c} ${!n.read && !n.resolved ? 'font-semibold' : ''} ${n.resolved ? 'opacity-60' : ''} transition-all group`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && !n.resolved && <span className="mt-1 w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0 animate-pulse" />}
                    {n.resolved && <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-1" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold">{n.icon || ''} {n.title}</p>
                        {n.priority === 'high' && <Badge className="bg-red-500/15 text-red-400 border-red-500/40 text-[8px]">عاجل</Badge>}
                        {n.priority === 'critical' && <Badge className="bg-red-500/20 text-red-400 border-red-500/50 text-[8px] animate-pulse">حرج</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 whitespace-pre-line">{n.message}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[9px] text-muted-foreground">{new Date(n.createdAt).toLocaleString('ar-IQ')}</p>
                        {n.resolved && (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/40 text-[8px]">
                            <CheckCircle2 className="w-2.5 h-2.5 ml-1" /> تمت المعالجة {n.resolvedBy ? `بواسطة ${n.resolvedBy}` : ''}
                          </Badge>
                        )}
                      </div>
                      {!n.resolved && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {/* Type-specific quick actions */}
                          {n.type === 'leave_request' && n.entityId && (
                            <>
                              <button onClick={(e) => quickAction(e, n, 'approve_leave')} className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/25 font-bold">✅ موافقة إجازة</button>
                              <button onClick={(e) => quickAction(e, n, 'reject_leave')} className="text-[9px] px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/40 hover:bg-red-500/25 font-bold">❌ رفض</button>
                            </>
                          )}
                          {n.type === 'advance_request' && n.entityId && (
                            <>
                              <button onClick={(e) => quickAction(e, n, 'approve_advance')} className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/25 font-bold">✅ موافقة سلفة</button>
                              <button onClick={(e) => quickAction(e, n, 'reject_advance')} className="text-[9px] px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/40 hover:bg-red-500/25 font-bold">❌ رفض</button>
                            </>
                          )}
                          {n.type === 'task_submitted' && n.entityId && (
                            <>
                              <button onClick={(e) => quickAction(e, n, 'approve_task')} className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/25 font-bold">✅ قبول التقرير</button>
                              <button onClick={(e) => quickAction(e, n, 'revise_task')} className="text-[9px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/40 hover:bg-amber-500/25 font-bold">↻ تعديل</button>
                              <button onClick={(e) => quickAction(e, n, 'reject_task')} className="text-[9px] px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/40 hover:bg-red-500/25 font-bold">❌ رفض</button>
                            </>
                          )}
                          {/* Universal actions */}
                          {canClick && (
                            <button onClick={(e) => { e.stopPropagation(); handleClick(n); }} className="text-[9px] px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500/25">↗ فتح</button>
                          )}
                          <button onClick={(e) => resolveNotif(e, n)} className="text-[9px] px-2 py-0.5 rounded bg-zinc-500/15 text-zinc-300 border border-zinc-500/40 hover:bg-zinc-500/25">✓ معالجة</button>
                          <button onClick={(e) => deleteNotif(e, n)} className="text-[9px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20">🗑️</button>
                        </div>
                      )}
                      {n.resolved && (
                        <button onClick={(e) => reopenNotif(e, n)} className="mt-2 text-[9px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/40 hover:bg-amber-500/25">🔁 إعادة فتح</button>
                      )}
                      {n.resolutionNote && (
                        <p className="text-[9px] text-emerald-400 mt-1 italic">📝 {n.resolutionNote}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// ============ WHATSAPP PER-SUBSCRIBER SEND BUTTON ============
function WhatsAppSubscriberButton({ subscriber }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMsg, setCustomMsg] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const d = await api(`whatsapp/history/${subscriber.id}`);
      setHistory(Array.isArray(d) ? d : []);
    } finally { setHistoryLoading(false); }
  };

  const sendTpl = async (templateKey, label, extraVars = {}) => {
    if (!subscriber?.phone) { toast.error('لا يوجد رقم هاتف'); return; }
    setSending(templateKey);
    try {
      const r = await api('whatsapp/send', { method: 'POST', body: JSON.stringify({ subscriberId: subscriber.id, templateKey, vars: extraVars }) });
      if (r?.success) toast.success(`📤 تم إرسال ${label}`);
      else if (r?.queued) toast.info('⏳ تم وضع الرسالة في الطابور (WhatsApp غير متصل)');
      else toast.error('فشل: ' + (r?.error || ''));
    } catch (e) {
      toast.error('خطأ: ' + e.message);
    } finally {
      setSending(null);
      setOpen(false);
    }
  };

  const sendCustom = async () => {
    if (!customMsg.trim()) return;
    setSending('custom');
    try {
      const r = await api('whatsapp/send', { method: 'POST', body: JSON.stringify({ subscriberId: subscriber.id, message: customMsg }) });
      if (r?.success) toast.success('📤 تم الإرسال');
      else if (r?.queued) toast.info('⏳ تم وضع الرسالة في الطابور');
      else toast.error('فشل: ' + (r?.error || ''));
      setCustomOpen(false);
      setCustomMsg('');
    } finally { setSending(null); }
  };

  if (!subscriber?.phone) return null;

  return (
    <>
      <div className="relative inline-block">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 hover:text-emerald-500 text-emerald-400"
          onClick={() => setOpen(!open)}
          title="إرسال واتساب"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </Button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute z-50 left-0 top-8 w-56 glass-strong border border-emerald-500/30 rounded-lg shadow-2xl p-1">
              <button onClick={() => sendTpl('activation', 'رسالة تفعيل')} disabled={!!sending} className="w-full text-right text-xs px-3 py-2 hover:bg-emerald-500/10 rounded flex items-center gap-2">
                <span>🎉</span> رسالة تفعيل
              </button>
              <button onClick={() => sendTpl('expiry', 'رسالة انتهاء')} disabled={!!sending} className="w-full text-right text-xs px-3 py-2 hover:bg-amber-500/10 rounded flex items-center gap-2">
                <span>⏰</span> رسالة انتهاء الاشتراك
              </button>
              <button onClick={() => sendTpl('expiry_alert', 'تنبيه قبل الانتهاء', { daysLeft: 5 })} disabled={!!sending} className="w-full text-right text-xs px-3 py-2 hover:bg-cyan-500/10 rounded flex items-center gap-2">
                <span>🔔</span> تنبيه قبل الانتهاء
              </button>
              <button onClick={() => sendTpl('debt', 'رسالة دين')} disabled={!!sending} className="w-full text-right text-xs px-3 py-2 hover:bg-red-500/10 rounded flex items-center gap-2">
                <span>💸</span> رسالة دين / مستحقات
              </button>
              <button onClick={() => sendTpl('receipt', 'وصل الاشتراك')} disabled={!!sending} className="w-full text-right text-xs px-3 py-2 hover:bg-violet-500/10 rounded flex items-center gap-2">
                <span>🧾</span> إرسال وصل الاشتراك
              </button>
              <div className="border-t border-gold-soft my-1"></div>
              <button onClick={() => { setOpen(false); setCustomOpen(true); }} className="w-full text-right text-xs px-3 py-2 hover:bg-gold/10 rounded flex items-center gap-2">
                <span>✍️</span> رسالة مخصصة
              </button>
              <button onClick={() => { setOpen(false); setHistoryOpen(true); loadHistory(); }} className="w-full text-right text-xs px-3 py-2 hover:bg-gold/10 rounded flex items-center gap-2">
                <span>📜</span> سجل رسائل هذا المشترك
              </button>
            </div>
          </>
        )}
      </div>
      {customOpen && (
        <Dialog open={customOpen} onOpenChange={setCustomOpen}>
          <DialogContent className="glass-strong border-emerald-500/30">
            <DialogHeader>
              <DialogTitle className="text-emerald-400 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> رسالة واتساب إلى {subscriber.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground">إلى: <span dir="ltr" className="font-mono text-cyan-400">{subscriber.phone}</span></p>
              <Textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)} rows={6} placeholder="اكتب رسالتك هنا..." className="bg-input/30 border-gold/20" />
            </div>
            <DialogFooter>
              <Button onClick={sendCustom} disabled={!customMsg.trim() || sending === 'custom'} className="btn-gold">
                <Send className="w-3 h-3 ml-1" /> إرسال
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {historyOpen && (
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="glass-strong border-emerald-500/30 max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-emerald-400 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> سجل رسائل {subscriber.name}
                <span className="text-[10px] text-muted-foreground" dir="ltr">({subscriber.phone})</span>
              </DialogTitle>
            </DialogHeader>
            {historyLoading ? <p className="text-center text-muted-foreground py-6">جاري التحميل…</p> :
            history.length === 0 ? <p className="text-center text-muted-foreground py-6">لا توجد رسائل بعد</p> :
            <div className="space-y-2">
              {history.map(m => (
                <div key={m.id} className={`glass-card rounded-lg p-3 text-xs border ${m.status === 'sent' ? 'border-emerald-500/30' : m.status === 'failed' ? 'border-red-500/30' : 'border-amber-500/30'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-[9px]">{m.type}</Badge>
                    <span className="text-[10px] text-muted-foreground">{m.createdAt ? new Date(m.createdAt).toLocaleString('ar-IQ') : ''}</span>
                  </div>
                  <p className="whitespace-pre-line text-[11px] mb-1">{m.message}</p>
                  <div className="flex items-center gap-2">
                    {m.status === 'sent' && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[9px]"><CheckCircle2 className="w-3 h-3 ml-1" /> مرسلة</Badge>}
                    {m.status === 'failed' && <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-[9px]"><XCircle className="w-3 h-3 ml-1" /> فاشلة</Badge>}
                    {m.status === 'queued' && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[9px]"><Clock className="w-3 h-3 ml-1" /> منتظرة</Badge>}
                    {m.error && <span className="text-[9px] text-red-400">⚠ {m.error}</span>}
                  </div>
                </div>
              ))}
            </div>}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ============ DASHBOARD ============
function Dashboard({ setActive }) {
  // Safe shape — never undefined arrays/nums (prevents .length crashes when API fails)
  const DEFAULT_STATS = {
    totalProducts: 0, totalSubscribers: 0, activeSubscribers: 0, totalRepairs: 0, pendingRepairs: 0,
    totalEmployees: 0, totalZones: 0, onlineZones: 0, totalRevenue: 0, monthlyIncome: 0,
    totalDebt: 0, lowStockCount: 0, lowStock: [], salesChart: [],
  };
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loadError, setLoadError] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const s = await api('dashboard/stats');
        if (s && !s._failed) {
          // Merge with defaults to guarantee shape
          setStats({
            ...DEFAULT_STATS,
            ...s,
            lowStock: Array.isArray(s.lowStock) ? s.lowStock : [],
            salesChart: Array.isArray(s.salesChart) ? s.salesChart : [],
          });
        } else {
          setStats(DEFAULT_STATS);
          setLoadError(s?.error || 'تعذر تحميل لوحة المعلومات');
        }
      } catch (e) {
        setStats(DEFAULT_STATS);
        setLoadError(e?.message || 'خطأ غير متوقع');
      }
      try {
        const d = await api('ai/insights');
        setInsights(Array.isArray(d?.insights) ? d.insights : []);
      } catch { setInsights([]); }
    })();
  }, []);

  if (!stats) return <LoadingScreen />;

  const cards = [
    { label: 'إجمالي المشتركين', value: stats.totalSubscribers, sub: `${stats.activeSubscribers} نشط`, icon: Wifi, color: 'from-amber-500 to-yellow-600', glow: 'shadow-gold-glow', target: 'subscribers' },
    { label: 'دخل الاشتراكات/شهر', value: fmtCurrency(stats.monthlyIncome), icon: DollarSign, color: 'from-emerald-500 to-teal-600', target: 'activations' },
    { label: 'مبيعات POS', value: fmtCurrency(stats.totalRevenue), icon: ShoppingCart, color: 'from-cyan-500 to-blue-600', glow: 'shadow-neon-glow', target: 'pos' },
    { label: 'الزونات النشطة', value: `${stats.onlineZones}/${stats.totalZones}`, icon: Network, color: 'from-purple-500 to-pink-600', target: 'noc' },
    { label: 'صيانات قيد التنفيذ', value: stats.pendingRepairs, sub: `من ${stats.totalRepairs} إجمالي`, icon: Wrench, color: 'from-orange-500 to-red-600', target: 'repairs' },
    { label: 'منتجات بالمخزون', value: stats.totalProducts, sub: `${stats.lowStockCount} نواقص`, icon: Package, color: 'from-indigo-500 to-purple-600', target: 'products' },
    { label: 'إجمالي الديون', value: fmtCurrency(stats.totalDebt), icon: AlertCircle, color: 'from-rose-500 to-red-600', target: 'accounting' },
    { label: 'الموظفون', value: stats.totalEmployees, icon: Users, color: 'from-fuchsia-500 to-purple-600', target: 'employees' },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {loadError && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 p-3 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>تعذّر الاتصال ببعض الخدمات. يتم عرض بيانات محدودة. ({loadError})</span>
        </div>
      )}
      {/* Hero */}
      <div className="glass-strong rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-gold/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl"></div>
        <div className="relative flex items-center gap-5">
          <img src="/logo-shield.png" alt="شعار مركز الغزلان" className="w-24 h-32 object-contain flex-shrink-0 drop-shadow-2xl hidden md:block" />
          <div>
            <h1 className="text-4xl font-black gold-text mb-2">أهلاً بك في مركز الغزلان</h1>
            <p className="text-muted-foreground">منصة ERP متكاملة - مبيعات، شبكات، صيانة، وذكاء اصطناعي في مكان واحد</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button onClick={() => setActive('pos')} className="btn-gold">
                <ShoppingCart className="w-4 h-4 ml-2" /> فتح نقطة البيع
              </Button>
              <Button onClick={() => setActive('ai')} className="btn-neon">
                <Sparkles className="w-4 h-4 ml-2" /> اسأل المساعد الذكي
              </Button>
              <Button onClick={() => setActive('noc')} variant="outline" className="border-gold/30 hover:border-gold">
                <Activity className="w-4 h-4 ml-2" /> مراقبة الشبكة
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={i}
              onClick={() => c.target && setActive(c.target)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') c.target && setActive(c.target); }}
              className={`stat-card group cursor-pointer transition-all hover:-translate-y-1 hover:border-gold/60 ${c.glow || ''}`}
              title={`فتح ${c.label}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
              <p className="text-xl font-bold text-foreground truncate">{c.value}</p>
              {c.sub && <p className="text-[10px] text-muted-foreground mt-1">{c.sub}</p>}
              <p className="text-[9px] text-gold/60 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">← فتح القسم</p>
            </div>
          );
        })}
      </div>

      {/* Quick Access Tiles - All Modules */}
      <Card className="glass-strong border-gold-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 gold-text">
            <LayoutDashboard className="w-4 h-4" /> الوصول السريع لكل الأقسام
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {MENU.flatMap(m => m.group ? m.children.map(c => ({ ...c, parentLabel: m.label, color: m.color })) : [m]).filter(m => m.id !== 'dashboard').map(m => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setActive(m.id)}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-input/30 border border-gold-soft hover:border-gold hover:bg-gold/10 hover:-translate-y-0.5 transition-all group"
                  title={m.label}
                >
                  <Icon className="w-5 h-5 text-gold group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-center leading-tight line-clamp-2">{m.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* AI Insights */}
      {Array.isArray(insights) && insights.length > 0 && (
        <Card className="glass-strong border-gold-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 gold-text">
              <Sparkles className="w-5 h-5" /> تنبيهات وتوصيات ذكية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {insights.map((ins, i) => (
                <div key={i} className={`glass-card rounded-xl p-4 border ${
                  ins.type === 'critical' ? 'border-red-500/40' :
                  ins.type === 'warning' ? 'border-amber-500/40' :
                  ins.type === 'success' ? 'border-emerald-500/40' : 'border-cyan-500/40'
                }`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{ins.icon}</span>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm mb-1">{ins.title}</h4>
                      <p className="text-xs text-muted-foreground">{ins.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2 glass-strong border-gold-soft">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><BarChart className="w-4 h-4 text-gold" /> مبيعات آخر 7 أيام</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={stats.salesChart}>
                <defs>
                  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFD700" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#FFD700" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,215,0,0.1)" />
                <XAxis dataKey="name" stroke="#888" fontSize={11} />
                <YAxis stroke="#888" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0a0a0f', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 8 }} />
                <Area type="monotone" dataKey="sales" stroke="#FFD700" fillOpacity={1} fill="url(#gold)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-strong border-gold-soft">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Boxes className="w-4 h-4 text-gold" /> منتجات على وشك النفاد</CardTitle>
          </CardHeader>
          <CardContent>
            {!Array.isArray(stats.lowStock) || stats.lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">المخزون بحالة ممتازة ✓</p>
            ) : (
              <div className="space-y-3">
                {stats.lowStock.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{p.image}</span>
                      <div>
                        <p className="text-sm font-semibold">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.sku}</p>
                      </div>
                    </div>
                    <Badge variant="destructive">{p.stock} متبقي</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============ POS ============
function POS() {
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

// ============ POS PRINT HELPERS ============
function printPOSInvoice(s) {
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) { alert('فعّل نوافذ الـ popup للطباعة'); return; }
  const itemsHtml = (s.items || []).map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${it.name}</td>
      <td style="text-align:center">${it.quantity}</td>
      <td style="text-align:left">${Number(it.price).toLocaleString('en-US')}</td>
      <td style="text-align:left">${(Number(it.price) * Number(it.quantity)).toLocaleString('en-US')}</td>
    </tr>`).join('');
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>فاتورة ${s.invoiceNumber}</title>
    <style>
      @page { size: A4; margin: 1.5cm; }
      body{font-family:'Cairo','Tahoma',sans-serif;color:#1a1a1a;padding:0;margin:0}
      .header{text-align:center;border-bottom:3px double #B45309;padding-bottom:12px;margin-bottom:16px}
      .header h1{color:#B45309;margin:0;font-size:28px;font-weight:900}
      .header p{margin:4px 0;font-size:12px;color:#555}
      .meta{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px;font-size:13px}
      .meta div{padding:6px 10px;background:#fef9e7;border-right:3px solid #D97706;border-radius:4px}
      .meta strong{display:block;color:#92400E;font-size:10px;margin-bottom:2px}
      table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
      th{background:#B45309;color:white;padding:10px 6px;text-align:right;font-weight:700}
      td{padding:8px 6px;border-bottom:1px solid #f3e8b8;text-align:right}
      tr:nth-child(even){background:#fffbeb}
      .totals{margin-top:16px;padding:14px;background:#fef3c7;border-radius:8px;font-size:14px}
      .totals .row{display:flex;justify-content:space-between;padding:4px 0}
      .totals .grand{font-size:20px;font-weight:900;color:#B45309;border-top:2px solid #B45309;padding-top:8px;margin-top:8px}
      .footer{text-align:center;margin-top:24px;padding-top:12px;border-top:2px dashed #D97706;color:#666;font-size:11px}
      .footer .thanks{font-size:16px;font-weight:700;color:#B45309;margin-bottom:6px}
      @media print { body{margin:0;padding:0} .no-print{display:none} }
    </style></head><body>
    <div class="header">
      <h1>🏢 مركز الغزلان</h1>
      <p>ERP · POS · ISP · خدمات الإنترنت والصيانة</p>
      <p>📞 07707889032 · 📍 العراق</p>
    </div>
    <div class="meta">
      <div><strong>رقم الفاتورة</strong>${s.invoiceNumber || s.id}</div>
      <div><strong>التاريخ والوقت</strong>${new Date(s.createdAt).toLocaleString('ar-IQ')}</div>
      <div><strong>الكاشير</strong>${s.cashierName || '-'}</div>
      <div><strong>الزبون</strong>${s.customer || '-'}</div>
    </div>
    <table>
      <thead><tr><th style="width:40px">#</th><th>المنتج</th><th style="width:70px;text-align:center">الكمية</th><th style="width:100px;text-align:left">السعر</th><th style="width:110px;text-align:left">الإجمالي</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="totals">
      <div class="row"><span>المجموع الفرعي:</span><span>${Number(s.subtotal || 0).toLocaleString('en-US')} د.ع</span></div>
      ${Number(s.discount) > 0 ? `<div class="row" style="color:#B91C1C"><span>الخصم${s.discountReason ? ' (' + s.discountReason + ')' : ''}:</span><span>-${Number(s.discount).toLocaleString('en-US')} د.ع</span></div>` : ''}
      <div class="row"><span>طريقة الدفع:</span><span>${s.paymentMethod || 'نقد'}</span></div>
      <div class="row grand"><span>الإجمالي:</span><span>${Number(s.total || 0).toLocaleString('en-US')} د.ع</span></div>
    </div>
    <div class="footer">
      <div class="thanks">شكراً لزيارتكم 🙏</div>
      <p>هذه الفاتورة سند رسمي - يرجى الاحتفاظ بها</p>
    </div>
    <div class="no-print" style="text-align:center;margin-top:20px"><button onclick="window.print()" style="padding:10px 30px;font-size:16px;background:#B45309;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold">🖨️ طباعة الآن</button></div>
    <script>setTimeout(()=>window.print(),500);</script>
    </body></html>`);
  w.document.close();
}

function printPOSReceipt(s) {
  // Thermal 80mm receipt
  const w = window.open('', '_blank', 'width=400,height=700');
  if (!w) { alert('فعّل نوافذ الـ popup للطباعة'); return; }
  const itemsHtml = (s.items || []).map(it => `
    <tr>
      <td style="padding:2px 0">${it.name}</td>
      <td style="text-align:center;padding:2px 0">${it.quantity}</td>
      <td style="text-align:left;padding:2px 0">${(Number(it.price) * Number(it.quantity)).toLocaleString('en-US')}</td>
    </tr>`).join('');
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>وصل ${s.invoiceNumber}</title>
    <style>
      @page { size: 80mm auto; margin: 2mm; }
      body{font-family:'Cairo','Courier New',monospace;color:#000;padding:4px;margin:0;width:76mm;font-size:11px;line-height:1.4}
      h1{text-align:center;margin:4px 0;font-size:14px}
      .center{text-align:center}
      .dash{border-top:1px dashed #000;margin:6px 0}
      table{width:100%;border-collapse:collapse}
      .total{font-size:14px;font-weight:bold;border-top:2px solid #000;padding-top:4px;margin-top:4px;display:flex;justify-content:space-between}
      @media print { body{margin:0;padding:2mm} .no-print{display:none} }
    </style></head><body>
    <h1>مركز الغزلان</h1>
    <div class="center">ERP · POS · ISP</div>
    <div class="center">📞 07707889032</div>
    <div class="dash"></div>
    <div>وصل: <b>${s.invoiceNumber || s.id?.slice(0, 8)}</b></div>
    <div>التاريخ: ${new Date(s.createdAt).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })}</div>
    <div>الكاشير: ${s.cashierName || '-'}</div>
    <div>الزبون: ${s.customer || '-'}</div>
    <div class="dash"></div>
    <table>
      <thead><tr><th style="text-align:right">المنتج</th><th style="text-align:center">عدد</th><th style="text-align:left">الإجمالي</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="dash"></div>
    <div style="display:flex;justify-content:space-between"><span>المجموع:</span><span>${Number(s.subtotal || 0).toLocaleString('en-US')}</span></div>
    ${Number(s.discount) > 0 ? `<div style="display:flex;justify-content:space-between"><span>خصم:</span><span>-${Number(s.discount).toLocaleString('en-US')}</span></div>` : ''}
    <div class="total"><span>الإجمالي:</span><span>${Number(s.total || 0).toLocaleString('en-US')} د.ع</span></div>
    <div>الدفع: ${s.paymentMethod || 'نقد'}</div>
    <div class="dash"></div>
    <div class="center">شكراً لزيارتكم 🙏</div>
    <div class="no-print" style="text-align:center;margin-top:10px"><button onclick="window.print()" style="padding:6px 18px;background:#000;color:#fff;border:none;border-radius:4px;cursor:pointer">طباعة</button></div>
    <script>setTimeout(()=>window.print(),500);</script>
    </body></html>`);
  w.document.close();
}

// ============ PRODUCTS ============
function Products() {
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

// ============ SUBSCRIBERS ============
function ColumnHeader({ colKey, label, sortBy, sortDir, toggleSort, colSearch, onColSearch, open, setOpen }) {
  const isSorted = sortBy === colKey;
  const hasFilter = !!colSearch;
  return (
    <th className="p-2 relative">
      <div className="flex items-center gap-1 justify-end">
        <button
          onClick={() => toggleSort(colKey)}
          className={`flex items-center gap-1 hover:text-gold transition-colors ${isSorted ? 'text-gold font-bold' : ''}`}
          title="انقر للترتيب"
        >
          <span>{label}</span>
          <span className="text-[10px]">
            {isSorted ? (sortDir === 'asc' ? '⬆️' : '⬇️') : '⇅'}
          </span>
        </button>
        <button
          onClick={() => setOpen(!open)}
          className={`p-0.5 rounded hover:bg-gold/20 transition-colors ${hasFilter ? 'text-gold bg-gold/10' : 'text-muted-foreground'}`}
          title="بحث في هذا العمود"
        >
          <Search className="w-3 h-3" />
        </button>
      </div>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 w-48 p-2 rounded-lg border border-gold/40 bg-background shadow-xl">
          <Input
            value={colSearch}
            onChange={e => onColSearch(e.target.value)}
            placeholder={`بحث في ${label}...`}
            className="bg-input/30 border-gold/20 h-8 text-xs"
            autoFocus
          />
          <div className="flex justify-between mt-2">
            <button onClick={() => { onColSearch(''); setOpen(false); }} className="text-[10px] text-red-400 hover:underline">مسح</button>
            <button onClick={() => setOpen(false)} className="text-[10px] text-cyan-400 hover:underline">إغلاق</button>
          </div>
        </div>
      )}
    </th>
  );
}

function Subscribers() {
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

// ============ ACTIVATION DIALOG ============
function ActivationDialog({ subscriber, packages, agents, onClose, onDone }) {
  const [pkgId, setPkgId] = useState('');
  const [speed, setSpeed] = useState('');
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [durationMonths, setDurationMonths] = useState(1);
  const [agentId, setAgentId] = useState('');
  const [notes, setNotes] = useState('');
  const [sendChannel, setSendChannel] = useState('whatsapp'); // whatsapp | telegram | none
  const [editableMessage, setEditableMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [balanceAccounts, setBalanceAccounts] = useState([]);

  useEffect(() => {
    if (subscriber) {
      setPkgId(''); setSpeed(subscriber.package || ''); setAmount(subscriber.fee || 0);
      setPaymentMethod('cash'); setDurationMonths(1);
      setAgentId(subscriber.agentId || (agents[0]?.id) || '');
      setNotes(''); setResult(null); setSendChannel('whatsapp'); setEditableMessage('');
      // Load balance accounts to show live balance preview
      api('balance/accounts').then(d => setBalanceAccounts(safeArr(d)));
    }
  }, [subscriber, agents]);

  if (!subscriber) return null;

  const onPkgChange = (id) => {
    setPkgId(id);
    const p = packages.find(x => x.id === id);
    if (p) { setSpeed(p.speed); setAmount(p.monthlyFee * durationMonths); }
  };

  const onDurationChange = (m) => {
    setDurationMonths(Number(m));
    const p = packages.find(x => x.id === pkgId);
    if (p) setAmount(p.monthlyFee * Number(m));
  };

  const endDate = new Date(Date.now() + durationMonths * 30 * 86400000).toLocaleDateString('ar-IQ');

  // ============ BALANCE PREVIEW ============
  // Map payment method → balance account key (matches backend)
  const balanceKeyMap = { fastpay: 'fast', master: 'master', transfer: 'management', cash: 'cash' };
  const balanceMethodLabel = { fastpay: '⚡ فاست باي', master: '💳 ماستر كارد', transfer: '🏦 تحويل (الإدارة)', cash: '💵 كاش' };
  const targetKey = balanceKeyMap[paymentMethod];
  const targetAccount = balanceAccounts.find(a => a.key === targetKey && a.enabled !== false);
  const currentBalance = Number(targetAccount?.balance || 0);
  const amountNum = Number(amount || 0);
  const newBalance = currentBalance - amountNum;
  const willGoNegative = newBalance < 0;
  const balanceWarning = targetAccount && targetAccount.alertThreshold != null && newBalance < Number(targetAccount.alertThreshold);

  const submit = async () => {
    setLoading(true);
    const r = await api(`subscribers/${subscriber.id}/activate`, {
      method: 'POST',
      body: JSON.stringify({ packageId: pkgId, speed, amount: Number(amount), paymentMethod, durationMonths, agentId: agentId || null, notes }),
    });
    setLoading(false);
    if (r.error) { toast.error(r.error); sounds.error(); return; }
    // Pending approval flow (agent has requireAdminApproval=true)
    if (r.pending) {
      sounds.notification();
      toast.info('⏳ تم إرسال طلب التفعيل للمدير للموافقة', { description: r.message || 'الطلب في قائمة الانتظار' });
      onClose();
      onDone?.();
      return;
    }
    sounds.activation();
    toast.success('✅ تم التفعيل بنجاح');
    setResult(r);
    setEditableMessage(r.whatsappMessage || '');
    // Auto-open WhatsApp/Telegram if user selected one
    if (sendChannel === 'whatsapp' && subscriber.phone && r.whatsappMessage) {
      const url = whatsappLink(subscriber.phone, r.whatsappMessage);
      if (url) setTimeout(() => window.open(url, '_blank'), 600);
    } else if (sendChannel === 'telegram' && subscriber.phone) {
      // Telegram only supports username deep links, but we can show share URL
      const url = `https://t.me/share/url?url=${encodeURIComponent(' ')}&text=${encodeURIComponent(r.whatsappMessage || '')}`;
      setTimeout(() => window.open(url, '_blank'), 600);
    }
  };

  return (
    <Dialog open={!!subscriber} onOpenChange={(o) => { if (!o) { onClose(); if (result) onDone(); } }}>
      <DialogContent className="glass-strong border-gold/40 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="gold-text flex items-center gap-2">
            <Zap className="w-5 h-5" /> تفعيل اشتراك - {subscriber.name}
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <>
            <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20 text-xs space-y-1">
              <p><strong>المشترك:</strong> {subscriber.name} · <span className="font-mono text-cyan-400">@{subscriber.username}</span></p>
              <p><strong>الهاتف:</strong> {subscriber.phone} · <strong>الزون:</strong> {subscriber.zoneName} · <strong>الفاتة:</strong> {subscriber.fatNumber}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>اختر الباقة</Label>
                <Select value={pkgId} onValueChange={onPkgChange}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="اختر باقة" /></SelectTrigger>
                  <SelectContent>
                    {packages.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="font-bold text-gold">{p.name}</span> · {p.speed} · {p.monthlyFee.toLocaleString()} د.ع
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>السرعة</Label><Input value={speed} onChange={e => setSpeed(e.target.value)} placeholder="50 Mbps" className="bg-input/30 border-gold/20" /></div>
              <div>
                <Label>المدة</Label>
                <Select value={String(durationMonths)} onValueChange={onDurationChange}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">شهر واحد</SelectItem>
                    <SelectItem value="3">3 أشهر</SelectItem>
                    <SelectItem value="6">6 أشهر</SelectItem>
                    <SelectItem value="12">سنة كاملة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>المبلغ الإجمالي</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="bg-input/30 border-gold/20 text-lg font-bold gold-text" /></div>
              <div>
                <Label>طريقة الدفع</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">💵 كاش</SelectItem>
                    <SelectItem value="master">💳 ماستر كارد</SelectItem>
                    <SelectItem value="fastpay">⚡ فاست باي</SelectItem>
                    <SelectItem value="transfer">🏦 تحويل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>الوكيل</Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="اختر الوكيل" /></SelectTrigger>
                  <SelectContent>
                    {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name} (عمولة {a.commission}%)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} className="bg-input/30 border-gold/20 h-16" placeholder="اختياري..." /></div>
              <div className="col-span-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-400">
                ✅ تاريخ الانتهاء التلقائي: <strong className="text-emerald-300">{endDate}</strong>
              </div>

              {/* ============ BALANCE PREVIEW (Fast/Master/Management) ============ */}
              {paymentMethod !== 'cash' && targetAccount && (
                <div className={`col-span-2 p-3 rounded-lg border text-xs space-y-1 ${willGoNegative ? 'bg-red-500/10 border-red-500/40' : balanceWarning ? 'bg-amber-500/10 border-amber-500/40' : 'bg-cyan-500/5 border-cyan-500/20'}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-bold flex items-center gap-1">
                      <Wallet className="w-3 h-3" />
                      حساب: {balanceMethodLabel[paymentMethod]} ({targetAccount.name})
                    </p>
                    {willGoNegative && <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-[9px]">⚠️ سيدخل في السالب!</Badge>}
                    {!willGoNegative && balanceWarning && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[9px]">⚠️ تحت الحد الأدنى</Badge>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-current/20">
                    <div>
                      <p className="text-[10px] opacity-60">الرصيد الحالي</p>
                      <p className={`text-sm font-bold ${currentBalance < 0 ? 'text-red-400' : 'text-cyan-300'}`}>{fmt(currentBalance)} د.ع</p>
                    </div>
                    <div>
                      <p className="text-[10px] opacity-60">سيُخصم</p>
                      <p className="text-sm font-bold text-amber-400">- {fmt(amountNum)} د.ع</p>
                    </div>
                    <div>
                      <p className="text-[10px] opacity-60">الرصيد بعد الخصم</p>
                      <p className={`text-sm font-bold ${willGoNegative ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(newBalance)} د.ع</p>
                    </div>
                  </div>
                </div>
              )}
              {paymentMethod !== 'cash' && !targetAccount && (
                <div className="col-span-2 p-2 rounded-lg bg-zinc-500/10 border border-zinc-500/30 text-[10px] text-zinc-400">
                  ℹ️ لا يوجد حساب رصيد مرتبط بطريقة الدفع هذه — لن يتم خصم تلقائي
                </div>
              )}

              {/* Send channel selector */}
              <div className="col-span-2">
                <Label className="text-xs mb-2 block">📤 طريقة إرسال الإشعار للمشترك</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: 'whatsapp', icon: '💚', label: 'WhatsApp', color: 'emerald' },
                    { v: 'telegram', icon: '📨', label: 'Telegram', color: 'cyan' },
                    { v: 'none', icon: '🔕', label: 'بدون إرسال', color: 'gray' },
                  ].map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setSendChannel(opt.v)}
                      className={`p-2 rounded-lg border-2 transition-all text-center ${sendChannel === opt.v ? `border-${opt.color}-500 bg-${opt.color}-500/20` : 'border-gold-soft bg-input/30 hover:border-gold/50'}`}
                    >
                      <div className="text-lg">{opt.icon}</div>
                      <div className="text-[10px] font-bold mt-0.5">{opt.label}</div>
                    </button>
                  ))}
                </div>
                {sendChannel === 'whatsapp' && (
                  <p className="text-[10px] text-emerald-400 mt-1.5">✅ سيفتح WhatsApp مباشرة مع الرسالة جاهزة بعد التفعيل</p>
                )}
                {sendChannel === 'telegram' && (
                  <p className="text-[10px] text-cyan-400 mt-1.5">📨 سيفتح Telegram مع نص الرسالة جاهزة</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={submit} disabled={loading || !amount} className="btn-gold w-full h-12 text-base">
                {loading ? 'جاري التفعيل...' : <><Zap className="w-4 h-4 ml-2" /> تفعيل الاشتراك وإرسال إشعار</>}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-emerald-400" />
              <h3 className="text-lg font-bold text-emerald-400">تم التفعيل بنجاح</h3>
              <p className="text-xs text-muted-foreground">المبلغ: <span className="font-bold gold-text">{Number(result.activation?.amount || 0).toLocaleString('en-US')} د.ع</span> · ينتهي: <span className="font-bold">{new Date(result.activation?.endDate).toLocaleDateString('ar-IQ')}</span></p>
            </div>
            <div className="p-3 rounded-lg bg-input/30 border border-gold-soft space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-[10px] text-muted-foreground">📱 الرسالة (قابلة للتعديل قبل الإرسال):</p>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] hover:text-gold" onClick={() => setEditableMessage(result.whatsappMessage || '')}>
                  ↩️ النص الأصلي
                </Button>
              </div>
              <Textarea
                value={editableMessage}
                onChange={e => setEditableMessage(e.target.value)}
                className="bg-background/50 border-gold/20 text-xs font-mono h-48 leading-relaxed"
                dir="rtl"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a href={whatsappLink(subscriber.phone, editableMessage) || '#'} target="_blank" rel="noreferrer">
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                  <Send className="w-4 h-4 ml-1" /> فتح WhatsApp وإرسال
                </Button>
              </a>
              <Button onClick={() => { navigator.clipboard?.writeText(editableMessage); toast.success('📋 تم نسخ النص'); }} variant="outline" className="border-gold/30">
                📋 نسخ النص
              </Button>
            </div>
            <DialogFooter className="gap-2">
              <Button onClick={() => { onClose(); onDone(); }} className="btn-gold flex-1">إغلاق</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}


// ============ ZONES ============
function Zones() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', location: '', lat: 33.3, lng: 44.4, status: 'online', fats: 1, utilization: 50 });
  const [aiOpen, setAiOpen] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const load = () => api('zones').then(setArr(setItems));
  useEffect(() => { load(); }, []);

  const save = async () => {
    const payload = { ...form, fats: Number(form.fats), utilization: Number(form.utilization), lat: Number(form.lat), lng: Number(form.lng) };
    if (editing) await api(`zones/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('zones', { method: 'POST', body: JSON.stringify(payload) });
    toast.success('تم الحفظ'); setOpen(false); setEditing(null); load();
  };
  const remove = async (id) => { await api(`zones/${id}`, { method: 'DELETE' }); toast.success('تم الحذف'); load(); };
  const startEdit = (z) => { setEditing(z); setForm(z); setOpen(true); };

  const loadAI = async () => {
    setAiLoading(true);
    const r = await api('zones/load-balance');
    setAiLoading(false);
    if (r?.error) { toast.error(r.error); return; }
    setAiData(r);
    setAiOpen(true);
  };

  const applySuggestion = async (s) => {
    if (!confirm(`تطبيق الاقتراح: ${s.title}؟`)) return;
    const r = await api('zones/load-balance/apply', { method: 'POST', body: JSON.stringify({ action: s.action }) });
    if (r?.error) { toast.error(r.error); return; }
    toast.success('✅ تم تطبيق الاقتراح');
    // Remove from current suggestion list and reload data
    setAiData(prev => ({ ...prev, suggestions: prev.suggestions.filter(x => x.id !== s.id) }));
    load();
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold gold-text">الزونات والشبكات</h1>
        <div className="flex gap-2">
          <Button onClick={loadAI} disabled={aiLoading} variant="outline" className="border-cyan-500/40 hover:bg-cyan-500/10 text-cyan-400">
            <Brain className="w-4 h-4 ml-1" /> {aiLoading ? 'جاري التحليل...' : '🤖 اقتراحات AI لتوزيع الحمل'}
          </Button>
          <Button onClick={() => { setEditing(null); setForm({ name: '', location: '', lat: 33.3, lng: 44.4, status: 'online', fats: 1, utilization: 50 }); setOpen(true); }} className="btn-gold">
            <Plus className="w-4 h-4 ml-1" /> زون جديد
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(z => (
          <Card key={z.id} className={`glass-card border ${z.status === 'online' ? 'border-emerald-500/30' : z.status === 'warning' ? 'border-amber-500/40' : 'border-red-500/40'} hover:scale-[1.02] transition-all`}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">{z.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> {z.location}</p>
                </div>
                <Badge className={
                  z.status === 'online' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                  z.status === 'warning' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                  'bg-red-500/20 text-red-400 border-red-500/30'
                }>
                  {z.status === 'online' ? '🟢 متصل' : z.status === 'warning' ? '🟡 تحذير' : '🔴 مفصول'}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="glass-card rounded-lg p-2"><p className="text-[10px] text-muted-foreground">مشتركين</p><p className="text-lg font-bold gold-text">{z.subscribers}</p></div>
                <div className="glass-card rounded-lg p-2"><p className="text-[10px] text-muted-foreground">فاتات</p><p className="text-lg font-bold neon-text">{z.fats}</p></div>
                <div className="glass-card rounded-lg p-2"><p className="text-[10px] text-muted-foreground">الاستهلاك</p><p className={`text-lg font-bold ${z.utilization > 85 ? 'text-red-400' : 'text-emerald-400'}`}>{z.utilization}%</p></div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">نسبة الضغط</span><span>{z.utilization}%</span></div>
                <Progress value={z.utilization} className="h-2" />
              </div>

              <div className="flex gap-2 pt-2 border-t border-gold-soft">
                <Button size="sm" variant="outline" className="flex-1 border-gold/30" onClick={() => startEdit(z)}><Edit2 className="w-3 h-3 ml-1" />تعديل</Button>
                <Button size="sm" variant="outline" className="border-red-500/30 hover:bg-red-500/10" onClick={() => remove(z.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-gold/40">
          <DialogHeader><DialogTitle className="gold-text">{editing ? 'تعديل الزون' : 'زون جديد'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>اسم الزون</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div className="col-span-2"><Label>الموقع</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div><Label>خط العرض</Label><Input type="number" step="0.0001" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div><Label>خط الطول</Label><Input type="number" step="0.0001" value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div><Label>الحالة</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="online">متصل</SelectItem><SelectItem value="warning">تحذير</SelectItem><SelectItem value="offline">مفصول</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>عدد الفاتات</Label><Input type="number" value={form.fats} onChange={e => setForm({ ...form, fats: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div className="col-span-2"><Label>الاستهلاك (%)</Label><Input type="number" value={form.utilization} onChange={e => setForm({ ...form, utilization: e.target.value })} className="bg-input/30 border-gold/20" /></div>
          </div>

          <CustomFieldsGrid
            entity="zones"
            customFields={form.customFields}
            onUpdate={(cf) => setForm({ ...form, customFields: cf })}
            columns={2}
          />

          <DialogFooter><Button onClick={save} className="btn-gold w-full">حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Load Balancing Suggestions Dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="glass-strong border-cyan-500/40 max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyan-400">
              <Brain className="w-5 h-5" /> 🤖 اقتراحات AI لتوزيع حمل الزونات
            </DialogTitle>
          </DialogHeader>
          {aiData && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="glass-card rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">إجمالي الزونات</p>
                  <p className="text-2xl font-bold gold-text">{aiData.summary.totalZones}</p>
                </div>
                <div className="glass-card rounded-lg p-3 text-center border border-amber-500/30">
                  <p className="text-[10px] text-muted-foreground">مُحمَّلة</p>
                  <p className="text-2xl font-bold text-amber-400">{aiData.summary.overloadedCount}</p>
                </div>
                <div className="glass-card rounded-lg p-3 text-center border border-emerald-500/30">
                  <p className="text-[10px] text-muted-foreground">قليلة الاستخدام</p>
                  <p className="text-2xl font-bold text-emerald-400">{aiData.summary.underUsedCount}</p>
                </div>
                <div className="glass-card rounded-lg p-3 text-center border border-red-500/30">
                  <p className="text-[10px] text-muted-foreground">مفصولة</p>
                  <p className="text-2xl font-bold text-red-400">{aiData.summary.offlineCount}</p>
                </div>
              </div>

              {/* Suggestions */}
              <div>
                <h3 className="text-sm font-bold gold-text mb-2">🎯 اقتراحات ({aiData.suggestions.length})</h3>
                {aiData.suggestions.length === 0 ? (
                  <div className="p-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center">
                    <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-2" />
                    <p className="text-sm font-bold text-emerald-400">✨ كل الزونات في حالة متوازنة!</p>
                    <p className="text-xs text-muted-foreground mt-1">لا توجد اقتراحات حالياً</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {aiData.suggestions.map(s => {
                      const colors = {
                        critical: 'border-red-500/50 bg-red-500/5',
                        high: 'border-amber-500/50 bg-amber-500/5',
                        medium: 'border-cyan-500/50 bg-cyan-500/5',
                        low: 'border-emerald-500/50 bg-emerald-500/5',
                      };
                      const labels = { critical: '🔴 حرج', high: '🟠 عالي', medium: '🟡 متوسط', low: '🟢 منخفض' };
                      return (
                        <div key={s.id} className={`p-3 rounded-lg border ${colors[s.priority] || colors.medium}`}>
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <h4 className="text-sm font-bold flex-1">{s.title}</h4>
                            <Badge className="text-[10px]">{labels[s.priority]}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{s.reason}</p>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => applySuggestion(s)} className="btn-gold h-7 text-xs">
                              ✅ تطبيق الاقتراح
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Zones overview */}
              <div>
                <h3 className="text-sm font-bold gold-text mb-2">📊 نظرة عامة ({aiData.zones.length} زون)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {aiData.zones.map(z => (
                    <div key={z.id} className="p-2 rounded border border-gold-soft bg-input/20 flex justify-between items-center text-xs">
                      <div className="flex-1">
                        <p className="font-bold">{z.name}</p>
                        <p className="text-[10px] text-muted-foreground">{z.subscribers}/{z.capacity} مشترك · {z.networks} فات</p>
                      </div>
                      <div className="text-left">
                        <p className={`font-bold ${z.utilization >= 90 ? 'text-red-400' : z.utilization >= 70 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {z.utilization}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground text-center">
                آخر تحديث: {new Date(aiData.generatedAt).toLocaleString('ar-IQ')}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button onClick={loadAI} variant="outline" className="border-cyan-500/40">
              <RefreshCw className="w-4 h-4 ml-1" /> تحديث التحليل
            </Button>
            <Button onClick={() => setAiOpen(false)} className="btn-gold flex-1">إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ NOC - Network Operations Center ============
function NOC() {
  const [data, setData] = useState(null);
  useEffect(() => {
    const fetch = async () => {
      const d = await api('noc/status');
      if (d && !d._failed) {
        setData({
          activeConnections: d.activeConnections || 0,
          totalTraffic: d.totalTraffic || 0,
          zones: Array.isArray(d.zones) ? d.zones : [],
          alerts: Array.isArray(d.alerts) ? d.alerts : [],
          ...d,
        });
      } else {
        setData({ activeConnections: 0, totalTraffic: 0, zones: [], alerts: [] });
      }
    };
    fetch();
    const t = setInterval(fetch, 5000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <LoadingScreen />;
  const zones = Array.isArray(data.zones) ? data.zones : [];
  const alerts = Array.isArray(data.alerts) ? data.alerts : [];

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold gold-text flex items-center gap-2"><Activity className="w-6 h-6 animate-pulse" /> مركز عمليات الشبكة - LIVE</h1>
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block ml-2"></span> تحديث مباشر كل 5 ثوان
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card"><p className="text-xs text-muted-foreground">اتصالات نشطة</p><p className="text-2xl font-bold neon-text">{data.activeConnections || 0}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي الترافيك</p><p className="text-2xl font-bold gold-text">{fmt(data.totalTraffic)} Mbps</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">الزونات</p><p className="text-2xl font-bold">{zones.length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">تنبيهات نشطة</p><p className="text-2xl font-bold text-red-400">{alerts.length}</p></div>
      </div>

      {alerts.length > 0 && (
        <Card className="glass-strong border-red-500/30">
          <CardHeader><CardTitle className="text-red-400 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> تنبيهات حرجة</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className={`p-3 rounded-lg border ${a.type === 'critical' ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'} flex items-center justify-between`}>
                  <span className="text-sm">{a.message}</span>
                  <span className="text-xs text-muted-foreground">{a.time ? new Date(a.time).toLocaleTimeString('ar-IQ') : ''}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {zones.map(z => (
          <Card key={z.id} className={`glass-card border ${z.status === 'online' ? 'border-emerald-500/30' : z.status === 'warning' ? 'border-amber-500/30' : 'border-red-500/30'}`}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full animate-pulse ${z.status === 'online' ? 'bg-emerald-400' : z.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'}`}></div>
                  <h3 className="font-bold">{z.name}</h3>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{z.lat.toFixed(4)}°N, {z.lng.toFixed(4)}°E</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="glass-card rounded p-2"><p className="text-[9px] text-muted-foreground">Ping</p><p className="text-sm font-bold neon-text">{z.ping}ms</p></div>
                <div className="glass-card rounded p-2"><p className="text-[9px] text-muted-foreground">Loss</p><p className={`text-sm font-bold ${z.packetLoss > 5 ? 'text-red-400' : 'text-emerald-400'}`}>{z.packetLoss.toFixed(1)}%</p></div>
                <div className="glass-card rounded p-2"><p className="text-[9px] text-muted-foreground">↑ UL</p><p className="text-sm font-bold gold-text">{z.uplink}</p></div>
                <div className="glass-card rounded p-2"><p className="text-[9px] text-muted-foreground">↓ DL</p><p className="text-sm font-bold gold-text">{z.downlink}</p></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">الضغط: {z.utilization}%</span><span>{z.subscribers} مشترك</span></div>
                <Progress value={z.utilization} className="h-2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ REPAIRS ============
function Repairs() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ customerName: '', phone: '', device: '', imei: '', issue: '', technician: '', status: 'pending', cost: 0, partsCost: 0 });

  const load = () => api('repairs').then(setArr(setItems));
  useEffect(() => { load(); }, []);

  const save = async () => {
    const payload = { ...form, cost: Number(form.cost), partsCost: Number(form.partsCost), receivedAt: form.receivedAt || new Date().toISOString() };
    if (editing) await api(`repairs/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('repairs', { method: 'POST', body: JSON.stringify(payload) });
    toast.success('تم الحفظ'); setOpen(false); setEditing(null); load();
  };
  const remove = async (id) => { await api(`repairs/${id}`, { method: 'DELETE' }); toast.success('تم الحذف'); load(); };

  const statusBadge = (s) => ({
    pending: { txt: '⏳ قيد الاستلام', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    in_progress: { txt: '🔧 قيد الإصلاح', cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    completed: { txt: '✅ مكتمل', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    delivered: { txt: '📦 مسلّم', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  }[s] || { txt: s, cls: '' });

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold gold-text">صيانة الهواتف</h1>
        <Button onClick={() => { setEditing(null); setForm({ customerName: '', phone: '', device: '', imei: '', issue: '', technician: '', status: 'pending', cost: 0, partsCost: 0 }); setOpen(true); }} className="btn-gold">
          <Plus className="w-4 h-4 ml-1" /> استلام جهاز
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(r => {
          const sb = statusBadge(r.status);
          return (
            <Card key={r.id} className="glass-card border-gold-soft hover:border-gold/50 transition-all">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">رقم التذكرة</p>
                    <h3 className="text-xl font-black gold-text">{r.ticketNumber}</h3>
                  </div>
                  <Badge className={sb.cls}>{sb.txt}</Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <p><strong>{r.customerName}</strong> · {r.phone}</p>
                  <p className="text-muted-foreground">📱 {r.device}</p>
                  <p className="text-xs font-mono text-muted-foreground">IMEI: {r.imei}</p>
                  <p className="text-xs"><strong>المشكلة:</strong> {r.issue}</p>
                  <p className="text-xs"><strong>الفني:</strong> {r.technician}</p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gold-soft">
                  <div>
                    <p className="text-[10px] text-muted-foreground">التكلفة</p>
                    <p className="text-sm font-bold gold-text">{fmtCurrency(r.cost)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Select value={r.status} onValueChange={async (v) => { await api(`repairs/${r.id}`, { method: 'PUT', body: JSON.stringify({ status: v }) }); toast.success('تم التحديث'); load(); }}>
                      <SelectTrigger className="h-7 text-xs w-28 bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">⏳ قيد الاستلام</SelectItem>
                        <SelectItem value="in_progress">🔧 قيد الإصلاح</SelectItem>
                        <SelectItem value="completed">✅ مكتمل</SelectItem>
                        <SelectItem value="delivered">📦 مسلّم</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-red-500" onClick={() => remove(r.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-gold/40 max-w-lg">
          <DialogHeader><DialogTitle className="gold-text">استلام جهاز للصيانة</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>اسم الزبون</Label><Input value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div><Label>الهاتف</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div><Label>الجهاز</Label><Input value={form.device} onChange={e => setForm({ ...form, device: e.target.value })} placeholder="iPhone 13 Pro" className="bg-input/30 border-gold/20" /></div>
            <div><Label>IMEI</Label><Input value={form.imei} onChange={e => setForm({ ...form, imei: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div className="col-span-2"><Label>وصف العطل</Label><Textarea value={form.issue} onChange={e => setForm({ ...form, issue: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div><Label>الفني المسؤول</Label><Input value={form.technician} onChange={e => setForm({ ...form, technician: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div><Label>تكلفة القطع</Label><Input type="number" value={form.partsCost} onChange={e => setForm({ ...form, partsCost: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div className="col-span-2"><Label>إجمالي التكلفة</Label><Input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} className="bg-input/30 border-gold/20" /></div>
          </div>

          <CustomFieldsGrid
            entity="repairs"
            customFields={form.customFields}
            onUpdate={(cf) => setForm({ ...form, customFields: cf })}
            columns={2}
          />

          <DialogFooter><Button onClick={save} className="btn-gold w-full">إنشاء تذكرة</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ CAMERAS ============
function Cameras() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ client: '', location: '', cameras: 4, type: 'تركيب', value: 0, status: 'pending', startDate: new Date().toISOString().slice(0, 10) });

  const load = () => api('camera-contracts').then(setArr(setItems));
  useEffect(() => { load(); }, []);

  const save = async () => {
    await api('camera-contracts', { method: 'POST', body: JSON.stringify({ ...form, cameras: Number(form.cameras), value: Number(form.value) }) });
    toast.success('تم إنشاء العقد'); setOpen(false); load();
  };
  const remove = async (id) => { await api(`camera-contracts/${id}`, { method: 'DELETE' }); toast.success('تم الحذف'); load(); };

  const totalValue = items.reduce((s, x) => s + (x.value || 0), 0);
  const totalCams = items.reduce((s, x) => s + (x.cameras || 0), 0);

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold gold-text">الكاميرات والمراقبة</h1>
        <Button onClick={() => setOpen(true)} className="btn-gold"><Plus className="w-4 h-4 ml-1" /> عقد جديد</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي العقود</p><p className="text-2xl font-bold gold-text">{items.length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">كاميرات منصوبة</p><p className="text-2xl font-bold neon-text">{totalCams}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">القيمة الإجمالية</p><p className="text-xl font-bold text-emerald-400">{fmtCurrency(totalValue)}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">عقود نشطة</p><p className="text-2xl font-bold">{items.filter(i => i.status === 'active').length}</p></div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {items.map(c => (
          <Card key={c.id} className="glass-card border-gold-soft hover:border-gold/50">
            <CardContent className="p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"><Camera className="w-6 h-6 text-white" /></div>
                  <div>
                    <h3 className="font-bold">{c.client}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</p>
                  </div>
                </div>
                <Badge className={c.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}>
                  {c.status === 'active' ? 'نشط' : 'معلق'}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="glass-card rounded p-2"><p className="text-[10px] text-muted-foreground">عدد الكاميرات</p><p className="font-bold neon-text">{c.cameras}</p></div>
                <div className="glass-card rounded p-2"><p className="text-[10px] text-muted-foreground">النوع</p><p className="text-xs">{c.type}</p></div>
                <div className="glass-card rounded p-2"><p className="text-[10px] text-muted-foreground">القيمة</p><p className="font-bold gold-text text-xs">{fmt(c.value)}</p></div>
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t border-gold-soft">
                <span>📅 {c.startDate}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-red-500" onClick={() => remove(c.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-gold/40">
          <DialogHeader><DialogTitle className="gold-text">عقد كاميرات جديد</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>اسم العميل</Label><Input value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div className="col-span-2"><Label>الموقع</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div><Label>عدد الكاميرات</Label><Input type="number" value={form.cameras} onChange={e => setForm({ ...form, cameras: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div><Label>القيمة</Label><Input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div><Label>نوع الخدمة</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="تركيب">تركيب</SelectItem>
                  <SelectItem value="تركيب + صيانة">تركيب + صيانة</SelectItem>
                  <SelectItem value="تركيب + صيانة سنوية">تركيب + صيانة سنوية</SelectItem>
                  <SelectItem value="صيانة فقط">صيانة فقط</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>الحالة</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">نشط</SelectItem><SelectItem value="pending">معلق</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={save} className="btn-gold w-full">حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ EMPLOYEES ============
// ============ HR HUB - Multi-tab Employee Management ============
const ALL_PERMISSIONS = [
  { id: 'sales', label: 'المبيعات' },
  { id: 'pos', label: 'نقطة البيع POS' },
  { id: 'subscribers', label: 'المشتركين' },
  { id: 'employees', label: 'الموظفين' },
  { id: 'tasks', label: 'المهام' },
  { id: 'reports', label: 'التقارير' },
  { id: 'repairs', label: 'الصيانة' },
  { id: 'isp', label: 'الإنترنت' },
  { id: 'agents', label: 'الوكلاء' },
  { id: 'finance', label: 'المالية' },
  { id: 'settings', label: 'الإعدادات' },
];

function Employees() {
  const [tab, setTab] = useState('list');
  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold gold-text flex items-center gap-2"><Users className="w-6 h-6" /> إدارة الموارد البشرية HR</h1>
        <a href="/employee" target="_blank" rel="noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300 underline">🔗 رابط لوحة الموظف /employee</a>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-input/30 border border-gold-soft w-full grid grid-cols-7">
          <TabsTrigger value="list">👥 الموظفون</TabsTrigger>
          <TabsTrigger value="attendance">🕐 الحضور</TabsTrigger>
          <TabsTrigger value="tasks">📋 المهام</TabsTrigger>
          <TabsTrigger value="leaves">📅 الإجازات</TabsTrigger>
          <TabsTrigger value="advances">💳 السلف</TabsTrigger>
          <TabsTrigger value="payroll">💰 الرواتب</TabsTrigger>
          <TabsTrigger value="reports">📊 التقارير</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-4"><EmployeesList /></TabsContent>
        <TabsContent value="attendance" className="mt-4"><AttendanceView /></TabsContent>
        <TabsContent value="tasks" className="mt-4"><TasksManager /></TabsContent>
        <TabsContent value="leaves" className="mt-4"><LeavesManager /></TabsContent>
        <TabsContent value="advances" className="mt-4"><AdvancesManager /></TabsContent>
        <TabsContent value="payroll" className="mt-4"><PayrollView /></TabsContent>
        <TabsContent value="reports" className="mt-4"><HRReports /></TabsContent>
      </Tabs>
    </div>
  );
}

function EmployeesList() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const blank = { name: '', username: '', password: '', phone: '', role: '', salary: 500000, kpi: 80, photo: '👤', shiftStart: '08:00', shiftEnd: '17:00', permissions: ['tasks'], status: 'active', attendance: 'present' };
  const [form, setForm] = useState(blank);
  const load = () => api('employees').then(setArr(setItems));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.username) { toast.error('الاسم واليوزر مطلوبان'); return; }
    const payload = { ...form, salary: Number(form.salary), kpi: Number(form.kpi) };
    if (editing) await api(`employees/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('employees', { method: 'POST', body: JSON.stringify({ ...payload, employeeId: `EMP-${String(items.length + 1).padStart(3, '0')}` }) });
    toast.success('تم الحفظ'); setOpen(false); setEditing(null); load();
  };
  const remove = async (id) => { await api(`employees/${id}`, { method: 'DELETE' }); toast.success('تم الحذف'); load(); };
  const togglePerm = (p) => setForm(f => ({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter(x => x !== p) : [...f.permissions, p] }));

  const filtered = items.filter(e => !search || e.name?.includes(search) || e.employeeId?.includes(search) || e.username?.toLowerCase().includes(search.toLowerCase()) || e.role?.includes(search));

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث: اسم/ID/يوزر/وظيفة..." className="pr-10 bg-input/30 border-gold/20" />
        </div>
        <Button onClick={() => { setEditing(null); setForm(blank); setOpen(true); }} className="btn-gold"><Plus className="w-4 h-4 ml-1" /> موظف جديد</Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(e => (
          <Card key={e.id} className="glass-card border-gold-soft hover:border-gold/50">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-gold-gradient flex items-center justify-center text-3xl">{e.photo || '👤'}</div>
                <div className="flex-1">
                  <h3 className="font-bold">{e.name}</h3>
                  <p className="text-[10px] text-muted-foreground">{e.employeeId} · {e.role}</p>
                  <p className="text-xs font-mono text-cyan-400">@{e.username}</p>
                </div>
                <Badge className={e.attendance === 'present' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : e.attendance === 'late' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                  {e.attendance === 'present' ? 'حاضر' : e.attendance === 'late' ? 'متأخر' : 'غائب'}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="glass-card rounded p-1.5"><p className="text-[9px] text-muted-foreground">الدوام</p><p className="font-bold neon-text text-[10px]">{e.shiftStart}-{e.shiftEnd}</p></div>
                <div className="glass-card rounded p-1.5"><p className="text-[9px] text-muted-foreground">KPI</p><p className="font-bold gold-text">{e.kpi}%</p></div>
                <div className="glass-card rounded p-1.5"><p className="text-[9px] text-muted-foreground">الراتب</p><p className="font-bold text-emerald-400 text-[10px]">{fmt(e.salary)}</p></div>
              </div>
              <div className="flex flex-wrap gap-1">
                {(e.permissions || []).slice(0, 4).map(p => <Badge key={p} className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[9px]">{ALL_PERMISSIONS.find(x => x.id === p)?.label || p}</Badge>)}
                {(e.permissions || []).length > 4 && <Badge className="bg-gold/10 text-gold border-gold/30 text-[9px]">+{e.permissions.length - 4}</Badge>}
              </div>
              <Progress value={e.kpi || 0} className="h-1.5" />
              <div className="flex gap-1 pt-2 border-t border-gold-soft">
                <Button size="sm" variant="outline" className="flex-1 border-gold/30 text-[10px]" onClick={() => { setEditing(e); setForm({ ...e, permissions: e.permissions || [] }); setOpen(true); }}><Edit2 className="w-3 h-3 ml-1" /> تعديل</Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-red-500" onClick={() => remove(e.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-gold/40 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="gold-text">{editing ? 'تعديل موظف' : 'موظف جديد'}</DialogTitle></DialogHeader>
          <Tabs defaultValue="basic">
            <TabsList className="grid grid-cols-3 bg-input/30">
              <TabsTrigger value="basic">الأساسيات</TabsTrigger>
              <TabsTrigger value="auth">الدخول</TabsTrigger>
              <TabsTrigger value="perms">الصلاحيات</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="grid grid-cols-2 gap-3 mt-3">
              <div className="col-span-2"><Label>الاسم الكامل</Label><Input value={form.name} onChange={ev => setForm({ ...form, name: ev.target.value })} className="bg-input/30 border-gold/20" /></div>
              <div><Label>الوظيفة</Label><Input value={form.role} onChange={ev => setForm({ ...form, role: ev.target.value })} className="bg-input/30 border-gold/20" /></div>
              <div><Label>الهاتف</Label><Input value={form.phone} onChange={ev => setForm({ ...form, phone: ev.target.value })} className="bg-input/30 border-gold/20" /></div>
              <div><Label>الراتب الأساسي</Label><Input type="number" value={form.salary} onChange={ev => setForm({ ...form, salary: ev.target.value })} className="bg-input/30 border-gold/20" /></div>
              <div><Label>KPI %</Label><Input type="number" value={form.kpi} onChange={ev => setForm({ ...form, kpi: ev.target.value })} className="bg-input/30 border-gold/20" /></div>
              <div><Label>بداية الدوام</Label><Input type="time" value={form.shiftStart} onChange={ev => setForm({ ...form, shiftStart: ev.target.value })} className="bg-input/30 border-gold/20" /></div>
              <div><Label>نهاية الدوام</Label><Input type="time" value={form.shiftEnd} onChange={ev => setForm({ ...form, shiftEnd: ev.target.value })} className="bg-input/30 border-gold/20" /></div>
              <div className="col-span-2"><Label>الصورة (Emoji)</Label><Input value={form.photo} onChange={ev => setForm({ ...form, photo: ev.target.value })} placeholder="👤" className="bg-input/30 border-gold/20 text-xl text-center" /></div>
            </TabsContent>
            <TabsContent value="auth" className="grid grid-cols-2 gap-3 mt-3">
              <div><Label>اسم المستخدم (Username)</Label><Input value={form.username} onChange={ev => setForm({ ...form, username: ev.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} className="bg-input/30 border-gold/20 font-mono" dir="ltr" /></div>
              <div><Label>كلمة المرور</Label><Input value={form.password} onChange={ev => setForm({ ...form, password: ev.target.value })} className="bg-input/30 border-gold/20 font-mono" dir="ltr" /></div>
              <div className="col-span-2 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20 text-xs space-y-1">
                <p className="text-cyan-400 font-bold">🔗 رابط دخول الموظف:</p>
                <p className="font-mono text-[10px]">{typeof window !== 'undefined' ? window.location.origin : ''}/employee</p>
                <p className="text-muted-foreground">يستخدم الموظف اليوزر وكلمة المرور هنا</p>
              </div>
              <div><Label>الحالة</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">نشط</SelectItem><SelectItem value="suspended">موقوف</SelectItem></SelectContent>
                </Select>
              </div>
            </TabsContent>
            <TabsContent value="perms" className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">حدد الأقسام التي يمكن للموظف الوصول إليها:</p>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map(p => (
                  <label key={p.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${form.permissions.includes(p.id) ? 'bg-gold/10 border-gold' : 'bg-input/30 border-gold-soft'}`}>
                    <input type="checkbox" checked={form.permissions.includes(p.id)} onChange={() => togglePerm(p.id)} className="w-4 h-4" />
                    <span className="text-sm">{p.label}</span>
                  </label>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <CustomFieldsGrid
            entity="employees"
            customFields={form.customFields}
            onUpdate={(cf) => setForm({ ...form, customFields: cf })}
            columns={2}
          />

          <DialogFooter><Button onClick={save} className="btn-gold w-full">حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper: format late duration like "1 ساعة و 40 دقيقة"
function formatLateDuration(minutes) {
  const m = Math.max(0, Math.floor(minutes || 0));
  if (m === 0) return '';
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (hours === 0) return `${mins} دقيقة`;
  if (mins === 0) return hours === 1 ? 'ساعة واحدة' : hours === 2 ? 'ساعتان' : `${hours} ساعات`;
  const hourPart = hours === 1 ? 'ساعة واحدة' : hours === 2 ? 'ساعتان' : `${hours} ساعات`;
  return `${hourPart} و ${mins} دقيقة`;
}

// Attendance photo viewer modal
function AttendancePhotoModal({ data, onClose }) {
  const [zoomed, setZoomed] = useState(false);
  const [showMap, setShowMap] = useState(false);
  if (!data) return null;
  const isCheckIn = data.type === 'in';
  const photoUrl = isCheckIn ? data.record.checkInPhoto : data.record.checkOutPhoto;
  const timeStr = isCheckIn ? data.record.checkIn : data.record.checkOut;
  const lat = isCheckIn ? data.record.checkInLat : data.record.checkOutLat;
  const lng = isCheckIn ? data.record.checkInLng : data.record.checkOutLng;
  return (
    <Dialog open={!!data} onOpenChange={onClose}>
      <DialogContent className={`glass-strong border-gold/40 ${zoomed || showMap ? 'max-w-4xl' : 'max-w-md'}`}>
        <DialogHeader>
          <DialogTitle className="gold-text flex items-center gap-2">
            {isCheckIn ? '📸 صورة الحضور' : '📸 صورة الانصراف'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-input/30 border border-gold-soft grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">الموظف:</span> <span className="font-bold">{data.record.employeeName}</span></div>
            <div><span className="text-muted-foreground">النوع:</span> <Badge className={isCheckIn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'}>{isCheckIn ? 'حضور' : 'انصراف'}</Badge></div>
            <div><span className="text-muted-foreground">التاريخ:</span> <span className="font-bold">{data.record.date}</span></div>
            <div><span className="text-muted-foreground">الوقت:</span> <span className="font-mono font-bold">{new Date(timeStr).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></div>
            {isCheckIn && data.record.isLate && (
              <div className="col-span-2"><span className="text-muted-foreground">التأخير:</span> <span className="font-bold text-amber-400">{formatLateDuration(data.record.lateMinutes)}</span></div>
            )}
            {(lat && lng) && (
              <div className="col-span-2 flex justify-between items-center">
                <span className="text-muted-foreground text-[10px]">📍 GPS: {lat.toFixed(4)}, {lng.toFixed(4)}</span>
                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setShowMap(!showMap)}>
                  {showMap ? '🖼️ الصورة' : '🗺️ الخريطة'}
                </Button>
              </div>
            )}
          </div>
          {showMap && lat && lng ? (
            <GPSMap lat={lat} lng={lng} label={`${data.record.employeeName} - ${isCheckIn ? 'حضور' : 'انصراف'}`} height={400} />
          ) : photoUrl ? (
            <div className="rounded-2xl overflow-hidden bg-black border-2 border-gold-soft cursor-zoom-in" onClick={() => setZoomed(!zoomed)}>
              <img src={photoUrl} alt="بصمة" className="w-full max-h-[70vh] object-contain" />
            </div>
          ) : (
            <div className="p-8 text-center bg-input/30 rounded-lg">
              <p className="text-sm text-muted-foreground">لا توجد صورة محفوظة لهذه البصمة</p>
            </div>
          )}
          {!showMap && <p className="text-[10px] text-center text-muted-foreground">انقر على الصورة للتكبير</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AttendanceView() {
  const [today, setToday] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [photoData, setPhotoData] = useState(null);
  const load = async () => {
    const [t, e] = await Promise.all([api('attendance/today'), api('employees')]);
    setToday(t); setEmployees(e);
  };
  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, []);

  const punchIn = async (employeeId) => {
    const r = await api('attendance/checkin', { method: 'POST', body: JSON.stringify({ employeeId, photoUrl: '/uploads/admin-manual.jpg' }) });
    if (r.error) toast.error(r.error); else { toast.success(r.record?.isLate ? `حضور متأخر بـ ${formatLateDuration(r.record.lateMinutes)}` : '✅ تم تسجيل الحضور'); load(); }
  };
  const punchOut = async (employeeId) => {
    const r = await api('attendance/checkout', { method: 'POST', body: JSON.stringify({ employeeId, photoUrl: '/uploads/admin-manual.jpg' }) });
    if (r.error) toast.error(r.error); else { toast.success(`✅ انصراف - عمل ${r.hoursWorked} ساعة`); load(); }
  };

  const enriched = employees.map(e => {
    const att = today.find(t => t.employeeId === e.id);
    return { ...e, attRecord: att };
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي اليوم</p><p className="text-2xl font-bold gold-text">{today.length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">حاضرون في الوقت</p><p className="text-2xl font-bold text-emerald-400">{today.filter(t => t.status === 'present').length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">متأخرون</p><p className="text-2xl font-bold text-amber-400">{today.filter(t => t.status === 'late').length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">لم يحضروا بعد</p><p className="text-2xl font-bold text-red-400">{employees.length - today.length}</p></div>
      </div>

      <Card className="glass-strong border-gold-soft">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-gold animate-pulse" /> الحضور والانصراف اليومي - {new Date().toLocaleDateString('ar-IQ')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold-soft text-right text-xs text-muted-foreground">
                  <th className="p-2">الموظف</th><th>الدوام</th><th>الدخول</th><th>الخروج</th><th>الساعات</th><th>الحالة</th><th>الصور</th><th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {enriched.map(e => (
                  <tr key={e.id} className="border-b border-gold-soft/30 hover:bg-gold/5">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{e.photo}</span>
                        <div>
                          <div className="text-xs font-bold">{e.name}</div>
                          <div className="text-[10px] text-muted-foreground">{e.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs font-mono">{e.shiftStart}-{e.shiftEnd}</td>
                    <td className="text-xs font-mono text-emerald-400">{e.attRecord?.checkIn ? new Date(e.attRecord.checkIn).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="text-xs font-mono text-cyan-400">{e.attRecord?.checkOut ? new Date(e.attRecord.checkOut).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="text-xs font-bold gold-text">{e.attRecord?.hoursWorked || 0}</td>
                    <td>
                      {!e.attRecord ? <Badge className="bg-muted text-muted-foreground text-[10px]">لم يحضر</Badge> :
                       e.attRecord.status === 'late' ? <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]" title={`متأخر ${formatLateDuration(e.attRecord.lateMinutes)}`}>⏰ متأخر {formatLateDuration(e.attRecord.lateMinutes)}</Badge> :
                       <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">✅ حاضر</Badge>}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {e.attRecord?.checkInPhoto && (
                          <Button size="sm" variant="outline" className="h-6 text-[9px] border-emerald-500/30 hover:bg-emerald-500/10 px-2" onClick={() => setPhotoData({ record: e.attRecord, type: 'in' })}>
                            <Camera className="w-3 h-3 ml-0.5" /> دخول
                          </Button>
                        )}
                        {e.attRecord?.checkOutPhoto && (
                          <Button size="sm" variant="outline" className="h-6 text-[9px] border-cyan-500/30 hover:bg-cyan-500/10 px-2" onClick={() => setPhotoData({ record: e.attRecord, type: 'out' })}>
                            <Camera className="w-3 h-3 ml-0.5" /> خروج
                          </Button>
                        )}
                        {!e.attRecord?.checkInPhoto && !e.attRecord?.checkOutPhoto && <span className="text-[10px] text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td>
                      {!e.attRecord ? (
                        <Button size="sm" onClick={() => punchIn(e.id)} className="h-7 text-[10px] btn-gold"><Activity className="w-3 h-3 ml-1" /> بصمة دخول</Button>
                      ) : !e.attRecord.checkOut ? (
                        <Button size="sm" onClick={() => punchOut(e.id)} className="h-7 text-[10px] btn-neon"><X className="w-3 h-3 ml-1" /> بصمة خروج</Button>
                      ) : (
                        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px]">منتهي</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AttendancePhotoModal data={photoData} onClose={() => setPhotoData(null)} />
    </div>
  );
}

// ============ ADVANCED TASK ACTIONS (Start/Complete/Transfer/Review/Duplicates) ============
function TaskAdvancedActions({ task, employees, onRefresh }) {
  const [busy, setBusy] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [dupsOpen, setDupsOpen] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [transferTo, setTransferTo] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [reviewForm, setReviewForm] = useState({ rating: 80, success: true, notes: '' });

  const canStart = !task.startedAt && task.status !== 'completed' && task.status !== 'pending_review';
  const canComplete = task.startedAt && !task.completedAt && task.status !== 'completed';
  const canTransfer = task.status !== 'completed' && task.status !== 'pending_review';
  const canReview = (task.status === 'completed' || task.status === 'pending_review' || task.completedAt);

  const doStart = async () => {
    setBusy('start');
    try {
      const r = await api(`tasks/${task.id}/start`, { method: 'POST', body: JSON.stringify({ userName: 'المدير' }) });
      if (r?.success) toast.success('▶️ بدأت المهمة'); else toast.error(r?.error || 'فشل');
      onRefresh && onRefresh();
    } finally { setBusy(null); }
  };
  const doComplete = async () => {
    const note = prompt('ملاحظة إكمال (اختيارية):') || '';
    setBusy('complete');
    try {
      const r = await api(`tasks/${task.id}/admin-complete`, { method: 'POST', body: JSON.stringify({ note, userName: 'المدير' }) });
      if (r?.success) toast.success(`✅ تم الإكمال (${r.durationMin} دقيقة)`);
      onRefresh && onRefresh();
    } finally { setBusy(null); }
  };
  const doTransfer = async () => {
    if (!transferTo) { toast.error('اختر موظفاً'); return; }
    setBusy('transfer');
    try {
      const emp = employees.find(e => e.id === transferTo);
      const r = await api(`tasks/${task.id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ toEmployeeId: transferTo, toEmployeeName: emp?.name, reason: transferReason, by: { id: 'manager', name: 'المدير' } }),
      });
      if (r?.success) { toast.success('🔄 تم التحويل'); setTransferOpen(false); setTransferTo(''); setTransferReason(''); }
      onRefresh && onRefresh();
    } finally { setBusy(null); }
  };
  const doReview = async () => {
    setBusy('review');
    try {
      const r = await api(`tasks/${task.id}/rate`, {
        method: 'POST',
        body: JSON.stringify({ rating: Number(reviewForm.rating), success: reviewForm.success, notes: reviewForm.notes, by: { id: 'manager', name: 'المدير' } }),
      });
      if (r?.success) { toast.success('🏆 تم التقييم'); setReviewOpen(false); }
      onRefresh && onRefresh();
    } finally { setBusy(null); }
  };
  const loadDups = async () => {
    const d = await api(`tasks/${task.id}/duplicates`);
    setDuplicates(Array.isArray(d) ? d : []);
    setDupsOpen(true);
  };

  return (
    <>
      {canStart && (
        <Button size="sm" variant="outline" className="h-7 text-[10px] border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10" onClick={doStart} disabled={busy === 'start'}>
          ▶️ بدء
        </Button>
      )}
      {canComplete && (
        <Button size="sm" variant="outline" className="h-7 text-[10px] border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10" onClick={doComplete} disabled={busy === 'complete'}>
          ✅ إنهاء
        </Button>
      )}
      {canTransfer && (
        <Button size="sm" variant="outline" className="h-7 text-[10px] border-violet-500/40 text-violet-400 hover:bg-violet-500/10" onClick={() => setTransferOpen(true)}>
          🔄 تحويل
        </Button>
      )}
      {canReview && (
        <Button size="sm" variant="outline" className="h-7 text-[10px] border-amber-500/40 text-amber-400 hover:bg-amber-500/10" onClick={() => setReviewOpen(true)}>
          🏆 تقييم
        </Button>
      )}
      <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-orange-400" onClick={loadDups} title="مهام مكررة">
        <span className="text-sm">🔁</span>
      </Button>

      {/* Transfer dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="glass-strong border-violet-500/30">
          <DialogHeader><DialogTitle className="text-violet-400">🔄 تحويل المهمة</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">إلى موظف</Label>
            <Select value={transferTo} onValueChange={setTransferTo}>
              <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="اختر..." /></SelectTrigger>
              <SelectContent>
                {employees.filter(e => e.id !== task.assignedTo).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Label className="text-xs">سبب التحويل</Label>
            <Textarea value={transferReason} onChange={e => setTransferReason(e.target.value)} rows={3} className="bg-input/30 border-gold/20" placeholder="مثلاً: الموظف الحالي غير متاح" />
          </div>
          <DialogFooter>
            <Button onClick={doTransfer} disabled={busy === 'transfer'} className="btn-gold">تأكيد التحويل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="glass-strong border-amber-500/30">
          <DialogHeader><DialogTitle className="text-amber-400">🏆 تقييم المهمة</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">نسبة النجاح: {reviewForm.rating}%</Label>
            <input type="range" min="0" max="100" value={reviewForm.rating} onChange={e => setReviewForm(f => ({ ...f, rating: e.target.value }))} className="w-full" />
            <div className="flex gap-2">
              <Button size="sm" variant={reviewForm.success ? 'default' : 'outline'} onClick={() => setReviewForm(f => ({ ...f, success: true }))} className={reviewForm.success ? 'btn-gold' : ''}>✅ ناجحة</Button>
              <Button size="sm" variant={!reviewForm.success ? 'default' : 'outline'} onClick={() => setReviewForm(f => ({ ...f, success: false }))} className={!reviewForm.success ? 'bg-red-500/20 text-red-400' : ''}>❌ فاشلة</Button>
            </div>
            <Label className="text-xs">ملاحظات المدير</Label>
            <Textarea value={reviewForm.notes} onChange={e => setReviewForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="bg-input/30 border-gold/20" />
          </div>
          <DialogFooter>
            <Button onClick={doReview} disabled={busy === 'review'} className="btn-gold">حفظ التقييم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicates dialog */}
      <Dialog open={dupsOpen} onOpenChange={setDupsOpen}>
        <DialogContent className="glass-strong border-orange-500/30 max-w-2xl">
          <DialogHeader><DialogTitle className="text-orange-400">🔁 مهام مكررة لـ "{task.title}"</DialogTitle></DialogHeader>
          {duplicates.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">لا توجد مهام مكررة في آخر 180 يوماً</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {duplicates.map(d => (
                <div key={d.id} className="glass-card rounded-lg p-3 border border-orange-500/30">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold">{d.title}</p>
                    <Badge variant="outline" className="text-[9px]">{d.status}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">📅 {new Date(d.createdAt).toLocaleString('ar-IQ')}</p>
                  <p className="text-[10px] text-muted-foreground">👤 {d.assignedToName}</p>
                  {d.review && (
                    <div className="mt-1 p-2 bg-amber-500/5 rounded border border-amber-500/30">
                      <p className="text-[10px] text-amber-400">🏆 تقييم المدير السابق: {d.review.rating}%</p>
                      {d.review.notes && <p className="text-[10px] italic mt-0.5">📝 {d.review.notes}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TasksManager() {
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [reviewTask, setReviewTask] = useState(null);
  const [mapTask, setMapTask] = useState(null);
  const blank = { title: '', description: '', priority: 'medium', dueDate: new Date().toISOString().slice(0, 10), assignedTo: '', notes: '', status: 'pending', progress: 0, attachments: [], taskType: 'general', subscriberId: '', subscriberName: '', subscriberPhone: '', subscriberAddress: '', subscriberLat: null, subscriberLng: null, faultDescription: '', recurrence: { enabled: false, type: 'weekly', interval: 1, endDate: '' } };
  const [form, setForm] = useState(blank);
  const [subSearch, setSubSearch] = useState('');
  const [subResults, setSubResults] = useState([]);
  const load = async () => {
    const [t, e] = await Promise.all([api('tasks'), api('employees')]);
    setItems(t); setEmployees(e);
  };
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, []);

  // Subscriber autocomplete search (only for subscriber_repair tasks)
  useEffect(() => {
    if (form.taskType !== 'subscriber_repair' || !subSearch || subSearch.length < 2) {
      setSubResults([]);
      return;
    }
    const t = setTimeout(() => {
      api(`subscribers/search?q=${encodeURIComponent(subSearch)}`).then(r => {
        if (Array.isArray(r)) setSubResults(r);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [subSearch, form.taskType]);

  const selectSubscriber = (s) => {
    setForm(f => ({
      ...f,
      subscriberId: s.id,
      subscriberName: s.name,
      subscriberPhone: s.phone || '',
      subscriberAddress: s.address || s.zoneName || '',
      subscriberLat: s.userLat ?? null,
      subscriberLng: s.userLng ?? null,
      title: f.title || `🔧 صيانة - ${s.name}`,
    }));
    setSubSearch('');
    setSubResults([]);
  };

  const filtered = statusFilter === 'all' ? items
    : statusFilter === 'awaiting_review' ? items.filter(t => t.status === 'pending_review')
    : items.filter(t => t.status === statusFilter);

  const save = async () => {
    if (!form.title || !form.assignedTo) { toast.error('العنوان والموظف مطلوبان'); return; }
    if (form.taskType === 'subscriber_repair' && !form.subscriberId) {
      toast.error('اختر المشترك من القائمة');
      return;
    }
    const emp = employees.find(e => e.id === form.assignedTo);
    await api('tasks', { method: 'POST', body: JSON.stringify({ ...form, assignedToName: emp?.name, createdBy: 'المدير', createdById: 'manager' }) });
    toast.success('✅ تم إنشاء المهمة وإرسال إشعار للموظف'); setOpen(false); setForm(blank); load();
  };
  const remove = async (id) => { await api(`tasks/${id}`, { method: 'DELETE' }); toast.success('تم الحذف'); load(); };

  const priorityCls = { high: 'bg-red-500/20 text-red-400 border-red-500/30', medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30', low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
  const statusCls = {
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    new: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    in_progress: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    pending_review: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    rejected_by_employee: 'bg-red-500/20 text-red-400 border-red-500/30',
    rejected_by_manager: 'bg-red-500/30 text-red-300 border-red-500/40',
    revision: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };
  const statusLabel = {
    pending: 'بانتظار القبول', new: 'بانتظار القبول',
    in_progress: 'جاري العمل', pending_review: 'بانتظار المراجعة',
    completed: 'مكتملة', rejected_by_employee: 'رفض الموظف',
    rejected_by_manager: 'مرفوضة', revision: 'إعادة تعديل',
  };

  const counts = {
    all: items.length,
    pending_review: items.filter(t => t.status === 'pending_review').length,
    pending: items.filter(t => ['pending', 'new'].includes(t.status)).length,
    in_progress: items.filter(t => t.status === 'in_progress').length,
    completed: items.filter(t => t.status === 'completed').length,
    rejected_by_employee: items.filter(t => t.status === 'rejected_by_employee').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { k: 'all', l: '📋 الكل', c: counts.all },
            { k: 'pending_review', l: '🟣 بانتظار المراجعة', c: counts.pending_review },
            { k: 'pending', l: '🟡 بانتظار القبول', c: counts.pending },
            { k: 'in_progress', l: '🔵 جاري العمل', c: counts.in_progress },
            { k: 'completed', l: '✅ مكتملة', c: counts.completed },
            { k: 'rejected_by_employee', l: '❌ رفض الموظف', c: counts.rejected_by_employee },
          ].map(b => (
            <button key={b.k} onClick={() => setStatusFilter(b.k)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${statusFilter === b.k ? 'bg-gold/20 border-gold text-gold' : 'bg-input/30 border-gold-soft text-muted-foreground hover:text-gold'}`}>
              {b.l} {b.c > 0 && <span className="font-bold">({b.c})</span>}
            </button>
          ))}
        </div>
        <Button onClick={() => { setForm(blank); setOpen(true); }} className="btn-gold"><Plus className="w-4 h-4 ml-1" /> مهمة جديدة</Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(t => (
          <Card key={t.id} className={`glass-card border-gold-soft hover:border-gold/50 ${t.status === 'pending_review' ? 'ring-2 ring-purple-500/40' : ''}`}>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-bold text-sm flex-1">{t.title}</h3>
                <Badge className={priorityCls[t.priority] + ' text-[9px]'}>{t.priority}</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>

              {t.taskType === 'subscriber_repair' && t.subscriberName && (
                <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-[10px] space-y-0.5">
                  <p className="font-bold text-cyan-400">📡 صيانة مشترك</p>
                  <p>👤 <span className="font-bold">{t.subscriberName}</span></p>
                  {t.subscriberPhone && <p>📞 <a href={`tel:${t.subscriberPhone}`} className="font-mono hover:text-gold" dir="ltr">{t.subscriberPhone}</a></p>}
                  {t.subscriberAddress && <p className="line-clamp-1">📍 {t.subscriberAddress}</p>}
                  {t.faultDescription && <p className="text-red-400">⚠️ {t.faultDescription}</p>}
                </div>
              )}

              <div className="flex justify-between text-[10px]">
                <span className="text-cyan-400">👤 {t.assignedToName}</span>
                <span className="text-muted-foreground">📅 {t.dueDate}</span>
              </div>

              {/* ============ TIME TRACKING (وقت البدء/الانتهاء/المدة) ============ */}
              {(t.startedAt || t.completedAt) && (
                <div className="grid grid-cols-3 gap-1 text-[9px] p-1.5 rounded bg-input/30 border border-gold-soft/30">
                  <div className="text-center">
                    <p className="text-muted-foreground">▶️ بدء</p>
                    <p className="font-mono text-cyan-400">{t.startedAt ? new Date(t.startedAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">✅ انتهاء</p>
                    <p className="font-mono text-emerald-400">{t.completedAt ? new Date(t.completedAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">⏱️ المدة</p>
                    <p className="font-bold gold-text">
                      {t.durationMin != null ? (
                        t.durationMin < 60 ? `${t.durationMin}د` : `${Math.floor(t.durationMin / 60)}س ${t.durationMin % 60}د`
                      ) : '—'}
                    </p>
                  </div>
                </div>
              )}

              {/* Recurrence badge */}
              {t.recurrence?.enabled && (
                <div className="text-[10px] p-1.5 rounded bg-violet-500/10 border border-violet-500/30 text-violet-400 flex items-center justify-between">
                  <span>🔁 مهمة دورية: {t.recurrence.type === 'daily' ? 'يومية' : t.recurrence.type === 'weekly' ? 'أسبوعية' : 'شهرية'} (كل {t.recurrence.interval || 1})</span>
                  {t.spawnedFromTaskId && <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[8px]">نسخة جديدة</Badge>}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">التقدم</span><span className="font-bold">{t.progress || 0}%</span></div>
                <Progress value={t.progress || 0} className="h-1.5" />
              </div>

              {t.status === 'rejected_by_employee' && t.rejectionReason && (
                <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-[10px]">
                  <span className="font-bold text-red-400">سبب الرفض: </span>{t.rejectionReason}
                </div>
              )}

              {t.report && (
                <div className="p-2 rounded bg-purple-500/10 border border-purple-500/30 text-[10px] space-y-1">
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-purple-400">📋 تقرير الإنجاز ({t.report.progress || 0}%):</p>
                    {t.report.attachments?.length > 0 && (
                      <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px]">📎 {t.report.attachments.length}</Badge>
                    )}
                  </div>
                  <p className="line-clamp-2">{t.report.summary}</p>
                  {/* Photo thumbnails */}
                  {t.report.attachments?.filter(a => /\.(jpg|jpeg|png|webp|gif)$/i.test(a.url || a.name)).slice(0, 4).length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {t.report.attachments.filter(a => /\.(jpg|jpeg|png|webp|gif)$/i.test(a.url || a.name)).slice(0, 4).map((a, i) => (
                        <img key={i} src={a.url} alt={a.name || 'photo'} className="w-12 h-12 object-cover rounded border border-purple-500/30 cursor-pointer hover:scale-110 transition-transform" onClick={() => setReviewTask(t)} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {t.review && (t.status === 'completed' || t.status === 'rejected_by_manager') && t.review.rating && (
                <div className="text-[10px] grid grid-cols-2 gap-1 p-2 rounded bg-input/30 border border-gold-soft">
                  <span>السرعة: {'⭐'.repeat(t.review.rating.speed || 0)}</span>
                  <span>الجودة: {'⭐'.repeat(t.review.rating.quality || 0)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-gold-soft">
                <Badge className={statusCls[t.status] + ' text-[10px]'}>{statusLabel[t.status] || t.status}</Badge>
                <div className="flex gap-1">
                  {t.taskType === 'subscriber_repair' && (t.subscriberLat || t.subscriberLng) && (
                    <Button size="sm" variant="outline" className="h-7 text-[10px] border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400" onClick={() => setMapTask(t)}>
                      <MapPin className="w-3 h-3 ml-1" /> خريطة
                    </Button>
                  )}
                  {/* Show "مراجعة" button for any task with a report (pending review OR already reviewed - to view details) */}
                  {t.report && (
                    <Button
                      size="sm"
                      className={t.status === 'pending_review' ? 'btn-gold h-7 text-[10px] animate-pulse' : 'h-7 text-[10px] bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30'}
                      onClick={() => setReviewTask(t)}
                    >
                      <FileText className="w-3 h-3 ml-1" />
                      {t.status === 'pending_review' ? 'مراجعة الآن' : 'عرض المراجعة'}
                    </Button>
                  )}
                  <TaskAdvancedActions task={t} employees={employees} onRefresh={load} />
                  <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-red-500" onClick={() => remove(t.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Task Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-gold/40 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="gold-text">{form.taskType === 'subscriber_repair' ? '🔧 مهمة صيانة مشترك' : '📋 مهمة جديدة'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Task Type Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, taskType: 'general' })}
                className={`p-3 rounded-lg border-2 transition-all text-right ${form.taskType === 'general' ? 'border-gold bg-gold/10' : 'border-gold-soft bg-input/30 hover:border-gold/50'}`}
              >
                <div className="font-bold text-sm">📋 مهمة عامة</div>
                <div className="text-[10px] text-muted-foreground">مهمة داخلية عادية</div>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, taskType: 'subscriber_repair' })}
                className={`p-3 rounded-lg border-2 transition-all text-right ${form.taskType === 'subscriber_repair' ? 'border-cyan-500 bg-cyan-500/10' : 'border-gold-soft bg-input/30 hover:border-cyan-500/50'}`}
              >
                <div className="font-bold text-sm">🔧 صيانة مشترك</div>
                <div className="text-[10px] text-muted-foreground">مع موقع GPS تلقائي</div>
              </button>
            </div>

            {/* Subscriber Picker for subscriber_repair */}
            {form.taskType === 'subscriber_repair' && (
              <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/30 space-y-3">
                <div>
                  <Label className="text-xs flex items-center gap-1">
                    <Search className="w-3 h-3" /> ابحث عن المشترك (بالاسم/الهاتف/اليوزر)
                  </Label>
                  <div className="relative">
                    <Input
                      value={subSearch}
                      onChange={e => setSubSearch(e.target.value)}
                      placeholder="ابدأ الكتابة..."
                      className="bg-input/50 border-cyan-500/30"
                    />
                    {subResults.length > 0 && (
                      <div className="absolute z-50 top-full mt-1 right-0 left-0 max-h-64 overflow-y-auto rounded-lg bg-background border-2 border-cyan-500/50 shadow-xl">
                        {subResults.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => selectSubscriber(s)}
                            className="w-full text-right p-2 hover:bg-cyan-500/10 border-b border-gold-soft/30 last:border-0"
                          >
                            <div className="font-bold text-xs">{s.name}</div>
                            <div className="text-[10px] text-muted-foreground flex gap-2">
                              <span>📞 {s.phone || '-'}</span>
                              <span>📍 {s.zoneName || '-'}</span>
                              {(s.userLat && s.userLng) && <span className="text-emerald-400">🛰️ GPS</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {form.subscriberId && (
                  <div className="space-y-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex justify-between items-start">
                      <div className="text-xs">
                        <p className="font-bold gold-text">{form.subscriberName}</p>
                        <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">{form.subscriberPhone}</p>
                        <p className="text-[10px] text-muted-foreground">{form.subscriberAddress}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] hover:text-red-500" onClick={() => setForm({ ...form, subscriberId: '', subscriberName: '', subscriberPhone: '', subscriberAddress: '', subscriberLat: null, subscriberLng: null })}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    {form.subscriberLat && form.subscriberLng ? (
                      <div className="relative">
                        <GPSMap lat={form.subscriberLat} lng={form.subscriberLng} label={form.subscriberName} height={180} />
                        <Badge className="absolute top-2 right-2 bg-emerald-500/90 text-white border-0 z-[1000]">🛰️ موقع مدعوم</Badge>
                      </div>
                    ) : (
                      <p className="text-[10px] text-amber-400">⚠️ لا توجد إحداثيات GPS لهذا المشترك</p>
                    )}
                  </div>
                )}

                <div>
                  <Label className="text-xs">وصف العطل / المشكلة</Label>
                  <Textarea
                    value={form.faultDescription}
                    onChange={e => setForm({ ...form, faultDescription: e.target.value })}
                    placeholder="مثال: انقطاع الإنترنت، ضعف الإشارة، مشكلة بالكابل..."
                    className="bg-input/30 border-cyan-500/30 h-20"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>عنوان المهمة</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-input/30 border-gold/20" /></div>
              <div className="col-span-2"><Label>{form.taskType === 'subscriber_repair' ? 'تعليمات إضافية للفني' : 'الوصف'}</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-input/30 border-gold/20 h-20" /></div>
              <div><Label>{form.taskType === 'subscriber_repair' ? 'الفني المسؤول' : 'الموظف المسؤول'}</Label>
                <Select value={form.assignedTo} onValueChange={v => setForm({ ...form, assignedTo: v })}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="اختر موظف" /></SelectTrigger>
                  <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.photo} {e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>الأولوية</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">🔴 عالية</SelectItem>
                    <SelectItem value="medium">🟡 متوسطة</SelectItem>
                    <SelectItem value="low">🟢 منخفضة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>تاريخ التسليم</Label><Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="bg-input/30 border-gold/20" /></div>

              {/* ============ RECURRENCE (مهمة دورية / متكررة) ============ */}
              <div className="col-span-2 p-3 rounded-lg border border-violet-500/30 bg-violet-500/5 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-bold text-violet-400 flex items-center gap-2">🔁 مهمة متكررة (دورية)</span>
                  <input
                    type="checkbox"
                    checked={!!form.recurrence?.enabled}
                    onChange={e => setForm({ ...form, recurrence: { ...(form.recurrence || { type: 'weekly', interval: 1 }), enabled: e.target.checked } })}
                    className="w-4 h-4 accent-violet-500"
                  />
                </label>
                {form.recurrence?.enabled && (
                  <>
                    <p className="text-[10px] text-violet-300/80">عند إكمال المهمة، سيتم إنشاء نسخة جديدة تلقائياً للموظف نفسه بتاريخ تسليم محسوب.</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px]">التكرار</Label>
                        <Select value={form.recurrence?.type || 'weekly'} onValueChange={v => setForm({ ...form, recurrence: { ...form.recurrence, type: v } })}>
                          <SelectTrigger className="bg-input/30 border-violet-500/30 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">يومياً</SelectItem>
                            <SelectItem value="weekly">أسبوعياً</SelectItem>
                            <SelectItem value="monthly">شهرياً</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px]">كل (مرات)</Label>
                        <Input type="number" min="1" value={form.recurrence?.interval ?? 1} onChange={e => setForm({ ...form, recurrence: { ...form.recurrence, interval: Number(e.target.value) || 1 } })} className="bg-input/30 border-violet-500/30 h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px]">تاريخ الإيقاف (اختياري)</Label>
                        <Input type="date" value={form.recurrence?.endDate || ''} onChange={e => setForm({ ...form, recurrence: { ...form.recurrence, endDate: e.target.value } })} className="bg-input/30 border-violet-500/30 h-8 text-xs" />
                      </div>
                    </div>
                    <p className="text-[10px] text-amber-400">
                      💡 مثال: {form.recurrence?.type === 'daily' ? `كل ${form.recurrence?.interval || 1} يوم` :
                                form.recurrence?.type === 'weekly' ? `كل ${form.recurrence?.interval || 1} أسبوع` :
                                `كل ${form.recurrence?.interval || 1} شهر`}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={save} className="btn-gold w-full">{form.taskType === 'subscriber_repair' ? '🚀 إنشاء مهمة الصيانة وإرسالها للفني' : '✅ إنشاء المهمة وإرسال للموظف'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Map View Dialog */}
      <Dialog open={!!mapTask} onOpenChange={() => setMapTask(null)}>
        <DialogContent className="glass-strong border-cyan-500/40 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 flex items-center gap-2">
              <MapPin className="w-5 h-5" /> موقع المشترك - {mapTask?.subscriberName}
            </DialogTitle>
          </DialogHeader>
          {mapTask && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-input/30 border border-gold-soft">
                  <p className="text-muted-foreground text-[10px]">المشترك</p>
                  <p className="font-bold">{mapTask.subscriberName}</p>
                </div>
                <div className="p-2 rounded bg-input/30 border border-gold-soft">
                  <p className="text-muted-foreground text-[10px]">الهاتف</p>
                  <a href={`tel:${mapTask.subscriberPhone}`} className="font-bold font-mono hover:text-gold" dir="ltr">{mapTask.subscriberPhone}</a>
                </div>
                <div className="col-span-2 p-2 rounded bg-red-500/10 border border-red-500/30">
                  <p className="text-muted-foreground text-[10px]">وصف العطل</p>
                  <p className="font-bold text-red-400">{mapTask.faultDescription || mapTask.description}</p>
                </div>
              </div>
              <GPSMap lat={mapTask.subscriberLat} lng={mapTask.subscriberLng} label={mapTask.subscriberName} height={400} />
              <div className="flex gap-2 justify-end">
                <a href={`https://www.google.com/maps?q=${mapTask.subscriberLat},${mapTask.subscriberLng}`} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400">
                    🗺️ افتح في Google Maps
                  </Button>
                </a>
                <a href={`https://waze.com/ul?ll=${mapTask.subscriberLat},${mapTask.subscriberLng}&navigate=yes`} target="_blank" rel="noreferrer">
                  <Button className="btn-neon">
                    🚗 فتح في Waze
                  </Button>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TaskReviewDialog task={reviewTask} onClose={() => setReviewTask(null)} onDone={() => { setReviewTask(null); load(); }} />
    </div>
  );
}

function TaskReviewDialog({ task, onClose, onDone }) {
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
                    {task.report.attachments.map((f, i) => (
                      <a key={i} href={f.url} target="_blank" rel="noreferrer" className="block">
                        {f.url?.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                          <img src={f.url} alt={f.name} className="w-full h-16 object-cover rounded border border-gold/20" />
                        ) : (
                          <div className="w-full h-16 flex items-center justify-center bg-input/30 rounded border border-gold/20">
                            <FileText className="w-6 h-6 text-cyan-400" />
                          </div>
                        )}
                        <p className="text-[9px] truncate mt-1">{f.name}</p>
                      </a>
                    ))}
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

// ============ LEAVES MANAGER ============
function LeavesManager() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [rejectItem, setRejectItem] = useState(null);
  const [reason, setReason] = useState('');

  const load = async () => {
    const r = await api('leaves');
    if (Array.isArray(r)) setItems(r);
  };
  useEffect(() => { load(); const i = setInterval(load, 20000); return () => clearInterval(i); }, []);

  const filtered = filter === 'all' ? items : items.filter(x => x.status === filter);

  const approve = async (id) => {
    const r = await api(`leaves/${id}/approve`, { method: 'POST', body: JSON.stringify({ approvedBy: 'المدير' }) });
    if (r.error) toast.error(r.error); else { toast.success('✅ تمت الموافقة'); load(); }
  };
  const reject = async () => {
    if (!reason.trim()) { toast.error('سبب الرفض مطلوب'); return; }
    const r = await api(`leaves/${rejectItem.id}/reject`, { method: 'POST', body: JSON.stringify({ approvedBy: 'المدير', reason }) });
    if (r.error) toast.error(r.error); else { toast.success('تم الرفض'); setRejectItem(null); setReason(''); load(); }
  };

  const TYPE_LABEL = { annual: 'سنوية', sick: 'مرضية', emergency: 'طارئة', unpaid: 'بدون راتب', other: 'أخرى' };
  const counts = {
    all: items.length,
    pending: items.filter(x => x.status === 'pending').length,
    approved: items.filter(x => x.status === 'approved').length,
    rejected: items.filter(x => x.status === 'rejected').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {['pending', 'approved', 'rejected', 'all'].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs border ${filter === s ? 'bg-gold/20 border-gold text-gold' : 'bg-input/30 border-gold-soft text-muted-foreground'}`}>
            {s === 'pending' ? `🟡 قيد المراجعة (${counts.pending})` : s === 'approved' ? `✅ مقبولة (${counts.approved})` : s === 'rejected' ? `❌ مرفوضة (${counts.rejected})` : `📋 الكل (${counts.all})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">لا توجد طلبات في هذه الفئة</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map(l => (
            <Card key={l.id} className="glass-card border-gold-soft">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">{l.employeeName}</p>
                    <p className="text-xs text-muted-foreground">{TYPE_LABEL[l.type] || l.type} · {l.days} يوم</p>
                  </div>
                  <Badge className={l.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : l.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                    {l.status === 'pending' ? 'قيد المراجعة' : l.status === 'approved' ? 'موافق' : 'مرفوض'}
                  </Badge>
                </div>
                <p className="text-xs">📅 {l.startDate} → {l.endDate}</p>
                {l.reason && <p className="text-xs text-muted-foreground">📝 {l.reason}</p>}
                {l.rejectionReason && <p className="text-xs text-red-400">سبب الرفض: {l.rejectionReason}</p>}
                {l.status === 'pending' && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gold-soft">
                    <Button onClick={() => approve(l.id)} size="sm" className="btn-gold h-8 text-xs">✅ موافقة</Button>
                    <Button onClick={() => setRejectItem(l)} size="sm" variant="outline" className="border-red-500/30 text-red-400 h-8 text-xs">❌ رفض</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!rejectItem} onOpenChange={() => { setRejectItem(null); setReason(''); }}>
        <DialogContent className="glass-strong border-gold/40">
          <DialogHeader><DialogTitle className="text-red-400">رفض طلب الإجازة</DialogTitle></DialogHeader>
          <p className="text-xs">الموظف: <span className="font-bold">{rejectItem?.employeeName}</span></p>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب الرفض..." className="bg-input/30 border-gold/20 h-24" />
          <DialogFooter>
            <Button onClick={reject} className="bg-red-500 hover:bg-red-600 text-white w-full">إرسال الرفض</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ ADVANCES MANAGER ============
function AdvancesManager() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [approveItem, setApproveItem] = useState(null);
  const [installments, setInstallments] = useState(3);
  const [rejectItem, setRejectItem] = useState(null);
  const [reason, setReason] = useState('');

  const load = async () => {
    const r = await api('advances');
    if (Array.isArray(r)) setItems(r);
  };
  useEffect(() => { load(); const i = setInterval(load, 20000); return () => clearInterval(i); }, []);

  const filtered = filter === 'all' ? items : items.filter(x => x.status === filter);

  const approve = async () => {
    const r = await api(`advances/${approveItem.id}/approve`, { method: 'POST', body: JSON.stringify({ approvedBy: 'المدير', installments }) });
    if (r.error) toast.error(r.error); else { toast.success('✅ تمت الموافقة - سيُخصم القسط شهرياً من الراتب'); setApproveItem(null); load(); }
  };
  const reject = async () => {
    if (!reason.trim()) { toast.error('سبب الرفض مطلوب'); return; }
    const r = await api(`advances/${rejectItem.id}/reject`, { method: 'POST', body: JSON.stringify({ approvedBy: 'المدير', reason }) });
    if (r.error) toast.error(r.error); else { toast.success('تم الرفض'); setRejectItem(null); setReason(''); load(); }
  };
  const payInstallment = async (id) => {
    const r = await api(`advances/${id}/pay-installment`, { method: 'POST' });
    if (r.error) toast.error(r.error); else { toast.success('✅ تم تسجيل قسط'); load(); }
  };

  const counts = {
    all: items.length,
    pending: items.filter(x => x.status === 'pending').length,
    approved: items.filter(x => x.status === 'approved').length,
    rejected: items.filter(x => x.status === 'rejected').length,
    paid: items.filter(x => x.status === 'paid').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {['pending', 'approved', 'paid', 'rejected', 'all'].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs border ${filter === s ? 'bg-gold/20 border-gold text-gold' : 'bg-input/30 border-gold-soft text-muted-foreground'}`}>
            {s === 'pending' ? `🟡 قيد المراجعة (${counts.pending})` : s === 'approved' ? `💸 قيد التسديد (${counts.approved})` : s === 'paid' ? `🎉 مسددة (${counts.paid})` : s === 'rejected' ? `❌ مرفوضة (${counts.rejected})` : `📋 الكل (${counts.all})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">لا توجد طلبات</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map(a => (
            <Card key={a.id} className="glass-card border-gold-soft">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">{a.employeeName}</p>
                    <p className="text-xl font-bold gold-text">{fmt(a.amount)} د.ع</p>
                    <p className="text-xs text-muted-foreground">{a.installments} قسط × {fmt(a.perInstallment)} د.ع</p>
                  </div>
                  <Badge className={a.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : a.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : a.status === 'paid' ? 'bg-purple-500/20 text-purple-400' : 'bg-red-500/20 text-red-400'}>
                    {a.status === 'pending' ? 'قيد المراجعة' : a.status === 'approved' ? 'قيد التسديد' : a.status === 'paid' ? 'مسددة' : 'مرفوضة'}
                  </Badge>
                </div>
                {a.reason && <p className="text-xs text-muted-foreground">📝 {a.reason}</p>}
                {a.status === 'approved' && (
                  <>
                    <div className="flex justify-between text-xs">
                      <span>المسدد: {a.paidInstallments}/{a.installments}</span>
                      <span>المتبقي: <span className="font-bold text-red-400">{fmt(a.remainingAmount)} د.ع</span></span>
                    </div>
                    <Progress value={(a.paidInstallments / a.installments) * 100} className="h-2" />
                    <Button onClick={() => payInstallment(a.id)} size="sm" className="btn-neon w-full h-8 text-xs">تسديد قسط ({fmt(a.perInstallment)} د.ع)</Button>
                  </>
                )}
                {a.rejectionReason && <p className="text-xs text-red-400">سبب الرفض: {a.rejectionReason}</p>}
                {a.status === 'pending' && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gold-soft">
                    <Button onClick={() => { setApproveItem(a); setInstallments(a.installments || 3); }} size="sm" className="btn-gold h-8 text-xs">✅ موافقة</Button>
                    <Button onClick={() => setRejectItem(a)} size="sm" variant="outline" className="border-red-500/30 text-red-400 h-8 text-xs">❌ رفض</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!approveItem} onOpenChange={() => setApproveItem(null)}>
        <DialogContent className="glass-strong border-gold/40">
          <DialogHeader><DialogTitle className="gold-text">الموافقة على السلفة</DialogTitle></DialogHeader>
          <p className="text-xs">الموظف: <span className="font-bold">{approveItem?.employeeName}</span></p>
          <p className="text-xs">المبلغ: <span className="font-bold gold-text">{fmt(approveItem?.amount)} د.ع</span></p>
          <div>
            <Label className="text-xs">عدد الأقساط (سيُخصم القسط من الراتب الشهري)</Label>
            <Input type="number" min="1" max="24" value={installments} onChange={e => setInstallments(Number(e.target.value))} className="bg-input/30 border-gold/20" />
            <p className="text-[10px] text-muted-foreground mt-1">قسط الشهر: <span className="font-bold gold-text">{fmt(Math.round((approveItem?.amount || 0) / Math.max(1, installments)))} د.ع</span></p>
          </div>
          <DialogFooter>
            <Button onClick={approve} className="btn-gold w-full">تأكيد الموافقة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectItem} onOpenChange={() => { setRejectItem(null); setReason(''); }}>
        <DialogContent className="glass-strong border-gold/40">
          <DialogHeader><DialogTitle className="text-red-400">رفض طلب السلفة</DialogTitle></DialogHeader>
          <p className="text-xs">الموظف: <span className="font-bold">{rejectItem?.employeeName}</span></p>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب الرفض..." className="bg-input/30 border-gold/20 h-24" />
          <DialogFooter>
            <Button onClick={reject} className="bg-red-500 hover:bg-red-600 text-white w-full">إرسال الرفض</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayrollView() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm] = useState({ employeeId: '', type: 'bonus', amount: 50000, reason: '' });

  useEffect(() => { api('employees').then(e => { setEmployees(e); if (e.length) setSelectedEmp(e[0].id); }); }, []);
  const reload = () => { if (selectedEmp && month) api(`employees/${selectedEmp}/payroll?month=${month}`).then(setData); };
  useEffect(() => { reload(); }, [selectedEmp, month]);

  const addEntry = async () => {
    if (!form.amount || !form.reason) { toast.error('املأ الحقول'); return; }
    const emp = employees.find(e => e.id === (form.employeeId || selectedEmp));
    if (editingEntry) {
      // Update existing entry
      const r = await api(`payroll-entries/${editingEntry.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          employeeId: form.employeeId || selectedEmp,
          employeeName: emp?.name,
          type: form.type,
          amount: Number(form.amount),
          reason: form.reason,
        }),
      });
      if (r?.error) { toast.error(r.error); return; }
      toast.success('✅ تم التعديل');
    } else {
      const r = await api('payroll-entries', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          employeeId: form.employeeId || selectedEmp,
          employeeName: emp?.name,
          amount: Number(form.amount),
          date: new Date().toISOString().slice(0, 10),
          auto: false,
        }),
      });
      if (r?.error) { toast.error(r.error); return; }
      toast.success('✅ تم الإضافة');
    }
    setOpen(false);
    setEditingEntry(null);
    reload();
  };

  const editEntry = (entry) => {
    setEditingEntry(entry);
    setForm({
      employeeId: entry.employeeId || selectedEmp,
      type: entry.type,
      amount: entry.amount,
      reason: entry.reason,
    });
    setOpen(true);
  };

  const deleteEntry = async (entry) => {
    if (entry.auto) {
      if (!confirm(`⚠️ هذا القيد تلقائي (${entry.reason}).\nهل أنت متأكد من حذفه؟ سيتم استرجاع المبلغ للراتب.`)) return;
    } else {
      if (!confirm(`هل تريد حذف هذا القيد؟\n${entry.type === 'bonus' ? 'مكافأة' : 'خصم'}: ${fmt(entry.amount)} د.ع\nالسبب: ${entry.reason}`)) return;
    }
    const r = await api(`payroll-entries/${entry.id}`, { method: 'DELETE' });
    if (r?.error) { toast.error(r.error); return; }
    toast.success('🗑️ تم الحذف');
    reload();
  };

  return (
    <div className="space-y-4">
      <Card className="glass-strong border-gold-soft">
        <CardContent className="pt-6 grid md:grid-cols-3 gap-3">
          <div><Label className="text-xs">الموظف</Label>
            <Select value={selectedEmp} onValueChange={setSelectedEmp}>
              <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
              <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.photo} {e.name} ({e.employeeId})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">الشهر</Label><Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="bg-input/30 border-gold/20" /></div>
          <div className="flex items-end"><Button onClick={() => { setForm({ employeeId: selectedEmp, type: 'bonus', amount: 50000, reason: '' }); setOpen(true); }} className="btn-gold w-full"><Plus className="w-4 h-4 ml-1" /> إضافة خصم/مكافأة</Button></div>
        </CardContent>
      </Card>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="stat-card"><p className="text-xs text-muted-foreground">الراتب الأساسي</p><p className="text-lg font-bold gold-text">{fmt(data.baseSalary)}</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">المكافآت</p><p className="text-lg font-bold text-emerald-400">+{fmt(data.bonuses)}</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">الخصومات</p><p className="text-lg font-bold text-red-400">-{fmt(data.deductions)}</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">أيام الحضور</p><p className="text-lg font-bold neon-text">{data.presentDays + data.lateDays}/{data.totalDays}</p></div>
            <div className="stat-card border-2 border-gold"><p className="text-xs text-muted-foreground">الراتب النهائي</p><p className="text-xl font-black gold-text">{fmt(data.finalSalary)}</p></div>
          </div>

          <Card className="glass-strong border-gold-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">الخصومات والمكافآت</CardTitle>
              <span className="text-[10px] text-muted-foreground">يمكن تعديل أو حذف أي قيد (يدوي أو تلقائي)</span>
            </CardHeader>
            <CardContent>
              {data.entries.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">لا توجد قيود لهذا الشهر</p> :
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gold-soft text-right text-xs text-muted-foreground"><th className="p-2">التاريخ</th><th>النوع</th><th>المبلغ</th><th>السبب</th><th>المصدر</th><th className="text-center">إجراءات</th></tr></thead>
                <tbody>
                  {data.entries.map(e => (
                    <tr key={e.id} className="border-b border-gold-soft/30 hover:bg-gold/5">
                      <td className="p-2 text-xs">{e.date}</td>
                      <td><Badge className={e.type === 'bonus' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]' : 'bg-red-500/20 text-red-400 border-red-500/30 text-[10px]'}>{e.type === 'bonus' ? '🎁 مكافأة' : '💸 خصم'}</Badge></td>
                      <td className={e.type === 'bonus' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{e.type === 'bonus' ? '+' : '-'}{fmt(e.amount)}</td>
                      <td className="text-xs">{e.reason}</td>
                      <td>{e.auto ? <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px]">🤖 تلقائي</Badge> : <Badge variant="outline" className="text-[10px]">يدوي</Badge>}</td>
                      <td>
                        <div className="flex gap-1 justify-center">
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-amber-500/20 hover:text-amber-400" title="تعديل" onClick={() => editEntry(e)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-red-500/20 hover:text-red-400" title="حذف" onClick={() => deleteEntry(e)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingEntry(null); }}>
        <DialogContent className="glass-strong border-gold/40">
          <DialogHeader><DialogTitle className="gold-text">{editingEntry ? '✏️ تعديل قيد راتب' : '➕ إضافة قيد راتب'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الموظف</Label>
              <Select value={form.employeeId} onValueChange={v => setForm({ ...form, employeeId: v })}>
                <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.photo} {e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>النوع</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonus">🎁 مكافأة / زيادة</SelectItem>
                  <SelectItem value="deduction">💸 خصم</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>المبلغ</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div><Label>السبب</Label><Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="bg-input/30 border-gold/20 h-20" placeholder="سبب الخصم أو المكافأة..." /></div>
          </div>
          <DialogFooter><Button onClick={addEntry} className="btn-gold w-full">{editingEntry ? '💾 حفظ التعديل' : '➕ حفظ'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HRReports() {
  const [data, setData] = useState(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  useEffect(() => { api(`hr/reports?month=${month}`).then(setData); }, [month]);
  if (!data) return <LoadingScreen />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-48 bg-input/30 border-gold/20" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي الموظفين</p><p className="text-2xl font-bold gold-text">{data.totalEmployees}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي الرواتب</p><p className="text-xl font-bold neon-text">{fmtCurrency(data.totalSalaries)}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي المكافآت</p><p className="text-xl font-bold text-emerald-400">{fmtCurrency(data.totalBonuses)}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي الخصومات</p><p className="text-xl font-bold text-red-400">{fmtCurrency(data.totalDeductions)}</p></div>
      </div>
      <Card className="glass-strong border-gold-soft">
        <CardHeader><CardTitle className="text-base">📊 أداء الموظفين</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gold-soft text-right text-xs text-muted-foreground"><th className="p-2">الموظف</th><th>الحضور</th><th>التأخير</th><th>الساعات</th><th>المهام</th><th>KPI</th><th>المكافآت</th><th>الخصومات</th><th>الراتب النهائي</th></tr></thead>
              <tbody>
                {data.employeeStats.map(e => (
                  <tr key={e.id} className="border-b border-gold-soft/30">
                    <td className="p-2"><div className="flex items-center gap-2"><span>{e.photo}</span><span className="text-xs font-bold">{e.name}</span></div></td>
                    <td className="text-xs text-emerald-400 font-bold">{e.presentDays}</td>
                    <td className="text-xs text-amber-400 font-bold">{e.lateDays}</td>
                    <td className="text-xs">{e.totalHours.toFixed(1)}</td>
                    <td className="text-xs">{e.tasksCompleted}/{e.tasksTotal}</td>
                    <td><Badge className={e.kpi >= 80 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]' : 'bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]'}>{e.kpi}%</Badge></td>
                    <td className="text-xs text-emerald-400">+{fmt(e.bonuses)}</td>
                    <td className="text-xs text-red-400">-{fmt(e.deductions)}</td>
                    <td className="font-bold gold-text">{fmt(e.finalSalary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



// ============ REPORTS ============
function Reports() {
  const [tab, setTab] = useState('overview');
  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <h1 className="text-2xl font-bold gold-text">التقارير والتحليلات</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-input/30 border border-gold-soft">
          <TabsTrigger value="overview">📊 نظرة عامة</TabsTrigger>
          <TabsTrigger value="separated">💹 التقارير المنفصلة (مبيعات/صيانة/اشتراكات/ديون/وكلاء)</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <ReportsOverview />
        </TabsContent>
        <TabsContent value="separated" className="mt-4">
          <SeparatedReports api={api} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportsOverview() {
  const [data, setData] = useState(null);
  useEffect(() => { api('reports/summary').then(setData); }, []);
  if (!data) return <LoadingScreen />;

  const COLORS = ['#FFD700', '#00D4FF', '#B061FF', '#39FF14', '#FF10F0'];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي الإيرادات</p><p className="text-xl font-bold gold-text">{fmtCurrency(data.totalRevenue)}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">مبيعات POS</p><p className="text-xl font-bold neon-text">{fmtCurrency(data.totalSales)}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">اشتراكات ISP</p><p className="text-xl font-bold text-emerald-400">{fmtCurrency(data.ispRevenue)}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">صيانة</p><p className="text-xl font-bold text-purple-400">{fmtCurrency(data.repairRevenue)}</p></div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="glass-strong border-gold-soft">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><PieIcon className="w-4 h-4 text-gold" /> مصادر الإيرادات</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => `${e.name}: ${fmt(e.value)}`}>
                  {data.pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0a0a0f', border: '1px solid rgba(255,215,0,0.3)' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-strong border-gold-soft">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart className="w-4 h-4 text-gold" /> توزيع المخزون</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <RBarChart data={data.categoryBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,215,0,0.1)" />
                <XAxis dataKey="name" stroke="#888" fontSize={11} />
                <YAxis stroke="#888" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0a0a0f', border: '1px solid rgba(255,215,0,0.3)' }} />
                <Bar dataKey="value" fill="#00D4FF" radius={[8, 8, 0, 0]} />
              </RBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-strong border-gold-soft">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Box className="w-4 h-4 text-gold" /> قيمة المخزون الإجمالية</CardTitle></CardHeader>
        <CardContent>
          <p className="text-4xl font-black gold-text">{fmtCurrency(data.inventoryValue)}</p>
          <p className="text-sm text-muted-foreground mt-1">القيمة الكلية للمنتجات في المستودع بسعر التكلفة</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ AI ASSISTANT ============
function AIAssistant() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'أهلاً! أنا "غزلان AI" - مساعدك الذكي. اسألني أي شيء عن شركتك:\n• تحليل المبيعات والأرباح\n• حالة الشبكة والمشتركين\n• توقعات الأعطال والمخزون\n• اقتراحات للقرارات الاستراتيجية' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages); setInput(''); setLoading(true);
    try {
      const r = await api('ai/chat', { method: 'POST', body: JSON.stringify({ message: input, history: newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })) }) });
      if (r.error) { toast.error(r.error); setMessages([...newMessages, { role: 'assistant', content: '⚠️ ' + r.error }]); }
      else setMessages([...newMessages, { role: 'assistant', content: r.reply }]);
    } catch (e) {
      toast.error('خطأ في الاتصال');
    }
    setLoading(false);
  };

  const suggestions = [
    'كم عدد المشتركين النشطين؟',
    'ما المنتجات التي بحاجة لإعادة طلب؟',
    'حلل أداء الشبكة وقدم اقتراحات',
    'ما إجمالي الديون المستحقة؟',
  ];

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-130px)] flex flex-col">
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-3 glass-strong rounded-2xl px-6 py-3 mb-2">
          <Sparkles className="w-6 h-6 text-gold animate-pulse" />
          <h1 className="text-2xl font-black gold-text">غزلان AI</h1>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Online</Badge>
        </div>
        <p className="text-sm text-muted-foreground">مساعد ذكي يعرف بيانات شركتك ويقدم تحليلات فورية</p>
      </div>

      <Card className="glass-strong border-gold-soft flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-neon-gradient' : 'bg-gold-gradient'}`}>
                  {m.role === 'user' ? <span className="text-sm font-bold">أنت</span> : <Bot className="w-5 h-5 text-background" />}
                </div>
                <div className={`max-w-[80%] rounded-2xl p-3 ${m.role === 'user' ? 'bg-cyan-500/10 border border-cyan-500/30' : 'glass-card border border-gold-soft'}`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-gold-gradient flex items-center justify-center"><Bot className="w-5 h-5 text-background" /></div>
                <div className="glass-card border border-gold-soft rounded-2xl p-3 flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-gold animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-gold animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                  <span className="w-2 h-2 rounded-full bg-gold animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => setInput(s)} className="text-xs glass-card border border-gold-soft rounded-full px-3 py-1.5 hover:border-gold/50 transition-colors">{s}</button>
            ))}
          </div>
        )}

        <div className="border-t border-gold-soft p-3 flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="اسأل غزلان AI..." className="bg-input/30 border-gold/20" disabled={loading} />
          <Button onClick={send} className="btn-gold" disabled={loading}><Send className="w-4 h-4" /></Button>
        </div>
      </Card>
    </div>
  );
}

// ============ SETTINGS ============
// ============ SETTINGS PAGE - FULL FUNCTIONAL ============
const SETTINGS_SECTIONS = [
  { key: 'general', label: 'النظام العام', icon: Building2, color: 'from-amber-500 to-yellow-600' },
  { key: 'users', label: 'المستخدمون والصلاحيات', icon: Users, color: 'from-emerald-500 to-teal-600' },
  { key: 'agents', label: 'إعدادات الوكلاء', icon: UserCheck, color: 'from-cyan-500 to-blue-600' },
  { key: 'subscribers', label: 'إعدادات المشتركين', icon: Wifi, color: 'from-purple-500 to-pink-600' },
  { key: 'zones', label: 'الزونات والشبكات', icon: Network, color: 'from-orange-500 to-red-600' },
  { key: 'invoices', label: 'الفواتير والديون', icon: Receipt, color: 'from-indigo-500 to-purple-600' },
  { key: 'packages', label: 'التفعيل والباقات', icon: Zap, color: 'from-pink-500 to-rose-600' },
  { key: 'whatsapp', label: 'إعدادات الواتساب', icon: Phone, color: 'from-green-500 to-emerald-600' },
  { key: 'telegram', label: 'إعدادات التليجرام', icon: Send, color: 'from-sky-500 to-blue-600' },
  { key: 'notifications', label: 'الإشعارات والتنبيهات', icon: Bell, color: 'from-rose-500 to-red-600' },
  { key: 'maps', label: 'الخرائط والمواقع', icon: MapPin, color: 'from-teal-500 to-cyan-600' },
  { key: 'printing', label: 'الطباعة والوصولات', icon: Receipt, color: 'from-violet-500 to-purple-600' },
  { key: 'backup', label: 'النسخ الاحتياطي', icon: HardDrive, color: 'from-fuchsia-500 to-pink-600' },
  { key: 'security', label: 'الأمان وتسجيل الدخول', icon: Activity, color: 'from-red-500 to-orange-600' },
  { key: 'reports', label: 'التقارير والإحصائيات', icon: BarChart3, color: 'from-yellow-500 to-amber-600' },
  { key: 'employees', label: 'الموظفون والمهام', icon: Users, color: 'from-lime-500 to-green-600' },
  { key: 'custom-fields', label: 'الحقول المخصصة (Schema)', icon: Edit2, color: 'from-violet-500 to-fuchsia-600' },
];

function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [activeSection, setActiveSection] = useState('general');
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const d = await api('settings');
    setSettings(d);
    setDraft(d);
  };
  useEffect(() => { load(); }, []);

  if (!settings) return <LoadingScreen />;

  const update = (section, field, value) => {
    setDraft(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };
  const updateNested = (section, subKey, field, value) => {
    setDraft(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [subKey]: { ...(prev[section]?.[subKey] || {}), [field]: value }
      }
    }));
  };

  const sectionChanged = JSON.stringify(draft[activeSection]) !== JSON.stringify(settings[activeSection]);

  const saveSection = async () => {
    setSaving(true);
    const r = await api('settings', { method: 'PUT', body: JSON.stringify({ [activeSection]: draft[activeSection] }) });
    setSaving(false);
    if (r.error) { toast.error(r.error); return; }
    toast.success('✅ تم حفظ الإعدادات');
    setSettings(r); setDraft(r);
  };

  const resetSection = async () => {
    if (!confirm('هل تريد إعادة ضبط هذا القسم للقيم الافتراضية؟')) return;
    const r = await api('settings/reset', { method: 'POST', body: JSON.stringify({ section: activeSection }) });
    if (r.error) { toast.error(r.error); return; }
    toast.success('✅ تم إعادة الضبط');
    await load();
  };

  const resetAll = async () => {
    if (!confirm('⚠️ هل أنت متأكد من إعادة ضبط جميع الإعدادات؟')) return;
    const r = await api('settings/reset', { method: 'POST', body: JSON.stringify({}) });
    if (r.error) { toast.error(r.error); return; }
    toast.success('✅ تم إعادة الضبط الكامل');
    await load();
  };

  const testWhatsApp = async () => {
    const r = await api('settings/test/whatsapp', { method: 'POST', body: JSON.stringify({ phone: draft.whatsapp?.managerPhone }) });
    if (r.error) toast.error(r.error); else toast.success(r.message);
  };
  const testTelegram = async () => {
    const r = await api('settings/test/telegram', { method: 'POST', body: JSON.stringify({}) });
    if (r.error) toast.error(r.error); else toast.success(r.message);
  };
  const runBackup = async () => {
    const r = await api('settings/backup/run', { method: 'POST', body: JSON.stringify({}) });
    if (r.error) toast.error(r.error); else { toast.success('✅ تم إنشاء النسخة الاحتياطية'); await load(); }
  };

  const section = SETTINGS_SECTIONS.find(s => s.key === activeSection);

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold gold-text flex items-center gap-2"><Settings className="w-6 h-6" /> الإعدادات</h1>
          <p className="text-xs text-muted-foreground mt-1">آخر تحديث: {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString('ar-IQ') : 'لم يحدث'}</p>
        </div>
        <Button onClick={resetAll} variant="outline" className="border-red-500/30 hover:bg-red-500/10 text-red-400">
          <Trash2 className="w-4 h-4 ml-1" /> إعادة ضبط الكل
        </Button>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar */}
        <Card className="glass-strong border-gold-soft h-fit">
          <CardContent className="p-2">
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="space-y-1">
                {SETTINGS_SECTIONS.map(s => {
                  const I = s.icon;
                  const isActive = activeSection === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setActiveSection(s.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-right transition-all text-sm ${
                        isActive ? 'bg-gold/15 text-gold border-r-2 border-gold' : 'text-muted-foreground hover:bg-gold/5 hover:text-foreground'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center flex-shrink-0 ${isActive ? '' : 'opacity-50'}`}>
                        <I className="w-4 h-4 text-white" />
                      </div>
                      <span className="flex-1 text-right truncate">{s.label}</span>
                      {isActive && <ChevronLeft className="w-4 h-4" />}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Panel */}
        <Card className="glass-strong border-gold-soft">
          <CardHeader className="border-b border-gold-soft">
            <CardTitle className="flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2 gold-text">
                {section && <section.icon className="w-5 h-5" />}
                {section?.label}
              </span>
              <div className="flex gap-2">
                <Button onClick={resetSection} variant="outline" size="sm" className="border-amber-500/30 hover:bg-amber-500/10 text-amber-400">
                  <X className="w-3 h-3 ml-1" /> إعادة ضبط
                </Button>
                <Button onClick={saveSection} disabled={!sectionChanged || saving} size="sm" className="btn-gold">
                  {saving ? 'جاري...' : <><CheckCircle2 className="w-3 h-3 ml-1" /> حفظ التغييرات</>}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ScrollArea className="h-[calc(100vh-300px)] pr-2">
              {activeSection === 'general' && <GeneralSection draft={draft} update={update} />}
              {activeSection === 'users' && <UsersSection draft={draft} update={update} />}
              {activeSection === 'agents' && <AgentsSection draft={draft} update={update} />}
              {activeSection === 'subscribers' && <SubscribersSection draft={draft} update={update} />}
              {activeSection === 'zones' && <ZonesSection draft={draft} update={update} />}
              {activeSection === 'invoices' && <InvoicesSection draft={draft} update={update} />}
              {activeSection === 'packages' && <PackagesSection draft={draft} update={update} />}
              {activeSection === 'whatsapp' && <WhatsAppSection draft={draft} update={update} testWhatsApp={testWhatsApp} />}
              {activeSection === 'telegram' && <TelegramSection draft={draft} update={update} testTelegram={testTelegram} />}
              {activeSection === 'notifications' && <NotificationsSection draft={draft} updateNested={updateNested} />}
              {activeSection === 'maps' && <MapsSection draft={draft} update={update} />}
              {activeSection === 'printing' && <PrintingSection draft={draft} update={update} />}
              {activeSection === 'backup' && <BackupSection draft={draft} update={update} runBackup={runBackup} />}
              {activeSection === 'security' && <SecuritySection draft={draft} update={update} />}
              {activeSection === 'reports' && <ReportsSection draft={draft} update={update} />}
              {activeSection === 'employees' && <EmployeesSection draft={draft} update={update} />}
              {activeSection === 'custom-fields' && <CustomFieldsSection />}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============ SECTION COMPONENTS ============
const Field = ({ label, hint, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
  </div>
);
const Switch = ({ checked, onChange, label }) => (
  <label className="flex items-center justify-between p-3 rounded-lg bg-gold/5 border border-gold-soft cursor-pointer hover:border-gold/30 transition-all">
    <span className="text-sm">{label}</span>
    <div className={`w-11 h-6 rounded-full transition-all relative ${checked ? 'bg-gold' : 'bg-muted'}`} onClick={() => onChange(!checked)}>
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${checked ? 'right-0.5' : 'right-[22px]'}`}></div>
    </div>
  </label>
);

function GeneralSection({ draft, update }) {
  const g = draft.general || {};
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field label="اسم الشركة (عربي)"><Input value={g.companyName || ''} onChange={e => update('general', 'companyName', e.target.value)} className="bg-input/30 border-gold/20" /></Field>
      <Field label="Company Name (EN)"><Input value={g.companyNameEn || ''} onChange={e => update('general', 'companyNameEn', e.target.value)} className="bg-input/30 border-gold/20" dir="ltr" /></Field>
      <Field label="الشعار (Emoji)"><Input value={g.logo || ''} onChange={e => update('general', 'logo', e.target.value)} className="bg-input/30 border-gold/20 text-xl" /></Field>
      <Field label="الهاتف"><Input value={g.phone || ''} onChange={e => update('general', 'phone', e.target.value)} className="bg-input/30 border-gold/20" /></Field>
      <Field label="البريد الإلكتروني"><Input value={g.email || ''} onChange={e => update('general', 'email', e.target.value)} className="bg-input/30 border-gold/20" dir="ltr" /></Field>
      <Field label="الموقع الإلكتروني"><Input value={g.website || ''} onChange={e => update('general', 'website', e.target.value)} className="bg-input/30 border-gold/20" dir="ltr" /></Field>
      <Field label="العنوان" hint="عنوان الفرع الرئيسي"><Input value={g.address || ''} onChange={e => update('general', 'address', e.target.value)} className="bg-input/30 border-gold/20" /></Field>
      <Field label="العملة">
        <Select value={g.currency} onValueChange={v => update('general', 'currency', v)}>
          <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="IQD">دينار عراقي (IQD)</SelectItem>
            <SelectItem value="USD">دولار (USD)</SelectItem>
            <SelectItem value="EUR">يورو (EUR)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="رمز العملة"><Input value={g.currencySymbol || ''} onChange={e => update('general', 'currencySymbol', e.target.value)} className="bg-input/30 border-gold/20" /></Field>
      <Field label="المنطقة الزمنية">
        <Select value={g.timezone} onValueChange={v => update('general', 'timezone', v)}>
          <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Asia/Baghdad">بغداد (GMT+3)</SelectItem>
            <SelectItem value="Asia/Dubai">دبي (GMT+4)</SelectItem>
            <SelectItem value="Asia/Riyadh">الرياض (GMT+3)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="اللغة الافتراضية">
        <Select value={g.language} onValueChange={v => update('general', 'language', v)}>
          <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ar">العربية</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="ku">کوردی</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="بداية السنة المالية" hint="MM-DD"><Input value={g.fiscalYearStart || ''} onChange={e => update('general', 'fiscalYearStart', e.target.value)} className="bg-input/30 border-gold/20 font-mono" /></Field>
      <div className="md:col-span-2">
        <Field label="الفروع (سطر لكل فرع)">
          <Textarea value={(g.branches || []).join('\n')} onChange={e => update('general', 'branches', e.target.value.split('\n').filter(Boolean))} className="bg-input/30 border-gold/20 h-24" />
        </Field>
      </div>
    </div>
  );
}

function AdminCredentialsCard() {
  const [current, setCurrent] = useState({ username: 'admin', hasPassword: false });
  const [form, setForm] = useState({ currentPassword: '', newUsername: '', newPassword: '', confirmPassword: '', email: '', phone: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => api('admin/credentials').then(d => {
    if (d && !d.error) {
      setCurrent(d);
      setForm(f => ({ ...f, newUsername: d.username || 'admin', email: d.email || '', phone: d.phone || '' }));
    }
  });
  useEffect(() => { load(); }, []);

  // Password strength evaluator
  const strength = (() => {
    const p = form.newPassword;
    if (!p) return { score: 0, label: '', color: '' };
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    const labels = ['ضعيفة جداً', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية', 'قوية جداً'];
    const colors = ['bg-red-500', 'bg-red-400', 'bg-amber-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-emerald-600'];
    return { score: s, label: labels[s], color: colors[s] };
  })();

  const save = async () => {
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      toast.error('كلمتا المرور غير متطابقتين');
      sounds.error();
      return;
    }
    if (form.newPassword && form.newPassword.length < 6) {
      toast.error('كلمة المرور يجب أن لا تقل عن 6 أحرف');
      sounds.error();
      return;
    }
    if (current.hasPassword && !form.currentPassword) {
      toast.error('أدخل كلمة المرور الحالية للتأكيد');
      sounds.error();
      return;
    }
    setSaving(true);
    const payload = {
      currentPassword: form.currentPassword,
      newUsername: form.newUsername !== current.username ? form.newUsername : undefined,
      newPassword: form.newPassword || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
    };
    const r = await api('admin/credentials', { method: 'PUT', body: JSON.stringify(payload) });
    setSaving(false);
    if (r?.error) { toast.error(r.error); sounds.error(); return; }
    toast.success('✅ تم تحديث بيانات المدير بنجاح');
    sounds.success();
    setForm({ ...form, currentPassword: '', newPassword: '', confirmPassword: '' });
    load();
  };

  return (
    <Card className="glass-card border-2 border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
          🔐 بيانات الدخول والمعلومات الشخصية للمدير
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">
          {current.hasPassword
            ? '✅ كلمة مرور مفعّلة - أدخل كلمة المرور الحالية لتأكيد أي تغيير'
            : '⚠️ لم يتم تعيين كلمة مرور بعد. الدخول الافتراضي: admin / admin'}
        </p>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-3">
        <Field label="اسم المستخدم (Username)">
          <Input value={form.newUsername} onChange={e => setForm({ ...form, newUsername: e.target.value })} className="bg-input/30 border-gold/20 font-mono" dir="ltr" placeholder="admin" />
        </Field>
        {current.hasPassword && (
          <Field label="كلمة المرور الحالية *">
            <div className="relative">
              <Input type={showCurrent ? 'text' : 'password'} value={form.currentPassword} onChange={e => setForm({ ...form, currentPassword: e.target.value })} className="bg-input/30 border-gold/20 font-mono pr-10" dir="ltr" placeholder="••••••••" />
              <button type="button" onClick={() => setShowCurrent(s => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold">
                {showCurrent ? '🙈' : '👁️'}
              </button>
            </div>
          </Field>
        )}
        <Field label="📧 البريد الإلكتروني">
          <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-input/30 border-gold/20" dir="ltr" placeholder="admin@ghazlan.iq" />
        </Field>
        <Field label="📱 رقم الهاتف">
          <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-input/30 border-gold/20 font-mono" dir="ltr" placeholder="07901234567" />
        </Field>
        <div>
          <Field label="كلمة مرور جديدة" hint="6 أحرف على الأقل - استخدم أحرف كبيرة وصغيرة + أرقام + رموز">
            <div className="relative">
              <Input type={showNew ? 'text' : 'password'} value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} className="bg-input/30 border-gold/20 font-mono pr-10" dir="ltr" placeholder="جديدة (اختياري)" />
              <button type="button" onClick={() => setShowNew(s => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold">
                {showNew ? '🙈' : '👁️'}
              </button>
            </div>
          </Field>
          {form.newPassword && (
            <div className="mt-1 space-y-1">
              <div className="flex gap-0.5 h-1.5">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className={`flex-1 rounded transition-all ${i <= strength.score ? strength.color : 'bg-input/30'}`}></div>
                ))}
              </div>
              <p className={`text-[10px] font-bold ${strength.score >= 4 ? 'text-emerald-400' : strength.score >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                {strength.label}
              </p>
            </div>
          )}
        </div>
        <Field label="تأكيد كلمة المرور">
          <Input type={showNew ? 'text' : 'password'} value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} className="bg-input/30 border-gold/20 font-mono" dir="ltr" placeholder="إعادة الإدخال" />
        </Field>
        <div className="md:col-span-2 flex justify-end">
          <Button onClick={save} disabled={saving} className="btn-gold">
            {saving ? '... جاري الحفظ' : '💾 حفظ بيانات المدير'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UsersSection({ draft, update }) {
  const u = draft.users || {};
  return (
    <div className="space-y-3">
      <Switch checked={u.requireApproval} onChange={v => update('users', 'requireApproval', v)} label="🔒 يتطلب موافقة المدير لإضافة مستخدمين جدد" />
      <Switch checked={u.allowSelfRegistration} onChange={v => update('users', 'allowSelfRegistration', v)} label="📝 السماح بالتسجيل الذاتي للمستخدمين" />
      <Field label="الدور الافتراضي للمستخدم الجديد">
        <Select value={u.defaultRole} onValueChange={v => update('users', 'defaultRole', v)}>
          <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(u.roles || []).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <div>
        <Label className="text-xs mb-2 block">الأدوار والصلاحيات</Label>
        <div className="space-y-2">
          {(u.roles || []).map((r, i) => (
            <div key={r.id} className="p-3 rounded-lg bg-gold/5 border border-gold-soft">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">{r.name}</span>
                <Badge variant="outline" className="border-gold/30 font-mono text-[10px]">{r.id}</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {(r.permissions || []).map(p => <Badge key={p} className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px]">{p}</Badge>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentsSection({ draft, update }) {
  const a = draft.agents || {};
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="نسبة العمولة الافتراضية %" hint="للوكلاء الجدد"><Input type="number" value={a.defaultCommission || 0} onChange={e => update('agents', 'defaultCommission', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
        <Field label="الحد الأقصى للدين" hint="بالدينار العراقي"><Input type="number" value={a.maxDebt || 0} onChange={e => update('agents', 'maxDebt', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
        <Field label="رابط لوحة الوكيل"><Input value={a.portalUrl || ''} onChange={e => update('agents', 'portalUrl', e.target.value)} className="bg-input/30 border-gold/20 font-mono" dir="ltr" /></Field>
        <Field label="مدة الجلسة (دقيقة)"><Input type="number" value={a.sessionTimeout || 30} onChange={e => update('agents', 'sessionTimeout', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
      </div>

      {/* ============ NEW (Module B) — أنماط الأرباح الافتراضية ============ */}
      <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/30 space-y-3">
        <p className="font-bold text-cyan-400 text-sm flex items-center gap-2">💰 نمط الأرباح الافتراضي للوكيل الجديد</p>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="نمط الأرباح">
            <Select value={a.defaultProfitMode || 'percentage'} onValueChange={v => update('agents', 'defaultProfitMode', v)}>
              <SelectTrigger className="bg-input/30 border-cyan-500/30"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">📊 نسبة مئوية</SelectItem>
                <SelectItem value="fixed_per_activation">💵 مبلغ ثابت لكل تفعيل</SelectItem>
                <SelectItem value="fixed_per_package">📦 مبلغ مخصص لكل باقة</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="المبلغ الثابت الافتراضي (د.ع)" hint="عند اختيار مبلغ ثابت"><Input type="number" value={a.defaultFixedProfit || 5000} onChange={e => update('agents', 'defaultFixedProfit', Number(e.target.value))} className="bg-input/30 border-cyan-500/30" /></Field>
        </div>
      </div>

      {/* ============ NEW (Module B) — صلاحيات افتراضية ============ */}
      <div className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/30 space-y-2">
        <p className="font-bold text-violet-400 text-sm flex items-center gap-2">🔒 صلاحيات افتراضية للوكيل الجديد</p>
        <div className="grid md:grid-cols-2 gap-2">
          <Switch checked={a.defaultPermCanActivate !== false} onChange={v => update('agents', 'defaultPermCanActivate', v)} label="✅ تفعيل المشتركين (افتراضي)" />
          <Switch checked={!!a.defaultPermRequireApproval} onChange={v => update('agents', 'defaultPermRequireApproval', v)} label="⏳ يحتاج موافقة المدير على التفعيل" />
          <Switch checked={!!a.defaultPermCanViewAll} onChange={v => update('agents', 'defaultPermCanViewAll', v)} label="👁️ عرض جميع المشتركين" />
          <Switch checked={!!a.defaultPermCanEdit} onChange={v => update('agents', 'defaultPermCanEdit', v)} label="✏️ تعديل بيانات المشتركين" />
          <Switch checked={a.defaultPermCanViewProfits !== false} onChange={v => update('agents', 'defaultPermCanViewProfits', v)} label="💰 عرض الأرباح والرصيد" />
          <Switch checked={a.defaultPermCanSendWhatsapp !== false} onChange={v => update('agents', 'defaultPermCanSendWhatsapp', v)} label="📱 إرسال رسائل واتساب" />
        </div>
      </div>

      <div className="space-y-2">
        <Switch checked={a.allowSelfActivation} onChange={v => update('agents', 'allowSelfActivation', v)} label="✅ السماح للوكلاء بتفعيل المشتركين بأنفسهم" />
        <Switch checked={a.autoDisableOnDebt} onChange={v => update('agents', 'autoDisableOnDebt', v)} label="🚫 إيقاف الوكيل تلقائياً عند تجاوز حد الدين" />
        <Switch checked={a.requireQRLogin} onChange={v => update('agents', 'requireQRLogin', v)} label="📱 تفعيل تسجيل دخول QR للوكلاء" />
      </div>
    </div>
  );
}

function SubscribersSection({ draft, update }) {
  const s = draft.subscribers || {};
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field label="الباقة الافتراضية"><Input value={s.defaultPackage || ''} onChange={e => update('subscribers', 'defaultPackage', e.target.value)} className="bg-input/30 border-gold/20" /></Field>
      <Field label="الرسوم الافتراضية"><Input type="number" value={s.defaultFee || 0} onChange={e => update('subscribers', 'defaultFee', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
      <Field label="فترة السماح بعد انتهاء الاشتراك (يوم)" hint="قبل إيقاف المشترك"><Input type="number" value={s.gracePeriodDays || 0} onChange={e => update('subscribers', 'gracePeriodDays', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
      <Field label="حد الدين المسموح"><Input type="number" value={s.debtLimit || 0} onChange={e => update('subscribers', 'debtLimit', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
      <Field label="إشعار قبل انتهاء الاشتراك (يوم)"><Input type="number" value={s.autoNotifyBeforeExpiry || 0} onChange={e => update('subscribers', 'autoNotifyBeforeExpiry', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
      <Field label="نمط اليوزر التلقائي" hint="استخدم {phone4} للأرقام الأخيرة"><Input value={s.usernamePattern || ''} onChange={e => update('subscribers', 'usernamePattern', e.target.value)} className="bg-input/30 border-gold/20 font-mono" dir="ltr" /></Field>
      <div className="md:col-span-2 space-y-2">
        <Switch checked={s.autoSuspendOnExpiry} onChange={v => update('subscribers', 'autoSuspendOnExpiry', v)} label="🚫 إيقاف تلقائي للمشتركين عند انتهاء الاشتراك" />
        <Switch checked={s.requireIMEI} onChange={v => update('subscribers', 'requireIMEI', v)} label="📱 تطلب IMEI عند إضافة مشترك جديد" />
        <Switch checked={s.autoGenerateUsername} onChange={v => update('subscribers', 'autoGenerateUsername', v)} label="🤖 توليد اليوزر تلقائياً" />
      </div>
    </div>
  );
}

function ZonesSection({ draft, update }) {
  const z = draft.zones || {};
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field label="السعة الافتراضية للفاتة"><Input type="number" value={z.defaultCapacity || 0} onChange={e => update('zones', 'defaultCapacity', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
      <Field label="فترة المراقبة (ثانية)"><Input type="number" value={z.monitoringInterval || 0} onChange={e => update('zones', 'monitoringInterval', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
      <Field label="حد التحذير (%)"><Input type="number" value={z.warningThreshold || 0} onChange={e => update('zones', 'warningThreshold', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
      <Field label="الحد الحرج (%)"><Input type="number" value={z.criticalThreshold || 0} onChange={e => update('zones', 'criticalThreshold', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
      <Field label="مزود الخرائط الافتراضي">
        <Select value={z.defaultMapProvider} onValueChange={v => update('zones', 'defaultMapProvider', v)}>
          <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="osm">OpenStreetMap (مجاني)</SelectItem>
            <SelectItem value="google">Google Maps</SelectItem>
            <SelectItem value="satellite">Satellite View</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="md:col-span-2">
        <Switch checked={z.autoStatusUpdate} onChange={v => update('zones', 'autoStatusUpdate', v)} label="🔄 تحديث حالة الزون تلقائياً حسب الضغط" />
      </div>
    </div>
  );
}

function InvoicesSection({ draft, update }) {
  const i = draft.invoices || {};
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field label="بادئة رقم الفاتورة"><Input value={i.invoicePrefix || ''} onChange={e => update('invoices', 'invoicePrefix', e.target.value)} className="bg-input/30 border-gold/20 font-mono" /></Field>
      <Field label="رقم البداية"><Input type="number" value={i.startingNumber || 0} onChange={e => update('invoices', 'startingNumber', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
      <Field label="نسبة الضريبة %"><Input type="number" step="0.1" value={i.taxRate || 0} onChange={e => update('invoices', 'taxRate', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
      <Field label="تنبيه الدين بعد (يوم)"><Input type="number" value={i.debtAlertDays || 0} onChange={e => update('invoices', 'debtAlertDays', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
      <div className="md:col-span-2">
        <Field label="ملاحظة أسفل الفاتورة">
          <Textarea value={i.footerNote || ''} onChange={e => update('invoices', 'footerNote', e.target.value)} className="bg-input/30 border-gold/20 h-20" />
        </Field>
      </div>
      <div className="md:col-span-2 space-y-2">
        <Switch checked={i.taxEnabled} onChange={v => update('invoices', 'taxEnabled', v)} label="💰 تفعيل احتساب الضريبة" />
        <Switch checked={i.autoReminder} onChange={v => update('invoices', 'autoReminder', v)} label="🔔 إرسال تذكير تلقائي بالديون" />
      </div>
    </div>
  );
}

function PackagesSection({ draft, update }) {
  const p = draft.packages || {};
  const methods = p.enabledPaymentMethods || [];
  const toggle = (m) => {
    const newMethods = methods.includes(m) ? methods.filter(x => x !== m) : [...methods, m];
    update('packages', 'enabledPaymentMethods', newMethods);
  };
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field label="المدة الافتراضية (يوم)"><Input type="number" value={p.defaultDurationDays || 0} onChange={e => update('packages', 'defaultDurationDays', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
      <Field label="نسبة عمولة الوكلاء الافتراضية %"><Input type="number" value={p.defaultProfitShare || 0} onChange={e => update('packages', 'defaultProfitShare', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
      <div className="md:col-span-2">
        <Label className="text-xs mb-2 block">طرق الدفع المُفعّلة</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { id: 'cash', label: '💵 كاش' },
            { id: 'master', label: '💳 ماستر' },
            { id: 'fastpay', label: '⚡ فاست باي' },
            { id: 'transfer', label: '🏦 تحويل' },
            { id: 'zaincash', label: '📱 زين كاش' },
            { id: 'asiacell', label: '📱 آسياسيل' },
          ].map(m => (
            <button key={m.id} onClick={() => toggle(m.id)} className={`p-3 rounded-lg border text-sm transition-all ${methods.includes(m.id) ? 'bg-gold/10 border-gold text-gold' : 'bg-input/30 border-gold-soft text-muted-foreground'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="md:col-span-2 space-y-2">
        <Switch checked={p.allowCustomDuration} onChange={v => update('packages', 'allowCustomDuration', v)} label="📅 السماح بمدة مخصصة عند التفعيل" />
        <Switch checked={p.proRateOnUpgrade} onChange={v => update('packages', 'proRateOnUpgrade', v)} label="💱 حساب النسبة المتبقية عند ترقية الباقة" />
        <Switch checked={p.requireFullPayment} onChange={v => update('packages', 'requireFullPayment', v)} label="💯 يتطلب الدفع الكامل قبل التفعيل" />
      </div>
    </div>
  );
}

function WhatsAppSection({ draft, update, testWhatsApp }) {
  const w = draft.whatsapp || {};
  return (
    <div className="space-y-4">
      <Switch checked={w.enabled} onChange={v => update('whatsapp', 'enabled', v)} label="🟢 تفعيل خدمة الواتساب" />
      {!w.enabled && <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400">⚠️ الخدمة غير مفعّلة - الرسائل ستحفظ في الطابور فقط</div>}
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="المزود">
          <Select value={w.provider} onValueChange={v => update('whatsapp', 'provider', v)}>
            <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cloud">WhatsApp Cloud API (Meta)</SelectItem>
              <SelectItem value="ultramsg">UltraMsg</SelectItem>
              <SelectItem value="wati">Wati</SelectItem>
              <SelectItem value="dialog360">360dialog</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="اسم المُرسِل"><Input value={w.senderName || ''} onChange={e => update('whatsapp', 'senderName', e.target.value)} className="bg-input/30 border-gold/20" /></Field>
        <div className="md:col-span-2">
          <Field label="API Token" hint="مفتاح الـ API من المزود"><Input type="password" value={w.apiToken || ''} onChange={e => update('whatsapp', 'apiToken', e.target.value)} className="bg-input/30 border-gold/20 font-mono" dir="ltr" /></Field>
        </div>
        <Field label="Phone Number ID"><Input value={w.phoneNumberId || ''} onChange={e => update('whatsapp', 'phoneNumberId', e.target.value)} className="bg-input/30 border-gold/20 font-mono" dir="ltr" /></Field>
        <Field label="هاتف المدير"><Input value={w.managerPhone || ''} onChange={e => update('whatsapp', 'managerPhone', e.target.value)} className="bg-input/30 border-gold/20 font-mono" /></Field>
      </div>
      <Switch checked={w.sendToManager} onChange={v => update('whatsapp', 'sendToManager', v)} label="📨 إرسال نسخة للمدير في كل عملية" />
      <Button onClick={testWhatsApp} className="btn-neon w-full"><Send className="w-4 h-4 ml-2" /> اختبار إرسال رسالة</Button>

      <WhatsAppTemplatesEditor draft={draft} update={update} />
    </div>
  );
}

function WhatsAppTemplatesEditor({ draft, update }) {
  const templates = draft.whatsapp?.templates || defaultWhatsAppTemplates;
  const [activeTab, setActiveTab] = useState('activation');
  const [preview, setPreview] = useState(null);

  const tabs = [
    { k: 'activation', label: '✅ تفعيل', desc: 'يُرسَل بعد تفعيل اشتراك جديد' },
    { k: 'expiry', label: '⏰ انتهاء', desc: 'تذكير بانتهاء الاشتراك' },
    { k: 'debt', label: '💰 دين', desc: 'تذكير بمستحقات مالية' },
    { k: 'welcome', label: '👋 ترحيب', desc: 'ترحيب بمشترك جديد' },
  ];

  const placeholders = {
    activation: ['{name}', '{package}', '{speed}', '{amount}', '{paymentMethod}', '{startDate}', '{endDate}', '{username}'],
    expiry: ['{name}', '{endDate}', '{daysLeft}', '{package}'],
    debt: ['{name}', '{amount}', '{phone}'],
    welcome: ['{name}', '{phone}', '{username}'],
  };

  const updateTemplate = (k, v) => {
    update('whatsapp', 'templates', { ...templates, [k]: v });
  };

  const resetTemplate = (k) => {
    if (!confirm('استعادة النص الافتراضي لهذا القالب؟')) return;
    updateTemplate(k, defaultWhatsAppTemplates[k]);
    toast.success('✅ تم استعادة النص الافتراضي');
  };

  const showPreview = (k) => {
    const sample = {
      name: 'أحمد محمد',
      package: 'باقة 50 ميجا',
      speed: '50 Mbps',
      amount: '35,000',
      paymentMethod: 'كاش',
      startDate: new Date().toLocaleDateString('ar-IQ'),
      endDate: new Date(Date.now() + 30 * 86400000).toLocaleDateString('ar-IQ'),
      username: 'user_1234',
      phone: '07901234567',
      daysLeft: '3',
    };
    setPreview({ k, text: fillTemplate(templates[k] || '', sample) });
  };

  return (
    <Card className="glass-card border-2 border-emerald-500/30 bg-emerald-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-emerald-400">
          💬 قوالب رسائل الواتساب
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">
          خصّص نص الرسائل المُرسَلة تلقائياً للمشتركين - استخدم المتغيرات بين أقواس مثل {`{name}`}
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1 mb-3">
          {tabs.map(t => (
            <button
              key={t.k}
              onClick={() => setActiveTab(t.k)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${activeTab === t.k ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-input/30 border-gold-soft text-muted-foreground hover:border-emerald-500/50'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tabs.filter(t => t.k === activeTab).map(t => (
          <div key={t.k} className="space-y-3">
            <p className="text-[10px] text-muted-foreground">{t.desc}</p>

            <div>
              <Label className="text-xs">📝 نص القالب</Label>
              <Textarea
                value={templates[t.k] || ''}
                onChange={e => updateTemplate(t.k, e.target.value)}
                className="bg-input/30 border-gold/20 h-44 text-xs font-mono leading-relaxed"
                dir="rtl"
                placeholder="أدخل نص الرسالة..."
              />
            </div>

            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <p className="text-[10px] text-cyan-400 mb-1 font-bold">📌 المتغيرات المتاحة (انقر للنسخ):</p>
              <div className="flex flex-wrap gap-1">
                {(placeholders[t.k] || []).map(p => (
                  <button
                    key={p}
                    onClick={() => { navigator.clipboard?.writeText(p); toast.success(`نُسخ: ${p}`); }}
                    className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 text-[10px] font-mono"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => showPreview(t.k)} className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                👁️ معاينة بأرقام تجريبية
              </Button>
              <Button size="sm" variant="outline" onClick={() => resetTemplate(t.k)} className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                ↩️ استعادة النص الافتراضي
              </Button>
            </div>
          </div>
        ))}

        <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
          <DialogContent className="glass-strong border-emerald-500/40">
            <DialogHeader><DialogTitle className="text-emerald-400">👁️ معاينة القالب</DialogTitle></DialogHeader>
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">{preview?.text}</pre>
            </div>
            <DialogFooter>
              <Button onClick={() => { navigator.clipboard?.writeText(preview?.text || ''); toast.success('تم النسخ'); }} className="btn-gold w-full">📋 نسخ المعاينة</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function TelegramSection({ draft, update, testTelegram }) {
  const t = draft.telegram || {};
  return (
    <div className="space-y-4">
      <Switch checked={t.enabled} onChange={v => update('telegram', 'enabled', v)} label="🟢 تفعيل تليجرام Bot" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Field label="Bot Token" hint="من @BotFather"><Input type="password" value={t.botToken || ''} onChange={e => update('telegram', 'botToken', e.target.value)} className="bg-input/30 border-gold/20 font-mono" dir="ltr" /></Field>
        </div>
        <Field label="Chat ID المدير"><Input value={t.managerChatId || ''} onChange={e => update('telegram', 'managerChatId', e.target.value)} className="bg-input/30 border-gold/20 font-mono" dir="ltr" /></Field>
        <Field label="Channel ID (اختياري)"><Input value={t.channelId || ''} onChange={e => update('telegram', 'channelId', e.target.value)} className="bg-input/30 border-gold/20 font-mono" dir="ltr" /></Field>
        <Field label="وقت التقرير اليومي"><Input type="time" value={t.reportTime || '20:00'} onChange={e => update('telegram', 'reportTime', e.target.value)} className="bg-input/30 border-gold/20" /></Field>
      </div>
      <div className="space-y-2">
        <Switch checked={t.sendActivations} onChange={v => update('telegram', 'sendActivations', v)} label="🎉 إرسال إشعار عند كل تفعيل" />
        <Switch checked={t.sendAlerts} onChange={v => update('telegram', 'sendAlerts', v)} label="🚨 إرسال تنبيهات النظام (شبكة، أعطال)" />
        <Switch checked={t.sendDailyReport} onChange={v => update('telegram', 'sendDailyReport', v)} label="📊 إرسال تقرير يومي تلقائي" />
      </div>
      <Button onClick={testTelegram} className="btn-neon w-full"><Send className="w-4 h-4 ml-2" /> اختبار إرسال للمدير</Button>
    </div>
  );
}

function NotificationsSection({ draft, updateNested }) {
  const n = draft.notifications || {};
  const events = [
    { key: 'activation', label: '🎉 تفعيل اشتراك جديد', section: 'الاشتراكات' },
    { key: 'expiry', label: '⏰ انتهاء الاشتراك', section: 'الاشتراكات' },
    { key: 'debt', label: '💰 ديون مستحقة', section: 'الاشتراكات' },
    { key: 'lowStock', label: '📦 نفاد المخزون', section: 'المخزون' },
    { key: 'networkAlert', label: '🚨 تنبيهات الشبكة', section: 'الشبكة' },
    { key: 'newSubscriber', label: '👤 مشترك جديد', section: 'الاشتراكات' },
    // ============ NEW (Module A) ============
    { key: 'leave_request', label: '📅 طلب إجازة من موظف', section: 'الموظفون' },
    { key: 'advance_request', label: '💸 طلب سلفة من موظف', section: 'الموظفون' },
    { key: 'task_submitted', label: '📋 تقرير مهمة قيد المراجعة', section: 'المهام' },
    { key: 'task_completed', label: '✅ تم إنجاز مهمة', section: 'المهام' },
    { key: 'task_rejected', label: '❌ رُفض إنجاز مهمة', section: 'المهام' },
    { key: 'task_recurring', label: '🔁 مهمة متكررة جديدة', section: 'المهام' },
    // ============ NEW (Module B) ============
    { key: 'pending_activation', label: '⏳ طلب تفعيل بانتظار موافقة المدير', section: 'الوكلاء' },
    // ============ NEW (Module C — Balances) ============
    { key: 'balance_overdraft', label: '⚠️ رصيد في السالب', section: 'الأرصدة' },
    { key: 'balance_low', label: '🟡 رصيد تحت الحد الأدنى', section: 'الأرصدة' },
    { key: 'balance_deposit', label: '💰 تعبئة رصيد', section: 'الأرصدة' },
    // ============ NEW (Module E — Backups) ============
    { key: 'backup_done', label: '💾 اكتمال النسخة الاحتياطية', section: 'النظام' },
  ];
  const channels = [
    { key: 'whatsapp', label: '📱 واتساب' },
    { key: 'telegram', label: '✈️ تليجرام' },
    { key: 'email', label: '📧 إيميل' },
    { key: 'sms', label: '💬 SMS' },
    { key: 'push', label: '🔔 Push' },
  ];
  // Group events by section for clarity
  const grouped = events.reduce((acc, e) => { (acc[e.section] = acc[e.section] || []).push(e); return acc; }, {});
  return (
    <div className="space-y-4">
      <SoundSettingsCard />
      <p className="text-xs text-muted-foreground">حدد قنوات الإرسال لكل نوع إشعار. النقر على الخلية يبدّل التشغيل.</p>

      {Object.entries(grouped).map(([section, items]) => (
        <div key={section} className="border border-gold-soft rounded-lg overflow-hidden">
          <div className="bg-gold/5 px-3 py-2 border-b border-gold-soft">
            <h3 className="text-sm font-bold gold-text">{section}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-input/20">
                <tr className="border-b border-gold-soft">
                  <th className="p-2 text-right text-xs text-muted-foreground">الحدث</th>
                  {channels.map(c => <th key={c.key} className="p-2 text-center text-xs text-muted-foreground">{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.map(e => (
                  <tr key={e.key} className="border-b border-gold-soft/30 hover:bg-gold/5">
                    <td className="p-2 text-xs font-semibold">{e.label}</td>
                    {channels.map(c => {
                      const checked = !!n[e.key]?.[c.key];
                      return (
                        <td key={c.key} className="p-2 text-center">
                          <button onClick={() => updateNested('notifications', e.key, c.key, !checked)} className={`w-6 h-6 rounded transition-all ${checked ? 'bg-gold text-background' : 'bg-input/30 border border-gold-soft'}`}>
                            {checked && '✓'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function CustomFieldsSection() {
  const ENTITIES = [
    { k: 'subscribers', label: '👥 المشتركين', icon: '📡' },
    { k: 'networks', label: '🌐 الشبكات/الفاتات', icon: '🔌' },
    { k: 'zones', label: '🗺️ الزونات', icon: '📍' },
    { k: 'employees', label: '👤 الموظفين', icon: '🆔' },
    { k: 'products', label: '📦 المنتجات', icon: '🏷️' },
    { k: 'agents', label: '🤝 الوكلاء', icon: '👨‍💼' },
    { k: 'repairs', label: '🔧 الصيانة', icon: '🛠️' },
    { k: 'tasks', label: '📋 المهام', icon: '✅' },
  ];
  const FIELD_TYPES = [
    { v: 'text', label: '📝 نص' },
    { v: 'textarea', label: '📄 نص طويل' },
    { v: 'number', label: '🔢 رقم' },
    { v: 'currency', label: '💵 مبلغ' },
    { v: 'percent', label: '٪ نسبة' },
    { v: 'date', label: '📅 تاريخ' },
    { v: 'datetime', label: '🕒 تاريخ ووقت' },
    { v: 'boolean', label: '🔘 نعم/لا' },
    { v: 'select', label: '🎯 قائمة منسدلة' },
    { v: 'multiselect', label: '✅ اختيار متعدد' },
    { v: 'phone', label: '📞 هاتف' },
    { v: 'email', label: '📧 بريد' },
    { v: 'url', label: '🔗 رابط' },
  ];

  const [activeEntity, setActiveEntity] = useState('subscribers');
  const [fields, setFields] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    api(`custom-fields/${activeEntity}`).then(d => {
      if (d && Array.isArray(d.fields)) {
        setFields(d.fields);
        setDirty(false);
      }
    });
  }, [activeEntity]);

  const addField = () => {
    setFields(f => [...f, {
      key: `field_${Date.now().toString(36)}`,
      label: 'حقل جديد',
      type: 'text',
      required: false,
      placeholder: '',
      default: '',
      options: [],
      visible: true,
    }]);
    setDirty(true);
  };
  const updateField = (i, patch) => {
    setFields(f => f.map((x, idx) => idx === i ? { ...x, ...patch } : x));
    setDirty(true);
  };
  const removeField = (i) => {
    if (!confirm('حذف هذا الحقل؟')) return;
    setFields(f => f.filter((_, idx) => idx !== i));
    setDirty(true);
  };
  const moveField = (i, dir) => {
    setFields(f => {
      const arr = [...f];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const r = await api(`custom-fields/${activeEntity}`, {
      method: 'PUT',
      body: JSON.stringify({ fields }),
    });
    setSaving(false);
    if (r?.error) { toast.error(r.error); sounds.error(); return; }
    toast.success(`✅ تم حفظ ${fields.length} حقل لـ ${activeEntity}`);
    sounds.success();
    setDirty(false);
  };

  const reload = () => {
    api(`custom-fields/${activeEntity}`).then(d => {
      setFields(d?.fields || []);
      setDirty(false);
      toast.info('تم إعادة التحميل');
    });
  };

  return (
    <div className="space-y-4">
      <Card className="glass-card border-2 border-violet-500/30 bg-violet-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-violet-400">
            🛠️ محرر الحقول الديناميكي (Schema Editor)
          </CardTitle>
          <p className="text-[10px] text-muted-foreground">
            أضف/عدّل/احذف حقولاً مخصصة لأي قسم من النظام. الحقول الجديدة ستظهر تلقائياً في نماذج الإضافة والتعديل.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Entity selector */}
          <div>
            <Label className="text-xs mb-2 block">📂 اختر القسم</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {ENTITIES.map(e => (
                <button
                  key={e.k}
                  onClick={() => {
                    if (dirty && !confirm('لديك تعديلات غير محفوظة. هل تريد المتابعة؟')) return;
                    setActiveEntity(e.k);
                  }}
                  className={`p-3 rounded-lg border-2 transition-all text-center ${activeEntity === e.k ? 'border-violet-500 bg-violet-500/20' : 'border-gold-soft bg-input/30 hover:border-violet-500/50'}`}
                >
                  <div className="text-2xl mb-1">{e.icon}</div>
                  <div className="text-[10px] font-bold">{e.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-gold-soft">
            <p className="text-xs">
              <span className="text-muted-foreground">عدد الحقول:</span> <span className="font-bold gold-text">{fields.length}</span>
              {dirty && <Badge className="mr-2 bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">⚠️ تعديلات غير محفوظة</Badge>}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={addField} className="btn-gold h-8">
                <Plus className="w-3 h-3 ml-1" /> إضافة حقل
              </Button>
              <Button size="sm" variant="outline" onClick={reload} className="h-8 border-gold/30">↩️ تجاهل</Button>
              <Button size="sm" onClick={save} disabled={!dirty || saving} className="h-8 btn-neon">
                {saving ? '...' : '💾 حفظ'}
              </Button>
            </div>
          </div>

          {/* Fields list */}
          {fields.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Edit2 className="w-12 h-12 mx-auto opacity-30 mb-3" />
              <p className="text-sm">لا توجد حقول مخصصة بعد</p>
              <p className="text-[10px]">انقر "إضافة حقل" لإنشاء أول حقل</p>
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((f, i) => (
                <Card key={i} className="glass-card border-gold-soft">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                        <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[10px]">
                          {FIELD_TYPES.find(t => t.v === f.type)?.label || f.type}
                        </Badge>
                        {f.required && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">✱ مطلوب</Badge>}
                        {f.visible === false && <Badge className="bg-gray-500/20 text-gray-400 text-[10px]">🙈 مخفي</Badge>}
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveField(i, -1)} title="لأعلى" disabled={i === 0}>⬆️</Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveField(i, 1)} title="لأسفل" disabled={i === fields.length - 1}>⬇️</Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-red-500" onClick={() => removeField(i)} title="حذف"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <Label className="text-[10px]">المفتاح (Key)</Label>
                        <Input value={f.key} onChange={e => updateField(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} className="bg-input/30 border-gold/20 h-8 text-xs font-mono" dir="ltr" />
                      </div>
                      <div>
                        <Label className="text-[10px]">الاسم المعروض</Label>
                        <Input value={f.label} onChange={e => updateField(i, { label: e.target.value })} className="bg-input/30 border-gold/20 h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px]">النوع</Label>
                        <Select value={f.type} onValueChange={v => updateField(i, { type: v })}>
                          <SelectTrigger className="bg-input/30 border-gold/20 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t.v} value={t.v} className="text-xs">{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px]">القيمة الافتراضية</Label>
                        <Input value={f.default || ''} onChange={e => updateField(i, { default: e.target.value })} className="bg-input/30 border-gold/20 h-8 text-xs" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-[10px]">نص توضيحي (Placeholder)</Label>
                        <Input value={f.placeholder || ''} onChange={e => updateField(i, { placeholder: e.target.value })} className="bg-input/30 border-gold/20 h-8 text-xs" />
                      </div>
                      <div className="flex items-end gap-2">
                        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                          <input type="checkbox" checked={!!f.required} onChange={e => updateField(i, { required: e.target.checked })} className="accent-gold" />
                          مطلوب
                        </label>
                        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                          <input type="checkbox" checked={f.visible !== false} onChange={e => updateField(i, { visible: e.target.checked })} className="accent-gold" />
                          ظاهر
                        </label>
                      </div>
                      {['select', 'multiselect'].includes(f.type) && (
                        <div className="md:col-span-2">
                          <Label className="text-[10px]">خيارات (قيمة|عرض - سطر لكل خيار)</Label>
                          <Textarea
                            value={(f.options || []).map(o => typeof o === 'string' ? o : `${o.value}|${o.label}`).join('\n')}
                            onChange={e => updateField(i, {
                              options: e.target.value.split('\n').filter(Boolean).map(line => {
                                const [val, lbl] = line.split('|');
                                return { value: val.trim(), label: (lbl || val).trim() };
                              })
                            })}
                            className="bg-input/30 border-gold/20 h-20 text-xs font-mono"
                            placeholder={`active|نشط\nsuspended|موقوف`}
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card border-cyan-500/30 bg-cyan-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-cyan-400">💡 معلومات مهمة</CardTitle>
        </CardHeader>
        <CardContent className="text-[11px] space-y-1 text-muted-foreground">
          <p>• الحقول المضافة هنا ستظهر تلقائياً في نماذج الإضافة والتعديل لذلك القسم.</p>
          <p>• <strong>المفتاح (Key)</strong> لا يمكن تغييره بعد حفظ بيانات تستخدمه (سيكسر العرض).</p>
          <p>• الحقول من نوع <strong>قائمة منسدلة</strong> تتطلب تعريف الخيارات بصيغة <code className="bg-input/50 px-1 rounded font-mono">value|label</code>.</p>
          <p>• إخفاء الحقل (إلغاء "ظاهر") يحفظ القيم لكن لا يعرضها في النماذج.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function SoundSettingsCard() {
  const [s, setS] = useState({ enabled: true, volume: 0.5 });
  const [perm, setPerm] = useState('default');

  useEffect(() => {
    setS(getSoundSettings());
    if (typeof window !== 'undefined' && 'Notification' in window) setPerm(Notification.permission);
  }, []);

  const update = (patch) => {
    const next = setSoundSettings(patch);
    setS(next);
  };

  const testSound = (k) => {
    sounds[k] && sounds[k]();
  };

  const askPerm = async () => {
    const result = await requestNotificationPermission();
    setPerm(result);
    if (result === 'granted') {
      browserNotify('✅ تم تفعيل الإشعارات', { body: 'سيتم إشعارك بالأحداث المهمة حتى لو الصفحة في الخلفية' });
      toast.success('✅ تم تفعيل إشعارات النظام');
    } else {
      toast.error('❌ لم يتم منح الإذن');
    }
  };

  return (
    <Card className="glass-card border-2 border-cyan-500/30 bg-cyan-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-cyan-400">
          🔊 الأصوات والإشعارات الفورية
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">
          نظام صوتي ذكي يتفاعل مع الأحداث الحية - يعمل بدون أي ملفات صوتية خارجية
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-gold/5 border border-gold-soft">
          <span className="text-sm font-bold">🎵 تفعيل الأصوات</span>
          <button
            onClick={() => update({ enabled: !s.enabled })}
            className={`w-14 h-7 rounded-full transition-all relative ${s.enabled ? 'bg-emerald-500' : 'bg-muted'}`}
          >
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${s.enabled ? 'right-0.5' : 'right-[30px]'}`}></div>
          </button>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <Label className="text-xs">🔉 مستوى الصوت</Label>
            <span className="text-xs font-bold gold-text">{Math.round((s.volume || 0) * 100)}%</span>
          </div>
          <input
            type="range"
            min="0" max="1" step="0.05"
            value={s.volume || 0}
            onChange={e => update({ volume: Number(e.target.value) })}
            disabled={!s.enabled}
            className="w-full h-2 rounded-full appearance-none bg-input cursor-pointer accent-gold disabled:opacity-50"
          />
        </div>

        <div className="p-3 rounded-lg bg-input/30 border border-gold-soft">
          <p className="text-xs font-bold mb-2">🧪 اختبر الأصوات (انقر للتجربة)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { k: 'notification', l: '🔔 إشعار', c: 'amber' },
              { k: 'newTask', l: '📋 مهمة', c: 'cyan' },
              { k: 'late', l: '⏰ تأخير', c: 'red' },
              { k: 'checkin', l: '📍 حضور', c: 'emerald' },
              { k: 'checkout', l: '🚪 انصراف', c: 'purple' },
              { k: 'activation', l: '✅ تفعيل', c: 'emerald' },
              { k: 'debt', l: '💰 دين', c: 'rose' },
              { k: 'expiry', l: '🕒 انتهاء', c: 'orange' },
            ].map(b => (
              <Button key={b.k} size="sm" variant="outline" onClick={() => testSound(b.k)} className="h-9 text-[11px] border-gold-soft hover:border-gold">
                {b.l}
              </Button>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-bold">🌐 إشعارات المتصفح (Desktop Notifications)</p>
              <p className="text-[10px] text-muted-foreground">
                {perm === 'granted' && '✅ مفعّلة - ستتلقى إشعاراً حتى لو كانت الصفحة في الخلفية'}
                {perm === 'denied' && '❌ تم رفضها - يرجى تفعيلها من إعدادات المتصفح'}
                {perm === 'default' && '⚠️ غير مفعّلة - اضغط الزر لتفعيلها'}
              </p>
            </div>
            {perm !== 'granted' && (
              <Button size="sm" onClick={askPerm} className="btn-neon">
                {perm === 'denied' ? '🔧 من المتصفح' : '🔔 تفعيل'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MapsSection({ draft, update }) {
  const m = draft.maps || {};
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field label="مزود الخرائط">
        <Select value={m.provider} onValueChange={v => update('maps', 'provider', v)}>
          <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="osm">OpenStreetMap</SelectItem>
            <SelectItem value="google">Google Maps</SelectItem>
            <SelectItem value="mapbox">Mapbox</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="مستوى التكبير الافتراضي"><Input type="number" min="5" max="20" value={m.defaultZoom || 12} onChange={e => update('maps', 'defaultZoom', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
      <Field label="خط العرض الافتراضي"><Input type="number" step="0.0001" value={m.defaultLat || 0} onChange={e => update('maps', 'defaultLat', Number(e.target.value))} className="bg-input/30 border-gold/20 font-mono" /></Field>
      <Field label="خط الطول الافتراضي"><Input type="number" step="0.0001" value={m.defaultLng || 0} onChange={e => update('maps', 'defaultLng', Number(e.target.value))} className="bg-input/30 border-gold/20 font-mono" /></Field>
      <div className="md:col-span-2">
        <Field label="Google API Key" hint="اختياري - فقط لخرائط جوجل"><Input type="password" value={m.googleApiKey || ''} onChange={e => update('maps', 'googleApiKey', e.target.value)} className="bg-input/30 border-gold/20 font-mono" dir="ltr" /></Field>
      </div>
      <div className="md:col-span-2 space-y-2">
        <Switch checked={m.showZones} onChange={v => update('maps', 'showZones', v)} label="📍 عرض الزونات على الخريطة" />
        <Switch checked={m.showNetworks} onChange={v => update('maps', 'showNetworks', v)} label="🔌 عرض الفاتات/الشبكات" />
        <Switch checked={m.showSubscribers} onChange={v => update('maps', 'showSubscribers', v)} label="👥 عرض المشتركين (قد يكون بطيئاً)" />
        <Switch checked={m.clusterMarkers} onChange={v => update('maps', 'clusterMarkers', v)} label="🔵 تجميع العلامات (Cluster)" />
      </div>
    </div>
  );
}

function PrintingSection({ draft, update }) {
  const p = draft.printing || {};
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field label="حجم الورق">
        <Select value={p.paperSize} onValueChange={v => update('printing', 'paperSize', v)}>
          <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="58mm">حراري 58mm</SelectItem>
            <SelectItem value="80mm">حراري 80mm</SelectItem>
            <SelectItem value="A4">A4</SelectItem>
            <SelectItem value="A5">A5</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="عدد النسخ"><Input type="number" min="1" max="5" value={p.copies || 1} onChange={e => update('printing', 'copies', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
      <div className="md:col-span-2">
        <Field label="رأس الوصل"><Textarea value={p.receiptHeader || ''} onChange={e => update('printing', 'receiptHeader', e.target.value)} className="bg-input/30 border-gold/20 h-20" /></Field>
      </div>
      <div className="md:col-span-2">
        <Field label="تذييل الوصل"><Textarea value={p.receiptFooter || ''} onChange={e => update('printing', 'receiptFooter', e.target.value)} className="bg-input/30 border-gold/20 h-20" /></Field>
      </div>
      <div className="md:col-span-2 space-y-2">
        <Switch checked={p.showLogo} onChange={v => update('printing', 'showLogo', v)} label="🏢 إظهار الشعار" />
        <Switch checked={p.showBarcode} onChange={v => update('printing', 'showBarcode', v)} label="📊 إظهار الباركود" />
        <Switch checked={p.showQR} onChange={v => update('printing', 'showQR', v)} label="📱 إظهار QR Code" />
        <Switch checked={p.autoOpenCashDrawer} onChange={v => update('printing', 'autoOpenCashDrawer', v)} label="💵 فتح درج النقود تلقائياً" />
      </div>
    </div>
  );
}

function BackupSection({ draft, update, runBackup }) {
  const b = draft.backup || {};
  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadList = async () => {
    setLoadingList(true);
    const r = await api('settings/backup/list');
    setList(safeArr(r));
    setLoadingList(false);
  };
  useEffect(() => { loadList(); }, []);

  const triggerNow = async () => {
    setBusy(true);
    await runBackup();
    await loadList();
    setBusy(false);
  };

  const downloadBackup = (id, filename) => {
    const url = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/settings/backup/download/${id}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const deleteBackup = async (id) => {
    if (!confirm('حذف هذه النسخة الاحتياطية نهائياً؟')) return;
    const r = await api(`settings/backup/${id}`, { method: 'DELETE' });
    if (r?.success) { toast.success('🗑️ تم الحذف'); loadList(); }
    else toast.error('فشل الحذف');
  };

  const formatSize = (kb) => kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(2)} MB`;

  // Compute next scheduled backup time
  const computeNext = () => {
    if (!b.enabled) return 'معطّل';
    const last = b.lastBackup ? new Date(b.lastBackup) : null;
    const map = { hourly: 1, daily: 24, weekly: 168, monthly: 720 };
    const hrs = map[b.schedule || 'daily'] || 24;
    if (!last) return 'خلال 30 ثانية (التشغيل الأول)';
    const next = new Date(last.getTime() + hrs * 3600000);
    if (next < new Date()) return 'قريباً (خلال 5 دقائق)';
    return next.toLocaleString('ar-IQ');
  };

  return (
    <div className="space-y-4">
      <Switch checked={b.enabled} onChange={v => update('backup', 'enabled', v)} label="🟢 تفعيل النسخ الاحتياطي التلقائي" />

      {b.enabled && (
        <div className="grid md:grid-cols-3 gap-2 text-xs">
          <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/30">
            <p className="text-[10px] text-emerald-400/70 mb-1">آخر نسخة</p>
            <p className="font-bold text-emerald-400">{b.lastBackup ? new Date(b.lastBackup).toLocaleString('ar-IQ') : 'لم تُنفّذ بعد'}</p>
          </div>
          <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/30">
            <p className="text-[10px] text-cyan-400/70 mb-1">⏰ النسخة التالية المقررة</p>
            <p className="font-bold text-cyan-400">{computeNext()}</p>
          </div>
          <div className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/30">
            <p className="text-[10px] text-violet-400/70 mb-1">عدد النسخ المحفوظة</p>
            <p className="font-bold text-violet-400">{list.length} نسخة</p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="الجدولة">
          <Select value={b.schedule} onValueChange={v => update('backup', 'schedule', v)}>
            <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">⏱️ كل ساعة</SelectItem>
              <SelectItem value="daily">📅 يومي</SelectItem>
              <SelectItem value="weekly">📆 أسبوعي</SelectItem>
              <SelectItem value="monthly">🗓️ شهري</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="فترة الاحتفاظ (يوم)"><Input type="number" value={b.retentionDays || 30} onChange={e => update('backup', 'retentionDays', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
        <Field label="📦 صيغة الملف">
          <div className="px-3 py-2 rounded-md bg-input/30 border border-gold/20 text-xs flex items-center gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">XLSX (Excel)</Badge>
            <span className="text-muted-foreground">جدول لكل مجموعة بيانات</span>
          </div>
        </Field>
        <Field label="📂 مكان التخزين">
          <div className="px-3 py-2 rounded-md bg-input/30 border border-gold/20 text-xs flex items-center gap-2">
            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">محلي</Badge>
            <span className="text-muted-foreground font-mono dir-ltr">/app/backups/</span>
          </div>
        </Field>
      </div>

      <Button onClick={triggerNow} disabled={busy} className="btn-gold w-full">
        <HardDrive className="w-4 h-4 ml-2" />
        {busy ? 'جاري الإنشاء...' : '⚡ إنشاء نسخة احتياطية الآن (Excel)'}
      </Button>

      {/* ============ BACKUP HISTORY LIST ============ */}
      <div className="border border-gold-soft rounded-lg overflow-hidden">
        <div className="bg-gold/5 p-3 border-b border-gold-soft flex items-center justify-between">
          <h3 className="text-sm font-bold gold-text flex items-center gap-2">
            <FileText className="w-4 h-4" /> سجل النسخ الاحتياطية
          </h3>
          <Button size="sm" variant="ghost" onClick={loadList} disabled={loadingList} className="h-7 text-xs">
            🔄 {loadingList ? 'تحميل...' : 'تحديث'}
          </Button>
        </div>
        {list.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            <HardDrive className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>لا توجد نسخ احتياطية بعد</p>
            <p className="text-[10px] mt-1">انقر "إنشاء نسخة احتياطية الآن" أو فعّل الجدولة التلقائية</p>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-input/30 sticky top-0">
                <tr>
                  <th className="p-2 text-right">التاريخ</th>
                  <th className="p-2 text-right">الحجم</th>
                  <th className="p-2 text-right">عدد المستندات</th>
                  <th className="p-2 text-right">المصدر</th>
                  <th className="p-2 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {list.map(bk => (
                  <tr key={bk.id} className="border-b border-gold-soft/30 hover:bg-gold/5">
                    <td className="p-2 font-mono text-[11px]">{new Date(bk.createdAt).toLocaleString('ar-IQ')}</td>
                    <td className="p-2 text-cyan-400 font-bold">{formatSize(bk.sizeKB)}</td>
                    <td className="p-2 text-emerald-400 font-bold">{bk.totalDocs?.toLocaleString('en-US')} مستند</td>
                    <td className="p-2">
                      <Badge className={bk.triggeredBy === 'auto' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px]' : 'bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]'}>
                        {bk.triggeredBy === 'auto' ? '🤖 تلقائي' : '👤 يدوي'}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" onClick={() => downloadBackup(bk.id, bk.filename)} className="h-7 text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 px-2">
                          ⬇️ تنزيل
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteBackup(bk.id)} className="h-7 w-7 text-red-400 hover:text-red-500 hover:bg-red-500/10">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SecuritySection({ draft, update }) {
  const s = draft.security || {};
  return (
    <div className="space-y-4">
      <AdminCredentialsCard />

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="مدة الجلسة (دقيقة)"><Input type="number" value={s.sessionTimeoutMinutes || 60} onChange={e => update('security', 'sessionTimeoutMinutes', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
        <Field label="الحد الأدنى لطول كلمة المرور"><Input type="number" value={s.passwordMinLength || 6} onChange={e => update('security', 'passwordMinLength', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
        <Field label="حد محاولات الدخول الفاشلة"><Input type="number" value={s.maxLoginAttempts || 5} onChange={e => update('security', 'maxLoginAttempts', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
        <Field label="مدة القفل بعد الفشل (دقيقة)"><Input type="number" value={s.lockoutMinutes || 15} onChange={e => update('security', 'lockoutMinutes', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
        <div className="md:col-span-2">
          <Field label="قائمة IPs المسموحة (سطر لكل IP، فارغ = جميع IPs)">
            <Textarea value={(s.ipWhitelist || []).join('\n')} onChange={e => update('security', 'ipWhitelist', e.target.value.split('\n').filter(Boolean))} className="bg-input/30 border-gold/20 h-20 font-mono" dir="ltr" />
          </Field>
        </div>
        <div className="md:col-span-2 space-y-2">
          <Switch checked={s.requireStrongPassword} onChange={v => update('security', 'requireStrongPassword', v)} label="🔐 يتطلب كلمة مرور قوية (أرقام + رموز)" />
          <Switch checked={s.twoFAEnabled} onChange={v => update('security', 'twoFAEnabled', v)} label="🛡️ تفعيل المصادقة الثنائية 2FA" />
          <Switch checked={s.auditLogEnabled} onChange={v => update('security', 'auditLogEnabled', v)} label="📋 تسجيل سجل النشاطات Audit Log" />
          <Switch checked={s.forceLogoutOnPasswordChange} onChange={v => update('security', 'forceLogoutOnPasswordChange', v)} label="🚪 تسجيل خروج إجباري عند تغيير كلمة المرور" />
        </div>
      </div>
    </div>
  );
}

function ReportsSection({ draft, update }) {
  const r = draft.reports || {};
  const formats = r.exportFormats || [];
  const toggleFormat = (f) => {
    update('reports', 'exportFormats', formats.includes(f) ? formats.filter(x => x !== f) : [...formats, f]);
  };
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field label="الفترة الافتراضية">
        <Select value={r.defaultPeriod} onValueChange={v => update('reports', 'defaultPeriod', v)}>
          <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">يومي</SelectItem>
            <SelectItem value="weekly">أسبوعي</SelectItem>
            <SelectItem value="monthly">شهري</SelectItem>
            <SelectItem value="yearly">سنوي</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="وقت إرسال التقرير"><Input type="time" value={r.reportTime || '08:00'} onChange={e => update('reports', 'reportTime', e.target.value)} className="bg-input/30 border-gold/20" /></Field>
      <Field label="مدة الاحتفاظ بالتقارير (يوم)"><Input type="number" value={r.keepReportsDays || 365} onChange={e => update('reports', 'keepReportsDays', Number(e.target.value))} className="bg-input/30 border-gold/20" /></Field>
      <div className="md:col-span-2">
        <Label className="text-xs mb-2 block">صيغ التصدير المُفعّلة</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {['pdf', 'excel', 'csv', 'json'].map(f => (
            <button key={f} onClick={() => toggleFormat(f)} className={`p-3 rounded-lg border text-sm uppercase font-mono transition-all ${formats.includes(f) ? 'bg-gold/10 border-gold text-gold' : 'bg-input/30 border-gold-soft text-muted-foreground'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="md:col-span-2 space-y-2">
        <Switch checked={r.emailReportsToManager} onChange={v => update('reports', 'emailReportsToManager', v)} label="📧 إرسال التقارير للمدير عبر الإيميل" />
        <Switch checked={r.scheduleReports} onChange={v => update('reports', 'scheduleReports', v)} label="⏰ جدولة التقارير التلقائية" />
        <Switch checked={r.includeCharts} onChange={v => update('reports', 'includeCharts', v)} label="📊 تضمين الرسوم البيانية" />
      </div>
    </div>
  );
}

function EmployeesSection({ draft, update }) {
  const e = draft.employees || {};
  const days = e.workDays || [];
  const toggleDay = (d) => {
    update('employees', 'workDays', days.includes(d) ? days.filter(x => x !== d) : [...days, d]);
  };
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field label="بداية الدوام"><Input type="time" value={e.workStart || '08:00'} onChange={ev => update('employees', 'workStart', ev.target.value)} className="bg-input/30 border-gold/20" /></Field>
      <Field label="نهاية الدوام"><Input type="time" value={e.workEnd || '17:00'} onChange={ev => update('employees', 'workEnd', ev.target.value)} className="bg-input/30 border-gold/20" /></Field>
      <Field label="معدل الأجر الإضافي (×)"><Input type="number" step="0.1" value={e.overtimeRate || 1.5} onChange={ev => update('employees', 'overtimeRate', Number(ev.target.value))} className="bg-input/30 border-gold/20" /></Field>
      <Field label="هدف KPI %"><Input type="number" value={e.kpiTarget || 80} onChange={ev => update('employees', 'kpiTarget', Number(ev.target.value))} className="bg-input/30 border-gold/20" /></Field>

      <div className="md:col-span-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/30 space-y-3">
        <p className="font-bold text-amber-400 text-sm flex items-center gap-2">⏰ إعدادات خصم التأخير</p>
        <Switch checked={e.autoDeductionEnabled !== false} onChange={v => update('employees', 'autoDeductionEnabled', v)} label="🤖 تفعيل الخصم التلقائي عند التأخير" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="سماحية التأخير (دقيقة)"><Input type="number" value={e.lateGraceMinutes ?? 10} onChange={ev => update('employees', 'lateGraceMinutes', Number(ev.target.value))} className="bg-input/30 border-gold/20" /></Field>
          <Field label="نوع الخصم">
            <Select value={e.lateDeductionMode || 'fixed'} onValueChange={v => update('employees', 'lateDeductionMode', v)}>
              <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">💵 مبلغ ثابت</SelectItem>
                <SelectItem value="per_minute">⏱️ حسب كل دقيقة تأخير</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {(e.lateDeductionMode || 'fixed') === 'fixed' ? (
            <Field label="مبلغ الخصم الثابت (د.ع)"><Input type="number" value={e.lateDeductionAmount ?? 25000} onChange={ev => update('employees', 'lateDeductionAmount', Number(ev.target.value))} className="bg-input/30 border-gold/20" /></Field>
          ) : (
            <Field label="خصم لكل دقيقة (د.ع)"><Input type="number" value={e.lateDeductionPerMinute ?? 500} onChange={ev => update('employees', 'lateDeductionPerMinute', Number(ev.target.value))} className="bg-input/30 border-gold/20" /></Field>
          )}
          <Field label="خصم الغياب (د.ع)"><Input type="number" value={e.absentDeductionAmount ?? 50000} onChange={ev => update('employees', 'absentDeductionAmount', Number(ev.target.value))} className="bg-input/30 border-gold/20" /></Field>
        </div>
        <p className="text-[10px] text-muted-foreground">
          💡 مثال: لو السماحية 10د والخصم {(e.lateDeductionMode || 'fixed') === 'fixed' ? `${fmt(e.lateDeductionAmount ?? 25000)} د.ع مبلغ ثابت` : `${fmt(e.lateDeductionPerMinute ?? 500)} د.ع/دقيقة`}، فالموظف اللي بصم متأخر 30 دقيقة سيخصم منه {(e.lateDeductionMode || 'fixed') === 'fixed' ? fmt(e.lateDeductionAmount ?? 25000) : fmt((30 - (e.lateGraceMinutes ?? 10)) * (e.lateDeductionPerMinute ?? 500))} د.ع
        </p>
      </div>

      <div className="md:col-span-2">
        <Label className="text-xs mb-2 block">أيام العمل</Label>
        <div className="grid grid-cols-7 gap-1">
          {[{ id: 'sat', l: 'سبت' }, { id: 'sun', l: 'أحد' }, { id: 'mon', l: 'اثنين' }, { id: 'tue', l: 'ثلاثاء' }, { id: 'wed', l: 'أربعاء' }, { id: 'thu', l: 'خميس' }, { id: 'fri', l: 'جمعة' }].map(d => (
            <button key={d.id} onClick={() => toggleDay(d.id)} className={`p-2 rounded-lg border text-xs transition-all ${days.includes(d.id) ? 'bg-gold/10 border-gold text-gold' : 'bg-input/30 border-gold-soft text-muted-foreground'}`}>{d.l}</button>
          ))}
        </div>
      </div>
      <div className="md:col-span-2 space-y-2">
        <Switch checked={e.gpsTrackingEnabled} onChange={v => update('employees', 'gpsTrackingEnabled', v)} label="📍 تفعيل تتبع GPS للموظفين" />
        <Switch checked={e.requireFingerprint} onChange={v => update('employees', 'requireFingerprint', v)} label="👆 تطلب بصمة للحضور" />
        <Switch checked={e.requireFaceRecognition} onChange={v => update('employees', 'requireFaceRecognition', v)} label="😊 تطلب بصمة الوجه" />
        <Switch checked={e.autoAssignTasks} onChange={v => update('employees', 'autoAssignTasks', v)} label="🤖 توزيع المهام تلقائياً" />
      </div>
    </div>
  );
}


// ============ ACTIVATIONS LOG ============
function ActivationsLog() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [payFilter, setPayFilter] = useState('all');

  useEffect(() => {
    api('activations').then(d => setItems(Array.isArray(d) ? d : []));
  }, []);

  const norm = (v) => (v === null || v === undefined) ? '' : String(v).toLowerCase().trim();
  const q = norm(search);

  const filtered = items.filter(a => {
    if (payFilter !== 'all' && a.paymentMethod !== payFilter) return false;
    if (!q) return true;
    const haystack = [
      a.subscriberName, a.subscriberPhone, a.username, a.agentName,
      a.packageName, a.speed, a.notes, a.id, a.paymentMethod,
      a.amount, a.durationMonths, a.processedBy,
    ].map(norm).join(' ');
    return haystack.includes(q);
  });

  const totalRevenue = filtered.reduce((s, x) => s + (x.amount || 0), 0);
  const totalAgentProfit = filtered.reduce((s, x) => s + (x.agentProfit || 0), 0);
  const totalCompanyProfit = filtered.reduce((s, x) => s + (x.companyProfit || 0), 0);

  const payLabel = { cash: '💵 كاش', master: '💳 ماستر', fastpay: '⚡ فاست باي', transfer: '🏦 تحويل' };

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <h1 className="text-2xl font-bold gold-text flex items-center gap-2"><CheckCircle2 className="w-6 h-6" /> سجل التفعيلات</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي التفعيلات</p><p className="text-2xl font-bold gold-text">{filtered.length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي الإيرادات</p><p className="text-xl font-bold neon-text">{fmtCurrency(totalRevenue)}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">أرباح الوكلاء</p><p className="text-xl font-bold text-purple-400">{fmtCurrency(totalAgentProfit)}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">صافي ربح الشركة</p><p className="text-xl font-bold text-emerald-400">{fmtCurrency(totalCompanyProfit)}</p></div>
      </div>

      <Card className="glass-strong border-gold-soft">
        <CardContent className="pt-6 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث: اسم/يوزر/هاتف/وكيل..." className="pr-10 bg-input/30 border-gold/20" />
            </div>
            <Select value={payFilter} onValueChange={setPayFilter}>
              <SelectTrigger className="w-44 bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل طرق الدفع</SelectItem>
                <SelectItem value="cash">💵 كاش</SelectItem>
                <SelectItem value="master">💳 ماستر</SelectItem>
                <SelectItem value="fastpay">⚡ فاست باي</SelectItem>
                <SelectItem value="transfer">🏦 تحويل</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold-soft text-right text-xs text-muted-foreground">
                  <th className="p-2">التاريخ</th><th>المشترك</th><th>الباقة/السرعة</th><th>المدة</th><th>المبلغ</th><th>الدفع</th><th>الوكيل</th><th>عمولة</th><th>ينتهي</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="9" className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    لا توجد تفعيلات بعد. ابدأ بتفعيل مشترك من قسم &quot;مشتركو الإنترنت&quot; 🚀
                  </td></tr>
                ) : filtered.map(a => (
                  <tr key={a.id} className="border-b border-gold-soft/30 hover:bg-gold/5">
                    <td className="p-2 text-xs">{new Date(a.createdAt).toLocaleDateString('ar-IQ')}</td>
                    <td>
                      <div className="font-semibold text-xs">{a.subscriberName}</div>
                      <div className="text-[10px] font-mono text-cyan-400">@{a.username}</div>
                    </td>
                    <td>
                      <div className="text-xs">{a.packageName}</div>
                      <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-[10px]">{a.speed}</Badge>
                    </td>
                    <td className="text-xs">{a.durationMonths} شهر</td>
                    <td className="font-bold gold-text">{fmt(a.amount)}</td>
                    <td><Badge variant="outline" className="text-[10px]">{payLabel[a.paymentMethod] || a.paymentMethod}</Badge></td>
                    <td className="text-xs">{a.agentName}</td>
                    <td className="text-xs text-purple-400">{fmt(a.agentProfit)}</td>
                    <td className="text-[10px] text-muted-foreground">{new Date(a.endDate).toLocaleDateString('ar-IQ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ AGENTS ============
function Agents() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [statsDialog, setStatsDialog] = useState(null);
  const [tab, setTab] = useState('agents'); // agents | pending
  const [pending, setPending] = useState([]);
  const [packages, setPackages] = useState([]);
  const blankForm = {
    name: '', username: '', password: '', phone: '', branch: '',
    commission: 20, status: 'active',
    profitMode: 'percentage', // percentage | fixed_per_activation | fixed_per_package
    fixedProfitPerActivation: 5000,
    fixedProfitsByPackage: {},
    permissions: {
      canViewAllSubscribers: false,
      canActivate: true,
      canEditSubscribers: false,
      canDeleteSubscribers: false,
      requireAdminApproval: false,
      canViewProfits: true,
      canExportData: false,
      canSendWhatsapp: true,
    },
  };
  const [form, setForm] = useState(blankForm);
  const [dialogTab, setDialogTab] = useState('info'); // info | profits | permissions

  const load = async () => {
    const [a, pkgs] = await Promise.all([api('agents'), api('packages')]);
    setItems(safeArr(a));
    setPackages(safeArr(pkgs));
  };
  const loadPending = async () => {
    const r = await api('pending-activations?status=pending');
    setPending(safeArr(r));
  };
  useEffect(() => { load(); loadPending(); const i = setInterval(loadPending, 15000); return () => clearInterval(i); }, []);

  const save = async () => {
    const payload = {
      ...form,
      commission: Number(form.commission || 0),
      fixedProfitPerActivation: Number(form.fixedProfitPerActivation || 0),
    };
    if (editing) await api(`agents/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('agents', { method: 'POST', body: JSON.stringify({ ...payload, balance: 0, totalActivations: 0, totalProfit: 0 }) });
    toast.success('تم الحفظ'); setOpen(false); setEditing(null); load();
  };
  const remove = async (id) => { if (!confirm('حذف الوكيل؟')) return; await api(`agents/${id}`, { method: 'DELETE' }); toast.success('تم الحذف'); load(); };
  const openStats = async (id) => { const r = await api(`agents/${id}/stats`); setStatsDialog(r); };
  const portalLink = (a) => typeof window !== 'undefined' ? `${window.location.origin}/agent?u=${a.username}` : `/agent?u=${a.username}`;

  const startEdit = (a) => {
    setEditing(a);
    setForm({ ...blankForm, ...a, permissions: { ...blankForm.permissions, ...(a.permissions || {}) }, fixedProfitsByPackage: a.fixedProfitsByPackage || {} });
    setDialogTab('info');
    setOpen(true);
  };
  const startNew = () => {
    setEditing(null);
    setForm(blankForm);
    setDialogTab('info');
    setOpen(true);
  };

  const approvePending = async (p) => {
    const r = await api(`pending-activations/${p.id}/approve`, { method: 'POST', body: JSON.stringify({ approvedBy: 'المدير' }) });
    if (r?.success) { toast.success('✅ تمت الموافقة على التفعيل'); loadPending(); load(); }
    else toast.error('فشل: ' + (r?.error || ''));
  };
  const rejectPending = async (p) => {
    const reason = prompt('سبب الرفض:'); if (reason === null) return;
    const r = await api(`pending-activations/${p.id}/reject`, { method: 'POST', body: JSON.stringify({ reason, approvedBy: 'المدير' }) });
    if (r?.success) { toast.success('❌ تم الرفض'); loadPending(); }
    else toast.error('فشل: ' + (r?.error || ''));
  };

  const profitDisplay = (a) => {
    const mode = a.profitMode || 'percentage';
    if (mode === 'fixed_per_activation') return `${fmt(a.fixedProfitPerActivation || 0)} د.ع/تفعيل`;
    if (mode === 'fixed_per_package') {
      const count = Object.keys(a.fixedProfitsByPackage || {}).length;
      return `مخصص (${count} باقة)`;
    }
    return `${a.commission || 0}%`;
  };
  const profitModeLabel = (m) => ({
    percentage: 'نسبة %',
    fixed_per_activation: 'مبلغ ثابت',
    fixed_per_package: 'لكل باقة',
  })[m] || 'نسبة %';

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold gold-text flex items-center gap-2"><UserCheck className="w-6 h-6" /> الوكلاء</h1>
        <Button onClick={startNew} className="btn-gold"><Plus className="w-4 h-4 ml-1" /> وكيل جديد</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-input/30 border border-gold-soft">
          <TabsTrigger value="agents">👥 الوكلاء ({items.length})</TabsTrigger>
          <TabsTrigger value="pending">
            ⏳ طلبات تفعيل بانتظار الموافقة
            {pending.length > 0 && <Badge className="ml-2 bg-red-500/20 text-red-400 border-red-500/30">{pending.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4 mt-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي الوكلاء</p><p className="text-2xl font-bold gold-text">{items.length}</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي تفعيلاتهم</p><p className="text-2xl font-bold neon-text">{items.reduce((s, a) => s + (a.totalActivations || 0), 0)}</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي عمولاتهم</p><p className="text-xl font-bold text-purple-400">{fmtCurrency(items.reduce((s, a) => s + (a.totalProfit || 0), 0))}</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">رصيد إجمالي</p><p className="text-xl font-bold text-emerald-400">{fmtCurrency(items.reduce((s, a) => s + (a.balance || 0), 0))}</p></div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(a => (
              <Card key={a.id} className="glass-card border-gold-soft hover:border-gold/50">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-neon-gradient flex items-center justify-center text-2xl font-black text-background">{a.name[0]}</div>
                    <div className="flex-1">
                      <h3 className="font-bold">{a.name}</h3>
                      <p className="text-[10px] text-muted-foreground">@{a.username} · {a.branch}</p>
                      <p className="text-xs text-cyan-400">{a.phone}</p>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <Badge className={a.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}>{a.status === 'active' ? 'نشط' : 'موقف'}</Badge>
                      {a.permissions?.requireAdminApproval && (
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[8px]">⏳ يحتاج موافقة</Badge>
                      )}
                      {a.permissions?.canActivate === false && (
                        <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30 text-[8px]">👁️ عرض فقط</Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="glass-card rounded-lg p-2"><p className="text-[9px] text-muted-foreground">تفعيلات</p><p className="text-base font-bold gold-text">{a.totalActivations || 0}</p></div>
                    <div className="glass-card rounded-lg p-2" title={profitModeLabel(a.profitMode || 'percentage')}>
                      <p className="text-[9px] text-muted-foreground">{profitModeLabel(a.profitMode || 'percentage')}</p>
                      <p className="text-xs font-bold neon-text truncate">{profitDisplay(a)}</p>
                    </div>
                    <div className="glass-card rounded-lg p-2"><p className="text-[9px] text-muted-foreground">الرصيد</p><p className="text-xs font-bold text-emerald-400">{fmt(a.balance || 0)}</p></div>
                  </div>
                  <div className="p-2 rounded-lg bg-cyan-500/5 border border-cyan-500/20 text-[10px] flex items-center justify-between gap-2">
                    <span className="font-mono truncate">{portalLink(a)}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0" onClick={() => { navigator.clipboard?.writeText(portalLink(a)); toast.success('تم نسخ الرابط'); }}><FileText className="w-3 h-3" /></Button>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-gold-soft">
                    <Button size="sm" variant="outline" className="flex-1 border-gold/30" onClick={() => openStats(a.id)}><BarChart3 className="w-3 h-3 ml-1" /> إحصائيات</Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => startEdit(a)}><Edit2 className="w-3 h-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 hover:text-red-500" onClick={() => remove(a.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pending" className="space-y-3 mt-3">
          {pending.length === 0 ? (
            <Card className="glass-card border-gold-soft">
              <CardContent className="p-12 text-center text-muted-foreground">
                <CheckCircle2 className="w-16 h-16 mx-auto mb-3 text-emerald-400/50" />
                <p>لا توجد طلبات تفعيل بانتظار الموافقة</p>
              </CardContent>
            </Card>
          ) : pending.map(p => (
            <Card key={p.id} className="glass-card border-amber-500/30 hover:border-amber-500/50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-amber-400">⏳ طلب من الوكيل: {p.agentName}</p>
                    <p className="text-xs text-muted-foreground">منذ {new Date(p.requestedAt).toLocaleString('ar-IQ')}</p>
                  </div>
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">قيد الانتظار</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs pt-2 border-t border-gold-soft/30">
                  <div><p className="text-muted-foreground text-[10px]">المشترك</p><p className="font-bold">{p.subscriberName}</p></div>
                  <div><p className="text-muted-foreground text-[10px]">الباقة</p><p className="font-bold">{p.packageName}</p></div>
                  <div><p className="text-muted-foreground text-[10px]">المبلغ</p><p className="font-bold gold-text">{fmt(p.amount)} د.ع</p></div>
                  <div><p className="text-muted-foreground text-[10px]">عمولة الوكيل</p><p className="font-bold text-purple-400">{fmt(p.agentProfit)} د.ع</p></div>
                </div>
                <div className="flex gap-2 pt-2 border-t border-gold-soft/30">
                  <Button size="sm" onClick={() => approvePending(p)} className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40">
                    <CheckCircle2 className="w-3 h-3 ml-1" /> موافقة وتفعيل
                  </Button>
                  <Button size="sm" onClick={() => rejectPending(p)} variant="outline" className="border-red-500/40 hover:bg-red-500/10 text-red-400">
                    <XCircle className="w-3 h-3 ml-1" /> رفض
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-gold/40 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="gold-text">{editing ? 'تعديل الوكيل' : 'وكيل جديد'}</DialogTitle></DialogHeader>
          <Tabs value={dialogTab} onValueChange={setDialogTab}>
            <TabsList className="bg-input/30 border border-gold-soft w-full">
              <TabsTrigger value="info" className="flex-1">📝 المعلومات</TabsTrigger>
              <TabsTrigger value="profits" className="flex-1">💰 الأرباح</TabsTrigger>
              <TabsTrigger value="permissions" className="flex-1">🔒 الصلاحيات</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>اسم الوكيل</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-input/30 border-gold/20" /></div>
                <div><Label>اسم المستخدم</Label><Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="bg-input/30 border-gold/20 font-mono" /></div>
                <div><Label>كلمة المرور</Label><Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="bg-input/30 border-gold/20 font-mono" /></div>
                <div><Label>الهاتف</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-input/30 border-gold/20" /></div>
                <div><Label>الفرع</Label><Input value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} className="bg-input/30 border-gold/20" /></div>
                <div className="col-span-2">
                  <Label>الحالة</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="active">نشط</SelectItem><SelectItem value="suspended">موقف</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <CustomFieldsGrid entity="agents" customFields={form.customFields} onUpdate={(cf) => setForm({ ...form, customFields: cf })} columns={2} />
            </TabsContent>

            <TabsContent value="profits" className="space-y-3 pt-3">
              <div>
                <Label>طريقة احتساب أرباح الوكيل</Label>
                <Select value={form.profitMode || 'percentage'} onValueChange={v => setForm({ ...form, profitMode: v })}>
                  <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">📊 نسبة مئوية من قيمة التفعيل</SelectItem>
                    <SelectItem value="fixed_per_activation">💵 مبلغ ثابت لكل تفعيل</SelectItem>
                    <SelectItem value="fixed_per_package">📦 مبلغ مخصص لكل باقة</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {form.profitMode === 'percentage' && 'يأخذ الوكيل نسبة % من المبلغ المدفوع'}
                  {form.profitMode === 'fixed_per_activation' && 'مبلغ ثابت بالدينار العراقي عن كل تفعيل/تجديد'}
                  {form.profitMode === 'fixed_per_package' && 'مبلغ مختلف حسب الباقة (يستخدم القيمة الافتراضية إذا الباقة غير مذكورة)'}
                </p>
              </div>

              {form.profitMode === 'percentage' && (
                <div>
                  <Label>نسبة العمولة %</Label>
                  <Input type="number" min="0" max="100" value={form.commission} onChange={e => setForm({ ...form, commission: e.target.value })} className="bg-input/30 border-gold/20" />
                  <p className="text-[10px] text-amber-400 mt-1">مثال: 20% من 50,000 د.ع = 10,000 د.ع للوكيل</p>
                </div>
              )}

              {form.profitMode === 'fixed_per_activation' && (
                <div>
                  <Label>المبلغ الثابت لكل تفعيل (د.ع)</Label>
                  <Input type="number" min="0" value={form.fixedProfitPerActivation} onChange={e => setForm({ ...form, fixedProfitPerActivation: e.target.value })} className="bg-input/30 border-gold/20" />
                  <p className="text-[10px] text-amber-400 mt-1">يحصل الوكيل على هذا المبلغ مهما كانت قيمة الباقة</p>
                </div>
              )}

              {form.profitMode === 'fixed_per_package' && (
                <div className="space-y-2">
                  <div>
                    <Label>المبلغ الافتراضي (لأي باقة غير مدرجة)</Label>
                    <Input type="number" min="0" value={form.fixedProfitPerActivation} onChange={e => setForm({ ...form, fixedProfitPerActivation: e.target.value })} className="bg-input/30 border-gold/20" />
                  </div>
                  <Label className="block pt-2">المبلغ لكل باقة (اتركه فارغاً لاستخدام الافتراضي):</Label>
                  <div className="border border-gold-soft rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-input/30">
                        <tr>
                          <th className="p-2 text-right">الباقة</th>
                          <th className="p-2 text-right">السعر</th>
                          <th className="p-2 text-right">عمولة الوكيل (د.ع)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packages.length === 0 ? (
                          <tr><td colSpan={3} className="p-3 text-center text-muted-foreground">لا توجد باقات</td></tr>
                        ) : packages.map(pkg => (
                          <tr key={pkg.id} className="border-b border-gold-soft/30">
                            <td className="p-2">{pkg.name}</td>
                            <td className="p-2 text-muted-foreground">{fmt(pkg.monthlyFee)} د.ع</td>
                            <td className="p-2">
                              <Input
                                type="number" min="0"
                                value={form.fixedProfitsByPackage?.[pkg.id] ?? ''}
                                onChange={e => {
                                  const v = e.target.value;
                                  const map = { ...(form.fixedProfitsByPackage || {}) };
                                  if (v === '' || v === null) delete map[pkg.id];
                                  else map[pkg.id] = Number(v);
                                  setForm({ ...form, fixedProfitsByPackage: map });
                                }}
                                placeholder="افتراضي"
                                className="bg-input/30 border-gold/20 h-7 text-xs"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="permissions" className="space-y-2 pt-3">
              <p className="text-xs text-muted-foreground mb-2">حدد ما يستطيع الوكيل عمله:</p>
              {[
                { k: 'canViewAllSubscribers', label: '👁️ عرض جميع المشتركين (وليس فقط مشتركيه)' },
                { k: 'canActivate', label: '✅ تفعيل/تجديد المشتركين' },
                { k: 'canEditSubscribers', label: '✏️ تعديل بيانات المشتركين' },
                { k: 'canDeleteSubscribers', label: '🗑️ حذف المشتركين' },
                { k: 'requireAdminApproval', label: '⏳ التفعيل يحتاج موافقة المدير (يضع الطلبات في قائمة الانتظار)', warn: true },
                { k: 'canViewProfits', label: '💰 عرض أرباحه ورصيده' },
                { k: 'canExportData', label: '📥 تصدير البيانات (Excel/PDF)' },
                { k: 'canSendWhatsapp', label: '📱 إرسال رسائل واتساب' },
              ].map(p => (
                <label key={p.k} className={`flex items-center justify-between gap-3 p-2 rounded-lg border cursor-pointer hover:bg-input/30 ${form.permissions?.[p.k] ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gold-soft/30'}`}>
                  <span className={`text-xs ${p.warn && form.permissions?.[p.k] ? 'text-amber-400 font-bold' : ''}`}>{p.label}</span>
                  <input
                    type="checkbox"
                    checked={!!form.permissions?.[p.k]}
                    onChange={e => setForm({ ...form, permissions: { ...form.permissions, [p.k]: e.target.checked } })}
                    className="w-4 h-4 accent-emerald-500"
                  />
                </label>
              ))}
              <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20 text-[10px] text-cyan-400 mt-3">
                💡 ملاحظة: عند تفعيل "يحتاج موافقة المدير"، كل عملية تفعيل/تجديد يقوم بها الوكيل ستظهر في تبويب "طلبات تفعيل بانتظار الموافقة" في صفحة الوكلاء.
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter><Button onClick={save} className="btn-gold w-full">💾 حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statsDialog} onOpenChange={() => setStatsDialog(null)}>
        <DialogContent className="glass-strong border-gold/40 max-w-2xl">
          <DialogHeader><DialogTitle className="gold-text">إحصائيات: {statsDialog?.agent?.name}</DialogTitle></DialogHeader>
          {statsDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="stat-card text-center"><p className="text-[10px] text-muted-foreground">المشتركون</p><p className="text-xl font-bold gold-text">{statsDialog.stats.totalSubscribers}</p></div>
                <div className="stat-card text-center"><p className="text-[10px] text-muted-foreground">النشط</p><p className="text-xl font-bold text-emerald-400">{statsDialog.stats.activeSubscribers}</p></div>
                <div className="stat-card text-center"><p className="text-[10px] text-muted-foreground">التفعيلات</p><p className="text-xl font-bold neon-text">{statsDialog.stats.totalActivations}</p></div>
                <div className="stat-card text-center"><p className="text-[10px] text-muted-foreground">إيراداته</p><p className="text-sm font-bold gold-text">{fmt(statsDialog.stats.totalRevenue)}</p></div>
                <div className="stat-card text-center"><p className="text-[10px] text-muted-foreground">عمولاته</p><p className="text-sm font-bold text-purple-400">{fmt(statsDialog.stats.totalProfit)}</p></div>
                <div className="stat-card text-center"><p className="text-[10px] text-muted-foreground">منتهية قريباً</p><p className="text-xl font-bold text-amber-400">{statsDialog.stats.expiringSoon}</p></div>
              </div>
              <div>
                <h4 className="text-sm font-bold mb-2">آخر التفعيلات:</h4>
                <ScrollArea className="h-48">
                  {statsDialog.activations.map(a => (
                    <div key={a.id} className="text-xs p-2 border-b border-gold-soft/30 flex justify-between">
                      <span>{a.subscriberName}</span>
                      <span className="font-bold gold-text">{fmt(a.amount)} د.ع</span>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ NETWORKS / FATs ============
function Networks() {
  const [items, setItems] = useState([]);
  const [zones, setZones] = useState([]);
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ number: '', name: '', zoneId: '', capacity: 32, status: 'active', lat: 33.31, lng: 44.40, utilization: 50 });

  const load = async () => {
    const [n, z] = await Promise.all([api('networks'), api('zones')]);
    setItems(n); setZones(z);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(n =>
    (zoneFilter === 'all' || n.zoneId === zoneFilter) &&
    (statusFilter === 'all' || n.status === statusFilter) &&
    (!search || n.number?.toLowerCase().includes(search.toLowerCase()) || n.name?.includes(search))
  );

  const save = async () => {
    const z = zones.find(x => x.id === form.zoneId);
    const payload = { ...form, zoneName: z?.name, zoneNumber: z?.number, capacity: Number(form.capacity), utilization: Number(form.utilization), lat: Number(form.lat), lng: Number(form.lng) };
    if (editing) await api(`networks/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('networks', { method: 'POST', body: JSON.stringify({ ...payload, subscribers: 0 }) });
    toast.success('تم الحفظ'); setOpen(false); setEditing(null); load();
  };
  const remove = async (id) => { await api(`networks/${id}`, { method: 'DELETE' }); toast.success('تم الحذف'); load(); };

  const statusInfo = {
    active: { txt: 'فعالة', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    weak: { txt: 'ضعيفة', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    stopped: { txt: 'متوقفة', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
    maintenance: { txt: 'صيانة', cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold gold-text flex items-center gap-2"><Plug className="w-6 h-6" /> الشبكات / الفاتات</h1>
        <Button onClick={() => { setEditing(null); setForm({ number: '', name: '', zoneId: zones[0]?.id || '', capacity: 32, status: 'active', lat: 33.31, lng: 44.40, utilization: 50 }); setOpen(true); }} className="btn-gold"><Plus className="w-4 h-4 ml-1" /> فاتة جديدة</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي الفاتات</p><p className="text-2xl font-bold gold-text">{items.length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">فعالة</p><p className="text-2xl font-bold text-emerald-400">{items.filter(i => i.status === 'active').length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">ضعيفة/صيانة</p><p className="text-2xl font-bold text-amber-400">{items.filter(i => i.status === 'weak' || i.status === 'maintenance').length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">متوقفة</p><p className="text-2xl font-bold text-red-400">{items.filter(i => i.status === 'stopped').length}</p></div>
      </div>

      <Card className="glass-strong border-gold-soft">
        <CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث: رقم/اسم الفاتة..." className="pr-10 bg-input/30 border-gold/20" />
            </div>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الزونات</SelectItem>
                {zones.map(z => <SelectItem key={z.id} value={z.id}><span className="font-mono text-gold">{z.number}</span> · {z.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="active">فعالة</SelectItem>
                <SelectItem value="weak">ضعيفة</SelectItem>
                <SelectItem value="stopped">متوقفة</SelectItem>
                <SelectItem value="maintenance">صيانة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">عدد النتائج: <span className="text-gold font-bold">{filtered.length}</span> من {items.length}</p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.slice(0, 60).map(n => {
          const info = statusInfo[n.status] || statusInfo.active;
          return (
            <Card key={n.id} className="glass-card border-gold-soft hover:border-gold/50">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-base font-bold text-purple-400">{n.number}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{n.name}</p>
                  </div>
                  <Badge className={info.cls + ' text-[10px]'}>{info.txt}</Badge>
                </div>
                <div className="text-[10px] text-gold font-mono">📍 {n.zoneNumber} · {n.zoneName}</div>
                <div className="grid grid-cols-2 gap-1 text-center">
                  <div className="glass-card rounded p-1.5"><p className="text-[9px] text-muted-foreground">مشتركين</p><p className="text-sm font-bold neon-text">{n.subscribers || 0}/{n.capacity}</p></div>
                  <div className="glass-card rounded p-1.5"><p className="text-[9px] text-muted-foreground">ضغط</p><p className={`text-sm font-bold ${n.utilization > 85 ? 'text-red-400' : 'text-emerald-400'}`}>{n.utilization}%</p></div>
                </div>
                <Progress value={n.utilization} className="h-1" />
                <div className="flex gap-1 pt-1 border-t border-gold-soft">
                  <a href={`https://www.openstreetmap.org/?mlat=${n.lat}&mlon=${n.lng}#map=17/${n.lat}/${n.lng}`} target="_blank" rel="noreferrer" className="flex-1 text-center text-[10px] text-cyan-400 hover:text-cyan-300 py-1">🗺️ خريطة</a>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(n); setForm({ ...n }); setOpen(true); }}><Edit2 className="w-3 h-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-red-500" onClick={() => remove(n.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {filtered.length > 60 && <p className="text-center text-xs text-muted-foreground">عرض أول 60 فاتة من {filtered.length}. استخدم الفلاتر للوصول لباقي الفاتات.</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-gold/40">
          <DialogHeader><DialogTitle className="gold-text">{editing ? 'تعديل فاتة' : 'فاتة جديدة'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>رقم الفاتة</Label><Input value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} placeholder="F-01-05" className="bg-input/30 border-gold/20 font-mono" /></div>
            <div><Label>الاسم</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div className="col-span-2"><Label>الزون</Label>
              <Select value={form.zoneId} onValueChange={v => setForm({ ...form, zoneId: v })}>
                <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue placeholder="اختر زون" /></SelectTrigger>
                <SelectContent>{zones.map(z => <SelectItem key={z.id} value={z.id}><span className="font-mono text-gold">{z.number}</span> · {z.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>السعة</Label><Input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div><Label>الحالة</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">فعالة</SelectItem>
                  <SelectItem value="weak">ضعيفة</SelectItem>
                  <SelectItem value="stopped">متوقفة</SelectItem>
                  <SelectItem value="maintenance">صيانة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>خط العرض</Label><Input type="number" step="0.000001" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} className="bg-input/30 border-gold/20 font-mono" /></div>
            <div><Label>خط الطول</Label><Input type="number" step="0.000001" value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} className="bg-input/30 border-gold/20 font-mono" /></div>
            <div className="col-span-2"><Label>الضغط %</Label><Input type="number" value={form.utilization} onChange={e => setForm({ ...form, utilization: e.target.value })} className="bg-input/30 border-gold/20" /></div>
          </div>

          <CustomFieldsGrid
            entity="networks"
            customFields={form.customFields}
            onUpdate={(cf) => setForm({ ...form, customFields: cf })}
            columns={2}
          />

          <DialogFooter><Button onClick={save} className="btn-gold w-full">حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ WHATSAPP LOG ============
function WhatsAppLog() {
  const [items, setItems] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewing, setViewing] = useState(null);

  const load = () => api('whatsapp-messages').then(setArr(setItems));
  useEffect(() => { load(); }, []);

  const filtered = items.filter(m =>
    (typeFilter === 'all' || m.type === typeFilter) &&
    (statusFilter === 'all' || m.status === statusFilter)
  );

  const resend = async (id) => {
    const r = await api(`whatsapp-messages/${id}/resend`, { method: 'POST' });
    if (r.error) toast.error(r.error);
    else { toast.success('تم إعادة الإرسال للطابور'); load(); }
  };

  const statusInfo = {
    sent: { txt: '✅ مرسل', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    queued: { txt: '⏳ في الطابور', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    failed: { txt: '❌ فشل', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  };
  const typeLabel = { activation: '🎉 تفعيل', manager_alert: '🔔 إشعار مدير', expiry: '⏰ تنبيه انتهاء', debt: '💰 دين' };

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold gold-text flex items-center gap-2"><Send className="w-6 h-6" /> سجل رسائل الواتساب</h1>
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">⚠️ يحتاج تكامل WhatsApp API لتفعيل الإرسال الفعلي</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي الرسائل</p><p className="text-2xl font-bold gold-text">{items.length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">في الطابور</p><p className="text-2xl font-bold text-amber-400">{items.filter(i => i.status === 'queued').length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">مرسلة</p><p className="text-2xl font-bold text-emerald-400">{items.filter(i => i.status === 'sent').length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">فشلت</p><p className="text-2xl font-bold text-red-400">{items.filter(i => i.status === 'failed').length}</p></div>
      </div>

      <Card className="glass-strong border-gold-soft">
        <CardContent className="pt-6 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                <SelectItem value="activation">🎉 تفعيل</SelectItem>
                <SelectItem value="manager_alert">🔔 إشعار مدير</SelectItem>
                <SelectItem value="expiry">⏰ انتهاء</SelectItem>
                <SelectItem value="debt">💰 دين</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="queued">في الطابور</SelectItem>
                <SelectItem value="sent">مرسل</SelectItem>
                <SelectItem value="failed">فشل</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold-soft text-right text-xs text-muted-foreground">
                  <th className="p-2">التاريخ</th><th>النوع</th><th>إلى</th><th>الحالة</th><th>محاولات</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-12 text-muted-foreground">
                    <Send className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    لا توجد رسائل بعد. سيتم تسجيل الرسائل تلقائياً عند تفعيل المشتركين
                  </td></tr>
                ) : filtered.map(m => (
                  <tr key={m.id} className="border-b border-gold-soft/30 hover:bg-gold/5">
                    <td className="p-2 text-xs">{new Date(m.createdAt).toLocaleString('ar-IQ')}</td>
                    <td className="text-xs">{typeLabel[m.type] || m.type}</td>
                    <td className="text-xs">
                      <div>{m.subscriberName || '-'}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{m.phone}</div>
                    </td>
                    <td><Badge className={(statusInfo[m.status] || statusInfo.queued).cls + ' text-[10px]'}>{(statusInfo[m.status] || statusInfo.queued).txt}</Badge></td>
                    <td className="text-xs text-center">{m.retries || 0}</td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        <Button size="sm" variant="outline" className="h-7 text-[10px] border-cyan-500/30 text-cyan-400" onClick={() => setViewing(m)}>عرض</Button>
                        {m.phone && m.phone !== 'MANAGER' && (
                          <a href={whatsappLink(m.phone, m.message) || '#'} target="_blank" rel="noreferrer" onClick={() => resend(m.id)}>
                            <Button size="sm" className="h-7 text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white">
                              <Send className="w-3 h-3 ml-1" />WhatsApp
                            </Button>
                          </a>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-[10px] border-gold/30" onClick={() => resend(m.id)} title="وضع في طابور الإرسال التلقائي">
                          🔄 إعادة
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="glass-strong border-gold/40">
          <DialogHeader><DialogTitle className="gold-text">محتوى الرسالة</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3">
              <div className="p-2 rounded bg-input/30 text-xs">
                <strong>إلى:</strong> {viewing.subscriberName} ({viewing.phone}) · <strong>التاريخ:</strong> {new Date(viewing.createdAt).toLocaleString('ar-IQ')}
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">{viewing.message}</pre>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => { navigator.clipboard?.writeText(viewing.message); toast.success('تم النسخ'); }} className="btn-gold w-full">📋 نسخ النص</Button>
                {viewing.phone && viewing.phone !== 'MANAGER' && (
                  <a href={whatsappLink(viewing.phone, viewing.message) || '#'} target="_blank" rel="noreferrer" className="w-full">
                    <Button className="bg-emerald-500 hover:bg-emerald-600 text-white w-full">
                      <Send className="w-4 h-4 ml-2" /> فتح WhatsApp وإرسال
                    </Button>
                  </a>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ POS MANAGER REPORTS (Advanced Admin Dashboard) ============
function POSManagerReports() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [filters, setFilters] = useState({ from: monthAgo, to: today, employeeId: '', paymentMethod: '', productId: '', invoice: '', minDiscount: '' });
  const [data, setData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState('summary');
  const [viewingSale, setViewingSale] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(null);

  const fmtCur = (v) => `${Number(v || 0).toLocaleString('en-US')} د.ع`;

  const load = async () => {
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) q.set(k, v); });
    const d = await api(`pos/manager-dashboard?${q.toString()}`);
    setData(d);
  };

  useEffect(() => {
    api('employees').then(d => Array.isArray(d) && setEmployees(d));
    api('products').then(d => Array.isArray(d) && setProducts(d));
  }, []);
  useEffect(() => { load(); }, []);

  const applyFilters = () => { load(); sounds.click(); };
  const reset = () => { setFilters({ from: monthAgo, to: today, employeeId: '', paymentMethod: '', productId: '', invoice: '', minDiscount: '' }); setTimeout(load, 50); };

  const cancelSale = async () => {
    if (!cancelling) return;
    if (!confirm(`تأكيد إلغاء فاتورة ${cancelling.invoiceNumber || cancelling.id}؟`)) return;
    const r = await api(`sales/${cancelling.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: cancelReason }) });
    if (r?.error) { toast.error(r.error); sounds.error(); return; }
    toast.success('🗑️ تم إلغاء الفاتورة واسترجاع المخزون');
    sounds.success();
    setCancelling(null); setCancelReason(''); setViewingSale(null);
    load();
  };

  const printInvoice = (s) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html dir="rtl"><head><title>فاتورة ${s.invoiceNumber}</title>
      <style>body{font-family:Cairo,sans-serif;padding:20px;max-width:400px;margin:auto}h1{text-align:center}table{width:100%;border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #ddd;text-align:right}.total{font-weight:bold;background:#eee}</style>
      </head><body>
      <h1>مركز الغزلان</h1>
      <p>فاتورة رقم: <b>${s.invoiceNumber || s.id}</b></p>
      <p>التاريخ: ${new Date(s.createdAt).toLocaleString('ar-IQ')}</p>
      <p>الموظف: ${s.cashierName || '-'}</p>
      <table>
        <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
        <tbody>${(s.items || []).map(it => `<tr><td>${it.name}</td><td>${it.quantity}</td><td>${Number(it.price).toLocaleString()}</td><td>${(Number(it.price) * Number(it.quantity)).toLocaleString()}</td></tr>`).join('')}</tbody>
      </table>
      <table style="margin-top:10px">
        <tr><td>المجموع الفرعي</td><td>${Number(s.subtotal || s.total + (s.discount || 0)).toLocaleString()} د.ع</td></tr>
        <tr><td>الخصم</td><td>-${Number(s.discount || 0).toLocaleString()} د.ع</td></tr>
        <tr class="total"><td>الإجمالي</td><td>${Number(s.total).toLocaleString()} د.ع</td></tr>
        <tr><td>الدفع</td><td>${s.paymentMethod || 'نقد'}</td></tr>
      </table>
      <script>window.print();</script>
      </body></html>`);
    w.document.close();
  };

  if (!data) return <div className="text-center py-12 text-muted-foreground">⏳ جاري تحميل التقارير...</div>;

  const sum = data.summary;

  return (
    <div className="max-w-[1700px] mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-black gold-text flex items-center gap-2">
          <BarChart3 className="w-6 h-6" /> لوحة المدير - تقارير POS الإدارية
        </h1>
        <p className="text-xs text-muted-foreground mt-1">كل تفاصيل البيع والخصومات والموظفين بشكل احترافي</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '💰 مبيعات اليوم', value: fmtCur(sum.todayTotal), sub: `${sum.todayCount} فاتورة`, color: 'from-emerald-500 to-teal-600' },
          { label: '📊 مبيعات الشهر', value: fmtCur(sum.monthTotal), sub: `${sum.monthCount} فاتورة`, color: 'from-cyan-500 to-blue-600' },
          { label: '🎯 الفلترة الحالية', value: fmtCur(sum.rangeTotal), sub: `${sum.rangeCount} فاتورة`, color: 'from-amber-500 to-yellow-600' },
          { label: '💵 صافي الربح (الفترة)', value: fmtCur(sum.rangeProfit), sub: `خصم ${fmtCur(sum.rangeDiscount)}`, color: 'from-fuchsia-500 to-purple-600' },
          { label: '🏆 أكثر موظف بيعاً', value: sum.topEmployee?.name || '-', sub: sum.topEmployee ? fmtCur(sum.topEmployee.totalSales) : '', color: 'from-orange-500 to-red-600' },
          { label: '⭐ أكثر منتج مبيعاً', value: sum.topProduct?.name || '-', sub: sum.topProduct ? `${sum.topProduct.qty} قطعة` : '', color: 'from-pink-500 to-rose-600' },
          { label: '🎁 خصومات اليوم', value: fmtCur(sum.todayDiscount), sub: 'مجموع خصومات اليوم', color: 'from-rose-500 to-red-600' },
          { label: '📋 خصومات الشهر', value: fmtCur(sum.monthDiscount), sub: 'مجموع خصومات الشهر', color: 'from-violet-500 to-fuchsia-600' },
        ].map((c, i) => (
          <div key={i} className="stat-card">
            <p className={`text-[10px] bg-gradient-to-r ${c.color} bg-clip-text text-transparent font-bold mb-1`}>{c.label}</p>
            <p className="text-lg font-black text-foreground truncate">{c.value}</p>
            {c.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card className="glass-strong border-gold-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 gold-text">🔍 الفلترة المتقدمة</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div><Label className="text-[10px]">من تاريخ</Label><Input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} className="bg-input/30 border-gold/20 h-9" /></div>
          <div><Label className="text-[10px]">إلى تاريخ</Label><Input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} className="bg-input/30 border-gold/20 h-9" /></div>
          <div>
            <Label className="text-[10px]">الموظف</Label>
            <Select value={filters.employeeId || 'all'} onValueChange={v => setFilters({ ...filters, employeeId: v === 'all' ? '' : v })}>
              <SelectTrigger className="bg-input/30 border-gold/20 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الموظفين</SelectItem>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.photo} {e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">طريقة الدفع</Label>
            <Select value={filters.paymentMethod || 'all'} onValueChange={v => setFilters({ ...filters, paymentMethod: v === 'all' ? '' : v })}>
              <SelectTrigger className="bg-input/30 border-gold/20 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="cash">نقد</SelectItem>
                <SelectItem value="card">بطاقة</SelectItem>
                <SelectItem value="zaincash">Zain Cash</SelectItem>
                <SelectItem value="debt">دين</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">المنتج</Label>
            <Select value={filters.productId || 'all'} onValueChange={v => setFilters({ ...filters, productId: v === 'all' ? '' : v })}>
              <SelectTrigger className="bg-input/30 border-gold/20 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المنتجات</SelectItem>
                {products.slice(0, 100).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-[10px]">رقم الفاتورة</Label><Input value={filters.invoice} onChange={e => setFilters({ ...filters, invoice: e.target.value })} placeholder="INV-..." className="bg-input/30 border-gold/20 h-9 font-mono" /></div>
          <div><Label className="text-[10px]">حد أدنى للخصم</Label><Input type="number" value={filters.minDiscount} onChange={e => setFilters({ ...filters, minDiscount: e.target.value })} placeholder="1000" className="bg-input/30 border-gold/20 h-9" /></div>
          <div className="flex items-end gap-2">
            <Button onClick={applyFilters} className="btn-gold flex-1 h-9 text-xs">🔍 تطبيق</Button>
            <Button onClick={reset} variant="outline" className="border-gold/30 h-9 text-xs">↩️</Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { k: 'summary', l: '📊 الفواتير' },
          { k: 'employees', l: '👥 مبيعات الموظفين' },
          { k: 'products', l: '⭐ أعلى المنتجات' },
          { k: 'discounts', l: '🎁 الخصومات' },
          { k: 'payments', l: '💳 طرق الدفع' },
        ].map(b => (
          <button key={b.k} onClick={() => setTab(b.k)}
            className={`px-4 py-2 rounded-lg text-xs border transition-all ${tab === b.k ? 'bg-gold/20 border-gold text-gold' : 'bg-input/30 border-gold-soft text-muted-foreground hover:text-gold'}`}>
            {b.l}
          </button>
        ))}
      </div>

      {/* TAB: SALES LIST */}
      {tab === 'summary' && (
        <Card className="glass-strong border-gold-soft">
          <CardHeader className="pb-2"><CardTitle className="text-sm">قائمة الفواتير ({data.sales.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gold-soft text-right text-muted-foreground"><th className="p-2">الفاتورة</th><th>التاريخ والوقت</th><th>الموظف</th><th>منتجات</th><th>الإجمالي</th><th>الخصم</th><th>الدفع</th><th>الحالة</th><th></th></tr></thead>
                <tbody>
                  {data.sales.length === 0 && <tr><td colSpan="9" className="text-center py-6 text-muted-foreground">لا توجد فواتير مطابقة</td></tr>}
                  {data.sales.map(s => (
                    <tr key={s.id} className={`border-b border-gold-soft/30 hover:bg-gold/5 ${s.cancelled ? 'opacity-50' : ''}`}>
                      <td className="p-2 font-mono font-bold text-cyan-400">{s.invoiceNumber || s.id?.slice(0, 8)}</td>
                      <td className="text-[10px]">{new Date(s.createdAt).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>{s.cashierName || '-'}</td>
                      <td className="text-[10px]">{(s.items || []).length} صنف · {(s.items || []).reduce((a, it) => a + Number(it.quantity || 0), 0)} قطعة</td>
                      <td className="font-bold gold-text">{fmtCur(s.total)}</td>
                      <td className={Number(s.discount) > 0 ? 'text-red-400 font-bold' : ''}>{Number(s.discount) > 0 ? `-${fmtCur(s.discount)}` : '-'}</td>
                      <td><Badge className="text-[10px]">{s.paymentMethod || 'cash'}</Badge></td>
                      <td>{s.cancelled ? <Badge className="bg-red-500/20 text-red-400 text-[10px]">ملغاة</Badge> : <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">مكتملة</Badge>}</td>
                      <td><Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setViewingSale(s)}>عرض</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB: EMPLOYEES */}
      {tab === 'employees' && (
        <Card className="glass-strong border-gold-soft">
          <CardHeader className="pb-2"><CardTitle className="text-sm">تقرير مبيعات الموظفين</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gold-soft text-right text-muted-foreground"><th className="p-2">#</th><th>الموظف</th><th>عدد الفواتير</th><th>إجمالي القطع المباعة</th><th>إجمالي المبيعات</th><th>الخصومات</th><th>متوسط الفاتورة</th></tr></thead>
              <tbody>
                {data.employeesReport.length === 0 && <tr><td colSpan="7" className="text-center py-6 text-muted-foreground">لا توجد بيانات</td></tr>}
                {data.employeesReport.map((e, i) => (
                  <tr key={e.id} className="border-b border-gold-soft/30 hover:bg-gold/5">
                    <td className="p-2 font-bold gold-text">#{i + 1}</td>
                    <td className="font-bold">{i === 0 && '🏆 '}{e.name}</td>
                    <td className="font-bold text-cyan-400">{e.invoices}</td>
                    <td>{e.totalItems}</td>
                    <td className="font-black gold-text">{fmtCur(e.totalSales)}</td>
                    <td className="text-red-400">{fmtCur(e.totalDiscount)}</td>
                    <td className="text-emerald-400">{fmtCur(e.invoices ? e.totalSales / e.invoices : 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* TAB: TOP PRODUCTS */}
      {tab === 'products' && (
        <Card className="glass-strong border-gold-soft">
          <CardHeader className="pb-2"><CardTitle className="text-sm">المنتجات الأكثر مبيعاً</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gold-soft text-right text-muted-foreground"><th className="p-2">#</th><th>المنتج</th><th>SKU</th><th>الكمية المباعة</th><th>الإيرادات</th></tr></thead>
              <tbody>
                {data.topProducts.length === 0 && <tr><td colSpan="5" className="text-center py-6 text-muted-foreground">لا توجد بيانات</td></tr>}
                {data.topProducts.map((p, i) => (
                  <tr key={p.id} className="border-b border-gold-soft/30 hover:bg-gold/5">
                    <td className="p-2 font-bold gold-text">#{i + 1}</td>
                    <td className="font-bold">{i === 0 && '⭐ '}{p.name}</td>
                    <td className="font-mono text-[10px]">{p.sku || '-'}</td>
                    <td className="font-bold text-cyan-400">{p.qty}</td>
                    <td className="font-black gold-text">{fmtCur(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* TAB: DISCOUNTS */}
      {tab === 'discounts' && (
        <Card className="glass-strong border-rose-500/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-rose-400">🎁 تقرير الخصومات الكامل ({data.discounts.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gold-soft text-right text-muted-foreground"><th className="p-2">الفاتورة</th><th>الموظف</th><th>قبل الخصم</th><th>قيمة الخصم</th><th>بعد الخصم</th><th>السبب</th><th>صلاحية</th><th>الوقت</th></tr></thead>
                <tbody>
                  {data.discounts.length === 0 && <tr><td colSpan="8" className="text-center py-6 text-muted-foreground">لا توجد خصومات مطابقة</td></tr>}
                  {data.discounts.map(d => (
                    <tr key={d.saleId} className="border-b border-gold-soft/30 hover:bg-rose-500/5">
                      <td className="p-2 font-mono font-bold text-cyan-400">{d.invoiceNumber || d.saleId.slice(0, 8)}</td>
                      <td>{d.cashierName}</td>
                      <td>{fmtCur(d.subtotal)}</td>
                      <td className="text-red-400 font-bold">-{fmtCur(d.discount)}</td>
                      <td className="font-bold gold-text">{fmtCur(d.total)}</td>
                      <td className="text-[10px]">{d.reason || <span className="text-muted-foreground italic">بدون سبب</span>}</td>
                      <td>
                        {d.requiresApproval
                          ? (d.approved
                              ? <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">✅ بموافقة</Badge>
                              : <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">⚠️ بدون موافقة</Badge>)
                          : <Badge className="bg-cyan-500/20 text-cyan-400 text-[10px]">ضمن الصلاحية</Badge>}
                      </td>
                      <td className="text-[10px]">{new Date(d.createdAt).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB: PAYMENTS */}
      {tab === 'payments' && (
        <Card className="glass-strong border-gold-soft">
          <CardHeader className="pb-2"><CardTitle className="text-sm">📊 توزيع طرق الدفع</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.byPayment.map(p => (
                <div key={p.method} className="stat-card">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">{p.method}</p>
                  <p className="text-xl font-black gold-text">{fmtCur(p.total)}</p>
                  <p className="text-[10px] text-cyan-400 mt-1">{p.count} فاتورة</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sale Detail Dialog */}
      <Dialog open={!!viewingSale} onOpenChange={() => setViewingSale(null)}>
        <DialogContent className="glass-strong border-gold/40 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="gold-text">🧾 تفاصيل الفاتورة - {viewingSale?.invoiceNumber || viewingSale?.id?.slice(0, 8)}</DialogTitle></DialogHeader>
          {viewingSale && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-input/30 border border-gold-soft">
                  <p className="text-[10px] text-muted-foreground">رقم الفاتورة</p>
                  <p className="font-mono font-bold text-cyan-400">{viewingSale.invoiceNumber || viewingSale.id}</p>
                </div>
                <div className="p-2 rounded bg-input/30 border border-gold-soft">
                  <p className="text-[10px] text-muted-foreground">التاريخ والوقت</p>
                  <p className="font-bold">{new Date(viewingSale.createdAt).toLocaleString('ar-IQ')}</p>
                </div>
                <div className="p-2 rounded bg-input/30 border border-gold-soft">
                  <p className="text-[10px] text-muted-foreground">الموظف</p>
                  <p className="font-bold">{viewingSale.cashierName || '-'}</p>
                </div>
                <div className="p-2 rounded bg-input/30 border border-gold-soft">
                  <p className="text-[10px] text-muted-foreground">طريقة الدفع</p>
                  <p className="font-bold">{viewingSale.paymentMethod || 'cash'}</p>
                </div>
              </div>

              <div className="p-2 rounded bg-input/30 border border-gold-soft">
                <p className="text-[10px] text-muted-foreground mb-2 font-bold">🛒 المنتجات</p>
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gold-soft text-right text-muted-foreground"><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
                  <tbody>
                    {(viewingSale.items || []).map((it, i) => (
                      <tr key={i} className="border-b border-gold-soft/30">
                        <td className="py-1">{it.name}</td>
                        <td className="py-1 font-bold">{it.quantity}</td>
                        <td className="py-1">{fmtCur(it.price)}</td>
                        <td className="py-1 font-bold gold-text">{fmtCur(Number(it.price) * Number(it.quantity))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 rounded bg-emerald-500/5 border border-emerald-500/20 space-y-1 text-sm">
                <div className="flex justify-between"><span>المجموع الفرعي:</span><span className="font-bold">{fmtCur(Number(viewingSale.total) + Number(viewingSale.discount || 0))}</span></div>
                {Number(viewingSale.discount) > 0 && <div className="flex justify-between text-red-400"><span>الخصم{viewingSale.discountReason ? ` (${viewingSale.discountReason})` : ''}:</span><span className="font-bold">-{fmtCur(viewingSale.discount)}</span></div>}
                <div className="flex justify-between text-base pt-1 border-t border-gold-soft"><span className="font-bold">الإجمالي:</span><span className="font-black gold-text">{fmtCur(viewingSale.total)}</span></div>
              </div>

              {viewingSale.cancelled && (
                <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-xs">
                  <p className="text-red-400 font-bold">❌ فاتورة ملغاة</p>
                  {viewingSale.cancelReason && <p className="text-muted-foreground mt-1">السبب: {viewingSale.cancelReason}</p>}
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button onClick={() => printInvoice(viewingSale)} className="btn-gold flex-1">🖨️ طباعة</Button>
                {!viewingSale.cancelled && (
                  <Button onClick={() => setCancelling(viewingSale)} className="bg-red-500 hover:bg-red-600 text-white">🗑️ إلغاء الفاتورة</Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelling} onOpenChange={() => { setCancelling(null); setCancelReason(''); }}>
        <DialogContent className="glass-strong border-red-500/40">
          <DialogHeader><DialogTitle className="text-red-400">⚠️ إلغاء فاتورة</DialogTitle></DialogHeader>
          <p className="text-xs">سيتم إلغاء الفاتورة <span className="font-bold gold-text">{cancelling?.invoiceNumber}</span> واسترجاع المنتجات للمخزون.</p>
          <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="سبب الإلغاء (اختياري)..." className="bg-input/30 border-gold/20 h-20" />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCancelling(null); setCancelReason(''); }}>إلغاء</Button>
            <Button onClick={cancelSale} className="bg-red-500 hover:bg-red-600 text-white flex-1">تأكيد الإلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ LOCATION UPDATE REQUESTS (Admin) ============
function LocationRequestsPage() {
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

// ============ LOADING ============
function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gold-gradient flex items-center justify-center animate-pulse-glow">
          <span className="text-2xl font-black text-background">غ</span>
        </div>
        <p className="gold-text font-bold">جاري التحميل...</p>
      </div>
    </div>
  );
}

// ============ TELEGRAM BOT MANAGEMENT PAGE ============
const TG_PERMS = [
  { id: 'reports', label: '📊 التقارير', desc: 'مشاهدة تقارير المبيعات والأرباح' },
  { id: 'finance', label: '💰 المالية', desc: 'الإيرادات/الديون/المصروفات' },
  { id: 'subscribers', label: '🌐 المشتركين', desc: 'بيانات المشتركين والديون' },
  { id: 'employees', label: '👥 الموظفين', desc: 'الحضور والأداء والمهام' },
  { id: 'maintenance', label: '🛠 الصيانة', desc: 'تذاكر الصيانة' },
  { id: 'network', label: '📡 الشبكة', desc: 'حالة الزونات والفاتات' },
  { id: 'manage_users', label: '🔐 إدارة المستخدمين', desc: 'إضافة/حذف IDs' },
  { id: 'view_logs', label: '📜 السجلات', desc: 'سجل استخدام البوت' },
];
const TG_ROLES = [
  { id: 'super_admin', label: '👑 سوبر أدمن', defaults: TG_PERMS.map(p => p.id) },
  { id: 'manager', label: '🎩 مدير', defaults: TG_PERMS.map(p => p.id) },
  { id: 'accountant', label: '💰 محاسب', defaults: ['finance', 'reports', 'subscribers'] },
  { id: 'hr', label: '👥 موارد بشرية', defaults: ['employees', 'reports'] },
  { id: 'agent', label: '🤝 وكيل', defaults: ['subscribers'] },
  { id: 'supervisor', label: '🔧 مشرف', defaults: ['reports', 'maintenance', 'network'] },
  { id: 'employee', label: '🧑‍💼 موظف', defaults: ['employees'] },
];

function TelegramBotPage() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [webhookInfo, setWebhookInfo] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const blank = { telegramId: '', name: '', role: 'employee', permissions: ['employees'], enabled: true };
  const [form, setForm] = useState(blank);

  const load = async () => {
    const [u, l, w] = await Promise.all([
      api('telegram-users'),
      api('telegram-logs?limit=200'),
      api('telegram/webhook-info'),
    ]);
    if (Array.isArray(u)) setUsers(u);
    if (Array.isArray(l)) setLogs(l);
    setWebhookInfo(w);
  };
  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, []);

  const save = async () => {
    if (!form.telegramId || !form.name || !form.role) { toast.error('الحقول الأساسية مطلوبة'); return; }
    const r = editing
      ? await api(`telegram-users/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
      : await api('telegram-users', { method: 'POST', body: JSON.stringify(form) });
    if (r.error) toast.error(r.error);
    else { toast.success('✅ تم الحفظ'); setOpen(false); setEditing(null); setForm(blank); load(); }
  };
  const remove = async (id) => {
    if (!confirm('حذف هذا المستخدم؟')) return;
    await api(`telegram-users/${id}`, { method: 'DELETE' });
    toast.success('تم الحذف'); load();
  };
  const toggle = async (u) => {
    await api(`telegram-users/${u.id}`, { method: 'PUT', body: JSON.stringify({ enabled: !u.enabled }) });
    toast.success(u.enabled ? 'تم التعطيل' : 'تم التفعيل'); load();
  };
  const editUser = (u) => {
    setEditing(u);
    setForm({ telegramId: u.telegramId, name: u.name, role: u.role, permissions: u.permissions || [], enabled: u.enabled });
    setOpen(true);
  };

  const setupWebhook = async () => {
    const r = await api('telegram/setup-webhook', { method: 'POST' });
    if (r.success) { toast.success('✅ تم ربط الويب هوك - البوت يعمل الآن'); load(); }
    else toast.error('فشل: ' + (r.response?.description || ''));
  };
  const deleteWebhook = async () => {
    if (!confirm('إيقاف الويب هوك؟ سيتوقف البوت عن العمل')) return;
    await api('telegram/delete-webhook', { method: 'POST' });
    toast.success('تم إيقاف الويب هوك'); load();
  };
  const onRoleChange = (role) => {
    const def = TG_ROLES.find(r => r.id === role);
    setForm({ ...form, role, permissions: def?.defaults || [] });
  };
  const togglePerm = (p) => {
    const perms = form.permissions.includes(p)
      ? form.permissions.filter(x => x !== p)
      : [...form.permissions, p];
    setForm({ ...form, permissions: perms });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black gold-text">✈️ بوت إحصائيات تيليجرام</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة Telegram IDs وصلاحيات البوت + سجلات الاستخدام</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={setupWebhook} className="btn-neon"><Plug className="w-4 h-4 ml-1" /> ربط الويب هوك</Button>
          <Button onClick={deleteWebhook} variant="outline" className="border-red-500/30 text-red-400">إيقاف</Button>
        </div>
      </div>

      {/* Webhook Status */}
      <Card className="glass-strong border-gold/40">
        <CardContent className="p-4 grid md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">حالة البوت</p>
            <p className="font-bold text-lg flex items-center gap-2">
              {webhookInfo?.result?.url ? <><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> <span className="text-emerald-400">يعمل</span></> : <><span className="w-2 h-2 rounded-full bg-red-400"></span> <span className="text-red-400">متوقف</span></>}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">المستخدمون المصرَّح بهم</p>
            <p className="font-bold gold-text text-2xl">{users.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">طلبات اليوم</p>
            <p className="font-bold neon-text text-2xl">{logs.filter(l => l.timestamp?.startsWith(new Date().toISOString().slice(0, 10))).length}</p>
          </div>
          {webhookInfo?.result?.url && (
            <div className="md:col-span-3 text-[10px] text-muted-foreground font-mono break-all p-2 bg-input/30 rounded">
              🔗 {webhookInfo.result.url}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-input/30 border border-gold-soft">
          <TabsTrigger value="users">👥 المستخدمون ({users.length})</TabsTrigger>
          <TabsTrigger value="logs">📜 السجلات ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => { setEditing(null); setForm(blank); setOpen(true); }} className="btn-gold"><Plus className="w-4 h-4 ml-1" /> إضافة Telegram ID</Button>
          </div>

          {users.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">لا يوجد مستخدمون. أضف Telegram ID للبدء.</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {users.map(u => {
                const role = TG_ROLES.find(r => r.id === u.role);
                return (
                  <Card key={u.id} className={`glass-card border-gold-soft hover:border-gold/50 ${!u.enabled ? 'opacity-50' : ''}`}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">{u.name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{u.telegramId}</p>
                        </div>
                        <Badge className={u.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>{u.enabled ? '✅ مفعّل' : '⛔ معطّل'}</Badge>
                      </div>
                      <p className="text-xs">{role?.label || u.role}</p>
                      <div className="flex flex-wrap gap-1">
                        {(u.permissions || []).slice(0, 6).map(p => (
                          <span key={p} className="text-[9px] px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">{p}</span>
                        ))}
                        {u.permissions?.length > 6 && <span className="text-[9px] text-muted-foreground">+{u.permissions.length - 6}</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground space-y-0.5">
                        <p>📊 {u.totalRequests || 0} طلب</p>
                        {u.lastActivity && <p>🕐 آخر نشاط: {new Date(u.lastActivity).toLocaleString('ar-IQ')}</p>}
                        {u.failedAttempts > 0 && <p className="text-red-400">⚠️ محاولات فاشلة: {u.failedAttempts}</p>}
                      </div>
                      <div className="grid grid-cols-3 gap-1 pt-2 border-t border-gold-soft">
                        <Button size="sm" variant="ghost" onClick={() => editUser(u)} className="h-7 text-[10px]">تعديل</Button>
                        <Button size="sm" variant="ghost" onClick={() => toggle(u)} className="h-7 text-[10px]">{u.enabled ? 'تعطيل' : 'تفعيل'}</Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(u.id)} className="h-7 text-[10px] text-red-400">حذف</Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card className="glass-strong border-gold-soft">
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card/95 backdrop-blur">
                  <tr className="border-b border-gold-soft">
                    <th className="p-2 text-right">الحالة</th>
                    <th className="p-2 text-right">Telegram ID</th>
                    <th className="p-2 text-right">المستخدم</th>
                    <th className="p-2 text-right">الإجراء</th>
                    <th className="p-2 text-right">التفاصيل</th>
                    <th className="p-2 text-right">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} className="border-b border-gold-soft/30">
                      <td className="p-2">{l.success ? '✅' : '❌'}</td>
                      <td className="p-2 font-mono">{l.telegramId}</td>
                      <td className="p-2">{l.userName}</td>
                      <td className="p-2"><Badge className={l.action === 'unauthorized_access' ? 'bg-red-500/20 text-red-400 text-[9px]' : 'bg-cyan-500/20 text-cyan-400 text-[9px]'}>{l.action}</Badge></td>
                      <td className="p-2 text-muted-foreground">{l.details || '-'}</td>
                      <td className="p-2 text-[10px]">{new Date(l.timestamp).toLocaleString('ar-IQ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length === 0 && <p className="p-6 text-center text-muted-foreground text-xs">لا توجد سجلات</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-gold/40 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="gold-text">{editing ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Telegram ID *</Label><Input dir="ltr" type="text" value={form.telegramId} onChange={e => setForm({ ...form, telegramId: e.target.value })} className="bg-input/30 border-gold/20 font-mono" disabled={!!editing} /></div>
            <div><Label className="text-xs">الاسم *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-input/30 border-gold/20" /></div>
            <div className="col-span-2">
              <Label className="text-xs">نوع الحساب *</Label>
              <Select value={form.role} onValueChange={onRoleChange}>
                <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
                <SelectContent>{TG_ROLES.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">عند تغيير النوع، تُحدّث الصلاحيات افتراضياً، يمكنك تعديلها يدوياً</p>
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-2 block">الصلاحيات (يُحدد ما يظهر في البوت)</Label>
              <div className="grid md:grid-cols-2 gap-2">
                {TG_PERMS.map(p => {
                  const checked = form.permissions.includes(p.id);
                  return (
                    <button key={p.id} type="button" onClick={() => togglePerm(p.id)}
                      className={`text-right p-3 rounded-lg border transition-all ${checked ? 'bg-gold/10 border-gold' : 'bg-input/30 border-gold-soft'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold">{p.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{p.desc}</p>
                        </div>
                        <span className={`text-lg ${checked ? 'text-gold' : 'text-muted-foreground/30'}`}>{checked ? '✅' : '⬜'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="col-span-2">
              <Switch checked={form.enabled} onChange={v => setForm({ ...form, enabled: v })} label="🟢 الحساب مفعّل (إذا تم إيقافه لن يستطيع الدخول)" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} className="btn-gold w-full">{editing ? 'حفظ التعديلات' : 'إضافة المستخدم'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ ORDERS / E-COMMERCE ADMIN PAGE ============
function OrdersAdminPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [printOrder, setPrintOrder] = useState(null);

  const load = async () => {
    const r = await api('orders');
    if (Array.isArray(r)) setItems(r);
  };
  useEffect(() => { load(); const i = setInterval(load, 20000); return () => clearInterval(i); }, []);

  const filtered = filter === 'all' ? items : items.filter(o => o.status === filter);
  const updateStatus = async (id, status) => {
    const r = await api(`orders/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
    if (r.error) toast.error(r.error); else { toast.success('✅ تم التحديث'); load(); }
  };
  const remove = async (id) => {
    if (!confirm('حذف الطلب؟')) return;
    await api(`orders/${id}`, { method: 'DELETE' });
    toast.success('تم الحذف'); load();
  };

  const STATUS_META = {
    pending: { l: '🟡 جديد', c: 'bg-amber-500/20 text-amber-400' },
    confirmed: { l: '✅ مؤكد', c: 'bg-cyan-500/20 text-cyan-400' },
    shipping: { l: '🚚 قيد الشحن', c: 'bg-purple-500/20 text-purple-400' },
    delivered: { l: '🎉 تم التسليم', c: 'bg-emerald-500/20 text-emerald-400' },
    cancelled: { l: '❌ ملغي', c: 'bg-red-500/20 text-red-400' },
  };
  const counts = Object.keys(STATUS_META).reduce((acc, k) => { acc[k] = items.filter(o => o.status === k).length; return acc; }, {});
  counts.all = items.length;
  const totalRevenue = items.filter(o => o.status === 'delivered').reduce((s, x) => s + (x.total || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black gold-text">🛒 المتجر والطلبات</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة الطلبات الواردة من المتجر الإلكتروني</p>
        </div>
        <a href="/store" target="_blank" rel="noreferrer">
          <Button className="btn-neon"><ShoppingCart className="w-4 h-4 ml-1" /> عرض المتجر</Button>
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي الطلبات</p><p className="text-2xl font-bold gold-text">{counts.all}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">طلبات جديدة</p><p className="text-2xl font-bold text-amber-400">{counts.pending}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">تم التسليم</p><p className="text-2xl font-bold text-emerald-400">{counts.delivered}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">إيرادات المتجر</p><p className="text-xl font-bold gold-text">{fmt(totalRevenue)}</p></div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs border ${filter === 'all' ? 'bg-gold/20 border-gold text-gold' : 'bg-input/30 border-gold-soft text-muted-foreground'}`}>📋 الكل ({counts.all})</button>
        {Object.entries(STATUS_META).map(([k, m]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-lg text-xs border ${filter === k ? 'bg-gold/20 border-gold text-gold' : 'bg-input/30 border-gold-soft text-muted-foreground'}`}>
            {m.l} ({counts[k] || 0})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">لا توجد طلبات في هذه الفئة</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map(o => {
            const meta = STATUS_META[o.status] || STATUS_META.pending;
            return (
              <Card key={o.id} className="glass-card border-gold-soft">
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono text-sm gold-text">{o.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString('ar-IQ')}</p>
                    </div>
                    <Badge className={meta.c + ' text-[10px]'}>{meta.l}</Badge>
                  </div>
                  <div className="text-xs space-y-1">
                    <p><span className="text-muted-foreground">العميل:</span> <span className="font-bold">{o.customerName}</span></p>
                    <p><span className="text-muted-foreground">الهاتف:</span> <a href={`tel:${o.customerPhone}`} className="text-cyan-400 font-mono">{o.customerPhone}</a></p>
                    {o.customerAddress && <p><span className="text-muted-foreground">العنوان:</span> {o.customerAddress}</p>}
                    <p><span className="text-muted-foreground">الدفع:</span> {o.paymentMethod === 'cod' ? '💵 عند الاستلام' : o.paymentMethod}</p>
                  </div>
                  <div className="border-t border-gold-soft pt-2 text-xs space-y-1">
                    {o.items.map((it, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{it.name} × {it.quantity}</span>
                        <span className="font-bold">{fmt(it.total)} د.ع</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-gold-soft/30 pt-1 mt-1 text-[10px] text-muted-foreground">
                      <span>الشحن</span>
                      <span>{o.shipping === 0 ? 'مجاني' : `${fmt(o.shipping)} د.ع`}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base gold-text">
                      <span>الإجمالي</span>
                      <span>{fmt(o.total)} د.ع</span>
                    </div>
                  </div>
                  <div className="flex gap-1 pt-2 border-t border-gold-soft flex-wrap">
                    {o.status === 'pending' && <Button size="sm" onClick={() => updateStatus(o.id, 'confirmed')} className="btn-gold h-7 text-[10px] flex-1">✅ تأكيد</Button>}
                    {o.status === 'confirmed' && <Button size="sm" onClick={() => updateStatus(o.id, 'shipping')} className="btn-neon h-7 text-[10px] flex-1">🚚 شحن</Button>}
                    {o.status === 'shipping' && <Button size="sm" onClick={() => updateStatus(o.id, 'delivered')} className="btn-gold h-7 text-[10px] flex-1">🎉 تسليم</Button>}
                    <Button size="sm" variant="outline" onClick={() => setPrintOrder(o)} className="h-7 text-[10px]"><Printer className="w-3 h-3 ml-1" /> فاتورة</Button>
                    {o.status !== 'cancelled' && o.status !== 'delivered' && <Button size="sm" variant="outline" onClick={() => updateStatus(o.id, 'cancelled')} className="border-red-500/30 text-red-400 h-7 text-[10px]">إلغاء</Button>}
                    <Button size="icon" variant="ghost" onClick={() => remove(o.id)} className="h-7 w-7 hover:text-red-500"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ThermalReceiptModal order={printOrder} onClose={() => setPrintOrder(null)} />
    </div>
  );
}

// ============ THERMAL RECEIPT WITH BARCODE ============
function ThermalReceiptModal({ order, onClose }) {
  if (!order) return null;
  return (
    <Dialog open={!!order} onOpenChange={onClose}>
      <DialogContent className="glass-strong border-gold/40 max-w-md">
        <DialogHeader>
          <DialogTitle className="gold-text flex justify-between items-center">
            🧾 فاتورة حرارية
            <Button size="sm" onClick={() => window.print()} className="btn-gold h-7 text-xs"><Printer className="w-3 h-3 ml-1" /> طباعة</Button>
          </DialogTitle>
        </DialogHeader>
        <div id="thermal-receipt" className="thermal-receipt bg-white text-black p-4 font-mono text-xs leading-tight" dir="ltr" style={{ fontFamily: 'monospace' }}>
          <div className="text-center border-b-2 border-dashed border-black pb-2 mb-2" dir="rtl">
            <p className="text-lg font-bold">مركز الغزلان</p>
            <p>Ghazlan Center</p>
            <p>ERP · POS · ISP</p>
          </div>
          <div className="text-center mb-2">
            <Barcode value={order.orderNumber} height={50} />
          </div>
          <div dir="rtl" className="space-y-0.5">
            <p>رقم الطلب: <b>{order.orderNumber}</b></p>
            <p>التاريخ: {new Date(order.createdAt).toLocaleString('ar-IQ')}</p>
            <p>العميل: <b>{order.customerName}</b></p>
            <p>الهاتف: <b dir="ltr">{order.customerPhone}</b></p>
            {order.customerAddress && <p>العنوان: {order.customerAddress}</p>}
          </div>
          <div className="border-t-2 border-dashed border-black my-2 py-1" dir="rtl">
            <p className="font-bold text-center">الأصناف</p>
            <div className="border-t border-black mt-1 pt-1 space-y-0.5">
              {order.items.map((it, i) => (
                <div key={i} className="flex justify-between">
                  <span>{it.name} × {it.quantity}</span>
                  <span>{fmt(it.total)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t-2 border-dashed border-black pt-2 space-y-0.5" dir="rtl">
            <div className="flex justify-between"><span>المجموع:</span><span>{fmt(order.subtotal)}</span></div>
            <div className="flex justify-between"><span>الشحن:</span><span>{order.shipping === 0 ? 'مجاني' : fmt(order.shipping)}</span></div>
            <div className="flex justify-between text-base font-bold border-t border-black pt-1 mt-1">
              <span>الإجمالي:</span><span>{fmt(order.total)} د.ع</span>
            </div>
            <p className="mt-2">طريقة الدفع: {order.paymentMethod === 'cod' ? 'عند الاستلام' : order.paymentMethod}</p>
          </div>
          <div className="text-center border-t-2 border-dashed border-black mt-3 pt-2" dir="rtl">
            <p>شكراً لتعاملكم معنا</p>
            <p className="text-[10px]">www.ghazlan.com</p>
          </div>
        </div>
        <style jsx global>{`
          @media print {
            body * { visibility: hidden; }
            #thermal-receipt, #thermal-receipt * { visibility: visible; }
            #thermal-receipt { position: absolute; left: 0; top: 0; width: 80mm; background: white !important; color: black !important; padding: 8px; font-size: 11px; }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

// ============ ACCOUNTING / FINANCIAL REPORTS PAGE ============
function AccountingPage() {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);

  const load = async () => {
    const r = await api(`accounting/summary?period=${period}`);
    if (!r.error) setData(r);
  };
  useEffect(() => { load(); const i = setInterval(load, 60000); return () => clearInterval(i); }, [period]);

  const handlePrint = () => window.print();

  if (!data) return <div className="text-center py-12 text-sm text-muted-foreground">جاري التحميل...</div>;

  const maxRev = Math.max(...data.breakdown.map(b => b.revenue), 1);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-black gold-text">💼 المحاسبة المالية</h1>
          <p className="text-sm text-muted-foreground mt-1">الأرباح، المصروفات، الديون، والتقارير المالية</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40 bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">📅 اليوم</SelectItem>
              <SelectItem value="month">📆 الشهر الحالي</SelectItem>
              <SelectItem value="year">🗓️ السنة الحالية</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handlePrint} className="btn-neon"><Printer className="w-4 h-4 ml-1" /> طباعة / PDF</Button>
        </div>
      </div>

      <div id="accounting-print" className="space-y-4">
        <div className="hidden print:block text-center border-b-2 border-black pb-3 mb-3">
          <h1 className="text-3xl font-black">مركز الغزلان</h1>
          <p className="text-sm">التقرير المالي - {period === 'day' ? 'اليوم' : period === 'month' ? 'الشهر' : 'السنة'} ({data.prefix})</p>
        </div>

        {/* Top cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="glass-strong border-emerald-500/30 print:border-black"><CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground print:text-black">💵 الإيرادات</p>
            <p className="text-2xl font-bold text-emerald-400 print:text-black">{fmt(data.revenue.total)}</p>
            <p className="text-[10px] text-muted-foreground print:text-black">د.ع</p>
          </CardContent></Card>
          <Card className="glass-strong border-red-500/30 print:border-black"><CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground print:text-black">💸 المصروفات</p>
            <p className="text-2xl font-bold text-red-400 print:text-black">{fmt(data.expenses.total)}</p>
            <p className="text-[10px] text-muted-foreground print:text-black">د.ع</p>
          </CardContent></Card>
          <Card className={`glass-strong ${data.netProfit >= 0 ? 'border-gold/40' : 'border-red-500/40'} print:border-black`}><CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground print:text-black">📈 صافي الربح</p>
            <p className={`text-2xl font-bold ${data.netProfit >= 0 ? 'gold-text' : 'text-red-400'} print:text-black`}>{fmt(data.netProfit)}</p>
            <p className="text-[10px] text-muted-foreground print:text-black">د.ع</p>
          </CardContent></Card>
          <Card className="glass-strong border-amber-500/30 print:border-black"><CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground print:text-black">💰 الديون المستحقة</p>
            <p className="text-2xl font-bold text-amber-400 print:text-black">{fmt(data.debts.total)}</p>
            <p className="text-[10px] text-muted-foreground print:text-black">من {data.debts.count} مدين</p>
          </CardContent></Card>
        </div>

        {/* Revenue breakdown */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="glass-strong border-gold-soft print:border-black">
            <CardHeader><CardTitle className="text-base print:text-black">💵 تفصيل الإيرادات</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm"><span>🧾 مبيعات</span><span className="font-bold">{fmt(data.revenue.sales)} د.ع <span className="text-[10px] text-muted-foreground">({data.counts.sales} فاتورة)</span></span></div>
              <div className="flex justify-between text-sm"><span>🚀 تفعيل اشتراكات</span><span className="font-bold">{fmt(data.revenue.activations)} د.ع <span className="text-[10px] text-muted-foreground">({data.counts.activations} تفعيل)</span></span></div>
              <div className="flex justify-between text-sm"><span>🛠 صيانة</span><span className="font-bold">{fmt(data.revenue.repairs)} د.ع <span className="text-[10px] text-muted-foreground">({data.counts.repairs} تذكرة)</span></span></div>
              <div className="border-t border-gold-soft pt-2 flex justify-between font-bold text-base"><span>الإجمالي</span><span className="text-emerald-400 print:text-black">{fmt(data.revenue.total)} د.ع</span></div>
            </CardContent>
          </Card>

          <Card className="glass-strong border-gold-soft print:border-black">
            <CardHeader><CardTitle className="text-base print:text-black">💸 تفصيل المصروفات</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm"><span>🎁 مكافآت</span><span className="font-bold">{fmt(data.expenses.bonuses)} د.ع</span></div>
              <div className="flex justify-between text-sm"><span>💰 رواتب</span><span className="font-bold">{fmt(data.expenses.salaries)} د.ع</span></div>
              <div className="flex justify-between text-sm"><span>💳 أقساط سلف</span><span className="font-bold">{fmt(data.expenses.advances)} د.ع</span></div>
              <div className="border-t border-gold-soft pt-2 flex justify-between font-bold text-base"><span>الإجمالي</span><span className="text-red-400 print:text-black">{fmt(data.expenses.total)} د.ع</span></div>
            </CardContent>
          </Card>
        </div>

        {/* Breakdown chart (simple) */}
        {data.breakdown && data.breakdown.length > 0 && (
          <Card className="glass-strong border-gold-soft print:border-black">
            <CardHeader><CardTitle className="text-base print:text-black">📊 الإيرادات خلال الفترة</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-1 h-40 mt-2">
                {data.breakdown.map((b, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group" title={`${b.label}: ${fmt(b.revenue)} د.ع`}>
                    <div
                      className="w-full bg-gradient-to-t from-gold/60 to-gold rounded-t transition-all hover:opacity-80 print:bg-black"
                      style={{ height: `${(b.revenue / maxRev) * 100}%`, minHeight: b.revenue > 0 ? '4px' : '1px' }}
                    />
                    <span className="text-[8px] text-muted-foreground print:text-black -rotate-45 origin-left whitespace-nowrap">{b.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debtors */}
        {data.debts.topDebtors.length > 0 && (
          <Card className="glass-strong border-amber-500/30 print:border-black">
            <CardHeader><CardTitle className="text-base print:text-black">💸 أكبر المدينين</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold-soft text-right text-xs text-muted-foreground print:text-black">
                    <th className="p-2">#</th><th>الاسم</th><th>المنطقة</th><th>المبلغ المستحق</th>
                  </tr>
                </thead>
                <tbody>
                  {data.debts.topDebtors.map((d, i) => (
                    <tr key={d.id} className="border-b border-gold-soft/30 hover:bg-amber-500/5">
                      <td className="p-2 font-bold gold-text print:text-black">{i + 1}</td>
                      <td className="p-2 font-bold">{d.name}</td>
                      <td className="p-2 text-muted-foreground print:text-black">{d.zone || '-'}</td>
                      <td className="p-2 font-bold text-red-400 print:text-black">{fmt(d.amount)} د.ع</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <div className="hidden print:flex justify-between mt-8 text-xs">
          <div><p>توقيع المحاسب</p><div className="border-b border-black w-40 h-12 mt-2"></div></div>
          <div><p>توقيع المدير</p><div className="border-b border-black w-40 h-12 mt-2"></div></div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #accounting-print, #accounting-print * { visibility: visible; }
          #accounting-print { position: absolute; left: 0; top: 0; width: 100%; background: white !important; color: black !important; padding: 20px; }
          .glass-strong { background: white !important; border: 1px solid #d4af37 !important; }
        }
      `}</style>
    </div>
  );
}

// ============ ACTIVITY LOGS + SESSIONS PAGE ============
function ActivityLogsPage() {
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

export default function ProtectedApp() {
  return (
    <AdminLayoutClient>
      <App />
    </AdminLayoutClient>
  );
}
