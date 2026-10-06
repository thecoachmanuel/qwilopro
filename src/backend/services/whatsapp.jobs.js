/**
 * ─── WhatsApp Background Job Service ──────────────────────────────────────────
 *
 * Runs broadcast and add-contacts tasks as background server-side jobs.
 * Jobs are stored in MongoDB (SystemSetting) so they survive server restarts.
 * The browser/tab can be closed at any time — progress keeps running on the server.
 *
 * Flow:
 *   1. POST /whatsapp/broadcast/start  → creates job, returns { jobId }
 *   2. GET  /whatsapp/jobs/:jobId      → returns live progress
 *   3. POST /whatsapp/jobs/:jobId/cancel → requests graceful cancellation
 */

const axios = require("axios");
const { SystemSetting } = require("../models");

const WA_GATEWAY_URL =
  process.env.WHATSAPP_GATEWAY_URL || "https://nectar-58qj.onrender.com";
const WA_API_SECRET = process.env.WHATSAPP_API_SECRET || "";
const WA_SESSION_ID = process.env.WHATSAPP_SESSION_ID || "qwilopro";

function waHeaders() {
  return {
    "x-api-secret": WA_API_SECRET,
    "Content-Type": "application/json",
  };
}

// ─── In-process job registry (survives only while server is up) ───────────────
// For cross-restart status, we also persist snapshots to MongoDB.
const activeJobs = new Map();

// ─── Normalize phone (mirrors controller helper) ──────────────────────────────
function normalizePhone(raw) {
  if (!raw) return null;
  let str = String(raw).trim();
  if (str.startsWith("+")) str = str.substring(1);
  str = str.replace(/\D/g, "");
  if (!str) return null;
  if (str.length === 11 && str.startsWith("0")) str = "234" + str.substring(1);
  if (str.length === 10 && /^[789]/.test(str)) str = "234" + str;
  if (str.length < 8) return null;
  return str;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (base) => base + Math.floor(Math.random() * 1500);

// ─── Persist job snapshot to MongoDB ─────────────────────────────────────────
async function persistJob(job) {
  try {
    const key = "whatsapp_background_jobs";
    let setting = await SystemSetting.findOne({ key });
    let jobs = setting?.value || {};
    jobs[job.id] = {
      id: job.id,
      type: job.type,
      status: job.status,
      total: job.total,
      processed: job.processed,
      sentCount: job.sentCount,
      failedCount: job.failedCount,
      errors: (job.errors || []).slice(-20),
      createdAt: job.createdAt,
      updatedAt: new Date().toISOString(),
      finishedAt: job.finishedAt || null,
      cancelRequested: job.cancelRequested || false,
    };

    // Keep only last 50 jobs
    const keys = Object.keys(jobs);
    if (keys.length > 50) {
      keys
        .sort((a, b) => (jobs[a].createdAt < jobs[b].createdAt ? -1 : 1))
        .slice(0, keys.length - 50)
        .forEach((k) => delete jobs[k]);
    }

    if (setting) {
      setting.value = jobs;
      setting.updated_at = new Date();
      await setting.save();
    } else {
      await SystemSetting.create({ key, value: jobs });
    }
  } catch (e) {
    // Non-fatal — job still runs even if persistence fails
    console.warn("[WhatsApp Jobs] persist failed:", e.message);
  }
}

// ─── Create a new job record ──────────────────────────────────────────────────
function createJob(type, total) {
  const id = `wajob_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const job = {
    id,
    type, // "broadcast" | "addContacts"
    status: "pending", // pending | running | completed | failed | cancelled
    total,
    processed: 0,
    sentCount: 0,
    failedCount: 0,
    errors: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    finishedAt: null,
    cancelRequested: false,
  };
  activeJobs.set(id, job);
  return job;
}

// ─── BROADCAST background worker ──────────────────────────────────────────────
async function runBroadcastJob(job, phones, message, minDelayMs, maxDelayMs) {
  job.status = "running";
  await persistJob(job);

  const getDelay = () => {
    const min = Math.max(Number(minDelayMs) || 2000, 1000);
    const max = Math.max(Number(maxDelayMs) || 4000, min + 500);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  for (let i = 0; i < phones.length; i++) {
    // Check cancellation
    if (job.cancelRequested) {
      job.status = "cancelled";
      job.finishedAt = new Date().toISOString();
      await persistJob(job);
      return;
    }

    const phone = phones[i];
    try {
      await axios.post(
        `${WA_GATEWAY_URL}/sessions/${WA_SESSION_ID}/send`,
        { phone, message },
        { headers: waHeaders(), timeout: 15000 }
      );
      job.sentCount++;
    } catch (err) {
      try {
        await axios.post(
          `${WA_GATEWAY_URL}/send`,
          { phone, message },
          { headers: waHeaders(), timeout: 15000 }
        );
        job.sentCount++;
      } catch (innerErr) {
        job.failedCount++;
        job.errors.push({
          phone,
          error: innerErr?.response?.data?.message || innerErr.message,
        });
      }
    }

    job.processed = i + 1;
    job.updatedAt = new Date().toISOString();

    // Persist progress every 10 messages
    if ((i + 1) % 10 === 0 || i === phones.length - 1) {
      await persistJob(job);
    }

    // Anti-ban cooldowns
    if (i < phones.length - 1) {
      if ((i + 1) % 15 === 0) {
        await sleep(8000);
      } else {
        await sleep(getDelay());
      }
    }
  }

  job.status = job.failedCount === phones.length ? "failed" : "completed";
  job.finishedAt = new Date().toISOString();
  await persistJob(job);
}

// ─── ADD CONTACTS background worker ──────────────────────────────────────────
async function runAddContactsJob(job, groupId, phones, batchSize, delayMs) {
  job.status = "running";
  await persistJob(job);

  const size = Math.min(Math.max(Number(batchSize) || 4, 1), 10);
  const chunks = [];
  for (let i = 0; i < phones.length; i += size) {
    chunks.push(phones.slice(i, i + size));
  }

  for (let c = 0; c < chunks.length; c++) {
    if (job.cancelRequested) {
      job.status = "cancelled";
      job.finishedAt = new Date().toISOString();
      await persistJob(job);
      return;
    }

    const chunk = chunks[c];
    try {
      await axios.post(
        `${WA_GATEWAY_URL}/sessions/${WA_SESSION_ID}/groups/${groupId}/add`,
        { phones: chunk },
        { headers: waHeaders(), timeout: 35000 }
      );
      job.sentCount += chunk.length;
    } catch (err) {
      try {
        await axios.post(
          `${WA_GATEWAY_URL}/api/groups/add-participants`,
          { groupId, phones: chunk },
          { headers: waHeaders(), timeout: 35000 }
        );
        job.sentCount += chunk.length;
      } catch (innerErr) {
        job.failedCount += chunk.length;
        const errMsg = innerErr?.response?.data?.message || innerErr.message;
        job.errors.push({ batch: c + 1, count: chunk.length, error: errMsg });
      }
    }

    job.processed = Math.min((c + 1) * size, phones.length);
    job.updatedAt = new Date().toISOString();

    if ((c + 1) % 3 === 0 || c === chunks.length - 1) {
      await persistJob(job);
    }

    if (c < chunks.length - 1) {
      await sleep(jitter(Number(delayMs) || 3500));
    }
  }

  job.status = job.sentCount === 0 ? "failed" : "completed";
  job.finishedAt = new Date().toISOString();
  await persistJob(job);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start a broadcast job (fire-and-forget).
 * Returns the job object immediately.
 */
function startBroadcastJob(phones, message, minDelayMs = 2000, maxDelayMs = 4000) {
  const cleanPhones = [...new Set(phones.map(normalizePhone).filter(Boolean))];
  if (cleanPhones.length === 0) {
    throw new Error("No valid phone numbers for broadcast.");
  }

  const job = createJob("broadcast", cleanPhones.length);

  // Fire and forget — runs in background independent of HTTP connection
  runBroadcastJob(job, cleanPhones, message, minDelayMs, maxDelayMs).catch(
    (err) => {
      job.status = "failed";
      job.finishedAt = new Date().toISOString();
      job.errors.push({ error: err.message });
      persistJob(job).catch(() => {});
    }
  );

  return job;
}

/**
 * Start an add-contacts job (fire-and-forget).
 * Returns the job object immediately.
 */
function startAddContactsJob(groupId, phones, batchSize = 4, delayMs = 3500) {
  const cleanPhones = [...new Set(phones.map(normalizePhone).filter(Boolean))];
  if (cleanPhones.length === 0) {
    throw new Error("No valid phone numbers to add.");
  }

  const job = createJob("addContacts", cleanPhones.length);

  runAddContactsJob(job, groupId, cleanPhones, batchSize, delayMs).catch(
    (err) => {
      job.status = "failed";
      job.finishedAt = new Date().toISOString();
      job.errors.push({ error: err.message });
      persistJob(job).catch(() => {});
    }
  );

  return job;
}

/**
 * Get job status — checks in-memory first, falls back to MongoDB.
 */
async function getJob(jobId) {
  if (activeJobs.has(jobId)) {
    return activeJobs.get(jobId);
  }

  // Fallback: check persisted jobs in MongoDB
  try {
    const setting = await SystemSetting.findOne({
      key: "whatsapp_background_jobs",
    });
    return setting?.value?.[jobId] || null;
  } catch {
    return null;
  }
}

/**
 * Request graceful cancellation of a running job.
 */
async function cancelJob(jobId) {
  const job = activeJobs.get(jobId);
  if (job) {
    job.cancelRequested = true;
    return true;
  }

  // Try from persisted jobs
  try {
    const setting = await SystemSetting.findOne({
      key: "whatsapp_background_jobs",
    });
    if (setting?.value?.[jobId]) {
      setting.value[jobId].cancelRequested = true;
      setting.value[jobId].status = "cancelled";
      setting.markModified("value");
      await setting.save();
      return true;
    }
  } catch {}

  return false;
}

/**
 * List all recent jobs from MongoDB.
 */
async function listJobs() {
  try {
    const setting = await SystemSetting.findOne({
      key: "whatsapp_background_jobs",
    });
    const jobs = setting?.value || {};
    return Object.values(jobs).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  } catch {
    return [];
  }
}

module.exports = {
  startBroadcastJob,
  startAddContactsJob,
  getJob,
  cancelJob,
  listJobs,
};
