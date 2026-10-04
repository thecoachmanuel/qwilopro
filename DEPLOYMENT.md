# QwiloPro — Vercel Deployment Guide

## Architecture Overview

```
Vercel (Serverless)
├── Next.js App Router          → Frontend (React SPA via [[...slug]])
├── pages/api/v1/[...path].js   → Express backend (serverless-http bridge)
├── pages/api/pusher/trigger.js → Real-time event relay (replaces Socket.IO)
└── MongoDB Atlas               → Database (external, always-on)
```

---

## Step 1 — Set Up MongoDB Atlas

1. Go to [https://cloud.mongodb.com](https://cloud.mongodb.com) → Create a free cluster
2. Create a database user with a strong password
3. Whitelist `0.0.0.0/0` (all IPs) under **Network Access** (required for Vercel)
4. Copy the connection string:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/qwilopro?retryWrites=true&w=majority
   ```

---

## Step 2 — Set Up Pusher (Real-Time)

Socket.IO doesn't work on Vercel (no persistent WebSockets). We use Pusher Channels instead.

1. Go to [https://pusher.com](https://pusher.com) → Sign Up Free → Create App → **Channels**
2. Choose the cluster closest to your users (e.g. `ap2` for Asia, `eu` for Europe, `mt1` for US)
3. From the **App Keys** tab, copy:
   - **App ID** → `PUSHER_APP_ID`
   - **Key** → `NEXT_PUBLIC_PUSHER_KEY`
   - **Secret** → `PUSHER_SECRET`
   - **Cluster** → `NEXT_PUBLIC_PUSHER_CLUSTER`

The free tier supports **200k messages/day** — more than enough for most restaurants.

---

## Step 3 — Deploy to Vercel

### Option A: Vercel CLI (Recommended)

```bash
# Install Vercel CLI globally
npm i -g vercel

# From the project root
cd restropro-saas-fullstack
vercel

# Follow prompts:
# - Link to your Vercel account
# - Project name: qwilopro
# - Root directory: ./  (leave default)
# - Build command: npm run build (auto-detected)
```

### Option B: Vercel Dashboard (GitHub)

1. Push this project to a **private GitHub repository**
2. Go to [https://vercel.com/new](https://vercel.com/new)
3. Import your GitHub repo
4. Vercel auto-detects Next.js — click **Deploy**

---

## Step 4 — Set Environment Variables in Vercel

Go to **Project Settings → Environment Variables** and add all variables from `.env.example`:

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Strong random secret (64+ chars) |
| `JWT_EXPIRY` | `15m` |
| `JWT_EXPIRY_REFRESH` | `30d` |
| `COOKIE_EXPIRY` | `300000` |
| `COOKIE_EXPIRY_REFRESH` | `2592000000` |
| `PASSWORD_SALT` | `10` |
| `FRONTEND_DOMAIN` | Your Vercel URL (e.g. `https://qwilopro.vercel.app`) |
| `FRONTEND_DOMAIN_COOKIE` | `.vercel.app` |
| `NEXT_PUBLIC_BACKEND_URL` | `/api/v1` |
| `PUSHER_APP_ID` | From Pusher dashboard |
| `PUSHER_SECRET` | From Pusher dashboard |
| `NEXT_PUBLIC_PUSHER_KEY` | From Pusher dashboard |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | From Pusher dashboard (e.g. `mt1`) |
| `STRIPE_SECRET` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `SMTP_HOST` | SMTP provider host |
| `SMTP_PORT` | SMTP port (587 for TLS) |
| `SMTP_EMAIL` | Sender email |
| `SMTP_PASSWORD` | SMTP password / app password |
| `ENCRYPTION_KEY` | Random 32-char key |
| `CREDENTIAL_ENCRYPTION_KEY` | 64-char hex key |

> ⚠️ **IMPORTANT**: Set variables for **Production**, **Preview**, and **Development** environments.

---

## Step 5 — Configure Stripe Webhook (Production)

After deploying, update your Stripe webhook endpoint:

1. Go to Stripe Dashboard → **Webhooks** → Add endpoint
2. URL: `https://your-app.vercel.app/api/v1/auth/stripe-webhook`
3. Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
4. Copy the **Signing Secret** → Set as `STRIPE_WEBHOOK_SECRET` in Vercel

---

## Step 6 — Custom Domain (Optional)

1. Vercel Dashboard → Project → **Settings → Domains**
2. Add your domain (e.g. `app.qwilopro.com`)
3. Update DNS records as instructed by Vercel
4. Update `FRONTEND_DOMAIN` and `FRONTEND_DOMAIN_COOKIE` env vars to match

---

## Local Development (unchanged)

```bash
# Use the full-stack server.js (Express + Next.js + Socket.IO)
npm run dev

# Access at http://localhost:3000
```

---

## Architecture Notes

### Why `pages/api/v1/[...path].js`?
All Express routes (`src/backend/routes/*.js`, controllers, services, middleware) are **100% unchanged**. The `serverless-http` bridge wraps the entire Express app and runs it inside a Vercel serverless function. Zero code duplication.

### Why Pusher instead of Socket.IO?
Vercel serverless functions are **stateless and short-lived** — they can't maintain persistent WebSocket connections. Pusher provides managed WebSockets via HTTP API. The `src/utils/socket.js` shim provides an **identical API** (`socket.on`, `socket.emit`, `socket.off`) so no view files needed changes.

### File Uploads on Vercel
- Vercel's `/tmp` directory is available (500MB max per invocation)
- `express-fileupload` is configured to use `os.tmpdir()` which maps to `/tmp` on Vercel
- For **persistent file storage**, consider adding Vercel Blob or Cloudinary for uploaded images (current implementation stores files in `/public` which resets on each deploy)

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `ECONNREFUSED` on MongoDB | Add `0.0.0.0/0` to Atlas Network Access |
| API routes return 404 | Ensure `pages/api/v1/[...path].js` exists |
| Cookies not persisting | Check `FRONTEND_DOMAIN_COOKIE` matches your domain |
| Real-time not working | Verify all 4 Pusher env vars are set correctly |
| File uploads failing | Check function memory/timeout in `vercel.json` |
