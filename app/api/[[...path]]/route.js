import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { handleCoupons, handleCRM, handleSuppliers, handlePush, handleMobile } from '@/lib/api-handlers';

// Force Node.js runtime + dynamic rendering (required for Vercel serverless)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI || '';
const DB_NAME = process.env.DB_NAME || 'ghazlan_erp';
const EMERGENT_LLM_KEY = process.env.EMERGENT_LLM_KEY;

const SETTINGS_DEFAULTS = {
  general: {
    companyName: 'مركز الغزلان',
    companyNameEn: 'Ghazlan Center',
    logo: '🌟',
    address: 'بغداد - العراق',
    phone: '07901234567',
    email: 'info@ghazlan.iq',
    website: 'https://ghazlan.iq',
    currency: 'IQD',
    currencySymbol: 'د.ع',
    timezone: 'Asia/Baghdad',
    language: 'ar',
    fiscalYearStart: '01-01',
    branches: ['الفرع الرئيسي', 'فرع الكرادة', 'فرع المنصور'],
  },
  users: {
    requireApproval: true,
    allowSelfRegistration: false,
    defaultRole: 'cashier',
    roles: [
      { id: 'admin', name: 'مدير عام', permissions: ['all'] },
      { id: 'manager', name: 'مدير فرع', permissions: ['view_reports', 'manage_subscribers', 'manage_inventory'] },
      { id: 'cashier', name: 'كاشير', permissions: ['pos', 'view_inventory'] },
      { id: 'technician', name: 'فني', permissions: ['manage_repairs', 'manage_networks'] },
      { id: 'agent', name: 'وكيل', permissions: ['view_own_subscribers', 'activate'] },
    ],
  },
  agents: {
    defaultCommission: 20,
    allowSelfActivation: true,
    autoDisableOnDebt: true,
    maxDebt: 500000,
    portalUrl: '/agent',
    requireQRLogin: false,
    sessionTimeout: 30,
  },
  subscribers: {
    defaultPackage: '50 Mbps',
    defaultFee: 35000,
    gracePeriodDays: 3,
    autoSuspendOnExpiry: true,
    debtLimit: 100000,
    autoNotifyBeforeExpiry: 5,
    requireIMEI: false,
    autoGenerateUsername: true,
    usernamePattern: 'user_{phone4}',
  },
  zones: {
    defaultCapacity: 32,
    warningThreshold: 80,
    criticalThreshold: 95,
    autoStatusUpdate: true,
    monitoringInterval: 60,
    defaultMapProvider: 'osm',
  },
  invoices: {
    invoicePrefix: 'INV-',
    startingNumber: 1000,
    taxEnabled: false,
    taxRate: 0,
    debtAlertDays: 7,
    autoReminder: true,
    reminderChannels: ['whatsapp'],
    footerNote: 'شكراً لتعاملكم معنا',
  },
  packages: {
    defaultDurationDays: 30,
    allowCustomDuration: true,
    enabledPaymentMethods: ['cash', 'master', 'fastpay', 'transfer'],
    defaultProfitShare: 20,
    proRateOnUpgrade: true,
    requireFullPayment: false,
  },
  pos: {
    // Discount controls
    allowDiscount: true,
    maxDiscountAmount: 50000,        // 0 = unlimited
    maxDiscountPercent: 30,          // 0 = unlimited (% of subtotal)
    requireDiscountReason: true,
    // Increase/surcharge controls
    allowIncrease: true,
    maxIncreaseAmount: 50000,
    maxIncreasePercent: 20,
    requireIncreaseReason: true,
    // Permissions
    discountAllowedRoles: ['admin', 'manager', 'cashier'],   // role names allowed to apply discount
    increaseAllowedRoles: ['admin', 'manager', 'cashier'],
    // Manager approval for over-limit
    requireManagerApprovalAboveLimit: true,
  },
  whatsapp: {
    enabled: false,
    provider: 'cloud',
    apiToken: '',
    phoneNumberId: '',
    senderName: 'مركز الغزلان',
    activationTemplate: 'auto',
    expiryTemplate: 'auto',
    debtTemplate: 'auto',
    sendToManager: true,
    managerPhone: '07901234567',
  },
  telegram: {
    enabled: false,
    botToken: '',
    managerChatId: '',
    channelId: '',
    sendActivations: true,
    sendAlerts: true,
    sendDailyReport: true,
    reportTime: '20:00',
  },
  notifications: {
    activation: { whatsapp: true, telegram: true, email: false, sms: false, push: true },
    expiry: { whatsapp: true, telegram: false, email: false, sms: false, push: true },
    debt: { whatsapp: true, telegram: true, email: false, sms: false, push: true },
    lowStock: { whatsapp: false, telegram: true, email: true, sms: false, push: true },
    networkAlert: { whatsapp: false, telegram: true, email: false, sms: false, push: true },
    newSubscriber: { whatsapp: false, telegram: true, email: false, sms: false, push: false },
    notifyEmployeesWhatsApp: true,
    notifyEmployeesTelegram: true,
  },
  maps: {
    provider: 'osm',
    defaultLat: 33.3060,
    defaultLng: 44.4180,
    defaultZoom: 12,
    googleApiKey: '',
    showZones: true,
    showNetworks: true,
    showSubscribers: false,
    clusterMarkers: true,
  },
  printing: {
    paperSize: '80mm',
    receiptHeader: 'مركز الغزلان\nبغداد - العراق\n07901234567',
    receiptFooter: 'شكراً لزيارتكم 🙏\nصالح لمدة 7 أيام للاسترداد',
    showLogo: true,
    showBarcode: true,
    showQR: true,
    copies: 1,
    autoOpenCashDrawer: false,
  },
  backup: {
    enabled: true,
    schedule: 'daily',
    time: '03:00',
    retentionDays: 30,
    location: 'local',
    cloudProvider: '',
    encrypt: true,
    lastBackup: null,
  },
  security: {
    sessionTimeoutMinutes: 60,
    passwordMinLength: 6,
    requireStrongPassword: false,
    twoFAEnabled: false,
    maxLoginAttempts: 5,
    lockoutMinutes: 15,
    ipWhitelist: [],
    auditLogEnabled: true,
    forceLogoutOnPasswordChange: true,
  },
  reports: {
    defaultPeriod: 'monthly',
    emailReportsToManager: false,
    scheduleReports: false,
    reportTime: '08:00',
    includeCharts: true,
    exportFormats: ['pdf', 'excel'],
    keepReportsDays: 365,
  },
  employees: {
    workStart: '08:00',
    workEnd: '17:00',
    workDays: ['sun', 'mon', 'tue', 'wed', 'thu'],
    overtimeRate: 1.5,
    gpsTrackingEnabled: false,
    requireFingerprint: false,
    requireFaceRecognition: false,
    autoAssignTasks: false,
    kpiTarget: 80,
    lateGraceMinutes: 10,
    lateDeductionAmount: 25000,
    lateDeductionMode: 'fixed', // 'fixed' or 'per_minute'
    lateDeductionPerMinute: 500,
    absentDeductionAmount: 50000,
    autoCalculatePayroll: true,
    autoDeductionEnabled: true,
    yearlyLeaveAllowance: 24,
  },
};

// ============ TIMEZONE HELPERS (Asia/Baghdad) ============
// 🌍 IMPORTANT: Vercel servers run in UTC. We MUST compute dates/times in Baghdad
// timezone for attendance to work correctly. These helpers are timezone-safe.
const APP_TZ = process.env.APP_TIMEZONE || 'Asia/Baghdad';

function getTzParts(d = new Date(), tz = APP_TZ) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const out = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') out[p.type] = p.value;
  }
  if (out.hour === '24') out.hour = '00';
  return out;
}

// "YYYY-MM-DD" for the current date in APP_TZ (correct around midnight)
function getLocalDateString(d = new Date()) {
  const p = getTzParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

// "HH:MM" 24h for the current time in APP_TZ
function getLocalHM(d = new Date()) {
  const p = getTzParts(d);
  return `${p.hour}:${p.minute}`;
}

// Total minutes since 00:00 in APP_TZ (e.g., 8:15 → 495)
function getLocalMinutes(d = new Date()) {
  const p = getTzParts(d);
  return parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10);
}

// Parse "HH:MM" or "H:MM" → minutes since midnight
function shiftToMinutes(shift) {
  const m = String(shift || '08:00').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 8 * 60;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

// ============ MONGO CONNECTION (Serverless-Safe / Vercel-Ready) ============
// Use globalThis cache to survive across hot-reloads + serverless function reuses.
// Returns null on failure instead of throwing → endpoints handle gracefully.
const __globalAny = globalThis;
if (!__globalAny.__mongoState) {
  __globalAny.__mongoState = { client: null, promise: null, seeded: false, lastError: null };
}

async function connectMongo() {
  if (!MONGO_URL) {
    __globalAny.__mongoState.lastError = 'MONGO_URL is not set';
    return null;
  }
  if (__globalAny.__mongoState.client) return __globalAny.__mongoState.client;
  if (__globalAny.__mongoState.promise) return __globalAny.__mongoState.promise;

  const opts = {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 30000,
    maxPoolSize: 10,
    minPoolSize: 0,
    retryWrites: true,
  };
  __globalAny.__mongoState.promise = (async () => {
    try {
      const client = new MongoClient(MONGO_URL, opts);
      await client.connect();
      __globalAny.__mongoState.client = client;
      __globalAny.__mongoState.lastError = null;
      return client;
    } catch (e) {
      console.error('[Mongo] connection failed:', e?.message);
      __globalAny.__mongoState.lastError = e?.message || 'connect failed';
      __globalAny.__mongoState.promise = null;
      return null;
    }
  })();
  return __globalAny.__mongoState.promise;
}

async function getDb() {
  try {
    const client = await connectMongo();
    if (!client) return null;
    const db = client.db(DB_NAME);
    // Run seed only ONCE per process (lazy + fire-and-forget; never blocks request)
    if (!__globalAny.__mongoState.seeded) {
      __globalAny.__mongoState.seeded = true;
      // Don't await — let it run in the background to avoid cold-start timeouts on Vercel
      seedDefaults(db).catch((e) => console.warn('[Mongo] seed warn:', e?.message));
      // ============ Start auto-backup scheduler (runs once per process) ============
      try { startBackupScheduler(getDb); } catch (e) { console.warn('[backup] scheduler start failed:', e?.message); }
    }
    return db;
  } catch (e) {
    console.error('[Mongo] getDb error:', e?.message);
    return null;
  }
}

async function seedDefaults(db) {
  // 🛡️ ONE-TIME SEED GUARD: Once seeded, NEVER re-seed (even if user deletes everything)
  // This prevents the "deleted items come back" bug on Vercel cold starts.
  try {
    const seedFlag = await db.collection('_system').findOne({ _id: 'seed_status' });
    if (seedFlag?.seeded) {
      // Already seeded before — only run safe backfills (existing-doc updates), never inserts
      return seedBackfillOnly(db);
    }
  } catch {}

  const productsCount = await db.collection('products').countDocuments();
  if (productsCount === 0) {
    await db.collection('products').insertMany([
      { id: uuidv4(), name: 'iPhone 15 Pro Max', sku: 'IP15PM', barcode: '1000001', category: 'phones', price: 1850000, cost: 1700000, stock: 12, lowStockAlert: 3, image: '📱', createdAt: new Date().toISOString() },
      { id: uuidv4(), name: 'Samsung S24 Ultra', sku: 'SS24U', barcode: '1000002', category: 'phones', price: 1650000, cost: 1500000, stock: 8, lowStockAlert: 3, image: '📱', createdAt: new Date().toISOString() },
      { id: uuidv4(), name: 'AirPods Pro 2', sku: 'APP2', barcode: '1000003', category: 'accessories', price: 320000, cost: 280000, stock: 25, lowStockAlert: 5, image: '🎧', createdAt: new Date().toISOString() },
      { id: uuidv4(), name: 'كيبل USB-C', sku: 'USBC1', barcode: '1000004', category: 'accessories', price: 8000, cost: 5000, stock: 150, lowStockAlert: 20, image: '🔌', createdAt: new Date().toISOString() },
      { id: uuidv4(), name: 'شاشة iPhone 14', sku: 'SCRIP14', barcode: '1000005', category: 'spare_parts', price: 95000, cost: 75000, stock: 18, lowStockAlert: 5, image: '📺', createdAt: new Date().toISOString() },
      { id: uuidv4(), name: 'بطارية Samsung A52', sku: 'BATS52', barcode: '1000006', category: 'spare_parts', price: 35000, cost: 22000, stock: 30, lowStockAlert: 10, image: '🔋', createdAt: new Date().toISOString() },
      { id: uuidv4(), name: 'كاميرا Hikvision 4MP', sku: 'HIK4MP', barcode: '1000007', category: 'cameras', price: 180000, cost: 140000, stock: 15, lowStockAlert: 3, image: '📹', createdAt: new Date().toISOString() },
      { id: uuidv4(), name: 'NVR 8 Channel', sku: 'NVR8', barcode: '1000008', category: 'cameras', price: 450000, cost: 380000, stock: 6, lowStockAlert: 2, image: '🖥️', createdAt: new Date().toISOString() },
    ]);
  }

  const zonesCount = await db.collection('zones').countDocuments();
  if (zonesCount === 0) {
    await db.collection('zones').insertMany([
      { id: uuidv4(), number: 'Z-001', name: 'زون الكرادة المركزي', location: 'بغداد - الكرادة', lat: 33.3060, lng: 44.4180, status: 'online', subscribers: 0, fats: 4, utilization: 65, createdAt: new Date().toISOString() },
      { id: uuidv4(), number: 'Z-002', name: 'زون المنصور', location: 'بغداد - المنصور', lat: 33.3152, lng: 44.3661, status: 'online', subscribers: 0, fats: 6, utilization: 78, createdAt: new Date().toISOString() },
      { id: uuidv4(), number: 'Z-003', name: 'زون الجادرية', location: 'بغداد - الجادرية', lat: 33.2750, lng: 44.3850, status: 'warning', subscribers: 0, fats: 3, utilization: 91, createdAt: new Date().toISOString() },
      { id: uuidv4(), number: 'Z-004', name: 'زون الدورة', location: 'بغداد - الدورة', lat: 33.2466, lng: 44.4060, status: 'offline', subscribers: 0, fats: 2, utilization: 0, createdAt: new Date().toISOString() },
    ]);
  } else {
    // Backfill: ensure existing zones have a 'number' field
    const allZones = await db.collection('zones').find({}).toArray();
    let i = 1;
    for (const z of allZones) {
      if (!z.number) {
        await db.collection('zones').updateOne({ id: z.id }, { $set: { number: `Z-${String(i).padStart(3, '0')}` } });
      }
      i++;
    }
  }

  const subsCount = await db.collection('subscribers').countDocuments();
  if (subsCount === 0) {
    const zones = await db.collection('zones').find({}).toArray();
    const samples = [
      { name: 'محمد علي حسين', phone: '07901234567', package: '50 Mbps', fee: 35000 },
      { name: 'أحمد كريم عباس', phone: '07712345678', package: '100 Mbps', fee: 50000 },
      { name: 'فاطمة عبدالله', phone: '07801122334', package: '25 Mbps', fee: 25000 },
      { name: 'حسن جاسم', phone: '07905566778', package: '50 Mbps', fee: 35000 },
      { name: 'زينب محمود', phone: '07712233445', package: '100 Mbps', fee: 50000 },
      { name: 'علي ناصر', phone: '07801928374', package: '200 Mbps', fee: 75000 },
      { name: 'سارة خالد', phone: '07906655443', package: '50 Mbps', fee: 35000 },
      { name: 'مصطفى رحيم', phone: '07712348765', package: '25 Mbps', fee: 25000 },
    ];
    await db.collection('subscribers').insertMany(samples.map((s, i) => ({
      id: uuidv4(),
      ...s,
      zoneId: zones[i % zones.length].id,
      zoneName: zones[i % zones.length].name,
      zoneNumber: zones[i % zones.length].number || `Z-${String((i % zones.length) + 1).padStart(3, '0')}`,
      fatNumber: `F-${String((i % zones.length) + 1).padStart(2, '0')}-${String((i % 4) + 1).padStart(2, '0')}`,
      address: `${zones[i % zones.length].location} - شارع ${i + 1}`,
      ipAddress: `10.10.${i + 1}.${100 + i}`,
      macAddress: `AA:BB:CC:${(10 + i).toString(16).toUpperCase()}:${(20 + i).toString(16).toUpperCase()}:${(30 + i).toString(16).toUpperCase()}`,
      status: i % 7 === 0 ? 'suspended' : 'active',
      debt: i % 4 === 0 ? 35000 : 0,
      dueDate: new Date(Date.now() + (i * 86400000)).toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    })));
    for (const z of zones) {
      const count = await db.collection('subscribers').countDocuments({ zoneId: z.id });
      await db.collection('zones').updateOne({ id: z.id }, { $set: { subscribers: count } });
    }
  } else {
    // Backfill: ensure subscribers have zoneNumber & fatNumber
    const allSubs = await db.collection('subscribers').find({}).toArray();
    const allZones = await db.collection('zones').find({}).toArray();
    const zoneById = Object.fromEntries(allZones.map(z => [z.id, z]));
    let i = 0;
    for (const s of allSubs) {
      const updates = {};
      if (!s.zoneNumber && s.zoneId && zoneById[s.zoneId]) {
        updates.zoneNumber = zoneById[s.zoneId].number || `Z-${String((i % 4) + 1).padStart(3, '0')}`;
      }
      if (!s.fatNumber) {
        updates.fatNumber = `F-${String((i % 4) + 1).padStart(2, '0')}-${String((i % 4) + 1).padStart(2, '0')}`;
      }
      if (Object.keys(updates).length > 0) {
        await db.collection('subscribers').updateOne({ id: s.id }, { $set: updates });
      }
      i++;
    }
  }

  const empCount = await db.collection('employees').countDocuments();
  if (empCount === 0) {
    const PERM_ALL = ['sales','pos','subscribers','employees','tasks','reports','repairs','isp','agents','finance','settings'];
    await db.collection('employees').insertMany([
      { id: uuidv4(), employeeId: 'EMP-001', name: 'كرار الغزلان', username: 'karar', password: 'admin123', role: 'مدير عام', phone: '07901111111', salary: 1500000, kpi: 95, attendance: 'present', photo: '👨‍💼', shiftStart: '08:00', shiftEnd: '17:00', permissions: PERM_ALL, status: 'active', createdAt: new Date().toISOString() },
      { id: uuidv4(), employeeId: 'EMP-002', name: 'حيدر الموسوي', username: 'haidar', password: 'tech123', role: 'فني شبكات أول', phone: '07902222222', salary: 800000, kpi: 88, attendance: 'present', photo: '👨‍🔧', shiftStart: '08:00', shiftEnd: '17:00', permissions: ['isp','repairs','tasks'], status: 'active', createdAt: new Date().toISOString() },
      { id: uuidv4(), employeeId: 'EMP-003', name: 'علي السوداني', username: 'ali', password: 'repair123', role: 'فني صيانة هواتف', phone: '07903333333', salary: 700000, kpi: 92, attendance: 'present', photo: '🛠️', shiftStart: '09:00', shiftEnd: '18:00', permissions: ['repairs','tasks'], status: 'active', createdAt: new Date().toISOString() },
      { id: uuidv4(), employeeId: 'EMP-004', name: 'زهراء حسين', username: 'zahra', password: 'cash123', role: 'كاشير', phone: '07904444444', salary: 600000, kpi: 85, attendance: 'late', photo: '💁‍♀️', shiftStart: '08:00', shiftEnd: '16:00', permissions: ['pos','sales','tasks'], status: 'active', createdAt: new Date().toISOString() },
      { id: uuidv4(), employeeId: 'EMP-005', name: 'مصطفى الجبوري', username: 'mustafa', password: 'cam123', role: 'فني كاميرات', phone: '07905555555', salary: 750000, kpi: 78, attendance: 'absent', photo: '📹', shiftStart: '09:00', shiftEnd: '18:00', permissions: ['repairs','tasks'], status: 'active', createdAt: new Date().toISOString() },
    ]);
  } else {
    // Backfill new fields for existing employees
    const allEmps = await db.collection('employees').find({}).toArray();
    let i = 1;
    for (const e of allEmps) {
      const updates = {};
      if (!e.employeeId) updates.employeeId = `EMP-${String(i).padStart(3, '0')}`;
      if (!e.username) updates.username = (e.name || 'emp').toLowerCase().replace(/[^a-z]/g, '').slice(0, 8) || `emp${i}`;
      if (!e.password) updates.password = 'pass123';
      if (!e.photo) updates.photo = '👤';
      if (!e.shiftStart) updates.shiftStart = '08:00';
      if (!e.shiftEnd) updates.shiftEnd = '17:00';
      if (!e.permissions) updates.permissions = ['tasks'];
      if (!e.status) updates.status = 'active';
      if (Object.keys(updates).length > 0) await db.collection('employees').updateOne({ id: e.id }, { $set: updates });
      i++;
    }
  }

  // Seed sample tasks
  const tasksCount = await db.collection('tasks').countDocuments();
  if (tasksCount === 0) {
    const emps = await db.collection('employees').find({}).toArray();
    if (emps.length >= 2) {
      await db.collection('tasks').insertMany([
        { id: uuidv4(), title: 'صيانة فاتة الكرادة F-01-03', description: 'فحص الكابل وإعادة الاتصال', priority: 'high', dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), assignedTo: emps[1].id, assignedToName: emps[1].name, status: 'in_progress', progress: 60, notes: '', attachments: [], createdBy: emps[0].name, createdById: emps[0].id, acceptedAt: new Date(Date.now() - 3600000).toISOString(), createdAt: new Date(Date.now() - 86400000).toISOString() },
        { id: uuidv4(), title: 'تركيب كاميرا مطعم الذهبي', description: '8 كاميرات + NVR', priority: 'medium', dueDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10), assignedTo: emps[2].id, assignedToName: emps[2].name, status: 'pending', progress: 0, notes: '', attachments: [], createdBy: emps[0].name, createdById: emps[0].id, createdAt: new Date().toISOString() },
        { id: uuidv4(), title: 'جرد المخزون الأسبوعي', description: 'جرد كل الإكسسوارات', priority: 'low', dueDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10), assignedTo: emps.length > 3 ? emps[3].id : emps[1].id, assignedToName: emps.length > 3 ? emps[3].name : emps[1].name, status: 'pending', progress: 0, notes: '', attachments: [], createdBy: emps[0].name, createdById: emps[0].id, createdAt: new Date().toISOString() },
      ]);
    }
  }

  const repairsCount = await db.collection('repairs').countDocuments();
  if (repairsCount === 0) {
    await db.collection('repairs').insertMany([
      { id: uuidv4(), ticketNumber: 'RP-1001', customerName: 'حسين علي', phone: '07901234567', device: 'iPhone 13', imei: '356789012345678', issue: 'شاشة مكسورة', technician: 'علي السوداني', status: 'in_progress', cost: 85000, partsCost: 65000, receivedAt: new Date(Date.now() - 86400000 * 2).toISOString(), createdAt: new Date().toISOString() },
      { id: uuidv4(), ticketNumber: 'RP-1002', customerName: 'محمد كريم', phone: '07712345678', device: 'Samsung A52', imei: '352145678901234', issue: 'بطارية تالفة', technician: 'علي السوداني', status: 'completed', cost: 45000, partsCost: 22000, receivedAt: new Date(Date.now() - 86400000 * 5).toISOString(), createdAt: new Date().toISOString() },
      { id: uuidv4(), ticketNumber: 'RP-1003', customerName: 'فاطمة جواد', phone: '07801122334', device: 'iPhone 12', imei: '358901234567890', issue: 'لا يشحن', technician: 'علي السوداني', status: 'pending', cost: 25000, partsCost: 0, receivedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
    ]);
  }

  const camContracts = await db.collection('camera_contracts').countDocuments();
  if (camContracts === 0) {
    await db.collection('camera_contracts').insertMany([
      { id: uuidv4(), client: 'مطعم الشواء الذهبي', location: 'الكرادة', cameras: 8, type: 'تركيب + صيانة', value: 2400000, status: 'active', startDate: new Date(Date.now() - 86400000 * 30).toISOString().slice(0, 10), createdAt: new Date().toISOString() },
      { id: uuidv4(), client: 'مكتب المحامي عباس', location: 'المنصور', cameras: 4, type: 'تركيب', value: 850000, status: 'active', startDate: new Date(Date.now() - 86400000 * 60).toISOString().slice(0, 10), createdAt: new Date().toISOString() },
      { id: uuidv4(), client: 'محل ذهب الزين', location: 'الجادرية', cameras: 12, type: 'تركيب + صيانة سنوية', value: 4200000, status: 'pending', startDate: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString() },
    ]);
  }

  // ============ PACKAGES ============
  const pkgCount = await db.collection('packages').countDocuments();
  if (pkgCount === 0) {
    await db.collection('packages').insertMany([
      { id: uuidv4(), name: 'باقة ذهبية 25', speed: '25 Mbps', monthlyFee: 25000, durationDays: 30, profitShare: 20, active: true, createdAt: new Date().toISOString() },
      { id: uuidv4(), name: 'باقة فضية 50', speed: '50 Mbps', monthlyFee: 35000, durationDays: 30, profitShare: 22, active: true, createdAt: new Date().toISOString() },
      { id: uuidv4(), name: 'باقة بلاتينية 100', speed: '100 Mbps', monthlyFee: 50000, durationDays: 30, profitShare: 25, active: true, createdAt: new Date().toISOString() },
      { id: uuidv4(), name: 'باقة VIP 200', speed: '200 Mbps', monthlyFee: 75000, durationDays: 30, profitShare: 30, active: true, createdAt: new Date().toISOString() },
      { id: uuidv4(), name: 'باقة فايبر 500', speed: '500 Mbps', monthlyFee: 150000, durationDays: 30, profitShare: 35, active: true, createdAt: new Date().toISOString() },
    ]);
  }

  // ============ AGENTS (الوكلاء) ============
  const agentsCount = await db.collection('agents').countDocuments();
  if (agentsCount === 0) {
    await db.collection('agents').insertMany([
      { id: uuidv4(), name: 'وكيل الكرادة', username: 'karada', password: 'karada123', phone: '07901111000', branch: 'الكرادة', commission: 20, balance: 0, totalActivations: 0, totalProfit: 0, status: 'active', createdAt: new Date().toISOString() },
      { id: uuidv4(), name: 'وكيل المنصور', username: 'mansour', password: 'mansour123', phone: '07902222000', branch: 'المنصور', commission: 22, balance: 0, totalActivations: 0, totalProfit: 0, status: 'active', createdAt: new Date().toISOString() },
      { id: uuidv4(), name: 'وكيل الجادرية', username: 'jadriya', password: 'jadriya123', phone: '07903333000', branch: 'الجادرية', commission: 18, balance: 0, totalActivations: 0, totalProfit: 0, status: 'active', createdAt: new Date().toISOString() },
    ]);
  }

  // ============ NETWORKS / FATs (الشبكات والفاتات) ============
  const netCount = await db.collection('networks').countDocuments();
  if (netCount === 0) {
    const zones = await db.collection('zones').find({}).toArray();
    const networks = [];
    let counter = 1;
    for (const z of zones) {
      for (let f = 1; f <= (z.fats || 2); f++) {
        networks.push({
          id: uuidv4(),
          number: `F-${String(counter).padStart(2, '0')}-${String(f).padStart(2, '0')}`,
          name: `فاتة ${f} - ${z.name}`,
          zoneId: z.id,
          zoneName: z.name,
          zoneNumber: z.number,
          capacity: 32,
          subscribers: 0,
          status: z.status === 'offline' ? 'stopped' : (z.status === 'warning' ? 'weak' : 'active'),
          lat: (z.lat || 33.3) + (Math.random() - 0.5) * 0.02,
          lng: (z.lng || 44.4) + (Math.random() - 0.5) * 0.02,
          utilization: Math.floor(Math.random() * 80) + 10,
          installedAt: new Date(Date.now() - 86400000 * Math.floor(Math.random() * 200)).toISOString(),
          createdAt: new Date().toISOString(),
        });
      }
      counter++;
    }
    if (networks.length > 0) await db.collection('networks').insertMany(networks);
  }

  // ============ SETTINGS Initialize ============
  const settingsDoc = await db.collection('settings').findOne({ id: 'system' });
  if (!settingsDoc) {
    await db.collection('settings').insertOne({
      id: 'system',
      ...SETTINGS_DEFAULTS,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Backfill subscribers with: agentId, networkId, username, userLat/Lng, cabinetLat/Lng
  const subsToBackfill = await db.collection('subscribers').find({ $or: [{ agentId: { $exists: false } }, { username: { $exists: false } }] }).toArray();
  if (subsToBackfill.length > 0) {
    const agents = await db.collection('agents').find({}).toArray();
    const networks = await db.collection('networks').find({}).toArray();
    let i = 0;
    for (const s of subsToBackfill) {
      const updates = {};
      const zoneNetworks = networks.filter(n => n.zoneId === s.zoneId);
      const net = zoneNetworks[i % Math.max(1, zoneNetworks.length)];
      if (!s.username) updates.username = `user_${(s.phone || '').slice(-4) || (i + 1).toString().padStart(4, '0')}`;
      if (!s.agentId && agents.length > 0) {
        const a = agents[i % agents.length];
        updates.agentId = a.id; updates.agentName = a.name;
      }
      if (!s.networkId && net) {
        updates.networkId = net.id; updates.fatNumber = net.number;
      }
      if (!s.userLat) updates.userLat = 33.31 + (Math.random() - 0.5) * 0.05;
      if (!s.userLng) updates.userLng = 44.4 + (Math.random() - 0.5) * 0.05;
      if (!s.cabinetLat && net) updates.cabinetLat = net.lat;
      if (!s.cabinetLng && net) updates.cabinetLng = net.lng;
      if (Object.keys(updates).length > 0) {
        await db.collection('subscribers').updateOne({ id: s.id }, { $set: updates });
      }
      i++;
    }
    // Update network subscriber counts
    const allNets = await db.collection('networks').find({}).toArray();
    for (const n of allNets) {
      const c = await db.collection('subscribers').countDocuments({ networkId: n.id });
      await db.collection('networks').updateOne({ id: n.id }, { $set: { subscribers: c } });
    }
  }

  // ✅ MARK AS SEEDED — never re-seed even if user deletes all data
  // This is the FIX for "deleted items come back" bug on Vercel cold starts.
  try {
    await db.collection('_system').updateOne(
      { _id: 'seed_status' },
      { $set: { seeded: true, seededAt: new Date().toISOString() } },
      { upsert: true }
    );
    console.log('[seed] ✅ Initial seed complete — marked as seeded');
  } catch (e) {
    console.warn('[seed] Failed to set flag:', e?.message);
  }
}

// 🔄 Safe backfill (runs every cold start, but never inserts new demo data)
// Only updates EXISTING documents that are missing required fields.
async function seedBackfillOnly(db) {
  try {
    // 1) Ensure employees have required fields (username, password, permissions, photo, shifts)
    const allEmps = await db.collection('employees').find({}).toArray();
    let i = 1;
    for (const e of allEmps) {
      const updates = {};
      if (!e.employeeId) updates.employeeId = `EMP-${String(i).padStart(3, '0')}`;
      if (!e.username) updates.username = (e.name || 'emp').toLowerCase().replace(/[^a-z]/g, '').slice(0, 8) || `emp${i}`;
      if (!e.password) updates.password = 'pass123';
      if (!e.photo) updates.photo = '👤';
      if (!e.shiftStart) updates.shiftStart = '08:00';
      if (!e.shiftEnd) updates.shiftEnd = '17:00';
      if (!e.permissions) updates.permissions = ['tasks'];
      if (!e.status) updates.status = 'active';
      if (Object.keys(updates).length > 0) await db.collection('employees').updateOne({ id: e.id }, { $set: updates });
      i++;
    }

    // 2) Ensure subscribers have zoneNumber & fatNumber (no new inserts!)
    const allSubs = await db.collection('subscribers').find({}).toArray();
    const allZones = await db.collection('zones').find({}).toArray();
    const zoneById = Object.fromEntries(allZones.map(z => [z.id, z]));
    let j = 0;
    for (const s of allSubs) {
      const updates = {};
      if (!s.zoneNumber && s.zoneId && zoneById[s.zoneId]) {
        updates.zoneNumber = zoneById[s.zoneId].number || `Z-${String((j % 4) + 1).padStart(3, '0')}`;
      }
      if (!s.fatNumber) {
        updates.fatNumber = `F-${String((j % 4) + 1).padStart(2, '0')}-${String((j % 4) + 1).padStart(2, '0')}`;
      }
      if (Object.keys(updates).length > 0) {
        await db.collection('subscribers').updateOne({ id: s.id }, { $set: updates });
      }
      j++;
    }

    // 3) Refresh zone subscriber counts (no inserts)
    const allZones2 = await db.collection('zones').find({}).toArray();
    for (const z of allZones2) {
      const count = await db.collection('subscribers').countDocuments({ zoneId: z.id });
      await db.collection('zones').updateOne({ id: z.id }, { $set: { subscribers: count } });
    }

    // 4) Refresh network subscriber counts (no inserts)
    const allNets = await db.collection('networks').find({}).toArray();
    for (const n of allNets) {
      const c = await db.collection('subscribers').countDocuments({ networkId: n.id });
      await db.collection('networks').updateOne({ id: n.id }, { $set: { subscribers: c } });
    }
  } catch (e) {
    console.warn('[backfill] error:', e?.message);
  }
}

function ok(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Allow-Headers': '*' },
  });
}
function err(message, status = 400) { return ok({ error: message }, status); }

export async function OPTIONS() { return ok({}); }

async function getJsonBody(request) { try { return await request.json(); } catch { return {}; } }

// ============ GLOBAL HELPERS ============
async function logActivity(db, { action, entity, entityId, user, userId, details, ip }) {
  try {
    await db.collection('activity_logs').insertOne({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action, entity, entityId, user: user || 'system', userId: userId || null,
      details: details || '', ip: ip || null,
      timestamp: new Date().toISOString(),
    });
  } catch (e) { console.error('logActivity failed', e); }
}

async function sendTelegram(db, text) {
  try {
    const s = await db.collection('settings').findOne({ id: 'system' });
    const tg = s?.telegram || {};
    if (!tg.enabled || !tg.botToken || !tg.managerChatId) return { ok: false, skipped: true };
    const r = await fetch(`https://api.telegram.org/bot${tg.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tg.managerChatId, text, parse_mode: 'HTML' }),
    });
    const d = await r.json();
    return { ok: d.ok === true, response: d };
  } catch (e) {
    console.error('Telegram error', e);
    return { ok: false, error: e.message };
  }
}

// ============ RECURRING TASKS HELPER ============
// Compute the next due date based on a recurrence rule.
// rec: { enabled, type: 'daily'|'weekly'|'monthly', interval: number }
function computeNextDueDate(prevDueDate, rec) {
  const baseStr = prevDueDate || new Date().toISOString().slice(0, 10);
  const base = new Date(baseStr + 'T00:00:00');
  const interval = Math.max(1, Number(rec.interval || 1));
  let next = new Date(base);
  if (rec.type === 'daily') {
    next.setDate(base.getDate() + interval);
  } else if (rec.type === 'weekly') {
    next.setDate(base.getDate() + 7 * interval);
  } else if (rec.type === 'monthly') {
    next.setMonth(base.getMonth() + interval);
  } else {
    next.setDate(base.getDate() + interval); // default: daily
  }
  return next.toISOString().slice(0, 10);
}

// Spawn the next instance of a recurring task when it's completed.
// Returns the new task doc, or null if not recurring or has reached endDate.
async function spawnRecurringIfNeeded(db, completedTask) {
  try {
    const rec = completedTask?.recurrence;
    if (!rec || !rec.enabled) return null;
    const nextDate = computeNextDueDate(completedTask.dueDate, rec);
    // Optional: respect endDate cutoff
    if (rec.endDate && nextDate > rec.endDate) return null;
    const now = new Date().toISOString();
    const newTask = {
      id: uuidv4(),
      // Carry forward all task content, but reset state
      title: completedTask.title,
      description: completedTask.description || '',
      priority: completedTask.priority || 'medium',
      taskType: completedTask.taskType || 'general',
      assignedTo: completedTask.assignedTo,
      assignedToName: completedTask.assignedToName,
      subscriberId: completedTask.subscriberId || null,
      subscriberName: completedTask.subscriberName || null,
      subscriberPhone: completedTask.subscriberPhone || null,
      subscriberAddress: completedTask.subscriberAddress || null,
      subscriberLat: completedTask.subscriberLat || null,
      subscriberLng: completedTask.subscriberLng || null,
      faultDescription: completedTask.faultDescription || null,
      attachments: [],
      notes: '',
      status: 'pending',
      progress: 0,
      dueDate: nextDate,
      // recurrence rules carried forward
      recurrence: rec,
      // link back to source
      spawnedFromTaskId: completedTask.id,
      spawnedAt: now,
      createdAt: now,
      createdBy: completedTask.createdBy || 'recurrence',
      createdById: completedTask.createdById || null,
    };
    await db.collection('tasks').insertOne({ ...newTask });
    delete newTask._id;
    // Notify the assignee
    if (newTask.assignedTo) {
      await notifyEmployee(db, {
        employeeId: newTask.assignedTo,
        type: 'task_new', icon: '🔁',
        title: '🔁 مهمة متكررة جديدة',
        message: `تم إنشاء "${newTask.title}" تلقائياً (مهمة دورية) - تاريخ التسليم: ${nextDate}`,
        entityType: 'task', entityId: newTask.id,
        priority: (newTask.priority === 'urgent' || newTask.priority === 'high') ? 'high' : 'normal',
      });
    }
    // Real-time event
    await db.collection('events').insertOne({
      id: uuidv4(), type: 'task_new',
      taskId: newTask.id, title: newTask.title,
      assignedTo: newTask.assignedTo, assignedToName: newTask.assignedToName,
      priority: newTask.priority, taskType: newTask.taskType,
      ts: now, isRecurringSpawn: true,
    });
    return newTask;
  } catch (e) {
    console.warn('[spawnRecurringIfNeeded] error:', e?.message);
    return null;
  }
}


async function notifyManager(db, { title, message, type, taskId, employeeId, entityType, entityId, priority, icon }) {
  // 1) In-app notification for all managers (employees with 'all' or 'employees' permission)
  const managers = await db.collection('employees').find({
    $or: [{ permissions: 'all' }, { role: { $regex: 'مدير' } }]
  }).toArray();
  const now = new Date().toISOString();
  // Resolve entity routing
  const _entityType = entityType
    || (type === 'leave_request' ? 'leave'
    : type === 'advance_request' ? 'advance'
    : type === 'task_submitted' || type?.startsWith('task_') ? 'task'
    : type === 'location_request_new' ? 'location_request'
    : 'generic');
  const _entityId = entityId || (type?.startsWith('task_') ? taskId : null);
  const _icon = icon || (type === 'leave_request' ? '📅' : type === 'advance_request' ? '💰' : type?.startsWith('task') ? '📋' : '🔔');
  const _priority = priority || (type === 'leave_request' || type === 'advance_request' ? 'high' : 'normal');
  // Fallback: if no managers exist, create a broadcast notification (userId=null)
  const recipients = managers.length > 0 ? managers : [{ id: null }];
  for (const m of recipients) {
    await db.collection('notifications').insertOne({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: m.id || null, type, title, message,
      icon: _icon, priority: _priority,
      entityType: _entityType, entityId: _entityId,
      taskId: taskId || null,
      employeeId: employeeId || null,
      read: false, resolved: false, resolvedAt: null, resolvedBy: null,
      createdAt: now,
    });
  }
  // 2) Telegram to manager
  await sendTelegram(db, `<b>${title}</b>\n${message}`);
}

// ============ NOTIFY EMPLOYEE (in-app + WhatsApp + Telegram) ============
async function notifyEmployee(db, { employeeId, type, title, message, entityType, entityId, priority, icon, taskId } = {}) {
  if (!employeeId) return null;
  // 1) In-app via createNotification
  const notif = await createNotification(db, {
    userId: employeeId,
    type: type || 'generic',
    title: title || '',
    message: message || '',
    entityType, entityId,
    priority: priority || 'normal',
    icon: icon || '🔔',
    extra: taskId ? { taskId } : {},
  });

  // 2) Lookup settings + employee for side-channels
  let settings, emp;
  try {
    settings = await db.collection('settings').findOne({ id: 'system' });
    emp = await db.collection('employees').findOne({ id: employeeId });
  } catch {}

  const wa = settings?.whatsapp || {};
  const tg = settings?.telegram || {};
  const ns = settings?.notifications || {};
  const sendWa = (wa.enabled !== false) && (ns.notifyEmployeesWhatsApp !== false); // default ON when wa configured
  const sendTg = (tg.enabled === true) && (ns.notifyEmployeesTelegram !== false);

  // 3) WhatsApp to employee
  if (sendWa && emp?.phone) {
    try {
      const text = `*${title}*\n\n${message}`;
      await dispatchWhatsApp(db, {
        phone: emp.phone, type: `emp_${type || 'notif'}`,
        message: text, employeeId: emp.id, employeeName: emp.name,
      });
    } catch (e) { console.warn('[notifyEmployee] WA fail:', e?.message); }
  }

  // 4) Telegram to employee chat (if linked) — fallback to manager chat NOT used to avoid spam
  if (sendTg && tg.botToken && emp?.telegramChatId) {
    try {
      await fetch(`https://api.telegram.org/bot${tg.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: emp.telegramChatId, text: `<b>${title}</b>\n${message}`, parse_mode: 'HTML' }),
      });
    } catch (e) { console.warn('[notifyEmployee] TG fail:', e?.message); }
  }

  return notif;
}

import { tgSend, tgEdit, tgAnswerCallback, buildHome, buildReports, buildEmployees, buildSubscribers, buildFinance, buildMaintenance, buildNetwork, buildMe, buildLogs, buildAdmin, ROLE_DEFAULT_PERMS, PERMS_ALL } from '@/lib/telegram-bot';
import bcrypt from 'bcryptjs';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { isConfigured as waIsConfigured, waStatus, waHealth, waQr, waConnect, waDisconnect, waSend, waSendBulk } from '@/lib/whatsapp-client';
import { runSync as runIspSync } from '@/lib/isp-sync';
import { runBackup as runBackupLib, listBackups as listBackupsLib, getBackupFile, deleteBackup as deleteBackupLib, startScheduler as startBackupScheduler } from '@/lib/backup';
import { createNotification, buildActionUrl } from '@/lib/notifications';

// ============ WHATSAPP TEMPLATES (with variable substitution) ============
const WA_DEFAULT_TEMPLATES = {
  activation: `🎉 *تم تفعيل اشتراكك بنجاح* 🎉

عزيزي *{name}*، تفاصيل اشتراكك:

👤 *اليوزر:* {username}
📦 *الباقة:* {package}
⚡ *السرعة:* {speed}
💰 *مبلغ الاشتراك:* {amount} د.ع
✅ *المبلغ الواصل:* {paid} د.ع
❌ *المبلغ المتبقي:* {remaining} د.ع
📅 *تاريخ التفعيل:* {startDate}
⏰ *تاريخ الانتهاء:* {endDate}
🧾 *رقم الوصل:* {receiptNo}
🏢 *المكتب/الوكيل:* {office}

شكراً لاختيارك *مركز الغزلان* 🌟
للاستفسار: {companyPhone}`,
  expiry: `⚠️ *انتهاء الاشتراك*

عزيزي *{name}*،
انتهى اشتراك الإنترنت الخاص بك في *{endDate}*.

📦 الباقة: {package}
💰 رسوم التجديد: {amount} د.ع

يرجى التواصل لتجديد اشتراكك:
📞 {companyPhone}

*مركز الغزلان* 🌟`,
  expiry_alert: `🔔 *تنبيه: قارب اشتراكك على الانتهاء*

عزيزي *{name}*،
سينتهي اشتراك الإنترنت الخاص بك بعد *{daysLeft}* يوم/أيام.

📅 تاريخ الانتهاء: {endDate}
📦 الباقة: {package}
💰 رسوم التجديد: {amount} د.ع

للتجديد المبكر: 📞 {companyPhone}
*مركز الغزلان* 🌟`,
  debt: `💸 *تذكير بمستحقات مالية*

عزيزي *{name}*،
لديك مبلغ غير مدفوع مقابل خدمة الإنترنت:

💰 *مبلغ الدين:* {debt} د.ع
📅 تاريخ آخر فاتورة: {endDate}

يرجى التسديد في أقرب وقت لتجنب إيقاف الخدمة.
📞 {companyPhone}

*مركز الغزلان*`,
  receipt: `🧾 *وصل اشتراك*

السيد/ة *{name}*،
رقم الوصل: *{receiptNo}*

📦 الباقة: {package}
⚡ السرعة: {speed}
💰 المبلغ الإجمالي: {amount} د.ع
✅ المدفوع: {paid} د.ع
❌ المتبقي: {remaining} د.ع
📅 التفعيل: {startDate}
⏰ الانتهاء: {endDate}
🏢 المكتب: {office}

شكراً لاختياركم *مركز الغزلان*`,
  generic: `مرحباً *{name}*،

{message}

*مركز الغزلان*`,
};

const fillWaTemplate = (tpl, vars) => {
  if (!tpl) return '';
  return String(tpl).replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    if (v === undefined || v === null) return '';
    if (typeof v === 'number') return v.toLocaleString();
    return String(v);
  });
};

const buildSubscriberVars = async (db, sub, extra = {}) => {
  const settings = (await db.collection('settings').findOne({})) || {};
  const general = settings?.general || SETTINGS_DEFAULTS.general;
  return {
    name: sub?.name || '',
    username: sub?.username || '',
    phone: sub?.phone || '',
    package: sub?.package || extra.packageName || '',
    speed: sub?.speed || extra.speed || '',
    amount: sub?.fee || extra.amount || 0,
    paid: extra.paid ?? 0,
    remaining: extra.remaining ?? 0,
    debt: sub?.debt || 0,
    endDate: sub?.endDate ? new Date(sub.endDate).toLocaleDateString('ar-IQ') : (extra.endDate || ''),
    startDate: extra.startDate || (sub?.startDate ? new Date(sub.startDate).toLocaleDateString('ar-IQ') : ''),
    daysLeft: extra.daysLeft ?? '',
    receiptNo: extra.receiptNo || '',
    office: extra.office || sub?.agentName || general.companyName || '',
    companyName: general.companyName || 'مركز الغزلان',
    companyPhone: general.phone || '07901234567',
    address: general.address || '',
    message: extra.message || '',
    ...extra,
  };
};

// Persist message + send to service. Returns { success, messageRecord, serviceResp }
async function dispatchWhatsApp(db, { subscriberId, subscriberName, phone, type, message, ...meta }) {
  const id = uuidv4();
  const rec = {
    id,
    subscriberId: subscriberId || null,
    subscriberName: subscriberName || null,
    phone: phone || '',
    type: type || 'generic',
    message: String(message || ''),
    status: 'queued',
    retries: 0,
    createdAt: new Date().toISOString(),
    ...meta,
  };
  await db.collection('whatsapp_messages').insertOne({ ...rec });

  if (!waIsConfigured() || !phone || phone === 'MANAGER') {
    await db.collection('whatsapp_messages').updateOne({ id }, { $set: { status: 'queued', note: 'service_not_configured_or_no_phone' } });
    return { success: false, queued: true, message: rec };
  }
  try {
    const resp = await waSend(phone, rec.message);
    const ok = !!resp?.ok;
    await db.collection('whatsapp_messages').updateOne({ id }, {
      $set: {
        status: ok ? 'sent' : 'failed',
        sentAt: ok ? new Date().toISOString() : null,
        externalId: resp?.id || null,
        error: ok ? null : (resp?.error || 'send_failed'),
      },
    });
    return { success: ok, message: { ...rec, status: ok ? 'sent' : 'failed' }, serviceResp: resp };
  } catch (e) {
    await db.collection('whatsapp_messages').updateOne({ id }, { $set: { status: 'failed', error: e?.message || 'exception' } });
    return { success: false, error: e?.message, message: rec };
  }
}

const isBcrypt = (s) => typeof s === 'string' && s.startsWith('$2');
const verifyPassword = async (plain, stored) => {
  if (!stored) return false;
  if (isBcrypt(stored)) return bcrypt.compare(plain, stored);
  return plain === stored; // legacy plaintext fallback
};
const hashPassword = async (plain) => bcrypt.hash(plain, 10);

// ============ AUTH HELPERS (Sessions, Devices, Brute Force) ============
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function parseUserAgent(ua) {
  if (!ua) return { device: 'غير معروف', browser: 'غير معروف', os: 'غير معروف' };
  let os = 'غير معروف', browser = 'غير معروف', device = 'كمبيوتر';
  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) { os = 'Android'; device = 'هاتف Android'; }
  else if (/iPhone|iPad|iPod/.test(ua)) { os = 'iOS'; device = /iPad/.test(ua) ? 'iPad' : 'iPhone'; }
  else if (/Linux/.test(ua)) os = 'Linux';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  return { device, browser, os };
}

async function createSession(db, user, req) {
  const token = uuidv4() + '-' + uuidv4().replace(/-/g, '');
  const ua = req.headers.get('user-agent') || '';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  const info = parseUserAgent(ua);
  const now = new Date().toISOString();
  const session = {
    id: uuidv4(),
    token,
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    ip,
    userAgent: ua,
    device: info.device,
    browser: info.browser,
    os: info.os,
    createdAt: now,
    lastSeen: now,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    revoked: false,
  };
  await db.collection('user_sessions').insertOne(session);
  return { token, session };
}

async function getSessionFromRequest(db, req) {
  if (!db) return null;
  const auth = req.headers.get('authorization') || '';
  let token = '';
  if (auth.toLowerCase().startsWith('bearer ')) token = auth.slice(7).trim();
  if (!token) {
    const cookie = req.headers.get('cookie') || '';
    const match = cookie.match(/(?:^|;\s*)gz_token=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }
  if (!token) return null;
  const s = await db.collection('user_sessions').findOne({ token, revoked: { $ne: true } });
  if (!s) return null;
  if (s.expiresAt && new Date(s.expiresAt) < new Date()) return null;
  // Update lastSeen (non-blocking)
  db.collection('user_sessions').updateOne({ id: s.id }, { $set: { lastSeen: new Date().toISOString() } }).catch(() => {});
  return s;
}

async function getCurrentUser(db, req) {
  const session = await getSessionFromRequest(db, req);
  if (!session) return null;
  const user = await db.collection('users').findOne({ id: session.userId });
  if (!user || user.active === false) return null;
  return { ...user, _session: session, password: undefined, passwordHash: undefined };
}

// Role hierarchy: super_admin > manager > hr/agent > employee
const ROLE_LEVEL = { super_admin: 100, manager: 80, hr: 60, agent: 50, employee: 30 };
function hasRoleAtLeast(userRole, minRole) {
  return (ROLE_LEVEL[userRole] || 0) >= (ROLE_LEVEL[minRole] || 0);
}

// Ensure default super_admin exists (seed on first call)
// 🔄 Self-healing: idempotent — auto-runs on every cold start (Vercel friendly)
async function ensureSuperAdminSeeded(db) {
  if (!db) return { seeded: [], errors: ['no_db'] };
  const seeded = [];
  const errors = [];
  try {
    // 1) Ensure 'superadmin' user exists in users collection
    const superExisting = await db.collection('users').findOne({ username: 'superadmin' });
    if (!superExisting) {
      const passwordHash = await hashPassword('SuperAdmin@2026');
      await db.collection('users').insertOne({
        id: uuidv4(),
        username: 'superadmin',
        name: 'المدير العام',
        email: 'admin@ghazlan.iq',
        phone: '',
        avatar: '/logo-icon.png',
        role: 'super_admin',
        permissions: ['*'],
        passwordHash,
        active: true,
        twoFactorEnabled: false,
        mustChangePassword: false,
        lastLoginAt: null,
        lastLoginIp: null,
        lastLoginDevice: null,
        createdAt: new Date().toISOString(),
        createdBy: 'system_seed',
      });
      seeded.push('users:superadmin');
      console.log('[auth-seed] ✅ Created superadmin/SuperAdmin@2026');
    }

    // 2) Ensure 'admin' user exists in users collection (matches /admin/login page)
    const adminExisting = await db.collection('users').findOne({ username: 'admin' });
    if (!adminExisting) {
      const passwordHash = await hashPassword('admin1982');
      await db.collection('users').insertOne({
        id: uuidv4(),
        username: 'admin',
        name: 'المدير',
        email: 'admin@ghazlan.iq',
        phone: '',
        avatar: '/logo-icon.png',
        role: 'super_admin',
        permissions: ['*'],
        passwordHash,
        active: true,
        twoFactorEnabled: false,
        mustChangePassword: false,
        lastLoginAt: null,
        lastLoginIp: null,
        lastLoginDevice: null,
        createdAt: new Date().toISOString(),
        createdBy: 'system_seed',
      });
      seeded.push('users:admin');
      console.log('[auth-seed] ✅ Created admin/admin1982');
    }

    // 3) Ensure legacy admin password is set in settings (for /api/admin/login)
    const s = await db.collection('settings').findOne({});
    if (!s?.security?.adminPasswordHash) {
      const passwordHash = await hashPassword('admin1982');
      await db.collection('settings').updateOne(
        {},
        { $set: {
            'security.adminUsername': 'admin',
            'security.adminPasswordHash': passwordHash,
            updatedAt: new Date().toISOString(),
        }},
        { upsert: true }
      );
      seeded.push('settings:adminPasswordHash');
      console.log('[auth-seed] ✅ Set legacy admin password in settings');
    }

    // 4) Ensure admin employee exists in employees collection (for /employee portal)
    const empExisting = await db.collection('employees').findOne({ username: 'admin' });
    if (!empExisting) {
      const passwordHash = await hashPassword('admin1982');
      await db.collection('employees').insertOne({
        id: uuidv4(),
        username: 'admin',
        password: passwordHash,
        passwordHash,
        name: 'المدير',
        phone: '',
        role: 'مدير',
        salary: 0,
        kpi: 100,
        photo: '👑',
        shiftStart: '08:00',
        shiftEnd: '17:00',
        permissions: ['tasks','repairs','agents','reports','isp','employees','subscribers','sales','pos','crm','suppliers','accounting','settings'],
        status: 'active',
        active: true,
        attendance: 'present',
        createdAt: new Date().toISOString(),
        createdBy: 'system_seed',
      });
      seeded.push('employees:admin');
      console.log('[auth-seed] ✅ Created employee admin/admin1982');
    }
  } catch (e) {
    errors.push(String(e?.message || e));
    console.error('[auth-seed] ❌ Error:', e?.message);
  }
  return { seeded, errors };
}

async function handle(request, params) {
  const path = (params?.path || []).join('/');
  const method = request.method;
  const db = await getDb();
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';

  if (!path) return ok({ name: 'Ghazlan ERP API', version: '1.0', status: 'running', dbConnected: !!db });

  // ============ 🛑 DB CONNECTION GUARD ============
  // If MongoDB is not connected, return a clear, actionable Arabic message
  // for ALL endpoints (except /setup which has its own diagnostic logic).
  if (!db && path !== 'setup') {
    const isAuthPath = path.includes('login') || path.includes('auth');
    const hasMongoUrl = !!process.env.MONGO_URL;
    return new Response(JSON.stringify({
      error: hasMongoUrl
        ? '⚠️ فشل الاتصال بقاعدة البيانات — تحقق من صحة MONGO_URL وأن IP 0.0.0.0/0 مسموح في MongoDB Atlas'
        : '⚠️ قاعدة البيانات غير معدّة بعد — يجب إضافة MONGO_URL في Vercel Environment Variables ثم Redeploy',
      _dbNotConnected: true,
      _mongoUrlSet: hasMongoUrl,
      _docs: 'افتح /api/setup للتشخيص الكامل، أو اقرأ VERCEL_DEPLOYMENT_FIX.md',
      _setupUrl: '/api/setup',
      ...(isAuthPath && { _hint: 'لا يمكن تسجيل الدخول بدون قاعدة بيانات. اتبع خطوات إعداد MongoDB Atlas أولاً.' }),
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ============ 🔧 SETUP & HEALTH DIAGNOSTICS (Vercel-ready) ============

  // POST /api/setup/test-connection — try a MONGO_URL without saving it. Returns precise error.
  // This works even when db is null (no global DB), since it creates its own connection.
  if (path === 'setup/test-connection' && method === 'POST') {
    try {
      const body = await request.json().catch(() => ({}));
      const mongoUrl = String(body.mongoUrl || '').trim();
      if (!mongoUrl) return ok({ success: false, message: '❌ الرجاء إدخال MONGO_URL' });

      // Mask password for safe echo
      const masked = mongoUrl.replace(/:([^:@/]+)@/, ':****@');

      // Validate format basics
      const validations = {
        startsWithMongo: mongoUrl.startsWith('mongodb://') || mongoUrl.startsWith('mongodb+srv://'),
        isAtlas: mongoUrl.startsWith('mongodb+srv://'),
        hasUser: /:\/\/([^:@]+):/.test(mongoUrl),
        hasPassword: /:\/\/[^:@]+:([^@]+)@/.test(mongoUrl),
        containsAngleBrackets: mongoUrl.includes('<') || mongoUrl.includes('>'),
        passwordIsLiteralPlaceholder: /:<(db_)?password>/i.test(mongoUrl),
      };

      // Critical: <db_password> not replaced
      if (validations.passwordIsLiteralPlaceholder) {
        return ok({
          success: false,
          masked,
          validations,
          errorType: 'PLACEHOLDER_NOT_REPLACED',
          message: '❌ كلمة السر لم تُستبدل! يحتوي الرابط على <db_password> الحرفي.\n\nالحل: استبدل <db_password> بكلمة السر الفعلية من MongoDB Atlas.',
        });
      }
      if (validations.containsAngleBrackets) {
        return ok({
          success: false,
          masked,
          validations,
          errorType: 'CONTAINS_PLACEHOLDERS',
          message: '⚠️ الرابط يحتوي على < أو > — قد تكون متبقية من template MongoDB. أزلها واستبدلها بالقيم الفعلية.',
        });
      }
      if (!validations.startsWithMongo) {
        return ok({
          success: false,
          masked,
          validations,
          errorType: 'INVALID_FORMAT',
          message: '❌ صيغة الرابط خاطئة — يجب أن يبدأ بـ mongodb:// أو mongodb+srv://',
        });
      }

      // Try actual connection (with short timeout for Vercel-friendly response)
      const testClient = new MongoClient(mongoUrl, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
        socketTimeoutMS: 8000,
        maxPoolSize: 1,
      });
      try {
        const startTs = Date.now();
        await testClient.connect();
        const elapsed = Date.now() - startTs;
        // List databases to fully verify access
        const admin = testClient.db().admin();
        const dbsList = await admin.listDatabases().catch(() => null);
        await testClient.close();
        return ok({
          success: true,
          masked,
          validations,
          connectionTimeMs: elapsed,
          databases: dbsList?.databases?.map(d => d.name) || [],
          message: `✅ نجح الاتصال! استغرق ${elapsed}ms. يمكنك الآن إضافة MONGO_URL في Vercel.`,
        });
      } catch (e) {
        await testClient.close().catch(() => {});
        const errMsg = String(e?.message || e);
        const lo = errMsg.toLowerCase();
        let hint = errMsg;
        let errorType = 'CONNECTION_FAILED';
        if (lo.includes('authentication failed') || lo.includes('bad auth')) {
          errorType = 'WRONG_PASSWORD';
          hint = '❌ **كلمة سر MongoDB خاطئة!**\n\n• تحقق من كلمة السر في MongoDB Atlas → Database Access\n• تأكد أن special characters مُرمّزة (مثال: # يصبح %23، @ يصبح %40)\n• جرّب إنشاء user جديد بكلمة سر بسيطة بدون رموز خاصة';
        } else if (lo.includes('whitelist') || lo.includes('ip not in') || lo.includes('not allowed')) {
          errorType = 'IP_NOT_WHITELISTED';
          hint = '❌ **عنوان IP غير مسموح!**\n\nحل: MongoDB Atlas → Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)';
        } else if (lo.includes('enotfound') || lo.includes('getaddrinfo')) {
          errorType = 'CLUSTER_NOT_FOUND';
          hint = '❌ **اسم الـ Cluster خاطئ!**\n\nتأكد من نسخ الـ Connection String كاملاً من MongoDB Atlas → Connect → Drivers';
        } else if (lo.includes('timeout') || lo.includes('timed out')) {
          errorType = 'TIMEOUT';
          hint = '⏱️ **انتهت مهلة الاتصال**\n\nأكثر سبب شائع: عنوان IP غير مسموح في MongoDB Atlas → Network Access. أضف 0.0.0.0/0 الآن.';
        } else if (lo.includes('ssl') || lo.includes('tls')) {
          errorType = 'SSL_ERROR';
          hint = '🔐 **مشكلة SSL/TLS**\n\nتأكد من استخدام mongodb+srv:// (وليس mongodb://) لـ Atlas';
        } else if (lo.includes('mongoparseerror') || lo.includes('invalid')) {
          errorType = 'PARSE_ERROR';
          hint = '❌ **صيغة الرابط خاطئة** — قد تحتوي على special characters غير مُرمّزة في كلمة السر.\n\nمثال: إذا كلمة السر فيها @ # / : ? فيجب ترميزها (URL encoding).';
        }
        return ok({
          success: false,
          masked,
          validations,
          errorType,
          rawError: errMsg.substring(0, 500),
          message: hint,
        });
      }
    } catch (e) {
      return ok({ success: false, message: 'خطأ غير متوقع: ' + (e?.message || ''), errorType: 'UNEXPECTED' });
    }
  }

  // GET /api/setup — runs auto-seed and reports state. Hit this once after deploying.
  if (path === 'setup' && (method === 'GET' || method === 'POST')) {
    const checks = {
      timestamp: new Date().toISOString(),
      env: {
        MONGO_URL_set: !!process.env.MONGO_URL,
        MONGO_URL_type: process.env.MONGO_URL?.startsWith('mongodb+srv://') ? 'atlas' :
                        process.env.MONGO_URL?.includes('localhost') ? 'localhost' :
                        process.env.MONGO_URL ? 'custom' : 'missing',
        DB_NAME_set: !!process.env.DB_NAME,
        DB_NAME: process.env.DB_NAME || '(default: ghazlan_erp)',
        NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || '(not set)',
        EMERGENT_LLM_KEY_set: !!process.env.EMERGENT_LLM_KEY,
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: !!process.env.VERCEL,
        VERCEL_URL: process.env.VERCEL_URL || null,
      },
      database: { connected: !!db },
      seed: null,
      collections: {},
      auth_test: {},
    };
    if (!db) {
      // Surface the actual MongoDB driver error message to help user debug
      const lastError = globalThis.__mongoState?.lastError;
      checks.database.lastError = lastError || 'no error captured';
      // Detect common issues by error keywords
      let hint = '⚠️ Database connection failed. Check MONGO_URL.';
      if (lastError) {
        const lo = String(lastError).toLowerCase();
        if (lo.includes('authentication failed') || lo.includes('bad auth')) {
          hint = '❌ كلمة سر MongoDB خاطئة — تأكد من استبدال <db_password> في الـ Connection String بكلمة السر الفعلية';
        } else if (lo.includes('whitelist') || lo.includes('not allowed') || lo.includes('ip')) {
          hint = '❌ عنوان IP الخاص بـ Vercel غير مسموح — أضف 0.0.0.0/0 في MongoDB Atlas → Network Access';
        } else if (lo.includes('enotfound') || lo.includes('getaddrinfo')) {
          hint = '❌ اسم الـ Cluster خاطئ — تأكد من نسخ الـ Connection String كاملاً وصحيحاً';
        } else if (lo.includes('timeout') || lo.includes('timed out')) {
          hint = '❌ انتهت مهلة الاتصال — تأكد من إضافة 0.0.0.0/0 في Network Access على MongoDB Atlas';
        } else if (lo.includes('ssl') || lo.includes('tls')) {
          hint = '❌ مشكلة SSL/TLS — تأكد من استخدام mongodb+srv:// (وليس mongodb://) في MONGO_URL';
        } else if (lo.includes('mongodb_url') || lo.includes('not set')) {
          hint = '❌ MONGO_URL غير مضافة في Vercel Environment Variables';
        }
      }
      checks.database.hint = hint;
      checks.error = lastError ? `${hint}\n\nالخطأ التقني: ${lastError}` : hint;
      return ok(checks);
    }
    // Run seed
    try {
      checks.seed = await ensureSuperAdminSeeded(db);
    } catch (e) {
      checks.seed = { errors: [String(e?.message || e)] };
    }
    // Collection counts
    try {
      checks.collections = {
        users: await db.collection('users').countDocuments({}),
        employees: await db.collection('employees').countDocuments({}),
        subscribers: await db.collection('subscribers').countDocuments({}),
        settings: await db.collection('settings').countDocuments({}),
      };
    } catch (e) { checks.collections.error = String(e?.message || e); }
    // Verify admin login works
    try {
      const adminUser = await db.collection('users').findOne({ username: 'admin' });
      if (adminUser?.passwordHash) {
        const ok1 = await verifyPassword('admin1982', adminUser.passwordHash);
        checks.auth_test['users.admin/admin1982'] = ok1 ? '✅ works' : '❌ password mismatch';
      } else {
        checks.auth_test['users.admin/admin1982'] = '❌ user not found';
      }
      const empUser = await db.collection('employees').findOne({ username: 'admin' });
      if (empUser?.passwordHash || empUser?.password) {
        const hash = empUser.passwordHash || empUser.password;
        const ok2 = await verifyPassword('admin1982', hash);
        checks.auth_test['employees.admin/admin1982'] = ok2 ? '✅ works' : '❌ password mismatch';
      } else {
        checks.auth_test['employees.admin/admin1982'] = '❌ user not found';
      }
      const s = await db.collection('settings').findOne({});
      if (s?.security?.adminPasswordHash) {
        const ok3 = await verifyPassword('admin1982', s.security.adminPasswordHash);
        checks.auth_test['settings.adminPasswordHash'] = ok3 ? '✅ works' : '❌ password mismatch';
      } else {
        checks.auth_test['settings.adminPasswordHash'] = '❌ not configured';
      }
    } catch (e) { checks.auth_test.error = String(e?.message || e); }

    // Clear any account locks (for fresh deployments)
    try { await db.collection('login_attempts').deleteMany({ success: false }); checks.cleared_failed_logins = true; } catch {}

    checks.status = (checks.seed?.errors?.length || 0) === 0 ? '✅ Ready' : '⚠️ Errors';
    checks.next_steps = [
      'Login at /admin/login with admin / admin1982',
      'Or use legacy admin login at / with same credentials',
      'Or login at /employee with admin / admin1982',
    ];
    return ok(checks);
  }

  // Seed default super_admin (idempotent — only runs first time)
  if (db) { ensureSuperAdminSeeded(db).catch(() => {}); }

  // ============ AUTH ENDPOINTS ============

  // POST /api/auth/login — username + password → session token
  if (path === 'auth/login' && method === 'POST') {
    const body = await getJsonBody(request);
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!username || !password) return err('اسم المستخدم وكلمة المرور مطلوبان', 400);

    // 🔄 SELF-HEALING: If admin/superadmin user is missing (first login on fresh deploy),
    // run the seeder synchronously to ensure default accounts exist before checking credentials.
    if (['admin', 'superadmin'].includes(username)) {
      const exists = await db.collection('users').findOne({ username });
      if (!exists) {
        console.log(`[auth] First-time login for ${username} — running seed...`);
        await ensureSuperAdminSeeded(db);
      }
    }

    // Brute force check: count failed attempts in last 15 minutes from this IP+username
    const since = new Date(Date.now() - LOCK_WINDOW_MS).toISOString();
    const fails = await db.collection('login_attempts').countDocuments({
      username, ip: clientIp, success: false, ts: { $gte: since },
    });
    if (fails >= MAX_FAILED_ATTEMPTS) {
      return err(`تم قفل الحساب مؤقتاً بسبب محاولات فاشلة كثيرة. حاول بعد ${Math.ceil(LOCK_WINDOW_MS / 60000)} دقيقة`, 429);
    }

    const user = await db.collection('users').findOne({ username });
    const ua = request.headers.get('user-agent') || '';
    const info = parseUserAgent(ua);

    const recordAttempt = async (success, userId = null) => {
      await db.collection('login_attempts').insertOne({
        id: uuidv4(), username, userId, ip: clientIp, success,
        device: info.device, browser: info.browser, os: info.os,
        userAgent: ua, ts: new Date().toISOString(),
      });
    };

    if (!user) { await recordAttempt(false); return err('بيانات الدخول غير صحيحة', 401); }
    if (user.active === false) { await recordAttempt(false, user.id); return err('الحساب معطّل', 403); }
    const okPw = await verifyPassword(password, user.passwordHash || user.password);
    if (!okPw) { await recordAttempt(false, user.id); return err('بيانات الدخول غير صحيحة', 401); }

    // ===== 2FA check =====
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const code = String(body.code || body.twoFactorCode || '').replace(/\s+/g, '');
      const recoveryCode = String(body.recoveryCode || '').replace(/\s+/g, '').toUpperCase();
      if (!code && !recoveryCode) {
        // First step: request 2FA from client
        return ok({ requires2FA: true, message: 'يرجى إدخال رمز التحقق من تطبيق المصادقة' });
      }
      let twofaOk = false;
      if (code) {
        try {
          const totp = new OTPAuth.TOTP({
            issuer: 'مركز الغزلان', label: user.username,
            algorithm: 'SHA1', digits: 6, period: 30,
            secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret),
          });
          const delta = totp.validate({ token: code, window: 1 });
          twofaOk = delta !== null;
        } catch {}
      }
      if (!twofaOk && recoveryCode && Array.isArray(user.twoFactorRecoveryHashes)) {
        // Try each recovery hash
        for (let i = 0; i < user.twoFactorRecoveryHashes.length; i++) {
          const h = user.twoFactorRecoveryHashes[i];
          if (await verifyPassword(recoveryCode, h)) {
            twofaOk = true;
            // Burn the used code
            const remaining = user.twoFactorRecoveryHashes.filter((_, idx) => idx !== i);
            await db.collection('users').updateOne({ id: user.id }, { $set: { twoFactorRecoveryHashes: remaining } });
            await logActivity(db, { action: '2fa_recovery_used', entity: 'users', entityId: user.id, user: user.name, details: `استخدم رمز استعادة (متبقي ${remaining.length})`, ip: clientIp });
            break;
          }
        }
      }
      if (!twofaOk) { await recordAttempt(false, user.id); return err('رمز التحقق غير صحيح', 401); }
    }

    // Create session
    const { token, session } = await createSession(db, user, request);
    await recordAttempt(true, user.id);

    // Update user lastLogin
    await db.collection('users').updateOne({ id: user.id }, {
      $set: {
        lastLoginAt: session.createdAt,
        lastLoginIp: session.ip,
        lastLoginDevice: `${info.browser} on ${info.os}`,
      },
    });

    // Notify managers about login (especially for super_admin and managers)
    if (['super_admin', 'manager'].includes(user.role)) {
      await notifyManager(db, {
        type: 'login_alert',
        title: `🔐 تسجيل دخول: ${user.name}`,
        message: `الدور: ${user.role}\nIP: ${session.ip}\nالجهاز: ${info.browser} على ${info.os}\nالنوع: ${info.device}\nالوقت: ${new Date().toLocaleString('ar-IQ')}`,
        entityType: 'generic', entityId: user.id,
        priority: 'normal',
      });
    }

    await logActivity(db, {
      action: 'user_login', entity: 'users', entityId: user.id,
      user: user.name, details: `تسجيل دخول من ${info.browser} على ${info.os} (${session.ip})`, ip: clientIp,
    });

    return ok({
      success: true,
      token,
      user: {
        id: user.id, username: user.username, name: user.name, email: user.email,
        avatar: user.avatar, role: user.role, permissions: user.permissions || [],
        mustChangePassword: !!user.mustChangePassword,
      },
      sessionId: session.id,
      expiresAt: session.expiresAt,
    });
  }

  // POST /api/auth/logout
  if (path === 'auth/logout' && method === 'POST') {
    const session = await getSessionFromRequest(db, request);
    if (session) {
      await db.collection('user_sessions').updateOne({ id: session.id }, {
        $set: { revoked: true, revokedAt: new Date().toISOString(), revokeReason: 'logout' },
      });
      await logActivity(db, {
        action: 'user_logout', entity: 'users', entityId: session.userId,
        user: session.name, details: `خروج`, ip: clientIp,
      });
    }
    return ok({ success: true });
  }

  // GET /api/auth/me — current user info
  if (path === 'auth/me' && method === 'GET') {
    const user = await getCurrentUser(db, request);
    if (!user) return err('غير مصرّح', 401);
    return ok({
      id: user.id, username: user.username, name: user.name, email: user.email, phone: user.phone,
      avatar: user.avatar, role: user.role, permissions: user.permissions || [],
      twoFactorEnabled: !!user.twoFactorEnabled,
      recoveryCodesRemaining: Array.isArray(user.twoFactorRecoveryHashes) ? user.twoFactorRecoveryHashes.length : 0,
      lastLoginAt: user.lastLoginAt, lastLoginIp: user.lastLoginIp, lastLoginDevice: user.lastLoginDevice,
      session: { id: user._session.id, device: user._session.device, browser: user._session.browser, os: user._session.os, createdAt: user._session.createdAt },
    });
  }

  // POST /api/auth/change-password
  if (path === 'auth/change-password' && method === 'POST') {
    const me = await getCurrentUser(db, request);
    if (!me) return err('غير مصرّح', 401);
    const body = await getJsonBody(request);
    const cur = String(body.currentPassword || '');
    const next = String(body.newPassword || '');
    if (next.length < 6) return err('كلمة المرور الجديدة قصيرة (6 أحرف على الأقل)', 400);
    const fresh = await db.collection('users').findOne({ id: me.id });
    const okPw = await verifyPassword(cur, fresh.passwordHash || fresh.password);
    if (!okPw) return err('كلمة المرور الحالية غير صحيحة', 401);
    await db.collection('users').updateOne({ id: me.id }, {
      $set: { passwordHash: await hashPassword(next), mustChangePassword: false, passwordChangedAt: new Date().toISOString() },
    });
    // Revoke all other sessions
    await db.collection('user_sessions').updateMany(
      { userId: me.id, id: { $ne: me._session.id } },
      { $set: { revoked: true, revokedAt: new Date().toISOString(), revokeReason: 'password_changed' } }
    );
    await logActivity(db, { action: 'password_changed', entity: 'users', entityId: me.id, user: me.name, details: 'غيّر كلمة المرور', ip: clientIp });
    return ok({ success: true });
  }

  // GET /api/auth/sessions — list my active sessions
  if (path === 'auth/sessions' && method === 'GET') {
    const me = await getCurrentUser(db, request);
    if (!me) return err('غير مصرّح', 401);
    const sessions = await db.collection('user_sessions').find({
      userId: me.id, revoked: { $ne: true },
    }).sort({ lastSeen: -1 }).limit(50).toArray();
    return ok(sessions.map(s => ({
      id: s.id, ip: s.ip, device: s.device, browser: s.browser, os: s.os,
      createdAt: s.createdAt, lastSeen: s.lastSeen, expiresAt: s.expiresAt,
      isCurrent: s.id === me._session.id,
    })));
  }

  // DELETE /api/auth/sessions/:id — revoke a specific session
  if (path.match(/^auth\/sessions\/[^/]+$/) && method === 'DELETE') {
    const me = await getCurrentUser(db, request);
    if (!me) return err('غير مصرّح', 401);
    const sid = path.split('/')[2];
    await db.collection('user_sessions').updateOne({ id: sid, userId: me.id }, {
      $set: { revoked: true, revokedAt: new Date().toISOString(), revokeReason: 'manual' },
    });
    return ok({ success: true });
  }

  // GET /api/auth/activity — login history for current user
  if (path === 'auth/activity' && method === 'GET') {
    const me = await getCurrentUser(db, request);
    if (!me) return err('غير مصرّح', 401);
    const attempts = await db.collection('login_attempts').find({ userId: me.id }).sort({ ts: -1 }).limit(50).toArray();
    return ok(attempts.map(a => { delete a._id; return a; }));
  }

  // ============ USERS CRUD (super_admin / manager only) ============

  // GET /api/users — list all users
  if (path === 'users' && method === 'GET') {
    const me = await getCurrentUser(db, request);
    if (!me) return err('غير مصرّح', 401);
    if (!hasRoleAtLeast(me.role, 'manager')) return err('صلاحياتك لا تسمح', 403);
    const items = await db.collection('users').find({}).sort({ createdAt: -1 }).toArray();
    return ok(items.map(u => {
      delete u._id; delete u.passwordHash; delete u.password;
      return u;
    }));
  }

  // POST /api/users — create new user
  if (path === 'users' && method === 'POST') {
    const me = await getCurrentUser(db, request);
    if (!me) return err('غير مصرّح', 401);
    if (!hasRoleAtLeast(me.role, 'manager')) return err('صلاحياتك لا تسمح', 403);
    const body = await getJsonBody(request);
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = String(body.role || 'employee');
    if (!username || !password) return err('اسم المستخدم وكلمة المرور مطلوبان', 400);
    if (password.length < 6) return err('كلمة المرور قصيرة (6 أحرف على الأقل)', 400);
    if (!['super_admin', 'manager', 'employee', 'hr', 'agent'].includes(role)) return err('الدور غير صالح', 400);
    // Only super_admin can create another super_admin
    if (role === 'super_admin' && me.role !== 'super_admin') return err('فقط المدير العام يمكنه إنشاء مدير عام آخر', 403);
    const exists = await db.collection('users').findOne({ username });
    if (exists) return err('اسم المستخدم مستخدم بالفعل', 409);
    const user = {
      id: uuidv4(),
      username,
      name: body.name || username,
      email: body.email || '',
      phone: body.phone || '',
      avatar: body.avatar || '',
      role,
      permissions: Array.isArray(body.permissions) ? body.permissions : (role === 'super_admin' ? ['*'] : []),
      passwordHash: await hashPassword(password),
      active: body.active !== false,
      mustChangePassword: !!body.mustChangePassword,
      twoFactorEnabled: false,
      lastLoginAt: null, lastLoginIp: null, lastLoginDevice: null,
      createdAt: new Date().toISOString(),
      createdBy: me.name,
    };
    await db.collection('users').insertOne(user);
    delete user._id; delete user.passwordHash;
    await logActivity(db, { action: 'user_created', entity: 'users', entityId: user.id, user: me.name, details: `أنشأ المستخدم ${user.name} (${role})`, ip: clientIp });
    return ok(user, 201);
  }

  // PUT /api/users/:id — update user
  if (path.match(/^users\/[^/]+$/) && method === 'PUT') {
    const me = await getCurrentUser(db, request);
    if (!me) return err('غير مصرّح', 401);
    if (!hasRoleAtLeast(me.role, 'manager')) return err('صلاحياتك لا تسمح', 403);
    const id = path.split('/')[1];
    const target = await db.collection('users').findOne({ id });
    if (!target) return err('المستخدم غير موجود', 404);
    const body = await getJsonBody(request);
    const update = {};
    ['name', 'email', 'phone', 'avatar'].forEach(k => { if (body[k] !== undefined) update[k] = body[k]; });
    if (body.role !== undefined && body.role !== target.role) {
      if (target.role === 'super_admin' && me.role !== 'super_admin') return err('لا يمكن تغيير دور مدير عام', 403);
      if (body.role === 'super_admin' && me.role !== 'super_admin') return err('فقط المدير العام يمكنه ترقية إلى مدير عام', 403);
      update.role = body.role;
    }
    if (Array.isArray(body.permissions)) update.permissions = body.permissions;
    if (typeof body.active === 'boolean') update.active = body.active;
    update.updatedAt = new Date().toISOString();
    update.updatedBy = me.name;
    await db.collection('users').updateOne({ id }, { $set: update });
    await logActivity(db, { action: 'user_updated', entity: 'users', entityId: id, user: me.name, details: `حدّث المستخدم ${target.name}`, ip: clientIp });
    return ok({ success: true });
  }

  // DELETE /api/users/:id
  if (path.match(/^users\/[^/]+$/) && method === 'DELETE') {
    const me = await getCurrentUser(db, request);
    if (!me) return err('غير مصرّح', 401);
    if (!hasRoleAtLeast(me.role, 'manager')) return err('صلاحياتك لا تسمح', 403);
    const id = path.split('/')[1];
    const target = await db.collection('users').findOne({ id });
    if (!target) return err('المستخدم غير موجود', 404);
    if (target.role === 'super_admin') {
      const count = await db.collection('users').countDocuments({ role: 'super_admin', active: true });
      if (count <= 1) return err('لا يمكن حذف آخر مدير عام نشط', 400);
      if (me.role !== 'super_admin') return err('لا يمكن حذف مدير عام', 403);
    }
    if (target.id === me.id) return err('لا يمكنك حذف حسابك', 400);
    await db.collection('users').deleteOne({ id });
    await db.collection('user_sessions').updateMany({ userId: id }, { $set: { revoked: true, revokedAt: new Date().toISOString(), revokeReason: 'user_deleted' } });
    await logActivity(db, { action: 'user_deleted', entity: 'users', entityId: id, user: me.name, details: `حذف المستخدم ${target.name}`, ip: clientIp });
    return ok({ success: true });
  }

  // POST /api/users/:id/reset-password
  if (path.match(/^users\/[^/]+\/reset-password$/) && method === 'POST') {
    const me = await getCurrentUser(db, request);
    if (!me) return err('غير مصرّح', 401);
    if (!hasRoleAtLeast(me.role, 'manager')) return err('صلاحياتك لا تسمح', 403);
    const id = path.split('/')[1];
    const target = await db.collection('users').findOne({ id });
    if (!target) return err('المستخدم غير موجود', 404);
    const body = await getJsonBody(request);
    const next = String(body.newPassword || '');
    if (next.length < 6) return err('كلمة المرور قصيرة (6 أحرف على الأقل)', 400);
    await db.collection('users').updateOne({ id }, {
      $set: { passwordHash: await hashPassword(next), mustChangePassword: true, passwordChangedAt: new Date().toISOString() },
    });
    // Revoke all sessions to force re-login
    await db.collection('user_sessions').updateMany({ userId: id }, { $set: { revoked: true, revokedAt: new Date().toISOString(), revokeReason: 'password_reset' } });
    await logActivity(db, { action: 'user_password_reset', entity: 'users', entityId: id, user: me.name, details: `أعاد تعيين كلمة مرور ${target.name}`, ip: clientIp });
    return ok({ success: true });
  }

  // POST /api/users/:id/toggle-active
  if (path.match(/^users\/[^/]+\/toggle-active$/) && method === 'POST') {
    const me = await getCurrentUser(db, request);
    if (!me) return err('غير مصرّح', 401);
    if (!hasRoleAtLeast(me.role, 'manager')) return err('صلاحياتك لا تسمح', 403);
    const id = path.split('/')[1];
    const target = await db.collection('users').findOne({ id });
    if (!target) return err('المستخدم غير موجود', 404);
    if (target.id === me.id) return err('لا يمكنك تعطيل حسابك', 400);
    const newActive = !target.active;
    await db.collection('users').updateOne({ id }, { $set: { active: newActive, updatedAt: new Date().toISOString() } });
    if (!newActive) {
      await db.collection('user_sessions').updateMany({ userId: id }, { $set: { revoked: true, revokedAt: new Date().toISOString(), revokeReason: 'deactivated' } });
    }
    await logActivity(db, { action: newActive ? 'user_activated' : 'user_deactivated', entity: 'users', entityId: id, user: me.name, details: `${newActive ? 'فعّل' : 'عطّل'} حساب ${target.name}`, ip: clientIp });
    return ok({ success: true, active: newActive });
  }

  // GET /api/users/:id/sessions
  if (path.match(/^users\/[^/]+\/sessions$/) && method === 'GET') {
    const me = await getCurrentUser(db, request);
    if (!me) return err('غير مصرّح', 401);
    if (!hasRoleAtLeast(me.role, 'manager')) return err('صلاحياتك لا تسمح', 403);
    const id = path.split('/')[1];
    const sessions = await db.collection('user_sessions').find({ userId: id }).sort({ createdAt: -1 }).limit(50).toArray();
    return ok(sessions.map(s => { delete s._id; delete s.token; return s; }));
  }

  // GET /api/users/:id/login-history
  if (path.match(/^users\/[^/]+\/login-history$/) && method === 'GET') {
    const me = await getCurrentUser(db, request);
    if (!me) return err('غير مصرّح', 401);
    if (!hasRoleAtLeast(me.role, 'manager')) return err('صلاحياتك لا تسمح', 403);
    const id = path.split('/')[1];
    const attempts = await db.collection('login_attempts').find({ userId: id }).sort({ ts: -1 }).limit(100).toArray();
    return ok(attempts.map(a => { delete a._id; return a; }));
  }

  // ============ TWO-FACTOR AUTHENTICATION (TOTP) ============

  // POST /api/auth/2fa/setup — generates secret + QR code (requires auth)
  if (path === 'auth/2fa/setup' && method === 'POST') {
    const me = await getCurrentUser(db, request);
    if (!me) return err('غير مصرّح', 401);
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: 'مركز الغزلان', label: me.username,
      algorithm: 'SHA1', digits: 6, period: 30, secret,
    });
    const otpauth = totp.toString();
    const qrDataUrl = await QRCode.toDataURL(otpauth, { width: 240, margin: 1, color: { dark: '#0f0f19', light: '#ffffff' } });
    // Save secret (base32) as pending (not enabled until verified)
    await db.collection('users').updateOne({ id: me.id }, {
      $set: { twoFactorSecretPending: secret.base32, twoFactorPendingAt: new Date().toISOString() },
    });
    return ok({ secret: secret.base32, qrDataUrl, otpauth });
  }

  // POST /api/auth/2fa/verify — verifies the code and ENABLES 2FA
  if (path === 'auth/2fa/verify' && method === 'POST') {
    const me = await getCurrentUser(db, request);
    if (!me) return err('غير مصرّح', 401);
    const body = await getJsonBody(request);
    const code = String(body.code || '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(code)) return err('الرمز يجب أن يكون 6 أرقام', 400);
    const fresh = await db.collection('users').findOne({ id: me.id });
    const secretB32 = fresh?.twoFactorSecretPending;
    if (!secretB32) return err('لم تبدأ إعداد 2FA. ابدأ من جديد.', 400);
    const totp = new OTPAuth.TOTP({
      issuer: 'مركز الغزلان', label: me.username,
      algorithm: 'SHA1', digits: 6, period: 30,
      secret: OTPAuth.Secret.fromBase32(secretB32),
    });
    const delta = totp.validate({ token: code, window: 1 });
    const isValid = delta !== null;
    if (!isValid) return err('الرمز غير صحيح. تحقق من الوقت في تطبيق المصادقة.', 401);
    // Generate 10 backup recovery codes (one-time use)
    const recoveryCodes = Array.from({ length: 10 }, () => uuidv4().slice(0, 8).toUpperCase());
    const recoveryHashes = await Promise.all(recoveryCodes.map(c => hashPassword(c)));
    await db.collection('users').updateOne({ id: me.id }, {
      $set: {
        twoFactorSecret: secretB32,
        twoFactorEnabled: true,
        twoFactorEnabledAt: new Date().toISOString(),
        twoFactorRecoveryHashes: recoveryHashes,
      },
      $unset: { twoFactorSecretPending: '', twoFactorPendingAt: '' },
    });
    await logActivity(db, { action: '2fa_enabled', entity: 'users', entityId: me.id, user: me.name, details: 'فعّل المصادقة الثنائية', ip: clientIp });
    return ok({ success: true, recoveryCodes });
  }

  // POST /api/auth/2fa/disable — disable 2FA (requires current password)
  if (path === 'auth/2fa/disable' && method === 'POST') {
    const me = await getCurrentUser(db, request);
    if (!me) return err('غير مصرّح', 401);
    const body = await getJsonBody(request);
    const pw = String(body.password || '');
    const fresh = await db.collection('users').findOne({ id: me.id });
    const okPw = await verifyPassword(pw, fresh.passwordHash || fresh.password);
    if (!okPw) return err('كلمة المرور غير صحيحة', 401);
    await db.collection('users').updateOne({ id: me.id }, {
      $set: { twoFactorEnabled: false, twoFactorDisabledAt: new Date().toISOString() },
      $unset: { twoFactorSecret: '', twoFactorSecretPending: '', twoFactorRecoveryHashes: '' },
    });
    await logActivity(db, { action: '2fa_disabled', entity: 'users', entityId: me.id, user: me.name, details: 'عطّل المصادقة الثنائية', ip: clientIp });
    return ok({ success: true });
  }

  // POST /api/auth/2fa/regenerate-recovery — generate new recovery codes
  if (path === 'auth/2fa/regenerate-recovery' && method === 'POST') {
    const me = await getCurrentUser(db, request);
    if (!me) return err('غير مصرّح', 401);
    const fresh = await db.collection('users').findOne({ id: me.id });
    if (!fresh?.twoFactorEnabled) return err('المصادقة الثنائية غير مفعّلة', 400);
    const recoveryCodes = Array.from({ length: 10 }, () => uuidv4().slice(0, 8).toUpperCase());
    const recoveryHashes = await Promise.all(recoveryCodes.map(c => hashPassword(c)));
    await db.collection('users').updateOne({ id: me.id }, { $set: { twoFactorRecoveryHashes: recoveryHashes } });
    return ok({ recoveryCodes });
  }
  // ============ END AUTH/USERS ============

  // Health check (always safe — never depends on DB)
  if (path === 'health' || path === 'healthz') {
    return ok({ status: 'ok', dbConnected: !!db, dbError: __globalAny.__mongoState?.lastError || null, ts: new Date().toISOString() });
  }

  // ============ SAFE FALLBACKS WHEN DB IS UNREACHABLE ============
  // For read endpoints we surface a 200 with safe-shaped fallback data so the UI doesn't crash.
  // For write endpoints we return 503.
  if (!db) {
    const errMsg = __globalAny.__mongoState?.lastError || 'Database unavailable';
    console.warn(`[API] DB unavailable for ${method} /${path} — returning fallback (${errMsg})`);
    if (method !== 'GET') {
      return ok({ error: 'Database temporarily unavailable. Please try again.', dbError: errMsg }, 503);
    }
    // GET endpoint fallbacks (safe shapes — never undefined)
    if (path === 'dashboard/stats') {
      return ok({
        totalProducts: 0, totalSubscribers: 0, activeSubscribers: 0, totalRepairs: 0, pendingRepairs: 0,
        totalEmployees: 0, totalZones: 0, onlineZones: 0, totalRevenue: 0, monthlyIncome: 0,
        totalDebt: 0, lowStockCount: 0, lowStock: [], salesChart: [], _offline: true,
      });
    }
    if (path === 'ai/insights') return ok({ insights: [] });
    if (path === 'notifications/admin') return ok([]);
    if (path === 'noc/dashboard') return ok({ zones: [], alerts: [] });
    // Generic safe fallbacks
    return ok({ data: [], items: [], _offline: true, error: errMsg }, 200);
  }

  // ============ WHATSAPP (whatsapp-web.js service integration) ============
  // Status of the WhatsApp microservice (connection state, phone, errors)
  if (path === 'whatsapp/status' && method === 'GET') {
    try {
      const health = await waHealth();
      const status = await waStatus();
      return ok({
        configured: waIsConfigured(),
        serviceUp: !!health?.ok,
        ...status,
        sessionExists: !!health?.sessionExists,
      });
    } catch (e) {
      return ok({ configured: waIsConfigured(), serviceUp: false, status: 'disconnected', error: e?.message });
    }
  }
  if (path === 'whatsapp/qr' && method === 'GET') {
    const r = await waQr();
    if (!r?.ok) return ok({ qrDataUrl: null, error: r?.error || 'no_qr', status: r?.status || 'unknown' });
    return ok({ qrDataUrl: r.qrDataUrl, qr: r.qr, lastQrAt: r.lastQrAt, status: r.status });
  }
  if (path === 'whatsapp/connect' && method === 'POST') {
    const r = await waConnect();
    await logActivity(db, { action: 'whatsapp_connect', entity: 'whatsapp', details: 'بدء جلسة واتساب', ip: clientIp });
    return ok(r);
  }
  if (path === 'whatsapp/disconnect' && method === 'POST') {
    const body = await getJsonBody(request);
    const r = await waDisconnect(!!body?.wipe);
    await logActivity(db, { action: 'whatsapp_disconnect', entity: 'whatsapp', details: `قطع واتساب${body?.wipe ? ' + مسح الجلسة' : ''}`, ip: clientIp });
    return ok(r);
  }

  // List templates (defaults merged with user overrides)
  if (path === 'whatsapp/templates' && method === 'GET') {
    const settings = (await db.collection('settings').findOne({})) || {};
    const userTpls = settings?.whatsappTemplates || {};
    const merged = { ...WA_DEFAULT_TEMPLATES, ...userTpls };
    return ok({ templates: merged, defaults: WA_DEFAULT_TEMPLATES });
  }
  // Save templates (PUT { templates: { key: text } })
  if (path === 'whatsapp/templates' && method === 'PUT') {
    const body = await getJsonBody(request);
    if (!body?.templates || typeof body.templates !== 'object') return err('templates object required', 400);
    await db.collection('settings').updateOne({}, { $set: { whatsappTemplates: body.templates, updatedAt: new Date().toISOString() } }, { upsert: true });
    return ok({ success: true });
  }

  // Send single message to a subscriber (or arbitrary phone)
  // body: { subscriberId?, phone?, templateKey?, message?, vars?: {} }
  if (path === 'whatsapp/send' && method === 'POST') {
    const body = await getJsonBody(request);
    let { subscriberId, phone, templateKey, message, vars } = body || {};
    let subscriber = null;
    if (subscriberId) {
      subscriber = await db.collection('subscribers').findOne({ id: subscriberId });
      if (!subscriber) return err('المشترك غير موجود', 404);
      phone = phone || subscriber.phone;
    }
    if (!phone) return err('phone مطلوب', 400);

    // Resolve message body
    let finalMessage = message;
    if (!finalMessage && templateKey) {
      const settings = (await db.collection('settings').findOne({})) || {};
      const tpls = { ...WA_DEFAULT_TEMPLATES, ...(settings?.whatsappTemplates || {}) };
      const tpl = tpls[templateKey];
      if (!tpl) return err(`القالب "${templateKey}" غير موجود`, 400);
      const allVars = await buildSubscriberVars(db, subscriber || {}, vars || {});
      finalMessage = fillWaTemplate(tpl, allVars);
    }
    if (!finalMessage) return err('message أو templateKey مطلوب', 400);

    const result = await dispatchWhatsApp(db, {
      subscriberId: subscriber?.id || null,
      subscriberName: subscriber?.name || null,
      phone,
      type: templateKey || 'manual',
      message: finalMessage,
    });
    if (result.success) {
      await db.collection('events').insertOne({
        id: uuidv4(), type: 'whatsapp_sent',
        subscriberId: subscriber?.id, subscriberName: subscriber?.name, phone,
        templateKey: templateKey || 'manual', ts: new Date().toISOString(),
      });
    }
    return ok({ ...result });
  }

  // Bulk send with audience filter
  // body: { audience: 'all'|'active'|'expired'|'debt'|'by_zone'|'by_agent'|'by_fat', zoneId?, agentId?, fatNumber?, templateKey?, message?, vars? }
  if (path === 'whatsapp/send-bulk' && method === 'POST') {
    const body = await getJsonBody(request);
    const { audience = 'all', zoneId, agentId, fatNumber, templateKey, message, vars, delayMs = 1500 } = body || {};

    // Build filter
    const now = new Date().toISOString().slice(0, 10);
    let filter = {};
    if (audience === 'active') filter = { status: 'active' };
    else if (audience === 'expired') filter = { $or: [{ status: 'expired' }, { status: 'suspended' }, { endDate: { $lt: now } }] };
    else if (audience === 'debt') filter = { debt: { $gt: 0 } };
    else if (audience === 'by_zone' && zoneId) filter = { zoneId };
    else if (audience === 'by_agent' && agentId) filter = { agentId };
    else if (audience === 'by_fat' && fatNumber) filter = { fatNumber };

    const subs = await db.collection('subscribers').find(filter).toArray();
    const valid = subs.filter(s => s.phone);
    if (valid.length === 0) return ok({ success: true, total: 0, sent: 0, failed: 0, items: [] });

    // Resolve template once (shared across recipients)
    const settings = (await db.collection('settings').findOne({})) || {};
    const tpls = { ...WA_DEFAULT_TEMPLATES, ...(settings?.whatsappTemplates || {}) };
    const tpl = templateKey ? tpls[templateKey] : null;

    // Build items
    const items = [];
    for (const s of valid) {
      const allVars = await buildSubscriberVars(db, s, vars || {});
      const finalMsg = tpl ? fillWaTemplate(tpl, allVars) : fillWaTemplate(message || '', allVars);
      if (!finalMsg) continue;
      items.push({ phone: s.phone, message: finalMsg, subscriberId: s.id, subscriberName: s.name });
    }

    // Pre-insert all as queued (so user sees a job preview)
    const batchId = uuidv4();
    const ts = new Date().toISOString();
    const records = items.map(it => ({
      id: uuidv4(), batchId, subscriberId: it.subscriberId, subscriberName: it.subscriberName,
      phone: it.phone, type: templateKey || 'bulk', message: it.message,
      status: 'queued', retries: 0, createdAt: ts,
    }));
    if (records.length > 0) await db.collection('whatsapp_messages').insertMany(records);

    // Send via service
    if (!waIsConfigured()) {
      return ok({ success: false, queued: true, total: items.length, sent: 0, failed: 0, batchId, note: 'service_not_configured' });
    }
    const resp = await waSendBulk(items.map(it => ({ phone: it.phone, message: it.message })), delayMs);

    // Update statuses
    if (Array.isArray(resp?.results)) {
      for (let i = 0; i < resp.results.length; i++) {
        const r = resp.results[i];
        const rec = records[i];
        if (!rec) continue;
        await db.collection('whatsapp_messages').updateOne({ id: rec.id }, {
          $set: {
            status: r.ok ? 'sent' : 'failed',
            sentAt: r.ok ? new Date().toISOString() : null,
            externalId: r.id || null,
            error: r.ok ? null : (r.error || 'send_failed'),
          },
        });
      }
    }
    return ok({ success: !!resp?.ok, batchId, total: items.length, sent: resp?.sent || 0, failed: resp?.failed || 0, audience });
  }

  // Webhook from the WhatsApp microservice — receives connection events, incoming messages, etc.
  if (path === 'whatsapp/webhook' && method === 'POST') {
    const body = await getJsonBody(request);
    const { event, data } = body || {};
    try {
      await db.collection('whatsapp_events').insertOne({
        id: uuidv4(), event, data: data || {}, ts: new Date().toISOString(),
      });
      // Broadcast to live SSE clients
      await db.collection('events').insertOne({
        id: uuidv4(), type: `whatsapp_${event || 'event'}`, data: data || {},
        ts: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[whatsapp/webhook] persist error:', e?.message);
    }
    return ok({ received: true });
  }

  // Messages log (with optional filter ?type=&status=&q=&limit=)
  if (path === 'whatsapp/messages' && method === 'GET') {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');
    const q = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 1000);
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ subscriberName: re }, { phone: re }, { message: re }];
    }
    const items = await db.collection('whatsapp_messages').find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
    return ok(items.map(x => { try { delete x._id; } catch {} return x; }));
  }

  // Per-subscriber WhatsApp history (last 50 messages)
  if (path.match(/^whatsapp\/history\/[^/]+$/) && method === 'GET') {
    const subId = path.split('/')[2];
    const items = await db.collection('whatsapp_messages').find({ subscriberId: subId }).sort({ createdAt: -1 }).limit(50).toArray();
    return ok(items.map(x => { try { delete x._id; } catch {} return x; }));
  }

  // Quick test send (no subscriber, just phone + message)
  if (path === 'whatsapp/test-send' && method === 'POST') {
    const body = await getJsonBody(request);
    const { phone, message } = body || {};
    if (!phone || !message) return err('phone و message مطلوبان', 400);
    if (!waIsConfigured()) return err('خدمة واتساب غير مُعدّة', 503);
    const r = await waSend(phone, message);
    await db.collection('whatsapp_messages').insertOne({
      id: uuidv4(), subscriberId: null, subscriberName: 'Test', phone, type: 'test',
      message, status: r?.ok ? 'sent' : 'failed', externalId: r?.id || null,
      error: r?.ok ? null : (r?.error || 'send_failed'),
      sentAt: r?.ok ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
    });
    return ok({ success: !!r?.ok, ...r });
  }

  // Resend ALL failed messages (bulk retry)
  if (path === 'whatsapp/resend-failed' && method === 'POST') {
    if (!waIsConfigured()) return err('خدمة واتساب غير مُعدّة', 503);
    const failed = await db.collection('whatsapp_messages').find({ status: 'failed' }).sort({ createdAt: -1 }).limit(200).toArray();
    if (failed.length === 0) return ok({ success: true, total: 0, sent: 0, failed: 0 });
    let sent = 0, fail = 0;
    for (const m of failed) {
      if (!m.phone || m.phone === 'MANAGER') { fail++; continue; }
      try {
        const r = await waSend(m.phone, m.message || '');
        await db.collection('whatsapp_messages').updateOne({ id: m.id }, {
          $inc: { retries: 1 },
          $set: {
            status: r?.ok ? 'sent' : 'failed',
            sentAt: r?.ok ? new Date().toISOString() : null,
            externalId: r?.id || null,
            error: r?.ok ? null : (r?.error || 'send_failed'),
            lastRetryAt: new Date().toISOString(),
          },
        });
        if (r?.ok) sent++; else fail++;
      } catch (e) {
        fail++;
      }
      await new Promise(r => setTimeout(r, 1200));
    }
    return ok({ success: true, total: failed.length, sent, failed: fail });
  }

  // Run expiry alerts: find subs expiring in next N days → send template
  // POST { daysAhead?: number (default 5) }
  if (path === 'whatsapp/run-expiry-alerts' && method === 'POST') {
    const body = await getJsonBody(request);
    const daysAhead = parseInt(body?.daysAhead || 5, 10);
    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 86400000).toISOString().slice(0, 10);
    const todayStr = now.toISOString().slice(0, 10);

    const subs = await db.collection('subscribers').find({
      status: 'active',
      endDate: { $gte: todayStr, $lte: cutoff },
    }).toArray();
    const valid = subs.filter(s => s.phone);

    const settings = (await db.collection('settings').findOne({})) || {};
    const tpls = { ...WA_DEFAULT_TEMPLATES, ...(settings?.whatsappTemplates || {}) };
    const tpl = tpls.expiry_alert;

    const items = [];
    for (const s of valid) {
      const daysLeft = Math.max(1, Math.ceil((new Date(s.endDate).getTime() - now.getTime()) / 86400000));
      const vars = await buildSubscriberVars(db, s, { daysLeft });
      items.push({ phone: s.phone, message: fillWaTemplate(tpl, vars), subscriberId: s.id, subscriberName: s.name });
    }
    if (items.length === 0) return ok({ success: true, total: 0, sent: 0, failed: 0, daysAhead });

    const batchId = uuidv4(); const ts = new Date().toISOString();
    const records = items.map(it => ({
      id: uuidv4(), batchId, subscriberId: it.subscriberId, subscriberName: it.subscriberName,
      phone: it.phone, type: 'expiry_alert', message: it.message, status: 'queued', retries: 0, createdAt: ts,
    }));
    await db.collection('whatsapp_messages').insertMany(records);

    if (!waIsConfigured()) {
      return ok({ success: false, queued: true, total: items.length, batchId, daysAhead, note: 'service_not_configured' });
    }
    const resp = await waSendBulk(items.map(it => ({ phone: it.phone, message: it.message })), 1500);
    if (Array.isArray(resp?.results)) {
      for (let i = 0; i < resp.results.length; i++) {
        const r = resp.results[i]; const rec = records[i]; if (!rec) continue;
        await db.collection('whatsapp_messages').updateOne({ id: rec.id }, {
          $set: { status: r.ok ? 'sent' : 'failed', sentAt: r.ok ? new Date().toISOString() : null, externalId: r.id || null, error: r.ok ? null : (r.error || 'send_failed') },
        });
      }
    }
    await logActivity(db, { action: 'whatsapp_run_expiry_alerts', entity: 'whatsapp', details: `${resp?.sent || 0}/${items.length} (خلال ${daysAhead} يوم)`, ip: clientIp });
    return ok({ success: !!resp?.ok, total: items.length, sent: resp?.sent || 0, failed: resp?.failed || 0, batchId, daysAhead });
  }

  // Run debt reminders: subs with debt > 0
  if (path === 'whatsapp/run-debt-reminders' && method === 'POST') {
    const subs = await db.collection('subscribers').find({ debt: { $gt: 0 } }).toArray();
    const valid = subs.filter(s => s.phone);
    const settings = (await db.collection('settings').findOne({})) || {};
    const tpls = { ...WA_DEFAULT_TEMPLATES, ...(settings?.whatsappTemplates || {}) };
    const tpl = tpls.debt;
    const items = [];
    for (const s of valid) {
      const vars = await buildSubscriberVars(db, s);
      items.push({ phone: s.phone, message: fillWaTemplate(tpl, vars), subscriberId: s.id, subscriberName: s.name });
    }
    if (items.length === 0) return ok({ success: true, total: 0, sent: 0, failed: 0 });
    const batchId = uuidv4(); const ts = new Date().toISOString();
    const records = items.map(it => ({
      id: uuidv4(), batchId, subscriberId: it.subscriberId, subscriberName: it.subscriberName,
      phone: it.phone, type: 'debt', message: it.message, status: 'queued', retries: 0, createdAt: ts,
    }));
    await db.collection('whatsapp_messages').insertMany(records);
    if (!waIsConfigured()) return ok({ success: false, queued: true, total: items.length, batchId });
    const resp = await waSendBulk(items.map(it => ({ phone: it.phone, message: it.message })), 1500);
    if (Array.isArray(resp?.results)) {
      for (let i = 0; i < resp.results.length; i++) {
        const r = resp.results[i]; const rec = records[i]; if (!rec) continue;
        await db.collection('whatsapp_messages').updateOne({ id: rec.id }, {
          $set: { status: r.ok ? 'sent' : 'failed', sentAt: r.ok ? new Date().toISOString() : null, externalId: r.id || null, error: r.ok ? null : (r.error || 'send_failed') },
        });
      }
    }
    await logActivity(db, { action: 'whatsapp_run_debt_reminders', entity: 'whatsapp', details: `${resp?.sent || 0}/${items.length}`, ip: clientIp });
    return ok({ success: !!resp?.ok, total: items.length, sent: resp?.sent || 0, failed: resp?.failed || 0, batchId });
  }

  // WhatsApp stats card data (for dashboard widget)
  if (path === 'whatsapp/stats' && method === 'GET') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const totalSent = await db.collection('whatsapp_messages').countDocuments({ status: 'sent' });
    const totalFailed = await db.collection('whatsapp_messages').countDocuments({ status: 'failed' });
    const totalQueued = await db.collection('whatsapp_messages').countDocuments({ status: 'queued' });
    const todaySent = await db.collection('whatsapp_messages').countDocuments({ status: 'sent', createdAt: { $gte: today.toISOString() } });
    const weekSent = await db.collection('whatsapp_messages').countDocuments({ status: 'sent', createdAt: { $gte: weekAgo.toISOString() } });
    return ok({ totalSent, totalFailed, totalQueued, todaySent, weekSent });
  }

  // ============ BALANCE ACCOUNTS (Fast / Master / Management / Cash / Box) ============
  // List all accounts with current balance + recent stats
  if (path === 'balance/accounts' && method === 'GET') {
    let accounts = await db.collection('balance_accounts').find({}).toArray();
    // Auto-seed default accounts once (first call)
    if (accounts.length === 0) {
      const defaults = [
        { id: uuidv4(), key: 'fast',       name: 'رصيد Fast',     type: 'fast',       balance: 0, color: '#3b82f6', icon: '⚡', enabled: true, createdAt: new Date().toISOString() },
        { id: uuidv4(), key: 'master',     name: 'رصيد Master',   type: 'master',     balance: 0, color: '#a855f7', icon: '💳', enabled: true, createdAt: new Date().toISOString() },
        { id: uuidv4(), key: 'management', name: 'رصيد المنجمنت', type: 'management', balance: 0, color: '#10b981', icon: '🌐', enabled: true, createdAt: new Date().toISOString() },
        { id: uuidv4(), key: 'cash',       name: 'رصيد الكاش',    type: 'cash',       balance: 0, color: '#f59e0b', icon: '💵', enabled: true, createdAt: new Date().toISOString() },
        { id: uuidv4(), key: 'box',        name: 'الصندوق',       type: 'box',        balance: 0, color: '#ec4899', icon: '🧰', enabled: true, createdAt: new Date().toISOString() },
      ];
      await db.collection('balance_accounts').insertMany(defaults.map(d => ({ ...d })));
      accounts = defaults;
    }
    // Add transaction counts
    const enriched = await Promise.all(accounts.map(async a => {
      try { delete a._id; } catch {}
      const txCount = await db.collection('balance_transactions').countDocuments({ accountId: a.id });
      return { ...a, txCount };
    }));
    return ok(enriched);
  }
  // Create new account
  if (path === 'balance/accounts' && method === 'POST') {
    const body = await getJsonBody(request);
    if (!body?.name) return err('name مطلوب', 400);
    const doc = {
      id: uuidv4(),
      key: body.key || body.name.toLowerCase().replace(/\s+/g, '_'),
      name: body.name,
      type: body.type || 'other',
      balance: Number(body.balance) || 0,
      color: body.color || '#888',
      icon: body.icon || '💰',
      enabled: body.enabled !== false,
      createdAt: new Date().toISOString(),
    };
    await db.collection('balance_accounts').insertOne({ ...doc });
    await logActivity(db, { action: 'balance_account_created', entity: 'balance_accounts', entityId: doc.id, details: doc.name, ip: clientIp });
    return ok(doc);
  }
  // Update account
  if (path.match(/^balance\/accounts\/[^/]+$/) && method === 'PUT') {
    const id = path.split('/')[2];
    const body = await getJsonBody(request);
    const allowed = ['name', 'type', 'color', 'icon', 'enabled'];
    const updates = {};
    for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k];
    updates.updatedAt = new Date().toISOString();
    await db.collection('balance_accounts').updateOne({ id }, { $set: updates });
    await logActivity(db, { action: 'balance_account_updated', entity: 'balance_accounts', entityId: id, details: JSON.stringify(updates), ip: clientIp });
    return ok({ success: true });
  }
  // Delete account (only if zero balance + no transactions)
  if (path.match(/^balance\/accounts\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[2];
    const acc = await db.collection('balance_accounts').findOne({ id });
    if (!acc) return err('غير موجود', 404);
    const txCount = await db.collection('balance_transactions').countDocuments({ accountId: id });
    if (txCount > 0 || Math.abs(Number(acc.balance) || 0) > 0.01) return err('لا يمكن الحذف — يوجد رصيد أو معاملات. عطّل الحساب بدلاً من حذفه.', 400);
    await db.collection('balance_accounts').deleteOne({ id });
    await logActivity(db, { action: 'balance_account_deleted', entity: 'balance_accounts', entityId: id, details: acc.name, ip: clientIp });
    return ok({ success: true });
  }

  // Deposit (إضافة رصيد)
  if (path === 'balance/deposit' && method === 'POST') {
    const body = await getJsonBody(request);
    const { accountId, amount, description, linkedEntity, linkedEntityId, by } = body || {};
    if (!accountId || !amount || amount <= 0) return err('accountId و amount > 0 مطلوبان', 400);
    const acc = await db.collection('balance_accounts').findOne({ id: accountId });
    if (!acc) return err('الحساب غير موجود', 404);
    const newBalance = Number(acc.balance || 0) + Number(amount);
    await db.collection('balance_accounts').updateOne({ id: accountId }, { $set: { balance: newBalance, updatedAt: new Date().toISOString() } });
    const tx = {
      id: uuidv4(), accountId, accountName: acc.name, type: 'deposit',
      amount: Number(amount), balanceBefore: Number(acc.balance || 0), balanceAfter: newBalance,
      description: description || 'تعبئة رصيد',
      linkedEntity: linkedEntity || null, linkedEntityId: linkedEntityId || null,
      createdBy: by?.id || 'admin', createdByName: by?.name || 'المدير',
      createdAt: new Date().toISOString(),
    };
    await db.collection('balance_transactions').insertOne({ ...tx });
    await logActivity(db, { action: 'balance_deposit', entity: 'balance_transactions', entityId: tx.id, details: `${acc.name}: +${amount.toLocaleString()} د.ع`, ip: clientIp });
    await createNotification(db, {
      type: 'balance_deposit', icon: '➕',
      title: `تعبئة ${acc.name}`,
      message: `+${Number(amount).toLocaleString()} د.ع — الرصيد الجديد: ${newBalance.toLocaleString()} د.ع${description ? '\n' + description : ''}`,
      entityType: 'generic', priority: 'low',
    });
    return ok({ success: true, transaction: tx, newBalance });
  }

  // Withdraw (صرف من الرصيد)
  if (path === 'balance/withdraw' && method === 'POST') {
    const body = await getJsonBody(request);
    const { accountId, amount, description, linkedEntity, linkedEntityId, by, allowOverdraft } = body || {};
    if (!accountId || !amount || amount <= 0) return err('accountId و amount > 0 مطلوبان', 400);
    const acc = await db.collection('balance_accounts').findOne({ id: accountId });
    if (!acc) return err('الحساب غير موجود', 404);
    const newBalance = Number(acc.balance || 0) - Number(amount);
    if (newBalance < 0 && !allowOverdraft) return err(`الرصيد غير كافٍ. الحالي: ${(acc.balance || 0).toLocaleString()} د.ع`, 400);
    await db.collection('balance_accounts').updateOne({ id: accountId }, { $set: { balance: newBalance, updatedAt: new Date().toISOString() } });
    const tx = {
      id: uuidv4(), accountId, accountName: acc.name, type: 'withdraw',
      amount: Number(amount), balanceBefore: Number(acc.balance || 0), balanceAfter: newBalance,
      description: description || 'صرف من الرصيد',
      linkedEntity: linkedEntity || null, linkedEntityId: linkedEntityId || null,
      createdBy: by?.id || 'admin', createdByName: by?.name || 'المدير',
      createdAt: new Date().toISOString(),
    };
    await db.collection('balance_transactions').insertOne({ ...tx });
    await logActivity(db, { action: 'balance_withdraw', entity: 'balance_transactions', entityId: tx.id, details: `${acc.name}: -${amount.toLocaleString()} د.ع — ${description || ''}`, ip: clientIp });
    if (newBalance < 0) {
      await createNotification(db, {
        type: 'balance_overdraft', icon: '⚠️', priority: 'critical',
        title: `تحذير: ${acc.name} في السالب`,
        message: `الرصيد الحالي: ${newBalance.toLocaleString()} د.ع — يجب التعبئة فوراً!`,
        entityType: 'generic',
      });
    }
    return ok({ success: true, transaction: tx, newBalance });
  }

  // Transfer between accounts
  if (path === 'balance/transfer' && method === 'POST') {
    const body = await getJsonBody(request);
    const { fromAccountId, toAccountId, amount, description, by } = body || {};
    if (!fromAccountId || !toAccountId || !amount || amount <= 0) return err('fromAccountId و toAccountId و amount > 0 مطلوبة', 400);
    if (fromAccountId === toAccountId) return err('لا يمكن التحويل لنفس الحساب', 400);
    const fromAcc = await db.collection('balance_accounts').findOne({ id: fromAccountId });
    const toAcc = await db.collection('balance_accounts').findOne({ id: toAccountId });
    if (!fromAcc || !toAcc) return err('حساب غير موجود', 404);
    if ((fromAcc.balance || 0) < amount) return err('رصيد المصدر غير كافٍ', 400);
    const fromNew = Number(fromAcc.balance || 0) - Number(amount);
    const toNew = Number(toAcc.balance || 0) + Number(amount);
    await db.collection('balance_accounts').updateOne({ id: fromAccountId }, { $set: { balance: fromNew } });
    await db.collection('balance_accounts').updateOne({ id: toAccountId }, { $set: { balance: toNew } });
    const batchId = uuidv4();
    const now = new Date().toISOString();
    await db.collection('balance_transactions').insertMany([
      { id: uuidv4(), accountId: fromAccountId, accountName: fromAcc.name, type: 'transfer_out',
        amount: Number(amount), balanceBefore: fromAcc.balance || 0, balanceAfter: fromNew,
        description: description || `تحويل إلى ${toAcc.name}`, linkedEntity: 'balance_account', linkedEntityId: toAccountId,
        batchId, createdBy: by?.id || 'admin', createdByName: by?.name || 'المدير', createdAt: now },
      { id: uuidv4(), accountId: toAccountId, accountName: toAcc.name, type: 'transfer_in',
        amount: Number(amount), balanceBefore: toAcc.balance || 0, balanceAfter: toNew,
        description: description || `تحويل من ${fromAcc.name}`, linkedEntity: 'balance_account', linkedEntityId: fromAccountId,
        batchId, createdBy: by?.id || 'admin', createdByName: by?.name || 'المدير', createdAt: now },
    ]);
    await logActivity(db, { action: 'balance_transfer', entity: 'balance_transactions', details: `${fromAcc.name} → ${toAcc.name}: ${amount.toLocaleString()}`, ip: clientIp });
    return ok({ success: true, fromBalance: fromNew, toBalance: toNew });
  }

  // List transactions with filters
  if (path === 'balance/transactions' && method === 'GET') {
    const url = new URL(request.url);
    const accountId = url.searchParams.get('accountId');
    const type = url.searchParams.get('type');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 1000);
    const filter = {};
    if (accountId) filter.accountId = accountId;
    if (type) filter.type = type;
    if (from || to) filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
    const items = await db.collection('balance_transactions').find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
    return ok(items.map(x => { try { delete x._id; } catch {} return x; }));
  }

  // Per-account summary (for dashboard cards + reports)
  if (path === 'balance/summary' && method === 'GET') {
    const accounts = await db.collection('balance_accounts').find({}).toArray();
    const result = await Promise.all(accounts.map(async a => {
      try { delete a._id; } catch {}
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const yearStart = new Date(); yearStart.setMonth(0, 1); yearStart.setHours(0, 0, 0, 0);

      const sumByDate = async (start, type) => {
        const txs = await db.collection('balance_transactions').find({
          accountId: a.id, type, createdAt: { $gte: start.toISOString() },
        }).toArray();
        return txs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
      };
      return {
        ...a,
        todayDeposit: await sumByDate(today, 'deposit'),
        todayWithdraw: await sumByDate(today, 'withdraw'),
        monthDeposit: await sumByDate(monthStart, 'deposit'),
        monthWithdraw: await sumByDate(monthStart, 'withdraw'),
        yearDeposit: await sumByDate(yearStart, 'deposit'),
        yearWithdraw: await sumByDate(yearStart, 'withdraw'),
      };
    }));
    return ok(result);
  }

  // Delete a transaction (manager only — and only if it's the last one for that account, to preserve audit)
  if (path.match(/^balance\/transactions\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[1];
    const tx = await db.collection('balance_transactions').findOne({ id: path.split('/')[2] });
    if (!tx) return err('غير موجود', 404);
    // Reverse the balance change
    const acc = await db.collection('balance_accounts').findOne({ id: tx.accountId });
    if (acc) {
      const reverse = tx.type === 'deposit' || tx.type === 'transfer_in' ? -tx.amount : +tx.amount;
      await db.collection('balance_accounts').updateOne({ id: tx.accountId }, { $set: { balance: (acc.balance || 0) + reverse } });
    }
    await db.collection('balance_transactions').deleteOne({ id: path.split('/')[2] });
    await logActivity(db, { action: 'balance_transaction_deleted', entity: 'balance_transactions', entityId: tx.id, details: `حذف: ${tx.accountName} ${tx.type} ${tx.amount}`, ip: clientIp });
    return ok({ success: true });
  }

  // ============ END BALANCE ACCOUNTS ============

  // ============ SEPARATED PROFIT REPORTS ============
  // Returns full P&L breakdown per category with date filtering
  // GET /api/reports/separated?from=2026-01-01&to=2026-12-31
  if (path === 'reports/separated' && method === 'GET') {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = url.searchParams.get('to') || new Date().toISOString().slice(0, 10);
    const fromISO = `${from}T00:00:00.000Z`;
    const toISO = `${to}T23:59:59.999Z`;

    const dateRange = { $gte: fromISO, $lte: toISO };

    // Helper: sum a field from array of records
    const sumField = (arr, field) => (Array.isArray(arr) ? arr : []).reduce((s, x) => s + (Number(x?.[field]) || 0), 0);

    // ===== Sales (POS) =====
    const sales = await db.collection('sales').find({ createdAt: dateRange }).toArray().catch(() => []);
    const salesTotal = sumField(sales, 'total');
    const salesProfit = sumField(sales, 'profit');
    const salesCost = sumField(sales, 'cost');

    // ===== Subscriptions (Activations) =====
    const activations = await db.collection('activations').find({ createdAt: dateRange }).toArray().catch(() => []);
    const subsTotal = sumField(activations, 'amount');
    const subsPaid = sumField(activations, 'paid');
    const subsCount = activations.length;

    // ===== Repairs =====
    const repairs = await db.collection('repairs').find({ createdAt: dateRange }).toArray().catch(() => []);
    const repairsRevenue = sumField(repairs, 'totalAmount') + sumField(repairs, 'price');
    const repairsCost = sumField(repairs, 'partsCost') + sumField(repairs, 'cost');
    const repairsCount = repairs.length;
    const repairsCompleted = repairs.filter(r => r?.status === 'completed').length;

    // ===== Debts =====
    const subscribers = await db.collection('subscribers').find({}).toArray().catch(() => []);
    const totalOutstandingDebt = (Array.isArray(subscribers) ? subscribers : []).reduce((s, x) => s + (Number(x?.debt) || 0), 0);
    const debtPaymentsInRange = await db.collection('debt_payments').find({ createdAt: dateRange }).toArray().catch(() => []);
    const debtsPaidInRange = sumField(debtPaymentsInRange, 'amount');

    // ===== Expenses (balance withdrawals, manual only - not auto-deduct which is already counted as activation cost) =====
    const expenses = await db.collection('balance_transactions').find({
      type: 'withdraw',
      createdAt: dateRange,
    }).toArray().catch(() => []);
    const expensesTotal = sumField(expenses, 'amount');
    const expensesByCategory = {};
    for (const e of expenses) {
      const cat = e.linkedEntity || 'general';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (Number(e.amount) || 0);
    }

    // ===== Agents (commissions/fees from activations) =====
    const agents = await db.collection('agents').find({}).toArray().catch(() => []);
    const agentStats = (Array.isArray(agents) ? agents : []).map(a => {
      const myActivations = activations.filter(ac => ac?.agentId === a.id);
      return {
        id: a.id, name: a.name,
        activationsCount: myActivations.length,
        revenue: myActivations.reduce((s, x) => s + (Number(x?.amount) || 0), 0),
        profit: myActivations.reduce((s, x) => s + (Number(x?.agentProfit) || 0), 0),
        balance: Number(a.balance) || 0,
        subscribersCount: subscribers.filter(s => s.agentId === a.id).length,
      };
    });

    // ===== Net profit =====
    // Net = sales_profit + subscriptions_revenue + repairs_revenue + debts_paid - expenses - repairs_cost
    const netProfit = salesProfit + subsTotal + repairsRevenue + debtsPaidInRange - expensesTotal - repairsCost;

    // ===== Daily time-series for charts =====
    const daySeries = [];
    const start = new Date(fromISO);
    const end = new Date(toISO);
    const days = Math.min(90, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(start.getTime() + i * 86400000); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const dayStartISO = dayStart.toISOString();
      const dayEndISO = dayEnd.toISOString();
      const inRange = (x) => x?.createdAt >= dayStartISO && x?.createdAt < dayEndISO;
      daySeries.push({
        date: dayStart.toISOString().slice(0, 10),
        label: dayStart.toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric' }),
        sales: sumField(sales.filter(inRange), 'total'),
        subscriptions: sumField(activations.filter(inRange), 'amount'),
        repairs: sumField(repairs.filter(inRange), 'totalAmount'),
        expenses: sumField(expenses.filter(inRange), 'amount'),
      });
    }

    return ok({
      period: { from, to, days },
      sales:        { total: salesTotal, profit: salesProfit, cost: salesCost, count: sales.length },
      subscriptions:{ total: subsTotal, paid: subsPaid, count: subsCount, debt: subsTotal - subsPaid },
      repairs:      { revenue: repairsRevenue, cost: repairsCost, profit: repairsRevenue - repairsCost, count: repairsCount, completed: repairsCompleted },
      debts:        { outstanding: totalOutstandingDebt, paidInRange: debtsPaidInRange },
      expenses:     { total: expensesTotal, byCategory: expensesByCategory, count: expenses.length },
      agents:       agentStats.sort((a, b) => b.revenue - a.revenue),
      net:          { profit: netProfit, totalRevenue: salesTotal + subsTotal + repairsRevenue + debtsPaidInRange, totalCost: expensesTotal + repairsCost + salesCost },
      chart:        daySeries,
    });
  }
  // ============ END REPORTS ============

  // ============ ISP SUBSCRIBER SYNC CENTER ============
  // Get sync config (URL, credentials, source type, field mappings, auto-sync settings)
  if (path === 'isp-sync/config' && method === 'GET') {
    const settings = (await db.collection('settings').findOne({})) || {};
    const cfg = settings?.ispSync || {
      enabled: false, sourceType: 'custom', sourceUrl: '', username: '', password: '',
      fetchMethod: 'manual', autoDaily: false, autoUpdateMatching: false, blockOnConflict: true,
      fieldMap: {}, lastRunAt: null,
    };
    // Mask password
    return ok({ ...cfg, password: cfg.password ? '****' : '' });
  }
  if (path === 'isp-sync/config' && method === 'PUT') {
    const body = await getJsonBody(request);
    const settings = (await db.collection('settings').findOne({})) || {};
    const existing = settings?.ispSync || {};
    // Preserve password if user sent "****" (means unchanged)
    const password = (body.password && body.password !== '****') ? body.password : (existing.password || '');
    const cfg = {
      enabled: !!body.enabled,
      sourceType: body.sourceType || 'custom',  // mynet | halasat | custom
      sourceUrl: body.sourceUrl || '',
      username: body.username || '',
      password,
      fetchMethod: body.fetchMethod || 'manual',  // api | excel | scraping | manual
      autoDaily: !!body.autoDaily,
      autoUpdateMatching: !!body.autoUpdateMatching,
      blockOnConflict: body.blockOnConflict !== false,
      fieldMap: body.fieldMap || {},
      lastRunAt: existing.lastRunAt || null,
    };
    await db.collection('settings').updateOne({}, { $set: { ispSync: cfg, updatedAt: new Date().toISOString() } }, { upsert: true });
    await logActivity(db, { action: 'isp_sync_config_update', entity: 'settings', details: `نوع: ${cfg.sourceType} / طريقة: ${cfg.fetchMethod}`, ip: clientIp });
    return ok({ success: true, ...cfg, password: cfg.password ? '****' : '' });
  }

  // Run a comparison scan
  // body: { externalSubs: [...], source?: 'mynet'|'halasat'|'excel'|'custom' }
  // External subs can come from: user-pasted JSON, parsed Excel (client-side), or fetched API
  if (path === 'isp-sync/scan' && method === 'POST') {
    const body = await getJsonBody(request);
    const externalSubs = Array.isArray(body?.externalSubs) ? body.externalSubs : [];
    if (externalSubs.length === 0) return err('externalSubs مطلوبة (مصفوفة من المشتركين من صفحة الإنترنت)', 400);

    const settings = (await db.collection('settings').findOne({})) || {};
    const cfg = settings?.ispSync || {};
    const platformSubs = await db.collection('subscribers').find({}).toArray();

    const report = runIspSync(externalSubs, platformSubs, {
      fieldMap: cfg.fieldMap || {},
      source: body.source || cfg.sourceType || 'unknown',
    });

    // Sanitize platform refs (drop _id mongo blobs)
    const cleanRows = report.rows.map(r => {
      const cleanPlatform = r.platform ? { ...r.platform } : null;
      if (cleanPlatform) delete cleanPlatform._id;
      return { ...r, platform: cleanPlatform };
    });

    // Persist this scan (without applying)
    const scanDoc = {
      id: uuidv4(),
      runId: report.runId,
      source: report.source,
      ranAt: report.ranAt,
      ranBy: body?.ranBy || 'admin',
      counts: report.counts,
      rows: cleanRows,
      applied: false,
      ip: clientIp,
    };
    await db.collection('isp_sync_runs').insertOne({ ...scanDoc });
    await db.collection('settings').updateOne({}, { $set: { 'ispSync.lastRunAt': report.ranAt } }, { upsert: true });
    return ok({ ...scanDoc });
  }

  // Apply user-selected actions from a scan
  // body: { runId, actions: [{rowId, action: 'create'|'update'|'merge'|'ignore', target?: subscriberId, fields?: {} }] }
  if (path === 'isp-sync/apply' && method === 'POST') {
    const body = await getJsonBody(request);
    const { runId, actions = [] } = body || {};
    if (!runId || !Array.isArray(actions) || actions.length === 0) return err('runId و actions مطلوبة', 400);

    const run = await db.collection('isp_sync_runs').findOne({ runId });
    if (!run) return err('عملية المزامنة غير موجودة', 404);

    const results = { created: 0, updated: 0, merged: 0, ignored: 0, errors: [] };
    const settings = (await db.collection('settings').findOne({})) || {};
    const blockOnConflict = settings?.ispSync?.blockOnConflict !== false;

    for (const act of actions) {
      try {
        const row = (run.rows || []).find(r => r.rowId === act.rowId);
        if (!row) { results.errors.push({ rowId: act.rowId, error: 'row_not_found' }); continue; }

        if (act.action === 'ignore') { results.ignored++; continue; }

        if (act.action === 'create' && row.external) {
          // Prevent duplicate by username/phone/externalId
          const ext = row.external;
          const dup = await db.collection('subscribers').findOne({
            $or: [
              ext.username ? { username: ext.username } : null,
              ext.phone ? { phone: ext.phone } : null,
              ext.externalId ? { externalId: ext.externalId } : null,
            ].filter(Boolean),
          });
          if (dup) { results.errors.push({ rowId: act.rowId, error: 'duplicate_exists' }); continue; }

          const newSub = {
            id: uuidv4(),
            externalId: ext.externalId || null,
            username: ext.username || '',
            name: ext.name || '',
            phone: ext.phone || '',
            package: ext.package || '',
            speed: ext.speed || '',
            status: ext.status || 'active',
            startDate: ext.startDate || null,
            endDate: ext.endDate || null,
            fee: Number(ext.fee || 0),
            debt: Number(ext.debt || 0),
            paid: Number(ext.paid || 0),
            agentName: ext.agentName || '',
            source: 'isp_sync',
            sourceRunId: runId,
            createdAt: new Date().toISOString(),
          };
          await db.collection('subscribers').insertOne(newSub);
          results.created++;
        }
        else if (act.action === 'update' && row.platform && row.external) {
          // If conflict + blockOnConflict, require explicit field-by-field acceptance via act.fields
          if (row.severity === 'critical' && blockOnConflict && !act.fields) {
            results.errors.push({ rowId: act.rowId, error: 'conflict_requires_explicit_fields' });
            continue;
          }
          const updates = {};
          if (act.fields && typeof act.fields === 'object') {
            // Update only fields explicitly chosen by user
            for (const [k, v] of Object.entries(act.fields)) updates[k] = v;
          } else {
            // Auto-apply all changes
            for (const c of row.changes) updates[c.field] = c.external;
          }
          updates.updatedAt = new Date().toISOString();
          updates.lastSyncedAt = new Date().toISOString();
          await db.collection('subscribers').updateOne({ id: row.platform.id }, { $set: updates });
          results.updated++;
        }
        else if (act.action === 'merge' && row.external && act.target) {
          // Merge external data into the chosen target subscriber
          const ext = row.external;
          const updates = {
            externalId: ext.externalId || null,
            lastSyncedAt: new Date().toISOString(),
          };
          // Only fill empty fields; never overwrite existing data
          const target = await db.collection('subscribers').findOne({ id: act.target });
          if (!target) { results.errors.push({ rowId: act.rowId, error: 'merge_target_not_found' }); continue; }
          for (const key of ['username', 'name', 'phone', 'package', 'speed', 'endDate', 'agentName']) {
            if (!target[key] && ext[key]) updates[key] = ext[key];
          }
          await db.collection('subscribers').updateOne({ id: act.target }, { $set: updates });
          results.merged++;
        }
      } catch (e) {
        results.errors.push({ rowId: act.rowId, error: e?.message || 'unknown' });
      }
    }

    await db.collection('isp_sync_runs').updateOne({ runId }, {
      $set: { applied: true, appliedAt: new Date().toISOString(), appliedResults: results, appliedBy: body?.appliedBy || 'admin' },
    });
    await logActivity(db, {
      action: 'isp_sync_apply', entity: 'subscribers',
      details: `مزامنة ${runId}: ${results.created} جديد، ${results.updated} محدث، ${results.merged} مدمج`,
      ip: clientIp,
    });
    return ok({ success: true, runId, results });
  }

  // List recent sync runs (most recent first)
  if (path === 'isp-sync/logs' && method === 'GET') {
    const items = await db.collection('isp_sync_runs').find({}).sort({ ranAt: -1 }).limit(50).toArray();
    return ok(items.map(x => {
      try { delete x._id; } catch {}
      // Drop the heavy rows array from list view (keep only counts)
      const { rows, ...rest } = x;
      return rest;
    }));
  }
  // Get a single run with full rows
  if (path.match(/^isp-sync\/logs\/[^/]+$/) && method === 'GET') {
    const runId = path.split('/')[2];
    const run = await db.collection('isp_sync_runs').findOne({ runId });
    if (!run) return err('غير موجود', 404);
    try { delete run._id; } catch {}
    return ok(run);
  }
  // Delete a run (audit log)
  if (path.match(/^isp-sync\/logs\/[^/]+$/) && method === 'DELETE') {
    const runId = path.split('/')[2];
    await db.collection('isp_sync_runs').deleteOne({ runId });
    await logActivity(db, { action: 'isp_sync_delete_run', entity: 'isp_sync_runs', details: runId, ip: clientIp });
    return ok({ success: true });
  }



  if (path === 'dashboard/stats' && method === 'GET') {
    try {
      const safe = async (fn, def) => { try { return await fn(); } catch { return def; } };
      const totalProducts = await safe(() => db.collection('products').countDocuments(), 0);
      const totalSubscribers = await safe(() => db.collection('subscribers').countDocuments(), 0);
      const activeSubscribers = await safe(() => db.collection('subscribers').countDocuments({ status: 'active' }), 0);
      const totalRepairs = await safe(() => db.collection('repairs').countDocuments(), 0);
      const pendingRepairs = await safe(() => db.collection('repairs').countDocuments({ status: { $in: ['pending', 'in_progress'] } }), 0);
      const totalEmployees = await safe(() => db.collection('employees').countDocuments(), 0);
      const zones = await safe(() => db.collection('zones').find({}).toArray(), []);
      const onlineZones = Array.isArray(zones) ? zones.filter(z => z?.status === 'online').length : 0;
      const sales = await safe(() => db.collection('sales').find({}).toArray(), []);
      const totalRevenue = Array.isArray(sales) ? sales.reduce((s, x) => s + (Number(x?.total) || 0), 0) : 0;
      const subs = await safe(() => db.collection('subscribers').find({}).toArray(), []);
      const monthlyIncome = Array.isArray(subs)
        ? subs.filter(s => s?.status === 'active').reduce((s, x) => s + (Number(x?.fee) || 0), 0)
        : 0;
      const totalDebt = Array.isArray(subs) ? subs.reduce((s, x) => s + (Number(x?.debt) || 0), 0) : 0;
      const lowStock = await safe(() => db.collection('products').find({ $expr: { $lte: ['$stock', '$lowStockAlert'] } }).toArray(), []);

      const now = Date.now();
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const day = new Date(now - i * 86400000);
        const dayStart = new Date(day.setHours(0, 0, 0, 0)).getTime();
        const dayEnd = dayStart + 86400000;
        const daySales = (Array.isArray(sales) ? sales : []).filter(s => {
          if (!s?.createdAt) return false;
          const t = new Date(s.createdAt).getTime();
          return t >= dayStart && t < dayEnd;
        });
        const dateStr = new Date(dayStart).toLocaleDateString('ar-IQ', { weekday: 'short' });
        days.push({ name: dateStr, sales: daySales.reduce((s, x) => s + (Number(x?.total) || 0), 0), orders: daySales.length });
      }

      return ok({
        totalProducts, totalSubscribers, activeSubscribers, totalRepairs, pendingRepairs,
        totalEmployees, totalZones: Array.isArray(zones) ? zones.length : 0, onlineZones,
        totalRevenue, monthlyIncome, totalDebt,
        lowStockCount: Array.isArray(lowStock) ? lowStock.length : 0,
        lowStock: (Array.isArray(lowStock) ? lowStock : []).slice(0, 5).map(p => { try { delete p._id; } catch {} return p; }),
        salesChart: days,
      });
    } catch (e) {
      console.error('[dashboard/stats] error:', e?.message);
      return ok({
        totalProducts: 0, totalSubscribers: 0, activeSubscribers: 0, totalRepairs: 0, pendingRepairs: 0,
        totalEmployees: 0, totalZones: 0, onlineZones: 0, totalRevenue: 0, monthlyIncome: 0,
        totalDebt: 0, lowStockCount: 0, lowStock: [], salesChart: [], _error: e?.message,
      });
    }
  }

  // ============ ADMIN CREDENTIALS (System) ============
  if (path === 'admin/credentials' && method === 'GET') {
    // Returns current admin username only (never the password)
    const s = await db.collection('settings').findOne({});
    const username = s?.security?.adminUsername || 'admin';
    const hasPassword = !!s?.security?.adminPasswordHash;
    const email = s?.security?.adminEmail || '';
    const phone = s?.security?.adminPhone || '';
    return ok({ username, hasPassword, email, phone });
  }
  if (path === 'admin/credentials' && method === 'PUT') {
    const { currentPassword, newUsername, newPassword, email, phone } = await getJsonBody(request);
    const s = await db.collection('settings').findOne({}) || {};
    const storedHash = s?.security?.adminPasswordHash;
    const storedUsername = s?.security?.adminUsername || 'admin';
    // If a password is already set, currentPassword is required for verification
    if (storedHash) {
      if (!currentPassword) return err('كلمة المرور الحالية مطلوبة', 400);
      const okPw = await verifyPassword(currentPassword, storedHash);
      if (!okPw) {
        await logActivity(db, { action: 'admin_password_change_failed', entity: 'admin', user: storedUsername, details: 'كلمة المرور الحالية غير صحيحة', ip: clientIp });
        return err('كلمة المرور الحالية غير صحيحة', 401);
      }
    }
    const patch = {};
    if (newUsername && typeof newUsername === 'string' && newUsername.trim().length >= 3) {
      patch['security.adminUsername'] = newUsername.trim();
    }
    if (newPassword && typeof newPassword === 'string') {
      if (newPassword.length < 6) return err('كلمة المرور يجب أن لا تقل عن 6 أحرف', 400);
      patch['security.adminPasswordHash'] = await hashPassword(newPassword);
    }
    if (typeof email === 'string') patch['security.adminEmail'] = email;
    if (typeof phone === 'string') patch['security.adminPhone'] = phone;
    if (Object.keys(patch).length === 0) return err('لا يوجد ما يُحدَّث', 400);
    await db.collection('settings').updateOne({}, { $set: { ...patch, updatedAt: new Date().toISOString() } }, { upsert: true });
    await logActivity(db, { action: 'admin_credentials_updated', entity: 'admin', user: storedUsername, details: 'تحديث بيانات المدير', ip: clientIp });
    return ok({ success: true });
  }
  if (path === 'admin/login' && method === 'POST') {
    const { username, password } = await getJsonBody(request);
    // 🔄 SELF-HEALING: ensure settings.adminPasswordHash is seeded on fresh deploys
    let s = await db.collection('settings').findOne({}) || {};
    if (!s?.security?.adminPasswordHash) {
      console.log('[admin/login] No admin password set — running seed...');
      await ensureSuperAdminSeeded(db);
      s = await db.collection('settings').findOne({}) || {};
    }
    const u = s?.security?.adminUsername || 'admin';
    const h = s?.security?.adminPasswordHash;
    // If no admin password is configured yet → accept default fallback admin/admin OR admin/admin1982
    if (!h) {
      if (username === 'admin' && (password === 'admin' || password === 'admin1982')) {
        await logActivity(db, { action: 'admin_login', entity: 'admin', user: 'admin', details: 'دخول بإعدادات افتراضية', ip: clientIp });
        return ok({ success: true, username: 'admin', defaultCredentials: true });
      }
      return err('بيانات الدخول غير صحيحة', 401);
    }
    if (username !== u) return err('بيانات الدخول غير صحيحة', 401);
    const okPw = await verifyPassword(password, h);
    if (!okPw) {
      await logActivity(db, { action: 'admin_login_failed', entity: 'admin', user: username, details: 'كلمة المرور خاطئة', ip: clientIp });
      return err('بيانات الدخول غير صحيحة', 401);
    }
    await logActivity(db, { action: 'admin_login', entity: 'admin', user: u, details: 'دخول ناجح', ip: clientIp });
    return ok({ success: true, username: u });
  }

  // ============ SUBSCRIBERS SEARCH (for repair tasks autocomplete) ============
  if (path === 'subscribers/search' && method === 'GET') {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) return ok([]);
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const items = await db.collection('subscribers').find({
      $or: [{ name: re }, { phone: re }, { username: re }, { ipAddress: re }],
    }).limit(20).toArray();
    return ok(items.map(s => {
      delete s._id;
      return { id: s.id, name: s.name, phone: s.phone, username: s.username, zoneName: s.zoneName, ipAddress: s.ipAddress, address: s.address, userLat: s.userLat, userLng: s.userLng, status: s.status };
    }));
  }

  // ============ REAL-TIME EVENTS (Server-Sent Events) ============
  if (path === 'events/stream' && method === 'GET') {
    const encoder = new TextEncoder();
    const url = new URL(request.url);
    const sinceParam = url.searchParams.get('since');
    let lastTs = sinceParam ? parseInt(sinceParam) || Date.now() : Date.now();

    const stream = new ReadableStream({
      async start(controller) {
        let active = true;
        const send = (event, payload) => {
          if (!active) return;
          try {
            const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
          } catch {}
        };
        send('hello', { ts: Date.now(), msg: 'connected' });

        const tick = async () => {
          if (!active) return;
          try {
            const sinceDate = new Date(lastTs).toISOString();
            const events = await db.collection('events').find({
              ts: { $gt: sinceDate },
            }).sort({ ts: 1 }).limit(50).toArray();
            for (const e of events) {
              delete e._id;
              send(e.type || 'update', e);
              const t = new Date(e.ts).getTime();
              if (t > lastTs) lastTs = t;
            }
            // Heartbeat
            send('ping', { ts: Date.now() });
          } catch (e) {
            send('error', { error: e.message });
          }
        };
        const interval = setInterval(tick, 3000);

        // Cleanup on abort
        request.signal.addEventListener('abort', () => {
          active = false;
          clearInterval(interval);
          try { controller.close(); } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  // ============ EMPLOYEE LIVE LOCATION (during task) ============
  if (path.match(/^employees\/[^/]+\/location$/) && method === 'POST') {
    const empId = path.split('/')[1];
    const { lat, lng, accuracy, taskId, source } = await getJsonBody(request);
    if (typeof lat !== 'number' || typeof lng !== 'number') return err('إحداثيات غير صالحة', 400);
    const now = new Date().toISOString();
    const emp = await db.collection('employees').findOne({ id: empId });
    if (!emp) return err('الموظف غير موجود', 404);

    await db.collection('employees').updateOne(
      { id: empId },
      { $set: { lastLat: lat, lastLng: lng, lastAccuracy: accuracy || null, lastLocationAt: now } }
    );
    // Log into employee_locations history
    await db.collection('employee_locations').insertOne({
      id: uuidv4(), employeeId: empId, employeeName: emp.name,
      lat, lng, accuracy: accuracy || null, taskId: taskId || null, source: source || 'manual', ts: now,
    });
    // If linked to task, also update task
    if (taskId) {
      await db.collection('tasks').updateOne({ id: taskId }, { $set: { employeeLat: lat, employeeLng: lng, employeeLocationAt: now } });
    }
    // Emit event
    await db.collection('events').insertOne({
      id: uuidv4(), type: 'employee_location', employeeId: empId, employeeName: emp.name,
      lat, lng, accuracy, taskId, ts: now,
    });
    return ok({ success: true });
  }

  // ============ LOCATION UPDATE REQUESTS (employee → admin approval) ============
  if (path === 'location-update-requests' && method === 'GET') {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const q = status ? { status } : {};
    const items = await db.collection('location_update_requests').find(q).sort({ createdAt: -1 }).limit(200).toArray();
    return ok(items.map(x => { delete x._id; return x; }));
  }
  if (path === 'location-update-requests' && method === 'POST') {
    const body = await getJsonBody(request);
    const { subscriberId, newLat, newLng, employeeId, employeeName, taskId, notes } = body;
    if (!subscriberId || typeof newLat !== 'number' || typeof newLng !== 'number') return err('بيانات ناقصة', 400);
    const sub = await db.collection('subscribers').findOne({ id: subscriberId });
    if (!sub) return err('المشترك غير موجود', 404);
    const now = new Date().toISOString();
    const doc = {
      id: uuidv4(),
      subscriberId, subscriberName: sub.name, subscriberPhone: sub.phone,
      oldLat: sub.userLat ?? null, oldLng: sub.userLng ?? null,
      newLat, newLng,
      employeeId, employeeName, taskId: taskId || null,
      notes: notes || '',
      status: 'pending',
      createdAt: now,
    };
    await db.collection('location_update_requests').insertOne(doc);
    delete doc._id;
    await notifyManager(db, {
      type: 'location_update_request',
      title: `📍 طلب تعديل موقع مشترك`,
      message: `الموظف ${employeeName || '-'} طلب تعديل موقع المشترك ${sub.name}`,
    });
    await db.collection('events').insertOne({
      id: uuidv4(), type: 'location_request_new', requestId: doc.id, subscriberId,
      subscriberName: sub.name, employeeName, ts: now,
    });
    return ok(doc, 201);
  }
  if (path.match(/^location-update-requests\/[^/]+\/approve$/) && method === 'POST') {
    const id = path.split('/')[1];
    const r = await db.collection('location_update_requests').findOne({ id });
    if (!r) return err('غير موجود', 404);
    if (r.status !== 'pending') return err('الطلب ليس قيد الانتظار', 400);
    const now = new Date().toISOString();
    await db.collection('subscribers').updateOne({ id: r.subscriberId }, { $set: { userLat: r.newLat, userLng: r.newLng, locationUpdatedAt: now, locationUpdatedBy: r.employeeName } });
    await db.collection('location_update_requests').updateOne({ id }, { $set: { status: 'approved', resolvedAt: now } });
    await logActivity(db, { action: 'location_update_approved', entity: 'subscribers', entityId: r.subscriberId, user: 'المدير', details: `قبول تعديل موقع ${r.subscriberName} من ${r.employeeName}`, ip: clientIp });
    // notify employee
    if (r.employeeId) {
      await db.collection('notifications').insertOne({
        id: uuidv4(), userId: r.employeeId, type: 'location_request_approved',
        title: '✅ تم قبول تعديل الموقع',
        message: `تم قبول تعديل موقع المشترك ${r.subscriberName}`,
        read: false, createdAt: now,
      });
    }
    await db.collection('events').insertOne({ id: uuidv4(), type: 'location_request_approved', requestId: id, subscriberId: r.subscriberId, ts: now });
    return ok({ success: true });
  }
  if (path.match(/^location-update-requests\/[^/]+\/reject$/) && method === 'POST') {
    const id = path.split('/')[1];
    const { reason } = await getJsonBody(request);
    const r = await db.collection('location_update_requests').findOne({ id });
    if (!r) return err('غير موجود', 404);
    const now = new Date().toISOString();
    await db.collection('location_update_requests').updateOne({ id }, { $set: { status: 'rejected', rejectionReason: reason || '', resolvedAt: now } });
    if (r.employeeId) {
      await db.collection('notifications').insertOne({
        id: uuidv4(), userId: r.employeeId, type: 'location_request_rejected',
        title: '❌ تم رفض تعديل الموقع',
        message: `سبب الرفض: ${reason || '-'}`,
        read: false, createdAt: now,
      });
    }
    await db.collection('events').insertOne({ id: uuidv4(), type: 'location_request_rejected', requestId: id, ts: now });
    return ok({ success: true });
  }

  // ============ POS MANAGER REPORTS ============
  if (path === 'pos/manager-dashboard' && method === 'GET') {
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const employeeId = url.searchParams.get('employeeId');
    const paymentMethod = url.searchParams.get('paymentMethod');
    const productId = url.searchParams.get('productId');
    const invoiceQ = (url.searchParams.get('invoice') || '').trim();
    const minDiscount = Number(url.searchParams.get('minDiscount') || 0);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Build filter
    const filter = {};
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from).toISOString();
      if (to) {
        const t = new Date(to); t.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = t.toISOString();
      }
    }
    if (employeeId) filter.cashierId = employeeId;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (invoiceQ) filter.invoiceNumber = { $regex: invoiceQ, $options: 'i' };

    const sales = await db.collection('sales').find(filter).sort({ createdAt: -1 }).limit(2000).toArray();
    let filtered = sales;
    if (productId) {
      filtered = sales.filter(s => (s.items || []).some(it => it.productId === productId || it.id === productId));
    }
    if (minDiscount > 0) {
      filtered = filtered.filter(s => Number(s.discount || 0) >= minDiscount);
    }

    // Aggregate
    const todaySales = sales.filter(s => new Date(s.createdAt) >= today);
    const monthSales = sales.filter(s => new Date(s.createdAt) >= monthStart);
    const sum = (arr, field = 'total') => arr.reduce((s, x) => s + Number(x[field] || 0), 0);

    // By employee
    const byEmployee = {};
    for (const s of filtered) {
      const k = s.cashierId || 'unknown';
      if (!byEmployee[k]) byEmployee[k] = { id: k, name: s.cashierName || 'غير معروف', invoices: 0, totalSales: 0, totalDiscount: 0, totalItems: 0 };
      byEmployee[k].invoices++;
      byEmployee[k].totalSales += Number(s.total || 0);
      byEmployee[k].totalDiscount += Number(s.discount || 0);
      byEmployee[k].totalItems += (s.items || []).reduce((a, it) => a + Number(it.quantity || 0), 0);
    }
    const employeesReport = Object.values(byEmployee).sort((a, b) => b.totalSales - a.totalSales);

    // Top products
    const productMap = {};
    for (const s of filtered) {
      for (const it of (s.items || [])) {
        const k = it.productId || it.id || it.name;
        if (!productMap[k]) productMap[k] = { id: k, name: it.name, sku: it.sku, qty: 0, revenue: 0 };
        productMap[k].qty += Number(it.quantity || 0);
        productMap[k].revenue += Number(it.price || 0) * Number(it.quantity || 0);
      }
    }
    const topProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 20);

    // Discounts breakdown
    const discounts = filtered.filter(s => Number(s.discount || 0) > 0).map(s => ({
      saleId: s.id,
      invoiceNumber: s.invoiceNumber,
      cashierId: s.cashierId,
      cashierName: s.cashierName,
      discount: Number(s.discount || 0),
      subtotal: Number(s.subtotal || s.total || 0) + Number(s.discount || 0),
      total: Number(s.total || 0),
      reason: s.discountReason || '',
      requiresApproval: !!s.requiresApproval,
      approved: !!s.approved,
      createdAt: s.createdAt,
      paymentMethod: s.paymentMethod,
    }));

    // Payment methods breakdown
    const byPayment = {};
    for (const s of filtered) {
      const k = s.paymentMethod || 'cash';
      if (!byPayment[k]) byPayment[k] = { method: k, count: 0, total: 0 };
      byPayment[k].count++;
      byPayment[k].total += Number(s.total || 0);
    }

    // Strip _id
    const cleanSales = filtered.slice(0, 500).map(s => {
      delete s._id;
      return s;
    });

    return ok({
      summary: {
        todayCount: todaySales.length,
        todayTotal: sum(todaySales),
        todayDiscount: sum(todaySales, 'discount'),
        monthCount: monthSales.length,
        monthTotal: sum(monthSales),
        monthDiscount: sum(monthSales, 'discount'),
        rangeCount: filtered.length,
        rangeTotal: sum(filtered),
        rangeDiscount: sum(filtered, 'discount'),
        rangeProfit: filtered.reduce((s, x) => s + Number(x.profit || 0), 0),
        topEmployee: employeesReport[0] || null,
        topProduct: topProducts[0] || null,
      },
      employeesReport,
      topProducts,
      discounts,
      byPayment: Object.values(byPayment),
      sales: cleanSales,
    });
  }

  // Cancel sale (admin only)
  if (path.match(/^sales\/[^/]+\/cancel$/) && method === 'POST') {
    const saleId = path.split('/')[1];
    const { reason } = await getJsonBody(request);
    const s = await db.collection('sales').findOne({ id: saleId });
    if (!s) return err('الفاتورة غير موجودة', 404);
    if (s.cancelled) return err('الفاتورة ملغاة مسبقاً', 400);
    const now = new Date().toISOString();
    await db.collection('sales').updateOne({ id: saleId }, { $set: { cancelled: true, cancelledAt: now, cancelReason: reason || '', status: 'cancelled' } });
    // Return stock for each item
    for (const it of (s.items || [])) {
      if (it.productId || it.id) {
        await db.collection('products').updateOne({ id: it.productId || it.id }, { $inc: { stock: Number(it.quantity || 0) } });
      }
    }
    await logActivity(db, { action: 'sale_cancelled', entity: 'sales', entityId: saleId, user: 'المدير', details: `إلغاء فاتورة ${s.invoiceNumber || saleId} (${Number(s.total || 0).toLocaleString()} د.ع)${reason ? ' - السبب: ' + reason : ''}`, ip: clientIp });
    return ok({ success: true });
  }

  // ============ CUSTOM FIELDS (Dynamic Schema Per Entity) ============
  // Supported entities: subscribers, networks, zones, employees, products, agents, repairs, tasks
  const ALLOWED_CF_ENTITIES = ['subscribers', 'networks', 'zones', 'employees', 'products', 'agents', 'repairs', 'tasks'];
  if (path === 'custom-fields' && method === 'GET') {
    // Get all entities at once
    const docs = await db.collection('custom_fields').find({}).toArray();
    const out = {};
    for (const ent of ALLOWED_CF_ENTITIES) {
      const d = docs.find(x => x.entity === ent);
      out[ent] = d ? (d.fields || []) : [];
    }
    return ok(out);
  }
  if (path.match(/^custom-fields\/[a-z_]+$/) && method === 'GET') {
    const entity = path.split('/')[1];
    if (!ALLOWED_CF_ENTITIES.includes(entity)) return err('نوع غير مدعوم', 400);
    const d = await db.collection('custom_fields').findOne({ entity });
    return ok({ entity, fields: d?.fields || [] });
  }
  if (path.match(/^custom-fields\/[a-z_]+$/) && method === 'PUT') {
    const entity = path.split('/')[1];
    if (!ALLOWED_CF_ENTITIES.includes(entity)) return err('نوع غير مدعوم', 400);
    const { fields } = await getJsonBody(request);
    if (!Array.isArray(fields)) return err('fields يجب أن تكون مصفوفة', 400);
    // Validate each field structure
    const validTypes = ['text', 'number', 'date', 'datetime', 'boolean', 'select', 'multiselect', 'textarea', 'phone', 'email', 'url', 'currency', 'percent'];
    for (const f of fields) {
      if (!f.key || typeof f.key !== 'string' || !/^[a-z][a-z0-9_]{0,30}$/.test(f.key)) {
        return err(`المفتاح "${f.key || ''}" غير صالح - يجب أن يبدأ بحرف صغير ويحتوي على حروف وأرقام و_ فقط`, 400);
      }
      if (!f.label || typeof f.label !== 'string') return err('label مطلوب لكل حقل', 400);
      if (!f.type || !validTypes.includes(f.type)) return err(`نوع غير مدعوم: ${f.type}`, 400);
      if (['select', 'multiselect'].includes(f.type) && !Array.isArray(f.options)) {
        return err(`الحقل ${f.label} من نوع ${f.type} يحتاج قائمة options`, 400);
      }
    }
    // Reject duplicate keys
    const keys = fields.map(f => f.key);
    if (keys.length !== new Set(keys).size) return err('مفاتيح مكررة', 400);
    const now = new Date().toISOString();
    await db.collection('custom_fields').updateOne(
      { entity },
      { $set: { entity, fields, updatedAt: now } },
      { upsert: true }
    );
    await logActivity(db, { action: 'custom_fields_updated', entity, details: `تحديث ${fields.length} حقل مخصص لـ ${entity}`, ip: clientIp });
    return ok({ entity, fields });
  }

  const collections = {
    'products': 'products',
    'subscribers': 'subscribers',
    'zones': 'zones',
    'repairs': 'repairs',
    'employees': 'employees',
    'customers': 'customers',
    'sales': 'sales',
    'camera-contracts': 'camera_contracts',
    'agents': 'agents',
    'networks': 'networks',
    'packages': 'packages',
    'activations': 'activations',
    'whatsapp-messages': 'whatsapp_messages',
    'activity-logs': 'activity_logs',
    'attendance': 'attendance',
    'tasks': 'tasks',
    'payroll-entries': 'payroll_entries',
  };

  // Hash password when creating an employee
  if (path === 'employees' && method === 'POST') {
    const body = await getJsonBody(request);
    if (body.password) body.password = await hashPassword(body.password);
    const doc = { id: uuidv4(), ...body, createdAt: new Date().toISOString() };
    await db.collection('employees').insertOne(doc);
    delete doc._id;
    await logActivity(db, { action: 'employee_created', entity: 'employees', entityId: doc.id, user: 'المدير', details: `إضافة موظف ${doc.name}`, ip: clientIp });
    return ok(doc, 201);
  }
  // Hash password when updating an employee (only if password provided)
  if (path.match(/^employees\/[^/]+$/) && method === 'PUT' && !path.includes('/repairs/')) {
    const id = path.split('/')[1];
    const body = await getJsonBody(request);
    delete body._id; delete body.id;
    if (body.password) {
      if (!isBcrypt(body.password)) body.password = await hashPassword(body.password);
    } else {
      delete body.password; // don't clobber if not provided
    }
    await db.collection('employees').updateOne({ id }, { $set: body });
    const updated = await db.collection('employees').findOne({ id });
    if (updated) { delete updated._id; delete updated.password; }
    await logActivity(db, { action: 'employee_updated', entity: 'employees', entityId: id, user: 'المدير', details: `تعديل موظف ${updated?.name || ''}`, ip: clientIp });
    return ok(updated);
  }

  // Special-case: when creating a task, default status='pending' and notify assignee
  if (path === 'tasks' && method === 'POST') {
    const body = await getJsonBody(request);
    const now = new Date().toISOString();
    const doc = {
      id: uuidv4(),
      ...body,
      status: body.status || 'pending',
      progress: body.progress || 0,
      attachments: body.attachments || [],
      notes: body.notes || '',
      createdAt: now,
    };
    await db.collection('tasks').insertOne(doc);
    delete doc._id;
    if (doc.assignedTo) {
      await notifyEmployee(db, {
        employeeId: doc.assignedTo, type: 'task_new', icon: '📋',
        title: '📋 مهمة جديدة',
        message: `وُكِّلت إليك مهمة "${doc.title}" بأولوية ${doc.priority || 'متوسطة'}. يرجى القبول أو الرفض`,
        entityType: 'task', entityId: doc.id,
        priority: (doc.priority === 'urgent' || doc.priority === 'high') ? 'high' : 'normal',
      });
    }
    await logActivity(db, { action: 'task_created', entity: 'tasks', entityId: doc.id, user: doc.createdBy || 'المدير', details: `إنشاء مهمة "${doc.title}" للموظف ${doc.assignedToName}`, ip: clientIp });
    // Real-time event
    await db.collection('events').insertOne({
      id: uuidv4(), type: 'task_new',
      taskId: doc.id, title: doc.title, assignedTo: doc.assignedTo, assignedToName: doc.assignedToName,
      priority: doc.priority, taskType: doc.taskType || 'general',
      ts: now,
    });
    return ok(doc, 201);
  }

  // Special-case: when creating a subscriber, send notification to manager
  if (path === 'subscribers' && method === 'POST') {
    const body = await getJsonBody(request);
    const doc = { id: uuidv4(), ...body, createdAt: new Date().toISOString() };
    await db.collection('subscribers').insertOne(doc);
    delete doc._id;
    if (doc.zoneId) {
      const c = await db.collection('subscribers').countDocuments({ zoneId: doc.zoneId });
      await db.collection('zones').updateOne({ id: doc.zoneId }, { $set: { subscribers: c } });
    }
    await logActivity(db, { action: 'subscriber_created', entity: 'subscribers', entityId: doc.id, user: 'المدير', details: `مشترك جديد: ${doc.name}`, ip: clientIp });
    await sendTelegram(db, `<b>👤 مشترك جديد</b>\nالاسم: ${doc.name}\nالمنطقة: ${doc.zoneName || '-'}\nالباقة: ${doc.speed || '-'}`);
    return ok(doc, 201);
  }

  for (const [route, coll] of Object.entries(collections)) {
    if (path === route && method === 'GET') {
      const data = await db.collection(coll).find({}).sort({ createdAt: -1 }).toArray();
      return ok(data.map(d => { delete d._id; return d; }));
    }
    if (path === route && method === 'POST') {
      const body = await getJsonBody(request);
      const doc = { id: uuidv4(), ...body, createdAt: new Date().toISOString() };
      if (coll === 'repairs' && !doc.ticketNumber) {
        const count = await db.collection('repairs').countDocuments();
        doc.ticketNumber = `RP-${1000 + count + 1}`;
      }
      await db.collection(coll).insertOne(doc);
      delete doc._id;
      if (coll === 'subscribers' && doc.zoneId) {
        const c = await db.collection('subscribers').countDocuments({ zoneId: doc.zoneId });
        await db.collection('zones').updateOne({ id: doc.zoneId }, { $set: { subscribers: c } });
      }
      return ok(doc, 201);
    }
    if (path.startsWith(route + '/') && method === 'PUT') {
      // Skip if path has sub-resources (e.g., employees/X/repairs/Y) - handled by specific routes
      if (path.split('/').length > 2) continue;
      const id = path.split('/')[1];
      const body = await getJsonBody(request);
      delete body._id; delete body.id;
      await db.collection(coll).updateOne({ id }, { $set: body });
      const updated = await db.collection(coll).findOne({ id });
      if (updated) delete updated._id;
      return ok(updated);
    }
    if (path.startsWith(route + '/') && method === 'DELETE') {
      if (path.split('/').length > 2) continue;
      const id = path.split('/')[1];
      const doc = await db.collection(coll).findOne({ id });
      await db.collection(coll).deleteOne({ id });
      if (coll === 'subscribers' && doc?.zoneId) {
        const c = await db.collection('subscribers').countDocuments({ zoneId: doc.zoneId });
        await db.collection('zones').updateOne({ id: doc.zoneId }, { $set: { subscribers: c } });
      }
      return ok({ success: true });
    }
  }

  // ============ SUBSCRIBER ACTIVATION (مهم جداً) ============
  if (path.match(/^subscribers\/[^/]+\/activate$/) && method === 'POST') {
    const subId = path.split('/')[1];
    const body = await getJsonBody(request);
    const { packageId, speed, amount, paymentMethod = 'cash', durationMonths = 1, agentId, notes = '', processedBy = 'النظام', skipApprovalCheck = false } = body;
    const subscriber = await db.collection('subscribers').findOne({ id: subId });
    if (!subscriber) return err('المشترك غير موجود', 404);
    const pkg = packageId ? await db.collection('packages').findOne({ id: packageId }) : null;
    const agent = agentId ? await db.collection('agents').findOne({ id: agentId }) : null;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationMonths * 30 * 86400000);
    const finalSpeed = speed || pkg?.speed || subscriber.package || '50 Mbps';
    const finalAmount = Number(amount || pkg?.monthlyFee * durationMonths || 0);

    // ============ AGENT PROFIT CALC (3 modes: percentage / fixed_per_activation / fixed_per_package) ============
    let agentProfit = 0;
    if (agent) {
      const mode = agent.profitMode || 'percentage';
      if (mode === 'fixed_per_activation') {
        agentProfit = Math.floor(Number(agent.fixedProfitPerActivation || 0));
      } else if (mode === 'fixed_per_package') {
        const map = agent.fixedProfitsByPackage || {};
        // Try by package ID first, fallback to speed key, fallback to default
        agentProfit = Math.floor(Number(map[pkg?.id] ?? map[finalSpeed] ?? agent.fixedProfitPerActivation ?? 0));
      } else {
        // legacy percentage mode
        const commissionRate = Number(agent.commission || 0);
        agentProfit = Math.floor(finalAmount * commissionRate / 100);
      }
    }
    const companyProfit = finalAmount - agentProfit;

    // ============ ADMIN APPROVAL CHECK ============
    // If agent has requireAdminApproval=true and this isn't an admin override, queue as pending
    if (agent && agent.permissions?.requireAdminApproval && !skipApprovalCheck) {
      const pendingDoc = {
        id: uuidv4(),
        type: 'agent_activation',
        subscriberId: subId,
        subscriberName: subscriber.name,
        subscriberPhone: subscriber.phone,
        username: subscriber.username || '',
        packageId: pkg?.id || null,
        packageName: pkg?.name || finalSpeed,
        speed: finalSpeed,
        amount: finalAmount,
        paymentMethod,
        durationMonths,
        agentId: agent.id,
        agentName: agent.name,
        agentProfit,
        companyProfit,
        notes,
        status: 'pending',
        requestedBy: processedBy,
        requestedAt: new Date().toISOString(),
        approvedBy: null,
        approvedAt: null,
        rejectionReason: null,
      };
      await db.collection('pending_activations').insertOne({ ...pendingDoc });
      delete pendingDoc._id;
      // Notify admin
      await notifyManager(db, {
        type: 'pending_activation',
        title: `⏳ طلب تفعيل بانتظار موافقتك`,
        message: `الوكيل: ${agent.name}\nالمشترك: ${subscriber.name}\nالباقة: ${pendingDoc.packageName}\nالمبلغ: ${finalAmount.toLocaleString('en-US')} د.ع`,
        entityType: 'pending_activation',
        entityId: pendingDoc.id,
        priority: 'high',
        icon: '⏳',
      });
      await logActivity(db, { action: 'pending_activation_created', entity: 'pending_activations', entityId: pendingDoc.id, user: agent.name, userId: agent.id, details: `طلب تفعيل ${subscriber.name} - ${pendingDoc.packageName}`, ip: clientIp });
      return ok({ pending: true, request: pendingDoc, message: 'تم إرسال طلب التفعيل للمدير للموافقة' }, 202);
    }

    // Create activation record
    const activation = {
      id: uuidv4(),
      subscriberId: subId,
      subscriberName: subscriber.name,
      subscriberPhone: subscriber.phone,
      username: subscriber.username || `user_${(subscriber.phone || '').slice(-4)}`,
      packageId: pkg?.id || null,
      packageName: pkg?.name || subscriber.package || finalSpeed,
      speed: finalSpeed,
      amount: finalAmount,
      paymentMethod,
      durationMonths,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      agentId: agent?.id || null,
      agentName: agent?.name || 'المركز الرئيسي',
      agentProfit,
      companyProfit,
      processedBy,
      notes,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };
    await db.collection('activations').insertOne(activation);
    delete activation._id;

    // Update subscriber
    await db.collection('subscribers').updateOne({ id: subId }, {
      $set: {
        status: 'active',
        package: finalSpeed,
        fee: pkg?.monthlyFee || subscriber.fee || finalAmount,
        debt: 0,
        dueDate: endDate.toISOString().slice(0, 10),
        agentId: agent?.id || subscriber.agentId,
        agentName: agent?.name || subscriber.agentName,
        lastActivationAt: new Date().toISOString(),
      }
    });

    // Update agent stats
    if (agent) {
      await db.collection('agents').updateOne({ id: agent.id }, {
        $inc: { totalActivations: 1, totalProfit: agentProfit, balance: agentProfit },
      });
    }

    // ============ AUTO-DEDUCT BALANCE (تسقيط تلقائي) ============
    // Map payment method to balance account key
    const balanceKeyMap = { fastpay: 'fast', master: 'master', transfer: 'management', cash: 'cash' };
    const balanceKey = balanceKeyMap[paymentMethod];
    if (balanceKey) {
      try {
        const acc = await db.collection('balance_accounts').findOne({ key: balanceKey, enabled: { $ne: false } });
        if (acc) {
          const newBalance = Number(acc.balance || 0) - finalAmount;
          await db.collection('balance_accounts').updateOne({ id: acc.id }, { $set: { balance: newBalance, updatedAt: new Date().toISOString() } });
          await db.collection('balance_transactions').insertOne({
            id: uuidv4(), accountId: acc.id, accountName: acc.name, type: 'auto_deduct',
            amount: finalAmount, balanceBefore: Number(acc.balance || 0), balanceAfter: newBalance,
            description: `تفعيل اشتراك: ${subscriber.name} - ${activation.packageName}`,
            linkedEntity: 'activation', linkedEntityId: activation.id,
            subscriberId: subId, subscriberName: subscriber.name,
            createdBy: 'system', createdByName: 'تسقيط تلقائي',
            createdAt: new Date().toISOString(),
          });
          if (newBalance < 0) {
            await createNotification(db, {
              type: 'balance_overdraft', icon: '⚠️', priority: 'critical',
              title: `تحذير: ${acc.name} في السالب`,
              message: `بعد تفعيل ${subscriber.name}: الرصيد ${newBalance.toLocaleString()} د.ع`,
              entityType: 'generic',
            });
          }
        }
      } catch (e) { console.warn('[activation] balance deduct error:', e?.message); }
    }
    // ============ END AUTO-DEDUCT ============

    // Build WhatsApp message via template (with full subscriber + activation context)
    const settingsDoc = (await db.collection('settings').findOne({})) || {};
    const _tpls = { ...WA_DEFAULT_TEMPLATES, ...(settingsDoc?.whatsappTemplates || {}) };
    const _activationTpl = _tpls.activation;
    const _vars = await buildSubscriberVars(db, subscriber, {
      packageName: activation.packageName,
      speed: finalSpeed,
      amount: finalAmount,
      paid: paymentMethod === 'cash' ? finalAmount : (Number(activation.paidAmount) || finalAmount),
      remaining: Math.max(0, finalAmount - (paymentMethod === 'cash' ? finalAmount : (Number(activation.paidAmount) || finalAmount))),
      startDate: startDate.toLocaleDateString('ar-IQ'),
      endDate: endDate.toLocaleDateString('ar-IQ'),
      receiptNo: activation.receiptNo || subId.slice(0, 8).toUpperCase(),
      office: activation.agentName,
    });
    const waMsg = fillWaTemplate(_activationTpl, _vars);

    // Send via WhatsApp service (or queue if not configured) — persists message record automatically
    let waSendResult = { success: false };
    try {
      waSendResult = await dispatchWhatsApp(db, {
        subscriberId: subId,
        subscriberName: subscriber.name,
        phone: subscriber.phone,
        type: 'activation',
        message: waMsg,
        activationId: activation.id,
      });
    } catch (e) {
      console.warn('[activation] WA dispatch error:', e?.message);
    }
    const waLog = waSendResult.message || { id: uuidv4(), status: 'queued' };

    // Manager notification (Telegram log + WhatsApp manager copy)
    const managerMsg = `🔔 *تفعيل جديد*
👤 ${subscriber.name} (${subscriber.phone})
📦 ${activation.packageName} - ${finalSpeed}
💰 ${finalAmount.toLocaleString()} د.ع (${paymentMethod})
👨‍💼 ${activation.agentName}
⏰ ينتهي: ${endDate.toLocaleDateString('ar-IQ')}`;
    // If settings.whatsapp.sendToManager + managerPhone are set, actually send via service
    const _waSettings = settingsDoc?.whatsapp || SETTINGS_DEFAULTS.whatsapp;
    if (_waSettings?.sendToManager && _waSettings?.managerPhone && waIsConfigured()) {
      try {
        await dispatchWhatsApp(db, {
          subscriberId: subId,
          subscriberName: subscriber.name,
          phone: _waSettings.managerPhone,
          type: 'manager_alert',
          message: managerMsg,
          activationId: activation.id,
        });
      } catch (e) { console.warn('[activation] manager WA error:', e?.message); }
    } else {
      // Fallback: persist as queued only (legacy behavior)
      await db.collection('whatsapp_messages').insertOne({
        id: uuidv4(), subscriberId: subId, activationId: activation.id, phone: 'MANAGER',
        type: 'manager_alert', message: managerMsg, status: 'queued', retries: 0,
        createdAt: new Date().toISOString(),
      });
    }

    // Activity log
    await db.collection('activity_logs').insertOne({
      id: uuidv4(),
      user: processedBy,
      action: 'subscriber_activation',
      entity: 'subscriber',
      entityId: subId,
      details: `تفعيل ${subscriber.name} بباقة ${activation.packageName} لمدة ${durationMonths} شهر بمبلغ ${finalAmount.toLocaleString()} د.ع`,
      timestamp: new Date().toISOString(),
    });

    // Real-time event
    await db.collection('events').insertOne({
      id: uuidv4(), type: 'subscriber_activated',
      subscriberId: subId, subscriberName: subscriber.name, subscriberPhone: subscriber.phone,
      amount: finalAmount, packageName: activation.packageName, speed: finalSpeed,
      ts: new Date().toISOString(),
    });

    return ok({ activation, whatsappMessage: waMsg, success: true }, 201);
  }

  // Resend WhatsApp message (actually attempt send via service)
  if (path.match(/^whatsapp-messages\/[^/]+\/resend$/) && method === 'POST') {
    const id = path.split('/')[1];
    const msg = await db.collection('whatsapp_messages').findOne({ id });
    if (!msg) return err('الرسالة غير موجودة', 404);
    await db.collection('whatsapp_messages').updateOne({ id }, {
      $inc: { retries: 1 },
      $set: { status: 'queued', lastRetryAt: new Date().toISOString() },
    });
    if (waIsConfigured() && msg.phone && msg.phone !== 'MANAGER') {
      const r = await waSend(msg.phone, msg.message || '');
      await db.collection('whatsapp_messages').updateOne({ id }, {
        $set: {
          status: r?.ok ? 'sent' : 'failed',
          sentAt: r?.ok ? new Date().toISOString() : null,
          externalId: r?.id || null,
          error: r?.ok ? null : (r?.error || 'send_failed'),
        },
      });
      return ok({ success: !!r?.ok, ...r });
    }
    return ok({ success: false, queued: true, message: 'تم وضعها في الطابور — لم يتم توصيل خدمة الواتساب' });
  }

  // ============ ACCOUNTING / FINANCIAL REPORTS ============
  if (path === 'accounting/summary' && method === 'GET') {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'month'; // day | month | year
    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().toISOString().slice(0, 7);
    const year = String(new Date().getFullYear());
    const prefix = period === 'day' ? today : period === 'year' ? year : month;

    const sales = await db.collection('sales').find({ createdAt: { $regex: `^${prefix}` } }).toArray();
    const activations = await db.collection('activations').find({ createdAt: { $regex: `^${prefix}` } }).toArray();
    const repairs = await db.collection('repairs').find({ createdAt: { $regex: `^${prefix}` }, status: 'completed' }).toArray();
    const payrollEntries = await db.collection('payroll_entries').find({ date: { $regex: `^${prefix}` } }).toArray();
    const advances = await db.collection('advances').find({ status: { $in: ['approved', 'paid'] } }).toArray();
    const employees = await db.collection('employees').find({}).toArray();

    // Revenue
    const salesRev = sales.reduce((s, x) => s + (x.total || 0), 0);
    const actsRev = activations.reduce((s, x) => s + (x.amount || 0), 0);
    const repairsRev = repairs.reduce((s, x) => s + (x.cost || 0), 0);
    const totalRevenue = salesRev + actsRev + repairsRev;

    // Expenses
    const bonuses = payrollEntries.filter(e => e.type === 'bonus').reduce((s, x) => s + (x.amount || 0), 0);
    const salariesExp = period === 'month' ? employees.reduce((s, e) => s + (e.salary || 0), 0) : 0;
    const advanceExp = period === 'month' ? advances.filter(a => a.status === 'approved').reduce((s, a) => s + (a.perInstallment || 0), 0) : 0;
    const totalExpenses = bonuses + salariesExp + advanceExp;
    const netProfit = totalRevenue - totalExpenses;

    // Debts
    const subscribers = await db.collection('subscribers').find({}).toArray();
    const debtors = subscribers.filter(s => (s.balance || 0) < 0);
    const totalDebt = Math.abs(debtors.reduce((s, x) => s + (x.balance || 0), 0));

    // Daily breakdown (last 30 days for chart)
    const breakdown = [];
    if (period === 'day') {
      const last30 = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        last30.push(d.toISOString().slice(0, 10));
      }
      const allSales = await db.collection('sales').find({}).toArray();
      const allActs = await db.collection('activations').find({}).toArray();
      for (const d of last30) {
        const s = allSales.filter(x => x.createdAt?.startsWith(d)).reduce((a, b) => a + (b.total || 0), 0);
        const a = allActs.filter(x => x.createdAt?.startsWith(d)).reduce((acc, b) => acc + (b.amount || 0), 0);
        breakdown.push({ label: d.slice(5), revenue: s + a });
      }
    } else if (period === 'month') {
      // 12 months of the year
      for (let m = 1; m <= 12; m++) {
        const mPrefix = `${year}-${String(m).padStart(2, '0')}`;
        const s = (await db.collection('sales').find({ createdAt: { $regex: `^${mPrefix}` } }).toArray()).reduce((a, b) => a + (b.total || 0), 0);
        const a = (await db.collection('activations').find({ createdAt: { $regex: `^${mPrefix}` } }).toArray()).reduce((acc, b) => acc + (b.amount || 0), 0);
        breakdown.push({ label: mPrefix, revenue: s + a });
      }
    }

    return ok({
      period, prefix,
      revenue: { sales: salesRev, activations: actsRev, repairs: repairsRev, total: totalRevenue },
      expenses: { bonuses, salaries: salariesExp, advances: advanceExp, total: totalExpenses },
      netProfit,
      debts: {
        count: debtors.length, total: totalDebt,
        topDebtors: debtors.sort((a, b) => (a.balance || 0) - (b.balance || 0)).slice(0, 10).map(d => ({
          id: d.id, name: d.name, zone: d.zoneName, amount: Math.abs(d.balance || 0),
        })),
      },
      counts: { sales: sales.length, activations: activations.length, repairs: repairs.length },
      breakdown,
    });
  }

  // ============ EXPORT ACCOUNTING TO XLSX ============
  if (path === 'accounting/export' && method === 'GET') {
    try {
      const XLSX = await import('xlsx');
      const url = new URL(request.url);
      const period = url.searchParams.get('period') || 'month';
      const today = new Date().toISOString().slice(0, 10);
      const month = new Date().toISOString().slice(0, 7);
      const year = String(new Date().getFullYear());
      const prefix = period === 'day' ? today : period === 'year' ? year : month;
      const periodLabel = period === 'day' ? 'اليوم' : period === 'year' ? 'السنة' : 'الشهر';

      // Re-collect data (same logic as summary)
      const sales = await db.collection('sales').find({ createdAt: { $regex: `^${prefix}` } }).toArray();
      const activations = await db.collection('activations').find({ createdAt: { $regex: `^${prefix}` } }).toArray();
      const repairs = await db.collection('repairs').find({ createdAt: { $regex: `^${prefix}` }, status: 'completed' }).toArray();
      const payrollEntries = await db.collection('payroll_entries').find({ date: { $regex: `^${prefix}` } }).toArray();
      const advances = await db.collection('advances').find({ status: { $in: ['approved', 'paid'] } }).toArray();
      const employees = await db.collection('employees').find({}).toArray();
      const subscribers = await db.collection('subscribers').find({}).toArray();

      const salesRev = sales.reduce((s, x) => s + (x.total || 0), 0);
      const actsRev = activations.reduce((s, x) => s + (x.amount || 0), 0);
      const repairsRev = repairs.reduce((s, x) => s + (x.cost || 0), 0);
      const totalRevenue = salesRev + actsRev + repairsRev;
      const bonuses = payrollEntries.filter(e => e.type === 'bonus').reduce((s, x) => s + (x.amount || 0), 0);
      const salariesExp = period === 'month' ? employees.reduce((s, e) => s + (e.salary || 0), 0) : 0;
      const advanceExp = period === 'month' ? advances.filter(a => a.status === 'approved').reduce((s, a) => s + (a.perInstallment || 0), 0) : 0;
      const totalExpenses = bonuses + salariesExp + advanceExp;
      const netProfit = totalRevenue - totalExpenses;
      const debtors = subscribers.filter(s => (s.balance || 0) < 0);
      const totalDebt = Math.abs(debtors.reduce((s, x) => s + (x.balance || 0), 0));

      const wb = XLSX.utils.book_new();

      // ===== Sheet 1: ملخص (Summary) =====
      const summary = [
        ['مركز الغزلان - التقرير المالي'],
        ['الفترة', periodLabel + ' (' + prefix + ')'],
        ['تاريخ التصدير', new Date().toLocaleString('ar-IQ')],
        [],
        ['الإيرادات'],
        ['مبيعات (POS)', salesRev, 'د.ع', sales.length + ' فاتورة'],
        ['تفعيل اشتراكات', actsRev, 'د.ع', activations.length + ' تفعيل'],
        ['صيانة مكتملة', repairsRev, 'د.ع', repairs.length + ' تذكرة'],
        ['إجمالي الإيرادات', totalRevenue, 'د.ع', ''],
        [],
        ['المصروفات'],
        ['مكافآت', bonuses, 'د.ع', ''],
        ['رواتب', salariesExp, 'د.ع', ''],
        ['أقساط سلف', advanceExp, 'د.ع', ''],
        ['إجمالي المصروفات', totalExpenses, 'د.ع', ''],
        [],
        ['صافي الربح', netProfit, 'د.ع', netProfit >= 0 ? '🟢 ربح' : '🔴 خسارة'],
        [],
        ['الديون المستحقة'],
        ['عدد المدينين', debtors.length, '', ''],
        ['إجمالي المبالغ', totalDebt, 'د.ع', ''],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summary);
      ws1['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 8 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'الملخص');

      // ===== Sheet 2: المبيعات =====
      if (sales.length > 0) {
        const salesRows = sales.map(s => ({
          'رقم الفاتورة': s.invoiceNumber || s.id,
          'التاريخ': s.createdAt,
          'العميل': s.customerName || '-',
          'الهاتف': s.customerPhone || '-',
          'الإجمالي': s.total || 0,
          'الخصم': s.discount || 0,
          'طريقة الدفع': s.paymentMethod || '-',
          'الموظف': s.cashierName || '-',
        }));
        const ws2 = XLSX.utils.json_to_sheet(salesRows);
        XLSX.utils.book_append_sheet(wb, ws2, 'المبيعات');
      }

      // ===== Sheet 3: التفعيلات =====
      if (activations.length > 0) {
        const actRows = activations.map(a => ({
          'التاريخ': a.createdAt,
          'المشترك': a.subscriberName || '-',
          'الباقة': a.packageName || '-',
          'المبلغ': a.amount || 0,
          'الموظف': a.activatedByName || '-',
          'ملاحظات': a.notes || '',
        }));
        const ws3 = XLSX.utils.json_to_sheet(actRows);
        XLSX.utils.book_append_sheet(wb, ws3, 'التفعيلات');
      }

      // ===== Sheet 4: الصيانة =====
      if (repairs.length > 0) {
        const repRows = repairs.map(r => ({
          'رقم التذكرة': r.ticketNumber || r.id,
          'التاريخ': r.createdAt,
          'العميل': r.customerName || '-',
          'الجهاز': r.deviceName || '-',
          'العطل': r.issue || '-',
          'التكلفة': r.cost || 0,
          'الفني': r.technicianName || '-',
        }));
        const ws4 = XLSX.utils.json_to_sheet(repRows);
        XLSX.utils.book_append_sheet(wb, ws4, 'الصيانة');
      }

      // ===== Sheet 5: المدينون =====
      if (debtors.length > 0) {
        const debtRows = debtors.sort((a, b) => (a.balance || 0) - (b.balance || 0)).map((d, i) => ({
          '#': i + 1,
          'الاسم': d.name,
          'الهاتف': d.phone || '-',
          'المنطقة': d.zoneName || '-',
          'المبلغ المستحق': Math.abs(d.balance || 0),
        }));
        const ws5 = XLSX.utils.json_to_sheet(debtRows);
        XLSX.utils.book_append_sheet(wb, ws5, 'المدينون');
      }

      // ===== Sheet 6: المصروفات (مكافآت) =====
      const bonusList = payrollEntries.filter(e => e.type === 'bonus');
      if (bonusList.length > 0) {
        const bRows = bonusList.map(b => ({
          'التاريخ': b.date,
          'الموظف': b.employeeName || '-',
          'النوع': b.type,
          'المبلغ': b.amount || 0,
          'السبب': b.reason || '-',
        }));
        const ws6 = XLSX.utils.json_to_sheet(bRows);
        XLSX.utils.book_append_sheet(wb, ws6, 'المكافآت');
      }

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const filename = `accounting_${prefix}_${Date.now()}.xlsx`;
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(buffer.length),
        },
      });
    } catch (e) {
      console.error('[accounting/export] error:', e);
      return err('فشل التصدير: ' + (e?.message || ''), 500);
    }
  }

  // ============ E-COMMERCE ORDERS ============
  if (path === 'orders' && method === 'GET') {
    const url = new URL(request.url);
    const phone = url.searchParams.get('phone');
    const q = phone ? { customerPhone: phone } : {};
    const items = await db.collection('orders').find(q).sort({ createdAt: -1 }).limit(500).toArray();
    return ok(items.map(x => { delete x._id; return x; }));
  }
  if (path === 'orders' && method === 'POST') {
    const body = await getJsonBody(request);
    const { customerName, customerPhone, customerAddress, items, paymentMethod, notes } = body;
    if (!customerName || !customerPhone || !Array.isArray(items) || items.length === 0) return err('بيانات الطلب ناقصة', 400);
    let subtotal = 0;
    const cleanItems = [];
    for (const it of items) {
      const p = await db.collection('products').findOne({ id: it.id });
      if (!p) continue;
      const qty = Math.max(1, Number(it.quantity || 1));
      const lineTotal = p.price * qty;
      subtotal += lineTotal;
      cleanItems.push({ id: p.id, name: p.name, price: p.price, quantity: qty, total: lineTotal });
    }
    if (cleanItems.length === 0) return err('لا توجد منتجات صالحة', 400);
    const shipping = subtotal >= 50000 ? 0 : 5000;
    // ===== COUPON SUPPORT =====
    let couponDiscount = 0;
    let appliedCoupon = null;
    if (body.couponCode) {
      const code = String(body.couponCode).toUpperCase().trim();
      const c = await db.collection('coupons').findOne({ code });
      if (c && c.active && (!c.expiresAt || new Date(c.expiresAt) > new Date()) && (c.maxUses === 0 || c.usedCount < c.maxUses) && subtotal >= (c.minOrder || 0)) {
        if (c.type === 'percent') couponDiscount = Math.round(subtotal * c.value / 100);
        else couponDiscount = Math.min(c.value, subtotal);
        appliedCoupon = { id: c.id, code: c.code, type: c.type, value: c.value, discount: couponDiscount };
        await db.collection('coupons').updateOne({ id: c.id }, { $inc: { usedCount: 1 } });
      }
    }
    const total = Math.max(0, subtotal + shipping - couponDiscount);
    const orderNumber = `ORD-${Date.now()}`;
    const doc = {
      id: uuidv4(), orderNumber,
      customerName, customerPhone, customerAddress: customerAddress || '',
      items: cleanItems, subtotal, shipping,
      coupon: appliedCoupon, couponDiscount,
      total,
      paymentMethod: paymentMethod || 'cod', notes: notes || '',
      status: 'pending', createdAt: new Date().toISOString(),
    };
    await db.collection('orders').insertOne(doc);
    delete doc._id;
    await logActivity(db, { action: 'order_created', entity: 'orders', entityId: doc.id, user: customerName, details: `طلب جديد ${orderNumber} بقيمة ${total.toLocaleString('en-US')} د.ع`, ip: clientIp });
    await notifyManager(db, {
      type: 'order_new', title: `🛒 طلب جديد: ${orderNumber}`,
      message: `العميل: ${customerName}\nالهاتف: ${customerPhone}\nالمنتجات: ${cleanItems.length}\nالإجمالي: ${total.toLocaleString('en-US')} د.ع`,
    });
    return ok(doc, 201);
  }
  if (path.match(/^orders\/[^/]+\/status$/) && method === 'POST') {
    const id = path.split('/')[1];
    const { status, notes } = await getJsonBody(request);
    const valid = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
    if (!valid.includes(status)) return err('حالة غير صالحة', 400);
    const o = await db.collection('orders').findOne({ id });
    if (!o) return err('غير موجود', 404);
    await db.collection('orders').updateOne({ id }, { $set: { status, adminNotes: notes || o.adminNotes, statusUpdatedAt: new Date().toISOString() } });
    // Decrement stock when delivered
    if (status === 'delivered' && o.status !== 'delivered') {
      for (const it of o.items) {
        if (it.id) await db.collection('products').updateOne({ id: it.id }, { $inc: { stock: -it.quantity } });
      }
    }
    await logActivity(db, { action: `order_${status}`, entity: 'orders', entityId: id, user: 'المدير', details: `${o.orderNumber} → ${status}`, ip: clientIp });
    return ok({ success: true });
  }
  if (path.match(/^orders\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[1];
    await db.collection('orders').deleteOne({ id });
    return ok({ success: true });
  }

  // ============ HR / EMPLOYEE ENDPOINTS ============
  if (path === 'employees/login' && method === 'POST') {
    const { username, password } = await getJsonBody(request);
    // 🔄 SELF-HEALING: ensure admin employee exists on fresh deploys
    if (username === 'admin') {
      const exists = await db.collection('employees').findOne({ username: 'admin' });
      if (!exists) {
        console.log('[employees/login] admin employee not found — running seed...');
        await ensureSuperAdminSeeded(db);
      }
    }
    const emp = await db.collection('employees').findOne({ username });
    if (!emp) {
      await logActivity(db, { action: 'login_failed', entity: 'employees', user: username, details: 'username not found', ip: clientIp });
      return err('بيانات الدخول خاطئة', 401);
    }
    const ok2 = await verifyPassword(password, emp.passwordHash || emp.password);
    if (!ok2) {
      await logActivity(db, { action: 'login_failed', entity: 'employees', user: username, userId: emp.id, details: 'wrong password', ip: clientIp });
      return err('بيانات الدخول خاطئة', 401);
    }
    // Upgrade legacy plaintext to bcrypt on successful login
    if (!isBcrypt(emp.password)) {
      const newHash = await hashPassword(password);
      await db.collection('employees').updateOne({ id: emp.id }, { $set: { password: newHash, passwordHash: newHash } });
    }
    delete emp._id;
    const token = `emp_${emp.id}_${Date.now()}`;
    await db.collection('sessions').insertOne({
      id: uuidv4(), token, employeeId: emp.id, employeeName: emp.name,
      ip: clientIp, userAgent: request.headers.get('user-agent') || '',
      createdAt: new Date().toISOString(), lastActivity: new Date().toISOString(), active: true,
    });
    await logActivity(db, { action: 'login_success', entity: 'employees', user: emp.name, userId: emp.id, details: 'تسجيل دخول ناجح', ip: clientIp });
    delete emp.password;
    delete emp.passwordHash;
    return ok({ success: true, employee: emp, token });
  }

  // Session validation (for idle logout)
  if (path === 'sessions/validate' && method === 'POST') {
    const { token } = await getJsonBody(request);
    if (!token) return err('غير مصرح', 401);
    const s = await db.collection('sessions').findOne({ token, active: true });
    if (!s) return err('انتهت الجلسة', 401);
    await db.collection('sessions').updateOne({ id: s.id }, { $set: { lastActivity: new Date().toISOString() } });
    return ok({ valid: true });
  }
  // Logout
  if (path === 'sessions/logout' && method === 'POST') {
    const { token } = await getJsonBody(request);
    if (token) {
      const s = await db.collection('sessions').findOne({ token });
      if (s) {
        await db.collection('sessions').updateOne({ id: s.id }, { $set: { active: false, loggedOutAt: new Date().toISOString() } });
        await logActivity(db, { action: 'logout', entity: 'employees', user: s.employeeName, userId: s.employeeId, ip: clientIp });
      }
    }
    return ok({ success: true });
  }
  // Sessions list (admin)
  if (path === 'sessions' && method === 'GET') {
    const sessions = await db.collection('sessions').find({}).sort({ createdAt: -1 }).limit(200).toArray();
    return ok(sessions.map(s => { delete s._id; return s; }));
  }
  // Terminate session (admin)
  if (path.match(/^sessions\/[^/]+\/terminate$/) && method === 'POST') {
    const id = path.split('/')[1];
    await db.collection('sessions').updateOne({ id }, { $set: { active: false, terminatedAt: new Date().toISOString() } });
    return ok({ success: true });
  }

  // ============ ACTIVITY LOGS VIEWER ============
  if (path === 'activity-logs' && method === 'GET') {
    const url = new URL(request.url);
    const limit = Math.min(1000, Number(url.searchParams.get('limit') || 200));
    const action = url.searchParams.get('action');
    const entity = url.searchParams.get('entity');
    const userId = url.searchParams.get('userId');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const q = {};
    if (action) q.action = action;
    if (entity) q.entity = entity;
    if (userId) q.userId = userId;
    if (from || to) {
      q.timestamp = {};
      if (from) q.timestamp.$gte = from;
      if (to) q.timestamp.$lte = to;
    }
    const items = await db.collection('activity_logs').find(q).sort({ timestamp: -1 }).limit(limit).toArray();
    return ok(items.map(x => { delete x._id; return x; }));
  }

  // Check-in
  if (path === 'attendance/checkin' && method === 'POST') {
    const { employeeId, photoUrl, lat, lng } = await getJsonBody(request);
    const emp = await db.collection('employees').findOne({ id: employeeId });
    if (!emp) return err('الموظف غير موجود', 404);
    if (!photoUrl) return err('صورة الحضور إلزامية - يرجى التقاط صورة', 400);

    // 🌍 Use Baghdad timezone (Asia/Baghdad) — works correctly on Vercel (UTC)
    const now = new Date();
    const today = getLocalDateString(now);        // YYYY-MM-DD in Baghdad
    const localHM = getLocalHM(now);              // HH:MM in Baghdad
    const localMinutes = getLocalMinutes(now);    // minutes since midnight in Baghdad

    const existing = await db.collection('attendance').findOne({ employeeId, date: today });
    if (existing && existing.checkIn) return err('تم تسجيل الحضور مسبقاً اليوم', 400);

    const settings = await db.collection('settings').findOne({ id: 'system' });
    const empSettings = settings?.employees || {};
    const globalShiftStart = empSettings.workStart || '08:00';
    // Use per-employee shift OR global default
    const shiftStartStr = emp.shiftStart || globalShiftStart;
    const shiftStartMinutes = shiftToMinutes(shiftStartStr);

    // ⚖️ Late = checked in AFTER shift start (in Baghdad time, not server time!)
    const lateMinutes = Math.max(0, localMinutes - shiftStartMinutes);
    const grace = empSettings.lateGraceMinutes ?? 10;
    const isLate = lateMinutes > grace;
    const autoEnabled = empSettings.autoDeductionEnabled !== false;
    const mode = empSettings.lateDeductionMode || 'fixed';
    const fixedAmount = empSettings.lateDeductionAmount ?? 25000;
    const perMinute = empSettings.lateDeductionPerMinute ?? 500;
    let deductionAmount = 0;
    if (isLate && autoEnabled) {
      // Deduct only for minutes AFTER the grace period
      const billableMinutes = Math.max(0, lateMinutes - grace);
      deductionAmount = mode === 'per_minute'
        ? billableMinutes * perMinute
        : fixedAmount;
    }
    const record = {
      id: uuidv4(),
      employeeId, employeeName: emp.name, date: today,
      checkIn: now.toISOString(),                          // UTC ISO for storage
      checkInLocal: localHM,                                // 'HH:MM' Baghdad — for display
      checkInLocalTime: `${today} ${localHM}`,              // 'YYYY-MM-DD HH:MM' Baghdad
      checkInTimezone: APP_TZ,                              // for auditing
      checkOut: null, checkOutLocal: null,
      checkInPhoto: photoUrl, checkOutPhoto: null,
      checkInLat: lat || null, checkInLng: lng || null,
      shiftStart: shiftStartStr,                            // record the shift used
      lateMinutes, isLate, status: isLate ? 'late' : 'present',
      hoursWorked: 0, autoDeduction: deductionAmount, deductionMode: mode,
      graceUsed: grace,
      createdAt: now.toISOString(),
    };
    if (deductionAmount > 0) {
      await db.collection('payroll_entries').insertOne({
        id: uuidv4(), employeeId, employeeName: emp.name, type: 'deduction',
        amount: deductionAmount,
        reason: mode === 'per_minute'
          ? `خصم تلقائي: تأخير ${lateMinutes} دقيقة (بعد سماح ${grace}د) × ${perMinute} د.ع/دقيقة = ${deductionAmount.toLocaleString('en-US')} د.ع`
          : `خصم تلقائي: تأخير ${lateMinutes} دقيقة - مبلغ ثابت ${fixedAmount.toLocaleString('en-US')} د.ع`,
        auto: true, date: today, createdAt: now.toISOString(),
      });
    }
    await db.collection('attendance').insertOne(record);
    await db.collection('employees').updateOne({ id: employeeId }, { $set: { attendance: record.status } });
    await logActivity(db, { action: 'attendance_checkin', entity: 'attendance', entityId: record.id, user: emp.name, userId: emp.id, details: `حضور في ${localHM} (بغداد)${isLate ? ` - تأخير ${lateMinutes}د` : ''}`, ip: clientIp });
    if (isLate) {
      await notifyManager(db, {
        type: 'attendance_late',
        title: `⏰ تأخير: ${emp.name}`,
        message: `بصم الحضور في ${localHM} (بغداد)\nبدء الدوام: ${shiftStartStr}\nالتأخير: ${lateMinutes} دقيقة\nالخصم: ${deductionAmount.toLocaleString('en-US')} د.ع`,
        employeeId,
      });
    } else {
      await notifyManager(db, {
        type: 'attendance_checkin',
        title: `📍 حضور: ${emp.name}`,
        message: `بصم الحضور في ${localHM} (بغداد)`,
        employeeId,
      });
    }
    delete record._id;
    await db.collection('events').insertOne({
      id: uuidv4(), type: isLate ? 'attendance_late' : 'attendance_checkin',
      employeeId, employeeName: emp.name, lateMinutes, isLate, deductionAmount,
      checkInLocal: localHM,
      ts: now.toISOString(),
    });
    return ok({ success: true, record });
  }

  // Check-out
  if (path === 'attendance/checkout' && method === 'POST') {
    const { employeeId, photoUrl, lat, lng } = await getJsonBody(request);
    if (!photoUrl) return err('صورة الانصراف إلزامية - يرجى التقاط صورة', 400);

    // 🌍 Baghdad timezone
    const now = new Date();
    const today = getLocalDateString(now);
    const localHM = getLocalHM(now);
    const localMinutes = getLocalMinutes(now);

    const existing = await db.collection('attendance').findOne({ employeeId, date: today });
    if (!existing) return err('لم تسجل حضور اليوم', 400);
    if (existing.checkOut) return err('تم تسجيل الانصراف مسبقاً', 400);

    const checkInTime = new Date(existing.checkIn);
    const hoursWorked = ((now - checkInTime) / 3600000).toFixed(2);

    // Early-leave detection (left BEFORE shift end)
    const emp = await db.collection('employees').findOne({ id: employeeId });
    const settings = await db.collection('settings').findOne({ id: 'system' });
    const empSettings = settings?.employees || {};
    const shiftEndStr = emp?.shiftEnd || empSettings.workEnd || '17:00';
    const shiftEndMinutes = shiftToMinutes(shiftEndStr);
    const earlyLeaveMinutes = Math.max(0, shiftEndMinutes - localMinutes);

    await db.collection('attendance').updateOne(
      { id: existing.id },
      { $set: {
        checkOut: now.toISOString(),
        checkOutLocal: localHM,
        checkOutLocalTime: `${today} ${localHM}`,
        checkOutPhoto: photoUrl,
        checkOutLat: lat || null,
        checkOutLng: lng || null,
        hoursWorked: Number(hoursWorked),
        shiftEnd: shiftEndStr,
        earlyLeaveMinutes,
        isEarlyLeave: earlyLeaveMinutes > 0,
      }}
    );
    await logActivity(db, { action: 'attendance_checkout', entity: 'attendance', entityId: existing.id, user: emp?.name, userId: employeeId, details: `انصراف في ${localHM} (بغداد) - عمل ${hoursWorked} ساعة${earlyLeaveMinutes > 0 ? ` - انصراف مبكر ${earlyLeaveMinutes}د` : ''}`, ip: clientIp });
    await notifyManager(db, {
      type: 'attendance_checkout',
      title: `🚪 انصراف: ${emp?.name}`,
      message: `بصم الانصراف في ${localHM} (بغداد)\nالساعات المُنجزة: ${hoursWorked}${earlyLeaveMinutes > 0 ? `\n⚠️ انصراف مبكر بـ ${earlyLeaveMinutes} دقيقة` : ''}`,
      employeeId,
    });
    await db.collection('events').insertOne({
      id: uuidv4(), type: 'attendance_checkout',
      employeeId, employeeName: emp?.name, hoursWorked: Number(hoursWorked),
      checkOutLocal: localHM, earlyLeaveMinutes,
      ts: now.toISOString(),
    });
    return ok({ success: true, hoursWorked: Number(hoursWorked), checkOutLocal: localHM, earlyLeaveMinutes });
  }

  // Today's attendance for all
  if (path === 'attendance/today' && method === 'GET') {
    const today = getLocalDateString();  // 🌍 Baghdad date
    const records = await db.collection('attendance').find({ date: today }).toArray();
    return ok(records.map(r => { delete r._id; return r; }));
  }

  // 🕐 Server time in Baghdad — used by frontend to show authoritative time
  if (path === 'server-time' && method === 'GET') {
    const now = new Date();
    return ok({
      iso: now.toISOString(),                      // UTC ISO
      timezone: APP_TZ,                            // 'Asia/Baghdad'
      localDate: getLocalDateString(now),          // 'YYYY-MM-DD' in Baghdad
      localTime: getLocalHM(now),                  // 'HH:MM' in Baghdad
      localFull: `${getLocalDateString(now)} ${getLocalHM(now)}`,
      epoch: now.getTime(),
    });
  }

  // Employee's attendance/tasks
  if (path.match(/^employees\/[^/]+\/attendance$/) && method === 'GET') {
    const empId = path.split('/')[1];
    const records = await db.collection('attendance').find({ employeeId: empId }).sort({ date: -1 }).toArray();
    return ok(records.map(r => { delete r._id; return r; }));
  }

  if (path.match(/^employees\/[^/]+\/tasks$/) && method === 'GET') {
    const empId = path.split('/')[1];
    const tasks = await db.collection('tasks').find({ assignedTo: empId }).sort({ createdAt: -1 }).toArray();
    return ok(tasks.map(t => { delete t._id; return t; }));
  }

  // Self-task creation by employee (notifies manager, not self)
  if (path.match(/^employees\/[^/]+\/tasks\/create$/) && method === 'POST') {
    const empId = path.split('/')[1];
    const body = await getJsonBody(request);
    const emp = await db.collection('employees').findOne({ id: empId });
    if (!emp) return err('الموظف غير موجود', 404);
    const title = String(body.title || '').trim();
    if (!title) return err('عنوان المهمة مطلوب', 400);
    const now = new Date().toISOString();
    const doc = {
      id: uuidv4(),
      title,
      description: body.description || '',
      priority: body.priority || 'medium',
      dueDate: body.dueDate || null,
      taskType: 'self_created',
      assignedTo: empId,
      assignedToName: emp.name,
      createdBy: emp.name,
      createdByEmp: true,
      createdByEmpId: empId,
      status: 'in_progress', // auto-accepted (employee created it)
      progress: 0,
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      notes: body.notes || '',
      acceptedAt: now,
      startTime: now,
      createdAt: now,
    };
    await db.collection('tasks').insertOne(doc);
    delete doc._id;
    await logActivity(db, {
      action: 'self_task_created', entity: 'tasks', entityId: doc.id,
      user: emp.name, details: `الموظف ${emp.name} أنشأ مهمة شخصية: "${doc.title}"`, ip: clientIp,
    });
    // Notify manager (in-app + telegram)
    await notifyManager(db, {
      type: 'task_self_created',
      title: `📝 مهمة شخصية جديدة من ${emp.name}`,
      message: `العنوان: ${doc.title}\nالأولوية: ${doc.priority}\nالتاريخ: ${doc.dueDate || 'غير محدد'}\nالوصف: ${doc.description || '-'}`,
      entityType: 'task', entityId: doc.id,
    });
    // Real-time event
    await db.collection('events').insertOne({
      id: uuidv4(), type: 'task_self_created',
      taskId: doc.id, title: doc.title, employeeId: empId, employeeName: emp.name,
      priority: doc.priority, ts: now,
    });
    return ok(doc, 201);
  }

  // Task update by employee
  if (path.match(/^tasks\/[^/]+\/update$/) && method === 'POST') {
    const taskId = path.split('/')[1];
    const body = await getJsonBody(request);
    const allowedFields = ['status', 'progress', 'notes', 'attachments'];
    const updates = {};
    for (const k of allowedFields) if (k in body) updates[k] = body[k];
    updates.updatedAt = new Date().toISOString();
    await db.collection('tasks').updateOne({ id: taskId }, { $set: updates });
    const updated = await db.collection('tasks').findOne({ id: taskId });
    if (updated) delete updated._id;
    return ok(updated);
  }

  // ============ INTERACTIVE TASK WORKFLOW ============
  // Accept task (employee)
  if (path.match(/^tasks\/[^/]+\/accept$/) && method === 'POST') {
    const taskId = path.split('/')[1];
    const { employeeId } = await getJsonBody(request);
    const task = await db.collection('tasks').findOne({ id: taskId });
    if (!task) return err('المهمة غير موجودة', 404);
    if (task.assignedTo !== employeeId) return err('غير مخوّل', 403);
    if (!['pending', 'new'].includes(task.status || 'pending')) return err('لا يمكن قبول هذه المهمة في حالتها الحالية', 400);
    const now = new Date().toISOString();
    await db.collection('tasks').updateOne({ id: taskId }, { $set: { status: 'in_progress', acceptedAt: now, updatedAt: now } });
    // Notify manager
    if (task.createdById) {
      await db.collection('notifications').insertOne({
        id: uuidv4(), userId: task.createdById, type: 'task_accepted', title: 'تم قبول المهمة',
        message: `قبل ${task.assignedToName} المهمة: ${task.title}`, taskId, read: false, createdAt: now,
      });
    }
    return ok({ success: true });
  }

  // Reject task (employee) with reason
  if (path.match(/^tasks\/[^/]+\/reject$/) && method === 'POST') {
    const taskId = path.split('/')[1];
    const { employeeId, reason } = await getJsonBody(request);
    if (!reason || reason.trim().length < 3) return err('سبب الرفض مطلوب', 400);
    const task = await db.collection('tasks').findOne({ id: taskId });
    if (!task) return err('المهمة غير موجودة', 404);
    if (task.assignedTo !== employeeId) return err('غير مخوّل', 403);
    if (!['pending', 'new'].includes(task.status || 'pending')) return err('لا يمكن رفض هذه المهمة', 400);
    const now = new Date().toISOString();
    await db.collection('tasks').updateOne({ id: taskId }, { $set: { status: 'rejected_by_employee', rejectionReason: reason, rejectedAt: now, updatedAt: now } });
    if (task.createdById) {
      await db.collection('notifications').insertOne({
        id: uuidv4(), userId: task.createdById, type: 'task_rejected', title: 'رفض الموظف المهمة',
        message: `رفض ${task.assignedToName} المهمة "${task.title}" بسبب: ${reason}`,
        taskId, read: false, createdAt: now,
      });
    }
    return ok({ success: true });
  }

  // Complete task (employee submits report)
  if (path.match(/^tasks\/[^/]+\/complete$/) && method === 'POST') {
    const taskId = path.split('/')[1];
    const body = await getJsonBody(request);
    const { employeeId, summary, notes, progress, attachments, problems, completionTime } = body;
    const task = await db.collection('tasks').findOne({ id: taskId });
    if (!task) return err('المهمة غير موجودة', 404);
    if (task.assignedTo !== employeeId) return err('غير مخوّل', 403);
    if (!summary || summary.trim().length < 3) return err('وصف الإنجاز مطلوب', 400);
    const now = new Date().toISOString();
    const report = {
      summary, notes: notes || '', progress: Number(progress || 100),
      attachments: Array.isArray(attachments) ? attachments : [],
      problems: problems || '', completionTime: completionTime || now,
      submittedAt: now,
    };
    await db.collection('tasks').updateOne({ id: taskId }, {
      $set: { status: 'pending_review', report, progress: report.progress, submittedAt: now, updatedAt: now },
    });
    if (task.createdById) {
      await db.collection('notifications').insertOne({
        id: uuidv4(), userId: task.createdById, type: 'task_submitted', title: 'تقرير مهمة جاهز للمراجعة',
        message: `أنهى ${task.assignedToName} المهمة "${task.title}" وأرسل التقرير`,
        taskId, entityType: 'task', entityId: taskId,
        icon: '📋', priority: 'high',
        read: false, resolved: false, resolvedAt: null, resolvedBy: null,
        createdAt: now,
      });
    }
    return ok({ success: true });
  }

  // Manager reviews task
  if (path.match(/^tasks\/[^/]+\/review$/) && method === 'POST') {
    const taskId = path.split('/')[1];
    const body = await getJsonBody(request);
    const { action, rating, notes, reviewerName } = body;
    const task = await db.collection('tasks').findOne({ id: taskId });
    if (!task) return err('المهمة غير موجودة', 404);
    if (!['approve', 'reject', 'revise'].includes(action)) return err('إجراء غير صالح', 400);
    const now = new Date().toISOString();
    const newStatus = action === 'approve' ? 'completed' : action === 'reject' ? 'rejected_by_manager' : 'revision';
    const review = {
      action, notes: notes || '', reviewerName: reviewerName || 'المدير',
      rating: rating || null, reviewedAt: now,
    };
    await db.collection('tasks').updateOne({ id: taskId }, { $set: { status: newStatus, review, reviewedAt: now, updatedAt: now } });

    // Update employee KPI on approval
    if (action === 'approve' && rating) {
      const r = rating;
      const score = Math.round(((Number(r.speed||0) + Number(r.quality||0) + Number(r.commitment||0) + Number(r.delay||0)) / 4) * 20); // 0-100
      // Increment employee tasksCompleted & ratingPoints
      const emp = await db.collection('employees').findOne({ id: task.assignedTo });
      if (emp) {
        const newRatingPoints = (emp.ratingPoints || 0) + score;
        const newTasksCompleted = (emp.tasksCompleted || 0) + 1;
        const avgRating = Math.round(newRatingPoints / newTasksCompleted);
        await db.collection('employees').updateOne({ id: task.assignedTo }, {
          $set: { ratingPoints: newRatingPoints, tasksCompleted: newTasksCompleted, kpi: Math.min(100, avgRating) },
        });
      }
    }

    // Notify employee (in-app + WhatsApp + Telegram)
    const msgMap = {
      approve: { title: '✅ تم قبول مهمتك', text: `وافق المدير على إنجاز المهمة "${task.title}"${rating ? `\n⭐ السرعة: ${rating.speed||0} | الجودة: ${rating.quality||0} | الالتزام: ${rating.commitment||0} | عدم التأخير: ${rating.delay||0}` : ''}` },
      reject: { title: '❌ رُفض إنجازك', text: `رفض المدير إنجاز المهمة "${task.title}".\nملاحظات: ${notes || '-'}` },
      revise: { title: '🔄 إعادة تعديل', text: `طلب المدير تعديلات على المهمة "${task.title}".\nملاحظات: ${notes || '-'}` },
    };
    await notifyEmployee(db, {
      employeeId: task.assignedTo,
      type: `task_${action}`,
      title: msgMap[action].title,
      message: msgMap[action].text,
      entityType: 'task', entityId: taskId,
      icon: action === 'approve' ? '✅' : action === 'reject' ? '❌' : '🔄',
      priority: action === 'reject' ? 'high' : 'normal',
      taskId,
    });

    // If revise → put task back in_progress
    if (action === 'revise') {
      await db.collection('tasks').updateOne({ id: taskId }, { $set: { status: 'in_progress' } });
    }

    // ============ AUTO-SPAWN NEXT RECURRING TASK (only on approve) ============
    let spawnedTaskId = null;
    if (action === 'approve') {
      const spawned = await spawnRecurringIfNeeded(db, task);
      if (spawned) spawnedTaskId = spawned.id;
    }

    return ok({ success: true, spawnedTaskId });
  }

  // ============ NOTIFICATIONS ============
  if (path === 'notifications' && method === 'GET') {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return err('userId مطلوب', 400);
    const items = await db.collection('notifications').find({ userId }).sort({ createdAt: -1 }).limit(50).toArray();
    return ok(items.map(n => { delete n._id; return n; }));
  }
  if (path.match(/^notifications\/[^/]+\/read$/) && method === 'POST') {
    const id = path.split('/')[1];
    await db.collection('notifications').updateOne({ id }, { $set: { read: true } });
    return ok({ success: true });
  }
  if (path === 'notifications/read-all' && method === 'POST') {
    const { userId } = await getJsonBody(request);
    if (!userId) return err('userId مطلوب', 400);
    await db.collection('notifications').updateMany({ userId, read: false }, { $set: { read: true } });
    return ok({ success: true });
  }

  // ============ FILE UPLOAD (multipart) → MongoDB Base64 (Vercel-compatible) ============
  // 🚀 STORAGE STRATEGY: We store uploads as Base64 in MongoDB `uploads` collection.
  //    This works on Vercel (read-only filesystem) AND locally.
  //    Files served via GET /api/files/{id}
  if (path === 'upload' && method === 'POST') {
    try {
      let form;
      try { form = await request.formData(); }
      catch { return err('لم يتم إرسال ملف', 400); }
      const file = form.get('file');
      if (!file || typeof file === 'string') return err('لم يتم إرسال ملف', 400);

      const buf = Buffer.from(await file.arrayBuffer());
      const size = buf.length;
      // Limit to 8MB to stay safe under MongoDB 16MB doc limit (Base64 inflates by ~33%)
      if (size > 8 * 1024 * 1024) {
        return err('الملف كبير جداً (الحد الأقصى 8 ميجابايت)', 413);
      }
      const mime = file.type || 'application/octet-stream';
      const name = file.name || 'upload';
      const ext = (name.split('.').pop() || 'bin').toLowerCase();

      // Detect if we're on Vercel/serverless (no writable FS)
      const isReadOnlyFs = !!process.env.VERCEL || process.env.NODE_ENV === 'production';

      const id = uuidv4();
      const fileDoc = {
        id,
        name,
        mime,
        size,
        ext,
        // Always store Base64 in MongoDB for cross-platform compatibility
        data: buf.toString('base64'),
        uploadedAt: new Date().toISOString(),
      };
      await db.collection('uploads').insertOne(fileDoc);

      // Try to ALSO write to disk locally (faster CDN-style serving) — but never fail if it can't
      if (!isReadOnlyFs) {
        try {
          const fs = await import('fs');
          const pathMod = await import('path');
          const uploadsDir = pathMod.join(process.cwd(), 'public', 'uploads');
          if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
          const filename = `${id}.${ext}`;
          fs.writeFileSync(pathMod.join(uploadsDir, filename), buf);
        } catch (fsErr) {
          // Silent fail — MongoDB copy is the source of truth
          console.warn('[upload] disk write skipped:', fsErr?.message);
        }
      }

      // Return URL that works on ANY platform (served by /api/files/{id})
      const url = `/api/files/${id}`;
      return ok({ success: true, url, id, name, size, mime });
    } catch (e) {
      console.error('[upload] failed:', e);
      return err('فشل الرفع: ' + e.message, 500);
    }
  }

  // ============ FILE SERVE: GET /api/files/{id} → return binary from MongoDB ============
  if (path.startsWith('files/') && method === 'GET') {
    try {
      const id = path.substring('files/'.length);
      if (!id) return err('معرّف الملف مطلوب', 400);
      // Strip extension if present (so both /api/files/uuid and /api/files/uuid.jpg work)
      const cleanId = id.split('.')[0];
      const doc = await db.collection('uploads').findOne({ id: cleanId });
      if (!doc || !doc.data) {
        return new Response(JSON.stringify({ error: 'الملف غير موجود' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const buf = Buffer.from(doc.data, 'base64');
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': doc.mime || 'application/octet-stream',
          'Content-Length': String(buf.length),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Disposition': `inline; filename="${doc.name || cleanId}"`,
        },
      });
    } catch (e) {
      console.error('[files] serve failed:', e);
      return err('خطأ في جلب الملف', 500);
    }
  }

  // ============ LEAVES (الإجازات) ============
  // GET all (admin) or filtered
  if (path === 'leaves' && method === 'GET') {
    const url = new URL(request.url);
    const empFilter = url.searchParams.get('employeeId');
    const q = empFilter ? { employeeId: empFilter } : {};
    const items = await db.collection('leaves').find(q).sort({ createdAt: -1 }).toArray();
    return ok(items.map(x => { delete x._id; return x; }));
  }
  // POST new leave request (by employee)
  if (path === 'leaves' && method === 'POST') {
    const body = await getJsonBody(request);
    const { employeeId, type, reason, startDate, endDate, days } = body;
    if (!employeeId || !type || !startDate || !days) return err('بيانات ناقصة', 400);
    const emp = await db.collection('employees').findOne({ id: employeeId });
    if (!emp) return err('الموظف غير موجود', 404);
    const doc = {
      id: uuidv4(), employeeId, employeeName: emp.name,
      type, reason: reason || '', startDate, endDate: endDate || startDate, days: Number(days),
      status: 'pending', approvedBy: null, approvedAt: null, rejectionReason: '',
      createdAt: new Date().toISOString(),
    };
    await db.collection('leaves').insertOne(doc);
    delete doc._id;
    await logActivity(db, { action: 'leave_request', entity: 'leaves', entityId: doc.id, user: emp.name, userId: emp.id, details: `طلب ${days} يوم - ${type}`, ip: clientIp });
    await notifyManager(db, {
      type: 'leave_request', title: `📅 طلب إجازة: ${emp.name}`,
      message: `النوع: ${type}\nالمدة: ${days} يوم\nمن: ${startDate} إلى: ${endDate || startDate}\nالسبب: ${reason || '-'}`,
      employeeId, entityType: 'leave', entityId: doc.id,
    });
    return ok(doc, 201);
  }
  // PUT approve/reject leave (by admin)
  if (path.match(/^leaves\/[^/]+\/(approve|reject)$/) && method === 'POST') {
    const parts = path.split('/');
    const id = parts[1];
    const action = parts[2];
    const body = await getJsonBody(request);
    const leave = await db.collection('leaves').findOne({ id });
    if (!leave) return err('غير موجود', 404);
    if (leave.status !== 'pending') return err('تمت معالجة هذا الطلب مسبقاً', 400);
    const now = new Date().toISOString();
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await db.collection('leaves').updateOne({ id }, { $set: {
      status: newStatus, approvedBy: body.approvedBy || 'المدير',
      approvedAt: now, rejectionReason: action === 'reject' ? (body.reason || '') : '',
    }});
    await logActivity(db, { action: `leave_${action}`, entity: 'leaves', entityId: id, user: body.approvedBy || 'المدير', details: `${action === 'approve' ? 'موافقة' : 'رفض'} على إجازة ${leave.employeeName}`, ip: clientIp });
    // Notify employee (in-app + WhatsApp + Telegram)
    await notifyEmployee(db, {
      employeeId: leave.employeeId,
      type: `leave_${action}`,
      icon: action === 'approve' ? '✅' : '❌',
      title: action === 'approve' ? '✅ إجازتك مقبولة' : '❌ إجازتك مرفوضة',
      message: action === 'approve'
        ? `تمت الموافقة على إجازتك (${leave.days} يوم) من ${leave.startDate} إلى ${leave.endDate}`
        : `تم رفض طلب إجازتك.\nالسبب: ${body.reason || '-'}`,
      entityType: 'leave', entityId: id,
      priority: action === 'reject' ? 'high' : 'normal',
    });
    return ok({ success: true });
  }

  // Leave balance
  if (path.match(/^employees\/[^/]+\/leave-balance$/) && method === 'GET') {
    const empId = path.split('/')[1];
    const settings = await db.collection('settings').findOne({ id: 'system' });
    const yearlyAllowance = settings?.employees?.yearlyLeaveAllowance ?? 24;
    const year = new Date().getFullYear();
    const approved = await db.collection('leaves').find({ employeeId: empId, status: 'approved', startDate: { $regex: `^${year}` } }).toArray();
    const used = approved.reduce((s, x) => s + (x.days || 0), 0);
    const pending = await db.collection('leaves').find({ employeeId: empId, status: 'pending' }).toArray();
    const pendingDays = pending.reduce((s, x) => s + (x.days || 0), 0);
    return ok({ year, allowance: yearlyAllowance, used, pending: pendingDays, remaining: Math.max(0, yearlyAllowance - used) });
  }

  // ============ EMPLOYEE RATINGS AGGREGATE ============
  // GET /api/employees/:id/ratings — aggregated rating analytics for employee
  if (path.match(/^employees\/[^/]+\/ratings$/) && method === 'GET') {
    const empId = path.split('/')[1];
    const emp = await db.collection('employees').findOne({ id: empId });
    if (!emp) return err('الموظف غير موجود', 404);

    // All reviewed tasks (status=completed and review.rating present)
    const tasks = await db.collection('tasks').find({
      assignedTo: empId,
      'review.rating': { $exists: true, $ne: null },
    }).sort({ reviewedAt: -1 }).toArray();

    let sumSpeed = 0, sumQuality = 0, sumCommitment = 0, sumDelay = 0;
    const recent = [];
    const monthly = {}; // { 'YYYY-MM': { count, totalScore } }

    for (const t of tasks) {
      const r = t.review?.rating || {};
      const speed = Number(r.speed || 0);
      const quality = Number(r.quality || 0);
      const commitment = Number(r.commitment || 0);
      const delay = Number(r.delay || 0);
      sumSpeed += speed;
      sumQuality += quality;
      sumCommitment += commitment;
      sumDelay += delay;
      const score = Math.round(((speed + quality + commitment + delay) / 4) * 20); // 0-100
      const ymonth = (t.reviewedAt || t.createdAt || '').slice(0, 7);
      if (ymonth) {
        if (!monthly[ymonth]) monthly[ymonth] = { count: 0, totalScore: 0 };
        monthly[ymonth].count += 1;
        monthly[ymonth].totalScore += score;
      }
      if (recent.length < 20) {
        recent.push({
          taskId: t.id,
          title: t.title,
          reviewedAt: t.reviewedAt || null,
          reviewerName: t.review?.reviewerName || 'المدير',
          notes: t.review?.notes || '',
          rating: { speed, quality, commitment, delay },
          score,
        });
      }
    }

    const count = tasks.length;
    const averages = count > 0 ? {
      speed: Number((sumSpeed / count).toFixed(2)),
      quality: Number((sumQuality / count).toFixed(2)),
      commitment: Number((sumCommitment / count).toFixed(2)),
      delay: Number((sumDelay / count).toFixed(2)),
      overall: Number((((sumSpeed + sumQuality + sumCommitment + sumDelay) / 4) / count).toFixed(2)),
    } : { speed: 0, quality: 0, commitment: 0, delay: 0, overall: 0 };

    // Trend: last 6 months
    const months = Object.keys(monthly).sort().slice(-6).map(k => ({
      month: k,
      count: monthly[k].count,
      avgScore: Math.round(monthly[k].totalScore / monthly[k].count),
    }));

    // KPI percentage based on overall average (0-5 → 0-100%)
    const kpiPct = Math.round(averages.overall * 20);

    return ok({
      employee: { id: emp.id, name: emp.name, role: emp.role, kpi: emp.kpi || 0, ratingPoints: emp.ratingPoints || 0, tasksCompleted: emp.tasksCompleted || 0 },
      ratedTasksCount: count,
      averages,
      kpiPct,
      monthly: months,
      recent,
    });
  }

  // ============ ADVANCES (السلف) ============
  if (path === 'advances' && method === 'GET') {
    const url = new URL(request.url);
    const empFilter = url.searchParams.get('employeeId');
    const q = empFilter ? { employeeId: empFilter } : {};
    const items = await db.collection('advances').find(q).sort({ createdAt: -1 }).toArray();
    return ok(items.map(x => { delete x._id; return x; }));
  }
  if (path === 'advances' && method === 'POST') {
    const body = await getJsonBody(request);
    const { employeeId, amount, reason, installments } = body;
    if (!employeeId || !amount) return err('المبلغ مطلوب', 400);
    const emp = await db.collection('employees').findOne({ id: employeeId });
    if (!emp) return err('الموظف غير موجود', 404);
    const doc = {
      id: uuidv4(), employeeId, employeeName: emp.name,
      amount: Number(amount), reason: reason || '',
      installments: Number(installments || 1),
      perInstallment: Math.round(Number(amount) / Number(installments || 1)),
      paidInstallments: 0, remainingAmount: Number(amount),
      status: 'pending', approvedBy: null, approvedAt: null, rejectionReason: '',
      createdAt: new Date().toISOString(),
    };
    await db.collection('advances').insertOne(doc);
    delete doc._id;
    await logActivity(db, { action: 'advance_request', entity: 'advances', entityId: doc.id, user: emp.name, userId: emp.id, details: `طلب سلفة ${amount} د.ع`, ip: clientIp });
    await notifyManager(db, {
      type: 'advance_request', title: `💰 طلب سلفة: ${emp.name}`,
      message: `المبلغ: ${Number(amount).toLocaleString('en-US')} د.ع\nالأقساط: ${installments || 1}\nالسبب: ${reason || '-'}`,
      employeeId, entityType: 'advance', entityId: doc.id,
    });
    return ok(doc, 201);
  }
  // Approve/Reject advance
  if (path.match(/^advances\/[^/]+\/(approve|reject)$/) && method === 'POST') {
    const parts = path.split('/');
    const id = parts[1];
    const action = parts[2];
    const body = await getJsonBody(request);
    const advance = await db.collection('advances').findOne({ id });
    if (!advance) return err('غير موجود', 404);
    if (advance.status !== 'pending') return err('تمت معالجة هذا الطلب مسبقاً', 400);
    const now = new Date().toISOString();
    if (action === 'approve') {
      // Optionally allow admin to override installments
      const newInstallments = Number(body.installments || advance.installments || 1);
      await db.collection('advances').updateOne({ id }, { $set: {
        status: 'approved', approvedBy: body.approvedBy || 'المدير', approvedAt: now,
        installments: newInstallments,
        perInstallment: Math.round(advance.amount / newInstallments),
      }});
      // No immediate deduction; payroll calc will pick up installments
    } else {
      await db.collection('advances').updateOne({ id }, { $set: {
        status: 'rejected', approvedBy: body.approvedBy || 'المدير', approvedAt: now,
        rejectionReason: body.reason || '',
      }});
    }
    await logActivity(db, { action: `advance_${action}`, entity: 'advances', entityId: id, user: body.approvedBy || 'المدير', details: `${action === 'approve' ? 'موافقة' : 'رفض'} سلفة ${advance.employeeName} (${advance.amount})`, ip: clientIp });
    await db.collection('notifications').insertOne({
      id: uuidv4(), userId: advance.employeeId, type: `advance_${action}`,
      title: action === 'approve' ? '✅ سلفتك مقبولة' : '❌ سلفتك مرفوضة',
      message: action === 'approve' ? `وافق المدير على سلفتك (${advance.amount.toLocaleString('en-US')} د.ع) - ستُخصم على ${body.installments || advance.installments} قسط` : `سبب الرفض: ${body.reason || '-'}`,
      read: false, createdAt: now,
    });
    // Also send WhatsApp + Telegram via notifyEmployee
    await notifyEmployee(db, {
      employeeId: advance.employeeId,
      type: `advance_${action}`,
      icon: action === 'approve' ? '💰' : '❌',
      title: action === 'approve' ? '✅ سلفتك مقبولة' : '❌ سلفتك مرفوضة',
      message: action === 'approve'
        ? `وافق المدير على سلفتك بقيمة ${advance.amount.toLocaleString('en-US')} د.ع.\nستُخصم على ${body.installments || advance.installments} قسط شهري.`
        : `تم رفض طلب السلفة.\nالسبب: ${body.reason || '-'}`,
      entityType: 'advance', entityId: id,
      priority: action === 'reject' ? 'high' : 'normal',
    });
    return ok({ success: true });
  }
  // Pay an installment of advance (admin marks 1 installment as paid)
  if (path.match(/^advances\/[^/]+\/pay-installment$/) && method === 'POST') {
    const id = path.split('/')[1];
    const advance = await db.collection('advances').findOne({ id });
    if (!advance) return err('غير موجود', 404);
    if (advance.status !== 'approved') return err('السلفة غير مفعّلة', 400);
    const newPaid = (advance.paidInstallments || 0) + 1;
    const remaining = Math.max(0, advance.amount - (newPaid * advance.perInstallment));
    const completed = newPaid >= advance.installments;
    await db.collection('advances').updateOne({ id }, { $set: {
      paidInstallments: newPaid, remainingAmount: remaining,
      status: completed ? 'paid' : 'approved',
    }});
    return ok({ success: true, paidInstallments: newPaid, remaining });
  }

  // ============ ADMIN NOTIFICATIONS BELL ============
  // Get the active manager's notifications (employees with role contains مدير or perm 'all')
  if (path === 'notifications/admin' && method === 'GET') {
    try {
      const managers = await db.collection('employees').find({ $or: [{ permissions: 'all' }, { role: { $regex: 'مدير' } }] }).toArray();
      const ids = (Array.isArray(managers) ? managers : []).map(m => m?.id).filter(Boolean);
      // If no managers configured yet, return any unscoped/admin notifications gracefully
      const query = ids.length > 0 ? { userId: { $in: ids } } : {};
      const items = await db.collection('notifications').find(query).sort({ createdAt: -1 }).limit(100).toArray();
      // Enrich legacy notifications: derive entityType/entityId from existing fields so inline actions work
      const enriched = (Array.isArray(items) ? items : []).map(n => {
        try { delete n._id; } catch {}
        if (!n.entityType || n.entityType === 'generic' || !n.entityId) {
          let eType = n.entityType, eId = n.entityId;
          if (n.taskId && (!eType || eType === 'generic')) { eType = 'task'; eId = n.taskId; }
          else if (n.subscriberId && (!eType || eType === 'generic')) { eType = 'subscriber'; eId = n.subscriberId; }
          else if (n.type === 'leave_request' && n.employeeId) { eType = 'leave'; }
          else if (n.type === 'advance_request' && n.employeeId) { eType = 'advance'; }
          else if (n.type === 'attendance_late' || n.type === 'attendance_checkin' || n.type === 'attendance_checkout') {
            eType = 'employee'; eId = n.employeeId;
          }
          n.entityType = eType || 'generic';
          n.entityId = eId || null;
        }
        if (!n.icon) {
          const ICONS = { leave_request: '📅', advance_request: '💰', task_submitted: '📋', task_new: '📋', task_completed: '✅', task_transferred: '🔄', task_rejected: '❌', attendance_late: '⏰', attendance_checkin: '📍', attendance_checkout: '🚪', subscriber_expiry: '⚠️', subscriber_activated: '✅' };
          n.icon = ICONS[n.type] || '🔔';
        }
        return n;
      });
      return ok(enriched);
    } catch (e) {
      console.error('[notifications/admin] error:', e?.message);
      return ok([]); // Safe fallback — UI expects an array
    }
  }
  if (path === 'notifications/admin/read-all' && method === 'POST') {
    try {
      const managers = await db.collection('employees').find({ $or: [{ permissions: 'all' }, { role: { $regex: 'مدير' } }] }).toArray();
      const ids = (Array.isArray(managers) ? managers : []).map(m => m?.id).filter(Boolean);
      const query = ids.length > 0 ? { userId: { $in: ids }, read: false } : { read: false };
      await db.collection('notifications').updateMany(query, { $set: { read: true } });
      return ok({ success: true });
    } catch (e) {
      console.error('[notifications/admin/read-all] error:', e?.message);
      return ok({ success: false, error: e?.message });
    }
  }

  // ============ SMART CLICKABLE NOTIFICATIONS ============
  // Click: mark read + return actionUrl for routing
  if (path.match(/^notifications\/[^/]+\/click$/) && method === 'POST') {
    const id = path.split('/')[1];
    const n = await db.collection('notifications').findOne({ id });
    if (!n) return err('الإشعار غير موجود', 404);
    await db.collection('notifications').updateOne({ id }, { $set: { read: true, clickedAt: new Date().toISOString() } });
    return ok({
      success: true,
      actionUrl: n.actionUrl || buildActionUrl(n.entityType, n.entityId) || '',
      entityType: n.entityType || null,
      entityId: n.entityId || null,
      taskId: n.taskId || null,
      subscriberId: n.subscriberId || null,
    });
  }
  // Resolve: mark as processed (لا يختفي، فقط يصبح "تمت المعالجة")
  if (path.match(/^notifications\/[^/]+\/resolve$/) && method === 'POST') {
    const id = path.split('/')[1];
    const body = await getJsonBody(request);
    const n = await db.collection('notifications').findOne({ id });
    if (!n) return err('الإشعار غير موجود', 404);
    await db.collection('notifications').updateOne({ id }, {
      $set: {
        resolved: true,
        resolvedAt: new Date().toISOString(),
        resolvedBy: body?.resolvedBy || 'admin',
        resolutionNote: body?.note || null,
        read: true,
      },
    });
    await logActivity(db, { action: 'notification_resolved', entity: 'notifications', entityId: id, details: body?.note || '', ip: clientIp });
    return ok({ success: true });
  }
  // Reopen / un-resolve
  if (path.match(/^notifications\/[^/]+\/reopen$/) && method === 'POST') {
    const id = path.split('/')[1];
    await db.collection('notifications').updateOne({ id }, { $set: { resolved: false, resolvedAt: null, resolvedBy: null } });
    return ok({ success: true });
  }
  // Delete (manager only — soft delete via flag for audit)
  if (path.match(/^notifications\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[1];
    await db.collection('notifications').updateOne({ id }, { $set: { deleted: true, deletedAt: new Date().toISOString() } });
    return ok({ success: true });
  }

  // ============ ADVANCED TASKS ============
  // Start a task — records startedAt, transitions status
  if (path.match(/^tasks\/[^/]+\/start$/) && method === 'POST') {
    const id = path.split('/')[1];
    const body = await getJsonBody(request);
    const t = await db.collection('tasks').findOne({ id });
    if (!t) return err('المهمة غير موجودة', 404);
    if (t.startedAt) return err('المهمة بدأت بالفعل', 400);
    const now = new Date().toISOString();
    await db.collection('tasks').updateOne({ id }, {
      $set: { startedAt: now, status: 'in_progress', startedBy: body?.userId || t.assignedTo },
      $push: { history: { event: 'started', by: body?.userId || t.assignedTo, byName: body?.userName || t.assignedToName, at: now } },
    });
    // Notify manager
    await createNotification(db, {
      type: 'task_started', icon: '▶️',
      title: 'بدأ تنفيذ مهمة',
      message: `${body?.userName || t.assignedToName} بدأ تنفيذ "${t.title}"`,
      entityType: 'task', entityId: id,
    });
    return ok({ success: true, startedAt: now });
  }

  // Complete a task — records completedAt, calculates duration (manager-side quick complete)
  if (path.match(/^tasks\/[^/]+\/admin-complete$/) && method === 'POST') {
    const id = path.split('/')[1];
    const body = await getJsonBody(request);
    const t = await db.collection('tasks').findOne({ id });
    if (!t) return err('المهمة غير موجودة', 404);
    const now = new Date().toISOString();
    const start = t.startedAt ? new Date(t.startedAt).getTime() : new Date(t.createdAt).getTime();
    const durationMin = Math.round((Date.now() - start) / 60000);
    await db.collection('tasks').updateOne({ id }, {
      $set: {
        completedAt: now,
        status: 'completed',
        completedBy: body?.userId || t.assignedTo,
        durationMin,
        completionNote: body?.note || null,
        completionPhotos: Array.isArray(body?.photos) ? body.photos : [],
      },
      $push: { history: { event: 'completed', by: body?.userId || t.assignedTo, byName: body?.userName || t.assignedToName, at: now, note: body?.note || null, durationMin } },
    });
    await createNotification(db, {
      type: 'task_completed', icon: '✅',
      title: 'تم إنجاز مهمة',
      message: `${body?.userName || t.assignedToName} أنجز "${t.title}" خلال ${durationMin} دقيقة`,
      entityType: 'task', entityId: id,
    });
    // ============ AUTO-SPAWN NEXT RECURRING TASK ============
    const spawned = await spawnRecurringIfNeeded(db, t);
    return ok({ success: true, completedAt: now, durationMin, spawnedTaskId: spawned?.id || null });
  }

  // Transfer a task to another employee
  // body: { toEmployeeId, toEmployeeName, reason?, by?: { id, name } }
  if (path.match(/^tasks\/[^/]+\/transfer$/) && method === 'POST') {
    const id = path.split('/')[1];
    const body = await getJsonBody(request);
    if (!body?.toEmployeeId) return err('toEmployeeId مطلوب', 400);
    const t = await db.collection('tasks').findOne({ id });
    if (!t) return err('المهمة غير موجودة', 404);
    const now = new Date().toISOString();
    const prevAssignee = { id: t.assignedTo, name: t.assignedToName };
    await db.collection('tasks').updateOne({ id }, {
      $set: {
        assignedTo: body.toEmployeeId,
        assignedToName: body.toEmployeeName || '',
        status: 'transferred',
        transferredFrom: prevAssignee.id,
        transferredFromName: prevAssignee.name,
        transferredAt: now,
        transferReason: body.reason || null,
      },
      $push: { history: { event: 'transferred', by: body?.by?.id || 'admin', byName: body?.by?.name || 'المدير', at: now, from: prevAssignee, to: { id: body.toEmployeeId, name: body.toEmployeeName }, reason: body.reason || null } },
    });
    // Notify new assignee
    await createNotification(db, {
      userId: body.toEmployeeId, type: 'task_transferred_in', icon: '🔄',
      title: 'تم تحويل مهمة إليك',
      message: `${prevAssignee.name || 'مهمة'} → ${t.title}. السبب: ${body.reason || 'غير مذكور'}`,
      entityType: 'task', entityId: id, priority: 'high',
    });
    // Notify old assignee
    if (prevAssignee.id) {
      await createNotification(db, {
        userId: prevAssignee.id, type: 'task_transferred_out', icon: '↗️',
        title: 'تم تحويل مهمتك',
        message: `تم تحويل "${t.title}" إلى ${body.toEmployeeName}`,
        entityType: 'task', entityId: id,
      });
    }
    // Notify manager (broadcast)
    await createNotification(db, {
      type: 'task_transferred', icon: '🔄',
      title: 'تم تحويل مهمة',
      message: `"${t.title}": ${prevAssignee.name} → ${body.toEmployeeName}`,
      entityType: 'task', entityId: id, priority: 'normal',
    });
    return ok({ success: true });
  }

  // Manager rating: rating, success rate, notes (no state change like approve/reject)
  // body: { rating?: 0..100, stars?: 1..5, success?: boolean, notes?, by?: { id, name } }
  if (path.match(/^tasks\/[^/]+\/rate$/) && method === 'POST') {
    const id = path.split('/')[1];
    const body = await getJsonBody(request);
    const t = await db.collection('tasks').findOne({ id });
    if (!t) return err('المهمة غير موجودة', 404);
    const now = new Date().toISOString();
    const review = {
      rating: typeof body?.rating === 'number' ? Math.max(0, Math.min(100, body.rating)) : null,
      stars: typeof body?.stars === 'number' ? Math.max(1, Math.min(5, body.stars)) : null,
      success: body?.success !== undefined ? !!body.success : null,
      notes: body?.notes || '',
      reviewedAt: now,
      reviewedBy: body?.by?.id || 'admin',
      reviewedByName: body?.by?.name || 'المدير',
    };
    await db.collection('tasks').updateOne({ id }, {
      $set: { review, status: body?.success === false ? 'failed' : (t.status === 'completed' ? 'completed' : t.status) },
      $push: { history: { event: 'reviewed', by: review.reviewedBy, byName: review.reviewedByName, at: now, rating: review.rating, success: review.success, notes: review.notes } },
    });
    // Notify assignee
    if (t.assignedTo) {
      await createNotification(db, {
        userId: t.assignedTo, type: 'task_reviewed',
        icon: review.success === false ? '⚠️' : '🏆',
        title: review.success === false ? 'مراجعة مهمتك' : 'تم تقييم مهمتك',
        message: `"${t.title}" — ${review.rating != null ? `النسبة: ${review.rating}%` : ''} ${review.notes ? '\n' + review.notes : ''}`,
        entityType: 'task', entityId: id, priority: review.success === false ? 'high' : 'normal',
      });
    }
    await logActivity(db, { action: 'task_reviewed', entity: 'tasks', entityId: id, user: review.reviewedByName, details: `تقييم: ${review.rating ?? '—'}% / ${review.notes || ''}`, ip: clientIp });
    return ok({ success: true, review });
  }

  // Find duplicate tasks (same title + same subscriber/assignee + recent)
  if (path.match(/^tasks\/[^/]+\/duplicates$/) && method === 'GET') {
    const id = path.split('/')[1];
    const t = await db.collection('tasks').findOne({ id });
    if (!t) return err('غير موجود', 404);
    const titleNorm = String(t.title || '').trim();
    if (!titleNorm) return ok([]);
    // Look-back 180 days
    const since = new Date(Date.now() - 180 * 86400000).toISOString();
    const dups = await db.collection('tasks').find({
      id: { $ne: id },
      title: titleNorm,
      $or: [
        t.subscriberId ? { subscriberId: t.subscriberId } : null,
        t.assignedTo ? { assignedTo: t.assignedTo } : null,
      ].filter(Boolean),
      createdAt: { $gte: since },
    }).sort({ createdAt: -1 }).limit(10).toArray();
    return ok(dups.map(d => { try { delete d._id; } catch {} return d; }));
  }

  // List tasks assigned to a specific employee with history (for transfer dropdowns)
  if (path === 'tasks/employees-for-transfer' && method === 'GET') {
    const emps = await db.collection('employees').find({ status: { $ne: 'inactive' } }, { projection: { id: 1, name: 1, role: 1 } }).toArray();
    return ok(emps.map(e => { try { delete e._id; } catch {} return e; }));
  }


  // ============ TELEGRAM BOT - STATISTICS ============
  // Seed super admin if missing (one-shot per process — was running on every request)
  const seedTgAdmin = async () => {
    try {
      const adminId = process.env.TELEGRAM_SUPER_ADMIN_ID;
      if (!adminId) return;
      if (__globalAny.__tgAdminSeeded) return;
      const existing = await db.collection('telegram_users').findOne({ telegramId: String(adminId) });
      if (!existing) {
        await db.collection('telegram_users').insertOne({
          id: uuidv4(), telegramId: String(adminId),
          name: 'Super Admin', role: 'super_admin',
          permissions: PERMS_ALL, enabled: true,
          createdAt: new Date().toISOString(),
          lastActivity: null, failedAttempts: 0,
        });
      }
      __globalAny.__tgAdminSeeded = true;
    } catch (e) {
      console.warn('[seedTgAdmin] warn:', e?.message);
    }
  };
  await seedTgAdmin();

  // Telegram webhook
  if (path === 'telegram/webhook' && method === 'POST') {
    const update = await getJsonBody(request);
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return ok({ ok: false, reason: 'no_token' });

    const isCallback = !!update.callback_query;
    const tgUser = isCallback ? update.callback_query.from : update.message?.from;
    const chatId = isCallback ? update.callback_query.message.chat.id : update.message?.chat?.id;
    const messageId = isCallback ? update.callback_query.message.message_id : null;
    const dataOrText = isCallback ? update.callback_query.data : update.message?.text;

    if (!tgUser || !chatId) return ok({ ok: true });

    const tgId = String(tgUser.id);
    const dbUser = await db.collection('telegram_users').findOne({ telegramId: tgId });

    // Auth check
    if (!dbUser || !dbUser.enabled) {
      await db.collection('telegram_logs').insertOne({
        id: uuidv4(), telegramId: tgId, userName: tgUser.first_name || tgUser.username || 'unknown',
        action: 'unauthorized_access', success: false,
        details: dataOrText || '', timestamp: new Date().toISOString(),
      });
      if (dbUser && !dbUser.enabled) {
        await db.collection('telegram_users').updateOne({ telegramId: tgId }, { $inc: { failedAttempts: 1 } });
      }
      const msg = `❌ <b>غير مصرح لك باستخدام هذا البوت</b>\n\nTelegram ID: <code>${tgId}</code>\nيرجى التواصل مع المدير لإضافة حسابك`;
      if (isCallback) {
        await tgAnswerCallback(token, update.callback_query.id, 'غير مصرح');
        await tgEdit(token, chatId, messageId, msg);
      } else {
        await tgSend(token, chatId, msg);
      }
      return ok({ ok: true });
    }

    // Rate limit: 30 requests / minute
    const oneMinAgo = new Date(Date.now() - 60000).toISOString();
    const recent = await db.collection('telegram_logs').countDocuments({ telegramId: tgId, timestamp: { $gt: oneMinAgo } });
    if (recent > 30) {
      if (isCallback) await tgAnswerCallback(token, update.callback_query.id, 'تم تجاوز الحد المسموح، حاول بعد دقيقة');
      else await tgSend(token, chatId, '⚠️ تم تجاوز الحد المسموح (30 طلب/دقيقة). انتظر دقيقة وحاول مجدداً.');
      return ok({ ok: true });
    }

    // Update lastActivity
    await db.collection('telegram_users').updateOne({ telegramId: tgId }, { $set: { lastActivity: new Date().toISOString() }, $inc: { totalRequests: 1 } });

    // Route the request
    const route = isCallback ? dataOrText : (dataOrText === '/start' ? 'home' : 'home');
    const [main, sub] = route.split(':');
    let response = null;
    const perms = dbUser.permissions || [];
    const has = (p) => perms.includes(p) || perms.includes('all');
    const needPerm = (p, builder) => has(p) ? builder() : Promise.resolve({ text: '⛔ <b>غير مصرح لك بهذا القسم</b>', kb: { inline_keyboard: [[{ text: '🔙 الرئيسية', callback_data: 'home' }]] } });

    try {
      if (main === 'home' || main === '/start') response = await buildHome(db, dbUser);
      else if (main === 'reports') response = await needPerm('reports', () => buildReports(db, sub));
      else if (main === 'employees') response = await needPerm('employees', () => buildEmployees(db, sub));
      else if (main === 'subscribers') response = await needPerm('subscribers', () => buildSubscribers(db, sub));
      else if (main === 'finance') response = await needPerm('finance', () => buildFinance(db, sub));
      else if (main === 'maintenance') response = await needPerm('maintenance', () => buildMaintenance(db, sub));
      else if (main === 'network') response = await needPerm('network', () => buildNetwork(db, sub));
      else if (main === 'me') response = buildMe(dbUser);
      else if (main === 'logs') response = await needPerm('view_logs', () => buildLogs(db));
      else if (main === 'admin') response = await needPerm('manage_users', () => buildAdmin(db));
      else response = await buildHome(db, dbUser);
    } catch (e) {
      response = { text: `⚠️ خطأ: ${e.message}`, kb: { inline_keyboard: [[{ text: '🔙 الرئيسية', callback_data: 'home' }]] } };
    }

    // Log
    await db.collection('telegram_logs').insertOne({
      id: uuidv4(), telegramId: tgId, userName: dbUser.name,
      action: route, success: true,
      details: '', timestamp: new Date().toISOString(),
    });

    // Send response
    if (isCallback) {
      await tgAnswerCallback(token, update.callback_query.id);
      await tgEdit(token, chatId, messageId, response.text, response.kb);
    } else {
      await tgSend(token, chatId, response.text, response.kb);
    }
    return ok({ ok: true });
  }

  // Setup webhook
  if (path === 'telegram/setup-webhook' && method === 'POST') {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return err('TELEGRAM_BOT_TOKEN غير مضبوط في .env', 400);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) return err('NEXT_PUBLIC_BASE_URL غير مضبوط', 400);
    const webhookUrl = `${baseUrl}/api/telegram/webhook`;
    const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'callback_query'] }),
    }).then(r => r.json()).catch(e => ({ ok: false, error: e.message }));
    return ok({ success: r.ok, response: r, webhookUrl });
  }

  // Get webhook info
  if (path === 'telegram/webhook-info' && method === 'GET') {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return err('TELEGRAM_BOT_TOKEN غير مضبوط', 400);
    const r = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then(r => r.json());
    return ok(r);
  }

  // Delete webhook
  if (path === 'telegram/delete-webhook' && method === 'POST') {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return err('TELEGRAM_BOT_TOKEN غير مضبوط', 400);
    const r = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, { method: 'POST' }).then(r => r.json());
    return ok(r);
  }

  // ============ TELEGRAM USERS CRUD (admin platform) ============
  if (path === 'telegram-users' && method === 'GET') {
    const items = await db.collection('telegram_users').find({}).sort({ createdAt: -1 }).toArray();
    return ok(items.map(x => { delete x._id; return x; }));
  }
  if (path === 'telegram-users' && method === 'POST') {
    const body = await getJsonBody(request);
    if (!body.telegramId || !body.name || !body.role) return err('الحقول الأساسية مطلوبة', 400);
    const existing = await db.collection('telegram_users').findOne({ telegramId: String(body.telegramId) });
    if (existing) return err('هذا Telegram ID مضاف مسبقاً', 400);
    const perms = body.permissions || ROLE_DEFAULT_PERMS[body.role] || [];
    const doc = {
      id: uuidv4(), telegramId: String(body.telegramId), name: body.name,
      role: body.role, permissions: perms, enabled: body.enabled !== false,
      createdAt: new Date().toISOString(), lastActivity: null, failedAttempts: 0, totalRequests: 0,
    };
    await db.collection('telegram_users').insertOne(doc);
    delete doc._id;
    await logActivity(db, { action: 'tg_user_created', entity: 'telegram_users', entityId: doc.id, details: `إضافة Telegram ID ${doc.telegramId} (${doc.name})`, ip: clientIp });
    return ok(doc, 201);
  }
  if (path.match(/^telegram-users\/[^/]+$/) && method === 'PUT') {
    const id = path.split('/')[1];
    const body = await getJsonBody(request);
    delete body._id; delete body.id;
    await db.collection('telegram_users').updateOne({ id }, { $set: body });
    const updated = await db.collection('telegram_users').findOne({ id });
    if (updated) delete updated._id;
    await logActivity(db, { action: 'tg_user_updated', entity: 'telegram_users', entityId: id, details: `تعديل ${updated?.name}`, ip: clientIp });
    return ok(updated);
  }
  if (path.match(/^telegram-users\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[1];
    const u = await db.collection('telegram_users').findOne({ id });
    await db.collection('telegram_users').deleteOne({ id });
    await logActivity(db, { action: 'tg_user_deleted', entity: 'telegram_users', entityId: id, details: `حذف ${u?.name}`, ip: clientIp });
    return ok({ success: true });
  }

  // Telegram logs
  if (path === 'telegram-logs' && method === 'GET') {
    const url = new URL(request.url);
    const limit = Math.min(500, Number(url.searchParams.get('limit') || 100));
    const filter = url.searchParams.get('telegramId');
    const q = filter ? { telegramId: filter } : {};
    const items = await db.collection('telegram_logs').find(q).sort({ timestamp: -1 }).limit(limit).toArray();
    return ok(items.map(x => { delete x._id; return x; }));
  }

  // Self-data endpoint (employee can fetch own info without exposing list)
  if (path.match(/^employees\/[^/]+\/self$/) && method === 'GET') {
    const empId = path.split('/')[1];
    const emp = await db.collection('employees').findOne({ id: empId });
    if (!emp) return err('غير موجود', 404);
    // Strip sensitive fields from other contexts
    const safe = {
      id: emp.id, employeeId: emp.employeeId, name: emp.name, role: emp.role,
      photo: emp.photo, shiftStart: emp.shiftStart, shiftEnd: emp.shiftEnd,
      permissions: emp.permissions || ['tasks'], status: emp.status,
      salary: emp.salary, kpi: emp.kpi, ratingPoints: emp.ratingPoints || 0,
      tasksCompleted: emp.tasksCompleted || 0,
    };
    return ok(safe);
  }

  // ============ SCOPED EMPLOYEE PAGES (real, permission-checked) ============
  // Helper to validate token & permission
  const checkEmpPermission = async (empId, requiredPerm) => {
    const tokenHeader = request.headers.get('x-emp-token') || '';
    // Token format: emp_<empId>_<timestamp>
    const tokenEmpId = tokenHeader.startsWith('emp_') ? tokenHeader.split('_')[1] : null;
    if (!tokenEmpId || tokenEmpId !== empId) return { ok: false, code: 401, msg: 'غير مصرح' };
    const emp = await db.collection('employees').findOne({ id: empId });
    if (!emp) return { ok: false, code: 404, msg: 'الموظف غير موجود' };
    const perms = emp.permissions || [];
    if (requiredPerm && !perms.includes(requiredPerm) && !perms.includes('all')) {
      return { ok: false, code: 403, msg: 'ليس لديك صلاحية الوصول لهذا القسم' };
    }
    return { ok: true, emp };
  };

  // Employee's own sales
  if (path.match(/^employees\/[^/]+\/sales$/) && method === 'GET') {
    const empId = path.split('/')[1];
    const check = await checkEmpPermission(empId, 'pos');
    if (!check.ok) return err(check.msg, check.code);
    const sales = await db.collection('sales').find({ cashierId: empId }).sort({ createdAt: -1 }).limit(100).toArray();
    const total = sales.reduce((s, x) => s + (x.total || 0), 0);
    return ok({ sales: sales.map(s => { delete s._id; return s; }), total, count: sales.length });
  }

  // Employee records a sale (POS)
  if (path.match(/^employees\/[^/]+\/sales$/) && method === 'POST') {
    const empId = path.split('/')[1];
    const check = await checkEmpPermission(empId, 'pos');
    if (!check.ok) return err(check.msg, check.code);
    const body = await getJsonBody(request);
    const items = body.items || [];
    const discount = Number(body.discount || 0);
    let subtotal = 0;
    for (const it of items) {
      subtotal += (it.price || 0) * (it.quantity || 1);
      if (it.id) {
        await db.collection('products').updateOne({ id: it.id }, { $inc: { stock: -(it.quantity || 1) } });
      }
    }
    const total = Math.max(0, subtotal - discount);
    const sale = {
      id: uuidv4(),
      invoiceNumber: `INV-${Date.now()}`,
      items, subtotal, discount, total,
      paymentMethod: body.paymentMethod || 'cash',
      cashier: check.emp.name, cashierId: empId,
      customer: body.customer || '',
      createdAt: new Date().toISOString(),
    };
    await db.collection('sales').insertOne(sale);
    delete sale._id;
    return ok(sale, 201);
  }

  // Employee's repairs (technician)
  if (path.match(/^employees\/[^/]+\/repairs$/) && method === 'GET') {
    const empId = path.split('/')[1];
    const check = await checkEmpPermission(empId, 'repairs');
    if (!check.ok) return err(check.msg, check.code);
    const all = await db.collection('repairs').find({}).sort({ createdAt: -1 }).toArray();
    // Filter by technicianId OR technician name match
    const repairs = all.filter(r => r.technicianId === empId || r.technician === check.emp.name);
    return ok(repairs.map(r => { delete r._id; return r; }));
  }

  // Employee updates a repair status (only own)
  if (path.match(/^employees\/[^/]+\/repairs\/[^/]+$/) && method === 'PUT') {
    const parts = path.split('/');
    const empId = parts[1];
    const repId = parts[3];
    const check = await checkEmpPermission(empId, 'repairs');
    if (!check.ok) return err(check.msg, check.code);
    const repair = await db.collection('repairs').findOne({ id: repId });
    if (!repair) return err('التذكرة غير موجودة', 404);
    if (repair.technicianId !== empId && repair.technician !== check.emp.name) return err('غير مصرح', 403);
    const body = await getJsonBody(request);
    const allowed = ['status', 'cost', 'partsCost', 'notes', 'completedAt'];
    const upd = {};
    for (const k of allowed) if (k in body) upd[k] = body[k];
    upd.updatedAt = new Date().toISOString();
    if (upd.status === 'completed' && !upd.completedAt) upd.completedAt = upd.updatedAt;
    await db.collection('repairs').updateOne({ id: repId }, { $set: upd });
    const updated = await db.collection('repairs').findOne({ id: repId });
    if (updated) delete updated._id;
    return ok(updated);
  }

  // Employee's subscribers (filter by managedBy)
  if (path.match(/^employees\/[^/]+\/subscribers$/) && method === 'GET') {
    const empId = path.split('/')[1];
    const check = await checkEmpPermission(empId, 'subscribers');
    if (!check.ok) return err(check.msg, check.code);
    const all = await db.collection('subscribers').find({}).toArray();
    const mine = all.filter(s => s.managerId === empId || s.assignedTo === empId);
    return ok(mine.map(s => { delete s._id; return s; }));
  }

  // Employee personal report (own performance)
  if (path.match(/^employees\/[^/]+\/report$/) && method === 'GET') {
    const empId = path.split('/')[1];
    const url = new URL(request.url);
    const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const check = await checkEmpPermission(empId, 'reports');
    if (!check.ok) return err(check.msg, check.code);
    const emp = check.emp;
    const attendance = await db.collection('attendance').find({ employeeId: empId, date: { $regex: `^${month}` } }).toArray();
    const tasks = await db.collection('tasks').find({ assignedTo: empId }).toArray();
    const sales = await db.collection('sales').find({ cashierId: empId, createdAt: { $regex: `^${month}` } }).toArray();
    const repairs = (await db.collection('repairs').find({}).toArray()).filter(r => r.technicianId === empId || r.technician === emp.name);
    const entries = await db.collection('payroll_entries').find({ employeeId: empId, date: { $regex: `^${month}` } }).toArray();

    return ok({
      month,
      attendance: {
        total: attendance.length,
        present: attendance.filter(a => a.status === 'present').length,
        late: attendance.filter(a => a.status === 'late').length,
        absent: attendance.filter(a => a.status === 'absent').length,
        totalHours: attendance.reduce((s, x) => s + (x.hoursWorked || 0), 0).toFixed(1),
      },
      tasks: {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        pending: tasks.filter(t => ['pending', 'new'].includes(t.status)).length,
        inProgress: tasks.filter(t => ['in_progress', 'revision'].includes(t.status)).length,
        underReview: tasks.filter(t => t.status === 'pending_review').length,
      },
      sales: {
        count: sales.length,
        total: sales.reduce((s, x) => s + (x.total || 0), 0),
      },
      repairs: {
        total: repairs.length,
        completed: repairs.filter(r => r.status === 'completed').length,
        pending: repairs.filter(r => r.status !== 'completed').length,
      },
      payroll: {
        bonuses: entries.filter(e => e.type === 'bonus').reduce((s, x) => s + x.amount, 0),
        deductions: entries.filter(e => e.type === 'deduction').reduce((s, x) => s + x.amount, 0),
      },
      kpi: emp.kpi || 0,
      ratingPoints: emp.ratingPoints || 0,
      tasksCompletedAllTime: emp.tasksCompleted || 0,
    });
  }

  // ISP zones (read-only) for employees with isp permission
  if (path.match(/^employees\/[^/]+\/isp$/) && method === 'GET') {
    const empId = path.split('/')[1];
    const check = await checkEmpPermission(empId, 'isp');
    if (!check.ok) return err(check.msg, check.code);
    const zones = await db.collection('zones').find({}).toArray();
    const networks = await db.collection('networks').find({}).toArray();
    return ok({
      zones: zones.map(z => { delete z._id; return z; }),
      networks: networks.map(n => { delete n._id; return n; }),
    });
  }

  // Payroll calculation for employee for a month
  if (path.match(/^employees\/[^/]+\/payroll$/) && method === 'GET') {
    const empId = path.split('/')[1];
    const url = new URL(request.url);
    const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7); // YYYY-MM
    const emp = await db.collection('employees').findOne({ id: empId });
    if (!emp) return err('الموظف غير موجود', 404);
    const attRecords = await db.collection('attendance').find({ employeeId: empId, date: { $regex: `^${month}` } }).toArray();
    const entries = await db.collection('payroll_entries').find({ employeeId: empId, date: { $regex: `^${month}` } }).toArray();
    const advances = await db.collection('advances').find({ employeeId: empId, status: { $in: ['approved', 'paid'] } }).toArray();
    const presentDays = attRecords.filter(a => a.status === 'present').length;
    const lateDays = attRecords.filter(a => a.status === 'late').length;
    const absentDays = attRecords.filter(a => a.status === 'absent').length;
    const totalDays = attRecords.length;
    const bonuses = entries.filter(e => e.type === 'bonus').reduce((s, x) => s + (x.amount || 0), 0);
    const lateDeductions = entries.filter(e => e.type === 'deduction').reduce((s, x) => s + (x.amount || 0), 0);
    // Active advance installments (one per month per active advance)
    const advanceDeduction = advances
      .filter(a => a.status === 'approved' && (a.paidInstallments || 0) < (a.installments || 1))
      .reduce((s, a) => s + (a.perInstallment || 0), 0);
    const deductions = lateDeductions + advanceDeduction;
    const baseSalary = emp.salary || 0;
    const finalSalary = baseSalary + bonuses - deductions;
    return ok({
      employee: { id: emp.id, name: emp.name, employeeId: emp.employeeId, role: emp.role },
      month, baseSalary, bonuses, deductions,
      lateDeductions, advanceDeduction, finalSalary,
      presentDays, lateDays, absentDays, totalDays,
      activeAdvances: advances.filter(a => a.status === 'approved').map(a => ({
        id: a.id, amount: a.amount, perInstallment: a.perInstallment,
        installments: a.installments, paid: a.paidInstallments || 0, remaining: a.remainingAmount,
      })),
      entries: entries.map(e => { delete e._id; return e; }),
      attendance: attRecords.map(a => { delete a._id; return a; }),
    });
  }

  // HR Reports
  if (path === 'hr/reports' && method === 'GET') {
    const url = new URL(request.url);
    const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const employees = await db.collection('employees').find({}).toArray();
    const attendance = await db.collection('attendance').find({ date: { $regex: `^${month}` } }).toArray();
    const tasks = await db.collection('tasks').find({}).toArray();
    const entries = await db.collection('payroll_entries').find({ date: { $regex: `^${month}` } }).toArray();

    const byEmp = {};
    for (const e of employees) {
      const att = attendance.filter(a => a.employeeId === e.id);
      const empEntries = entries.filter(x => x.employeeId === e.id);
      const empTasks = tasks.filter(t => t.assignedTo === e.id);
      byEmp[e.id] = {
        id: e.id, employeeId: e.employeeId, name: e.name, role: e.role, photo: e.photo,
        presentDays: att.filter(a => a.status === 'present').length,
        lateDays: att.filter(a => a.status === 'late').length,
        totalHours: att.reduce((s, x) => s + (x.hoursWorked || 0), 0),
        bonuses: empEntries.filter(x => x.type === 'bonus').reduce((s, x) => s + x.amount, 0),
        deductions: empEntries.filter(x => x.type === 'deduction').reduce((s, x) => s + x.amount, 0),
        tasksTotal: empTasks.length,
        tasksCompleted: empTasks.filter(t => t.status === 'completed').length,
        kpi: e.kpi || 0,
      };
      byEmp[e.id].finalSalary = (e.salary || 0) + byEmp[e.id].bonuses - byEmp[e.id].deductions;
    }
    const empStats = Object.values(byEmp);
    return ok({
      month,
      totalEmployees: employees.length,
      totalSalaries: employees.reduce((s, e) => s + (e.salary || 0), 0),
      totalBonuses: entries.filter(x => x.type === 'bonus').reduce((s, x) => s + x.amount, 0),
      totalDeductions: entries.filter(x => x.type === 'deduction').reduce((s, x) => s + x.amount, 0),
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      employeeStats: empStats,
      topPerformers: [...empStats].sort((a, b) => b.kpi - a.kpi).slice(0, 5),
      mostAbsent: [...empStats].sort((a, b) => b.lateDays - a.lateDays).slice(0, 5),
    });
  }

  // ============ PENDING ACTIVATIONS (طلبات تفعيل بانتظار موافقة المدير) ============
  if (path === 'pending-activations' && method === 'GET') {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';
    const q = status === 'all' ? {} : { status };
    const items = await db.collection('pending_activations').find(q).sort({ requestedAt: -1 }).limit(200).toArray();
    return ok(items.map(x => { delete x._id; return x; }));
  }

  if (path.match(/^pending-activations\/[^/]+\/approve$/) && method === 'POST') {
    const id = path.split('/')[1];
    const body = await getJsonBody(request);
    const pending = await db.collection('pending_activations').findOne({ id });
    if (!pending) return err('الطلب غير موجود', 404);
    if (pending.status !== 'pending') return err('تمت معالجة هذا الطلب مسبقاً', 400);

    // Re-execute the activation by calling the activate endpoint internally with skipApprovalCheck=true
    const subscriber = await db.collection('subscribers').findOne({ id: pending.subscriberId });
    if (!subscriber) return err('المشترك غير موجود', 404);

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + (pending.durationMonths || 1) * 30 * 86400000);
    const activation = {
      id: uuidv4(),
      subscriberId: pending.subscriberId,
      subscriberName: pending.subscriberName,
      subscriberPhone: pending.subscriberPhone,
      username: pending.username,
      packageId: pending.packageId,
      packageName: pending.packageName,
      speed: pending.speed,
      amount: pending.amount,
      paymentMethod: pending.paymentMethod,
      durationMonths: pending.durationMonths,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      agentId: pending.agentId,
      agentName: pending.agentName,
      agentProfit: pending.agentProfit,
      companyProfit: pending.companyProfit,
      processedBy: body.approvedBy || 'المدير',
      notes: pending.notes,
      status: 'completed',
      approvedFromPendingId: id,
      createdAt: new Date().toISOString(),
    };
    await db.collection('activations').insertOne({ ...activation });
    delete activation._id;

    // Update subscriber
    await db.collection('subscribers').updateOne({ id: pending.subscriberId }, {
      $set: {
        status: 'active', package: pending.speed, fee: pending.amount, debt: 0,
        dueDate: endDate.toISOString().slice(0, 10),
        agentId: pending.agentId, agentName: pending.agentName,
        lastActivationAt: new Date().toISOString(),
      }
    });

    // Update agent stats
    if (pending.agentId) {
      await db.collection('agents').updateOne({ id: pending.agentId }, {
        $inc: { totalActivations: 1, totalProfit: pending.agentProfit, balance: pending.agentProfit },
      });
    }

    // Mark pending as approved
    const now = new Date().toISOString();
    await db.collection('pending_activations').updateOne({ id }, {
      $set: { status: 'approved', approvedBy: body.approvedBy || 'المدير', approvedAt: now, activationId: activation.id }
    });

    await logActivity(db, { action: 'pending_activation_approved', entity: 'pending_activations', entityId: id, user: body.approvedBy || 'المدير', details: `موافقة على تفعيل ${pending.subscriberName}`, ip: clientIp });
    return ok({ success: true, activation });
  }

  if (path.match(/^pending-activations\/[^/]+\/reject$/) && method === 'POST') {
    const id = path.split('/')[1];
    const body = await getJsonBody(request);
    const pending = await db.collection('pending_activations').findOne({ id });
    if (!pending) return err('الطلب غير موجود', 404);
    if (pending.status !== 'pending') return err('تمت معالجة هذا الطلب مسبقاً', 400);
    const now = new Date().toISOString();
    await db.collection('pending_activations').updateOne({ id }, {
      $set: { status: 'rejected', approvedBy: body.approvedBy || 'المدير', approvedAt: now, rejectionReason: body.reason || '' }
    });
    await logActivity(db, { action: 'pending_activation_rejected', entity: 'pending_activations', entityId: id, user: body.approvedBy || 'المدير', details: `رفض تفعيل ${pending.subscriberName}: ${body.reason || ''}`, ip: clientIp });
    return ok({ success: true });
  }

  // Agent stats
  if (path.match(/^agents\/[^/]+\/stats$/) && method === 'GET') {
    const id = path.split('/')[1];
    const agent = await db.collection('agents').findOne({ id });
    if (!agent) return err('الوكيل غير موجود', 404);
    delete agent._id;
    const subscribers = await db.collection('subscribers').find({ agentId: id }).toArray();
    const activations = await db.collection('activations').find({ agentId: id }).sort({ createdAt: -1 }).toArray();
    const totalRevenue = activations.reduce((s, a) => s + (a.amount || 0), 0);
    const totalProfit = activations.reduce((s, a) => s + (a.agentProfit || 0), 0);
    const totalDebt = subscribers.reduce((s, x) => s + (x.debt || 0), 0);
    // Expiring soon (next 7 days)
    const soon = new Date(Date.now() + 7 * 86400000);
    const expiringSoon = subscribers.filter(s => s.dueDate && new Date(s.dueDate) <= soon && s.status === 'active').length;
    return ok({
      agent,
      stats: {
        totalSubscribers: subscribers.length,
        activeSubscribers: subscribers.filter(s => s.status === 'active').length,
        totalActivations: activations.length,
        totalRevenue,
        totalProfit,
        totalDebt,
        expiringSoon,
      },
      subscribers: subscribers.map(s => { delete s._id; return s; }),
      activations: activations.slice(0, 20).map(a => { delete a._id; return a; }),
    });
  }

  // Agent login
  if (path === 'agents/login' && method === 'POST') {
    const { username, password } = await getJsonBody(request);
    const agent = await db.collection('agents').findOne({ username, password });
    if (!agent) return err('بيانات تسجيل الدخول خاطئة', 401);
    delete agent._id;
    return ok({ success: true, agent, token: `agent_${agent.id}_${Date.now()}` });
  }

  if (path === 'pos/checkout' && method === 'POST') {
    const body = await getJsonBody(request);
    const items = Array.isArray(body.items) ? body.items : [];
    const discount = Math.max(0, Number(body.discount || 0));
    const surcharge = Math.max(0, Number(body.surcharge || 0));
    const paymentMethod = body.paymentMethod || 'cash';
    const cashier = body.cashier || body.cashierName || null;
    const cashierId = body.cashierId || null;
    const cashierRole = body.cashierRole || '';
    const customer = body.customer || 'زبون نقدي';
    const discountReason = String(body.discountReason || '').trim();
    const surchargeReason = String(body.surchargeReason || '').trim();
    const managerOverride = body.managerOverride === true; // true if manager approved over-limit
    if (items.length === 0) return err('السلة فارغة', 400);

    let subtotal = 0;
    for (const it of items) {
      subtotal += Number(it.price || 0) * Number(it.quantity || 1);
    }

    // ============ POS PERMISSIONS & LIMIT VALIDATION ============
    const settingsDoc = await db.collection('settings').findOne({ id: 'system' });
    // Merge with defaults to ensure pos section exists
    const posCfg = { ...SETTINGS_DEFAULTS.pos, ...(settingsDoc?.pos || {}) };
    const overLimitWarnings = [];

    if (discount > 0) {
      if (posCfg.allowDiscount === false) return err('الخصم غير مسموح حسب الإعدادات', 403);
      if (posCfg.requireDiscountReason !== false && !discountReason) return err('سبب الخصم مطلوب', 400);
      if (Array.isArray(posCfg.discountAllowedRoles) && posCfg.discountAllowedRoles.length > 0 && cashierRole && !posCfg.discountAllowedRoles.includes(cashierRole) && cashierRole !== 'admin') {
        return err('الدور الحالي لا يملك صلاحية الخصم', 403);
      }
      const maxAmt = Number(posCfg.maxDiscountAmount || 0);
      const maxPct = Number(posCfg.maxDiscountPercent || 0);
      const pctOfSub = subtotal > 0 ? (discount / subtotal) * 100 : 0;
      const overAmt = maxAmt > 0 && discount > maxAmt;
      const overPct = maxPct > 0 && pctOfSub > maxPct;
      if (overAmt || overPct) {
        if (!managerOverride && posCfg.requireManagerApprovalAboveLimit !== false) {
          return err(`الخصم يتجاوز الحد المسموح${overAmt ? ` (الحد ${maxAmt.toLocaleString('en-US')} د.ع)` : ''}${overPct ? ` (الحد ${maxPct}%)` : ''} - يحتاج موافقة المدير`, 403);
        }
        overLimitWarnings.push('discount_over_limit');
      }
    }

    if (surcharge > 0) {
      if (posCfg.allowIncrease === false) return err('الزيادة غير مسموحة حسب الإعدادات', 403);
      if (posCfg.requireIncreaseReason !== false && !surchargeReason) return err('سبب الزيادة مطلوب', 400);
      if (Array.isArray(posCfg.increaseAllowedRoles) && posCfg.increaseAllowedRoles.length > 0 && cashierRole && !posCfg.increaseAllowedRoles.includes(cashierRole) && cashierRole !== 'admin') {
        return err('الدور الحالي لا يملك صلاحية الزيادة', 403);
      }
      const maxAmt = Number(posCfg.maxIncreaseAmount || 0);
      const maxPct = Number(posCfg.maxIncreasePercent || 0);
      const pctOfSub = subtotal > 0 ? (surcharge / subtotal) * 100 : 0;
      const overAmt = maxAmt > 0 && surcharge > maxAmt;
      const overPct = maxPct > 0 && pctOfSub > maxPct;
      if (overAmt || overPct) {
        if (!managerOverride && posCfg.requireManagerApprovalAboveLimit !== false) {
          return err(`الزيادة تتجاوز الحد المسموح${overAmt ? ` (الحد ${maxAmt.toLocaleString('en-US')} د.ع)` : ''}${overPct ? ` (الحد ${maxPct}%)` : ''} - تحتاج موافقة المدير`, 403);
        }
        overLimitWarnings.push('surcharge_over_limit');
      }
    }

    // ============ DECREMENT STOCK ============
    for (const it of items) {
      if (it.id || it.productId) {
        await db.collection('products').updateOne(
          { id: it.productId || it.id },
          { $inc: { stock: -Number(it.quantity || 1) } }
        );
      }
    }

    const total = Math.max(0, subtotal - discount + surcharge);
    const now = new Date().toISOString();
    const sale = {
      id: uuidv4(),
      invoiceNumber: `INV-${Date.now()}`,
      items, subtotal, discount, surcharge, total, paymentMethod,
      cashier, cashierId, cashierName: cashier, cashierRole,
      customer, discountReason, surchargeReason,
      managerOverride: !!managerOverride,
      overLimitWarnings,
      profit: 0, status: 'completed', cancelled: false,
      createdAt: now,
    };
    await db.collection('sales').insertOne(sale);
    delete sale._id;

    // Standard sale activity log
    await logActivity(db, { action: 'sale_created', entity: 'sales', entityId: sale.id, user: cashier || 'POS', details: `فاتورة ${sale.invoiceNumber} - ${total.toLocaleString()} د.ع`, ip: clientIp });

    // ============ POS MODIFICATION AUDIT LOG ============
    if (discount > 0 || surcharge > 0) {
      await db.collection('pos_modifications').insertOne({
        id: uuidv4(),
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        cashier, cashierId, cashierRole,
        customer, subtotal, discount, surcharge, total,
        discountReason, surchargeReason,
        managerOverride: !!managerOverride,
        overLimitWarnings,
        modificationType: discount > 0 && surcharge > 0 ? 'both' : (discount > 0 ? 'discount' : 'increase'),
        createdAt: now,
      });
      await logActivity(db, {
        action: 'pos_modification', entity: 'pos_modifications', entityId: sale.id,
        user: cashier || 'POS',
        details: `${discount > 0 ? `خصم ${discount.toLocaleString('en-US')} د.ع${discountReason ? ` (${discountReason})` : ''}` : ''}${discount > 0 && surcharge > 0 ? ' | ' : ''}${surcharge > 0 ? `زيادة ${surcharge.toLocaleString('en-US')} د.ع${surchargeReason ? ` (${surchargeReason})` : ''}` : ''} - فاتورة ${sale.invoiceNumber}`,
        ip: clientIp,
      });
      // Notify manager for visibility
      if (overLimitWarnings.length > 0 || managerOverride) {
        await notifyManager(db, {
          type: 'pos_over_limit',
          title: `⚠️ تعديل POS فوق الحد - ${sale.invoiceNumber}`,
          message: `الكاشير: ${cashier || '-'}\n${discount > 0 ? `الخصم: ${discount.toLocaleString('en-US')} د.ع${discountReason ? ` (${discountReason})` : ''}\n` : ''}${surcharge > 0 ? `الزيادة: ${surcharge.toLocaleString('en-US')} د.ع${surchargeReason ? ` (${surchargeReason})` : ''}\n` : ''}الإجمالي: ${total.toLocaleString('en-US')} د.ع`,
          entityType: 'generic', entityId: sale.id,
          priority: 'high',
        });
      }
    }

    // Emit real-time event
    await db.collection('events').insertOne({ id: uuidv4(), type: 'sale_new', saleId: sale.id, invoiceNumber: sale.invoiceNumber, total, cashier, ts: now });
    return ok(sale, 201);
  }

  // ============ POS MODIFICATIONS AUDIT LOG ============
  if (path === 'pos/modifications' && method === 'GET') {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const cashierId = url.searchParams.get('cashierId');
    const type = url.searchParams.get('type'); // 'discount' | 'increase' | 'both' | undefined
    const q = {};
    if (startDate || endDate) {
      q.createdAt = {};
      if (startDate) q.createdAt.$gte = startDate;
      if (endDate) q.createdAt.$lte = endDate + 'T23:59:59.999Z';
    }
    if (cashierId) q.cashierId = cashierId;
    if (type && ['discount', 'increase', 'both'].includes(type)) q.modificationType = type;
    const items = await db.collection('pos_modifications').find(q).sort({ createdAt: -1 }).limit(500).toArray();
    const cleaned = items.map(x => { delete x._id; return x; });
    // Summary
    const totalDiscount = cleaned.reduce((s, x) => s + Number(x.discount || 0), 0);
    const totalIncrease = cleaned.reduce((s, x) => s + Number(x.surcharge || 0), 0);
    const overLimitCount = cleaned.filter(x => Array.isArray(x.overLimitWarnings) && x.overLimitWarnings.length > 0).length;
    return ok({
      items: cleaned,
      summary: {
        totalCount: cleaned.length,
        totalDiscount, totalIncrease,
        overLimitCount,
        netAdjustment: totalIncrease - totalDiscount,
      },
    });
  }

  if (path.startsWith('products/barcode/') && method === 'GET') {
    const barcode = path.split('/')[2];
    const product = await db.collection('products').findOne({ barcode });
    if (!product) return err('المنتج غير موجود', 404);
    delete product._id;
    return ok(product);
  }

  // ============ SMART PARTS SEARCH (نظام البحث الذكي مع التوافقية) ============
  // GET /api/products/search?q=...&device=...&origin=...&category=...&type=...&brand=...&inStock=true
  if (path === 'products/search' && method === 'GET') {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const device = (url.searchParams.get('device') || '').trim().toLowerCase();
    const origin = url.searchParams.get('origin') || '';
    const category = url.searchParams.get('category') || '';
    const productType = url.searchParams.get('type') || '';
    const brand = (url.searchParams.get('brand') || '').toLowerCase();
    const inStockOnly = url.searchParams.get('inStock') === 'true';
    const minPrice = Number(url.searchParams.get('minPrice') || 0);
    const maxPrice = Number(url.searchParams.get('maxPrice') || 0);

    const all = await db.collection('products').find({}).toArray();
    const norm = (s) => String(s || '').toLowerCase();
    const includesText = (txt) => !q || norm(txt).includes(q);

    const matchesFilters = (p) => {
      if (origin && p.origin !== origin) return false;
      if (category && p.category !== category) return false;
      if (productType && p.productType !== productType) return false;
      if (brand && norm(p.brand) !== brand) return false;
      if (inStockOnly && Number(p.stock || 0) <= 0) return false;
      if (minPrice && Number(p.price || 0) < minPrice) return false;
      if (maxPrice && Number(p.price || 0) > maxPrice) return false;
      return true;
    };

    // Helper: does product match the device exactly?
    const matchesDeviceExact = (p) => {
      if (!device) return true;
      const compat = (p.compatibleDevices || []).map(norm);
      const model = norm(p.model);
      const name = norm(p.name);
      return compat.some(c => c === device) || model === device || name.includes(device);
    };

    // Helper: similar device (partial match)
    const matchesDevicePartial = (p) => {
      if (!device) return false;
      const compat = (p.compatibleDevices || []).map(norm);
      const model = norm(p.model);
      const name = norm(p.name);
      // Strip trailing words to find related models, e.g. "iphone 14 pro max" → "iphone 14 pro"
      const tokens = device.split(/\s+/);
      for (let i = tokens.length - 1; i >= 1; i--) {
        const stem = tokens.slice(0, i).join(' ');
        if (compat.some(c => c.includes(stem)) || model.includes(stem) || name.includes(stem)) return true;
      }
      // Fallback: any device token match
      for (const t of tokens) {
        if (t.length >= 3 && (compat.some(c => c.includes(t)) || model.includes(t) || name.includes(t))) return true;
      }
      return false;
    };

    const matchesText = (p) => {
      if (!q) return true;
      return includesText(p.name) || includesText(p.sku) || includesText(p.barcode) ||
             includesText(p.brand) || includesText(p.model) || includesText(p.color) ||
             (p.compatibleDevices || []).some(d => includesText(d));
    };

    const exact = [];
    const compatible = [];
    const alternatives = [];

    for (const p of all) {
      delete p._id;
      if (!matchesFilters(p)) continue;
      if (!matchesText(p)) continue;
      if (matchesDeviceExact(p)) {
        exact.push(p);
      } else if (matchesDevicePartial(p)) {
        compatible.push(p);
      } else if (q && (includesText(p.productType) || includesText(p.category))) {
        alternatives.push(p);
      }
    }

    return ok({
      exact: exact.slice(0, 200),
      compatible: compatible.slice(0, 50),
      alternatives: alternatives.slice(0, 50),
      total: exact.length + compatible.length + alternatives.length,
      query: { q, device, origin, category, productType, brand, inStockOnly, minPrice, maxPrice },
    });
  }

  // GET /api/products/devices — list all unique compatible devices
  if (path === 'products/devices' && method === 'GET') {
    const products = await db.collection('products').find({}).toArray();
    const set = new Set();
    for (const p of products) {
      (p.compatibleDevices || []).forEach(d => d && set.add(d));
      if (p.brand && p.model) set.add(`${p.brand} ${p.model}`);
    }
    return ok(Array.from(set).sort());
  }

  // GET /api/products/:id/compatible — find products compatible with same devices
  if (path.match(/^products\/[^/]+\/compatible$/) && method === 'GET') {
    const id = path.split('/')[1];
    const target = await db.collection('products').findOne({ id });
    if (!target) return err('المنتج غير موجود', 404);
    const devices = new Set((target.compatibleDevices || []).map(s => String(s).toLowerCase()));
    if (target.model) devices.add(String(target.model).toLowerCase());
    const all = await db.collection('products').find({ id: { $ne: id } }).toArray();
    const result = all.filter(p => {
      const pd = (p.compatibleDevices || []).map(s => String(s).toLowerCase());
      if (p.model && devices.has(String(p.model).toLowerCase())) return true;
      return pd.some(d => devices.has(d));
    }).map(p => { delete p._id; return p; });
    return ok({ target: (() => { delete target._id; return target; })(), compatible: result });
  }

  if (path === 'noc/status' && method === 'GET') {
    const zones = await db.collection('zones').find({}).toArray();
    const subscribers = await db.collection('subscribers').countDocuments({ status: 'active' });
    return ok({
      zones: zones.map(z => { delete z._id; return { ...z, ping: Math.floor(Math.random() * 30) + 5, packetLoss: z.status === 'offline' ? 100 : (z.status === 'warning' ? Math.random() * 5 : Math.random() * 1), uplink: Math.floor(Math.random() * 800) + 100, downlink: Math.floor(Math.random() * 900) + 100 }; }),
      activeConnections: subscribers,
      totalTraffic: Math.floor(Math.random() * 5000) + 3000,
      alerts: zones.filter(z => z.status !== 'online').map(z => ({ id: z.id, type: z.status === 'offline' ? 'critical' : 'warning', message: z.status === 'offline' ? `الزون ${z.name} مفصول!` : `الزون ${z.name} ضغط عالي (${z.utilization}%)`, time: new Date().toISOString() })),
    });
  }

  // ============ AI LOAD BALANCING SUGGESTIONS ============
  // GET /api/zones/load-balance — deterministic suggestions for over-loaded zones
  if (path === 'zones/load-balance' && method === 'GET') {
    const settingsDoc = await db.collection('settings').findOne({ id: 'system' });
    const zonesCfg = settingsDoc?.zones || {};
    const warnTh = Number(zonesCfg.warningThreshold ?? 80);
    const critTh = Number(zonesCfg.criticalThreshold ?? 95);
    const defaultCap = Number(zonesCfg.defaultCapacity ?? 32);

    const zones = await db.collection('zones').find({}).toArray();
    const networks = await db.collection('networks').find({}).toArray();
    const subs = await db.collection('subscribers').find({ status: 'active' }).toArray();

    // Index networks by zone
    const netsByZone = {};
    for (const n of networks) {
      if (!n.zoneId) continue;
      (netsByZone[n.zoneId] ||= []).push(n);
    }

    // Compute richer utilization (subscribers vs total capacity)
    const enriched = zones.map(z => {
      const zNets = netsByZone[z.id] || [];
      const capacity = zNets.length > 0 ? zNets.reduce((s, n) => s + (Number(n.capacity) || defaultCap), 0) : (Number(z.fats || 1) * defaultCap);
      const subsHere = subs.filter(s => s.zoneId === z.id).length;
      const utilization = capacity > 0 ? Math.round((subsHere / capacity) * 100) : 0;
      return { ...z, _capacity: capacity, _subscribers: subsHere, _utilization: utilization, _networks: zNets.length };
    });

    const overloaded = enriched.filter(z => (z._utilization || z.utilization || 0) >= warnTh);
    const underUsed = enriched.filter(z => (z._utilization || z.utilization || 0) < warnTh - 30 && z.status !== 'offline');

    const suggestions = [];

    for (const z of overloaded) {
      const util = z._utilization || z.utilization || 0;
      const isCritical = util >= critTh;
      const overBy = Math.max(0, z._subscribers - Math.floor(z._capacity * (warnTh / 100)));

      // Suggestion 1: Add new FAT(s)
      const fatsToAdd = Math.max(1, Math.ceil(overBy / defaultCap));
      suggestions.push({
        id: uuidv4(),
        zoneId: z.id, zoneName: z.name,
        priority: isCritical ? 'critical' : 'high',
        type: 'add_fat',
        title: `➕ إضافة ${fatsToAdd} فات${fatsToAdd > 1 ? '' : ' '} جديدة في ${z.name}`,
        reason: `الزون مُحمَّل بنسبة ${util}% (${z._subscribers}/${z._capacity}). إضافة ${fatsToAdd} فات تزيد السعة بـ ${fatsToAdd * defaultCap} مشترك.`,
        action: { type: 'add_fat', zoneId: z.id, count: fatsToAdd, capacityPerFat: defaultCap },
      });

      // Suggestion 2: Move subscribers to nearby under-used zone
      if (underUsed.length > 0 && overBy > 0) {
        // Pick closest under-used zone by lat/lng if available, else first
        let target = underUsed[0];
        if (z.lat && z.lng) {
          target = underUsed.reduce((best, u) => {
            if (!u.lat || !u.lng) return best;
            const dCur = Math.hypot((u.lat - z.lat), (u.lng - z.lng));
            const dBest = best.lat ? Math.hypot((best.lat - z.lat), (best.lng - z.lng)) : Infinity;
            return dCur < dBest ? u : best;
          }, target);
        }
        const moveCount = Math.min(overBy, target._capacity - target._subscribers);
        if (moveCount > 0) {
          suggestions.push({
            id: uuidv4(),
            zoneId: z.id, zoneName: z.name,
            priority: isCritical ? 'critical' : 'medium',
            type: 'move_subscribers',
            title: `🔀 نقل ${moveCount} مشترك من ${z.name} إلى ${target.name}`,
            reason: `${z.name} مُحمَّل ${util}%، بينما ${target.name} مستخدم ${target._utilization}% فقط. النقل يخفّف الضغط ويحسّن الاستقرار.`,
            action: { type: 'move_subscribers', fromZoneId: z.id, toZoneId: target.id, count: moveCount },
          });
        }
      }

      // Suggestion 3: Create sub-zone (split)
      if (isCritical) {
        suggestions.push({
          id: uuidv4(),
          zoneId: z.id, zoneName: z.name,
          priority: 'high',
          type: 'create_subzone',
          title: `🪓 تقسيم ${z.name} إلى زون فرعي`,
          reason: `الزون عند ${util}% (حرج). تقسيمه إلى زون رئيسي + فرعي يضمن استقراراً طويل المدى ومراقبة أدق.`,
          action: { type: 'create_subzone', parentZoneId: z.id, parentZoneName: z.name },
        });
      }
    }

    // Offline zones — investigation needed
    for (const z of enriched.filter(x => x.status === 'offline')) {
      suggestions.push({
        id: uuidv4(),
        zoneId: z.id, zoneName: z.name,
        priority: 'critical',
        type: 'investigate_offline',
        title: `🚨 تحقيق فوري في ${z.name} (مفصول)`,
        reason: `الزون ${z.name} في حالة offline. ${z._subscribers} مشترك متأثر. يلزم إرسال فني فوراً.`,
        action: { type: 'create_repair_task', zoneId: z.id, zoneName: z.name },
      });
    }

    // Sort: critical → high → medium → low
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    suggestions.sort((a, b) => (order[a.priority] || 9) - (order[b.priority] || 9));

    return ok({
      generatedAt: new Date().toISOString(),
      summary: {
        totalZones: zones.length,
        overloadedCount: overloaded.length,
        underUsedCount: underUsed.length,
        offlineCount: enriched.filter(x => x.status === 'offline').length,
        thresholds: { warning: warnTh, critical: critTh },
      },
      zones: enriched.map(z => ({ id: z.id, name: z.name, status: z.status, subscribers: z._subscribers, capacity: z._capacity, utilization: z._utilization, networks: z._networks })),
      suggestions,
    });
  }

  // POST /api/zones/load-balance/apply — apply a suggestion
  if (path === 'zones/load-balance/apply' && method === 'POST') {
    const { action } = await getJsonBody(request);
    if (!action || !action.type) return err('action مطلوب', 400);
    const now = new Date().toISOString();
    let result = { success: false };

    if (action.type === 'add_fat') {
      const z = await db.collection('zones').findOne({ id: action.zoneId });
      if (!z) return err('الزون غير موجود', 404);
      const nets = await db.collection('networks').find({ zoneId: action.zoneId }).toArray();
      const docs = [];
      for (let i = 0; i < (action.count || 1); i++) {
        const num = nets.length + i + 1;
        docs.push({
          id: uuidv4(),
          number: `F-${String(z.number || z.id).slice(-4)}-${String(num).padStart(2, '0')}`,
          name: `FAT-${num} - ${z.name}`,
          zoneId: z.id, zoneName: z.name, zoneNumber: z.number,
          capacity: action.capacityPerFat || 32,
          subscribers: 0, status: 'active',
          lat: z.lat, lng: z.lng,
          utilization: 0,
          createdAt: now,
        });
      }
      if (docs.length > 0) await db.collection('networks').insertMany(docs);
      await db.collection('zones').updateOne({ id: z.id }, { $inc: { fats: docs.length } });
      result = { success: true, created: docs.length, type: 'add_fat' };

    } else if (action.type === 'move_subscribers') {
      const fromZ = await db.collection('zones').findOne({ id: action.fromZoneId });
      const toZ = await db.collection('zones').findOne({ id: action.toZoneId });
      if (!fromZ || !toZ) return err('زون غير موجود', 404);
      const subs = await db.collection('subscribers').find({ zoneId: action.fromZoneId, status: 'active' }).limit(Math.max(1, Number(action.count) || 1)).toArray();
      const ids = subs.map(s => s.id);
      if (ids.length > 0) {
        await db.collection('subscribers').updateMany(
          { id: { $in: ids } },
          { $set: { zoneId: toZ.id, zoneName: toZ.name, zoneNumber: toZ.number, movedAt: now, movedFromZoneId: fromZ.id } }
        );
        // Update counters
        const fromCount = await db.collection('subscribers').countDocuments({ zoneId: fromZ.id });
        const toCount = await db.collection('subscribers').countDocuments({ zoneId: toZ.id });
        await db.collection('zones').updateOne({ id: fromZ.id }, { $set: { subscribers: fromCount } });
        await db.collection('zones').updateOne({ id: toZ.id }, { $set: { subscribers: toCount } });
      }
      result = { success: true, moved: ids.length, type: 'move_subscribers' };

    } else if (action.type === 'create_subzone') {
      const parent = await db.collection('zones').findOne({ id: action.parentZoneId });
      if (!parent) return err('الزون الأب غير موجود', 404);
      const sibling = await db.collection('zones').countDocuments({ parentZoneId: parent.id });
      const sub = {
        id: uuidv4(),
        number: `${parent.number}-S${sibling + 1}`,
        name: `${parent.name} - فرعي ${sibling + 1}`,
        location: parent.location,
        lat: parent.lat, lng: parent.lng,
        status: 'online', subscribers: 0, fats: 1, utilization: 0,
        parentZoneId: parent.id, parentZoneName: parent.name,
        createdAt: now,
      };
      await db.collection('zones').insertOne(sub);
      result = { success: true, subzoneId: sub.id, type: 'create_subzone' };

    } else if (action.type === 'create_repair_task') {
      const t = {
        id: uuidv4(),
        title: `🚨 إصلاح زون مفصول: ${action.zoneName}`,
        description: `الزون ${action.zoneName} في حالة offline. التحقيق وإعادة التشغيل فوراً.`,
        priority: 'urgent',
        status: 'pending',
        progress: 0,
        attachments: [], notes: '',
        taskType: 'noc_investigation',
        relatedZoneId: action.zoneId,
        createdBy: 'AI Load Balancer',
        createdAt: now,
      };
      await db.collection('tasks').insertOne(t);
      result = { success: true, taskId: t.id, type: 'create_repair_task' };

    } else {
      return err('نوع action غير مدعوم', 400);
    }

    await logActivity(db, {
      action: `ai_loadbalance_apply_${action.type}`,
      entity: 'zones',
      entityId: action.zoneId || action.fromZoneId || null,
      user: 'المدير', details: `تطبيق اقتراح AI: ${action.type}`, ip: clientIp,
    });
    return ok(result);
  }

  if (path === 'reports/summary' && method === 'GET') {
    const sales = await db.collection('sales').find({}).toArray();
    const subs = await db.collection('subscribers').find({}).toArray();
    const repairs = await db.collection('repairs').find({}).toArray();
    const products = await db.collection('products').find({}).toArray();

    const totalSales = sales.reduce((s, x) => s + (x.total || 0), 0);
    const ispRevenue = subs.filter(s => s.status === 'active').reduce((s, x) => s + (x.fee || 0), 0);
    const repairRevenue = repairs.filter(r => r.status === 'completed').reduce((s, x) => s + (x.cost || 0), 0);
    const inventoryValue = products.reduce((s, p) => s + (p.cost || 0) * (p.stock || 0), 0);
    const categoryBreakdown = {};
    for (const p of products) {
      categoryBreakdown[p.category] = (categoryBreakdown[p.category] || 0) + p.stock;
    }
    return ok({
      totalSales, ispRevenue, repairRevenue, inventoryValue,
      totalRevenue: totalSales + ispRevenue + repairRevenue,
      categoryBreakdown: Object.entries(categoryBreakdown).map(([name, value]) => ({ name, value })),
      pieData: [
        { name: 'مبيعات POS', value: totalSales },
        { name: 'اشتراكات ISP', value: ispRevenue },
        { name: 'صيانة', value: repairRevenue },
      ],
    });
  }

  // ============ SETTINGS ENDPOINTS ============
  if (path === 'settings' && method === 'GET') {
    let doc = await db.collection('settings').findOne({ id: 'system' });
    if (!doc) {
      doc = { id: 'system', ...SETTINGS_DEFAULTS, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await db.collection('settings').insertOne(doc);
    }
    delete doc._id;
    // Deep merge with defaults so new sections appear
    const merged = { ...SETTINGS_DEFAULTS };
    for (const key of Object.keys(SETTINGS_DEFAULTS)) {
      merged[key] = { ...SETTINGS_DEFAULTS[key], ...(doc[key] || {}) };
    }
    return ok({ id: 'system', ...merged, createdAt: doc.createdAt, updatedAt: doc.updatedAt });
  }

  if (path === 'settings' && method === 'PUT') {
    const body = await getJsonBody(request);
    const current = await db.collection('settings').findOne({ id: 'system' }) || { id: 'system', ...SETTINGS_DEFAULTS };
    delete body.id; delete body._id;
    // Deep merge: merge top-level sections
    const updated = { ...current };
    for (const key of Object.keys(body)) {
      if (typeof body[key] === 'object' && !Array.isArray(body[key]) && body[key] !== null) {
        updated[key] = { ...(current[key] || {}), ...body[key] };
      } else {
        updated[key] = body[key];
      }
    }
    updated.updatedAt = new Date().toISOString();
    await db.collection('settings').updateOne(
      { id: 'system' },
      { $set: updated },
      { upsert: true }
    );
    delete updated._id;
    // Audit log
    await db.collection('activity_logs').insertOne({
      id: uuidv4(), user: body.__user || 'admin', action: 'settings_update',
      entity: 'settings', entityId: 'system',
      details: `تحديث الإعدادات: ${Object.keys(body).filter(k => !k.startsWith('__')).join(', ')}`,
      timestamp: new Date().toISOString(),
    });
    return ok(updated);
  }

  if (path === 'settings/reset' && method === 'POST') {
    const body = await getJsonBody(request);
    const section = body?.section;
    if (section && SETTINGS_DEFAULTS[section]) {
      await db.collection('settings').updateOne(
        { id: 'system' },
        { $set: { [section]: SETTINGS_DEFAULTS[section], updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      await db.collection('activity_logs').insertOne({
        id: uuidv4(), user: 'admin', action: 'settings_reset_section',
        entity: 'settings', entityId: section,
        details: `إعادة ضبط قسم: ${section}`, timestamp: new Date().toISOString(),
      });
      return ok({ success: true, section, defaults: SETTINGS_DEFAULTS[section] });
    }
    // Reset all
    await db.collection('settings').updateOne(
      { id: 'system' },
      { $set: { ...SETTINGS_DEFAULTS, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    await db.collection('activity_logs').insertOne({
      id: uuidv4(), user: 'admin', action: 'settings_reset_all',
      entity: 'settings', entityId: 'system',
      details: 'إعادة ضبط جميع الإعدادات للقيم الافتراضية',
      timestamp: new Date().toISOString(),
    });
    return ok({ success: true, defaults: SETTINGS_DEFAULTS });
  }

  // Test integrations (WhatsApp/Telegram)
  if (path === 'settings/test/whatsapp' && method === 'POST') {
    const body = await getJsonBody(request);
    const settings = await db.collection('settings').findOne({ id: 'system' });
    const wa = settings?.whatsapp || SETTINGS_DEFAULTS.whatsapp;
    if (!wa.enabled) return err('واتساب غير مفعّل في الإعدادات');
    if (!wa.apiToken) return err('لم يتم تعيين API Token');
    // Log a test message
    await db.collection('whatsapp_messages').insertOne({
      id: uuidv4(), subscriberId: null, phone: body.phone || wa.managerPhone,
      type: 'test', message: `🧪 رسالة اختبار من ${wa.senderName} - ${new Date().toLocaleString('ar-IQ')}`,
      status: 'queued', retries: 0, createdAt: new Date().toISOString(),
    });
    return ok({ success: true, message: 'تم تسجيل رسالة اختبار في الطابور (يحتاج backend job لإرسالها فعلياً)' });
  }

  if (path === 'settings/test/telegram' && method === 'POST') {
    const settings = await db.collection('settings').findOne({ id: 'system' });
    const tg = settings?.telegram || SETTINGS_DEFAULTS.telegram;
    if (!tg.enabled) return err('تليجرام غير مفعّل في الإعدادات');
    if (!tg.botToken) return err('لم يتم تعيين Bot Token');
    if (!tg.managerChatId) return err('لم يتم تعيين Chat ID');
    // Try sending via Telegram API directly
    try {
      const r = await fetch(`https://api.telegram.org/bot${tg.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tg.managerChatId, text: `🧪 رسالة اختبار من نظام مركز الغزلان - ${new Date().toLocaleString('ar-IQ')}` }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) return err('فشل: ' + (data.description || 'خطأ غير معروف'));
      return ok({ success: true, message: 'تم إرسال رسالة الاختبار بنجاح ✅' });
    } catch (e) {
      return err('فشل الاتصال بـ Telegram API: ' + e.message);
    }
  }

  // ============ BACKUP (Excel — تلقائي + يدوي) ============
  // Manual backup trigger — generates a real XLSX and saves to disk
  if (path === 'settings/backup/run' && method === 'POST') {
    try {
      const meta = await runBackupLib(db, { triggeredBy: 'manual' });
      return ok({ success: true, ...meta, timestamp: meta.createdAt });
    } catch (e) {
      console.error('[backup/run] error:', e);
      return err('فشل النسخ الاحتياطي: ' + (e?.message || ''), 500);
    }
  }

  // List all backups (sorted newest first)
  if (path === 'settings/backup/list' && method === 'GET') {
    try {
      const items = await listBackupsLib(db, 100);
      return ok(items);
    } catch (e) {
      return ok([]);
    }
  }

  // Download a specific backup as XLSX
  if (path.match(/^settings\/backup\/download\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[3];
    const data = await getBackupFile(db, id);
    if (!data) return err('النسخة الاحتياطية غير موجودة', 404);
    return new Response(data.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${data.meta.filename}"`,
        'Content-Length': String(data.buffer.length),
      },
    });
  }

  // Delete a backup
  if (path.match(/^settings\/backup\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[2];
    const ok2 = await deleteBackupLib(db, id);
    return ok2 ? ok({ success: true }) : err('النسخة غير موجودة', 404);
  }

  // Test Google Drive folder connection (validates URL format & saves)
  if (path === 'settings/backup/gdrive-test' && method === 'POST') {
    try {
      const body = await getJsonBody(request);
      const folderUrl = String(body.folderUrl || '').trim();
      let folderId = String(body.folderId || '').trim();
      if (!folderUrl) return err('رابط المجلد مطلوب', 400);
      // Extract folder ID from URL if not provided
      if (!folderId) {
        const m = folderUrl.match(/(?:folders\/|id=|\/d\/)([a-zA-Z0-9_-]{20,})/);
        if (m) folderId = m[1];
      }
      if (!folderId || folderId.length < 20) {
        return ok({ success: false, message: '⚠️ رابط غير صالح — تأكد من نسخ رابط المجلد كاملاً من Google Drive' });
      }
      // Persist into settings (single doc pattern used across the app)
      await db.collection('settings').updateOne(
        {},
        { $set: {
            'backup.googleDrive.folderUrl': folderUrl,
            'backup.googleDrive.folderId': folderId,
            'backup.googleDrive.lastTestedAt': new Date().toISOString(),
            'backup.googleDrive.verified': true,
            updatedAt: new Date().toISOString(),
        }},
        { upsert: true }
      );
      return ok({ success: true, folderId, message: `✅ صيغة الرابط صحيحة — المجلد جاهز (ID: ${folderId.slice(0, 12)}…)` });
    } catch (e) {
      return ok({ success: false, message: 'خطأ: ' + (e?.message || '') });
    }
  }

  if (path === 'ai/chat' && method === 'POST') {
    const body = await getJsonBody(request);
    const { message, history = [] } = body;
    if (!message) return err('الرسالة فارغة');
    if (!EMERGENT_LLM_KEY) {
      return ok({ reply: '⚠️ خدمة الذكاء الاصطناعي غير مفعّلة. يرجى إضافة EMERGENT_LLM_KEY في متغيرات البيئة.' });
    }
    try {
      const stats = await db.collection('subscribers').find({}).toArray();
      const products = await db.collection('products').find({}).toArray();
      const repairs = await db.collection('repairs').find({}).toArray();
      const zones = await db.collection('zones').find({}).toArray();
      const sales = await db.collection('sales').find({}).toArray();
      const ctx = {
        subscribers: { total: stats.length, active: stats.filter(s => s.status === 'active').length, debt: stats.reduce((s, x) => s + (x.debt || 0), 0) },
        inventory: { totalProducts: products.length, lowStock: products.filter(p => p.stock <= p.lowStockAlert).map(p => p.name) },
        repairs: { total: repairs.length, pending: repairs.filter(r => r.status !== 'completed').length },
        zones: zones.map(z => ({ name: z.name, status: z.status, utilization: z.utilization })),
        sales: { count: sales.length, total: sales.reduce((s, x) => s + (x.total || 0), 0) },
      };
      const sysPrompt = `أنت "غزلان AI" - المساعد الذكي لمنصة مركز الغزلان ERP. أنت خبير في:
- إدارة شركات الإنترنت (ISP) والشبكات
- نظام نقاط البيع POS وإدارة المخزون
- صيانة الهواتف
- تحليل الأعمال واقتراح القرارات
- الكاميرات والأمن

البيانات الحالية للشركة: ${JSON.stringify(ctx, null, 2)}

أجب دائماً باللغة العربية، بشكل مختصر ودقيق ومفيد. استخدم الأرقام والإحصائيات من البيانات أعلاه. كن ودوداً ومحترفاً.`;

      const messages = [
        { role: 'system', content: sysPrompt },
        ...history.slice(-10),
        { role: 'user', content: message },
      ];

      const resp = await fetch('https://integrations.emergentagent.com/llm/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EMERGENT_LLM_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          temperature: 0.7,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        console.error('LLM error', data);
        return err(data?.error?.message || 'فشل في الاتصال بالذكاء الاصطناعي', 500);
      }
      const reply = data.choices?.[0]?.message?.content || 'لم أستطع توليد رد';
      return ok({ reply });
    } catch (e) {
      console.error('AI error', e);
      return err('خطأ في AI: ' + e.message, 500);
    }
  }

  if (path === 'ai/insights' && method === 'GET') {
    try {
      const products = await db.collection('products').find({}).toArray().catch(() => []);
      const subs = await db.collection('subscribers').find({}).toArray().catch(() => []);
      const zones = await db.collection('zones').find({}).toArray().catch(() => []);

      const safeProducts = Array.isArray(products) ? products : [];
      const safeSubs = Array.isArray(subs) ? subs : [];
      const safeZones = Array.isArray(zones) ? zones : [];

      const insights = [];
      const lowStock = safeProducts.filter(p => (Number(p?.stock) || 0) <= (Number(p?.lowStockAlert) || 0));
      if (lowStock.length > 0) {
        insights.push({ type: 'warning', icon: '📦', title: 'منتجات على وشك النفاد', message: `يوجد ${lowStock.length} منتج بحاجة لإعادة طلب: ${lowStock.slice(0, 3).map(p => p?.name || '—').join('، ')}` });
      }
      const debt = safeSubs.filter(s => (Number(s?.debt) || 0) > 0);
      if (debt.length > 0) {
        const totalDebt = debt.reduce((s, x) => s + (Number(x?.debt) || 0), 0);
        insights.push({ type: 'info', icon: '💰', title: 'مستحقات مالية', message: `${debt.length} مشترك لديه ديون بإجمالي ${totalDebt.toLocaleString()} د.ع` });
      }
      const offlineZones = safeZones.filter(z => z?.status === 'offline');
      if (offlineZones.length > 0) {
        insights.push({ type: 'critical', icon: '🚨', title: 'زونات مفصولة', message: `${offlineZones.length} زون خارج الخدمة: ${offlineZones.map(z => z?.name || '—').join('، ')}` });
      }
      const highUtil = safeZones.filter(z => (Number(z?.utilization) || 0) > 85);
      if (highUtil.length > 0) {
        insights.push({ type: 'warning', icon: '⚡', title: 'ضغط عالي على الشبكة', message: `${highUtil.length} زون يحتاج توسعة: ${highUtil.map(z => `${z?.name || '—'} (${z?.utilization || 0}%)`).join('، ')}` });

      }
      const deadStock = safeProducts.filter(p => (Number(p?.stock) || 0) > 50);
      if (deadStock.length > 0) {
        insights.push({ type: 'info', icon: '📊', title: 'مخزون راكد', message: `${deadStock.length} منتج كميته كبيرة، فكر بعمل عرض ترويجي` });
      }
      if (insights.length === 0) {
        insights.push({ type: 'success', icon: '✨', title: 'كل شيء على ما يرام', message: 'لا توجد تنبيهات حالياً، استمر بالعمل الرائع!' });
      }
      return ok({ insights });
    } catch (e) {
      console.error('[ai/insights] error:', e?.message);
      return ok({ insights: [] });
    }
  }

  // ============ MODULAR HANDLERS (extracted to /app/lib/api-handlers/*) ============
  const ctx = { path, method, request, db, clientIp };
  for (const handler of [handleSuppliers, handleCoupons, handleCRM, handlePush, handleMobile]) {
    const r = await handler(ctx);
    if (r) return r;
  }

  return err(`Route not found: ${method} /${path}`, 404);
}

function safeHandler(method) {
  return async function (request, { params }) {
    try {
      return await handle(request, params);
    } catch (e) {
      const path = (params?.path || []).join('/');
      console.error(`[API ERROR] ${method} /${path}:`, e?.stack || e?.message || e);
      return NextResponse.json(
        { error: e?.message || 'Internal server error', path, _serverError: true },
        { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } }
      );
    }
  };
}

export const GET = safeHandler('GET');
export const POST = safeHandler('POST');
export const PUT = safeHandler('PUT');
export const DELETE = safeHandler('DELETE');
export const PATCH = safeHandler('PATCH');
