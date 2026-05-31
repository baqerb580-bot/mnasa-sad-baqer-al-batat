/**
 * ISP Subscriber Sync Engine
 * ────────────────────────────────────────────────────────────
 * Smart comparison engine for syncing subscribers between
 * external ISP management page (MyNet/Halasat/Custom) and
 * the platform's internal subscriber database.
 *
 * The diff engine matches by (username → subscriberId → phone)
 * in priority order, then computes field-level differences.
 */

// Normalize a phone number for fuzzy matching (Iraq prefix)
const normPhone = (p) => {
  if (!p) return '';
  let n = String(p).replace(/[^\d]/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith('964')) n = '0' + n.slice(3);
  if (n.length === 10 && n.startsWith('7')) n = '0' + n;
  return n;
};

const normStr = (s) => String(s || '').trim().toLowerCase();
const normDate = (d) => {
  if (!d) return '';
  try {
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
    return new Date(d).toISOString().slice(0, 10);
  } catch { return String(d || ''); }
};

/**
 * Coerce an "external" subscriber from arbitrary source shapes
 * to a normalized internal shape used by the diff engine.
 *
 * Supports common field aliases coming from MyNet, Halasat, Excel.
 */
const coerceExternal = (raw, fieldMap = {}) => {
  const pick = (...keys) => {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '') return raw[k];
    }
    return '';
  };
  return {
    // Identity
    externalId: String(pick(fieldMap.externalId, 'id', 'subscriberId', 'subscriber_id', 'customer_id', 'CustomerID', 'ID')),
    username: String(pick(fieldMap.username, 'username', 'user', 'login', 'Username', 'User')),
    name: String(pick(fieldMap.name, 'name', 'fullName', 'full_name', 'customer_name', 'Name', 'الاسم')),
    phone: String(pick(fieldMap.phone, 'phone', 'mobile', 'Phone', 'Mobile', 'tel', 'الهاتف')),
    // Subscription
    package: String(pick(fieldMap.package, 'package', 'plan', 'service', 'Package', 'الباقة')),
    speed: String(pick(fieldMap.speed, 'speed', 'bandwidth', 'Speed', 'السرعة')),
    status: String(pick(fieldMap.status, 'status', 'state', 'Status', 'الحالة')).toLowerCase(),
    startDate: pick(fieldMap.startDate, 'startDate', 'start_date', 'activationDate', 'StartDate'),
    endDate: pick(fieldMap.endDate, 'endDate', 'end_date', 'expiry', 'expiryDate', 'ExpiryDate', 'تاريخ_الانتهاء'),
    // Financial
    fee: Number(pick(fieldMap.fee, 'fee', 'price', 'amount', 'Fee', 'Price', 'المبلغ')) || 0,
    debt: Number(pick(fieldMap.debt, 'debt', 'balance', 'Debt', 'Balance', 'الدين')) || 0,
    paid: Number(pick(fieldMap.paid, 'paid', 'paidAmount', 'Paid', 'المدفوع')) || 0,
    // Agent
    agentName: String(pick(fieldMap.agentName, 'agentName', 'agent', 'dealer', 'Agent', 'الوكيل')),
    // Raw for trace
    _raw: raw,
  };
};

/**
 * Map external status strings to internal status (active/expired/suspended)
 */
const mapStatus = (s) => {
  const t = String(s || '').toLowerCase().trim();
  if (['active', 'enabled', 'running', 'فعال', 'مفعل', 'مشترك'].includes(t)) return 'active';
  if (['expired', 'منتهي', 'expire', 'inactive'].includes(t)) return 'expired';
  if (['suspended', 'disabled', 'موقوف', 'معلق', 'frozen'].includes(t)) return 'suspended';
  return t || 'unknown';
};

/**
 * Match an external subscriber to a platform subscriber.
 * Returns the matched platform subscriber or null.
 */
const matchOne = (ext, platformIndex) => {
  // Priority: username (case-insensitive) → externalId → phone (normalized)
  if (ext.username) {
    const u = normStr(ext.username);
    const m = platformIndex.byUsername.get(u);
    if (m) return { sub: m, matchedBy: 'username' };
  }
  if (ext.externalId) {
    const m = platformIndex.byExternalId.get(String(ext.externalId));
    if (m) return { sub: m, matchedBy: 'externalId' };
  }
  if (ext.phone) {
    const p = normPhone(ext.phone);
    if (p) {
      const m = platformIndex.byPhone.get(p);
      if (m) return { sub: m, matchedBy: 'phone' };
    }
  }
  return null;
};

/**
 * Compute field-level diff between external & platform subscriber.
 * Returns { changes: [{field, external, platform, severity}], severity }
 */
const computeDiff = (ext, sub) => {
  const changes = [];
  const push = (field, label, e, p, severity = 'warning') => {
    const eN = (typeof e === 'number') ? e : String(e || '').trim();
    const pN = (typeof p === 'number') ? p : String(p || '').trim();
    if (String(eN) !== String(pN)) {
      changes.push({ field, label, external: e, platform: p, severity });
    }
  };

  push('name', 'الاسم', ext.name, sub.name, 'warning');
  push('phone', 'الهاتف', normPhone(ext.phone), normPhone(sub.phone), 'warning');
  push('username', 'اليوزر', ext.username, sub.username, 'critical');
  push('package', 'الباقة', ext.package, sub.package, 'warning');
  push('speed', 'السرعة', ext.speed, sub.speed, 'info');
  push('endDate', 'تاريخ الانتهاء', normDate(ext.endDate), normDate(sub.endDate), 'critical');
  push('agentName', 'اسم الوكيل', ext.agentName, sub.agentName, 'info');
  push('fee', 'المبلغ', Number(ext.fee || 0), Number(sub.fee || 0), 'warning');
  push('debt', 'الدين', Number(ext.debt || 0), Number(sub.debt || 0), 'critical');

  // Status divergence — most serious
  const eStatus = mapStatus(ext.status);
  const pStatus = mapStatus(sub.status);
  if (eStatus !== pStatus && eStatus !== 'unknown') {
    changes.push({ field: 'status', label: 'الحالة', external: eStatus, platform: pStatus, severity: 'critical' });
  }

  const severity = changes.some(c => c.severity === 'critical') ? 'critical'
    : changes.some(c => c.severity === 'warning') ? 'warning'
    : changes.length > 0 ? 'info' : 'ok';
  return { changes, severity };
};

/**
 * Run a full comparison between external subscribers and platform subscribers.
 *
 * @param {Array} externalSubs - raw external subscribers
 * @param {Array} platformSubs - platform DB subscribers
 * @param {Object} options    - { fieldMap?, source? }
 * @returns {Object} diff report
 */
function runSync(externalSubs, platformSubs, options = {}) {
  const { fieldMap = {}, source = 'unknown' } = options;

  // Build platform indices
  const byUsername = new Map();
  const byPhone = new Map();
  const byExternalId = new Map();
  const byId = new Map();
  for (const s of platformSubs) {
    if (s.username) byUsername.set(normStr(s.username), s);
    if (s.phone) {
      const p = normPhone(s.phone);
      if (p) byPhone.set(p, s);
    }
    if (s.externalId) byExternalId.set(String(s.externalId), s);
    if (s.id) byId.set(s.id, s);
  }
  const platformIndex = { byUsername, byPhone, byExternalId, byId };

  // Normalize external rows
  const externals = (externalSubs || []).map(r => coerceExternal(r, fieldMap));

  // Track which platform subs we've matched (to find missing-in-ISP at the end)
  const matchedPlatformIds = new Set();
  const rows = [];

  for (const ext of externals) {
    const match = matchOne(ext, platformIndex);
    if (!match) {
      // New in ISP, missing in platform
      rows.push({
        rowId: ext.externalId || ext.username || ext.phone || Math.random().toString(36).slice(2, 10),
        status: 'new',
        severity: 'info',
        matchedBy: null,
        suggestedAction: 'create',
        external: ext,
        platform: null,
        changes: [],
      });
      continue;
    }
    matchedPlatformIds.add(match.sub.id);
    const { changes, severity } = computeDiff(ext, match.sub);
    let status, action;
    if (changes.length === 0) {
      status = 'synced'; action = 'ignore';
    } else if (severity === 'critical') {
      status = 'conflict'; action = 'review';
    } else {
      status = 'needs_update'; action = 'update';
    }
    rows.push({
      rowId: match.sub.id,
      status, severity,
      matchedBy: match.matchedBy,
      suggestedAction: action,
      external: ext,
      platform: match.sub,
      changes,
    });
  }

  // Find platform subs that are NOT in the external system
  for (const s of platformSubs) {
    if (matchedPlatformIds.has(s.id)) continue;
    rows.push({
      rowId: s.id,
      status: 'missing_in_isp',
      severity: 'warning',
      matchedBy: null,
      suggestedAction: 'ignore',
      external: null,
      platform: s,
      changes: [],
    });
  }

  const counts = {
    total: rows.length,
    synced: rows.filter(r => r.status === 'synced').length,
    new: rows.filter(r => r.status === 'new').length,
    needs_update: rows.filter(r => r.status === 'needs_update').length,
    conflict: rows.filter(r => r.status === 'conflict').length,
    missing_in_isp: rows.filter(r => r.status === 'missing_in_isp').length,
    externals: externals.length,
    platforms: platformSubs.length,
  };

  return {
    runId: Math.random().toString(36).slice(2, 12),
    source,
    ranAt: new Date().toISOString(),
    counts,
    rows,
  };
}

module.exports = {
  runSync,
  coerceExternal,
  computeDiff,
  normPhone,
  normDate,
  mapStatus,
};
