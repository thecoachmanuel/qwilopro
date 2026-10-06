const axios = require("axios");
const { SystemSetting } = require("../models");
const waJobs = require("../services/whatsapp.jobs");

// ─── Config ─────────────────────────────────────────────────────────────────
const WA_GATEWAY_URL =
  process.env.WHATSAPP_GATEWAY_URL || "https://nectar-58qj.onrender.com";
const WA_API_SECRET = process.env.WHATSAPP_API_SECRET || "";
const WA_SESSION_ID =
  process.env.WHATSAPP_SESSION_ID || "qwilopro";


function waHeaders() {
  return {
    "x-api-secret": WA_API_SECRET,
    "Content-Type": "application/json",
  };
}

// ─── Phone Normalization Helper ─────────────────────────────────────────────
// Cleans non-digits, normalizes Nigerian numbers (080... -> 23480...), ensures valid format
function normalizePhoneNumber(raw) {
  if (!raw) return null;
  let str = String(raw).trim();

  // Strip leading '+' if present
  if (str.startsWith("+")) {
    str = str.substring(1);
  }

  // Remove all non-numeric characters
  str = str.replace(/\D/g, "");

  if (!str) return null;

  // Local Nigerian format (11 digits starting with 0): 080... -> 23480...
  if (str.length === 11 && str.startsWith("0")) {
    str = "234" + str.substring(1);
  }

  // Local Nigerian format without leading zero (10 digits starting with 7, 8, or 9)
  if (str.length === 10 && /^[789]/.test(str)) {
    str = "234" + str;
  }

  // International standard minimum length is 8 digits
  if (str.length < 8) return null;

  return str;
}

// ─── Extract Leads from Rows & Headers ───────────────────────────────────────
function extractLeadsFromData(rows, headers) {
  if (!Array.isArray(headers) || !Array.isArray(rows)) {
    return { leads: [], duplicatesRemoved: 0, invalidCount: 0 };
  }

  const phoneColIndex = headers.findIndex((h) =>
    /phone|mobile|whatsapp|contact|cell|number|tel/i.test(String(h).trim())
  );

  const nameColIndex = headers.findIndex((h) =>
    /name|full.?name|customer|client|lead|contact.?person/i.test(String(h).trim())
  );

  const emailColIndex = headers.findIndex((h) =>
    /email|mail/i.test(String(h).trim())
  );

  if (phoneColIndex === -1) {
    return { leads: [], error: "No phone number column detected in file." };
  }

  const seenPhones = new Set();
  const leads = [];
  let duplicatesRemoved = 0;
  let invalidCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawPhone = String(row[phoneColIndex] || "").trim();
    if (!rawPhone) continue;

    const normalized = normalizePhoneNumber(rawPhone);
    if (!normalized) {
      invalidCount++;
      continue;
    }

    if (seenPhones.has(normalized)) {
      duplicatesRemoved++;
      continue;
    }

    seenPhones.add(normalized);

    const name = nameColIndex !== -1 ? String(row[nameColIndex] || "").trim() : `Contact ${leads.length + 1}`;
    const email = emailColIndex !== -1 ? String(row[emailColIndex] || "").trim() : "";

    leads.push({
      id: `lead_${Date.now()}_${i}`,
      name: name || `Contact ${leads.length + 1}`,
      phone: normalized,
      displayPhone: `+${normalized}`,
      email: email || undefined,
      rawPhone,
    });
  }

  return { leads, duplicatesRemoved, invalidCount };
}

// ─── GET /api/v1/whatsapp/status ─────────────────────────────────────────────
async function getWhatsAppStatus(req, res) {
  try {
    let statusData = null;

    try {
      const sessionRes = await axios.get(
        `${WA_GATEWAY_URL}/sessions/${WA_SESSION_ID}/status`,
        { headers: waHeaders(), timeout: 10000 }
      );
      statusData = sessionRes.data;
    } catch (err) {
      // Fallback to global /status if session route fails
      try {
        const globalRes = await axios.get(`${WA_GATEWAY_URL}/status`, {
          headers: waHeaders(),
          timeout: 10000,
        });
        statusData = globalRes.data;
      } catch (innerErr) {
        throw err;
      }
    }

    const isConnected = !!(
      statusData?.connected === true ||
      statusData?.connection === "open"
    );

    return res.json({
      success: true,
      data: {
        ...statusData,
        connected: isConnected,
        sessionId: WA_SESSION_ID,
        gatewayUrl: WA_GATEWAY_URL,
      },
    });
  } catch (err) {
    const status = err?.response?.status || 503;
    const message =
      err?.response?.data?.message || err?.message || "WhatsApp gateway is unreachable";
    return res.status(status).json({
      success: false,
      message,
      data: { connected: false, connection: "disconnected", sessionId: WA_SESSION_ID },
    });
  }
}

// ─── GET /api/v1/whatsapp/qr ─────────────────────────────────────────────────
async function getWhatsAppQR(req, res) {
  try {
    let qrData = null;

    try {
      const sessionRes = await axios.get(
        `${WA_GATEWAY_URL}/sessions/${WA_SESSION_ID}/qr`,
        { headers: waHeaders(), timeout: 10000 }
      );
      qrData = sessionRes.data;
    } catch (err) {
      try {
        const globalRes = await axios.get(`${WA_GATEWAY_URL}/qr`, {
          headers: waHeaders(),
          timeout: 10000,
        });
        qrData = globalRes.data;
      } catch (innerErr) {
        throw err;
      }
    }

    return res.json({
      success: true,
      data: qrData,
    });
  } catch (err) {
    const status = err?.response?.status || 503;
    const message = err?.response?.data?.message || err?.message || "QR code not ready";
    return res.status(status).json({
      success: false,
      message,
    });
  }
}

// ─── POST /api/v1/whatsapp/connect ───────────────────────────────────────────
async function connectSession(req, res) {
  try {
    let responseData = null;

    try {
      const response = await axios.post(
        `${WA_GATEWAY_URL}/sessions/${WA_SESSION_ID}/start`,
        {},
        { headers: waHeaders(), timeout: 15000 }
      );
      responseData = response.data;
    } catch (err) {
      // Fallback
      const globalRes = await axios.get(`${WA_GATEWAY_URL}/status`, {
        headers: waHeaders(),
        timeout: 10000,
      });
      responseData = globalRes.data;
    }

    return res.json({
      success: true,
      message: "Connection initialized. Generating QR code...",
      data: responseData,
    });
  } catch (err) {
    const status = err?.response?.status || 503;
    const message =
      err?.response?.data?.message || err?.message || "Failed to initialize WhatsApp connection";
    return res.status(status).json({ success: false, message });
  }
}

// ─── POST /api/v1/whatsapp/disconnect ────────────────────────────────────────
async function disconnectSession(req, res) {
  try {
    let result = null;

    try {
      const sessionRes = await axios.post(
        `${WA_GATEWAY_URL}/sessions/${WA_SESSION_ID}/logout`,
        {},
        { headers: waHeaders(), timeout: 15000 }
      );
      result = sessionRes.data;
    } catch (err) {
      const globalRes = await axios.post(
        `${WA_GATEWAY_URL}/logout`,
        {},
        { headers: waHeaders(), timeout: 15000 }
      );
      result = globalRes.data;
    }

    return res.json({
      success: true,
      message: "Qwilo Pro WhatsApp disconnected successfully.",
      data: result,
    });
  } catch (err) {
    const status = err?.response?.status || 503;
    const message =
      err?.response?.data?.message || err?.message || "Failed to disconnect WhatsApp";
    return res.status(status).json({ success: false, message });
  }
}

// ─── POST /api/v1/whatsapp/leads/upload ──────────────────────────────────────
async function uploadLeads(req, res) {
  try {
    const { headers, rows } = req.body;

    if (!Array.isArray(headers) || !Array.isArray(rows)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload. Provide 'headers' array and 'rows' array.",
      });
    }

    const { leads, duplicatesRemoved, invalidCount, error } = extractLeadsFromData(rows, headers);

    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    if (leads.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No valid phone numbers found. Please ensure your file has a column for phone numbers (e.g. Phone, Mobile, WhatsApp).",
      });
    }

    return res.json({
      success: true,
      message: `Successfully extracted ${leads.length} contacts (${duplicatesRemoved} duplicates ignored, ${invalidCount} invalid rows skipped).`,
      leads,
      count: leads.length,
      duplicatesRemoved,
      invalidCount,
    });
  } catch (err) {
    console.error("uploadLeads error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── POST /api/v1/whatsapp/leads/save ────────────────────────────────────────
async function saveLeadBatch(req, res) {
  try {
    const { name, leads } = req.body;
    if (!name || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide a batch name and a list of leads to save.",
      });
    }

    let setting = await SystemSetting.findOne({ key: "whatsapp_saved_lead_batches" });
    let batches = setting?.value || [];

    const newBatch = {
      id: `batch_${Date.now()}`,
      name: String(name).trim(),
      leadsCount: leads.length,
      leads,
      created_at: new Date().toISOString(),
    };

    batches.unshift(newBatch);
    // Keep up to 20 batches
    if (batches.length > 20) batches = batches.slice(0, 20);

    if (setting) {
      setting.value = batches;
      setting.updated_at = new Date();
      await setting.save();
    } else {
      await SystemSetting.create({
        key: "whatsapp_saved_lead_batches",
        value: batches,
      });
    }

    return res.json({
      success: true,
      message: `Batch "${name}" saved successfully with ${leads.length} leads.`,
      batch: newBatch,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/v1/whatsapp/leads ──────────────────────────────────────────────
async function getSavedLeads(req, res) {
  try {
    const setting = await SystemSetting.findOne({ key: "whatsapp_saved_lead_batches" });
    return res.json({
      success: true,
      batches: setting?.value || [],
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── DELETE /api/v1/whatsapp/leads/:id ───────────────────────────────────────
async function deleteSavedLeadBatch(req, res) {
  try {
    const { id } = req.params;
    const setting = await SystemSetting.findOne({ key: "whatsapp_saved_lead_batches" });
    if (!setting) {
      return res.json({ success: true, message: "Deleted successfully." });
    }

    setting.value = (setting.value || []).filter((b) => b.id !== id);
    setting.updated_at = new Date();
    await setting.save();

    return res.json({
      success: true,
      message: "Lead batch deleted.",
      batches: setting.value,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/v1/whatsapp/groups ─────────────────────────────────────────────
async function getGroups(req, res) {
  try {
    let groups = [];
    try {
      const response = await axios.get(
        `${WA_GATEWAY_URL}/sessions/${WA_SESSION_ID}/groups`,
        { headers: waHeaders(), timeout: 15000 }
      );
      groups = response.data?.groups || response.data || [];
    } catch (_) {
      try {
        const fallbackRes = await axios.get(`${WA_GATEWAY_URL}/api/groups`, {
          headers: waHeaders(),
          timeout: 15000,
        });
        groups = fallbackRes.data?.groups || fallbackRes.data || [];
      } catch (innerErr) {
        // Return saved groups from local settings if gateway group route isn't available
        const setting = await SystemSetting.findOne({ key: "whatsapp_created_groups" });
        groups = setting?.value || [];
      }
    }

    return res.json({ success: true, groups });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── POST /api/v1/whatsapp/groups/create ─────────────────────────────────────
async function createGroup(req, res) {
  try {
    const { name, phones, description } = req.body;
    if (!name || !Array.isArray(phones) || phones.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide group name and at least one contact phone number.",
      });
    }

    const cleanPhones = phones
      .map(normalizePhoneNumber)
      .filter(Boolean);

    let createdGroup = null;
    let gatewaySuccess = false;

    // Try multi-tenant group creation endpoint on Nectar
    try {
      const response = await axios.post(
        `${WA_GATEWAY_URL}/sessions/${WA_SESSION_ID}/groups/create`,
        { name, phones: cleanPhones, description },
        { headers: waHeaders(), timeout: 30000 }
      );
      createdGroup = response.data?.group || response.data;
      gatewaySuccess = true;
    } catch (err) {
      // Try global route
      try {
        const globalRes = await axios.post(
          `${WA_GATEWAY_URL}/api/groups/create`,
          { name, phones: cleanPhones },
          { headers: waHeaders(), timeout: 30000 }
        );
        createdGroup = globalRes.data?.group || globalRes.data;
        gatewaySuccess = true;
      } catch (innerErr) {
        // Nectar gateway may need group endpoint enabled
        console.warn("Nectar gateway does not have /groups/create endpoint yet.");
      }
    }

    // Save group record locally in RestroPro database
    const setting = await SystemSetting.findOne({ key: "whatsapp_created_groups" });
    let existingGroups = setting?.value || [];

    const groupRecord = {
      id: createdGroup?.id || `group_${Date.now()}`,
      name,
      description: description || "",
      participantsCount: cleanPhones.length,
      phones: cleanPhones,
      inviteLink: createdGroup?.inviteLink || null,
      created_at: new Date().toISOString(),
      syncedWithGateway: gatewaySuccess,
    };

    existingGroups.unshift(groupRecord);
    if (setting) {
      setting.value = existingGroups;
      setting.updated_at = new Date();
      await setting.save();
    } else {
      await SystemSetting.create({
        key: "whatsapp_created_groups",
        value: existingGroups,
      });
    }

    if (!gatewaySuccess) {
      return res.json({
        success: true,
        savedLocally: true,
        group: groupRecord,
        message: `Group "${name}" registered with ${cleanPhones.length} contacts! (Tip: You can broadcast your WhatsApp Group invite link directly to these leads using the Broadcast tool below).`,
      });
    }

    return res.json({
      success: true,
      group: groupRecord,
      message: `WhatsApp Group "${name}" created successfully with ${cleanPhones.length} participants!`,
    });
  } catch (err) {
    const status = err?.response?.status || 503;
    const message = err?.response?.data?.message || err?.message || "Failed to create group";
    return res.status(status).json({ success: false, message });
  }
}

// ─── POST /api/v1/whatsapp/groups/add-contacts ───────────────────────────────
// Fire-and-forget: returns jobId immediately, runs in server background.
// Browser can be closed — the server keeps adding contacts safely.
async function addContactsToGroup(req, res) {
  try {
    const { groupId, phones, batchSize = 4, delayBetweenBatchesMs = 3500 } = req.body;
    if (!groupId || !Array.isArray(phones) || phones.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide groupId and at least one contact phone number.",
      });
    }

    const job = waJobs.startAddContactsJob(groupId, phones, batchSize, delayBetweenBatchesMs);

    return res.json({
      success: true,
      backgroundJob: true,
      jobId: job.id,
      message: `✅ Add-contacts job started for ${job.total} contacts. You can safely close this tab — the server will keep running. Check progress at GET /api/v1/whatsapp/jobs/${job.id}`,
      total: job.total,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── POST /api/v1/whatsapp/broadcast ─────────────────────────────────────────
// Fire-and-forget background job: returns jobId instantly.
// Closing the browser/tab has ZERO effect — the server keeps sending.
async function sendBroadcast(req, res) {
  try {
    const { phones, message, minDelayMs = 2000, maxDelayMs = 4000 } = req.body;

    if (!Array.isArray(phones) || phones.length === 0 || !message) {
      return res.status(400).json({
        success: false,
        message: "Provide a list of phone numbers and a message to broadcast.",
      });
    }

    const job = waJobs.startBroadcastJob(phones, message, minDelayMs, maxDelayMs);

    return res.json({
      success: true,
      backgroundJob: true,
      jobId: job.id,
      message: `✅ Broadcast started for ${job.total} contacts. You can safely close this tab — the server will keep sending. Check progress at GET /api/v1/whatsapp/jobs/${job.id}`,
      total: job.total,
    });
  } catch (err) {
    console.error("sendBroadcast error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/v1/whatsapp/jobs ────────────────────────────────────────────────
async function listJobs(req, res) {
  try {
    const jobs = await waJobs.listJobs();
    return res.json({ success: true, jobs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/v1/whatsapp/jobs/:jobId ────────────────────────────────────────
async function getJobStatus(req, res) {
  try {
    const job = await waJobs.getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }
    return res.json({ success: true, job });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── POST /api/v1/whatsapp/jobs/:jobId/cancel ────────────────────────────────
async function cancelJob(req, res) {
  try {
    const cancelled = await waJobs.cancelJob(req.params.jobId);
    if (!cancelled) {
      return res.status(404).json({ success: false, message: "Job not found or already finished." });
    }
    return res.json({ success: true, message: "Cancellation requested. Job will stop after the current message." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}


// ─── GET /api/v1/whatsapp/gateway-info ───────────────────────────────────────
async function getGatewayInfo(req, res) {
  return res.json({
    success: true,
    gatewayUrl: WA_GATEWAY_URL,
    sessionId: WA_SESSION_ID,
    apiSecretConfigured: !!WA_API_SECRET,
  });
}

module.exports = {
  getWhatsAppStatus,
  getWhatsAppQR,
  connectSession,
  disconnectSession,
  uploadLeads,
  saveLeadBatch,
  getSavedLeads,
  deleteSavedLeadBatch,
  getGroups,
  createGroup,
  addContactsToGroup,
  sendBroadcast,
  getGatewayInfo,
  listJobs,
  getJobStatus,
  cancelJob,
};
