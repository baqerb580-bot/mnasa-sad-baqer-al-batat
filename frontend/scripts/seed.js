/**
 * 🌱 Seed Script for مركز الغزلان ERP
 *
 * Usage:
 *   1) Make sure .env has MONGO_URL and DB_NAME set
 *   2) Run: node scripts/seed.js
 *
 * Creates demo data:
 *   - 3 zones, 3 packages, 2 agents, 2 employees, 5 subscribers, 4 products
 *
 * Safe to run multiple times — uses upsert by id.
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');
const { randomUUID } = require('crypto');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'ghazlan_erp';

const upsert = async (col, docs) => {
  for (const d of docs) {
    await col.updateOne({ id: d.id }, { $setOnInsert: d }, { upsert: true });
  }
};

(async () => {
  console.log(`🔌 Connecting to ${MONGO_URL} / ${DB_NAME}`);
  const client = await MongoClient.connect(MONGO_URL);
  const db = client.db(DB_NAME);

  // Zones
  await upsert(db.collection('zones'), [
    { id: 'z-001', name: 'الزون 1 - الكرادة', number: 'Z-001', status: 'online', utilization: 45, capacity: 100, currentLoad: 45, createdAt: new Date().toISOString() },
    { id: 'z-002', name: 'الزون 2 - الجادرية', number: 'Z-002', status: 'online', utilization: 60, capacity: 100, currentLoad: 60, createdAt: new Date().toISOString() },
    { id: 'z-003', name: 'الزون 3 - المنصور', number: 'Z-003', status: 'warning', utilization: 85, capacity: 100, currentLoad: 85, createdAt: new Date().toISOString() },
  ]);

  // Packages
  await upsert(db.collection('packages'), [
    { id: 'pkg-50', name: 'باقة 50 ميجا', speed: '50 Mbps', price: 35000, duration: 1 },
    { id: 'pkg-100', name: 'باقة 100 ميجا', speed: '100 Mbps', price: 50000, duration: 1 },
    { id: 'pkg-200', name: 'باقة 200 ميجا', speed: '200 Mbps', price: 75000, duration: 1 },
  ]);

  // Agents
  await upsert(db.collection('agents'), [
    { id: 'agent-1', name: 'وكيل 1', phone: '07901111111', commission: 10, status: 'active', username: 'agent1', password: '1234' },
    { id: 'agent-2', name: 'وكيل 2', phone: '07902222222', commission: 12, status: 'active', username: 'agent2', password: '1234' },
  ]);

  // Employees (with bcrypt-able plaintext passwords - will auto-upgrade on first login)
  await upsert(db.collection('employees'), [
    { id: 'emp-1', name: 'أحمد المدير', username: 'ahmed', password: 'ahmed', role: 'manager', phone: '07901234567', baseSalary: 800000, photo: '👨‍💼', status: 'active', permissions: { all: true }, createdAt: new Date().toISOString() },
    { id: 'emp-2', name: 'فاطمة الكاشير', username: 'fatima', password: 'fatima', role: 'cashier', phone: '07902345678', baseSalary: 500000, photo: '👩‍💻', status: 'active', permissions: { pos: true, products: true }, createdAt: new Date().toISOString() },
  ]);

  // Subscribers
  await upsert(db.collection('subscribers'), [
    { id: 'sub-1', name: 'علي محمد', username: 'ali_50', phone: '07903001001', package: '50 Mbps', fee: 35000, zoneId: 'z-001', zoneNumber: 'Z-001', zoneName: 'الزون 1', ipAddress: '10.0.1.5', status: 'active', debt: 0, dueDate: '2026-12-31', userLat: 33.31, userLng: 44.40 },
    { id: 'sub-2', name: 'سارة أحمد', username: 'sara_100', phone: '07903002002', package: '100 Mbps', fee: 50000, zoneId: 'z-002', zoneNumber: 'Z-002', zoneName: 'الزون 2', ipAddress: '10.0.2.7', status: 'active', debt: 25000, dueDate: '2026-11-30', userLat: 33.32, userLng: 44.41 },
    { id: 'sub-3', name: 'محمد كاظم', username: 'mohamed_200', phone: '07903003003', package: '200 Mbps', fee: 75000, zoneId: 'z-003', zoneNumber: 'Z-003', zoneName: 'الزون 3', ipAddress: '10.0.3.12', status: 'suspended', debt: 0, dueDate: '2026-10-15', userLat: 33.33, userLng: 44.42 },
  ]);

  // Products
  await upsert(db.collection('products'), [
    { id: 'prd-1', name: 'راوتر TP-Link AX1500', sku: 'RTR-001', barcode: '8901234567890', price: 75000, cost: 55000, stock: 25, category: 'راوترات', image: '📡', description: 'راوتر WiFi 6 سرعة 1500 Mbps' },
    { id: 'prd-2', name: 'كيبل Ethernet 10m Cat6', sku: 'CBL-001', barcode: '8901234567891', price: 8000, cost: 5000, stock: 100, category: 'كابلات', image: '🔌', description: 'كيبل شبكة عالي الجودة' },
    { id: 'prd-3', name: 'مفتاح Switch 8 منفذ', sku: 'SWT-001', barcode: '8901234567892', price: 35000, cost: 25000, stock: 15, category: 'أجهزة', image: '🔀', description: 'سويتش 8 منافذ Gigabit' },
    { id: 'prd-4', name: 'iPhone 15 Pro Max', sku: 'PHN-IP15PM', barcode: '8901234567893', price: 1850000, cost: 1500000, stock: 5, category: 'أجهزة', image: '📱', description: 'iPhone 15 Pro Max 256GB' },
  ]);

  // Networks (FATs)
  await upsert(db.collection('networks'), [
    { id: 'net-1', name: 'فاتة الكرادة 1', number: 'F-01', zoneId: 'z-001', zoneName: 'الزون 1', capacity: 32, currentSubscribers: 12, utilization: 37 },
    { id: 'net-2', name: 'فاتة الجادرية 2', number: 'F-02', zoneId: 'z-002', zoneName: 'الزون 2', capacity: 32, currentSubscribers: 24, utilization: 75 },
  ]);

  // Settings - default
  await db.collection('settings').updateOne({},
    {
      $setOnInsert: {
        general: { companyName: 'مركز الغزلان', currency: 'د.ع', timezone: 'Asia/Baghdad', branches: ['الفرع الرئيسي'] },
        security: { sessionTimeoutMinutes: 60, passwordMinLength: 6, maxLoginAttempts: 5 },
        createdAt: new Date().toISOString(),
      }
    },
    { upsert: true }
  );

  console.log('✅ Seed completed!');
  console.log('');
  console.log('🔑 Demo logins:');
  console.log('   Admin:    admin / admin     (Settings → Security to change)');
  console.log('   Employee: ahmed / ahmed     (manager role)');
  console.log('   Employee: fatima / fatima   (cashier role)');
  console.log('');
  await client.close();
  process.exit(0);
})().catch(e => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
