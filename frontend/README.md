# 🏢 مركز الغزلان ERP

> منصة متكاملة لإدارة الأعمال: ISP / NOC / POS / E-commerce / HR / AI Assistant
> Comprehensive ERP, NOC, POS & ISP Management Platform
> Built with **Next.js 14 (App Router) + MongoDB + TailwindCSS + shadcn/ui**

---

## ✨ Key Features

- 🛒 **POS** نقطة بيع كاملة + طباعة A4 / حراري 80mm + تقارير إدارية
- 📡 **ISP Management** مشتركون / زونات / فاتات / وكلاء / NOC live
- 👥 **HR System** حضور بصمة GPS + photo + خصومات تلقائية + رواتب PDF
- 📋 **Tasks** مع GPS مشاركة موقع لحظي + ربط بمشتركين
- 💬 **WhatsApp Integration** عبر deep links + قوالب قابلة للتخصيص
- 📨 **Telegram Bot** لوحة إحصائيات وإدارة عن بُعد
- 🛍️ **E-commerce** متجر إلكتروني + سلة + طلبات
- 🤖 **AI Assistant** عبر Emergent LLM
- 🎨 **Dual Theme** داكن / فاتح (أبيض حليبي + ذهبي)
- 🔊 **Real-time** عبر SSE + إشعارات صوتية + Web Notifications
- 🛠️ **Custom Fields** محرر حقول ديناميكي لـ 8 كيانات
- 🔐 **Security** bcrypt + Activity Logs + Idle Logout

---

## 🚀 Quick Start (Local)

### المتطلبات Prerequisites

- **Node.js** 18+ (recommended 20)
- **MongoDB** 6+ (local or [MongoDB Atlas](https://cloud.mongodb.com))
- **Yarn** أو **npm**

### الخطوات Steps

```bash
# 1) Clone & install
git clone <your-repo-url> ghazlan-erp
cd ghazlan-erp
npm install            # أو yarn / pnpm

# 2) Copy env file and fill values
cp .env.example .env
nano .env              # عدّل MONGO_URL و NEXT_PUBLIC_BASE_URL

# 3) Start MongoDB locally (skip if using Atlas)
# Option A: native install   →   sudo systemctl start mongod
# Option B: docker            →   docker run -d -p 27017:27017 --name mongo mongo:7

# 4) Run dev server
npm run dev
# ✅ Open http://localhost:3000
```

### Build & Production

```bash
npm run build
npm start              # listens on 0.0.0.0:3000
```

---

## 🌐 Deployment Guides

### 1️⃣ Vercel (Easiest)

1. Push project to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) → Import repo
3. **Framework Preset:** Next.js (auto-detected)
4. **Environment Variables** — add these (in Project → Settings → Environment Variables):

   | Key | Required | Value |
   |---|---|---|
   | `MONGO_URL` | ✅ Yes | Your MongoDB Atlas URI: `mongodb+srv://USER:PASS@cluster.xxxx.mongodb.net/?retryWrites=true&w=majority` |
   | `DB_NAME` | ✅ Yes | `ghazlan_erp` |
   | `NEXT_PUBLIC_BASE_URL` | ✅ Yes | `https://your-app.vercel.app` |
   | `EMERGENT_LLM_KEY` | optional | Enables AI Assistant |
   | `TELEGRAM_BOT_TOKEN` | optional | Enables Telegram Bot |
   | `TELEGRAM_SUPER_ADMIN_ID` | optional | Numeric Telegram ID |
   | `NEXT_PUBLIC_API_URL` | leave EMPTY | Only set if you split backend onto a separate domain |

5. Click **Deploy** ✅

6. **After deploy — verify health:**
   ```
   https://your-app.vercel.app/api/health
   ```
   Should return:
   ```json
   { "status": "ok", "dbConnected": true, "dbError": null, "ts": "…" }
   ```
   If `dbConnected: false`, double-check `MONGO_URL` in Vercel env vars and that the Atlas IP allowlist includes `0.0.0.0/0` (or Vercel's egress IPs).

> **Tip:** All three "Application Error" / 500 cases (`/api/dashboard/stats`, `/api/notifications/admin`, `/api/ai/insights`) are now self-healing — even if Mongo is briefly unreachable, the endpoints return safe-shape empty data so the UI never crashes. `vercel.json` is already configured for 60s function timeout + CORS headers.

### 2️⃣ Render

1. Create a free MongoDB cluster on [MongoDB Atlas](https://cloud.mongodb.com)
2. Go to [render.com](https://render.com) → New Web Service → connect repo
3. Render detects `render.yaml` automatically. Configure env vars in dashboard
4. Or manually: **Build:** `npm install && npm run build` · **Start:** `npm start`

### 3️⃣ Railway

```bash
npm i -g @railway/cli
railway login
railway init
railway up
```
Then in Railway dashboard → Variables → add `MONGO_URL`, `NEXT_PUBLIC_BASE_URL`, etc.

### 4️⃣ Netlify

1. Connect repo on [netlify.com](https://netlify.com)
2. Netlify reads `netlify.toml` automatically
3. Add the same env vars as Vercel

### 5️⃣ VPS (Ubuntu / DigitalOcean / Hetzner)

```bash
# Install Node + Mongo
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git mongodb-org

# Clone & build
git clone <repo> /var/www/ghazlan
cd /var/www/ghazlan
npm install
npm run build

# Run with PM2 (persistent)
npm i -g pm2
pm2 start "npm start" --name ghazlan
pm2 save && pm2 startup

# Reverse proxy with Nginx
sudo apt install nginx
# Then point a server block to http://localhost:3000
```

Example Nginx config:
```nginx
server {
  listen 80;
  server_name your-domain.com;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;          # important for SSE
    proxy_cache off;              # important for SSE
    proxy_read_timeout 86400;     # important for SSE
  }
}
```

### 6️⃣ Docker (one-line deploy)

```bash
# Production stack (app + mongo) using docker-compose
cp .env.example .env
nano .env
docker compose up -d --build
# ✅ http://localhost:3000
```

To stop:
```bash
docker compose down
```

Volumes persist:
- `mongo_data` → database
- `uploads_data` → uploaded photos/files

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|:---:|---|
| `MONGO_URL` | ✅ | MongoDB connection string |
| `DB_NAME` | ✅ | Database name (default `ghazlan_erp`) |
| `NEXT_PUBLIC_BASE_URL` | ✅ | Public URL where the app is reachable |
| `CORS_ORIGINS` | ⚪ | Allowed CORS origins (default `*`) |
| `EMERGENT_LLM_KEY` | ⚪ | Enables AI Assistant module |
| `TELEGRAM_BOT_TOKEN` | ⚪ | Enables Telegram Bot |
| `TELEGRAM_SUPER_ADMIN_ID` | ⚪ | Telegram numeric user-id of super admin |
| `NODE_ENV` | ⚪ | `production` for production builds |

> ⚠️ **NEXT_PUBLIC_BASE_URL must match your real deployed domain** (with HTTPS).

---

## 🗄️ Database

The app uses **MongoDB** with auto-creating collections (no migrations needed). On the first request collections are created lazily.

### Optional: Seed sample data

```bash
node scripts/seed.js     # (if you add a seed script)
```

A starter `scripts/seed.js` example:
```js
const { MongoClient } = require('mongodb');
(async () => {
  const c = await MongoClient.connect(process.env.MONGO_URL);
  const db = c.db(process.env.DB_NAME || 'ghazlan_erp');
  await db.collection('zones').insertMany([
    { id: 'z1', name: 'الزون 1', number: 'Z-001', status: 'online', utilization: 35 },
    { id: 'z2', name: 'الزون 2', number: 'Z-002', status: 'online', utilization: 60 },
  ]);
  await db.collection('packages').insertMany([
    { id: 'p1', name: 'باقة 50 ميجا', speed: '50 Mbps', price: 35000, duration: 1 },
  ]);
  console.log('✅ Seeded');
  await c.close();
})();
```

### Indexes (recommended for production)

```js
db.subscribers.createIndex({ id: 1 }, { unique: true });
db.subscribers.createIndex({ phone: 1 });
db.sales.createIndex({ createdAt: -1 });
db.activations.createIndex({ subscriberId: 1, createdAt: -1 });
db.attendance.createIndex({ employeeId: 1, date: -1 });
db.events.createIndex({ ts: 1 });
```

---

## 📁 Project Structure

```
.
├── app/                    # Next.js App Router
│   ├── api/[[...path]]/    # All API routes (catch-all)
│   ├── page.js             # Admin dashboard (main)
│   ├── employee/page.js    # Employee portal
│   ├── store/page.js       # Public e-commerce
│   └── layout.js
├── components/
│   ├── ui/                 # shadcn primitives
│   ├── maps-barcode.js     # Leaflet + JsBarcode
│   └── custom-fields.js    # Dynamic field editor
├── lib/
│   ├── sounds.js           # Web Audio synth + notifications
│   ├── messaging.js        # WhatsApp/Telegram deep links
│   ├── useRealtime.js      # SSE hook
│   └── telegram-bot.js     # Telegram webhook logic
├── public/uploads/         # User uploaded files (persistent)
├── Dockerfile
├── docker-compose.yml
├── vercel.json | netlify.toml | render.yaml | railway.json
└── .env.example
```

---

## 🩺 Health Check

The endpoint used by deploy platforms:
```
GET /api/notifications/admin   →  200 OK
```

---

## 🐛 Troubleshooting

| Issue | Fix |
|---|---|
| 404 on refresh of `/employee` or `/store` | This is a normal Next.js page route — they should work. If 404s appear, ensure `output: 'standalone'` is enabled in `next.config.js` (already set). |
| SSE keeps reconnecting | Disable proxy buffering: `proxy_buffering off;` in Nginx, or set `X-Accel-Buffering: no` (already set in code). |
| `Mongo connection refused` | Ensure `MONGO_URL` is reachable. For Atlas, whitelist `0.0.0.0/0` IP or the deploy platform IPs. |
| Photos not persisting on Vercel | Vercel/Netlify have ephemeral filesystems. Use object storage (S3, Cloudinary) or run on Render/Railway/VPS where uploads_data volume persists. |
| Telegram bot not responding | Set webhook: `curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/api/telegram/webhook"` |

---

## 📝 NPM Scripts

```bash
npm run dev           # Dev server with hot-reload (port 3000)
npm run build         # Production build
npm start             # Run production server
```

---

## 🔒 Security Notes

- Passwords use **bcrypt** hashing (auto-upgrade on first login)
- Activity logs track every sensitive action
- Set strong `MONGO_URL` credentials in production
- Use HTTPS in production (Vercel/Render/Netlify auto, VPS with Let's Encrypt)
- The default admin login is `admin` / `admin` — **change it immediately** via Settings → Security

---

## 📄 License

Proprietary — © مركز الغزلان. All rights reserved.

---

**🎉 Production Ready · لا تحتاج تعديل أي كود بعد النشر · Same UI/UX as Emergent Preview**
