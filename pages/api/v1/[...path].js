/**
 * Next.js Pages Router API catch-all for Express backend.
 * Routes all /api/v1/* requests directly into Express on Vercel serverless.
 */

// Polyfill: Node.js v25+ removed SlowBuffer (jsonwebtoken dep)
const buf = require('buffer');
if (!buf.SlowBuffer) buf.SlowBuffer = Buffer;

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
    await seedDatabase().catch((err) => console.error("Database seed error:", err));
  }
}

async function apiRoute(req, res) {
  try {
    await ensureDB();
  } catch (err) {
    console.error("Database connection error in API route:", err);
  }

  // Ensure Express router sees the full /api/v1 path
  if (req.url && !req.url.startsWith('/api/v1')) {
    req.url = '/api/v1' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }

  return new Promise((resolve, reject) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    expressApp(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

apiRoute.config = {
  api: {
    bodyParser: false,        // Express handles body parsing
    responseLimit: false,     // Allow large responses (reports, exports)
    externalResolver: true,
  },
};

module.exports = apiRoute;
module.exports.default = apiRoute;
module.exports.config = apiRoute.config;
