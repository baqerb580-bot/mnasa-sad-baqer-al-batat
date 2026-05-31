/**
 * Ghazlan ERP — WhatsApp Web Service
 * ────────────────────────────────────────────────────────────
 * Standalone Node.js service that wraps whatsapp-web.js and
 * exposes a REST API consumed by the Next.js main app.
 *
 * Deploy this on Render / Railway / Docker / VPS (NOT on Vercel,
 * because it requires Chromium + persistent filesystem + long-
 * running process).
 *
 * Required env vars:
 *   PORT                       (default 3001)
 *   WHATSAPP_SERVICE_TOKEN     auth token (must match Next.js side)
 *   WHATSAPP_SESSION_PATH      directory to persist auth (default ./auth)
 *   PUPPETEER_EXECUTABLE_PATH  path to chromium (auto-detected)
 *   WEBHOOK_URL                optional: callback to Next.js on events
 * ────────────────────────────────────────────────────────────
 */
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

// ===== Config =====
const PORT = parseInt(process.env.PORT || '3001', 10);
const AUTH_TOKEN = process.env.WHATSAPP_SERVICE_TOKEN || 'change-me-in-production';
const SESSION_PATH = process.env.WHATSAPP_SESSION_PATH || path.join(__dirname, 'auth');
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH
  || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome'
    : fs.existsSync('/usr/bin/chromium-browser') ? '/usr/bin/chromium-browser'
    : fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium'
    : undefined);

if (!fs.existsSync(SESSION_PATH)) fs.mkdirSync(SESSION_PATH, { recursive: true });

console.log('[WA-Service] Boot', { PORT, SESSION_PATH, CHROMIUM_PATH, hasWebhook: !!WEBHOOK_URL });

// ===== State =====
let client = null;
let state = {
  status: 'disconnected',      // disconnected | initializing | qr | authenticated | ready | auth_failure
  qr: null,                     // raw QR string
  qrDataUrl: null,              // data:image/png;base64,... for UI
  phone: null,                  // connected phone (E.164)
  displayName: null,
  lastError: null,
  lastQrAt: null,
  readyAt: null,
  initStartedAt: null,
};

// ===== Helpers =====
const setState = (patch) => { state = { ...state, ...patch }; };

const fireWebhook = async (event, data) => {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-WA-Token': AUTH_TOKEN },
      body: JSON.stringify({ event, data, ts: new Date().toISOString() }),
    });
  } catch (e) {
    console.warn('[WA] webhook failed:', e.message);
  }
};

// Normalize phone for WhatsApp (E.164 without +, Iraq prefix support)
const normalizePhone = (raw) => {
  if (!raw) return null;
  let p = String(raw).replace(/[^\d]/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('0') && p.length === 11) p = '964' + p.slice(1);     // Iraq local 07xx → 9647xx
  if (p.length === 10 && p.startsWith('7')) p = '964' + p;               // 7xx → 964 7xx
  return p;
};

const buildChatId = (phone) => `${normalizePhone(phone)}@c.us`;

// ===== Client lifecycle =====
const createClient = () => {
  const puppeteerOpts = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  };
  if (CHROMIUM_PATH) puppeteerOpts.executablePath = CHROMIUM_PATH;

  const c = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_PATH, clientId: 'ghazlan-erp' }),
    puppeteer: puppeteerOpts,
    qrMaxRetries: 5,
    takeoverOnConflict: true,
  });

  c.on('qr', async (qr) => {
    console.log('[WA] QR received');
    try {
      const qrDataUrl = await QRCode.toDataURL(qr, { errorCorrectionLevel: 'M', margin: 1, scale: 6 });
      setState({ status: 'qr', qr, qrDataUrl, lastQrAt: new Date().toISOString(), lastError: null });
      fireWebhook('qr', { hasQr: true });
    } catch (e) {
      console.warn('[WA] QR encode failed:', e.message);
      setState({ status: 'qr', qr, qrDataUrl: null, lastQrAt: new Date().toISOString() });
    }
  });

  c.on('loading_screen', (percent, msg) => {
    // Once we are ready/authenticated, ignore late loading events (would otherwise downgrade status)
    if (state.status === 'ready' || state.status === 'authenticated') return;
    console.log(`[WA] loading ${percent}% — ${msg}`);
    setState({ status: 'initializing' });
  });

  c.on('authenticated', () => {
    console.log('[WA] authenticated');
    setState({ status: 'authenticated', lastError: null });
    fireWebhook('authenticated', {});
  });

  c.on('auth_failure', (msg) => {
    console.error('[WA] auth_failure:', msg);
    setState({ status: 'auth_failure', lastError: msg });
    fireWebhook('auth_failure', { error: msg });
  });

  c.on('ready', async () => {
    const info = c.info || {};
    const phone = info?.wid?.user || null;
    const name = info?.pushname || null;
    console.log('[WA] READY as', phone, name);
    setState({
      status: 'ready',
      qr: null,
      qrDataUrl: null,
      phone,
      displayName: name,
      readyAt: new Date().toISOString(),
      lastError: null,
    });
    fireWebhook('ready', { phone, displayName: name });
  });

  c.on('disconnected', (reason) => {
    console.warn('[WA] disconnected:', reason);
    setState({ status: 'disconnected', qr: null, qrDataUrl: null, phone: null, displayName: null, lastError: String(reason || '') });
    fireWebhook('disconnected', { reason });
    client = null;
  });

  c.on('message_create', (msg) => {
    // Optionally relay inbound messages (skip self-sent)
    if (msg.fromMe) return;
    fireWebhook('message_in', {
      from: msg.from,
      body: String(msg.body || '').slice(0, 500),
      type: msg.type,
      ts: msg.timestamp,
    });
  });

  return c;
};

const startClient = async () => {
  if (client) {
    console.log('[WA] client already exists — re-using');
    return;
  }
  setState({ status: 'initializing', initStartedAt: new Date().toISOString(), lastError: null });
  try {
    client = createClient();
    client.initialize().catch((e) => {
      console.error('[WA] initialize() error:', e?.message);
      setState({ status: 'disconnected', lastError: e?.message || 'init failed' });
      client = null;
    });
  } catch (e) {
    console.error('[WA] startClient threw:', e?.message);
    setState({ status: 'disconnected', lastError: e?.message });
    client = null;
  }
};

const stopClient = async ({ wipe = false } = {}) => {
  if (!client) {
    setState({ status: 'disconnected', qr: null, qrDataUrl: null, phone: null, displayName: null });
    return { ok: true, alreadyStopped: true };
  }
  try {
    try { await client.logout(); } catch {}
    try { await client.destroy(); } catch {}
  } finally {
    client = null;
  }
  if (wipe && fs.existsSync(SESSION_PATH)) {
    try {
      fs.rmSync(SESSION_PATH, { recursive: true, force: true });
      fs.mkdirSync(SESSION_PATH, { recursive: true });
      console.log('[WA] session wiped');
    } catch (e) { console.warn('[WA] wipe failed:', e.message); }
  }
  setState({ status: 'disconnected', qr: null, qrDataUrl: null, phone: null, displayName: null });
  fireWebhook('disconnected', { manual: true, wiped: wipe });
  return { ok: true };
};

// ===== Express app =====
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('tiny'));

// Auth middleware (skip for /health)
const authGuard = (req, res, next) => {
  if (req.path === '/health') return next();
  const hdr = req.headers.authorization || '';
  const token = hdr.replace(/^Bearer\s+/i, '').trim() || req.headers['x-wa-token'] || '';
  if (!AUTH_TOKEN || AUTH_TOKEN === 'change-me-in-production') {
    // Allow when no token configured (dev)
    return next();
  }
  if (token !== AUTH_TOKEN) return res.status(401).json({ error: 'unauthorized' });
  next();
};
app.use(authGuard);

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'ghazlan-whatsapp',
    version: '1.0.0',
    status: state.status,
    chromium: CHROMIUM_PATH || 'bundled',
    sessionExists: fs.existsSync(path.join(SESSION_PATH, 'session-ghazlan-erp')),
    ts: new Date().toISOString(),
  });
});

app.get('/status', (req, res) => {
  res.json({
    status: state.status,
    phone: state.phone,
    displayName: state.displayName,
    hasQr: !!state.qrDataUrl,
    lastQrAt: state.lastQrAt,
    readyAt: state.readyAt,
    initStartedAt: state.initStartedAt,
    lastError: state.lastError,
  });
});

app.get('/qr', (req, res) => {
  if (!state.qrDataUrl) {
    return res.status(404).json({ error: 'no_qr', status: state.status, hint: 'Call /connect first or wait for QR.' });
  }
  res.json({
    qr: state.qr,
    qrDataUrl: state.qrDataUrl,
    lastQrAt: state.lastQrAt,
    status: state.status,
  });
});

app.post('/connect', async (req, res) => {
  if (state.status === 'ready') {
    return res.json({ ok: true, alreadyReady: true, phone: state.phone });
  }
  await startClient();
  res.json({ ok: true, status: state.status });
});

app.post('/disconnect', async (req, res) => {
  const wipe = !!(req.body?.wipe);
  const result = await stopClient({ wipe });
  res.json(result);
});

app.post('/send', async (req, res) => {
  const { phone, message } = req.body || {};
  if (!phone || !message) return res.status(400).json({ error: 'phone and message required' });
  if (state.status !== 'ready' || !client) return res.status(503).json({ error: 'whatsapp_not_ready', status: state.status });
  try {
    const chatId = buildChatId(phone);
    const reg = await client.isRegisteredUser(chatId).catch(() => null);
    if (reg === false) return res.status(404).json({ error: 'phone_not_registered_on_whatsapp', phone, chatId });
    const sent = await client.sendMessage(chatId, message);
    res.json({ ok: true, id: sent?.id?._serialized || null, to: chatId });
  } catch (e) {
    console.error('[WA] send error:', e?.message);
    res.status(500).json({ error: e?.message || 'send_failed' });
  }
});

app.post('/send-media', async (req, res) => {
  const { phone, mediaBase64, mimeType, filename, caption } = req.body || {};
  if (!phone || !mediaBase64) return res.status(400).json({ error: 'phone and mediaBase64 required' });
  if (state.status !== 'ready' || !client) return res.status(503).json({ error: 'whatsapp_not_ready' });
  try {
    const chatId = buildChatId(phone);
    const media = new MessageMedia(mimeType || 'application/octet-stream', mediaBase64, filename || 'file');
    const sent = await client.sendMessage(chatId, media, { caption: caption || '' });
    res.json({ ok: true, id: sent?.id?._serialized || null });
  } catch (e) {
    console.error('[WA] send-media error:', e?.message);
    res.status(500).json({ error: e?.message || 'send_failed' });
  }
});

// Bulk send — accepts [{ phone, message }, ...] with rate-limiting (delay between sends)
app.post('/send-bulk', async (req, res) => {
  const { items, delayMs = 1200 } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items[] required' });
  if (state.status !== 'ready' || !client) return res.status(503).json({ error: 'whatsapp_not_ready' });
  const results = [];
  for (const it of items) {
    try {
      const chatId = buildChatId(it.phone);
      const sent = await client.sendMessage(chatId, it.message);
      results.push({ phone: it.phone, ok: true, id: sent?.id?._serialized || null });
    } catch (e) {
      results.push({ phone: it.phone, ok: false, error: e?.message });
    }
    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
  }
  res.json({ ok: true, total: items.length, sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results });
});

// ===== Boot =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[WA-Service] listening on :${PORT}`);
  // Auto-resume session if it exists
  const sessionDir = path.join(SESSION_PATH, 'session-ghazlan-erp');
  if (fs.existsSync(sessionDir)) {
    console.log('[WA-Service] previous session found → auto-resume');
    startClient();
  } else {
    console.log('[WA-Service] no session — waiting for /connect');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => { await stopClient(); process.exit(0); });
process.on('SIGINT', async () => { await stopClient(); process.exit(0); });
