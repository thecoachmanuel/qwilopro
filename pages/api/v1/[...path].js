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
  if (mongoose.connection.readyState === 1) return;
  const conn = await connectDB();
  if (conn && !_dbReady) {
    _dbReady = true;
    // Run seed non-blocking in background so API requests are not delayed
    seedDatabase().catch((err) => console.error("Database seed error:", err));
  }
}

async function apiRoute(req, res) {
  try {
    await ensureDB();
  } catch (err) {
    console.error("Database connection error in API route:", err);
  }

  // If Next.js or a serverless wrapper already parsed body, mark req._body = true so express.json() doesn't re-read
  if (req.body && typeof req.body === 'object') {
    req._body = true;
  }

  // Ensure Express router sees the full /api/v1 path
  if (req.url && !req.url.startsWith('/api/v1')) {
    req.url = '/api/v1' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }

  return new Promise((resolve) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    expressApp(req, res, (err) => {
      if (err) {
        console.error("Express API serverless error:", err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: err?.message || "Internal server error",
          });
        }
        return resolve();
      }
      if (!res.headersSent) {
        res.status(404).json({
          success: false,
          message: `API route ${req.method || 'GET'} ${req.url} not found`,
        });
      }
      resolve();
    });
  });
}

export const config = {
  api: {
    bodyParser: false,        // Express handles body parsing
    responseLimit: false,     // Allow large responses (reports, exports)
    externalResolver: true,
  },
};

export default apiRoute;

// CommonJS compatibility
module.exports = apiRoute;
module.exports.default = apiRoute;
module.exports.config = config;

