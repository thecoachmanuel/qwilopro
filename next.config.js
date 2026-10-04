/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  // ─── Image Optimization ─────────────────────────────────────────────
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'http',  hostname: '**' },
      { protocol: 'https', hostname: '**' },
    ],
  },

  // ─── Server-side External Packages (Next.js 14 syntax) ──────────────
  // These native/server modules must NOT be bundled by Next.js webpack.
  // They run only inside Vercel serverless functions (Node.js runtime).
  experimental: {
    serverComponentsExternalPackages: [
      'mongoose',
      'bcrypt',
      'jsonwebtoken',
      'nodemailer',
      'express',
      'express-fileupload',
      'express-useragent',
      'morgan',
      'cors',
      'cookie-parser',
      'i18n',
      'pusher',
      'stripe',
      'paystack',
      'serverless-http',
    ],
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

module.exports = nextConfig;
