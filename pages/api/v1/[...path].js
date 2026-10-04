/**
 * Next.js Pages Router API catch-all for Express backend.
 * Wraps the entire Express app via serverless-http so all /api/v1/* routes
 * work on Vercel serverless without any rewriting of controllers/services.
 */

// Polyfill: Node.js v25+ removed SlowBuffer (jsonwebtoken dep)
const buf = require('buffer');
if (!buf.SlowBuffer) buf.SlowBuffer = Buffer;

const serverlessHttp = require('serverless-http');
const expressApp = require('../../../src/backend/app');
const { connectDB } = require('../../../src/backend/db/connect');
const { seedDatabase } = require('../../../src/backend/db/seed');
const mongoose = require('mongoose');

// Ensure MongoDB is connected (cached across warm invocations)
let _dbReady = false;
async function ensureDB() {
  if (_dbReady && mongoose.connection.readyState === 1) return;
  const conn = await connectDB();
  if (conn && !_dbReady) {
    _dbReady = true;
    await seedDatabase().catch(() => {});
  }
}

// Create the serverless handler once (cached across warm invocations)
const handler = serverlessHttp(expressApp, {
  request(req) {
    // Restore full URL path so Express router sees /api/v1/...
    req.url = req.originalUrl || req.url;
  },
});

export default async function apiRoute(req, res) {
  await ensureDB();
  return handler(req, res);
}

export const config = {
  api: {
    bodyParser: false,        // Express handles body parsing
    responseLimit: false,     // Allow large responses (reports, exports)
    externalResolver: true,
  },
};
