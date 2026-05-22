// Shared Telegram bot roles & permissions (used by admin UI + page.js)
export const TG_PERMS = [
  { id: 'reports',       label: '📊 التقارير',         desc: 'مشاهدة تقارير المبيعات والأرباح' },
  { id: 'finance',       label: '💰 المالية',           desc: 'الإيرادات/الديون/المصروفات' },
  { id: 'subscribers',   label: '🌐 المشتركين',         desc: 'بيانات المشتركين والديون' },
  { id: 'employees',     label: '👥 الموظفين',          desc: 'الحضور والأداء والمهام' },
  { id: 'maintenance',   label: '🛠 الصيانة',          desc: 'تذاكر الصيانة' },
  { id: 'network',       label: '📡 الشبكة',           desc: 'حالة الزونات والفاتات' },
  { id: 'manage_users',  label: '🔐 إدارة المستخدمين', desc: 'إضافة/حذف IDs' },
  { id: 'view_logs',     label: '📜 السجلات',          desc: 'سجل استخدام البوت' },
];

export const TG_ROLES = [
  { id: 'super_admin', label: '👑 سوبر أدمن',     defaults: TG_PERMS.map(p => p.id) },
  { id: 'manager',     label: '🎩 مدير',          defaults: TG_PERMS.map(p => p.id) },
  { id: 'accountant',  label: '💰 محاسب',         defaults: ['finance', 'reports', 'subscribers'] },
  { id: 'hr',          label: '👥 موارد بشرية',  defaults: ['employees', 'reports'] },
  { id: 'agent',       label: '🤝 وكيل',          defaults: ['subscribers'] },
  { id: 'supervisor',  label: '🔧 مشرف',          defaults: ['reports', 'maintenance', 'network'] },
  { id: 'employee',    label: '🧑‍💼 موظف',         defaults: ['employees'] },
];
