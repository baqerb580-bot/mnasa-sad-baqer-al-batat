# Ghazlan ERP — WhatsApp Web Microservice

Standalone Node.js service that wraps [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) and exposes a clean REST API consumed by the main Ghazlan ERP Next.js app.

## ⚠️ Why a separate service?

The main app (Next.js) can deploy anywhere (including Vercel serverless). But `whatsapp-web.js` requires:
- **Chromium browser** (~300 MB) — Puppeteer dependency
- **Persistent filesystem** to save the WhatsApp Web session (`LocalAuth`)
- **Long-running process** to keep the session alive
- **WebSocket connection** to WhatsApp servers

None of which are compatible with Vercel-style serverless. So this microservice runs **separately** — on Render / Railway / Docker / a VPS / your home server.

## 🚀 Quick start (local)

```bash
cd whatsapp-service
yarn install         # or: npm install
node index.js        # starts on :3001
```

Then call:
```bash
curl -X POST http://localhost:3001/connect -H "Authorization: Bearer YOUR_TOKEN"
curl http://localhost:3001/status        -H "Authorization: Bearer YOUR_TOKEN"
curl http://localhost:3001/qr            -H "Authorization: Bearer YOUR_TOKEN"
```

The QR endpoint returns `qrDataUrl` (data:image/png;base64,…) — scan it with WhatsApp on your phone (Settings → Linked Devices → Link a Device).

## 🔧 Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | – | `3001` | HTTP port |
| `WHATSAPP_SERVICE_TOKEN` | **Yes** | (none) | Bearer token shared with the Next.js app |
| `WHATSAPP_SESSION_PATH` | – | `./auth` | Where to persist the LocalAuth session |
| `PUPPETEER_EXECUTABLE_PATH` | – | auto-detect | Path to Chromium/Chrome (auto-detected on most systems) |
| `WEBHOOK_URL` | – | (none) | Optional callback URL — service will POST events here |

## 📡 API

All endpoints (except `/health`) require header `Authorization: Bearer <WHATSAPP_SERVICE_TOKEN>`.

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Service health (no auth) |
| `/status` | GET | Current connection state + phone |
| `/qr` | GET | Latest QR code as data URL |
| `/connect` | POST | Start session (or re-init) |
| `/disconnect` | POST `{ wipe?: bool }` | Logout (and optionally delete session) |
| `/send` | POST `{ phone, message }` | Send a single text message |
| `/send-media` | POST `{ phone, mediaBase64, mimeType, filename, caption }` | Send file/image |
| `/send-bulk` | POST `{ items: [{phone, message}], delayMs }` | Bulk send with rate limit |

## 🐳 Deploy on Docker / Render / Railway / VPS

### Docker
```yaml
# docker-compose.yml
services:
  whatsapp:
    image: node:20-bullseye
    working_dir: /app
    volumes:
      - ./whatsapp-service:/app
      - wa-session:/app/auth
    environment:
      PORT: 3001
      WHATSAPP_SERVICE_TOKEN: ghazlan-wa-token-2025
      WEBHOOK_URL: http://erp:3000/api/whatsapp/webhook
    command: bash -lc "apt-get update && apt-get install -y chromium && yarn install && node index.js"
    ports: ["3001:3001"]
volumes:
  wa-session:
```

### Render
1. Create a new **Web Service**
2. Root Directory: `whatsapp-service`
3. Build: `yarn install`
4. Start: `node index.js`
5. Add a **persistent disk** mounted at `/opt/render/project/src/whatsapp-service/auth` (1 GB is plenty)
6. Add env vars from the table above

### Railway
1. New Project → Deploy from repo → root `whatsapp-service`
2. Add a **volume** at `/app/auth`
3. Add env vars

### VPS (systemd)
```ini
# /etc/systemd/system/ghazlan-wa.service
[Unit]
Description=Ghazlan WhatsApp Service
After=network.target

[Service]
WorkingDirectory=/opt/ghazlan/whatsapp-service
ExecStart=/usr/bin/node index.js
Environment=PORT=3001
Environment=WHATSAPP_SERVICE_TOKEN=YOUR_SECRET
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

## 🔗 Connecting from the main app (Next.js)

In your main `.env`:
```env
WHATSAPP_SERVICE_URL=http://localhost:3001
WHATSAPP_SERVICE_TOKEN=ghazlan-wa-token-2025
```

For Vercel-hosted main app + Render-hosted WhatsApp service:
```env
WHATSAPP_SERVICE_URL=https://your-wa.onrender.com
WHATSAPP_SERVICE_TOKEN=ghazlan-wa-token-2025
```

## 🛡️ Security notes

- **Always set a strong `WHATSAPP_SERVICE_TOKEN`** in production — without it anyone can use your WhatsApp number to send messages.
- **Restrict the service URL** behind HTTPS + a firewall rule that only allows the main app's IPs to reach `:3001`.
- The session under `./auth` contains login state — **never commit it to git** and **never share** it.
- Respect WhatsApp's TOS — bulk-sending to non-consenting users can get your number banned.

## ⚠️ Known limitations

- WhatsApp Web does not officially support sending to non-WhatsApp users — the service will return `phone_not_registered_on_whatsapp` for such numbers.
- If you log out from your phone, the session ends — you must scan QR again.
- WhatsApp may detect automation and require periodic re-authentication.
