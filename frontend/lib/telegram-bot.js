// Telegram Statistics Bot - core handlers
// Permission keys (must match frontend admin UI):
//   reports, finance, subscribers, employees, maintenance, network, manage_users, view_logs

const TG_API = (token) => `https://api.telegram.org/bot${token}`;

export async function tgSend(token, chatId, text, replyMarkup) {
  return fetch(`${TG_API(token)}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', reply_markup: replyMarkup }),
  }).then(r => r.json()).catch(e => ({ ok: false, error: e.message }));
}

export async function tgEdit(token, chatId, messageId, text, replyMarkup) {
  return fetch(`${TG_API(token)}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', reply_markup: replyMarkup }),
  }).then(r => r.json()).catch(e => ({ ok: false, error: e.message }));
}

export async function tgAnswerCallback(token, callbackQueryId, text) {
  return fetch(`${TG_API(token)}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  }).then(r => r.json()).catch(() => null);
}

const fmt = (n) => Number(n || 0).toLocaleString('en-US');

export const PERMS_ALL = ['reports', 'finance', 'subscribers', 'employees', 'maintenance', 'network', 'manage_users', 'view_logs'];

export const ROLE_DEFAULT_PERMS = {
  super_admin: PERMS_ALL,
  manager: PERMS_ALL,
  accountant: ['finance', 'reports', 'subscribers'],
  hr: ['employees', 'reports'],
  agent: ['subscribers'],
  supervisor: ['reports', 'maintenance', 'network'],
  employee: ['employees'],
};

const ROLE_LABEL = {
  super_admin: '👑 سوبر أدمن', manager: '🎩 مدير', accountant: '💰 محاسب',
  hr: '👥 موارد بشرية', agent: '🤝 وكيل', supervisor: '🔧 مشرف', employee: '🧑‍💼 موظف',
};

// Build inline keyboard for home menu based on permissions
export function homeKeyboard(perms) {
  const rows = [];
  const has = (p) => perms.includes(p) || perms.includes('all');
  const buttons = [];
  if (has('reports')) buttons.push({ text: '📊 التقارير', callback_data: 'reports' });
  if (has('employees')) buttons.push({ text: '👥 الموظفين', callback_data: 'employees' });
  if (has('subscribers')) buttons.push({ text: '🌐 المشتركين', callback_data: 'subscribers' });
  if (has('finance')) buttons.push({ text: '💰 المالية', callback_data: 'finance' });
  if (has('maintenance')) buttons.push({ text: '🛠 الصيانة', callback_data: 'maintenance' });
  if (has('network')) buttons.push({ text: '📡 الشبكة', callback_data: 'network' });
  // pair into rows of 2
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  // Settings row
  const settingsRow = [{ text: '⚙️ حسابي', callback_data: 'me' }];
  if (has('manage_users')) settingsRow.push({ text: '🔐 إدارة المستخدمين', callback_data: 'admin' });
  rows.push(settingsRow);
  if (has('view_logs')) rows.push([{ text: '📜 سجل الاستخدام', callback_data: 'logs' }]);
  rows.push([{ text: '🔄 تحديث', callback_data: 'home' }]);
  return { inline_keyboard: rows };
}

export function backKeyboard(extraRows = []) {
  return { inline_keyboard: [...extraRows, [{ text: '🔙 رجوع', callback_data: 'home' }]] };
}

// Routes
export async function buildHome(db, user) {
  const stats = await db.collection('subscribers').countDocuments({});
  const empCount = await db.collection('employees').countDocuments({});
  const sales = await db.collection('sales').find({}).toArray();
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter(s => s.createdAt?.startsWith(today)).reduce((a, b) => a + (b.total || 0), 0);
  const text = [
    `<b>🏠 لوحة تحكم مركز الغزلان</b>`,
    `<i>أهلاً ${user.name}</i>`,
    `الدور: ${ROLE_LABEL[user.role] || user.role}`,
    ``,
    `<b>نظرة سريعة</b>`,
    `👥 الموظفين: ${empCount}`,
    `🌐 المشتركين: ${stats}`,
    `💰 مبيعات اليوم: ${fmt(todaySales)} د.ع`,
    ``,
    `<i>اختر قسماً للتفاصيل:</i>`,
  ].join('\n');
  return { text, kb: homeKeyboard(user.permissions || []) };
}

export async function buildReports(db, sub) {
  if (sub === 'today') {
    const today = new Date().toISOString().slice(0, 10);
    const sales = await db.collection('sales').find({ createdAt: { $regex: `^${today}` } }).toArray();
    const repairs = await db.collection('repairs').find({ createdAt: { $regex: `^${today}` } }).toArray();
    const acts = await db.collection('activations').find({ createdAt: { $regex: `^${today}` } }).toArray();
    const text = [
      `<b>📊 تقرير اليوم - ${today}</b>`, ``,
      `💵 إجمالي المبيعات: <b>${fmt(sales.reduce((a, b) => a + (b.total || 0), 0))} د.ع</b>`,
      `🧾 عدد الفواتير: <b>${sales.length}</b>`,
      `🎟️ تذاكر صيانة جديدة: <b>${repairs.length}</b>`,
      `🚀 تفعيلات اشتراك: <b>${acts.length}</b>`,
    ].join('\n');
    return { text, kb: backKeyboard([[{ text: '📊 رجوع للتقارير', callback_data: 'reports' }]]) };
  }
  if (sub === 'month') {
    const month = new Date().toISOString().slice(0, 7);
    const sales = await db.collection('sales').find({ createdAt: { $regex: `^${month}` } }).toArray();
    const repairs = await db.collection('repairs').find({ createdAt: { $regex: `^${month}` } }).toArray();
    const acts = await db.collection('activations').find({ createdAt: { $regex: `^${month}` } }).toArray();
    const text = [
      `<b>📅 تقرير الشهر - ${month}</b>`, ``,
      `💵 إجمالي المبيعات: <b>${fmt(sales.reduce((a, b) => a + (b.total || 0), 0))} د.ع</b>`,
      `🧾 عدد الفواتير: <b>${sales.length}</b>`,
      `🎟️ تذاكر صيانة: <b>${repairs.length}</b>`,
      `🚀 تفعيلات: <b>${acts.length}</b>`,
    ].join('\n');
    return { text, kb: backKeyboard([[{ text: '📊 رجوع للتقارير', callback_data: 'reports' }]]) };
  }
  if (sub === 'year') {
    const year = new Date().getFullYear();
    const sales = await db.collection('sales').find({ createdAt: { $regex: `^${year}` } }).toArray();
    const text = [
      `<b>📆 تقرير السنة - ${year}</b>`, ``,
      `💵 إجمالي المبيعات: <b>${fmt(sales.reduce((a, b) => a + (b.total || 0), 0))} د.ع</b>`,
      `🧾 عدد الفواتير: <b>${sales.length}</b>`,
    ].join('\n');
    return { text, kb: backKeyboard([[{ text: '📊 رجوع للتقارير', callback_data: 'reports' }]]) };
  }
  if (sub === 'general') {
    const subs = await db.collection('subscribers').find({}).toArray();
    const active = subs.filter(s => s.status === 'active').length;
    const expired = subs.filter(s => s.status === 'expired').length;
    const zones = await db.collection('zones').countDocuments({});
    const networks = await db.collection('networks').countDocuments({});
    const tasks = await db.collection('tasks').find({}).toArray();
    const employees = await db.collection('employees').find({}).toArray();
    const today = new Date().toISOString().slice(0, 10);
    const presentToday = await db.collection('attendance').countDocuments({ date: today, status: 'present' });
    const lateToday = await db.collection('attendance').countDocuments({ date: today, status: 'late' });
    const text = [
      `<b>📈 الإحصائيات العامة</b>`, ``,
      `🌐 المشتركين: <b>${subs.length}</b>`,
      `  ✅ نشط: ${active}`,
      `  ❌ منتهي: ${expired}`,
      `📍 الزونات: <b>${zones}</b>`,
      `🔌 الفاتات: <b>${networks}</b>`,
      ``,
      `👥 الموظفين: <b>${employees.length}</b>`,
      `  ✅ حاضر اليوم: ${presentToday}`,
      `  ⏰ متأخر: ${lateToday}`,
      ``,
      `📋 المهام: <b>${tasks.length}</b>`,
      `  ✅ مكتملة: ${tasks.filter(t => t.status === 'completed').length}`,
      `  🔵 جارية: ${tasks.filter(t => t.status === 'in_progress').length}`,
    ].join('\n');
    return { text, kb: backKeyboard([[{ text: '📊 رجوع', callback_data: 'reports' }]]) };
  }
  // Reports menu
  const text = `<b>📊 التقارير</b>\n\nاختر نوع التقرير:`;
  const kb = {
    inline_keyboard: [
      [{ text: '📅 اليوم', callback_data: 'reports:today' }, { text: '📆 الشهر', callback_data: 'reports:month' }],
      [{ text: '🗓️ السنة', callback_data: 'reports:year' }, { text: '📈 إحصائيات عامة', callback_data: 'reports:general' }],
      [{ text: '🔙 الرئيسية', callback_data: 'home' }],
    ],
  };
  return { text, kb };
}

export async function buildEmployees(db, sub) {
  if (sub === 'attendance') {
    const today = new Date().toISOString().slice(0, 10);
    const att = await db.collection('attendance').find({ date: today }).toArray();
    const present = att.filter(a => a.status === 'present');
    const late = att.filter(a => a.status === 'late');
    const lines = [`<b>🕐 حضور اليوم - ${today}</b>`, ``];
    lines.push(`✅ حاضر: <b>${present.length}</b>`);
    lines.push(`⏰ متأخر: <b>${late.length}</b>`);
    lines.push(``);
    att.slice(0, 15).forEach(a => {
      const t = new Date(a.checkIn).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      lines.push(`${a.status === 'late' ? '⏰' : '✅'} ${a.employeeName} - ${t}${a.lateMinutes ? ` (${a.lateMinutes}د)` : ''}`);
    });
    return { text: lines.join('\n'), kb: backKeyboard([[{ text: '👥 رجوع', callback_data: 'employees' }]]) };
  }
  if (sub === 'tasks') {
    const tasks = await db.collection('tasks').find({}).toArray();
    const lines = [
      `<b>📋 المهام الإجمالية</b>`, ``,
      `📊 المجموع: ${tasks.length}`,
      `🟡 بانتظار: ${tasks.filter(t => ['pending', 'new'].includes(t.status)).length}`,
      `🔵 جاري: ${tasks.filter(t => t.status === 'in_progress').length}`,
      `🟣 بانتظار مراجعة: ${tasks.filter(t => t.status === 'pending_review').length}`,
      `✅ مكتملة: ${tasks.filter(t => t.status === 'completed').length}`,
      `❌ مرفوضة: ${tasks.filter(t => t.status.startsWith('rejected')).length}`,
    ].join('\n');
    return { text: lines, kb: backKeyboard([[{ text: '👥 رجوع', callback_data: 'employees' }]]) };
  }
  if (sub === 'leaves') {
    const leaves = await db.collection('leaves').find({}).toArray();
    const advances = await db.collection('advances').find({}).toArray();
    const text = [
      `<b>📅 الإجازات والسلف</b>`, ``,
      `<b>الإجازات:</b>`,
      `  🟡 قيد المراجعة: ${leaves.filter(l => l.status === 'pending').length}`,
      `  ✅ موافق: ${leaves.filter(l => l.status === 'approved').length}`,
      `  ❌ مرفوض: ${leaves.filter(l => l.status === 'rejected').length}`,
      ``,
      `<b>السلف:</b>`,
      `  🟡 قيد المراجعة: ${advances.filter(a => a.status === 'pending').length}`,
      `  💸 قيد التسديد: ${advances.filter(a => a.status === 'approved').length}`,
      `  💰 إجمالي المسدد: ${fmt(advances.filter(a => a.status === 'paid').reduce((s, x) => s + (x.amount || 0), 0))} د.ع`,
    ].join('\n');
    return { text, kb: backKeyboard([[{ text: '👥 رجوع', callback_data: 'employees' }]]) };
  }
  if (sub === 'performance') {
    const emps = await db.collection('employees').find({}).sort({ kpi: -1 }).toArray();
    const lines = [`<b>🏆 ترتيب الأداء (KPI)</b>`, ``];
    emps.slice(0, 10).forEach((e, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🔹';
      lines.push(`${medal} ${e.name} - <b>${e.kpi || 0}%</b> (${e.tasksCompleted || 0} مهمة)`);
    });
    return { text: lines.join('\n'), kb: backKeyboard([[{ text: '👥 رجوع', callback_data: 'employees' }]]) };
  }
  // Menu
  return {
    text: `<b>👥 إدارة الموظفين</b>\n\nاختر القسم:`,
    kb: {
      inline_keyboard: [
        [{ text: '🕐 الحضور اليوم', callback_data: 'employees:attendance' }],
        [{ text: '📋 المهام', callback_data: 'employees:tasks' }],
        [{ text: '🏆 الأداء (KPI)', callback_data: 'employees:performance' }],
        [{ text: '📅 إجازات وسلف', callback_data: 'employees:leaves' }],
        [{ text: '🔙 الرئيسية', callback_data: 'home' }],
      ],
    },
  };
}

export async function buildSubscribers(db, sub) {
  if (sub === 'list') {
    const subs = await db.collection('subscribers').find({ status: 'active' }).limit(20).toArray();
    const lines = [`<b>🌐 المشتركون النشطون (أول 20)</b>`, ``];
    subs.forEach(s => lines.push(`✅ ${s.name} - ${s.zoneName || '-'} - ${s.speed || '-'}`));
    return { text: lines.join('\n'), kb: backKeyboard([[{ text: '🌐 رجوع', callback_data: 'subscribers' }]]) };
  }
  if (sub === 'expired') {
    const subs = await db.collection('subscribers').find({ status: 'expired' }).limit(20).toArray();
    const lines = [`<b>❌ المشتركون المنتهية اشتراكاتهم</b>`, `العدد: ${subs.length}`, ``];
    subs.slice(0, 15).forEach(s => lines.push(`❌ ${s.name} - ${s.dueDate || '-'}`));
    return { text: lines.join('\n'), kb: backKeyboard([[{ text: '🌐 رجوع', callback_data: 'subscribers' }]]) };
  }
  if (sub === 'zones') {
    const zones = await db.collection('zones').find({}).toArray();
    const lines = [`<b>📍 المشتركون حسب الزون</b>`, ``];
    zones.forEach(z => lines.push(`📍 ${z.name}: <b>${z.subscribers || 0}</b> مشترك`));
    return { text: lines.join('\n'), kb: backKeyboard([[{ text: '🌐 رجوع', callback_data: 'subscribers' }]]) };
  }
  if (sub === 'debts') {
    const subs = await db.collection('subscribers').find({}).toArray();
    const debt = subs.filter(s => (s.balance || 0) < 0);
    const total = Math.abs(debt.reduce((s, x) => s + (x.balance || 0), 0));
    const lines = [
      `<b>💸 الديون المستحقة</b>`, ``,
      `عدد المدينين: <b>${debt.length}</b>`,
      `إجمالي الدين: <b>${fmt(total)} د.ع</b>`, ``,
    ];
    debt.slice(0, 10).forEach(s => lines.push(`💰 ${s.name}: ${fmt(Math.abs(s.balance))} د.ع`));
    return { text: lines.join('\n'), kb: backKeyboard([[{ text: '🌐 رجوع', callback_data: 'subscribers' }]]) };
  }
  // Stats
  const all = await db.collection('subscribers').find({}).toArray();
  const active = all.filter(s => s.status === 'active').length;
  const expired = all.filter(s => s.status === 'expired').length;
  const suspended = all.filter(s => s.status === 'suspended').length;
  const text = [
    `<b>🌐 المشتركون</b>`, ``,
    `📊 إجمالي: <b>${all.length}</b>`,
    `✅ نشط: <b>${active}</b>`,
    `❌ منتهي: <b>${expired}</b>`,
    `⏸ موقوف: <b>${suspended}</b>`,
  ].join('\n');
  return {
    text,
    kb: {
      inline_keyboard: [
        [{ text: '✅ النشطين', callback_data: 'subscribers:list' }, { text: '❌ المنتهية', callback_data: 'subscribers:expired' }],
        [{ text: '📍 حسب الزون', callback_data: 'subscribers:zones' }, { text: '💸 الديون', callback_data: 'subscribers:debts' }],
        [{ text: '🔙 الرئيسية', callback_data: 'home' }],
      ],
    },
  };
}

export async function buildFinance(db, sub) {
  if (sub === 'income') {
    const month = new Date().toISOString().slice(0, 7);
    const sales = await db.collection('sales').find({ createdAt: { $regex: `^${month}` } }).toArray();
    const acts = await db.collection('activations').find({ createdAt: { $regex: `^${month}` } }).toArray();
    const repairs = await db.collection('repairs').find({ createdAt: { $regex: `^${month}` }, status: 'completed' }).toArray();
    const salesTotal = sales.reduce((s, x) => s + (x.total || 0), 0);
    const actsTotal = acts.reduce((s, x) => s + (x.amount || 0), 0);
    const repairsTotal = repairs.reduce((s, x) => s + (x.cost || 0), 0);
    const text = [
      `<b>💰 الإيرادات - ${month}</b>`, ``,
      `🧾 مبيعات: <b>${fmt(salesTotal)} د.ع</b>`,
      `🚀 تفعيلات: <b>${fmt(actsTotal)} د.ع</b>`,
      `🛠 صيانة: <b>${fmt(repairsTotal)} د.ع</b>`,
      ``,
      `<b>📈 الإجمالي: ${fmt(salesTotal + actsTotal + repairsTotal)} د.ع</b>`,
    ].join('\n');
    return { text, kb: backKeyboard([[{ text: '💰 رجوع', callback_data: 'finance' }]]) };
  }
  if (sub === 'debts') {
    const subs = await db.collection('subscribers').find({}).toArray();
    const debt = subs.filter(s => (s.balance || 0) < 0);
    const total = Math.abs(debt.reduce((s, x) => s + (x.balance || 0), 0));
    const text = `<b>💸 الديون</b>\n\nالمدينين: <b>${debt.length}</b>\nإجمالي: <b>${fmt(total)} د.ع</b>`;
    return { text, kb: backKeyboard([[{ text: '💰 رجوع', callback_data: 'finance' }]]) };
  }
  // Menu
  return {
    text: `<b>💰 المالية</b>\n\nاختر القسم:`,
    kb: {
      inline_keyboard: [
        [{ text: '💵 الإيرادات', callback_data: 'finance:income' }],
        [{ text: '💸 الديون', callback_data: 'finance:debts' }],
        [{ text: '🔙 الرئيسية', callback_data: 'home' }],
      ],
    },
  };
}

export async function buildMaintenance(db, sub) {
  const all = await db.collection('repairs').find({}).toArray();
  if (sub === 'open') {
    const open = all.filter(r => r.status !== 'completed' && r.status !== 'cancelled');
    const lines = [`<b>🛠 الأعطال المفتوحة</b>`, `العدد: <b>${open.length}</b>`, ``];
    open.slice(0, 10).forEach(r => lines.push(`🎟️ ${r.ticketNumber} - ${r.device} - ${r.customerName}`));
    return { text: lines.join('\n'), kb: backKeyboard([[{ text: '🛠 رجوع', callback_data: 'maintenance' }]]) };
  }
  if (sub === 'closed') {
    const closed = all.filter(r => r.status === 'completed');
    const total = closed.reduce((s, x) => s + (x.cost || 0), 0);
    return { text: `<b>✅ الأعطال المغلقة</b>\n\nالعدد: <b>${closed.length}</b>\nالإيرادات: <b>${fmt(total)} د.ع</b>`, kb: backKeyboard([[{ text: '🛠 رجوع', callback_data: 'maintenance' }]]) };
  }
  return {
    text: `<b>🛠 الصيانة</b>\n\n📊 المجموع: ${all.length}\n🟡 مفتوحة: ${all.filter(r => r.status !== 'completed' && r.status !== 'cancelled').length}\n✅ مكتملة: ${all.filter(r => r.status === 'completed').length}`,
    kb: {
      inline_keyboard: [
        [{ text: '🟡 المفتوحة', callback_data: 'maintenance:open' }, { text: '✅ المغلقة', callback_data: 'maintenance:closed' }],
        [{ text: '🔙 الرئيسية', callback_data: 'home' }],
      ],
    },
  };
}

export async function buildNetwork(db, sub) {
  const zones = await db.collection('zones').find({}).toArray();
  const networks = await db.collection('networks').find({}).toArray();
  if (sub === 'zones') {
    const lines = [`<b>📡 حالة الزونات</b>`, ``];
    zones.forEach(z => {
      const status = z.status === 'online' ? '🟢' : z.status === 'warning' ? '🟡' : '🔴';
      lines.push(`${status} ${z.name} - ${z.subscribers || 0} مشترك - ${z.fats || 0} فاتة`);
    });
    return { text: lines.join('\n'), kb: backKeyboard([[{ text: '📡 رجوع', callback_data: 'network' }]]) };
  }
  if (sub === 'networks') {
    const active = networks.filter(n => n.status === 'active').length;
    const inactive = networks.length - active;
    return { text: `<b>🔌 الفاتات / الشبكات</b>\n\nالمجموع: <b>${networks.length}</b>\n🟢 نشط: ${active}\n🔴 معطل: ${inactive}`, kb: backKeyboard([[{ text: '📡 رجوع', callback_data: 'network' }]]) };
  }
  return {
    text: `<b>📡 الشبكة</b>\n\nالزونات: ${zones.length}\nالفاتات: ${networks.length}`,
    kb: {
      inline_keyboard: [
        [{ text: '📍 الزونات', callback_data: 'network:zones' }, { text: '🔌 الفاتات', callback_data: 'network:networks' }],
        [{ text: '🔙 الرئيسية', callback_data: 'home' }],
      ],
    },
  };
}

export function buildMe(user) {
  const text = [
    `<b>⚙️ معلومات حسابي</b>`, ``,
    `الاسم: <b>${user.name}</b>`,
    `Telegram ID: <code>${user.telegramId}</code>`,
    `الدور: <b>${ROLE_LABEL[user.role] || user.role}</b>`,
    `الحالة: ${user.enabled ? '✅ مفعل' : '❌ معطل'}`,
    ``,
    `<b>الصلاحيات:</b>`,
    ...(user.permissions || []).map(p => `  • ${p}`),
  ].join('\n');
  return { text, kb: backKeyboard() };
}

export async function buildLogs(db) {
  const logs = await db.collection('telegram_logs').find({}).sort({ timestamp: -1 }).limit(20).toArray();
  const lines = [`<b>📜 آخر 20 نشاط</b>`, ``];
  logs.forEach(l => {
    const t = new Date(l.timestamp).toLocaleString('ar-IQ', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    lines.push(`${l.success ? '✅' : '❌'} <code>${l.telegramId}</code> · ${l.action} · ${t}`);
  });
  return { text: lines.join('\n') || 'لا توجد سجلات', kb: backKeyboard() };
}

export async function buildAdmin(db) {
  const users = await db.collection('telegram_users').find({}).toArray();
  const lines = [`<b>🔐 إدارة المستخدمين</b>`, ``, `العدد: <b>${users.length}</b>`, ``];
  users.slice(0, 10).forEach(u => {
    lines.push(`${u.enabled ? '✅' : '⛔'} <code>${u.telegramId}</code> · ${u.name} · ${ROLE_LABEL[u.role] || u.role}`);
  });
  lines.push('');
  lines.push('<i>لإضافة أو تعديل، استخدم لوحة المنصة</i>');
  return { text: lines.join('\n'), kb: backKeyboard() };
}
