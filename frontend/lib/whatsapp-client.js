/**
 * Server-side helper: talks to the WhatsApp microservice.
 *
 * The WhatsApp microservice (whatsapp-service/) runs separately because
 * it needs Chromium + LocalAuth session persistence (not compatible with
 * Vercel serverless).
 *
 * Configure via env:
 *   WHATSAPP_SERVICE_URL    e.g. http://localhost:3001 or https://wa.example.com
 *   WHATSAPP_SERVICE_TOKEN  bearer token
 */
const SERVICE_URL = (process.env.WHATSAPP_SERVICE_URL || '').replace(/\/+$/, '');
const SERVICE_TOKEN = process.env.WHATSAPP_SERVICE_TOKEN || '';

const isConfigured = () => !!SERVICE_URL;

async function call(path, { method = 'GET', body = null, timeoutMs = 25000 } = {}) {
  if (!SERVICE_URL) {
    return { ok: false, _failed: true, error: 'whatsapp_service_not_configured', hint: 'Set WHATSAPP_SERVICE_URL env var' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`${SERVICE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(SERVICE_TOKEN ? { Authorization: `Bearer ${SERVICE_TOKEN}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const ct = r.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await r.json().catch(() => ({})) : await r.text();
    if (!r.ok) return { ok: false, _failed: true, status: r.status, ...(typeof data === 'object' ? data : { error: String(data) }) };
    return { ok: true, ...(typeof data === 'object' ? data : { data }) };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, _failed: true, error: e?.name === 'AbortError' ? 'timeout' : (e?.message || 'network_error') };
  }
}

const waStatus = () => call('/status');
const waHealth = () => call('/health');
const waQr = () => call('/qr');
const waConnect = () => call('/connect', { method: 'POST', body: {} });
const waDisconnect = (wipe = false) => call('/disconnect', { method: 'POST', body: { wipe } });
const waSend = (phone, message) => call('/send', { method: 'POST', body: { phone, message }, timeoutMs: 30000 });
const waSendMedia = (phone, payload) => call('/send-media', { method: 'POST', body: { phone, ...payload }, timeoutMs: 60000 });
const waSendBulk = (items, delayMs = 1200) => call('/send-bulk', { method: 'POST', body: { items, delayMs }, timeoutMs: 5 * 60 * 1000 });

module.exports = {
  isConfigured,
  waStatus,
  waHealth,
  waQr,
  waConnect,
  waDisconnect,
  waSend,
  waSendMedia,
  waSendBulk,
};
