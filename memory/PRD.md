# PRD — مركز الغزلان ERP

## Original Problem Statement
> افتح برنامج https://github.com/baqerb580-bot/mnasa-sad-baqer-al-batat.git
> "افتحة هنا حتى نعدل عليه" (Open it here so we can modify it)

## Project Overview
A comprehensive Next.js 14 (App Router) full-stack ERP / ISP / POS / NOC / E-commerce / HR platform with:
- MongoDB backend
- TailwindCSS + shadcn/ui
- AI Assistant (Emergent LLM)
- WhatsApp / Telegram integrations
- Capacitor Android wrapper

## Architecture on Emergent
Because Emergent's base image is React+FastAPI but this app is Next.js (single process serving UI + API):

- **Next.js dev server** runs on port `3000` via supervisor `frontend` (`yarn start` → `next dev`)
  - Serves UI (non-/api routes) and all API routes (catch-all `app/api/[[...path]]/route.js`).
- **FastAPI proxy** runs on port `8001` via supervisor `backend` (`/app/backend/server.py`)
  - Pure passthrough: forwards `/api/*` → `http://localhost:3000/api/*`.
  - This is required because Emergent ingress routes `/api/*` externally to port 8001.
- **MongoDB** running locally on port 27017.

## Environment Variables
`/app/frontend/.env`:
- `MONGO_URL=mongodb://localhost:27017`
- `DB_NAME=ghazlan_erp`
- `NEXT_PUBLIC_BASE_URL=<external preview URL>`
- `APP_TIMEZONE=Asia/Baghdad`

## Completed (2026-05-31)
- ✅ Cloned the GitHub repository into `/app/frontend`
- ✅ Installed all yarn dependencies (Next.js 14, MongoDB driver, shadcn/ui, etc.)
- ✅ Wrote FastAPI proxy at `/app/backend/server.py` to expose Next.js API on port 8001
- ✅ Configured `.env` with MongoDB and base URL
- ✅ Verified `/api/health` returns `{status:ok, dbConnected:true}`
- ✅ Verified login works (`superadmin` / `SuperAdmin@2026`)
- ✅ UI loads correctly — Arabic RTL admin login page

## How to verify
```bash
curl $NEXT_PUBLIC_BASE_URL/api/health
# -> {"status":"ok","dbConnected":true,...}
```

## Backlog / Next Action Items
- Awaiting user's modification requests (the user said "افتحة هنا حتى نعدل عليه" — open it so we can modify).
- Optional features (per README) to enable later:
  - `EMERGENT_LLM_KEY` for AI Assistant
  - `TELEGRAM_BOT_TOKEN` for Telegram bot
  - `VAPID_*` keys for Web Push notifications
  - `WHATSAPP_SERVICE_URL` for WhatsApp microservice
- If push notifications are needed → request VAPID keys from user.
- Seed sample data via `cd /app/frontend && node scripts/seed.js` when requested.

## Tech Stack
Next.js 14 · React 18 · MongoDB · TailwindCSS · shadcn/ui · lucide-react · Recharts · React-Leaflet · bcryptjs · web-push · otpauth · qrcode · jsbarcode · html5-qrcode · capacitor
