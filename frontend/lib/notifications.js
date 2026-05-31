/**
 * Smart Notification Helper
 * ──────────────────────────
 * Creates structured notifications with action metadata so the UI
 * can route the user to the exact entity when clicked, and track
 * whether the notification has been "processed/resolved".
 *
 * Each notification carries:
 *   - actionUrl:    deep-link the UI will navigate to (eg. 'tasks?id=xxx')
 *   - entityType:   'task' | 'subscriber' | 'order' | 'repair' | 'activation' | 'agent' | 'employee' | 'whatsapp' | 'generic'
 *   - entityId:     id of the related entity (for routing + resolve)
 *   - resolved:     boolean — has the user/manager processed it?
 *   - resolvedAt / resolvedBy
 *
 * Backwards compatible — existing fields (userId, type, title, message, read,
 * createdAt, taskId) are preserved.
 */
const { v4: uuidv4 } = require('uuid');

const ENTITY_ROUTES = {
  task: (id) => `tasks?id=${id}`,
  subscriber: (id) => `subscribers?id=${id}`,
  order: (id) => `ecommerce?id=${id}`,
  repair: (id) => `repairs?id=${id}`,
  activation: (id) => `subscribers?activationId=${id}`,
  agent: (id) => `agents?id=${id}`,
  employee: (id) => `employees?id=${id}`,
  whatsapp: () => `whatsapp-manager`,
  location_request: (id) => `tasks?locationRequestId=${id}`,
  generic: () => '',
};

function buildActionUrl(entityType, entityId) {
  const fn = ENTITY_ROUTES[entityType];
  if (typeof fn === 'function') return fn(entityId);
  return '';
}

/**
 * Create a smart notification + persist + emit SSE event.
 *
 * @param {Db} db
 * @param {Object} opts
 *   - userId (optional — if missing, becomes a broadcast notification for managers)
 *   - type           string (eg 'task_new', 'subscriber_expiry', 'whatsapp_sent')
 *   - title          string
 *   - message        string
 *   - entityType     string (key in ENTITY_ROUTES)
 *   - entityId       string
 *   - actionUrl      (optional override)
 *   - priority       'low'|'normal'|'high'|'critical'
 *   - icon           emoji
 *   - extra          any extra metadata to persist
 */
async function createNotification(db, opts = {}) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const {
    userId = null,
    type = 'generic',
    title = '',
    message = '',
    entityType = 'generic',
    entityId = null,
    actionUrl,
    priority = 'normal',
    icon = '🔔',
    extra = {},
  } = opts;
  const finalActionUrl = actionUrl ?? (entityType && entityId ? buildActionUrl(entityType, entityId) : '');
  const doc = {
    id,
    userId: userId || null,                 // null => broadcast to all managers
    type,
    title,
    message,
    icon,
    priority,
    entityType,
    entityId,
    actionUrl: finalActionUrl,
    read: false,
    resolved: false,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: now,
    // legacy fields for backward compat (some old UI bits look at taskId, subscriberId, etc.)
    taskId: entityType === 'task' ? entityId : (extra.taskId || null),
    subscriberId: entityType === 'subscriber' ? entityId : (extra.subscriberId || null),
    ...extra,
  };
  await db.collection('notifications').insertOne({ ...doc });
  try {
    await db.collection('events').insertOne({
      id: uuidv4(),
      type: `notification_${type}`,
      notificationId: id,
      userId,
      entityType,
      entityId,
      title,
      ts: now,
    });
  } catch {}
  return doc;
}

module.exports = { createNotification, buildActionUrl, ENTITY_ROUTES };
