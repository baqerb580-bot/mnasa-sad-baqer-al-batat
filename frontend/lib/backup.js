/**
 * 💾 Backup Library — Excel-based DB snapshots with auto-scheduling
 *
 * Features:
 * - Generates XLSX with one sheet per Mongo collection
 * - Saves to /app/backups/ with timestamp
 * - Records each backup in `backups` collection (id, filename, size, stats)
 * - Auto-scheduler: hourly/daily/weekly/monthly per settings.backup.schedule
 * - Retention: deletes backups older than settings.backup.retentionDays
 */
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const BACKUP_DIR = '/app/backups';

async function ensureBackupDir() {
  try { await fs.mkdir(BACKUP_DIR, { recursive: true }); } catch {}
}

// Convert a Mongo array to a sheet-friendly array of plain objects (flatten _id, ISO dates).
function normalizeRows(docs) {
  return (Array.isArray(docs) ? docs : []).map(d => {
    const out = {};
    for (const [k, v] of Object.entries(d)) {
      if (k === '_id') continue;
      if (v === null || v === undefined) out[k] = '';
      else if (v instanceof Date) out[k] = v.toISOString();
      else if (typeof v === 'object') out[k] = JSON.stringify(v);
      else out[k] = v;
    }
    return out;
  });
}

// Build XLSX workbook with one sheet per collection.
async function buildWorkbook(db) {
  const collections = await db.listCollections().toArray();
  const wb = XLSX.utils.book_new();
  const stats = {};
  for (const c of collections) {
    if (c.name === 'backups') continue; // don't snapshot backup history itself
    const docs = await db.collection(c.name).find({}).limit(50000).toArray();
    stats[c.name] = docs.length;
    const rows = normalizeRows(docs);
    const ws = rows.length === 0
      ? XLSX.utils.aoa_to_sheet([['(empty)']])
      : XLSX.utils.json_to_sheet(rows);
    // Sheet name max 31 chars in Excel
    const sheetName = c.name.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  // Add a SUMMARY sheet at the start
  const summaryRows = [
    ['Backup Date', new Date().toISOString()],
    ['Total Collections', Object.keys(stats).length],
    ['Total Documents', Object.values(stats).reduce((a, b) => a + b, 0)],
    [],
    ['Collection', 'Document Count'],
    ...Object.entries(stats).sort(),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  // Insert summary as the first sheet
  wb.SheetNames.unshift('SUMMARY');
  wb.Sheets['SUMMARY'] = summarySheet;
  return { wb, stats };
}

/**
 * Run a full backup: generate XLSX, save to disk, record in DB, prune old.
 * Returns the backup metadata document.
 */
export async function runBackup(db, { triggeredBy = 'manual' } = {}) {
  await ensureBackupDir();
  const { wb, stats } = await buildWorkbook(db);
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const id = uuidv4();
  const ts = new Date();
  const stamp = ts.toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${stamp}.xlsx`;
  const filepath = path.join(BACKUP_DIR, filename);
  await fs.writeFile(filepath, buffer);
  const size = buffer.length;
  const totalDocs = Object.values(stats).reduce((a, b) => a + b, 0);

  const meta = {
    id,
    filename,
    filepath,
    size,
    sizeKB: Math.round(size / 1024),
    stats,
    totalDocs,
    triggeredBy, // 'manual' | 'auto' | 'system'
    createdAt: ts.toISOString(),
  };
  await db.collection('backups').insertOne({ ...meta });
  delete meta._id;

  // Update lastBackup in settings
  await db.collection('settings').updateOne(
    { id: 'system' },
    { $set: { 'backup.lastBackup': ts.toISOString(), 'backup.lastBackupId': id } }
  );

  // Activity log
  try {
    await db.collection('activity_logs').insertOne({
      id: uuidv4(), user: triggeredBy === 'auto' ? 'system' : 'admin',
      action: triggeredBy === 'auto' ? 'auto_backup' : 'manual_backup',
      entity: 'backup', entityId: id,
      details: `نسخة احتياطية (${triggeredBy === 'auto' ? 'تلقائية' : 'يدوية'}) — ${totalDocs} مستند، ${meta.sizeKB} KB`,
      timestamp: ts.toISOString(),
    });
  } catch {}

  // Prune old backups beyond retention
  try {
    const settings = await db.collection('settings').findOne({ id: 'system' });
    const retentionDays = Number(settings?.backup?.retentionDays || 30);
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
    const old = await db.collection('backups').find({ createdAt: { $lt: cutoff } }).toArray();
    for (const o of old) {
      try { await fs.unlink(o.filepath); } catch {}
      await db.collection('backups').deleteOne({ id: o.id });
    }
  } catch (e) {
    console.warn('[backup] retention prune error:', e?.message);
  }

  return meta;
}

export async function listBackups(db, limit = 50) {
  const items = await db.collection('backups').find({}).sort({ createdAt: -1 }).limit(limit).toArray();
  return items.map(b => { delete b._id; delete b.filepath; return b; });
}

export async function getBackupFile(db, id) {
  const meta = await db.collection('backups').findOne({ id });
  if (!meta) return null;
  try {
    const buf = await fs.readFile(meta.filepath);
    return { meta, buffer: buf };
  } catch (e) {
    console.warn('[backup] read error:', e?.message);
    return null;
  }
}

export async function deleteBackup(db, id) {
  const meta = await db.collection('backups').findOne({ id });
  if (!meta) return false;
  try { await fs.unlink(meta.filepath); } catch {}
  await db.collection('backups').deleteOne({ id });
  return true;
}

// =============== AUTO SCHEDULER ===============
// Computes whether it's time for the next backup based on schedule and lastBackup.
function isDueForBackup(schedule, lastBackup, now = new Date()) {
  if (!lastBackup) return true;
  const last = new Date(lastBackup).getTime();
  const diffH = (now.getTime() - last) / 3600000;
  switch (schedule) {
    case 'hourly': return diffH >= 1;
    case 'daily': return diffH >= 24;
    case 'weekly': return diffH >= 24 * 7;
    case 'monthly': return diffH >= 24 * 30;
    default: return false;
  }
}

let _schedulerStarted = false;
let _schedulerHandle = null;

export function startScheduler(getDb) {
  if (_schedulerStarted) return;
  _schedulerStarted = true;
  const tick = async () => {
    try {
      const db = await getDb();
      if (!db) return;
      const settings = await db.collection('settings').findOne({ id: 'system' });
      const b = settings?.backup || {};
      if (!b.enabled) return;
      const schedule = b.schedule || 'daily';
      if (isDueForBackup(schedule, b.lastBackup)) {
        console.log(`[backup] auto-backup triggered (${schedule})`);
        await runBackup(db, { triggeredBy: 'auto' });
      }
    } catch (e) {
      console.warn('[backup] scheduler tick error:', e?.message);
    }
  };
  // First check after 30s, then every 5 minutes
  setTimeout(tick, 30000);
  _schedulerHandle = setInterval(tick, 5 * 60 * 1000);
  console.log('[backup] auto-scheduler started (5-min check interval)');
}

export function stopScheduler() {
  if (_schedulerHandle) clearInterval(_schedulerHandle);
  _schedulerStarted = false;
  _schedulerHandle = null;
}
