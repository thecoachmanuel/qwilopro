/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  compress: true,
  swcMinify: true,
  poweredByHeader: false,

  // ─── Image Optimization ─────────────────────────────────────────────
  images: {
    unoptimized: process.env.NEXT_IMAGE_UNOPTIMIZED === 'true',
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'http',  hostname: '**' },
      { protocol: 'https', hostname: '**' },
    ],
  },

  // ─── Performance, Security & Cache Headers ─────────────────────────
  async headers() {
    return [
      // Global Security Headers
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
        ],
      },
      // Static JS/CSS/fonts — content-addressed, safe to cache forever
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Images
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      // ALL HTML pages — must never be stale so every deploy is instant
      {
        source: '/((?!_next/static|_next/image|favicon.ico|images/).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
        ],
      },
    ];
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
