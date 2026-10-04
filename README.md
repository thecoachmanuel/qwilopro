# QwiloPro — SaaS POS Software

> A full-stack multi-tenant SaaS Point-of-Sale platform for restaurants, cafés, hotels, and food trucks.  
> Built with **Next.js 14**, **Express**, **MongoDB**, **Paystack** (primary), and **Stripe** (optional).

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, React 18, Tailwind CSS, DaisyUI |
| **Backend** | Express.js (custom server), Node.js |
| **Database** | MongoDB (Mongoose) |
| **Real-Time** | Pusher (production), Socket.IO (local dev) |
| **Payments** | Paystack (primary · NGN), Stripe (optional) |
| **Auth** | JWT (access + refresh tokens), bcrypt |
| **Email** | Nodemailer / SMTP |
| **Deployment** | Vercel (serverless) |
| **i18n** | i18next (multi-language support) |

---

## 📦 Features

- 🏢 **Multi-tenant SaaS** — each restaurant gets its own isolated workspace
- 💳 **Paystack payments** — NGN (Nigerian Naira) as primary currency
- 🌍 **Multi-currency** — Stripe support for global currencies (USD, EUR, GBP, etc.)
- 📊 **Subscription plans** — monthly & yearly billing, trial periods, discounts
- 🧾 **POS & Order management** — tables, kitchen display, QR menus
- 📈 **Reports & Analytics** — revenue, orders, and tenant-level insights
- 🔔 **Real-time notifications** — via Pusher channels
- 🌙 **Dark / Light mode** — full theme support
- 🌐 **i18n ready** — multiple language translations

---

## 🛠️ Local Development

### Prerequisites
- Node.js 18+
- MongoDB running locally (`mongod`) or a MongoDB Atlas URI
- A [Paystack](https://paystack.com) test account (free)

### 1. Clone & Install

```bash
git clone https://github.com/thecoachmanuel/qwilopro.git
cd qwilopro
npm install
```

### 2. Set up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials (see [Environment Variables](#-environment-variables) below).

### 3. Run Development Server

```bash
npm run dev
```

App runs at **http://localhost:3000**

---

## 🌐 Deploy to Vercel

### One-click deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/thecoachmanuel/qwilopro)

### Manual deploy

```bash
npm i -g vercel
vercel --prod
```

> **Important:** Set all environment variables in your [Vercel project settings](https://vercel.com/docs/environment-variables) — **never** commit your `.env` file.

### Required Vercel settings

| Setting | Value |
|---------|-------|
| Framework Preset | **Next.js** |
| Build Command | `npm run vercel-build` |
| Output Directory | `.next` |
| Install Command | `npm install` |

---

## 🔑 Environment Variables

Copy `.env.example` → `.env` and fill in the values:

### Server
```env
PORT=3000
NODE_ENV=production
```

### MongoDB
```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/qwilopro?retryWrites=true&w=majority
```

### JWT & Session
```env
JWT_SECRET=<64-char random string>
JWT_EXPIRY=15m
JWT_EXPIRY_REFRESH=30d
COOKIE_EXPIRY=300000
COOKIE_EXPIRY_REFRESH=2592000000
PASSWORD_SALT=10
```

### Domain
```env
FRONTEND_DOMAIN=https://your-app.vercel.app
FRONTEND_DOMAIN_COOKIE=.vercel.app
```

### Next.js Public
```env
NEXT_PUBLIC_BACKEND_URL=/api/v1
NEXT_PUBLIC_SOCKET_IO=            # leave empty on Vercel
```

### Pusher (Real-Time)
```env
PUSHER_APP_ID=your_app_id
PUSHER_SECRET=your_secret
NEXT_PUBLIC_PUSHER_KEY=your_key
NEXT_PUBLIC_PUSHER_CLUSTER=mt1
```

### Paystack (**PRIMARY** — Required)
```env
PAYSTACK_SECRET_KEY=sk_live_XXXX
PAYSTACK_PUBLIC_KEY=pk_live_XXXX
```
> Webhook URL → `https://your-app.vercel.app/api/v1/auth/paystack-webhook`

### Stripe (Optional)
```env
STRIPE_SECRET=sk_live_XXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXX
STRIPE_PORTAL_CONFIG_ID=bpc_XXXX
```
> Webhook URL → `https://your-app.vercel.app/api/v1/auth/stripe-webhook`

### Email / SMTP
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=your@email.com
SMTP_PASSWORD=your_app_password
```

### Encryption
```env
ENCRYPTION_KEY=<32-char random>          # openssl rand -hex 16
CREDENTIAL_ENCRYPTION_KEY=<64-char hex>  # openssl rand -hex 32
```

---

## 📁 Project Structure

```
qwilopro/
├── src/
│   ├── app/                  # Next.js App Router (API routes)
│   ├── backend/
│   │   ├── controllers/      # Express route controllers
│   │   ├── services/         # Business logic layer
│   │   ├── models/           # Mongoose models
│   │   ├── routes/           # Express routers
│   │   ├── middleware/       # Auth, rate-limit, etc.
│   │   └── db/seed.js        # Database seeder
│   ├── components/           # Shared React components
│   ├── config/               # App config, currencies, gateways
│   ├── contexts/             # React context providers
│   ├── controllers/          # Frontend API controllers (SWR)
│   ├── helpers/              # Utility helpers
│   ├── views/                # Page-level React components
│   │   └── SuperAdmin/       # Super-admin dashboard pages
│   └── App.jsx               # Root router
├── public/
│   └── locales/              # i18n translation files
├── server.js                 # Custom Express + Next.js server
├── next.config.js
├── .env.example              # Environment template
└── vercel.json               # Vercel deployment config
```

---

## 💳 Payment Gateway Setup

### Paystack (Primary · NGN)
1. Sign up at [paystack.com](https://paystack.com)
2. Go to **Settings → API Keys & Webhooks**
3. Copy **Secret Key** (`sk_live_...`) and **Public Key** (`pk_live_...`)
4. Add webhook URL: `https://your-app.vercel.app/api/v1/auth/paystack-webhook`
5. Add to environment variables

### Stripe (Optional)
1. Sign up at [stripe.com](https://stripe.com)
2. Go to **Developers → API Keys**
3. Copy **Secret Key** and create a **Webhook** pointing to:  
   `https://your-app.vercel.app/api/v1/auth/stripe-webhook`
4. Enable in SuperAdmin → Payment Gateways panel

---

## 🗄️ Database Seeding

Run the seeder to initialize exchange rates, payment gateways, and default data:

```bash
# The seed runs automatically on first server start
# Or trigger it manually via:
node -e "require('./src/backend/db/seed.js')()"
```

---

## 📜 License

This software is licensed for single use per purchase. Redistribution, resale, or open-source release is not permitted without written authorization.

---

## 🙋 Support

For support, contact: **hi@qwilopro.com**
