// Web Audio sound generator - no external mp3 files needed
// Each function produces a synthesized tone using the WebAudio API

let _ctx = null;
function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

function readSettings() {
  if (typeof window === 'undefined') return { enabled: true, volume: 0.5 };
  try {
    const raw = localStorage.getItem('sound_settings');
    if (!raw) return { enabled: true, volume: 0.5 };
    return { enabled: true, volume: 0.5, ...JSON.parse(raw) };
  } catch { return { enabled: true, volume: 0.5 }; }
}

function writeSettings(s) {
  try { localStorage.setItem('sound_settings', JSON.stringify(s)); } catch {}
}

export function getSoundSettings() { return readSettings(); }
export function setSoundSettings(patch) {
  const cur = readSettings();
  const next = { ...cur, ...patch };
  writeSettings(next);
  return next;
}

function tone(freq, duration = 200, type = 'sine', volMul = 1) {
  const s = readSettings();
  if (!s.enabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const vol = Math.max(0, Math.min(1, (s.volume ?? 0.5) * volMul));
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration / 1000);
}

// Public sound presets
export const sounds = {
  notification: () => { tone(880, 100, 'sine'); setTimeout(() => tone(1320, 120, 'sine'), 110); },
  newTask: () => { tone(660, 120, 'triangle'); setTimeout(() => tone(880, 120, 'triangle'), 120); setTimeout(() => tone(1100, 160, 'triangle'), 240); },
  late: () => { tone(440, 200, 'square', 0.7); setTimeout(() => tone(370, 250, 'square', 0.7), 220); },
  checkin: () => { tone(523, 80); setTimeout(() => tone(659, 80), 90); setTimeout(() => tone(784, 120), 180); },
  checkout: () => { tone(784, 80); setTimeout(() => tone(659, 80), 90); setTimeout(() => tone(523, 120), 180); },
  activation: () => { tone(523, 90); setTimeout(() => tone(659, 90), 100); setTimeout(() => tone(784, 90), 200); setTimeout(() => tone(1047, 180), 300); },
  debt: () => { tone(330, 200, 'square', 0.7); setTimeout(() => tone(330, 200, 'square', 0.7), 250); },
  expiry: () => { tone(440, 150, 'sawtooth', 0.6); setTimeout(() => tone(370, 150, 'sawtooth', 0.6), 170); setTimeout(() => tone(330, 250, 'sawtooth', 0.6), 340); },
  success: () => { tone(659, 80); setTimeout(() => tone(880, 80), 90); setTimeout(() => tone(1320, 180), 180); },
  error: () => { tone(220, 200, 'square', 0.7); setTimeout(() => tone(196, 300, 'square', 0.7), 220); },
  click: () => tone(1200, 30, 'sine', 0.3),
  message: () => { tone(988, 100); setTimeout(() => tone(1319, 130), 110); },
};

// Trigger browser notification API (with permission)
export async function browserNotify(title, options = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  const s = readSettings();
  if (!s.enabled && !options.silent) return;
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch {}
  }
  if (Notification.permission === 'granted') {
    try {
      const n = new Notification(title, { icon: '/favicon.ico', badge: '/favicon.ico', ...options });
      setTimeout(() => n.close(), 5000);
    } catch {}
  }
}

export function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return Promise.resolve('unsupported');
  return Notification.requestPermission();
}
