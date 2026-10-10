const axios = require("axios");
const { Tenant, StoreDetails, User, SystemSetting } = require("../models");

// WhatsApp gateway config
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalizes any phone number format into international E.164 without '+'
 * Handles Nigerian local prefixes (080... -> 23480..., 80... -> 23480...) and international formats
 */
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

/**
 * Resolves Spintax: {Hello|Hi|Greetings} -> randomly selects one per message
 */
function resolveSpintax(text) {
  if (!text) return "";
  return text.replace(/\{([^{}]+)\}/g, (match, choices) => {
    const options = choices.split("|");
    if (options.length > 1) {
      const idx = Math.floor(Math.random() * options.length);
      return options[idx].trim();
    }
    return match; // Keep as is if it's a template placeholder like {store_name}
  });
}

/**
 * Sends a single WhatsApp message via superadmin's bounded WhatsApp number
 */
async function sendDirectWhatsApp(phone, message) {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) {
    return { success: false, error: "Invalid phone number format" };
  }

  try {
    const res = await axios.post(
      `${WA_GATEWAY_URL}/sessions/${WA_SESSION_ID}/send`,
      { phone: cleanPhone, message },
      { headers: waHeaders(), timeout: 20000 }
    );
    return { success: true, data: res.data };
  } catch (err) {
    // Fallback to root /send if session route fails
    try {
      const res = await axios.post(
        `${WA_GATEWAY_URL}/send`,
        { phone: cleanPhone, message },
        { headers: waHeaders(), timeout: 20000 }
      );
      return { success: true, data: res.data };
    } catch (innerErr) {
      const errMsg = innerErr?.response?.data?.message || innerErr.message;
      console.warn(`[WhatsApp Direct] Failed to send message to ${cleanPhone}:`, errMsg);
      return { success: false, error: errMsg };
    }
  }
}

/**
 * Triggered when a store updates their phone number for the first time.
 * Sends the official QwiloPRO automated welcome & onboarding message.
 */
async function sendStoreWelcomeMessage(tenantId, phone, storeName) {
  try {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) return;

    const store = await StoreDetails.findOne({ tenant_id: Number(tenantId) });
    if (store && store.is_welcome_message_sent) {
      return; // Already welcomed previously
    }

    const businessName = storeName || store?.store_name || "Partner";

    const welcomeMsg = [
      `🎉 *Welcome to QwiloPRO, ${businessName}!*`,
      ``,
      `We're thrilled to empower your restaurant / cafe with our smart all-in-one POS & management system. 🚀`,
      ``,
      `*Getting Started with QwiloPRO:*`,
      `📱 *POS Terminal*: Instant cashiering, table orders, and dual-screen customer display.`,
      `📋 *QR Digital Menu*: Contactless ordering for dine-in, takeaway, and delivery.`,
      `⚡ *Kitchen Display (KDS)*: Instant paperless order routing directly to your kitchen.`,
      `📊 *Reports & Inventory*: Real-time revenue analytics, ingredient tracking, and low-stock alerts.`,
      ``,
      `📖 *Explore guides, video walkthroughs, and full setup details:*`,
      `👉 *https://qwilo.site*`,
      ``,
      `Need dedicated setup support? Our team is always here for you:`,
      `👉 *https://qwilo.site/contact*`,
      ``,
      `_Cheers to seamless operations and record sales!_ 💚`,
      `— *Team QwiloPRO*`,
    ].join("\n");

    const result = await sendDirectWhatsApp(cleanPhone, welcomeMsg);

    // Record welcome message status
    await StoreDetails.updateOne(
      { tenant_id: Number(tenantId) },
      {
        $set: {
          is_welcome_message_sent: true,
          welcome_message_sent_at: new Date(),
        },
      }
    );

    return result;
  } catch (error) {
    console.error("[sendStoreWelcomeMessage Error]:", error.message);
  }
}

/**
 * Sends automated WhatsApp invoice to tenant when a new subscription is activated.
 */
async function sendSubscriptionInvoiceWhatsApp(tenantId, invoiceDetails = {}) {
  try {
    const tId = Number(tenantId);
    const [tenant, store, adminUser] = await Promise.all([
      Tenant.findOne({ id: tId }).lean(),
      StoreDetails.findOne({ tenant_id: tId }).lean(),
      User.findOne({ tenant_id: tId, role: "admin" }).lean(),
    ]);

    const recipientPhone = store?.phone || adminUser?.phone;
    if (!recipientPhone) {
      console.warn(`[sendSubscriptionInvoiceWhatsApp] No phone number found for tenant ${tId}`);
      return;
    }

    const tenantName = tenant?.name || adminUser?.name || "Customer";
    const storeName = store?.store_name || tenant?.name || "Store";
    const planTitle = invoiceDetails.plan_title || tenant?.plan_title || "Standard Plan";
    const amount = invoiceDetails.amount !== undefined ? invoiceDetails.amount : 0;
    const currency = invoiceDetails.currency || store?.currency || "NGN";
    const ref = invoiceDetails.reference || `INV-${tId}-${Date.now().toString().slice(-6)}`;
    const startStr = invoiceDetails.start_date || (tenant?.subscription_start ? new Date(tenant.subscription_start).toLocaleDateString() : new Date().toLocaleDateString());
    const endStr = invoiceDetails.end_date || (tenant?.subscription_end ? new Date(tenant.subscription_end).toLocaleDateString() : "Active");

    const invoiceMsg = [
      `🧾 *QwiloPRO Official Subscription Invoice*`,
      ``,
      `Dear *${tenantName}* (${storeName}),`,
      ``,
      `Thank you for subscribing to *QwiloPRO*! 🎉 Your subscription has been successfully processed and your account is active.`,
      ``,
      `*Invoice Details:*`,
      `• *Invoice No / Ref*: #${ref}`,
      `• *Subscribed Plan*: *${planTitle}*`,
      `• *Amount*: *${currency} ${Number(amount).toLocaleString()}*`,
      `• *Start Date*: ${startStr}`,
      `• *Valid Until*: *${endStr}*`,
      `• *Payment Status*: ✅ *PAID & ACTIVE*`,
      ``,
      `Your POS terminal, kitchen screen, QR menus, and live reporting tools are fully operational.`,
      ``,
      `👉 *Access your dashboard:* https://qwilo.site/dashboard/home`,
      `👉 *Manage Subscription:* https://qwilo.site/dashboard/subscription`,
      ``,
      `Need help? Reach our team at *https://qwilo.site/contact*`,
      `Thank you for growing with QwiloPRO! 💚`,
    ].join("\n");

    return await sendDirectWhatsApp(recipientPhone, invoiceMsg);
  } catch (error) {
    console.error("[sendSubscriptionInvoiceWhatsApp Error]:", error.message);
  }
}

/**
 * Sends trial or subscription expiry reminder via WhatsApp
 */
async function sendExpiryReminderWhatsApp(tenant, store, adminUser, daysLeft) {
  try {
    const recipientPhone = store?.phone || adminUser?.phone;
    if (!recipientPhone) return;

    const tenantName = tenant?.name || adminUser?.name || "Valued Partner";
    const storeName = store?.store_name || tenant?.name || "Your Store";
    const isTrial = Boolean(tenant?.isTrialPlan);
    const planTitle = tenant?.plan_title || (isTrial ? "Free Trial" : "Subscription");
    const expiryDate = tenant?.subscription_end
      ? new Date(tenant.subscription_end).toLocaleDateString()
      : "soon";

    const urgencyText =
      daysLeft === 0
        ? "⚠️ *EXPIRES TODAY*"
        : daysLeft === 1
        ? "⚠️ *EXPIRES TOMORROW (1 day remaining)*"
        : `⚠️ *Expires in ${daysLeft} days*`;

    const reminderMsg = [
      `🔔 *QwiloPRO Subscription Reminder*`,
      ``,
      `Dear *${tenantName}* (${storeName}),`,
      ``,
      `This is a friendly reminder that your *${planTitle}* ${isTrial ? "Trial" : "Subscription"} ${urgencyText} on *${expiryDate}*.`,
      ``,
      `*Why keep your subscription active?*`,
      `✅ Seamless POS cashiering & customer display without interruptions`,
      `✅ Instant table QR ordering & kitchen display flow`,
      `✅ Daily financial reports, sales analytics & inventory controls`,
      ``,
      `👉 *Renew or Upgrade Now:*`,
      `*https://qwilo.site/dashboard/subscription*`,
      ``,
      `If you have already renewed, please ignore this notice. Need assistance? Reach us at: https://qwilo.site/contact`,
      ``,
      `_Thank you for choosing QwiloPRO!_ 💚`,
    ].join("\n");

    return await sendDirectWhatsApp(recipientPhone, reminderMsg);
  } catch (err) {
    console.error("[sendExpiryReminderWhatsApp Error]:", err.message);
  }
}

/**
 * Background routine: Checks all tenants and dispatches expiry reminders
 * Identifies tenants with subscriptions expiring in 3 days, 1 day, or today.
 * Prevents double-sending to the same tenant on the same day.
 */
async function processSubscriptionExpiryReminders() {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const now = new Date();
    const fourDaysFromNow = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);

    // Find active tenants whose subscription expires within the next 4 days
    const tenants = await Tenant.find({
      is_active: 1,
      subscription_end: { $gte: new Date(now.setHours(0, 0, 0, 0)), $lte: fourDaysFromNow },
    }).lean();

    let sentCount = 0;
    const results = [];

    for (const tenant of tenants) {
      if (!tenant.subscription_end) continue;

      const expiry = new Date(tenant.subscription_end);
      const diffMs = expiry.getTime() - Date.now();
      const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      // Reminder stages: 3 days, 1 day, or 0 (today)
      let stage = null;
      if (daysLeft === 3) stage = "3_days";
      else if (daysLeft === 1) stage = "1_day";
      else if (daysLeft === 0) stage = "0_days";

      if (!stage) continue;

      // Anti-spam check: has this tenant already received a reminder for this stage today?
      if (
        tenant.last_expiry_reminder_date === todayStr &&
        tenant.last_expiry_reminder_level === stage
      ) {
        continue;
      }

      const [store, adminUser] = await Promise.all([
        StoreDetails.findOne({ tenant_id: tenant.id }).lean(),
        User.findOne({ tenant_id: tenant.id, role: "admin" }).lean(),
      ]);

      const phone = store?.phone || adminUser?.phone;
      if (!phone) continue;

      const res = await sendExpiryReminderWhatsApp(tenant, store, adminUser, daysLeft);
      if (res && res.success) {
        sentCount++;
        await Tenant.updateOne(
          { id: tenant.id },
          {
            $set: {
              last_expiry_reminder_date: todayStr,
              last_expiry_reminder_level: stage,
            },
          }
        );
        results.push({ tenant_id: tenant.id, name: tenant.name, stage, phone });
        // Anti-ban delay between automated system messages
        await sleep(3000);
      }
    }

    return { success: true, checked: tenants.length, sentCount, results };
  } catch (error) {
    console.error("[processSubscriptionExpiryReminders Error]:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Resolves personalized template variables for broadcast messages
 */
function compileTemplateMessage(template, tenantData) {
  let msg = resolveSpintax(template);

  const replacements = {
    "{tenant_name}": tenantData.name || "Valued Partner",
    "{store_name}": tenantData.store_name || tenantData.name || "Your Store",
    "{plan}": tenantData.plan_title || "Subscription",
    "{plan_title}": tenantData.plan_title || "Subscription",
    "{expiry}": tenantData.subscription_end ? new Date(tenantData.subscription_end).toLocaleDateString() : "N/A",
    "{expiry_date}": tenantData.subscription_end ? new Date(tenantData.subscription_end).toLocaleDateString() : "N/A",
    "{phone}": tenantData.phone || "",
    "{contact_name}": tenantData.contact_name || tenantData.name || "Partner",
  };

  for (const [tag, val] of Object.entries(replacements)) {
    msg = msg.split(tag).join(val);
  }

  return msg;
}

/**
 * Anti-Ban Paced Tenant Broadcast Engine:
 * - Sends to tenants with randomized delays (e.g. 4-8 seconds)
 * - Pauses for an extended cooldown after every batch (e.g. 20s after 10 messages)
 * - Customizes every single message via Spintax + variables so no two messages are identical
 * - Runs in background and persists live progress
 */
async function runTenantBroadcastJob(job, tenantAudience, templateMessage, options = {}) {
  const {
    minDelayMs = 4000,
    maxDelayMs = 8000,
    batchCooldownSize = 10,
    cooldownMs = 18000,
  } = options;

  job.status = "running";
  await persistTenantBroadcastJob(job);

  for (let i = 0; i < tenantAudience.length; i++) {
    // Check cancellation
    if (job.cancelRequested) {
      job.status = "cancelled";
      job.finishedAt = new Date().toISOString();
      await persistTenantBroadcastJob(job);
      return;
    }

    const tenantItem = tenantAudience[i];
    const personalizedText = compileTemplateMessage(templateMessage, tenantItem);

    try {
      const res = await sendDirectWhatsApp(tenantItem.phone, personalizedText);
      if (res && res.success) {
        job.sentCount++;
      } else {
        job.failedCount++;
        job.errors.push({
          tenant_id: tenantItem.id,
          name: tenantItem.name,
          phone: tenantItem.phone,
          error: res?.error || "Send failed",
        });
      }
    } catch (err) {
      job.failedCount++;
      job.errors.push({
        tenant_id: tenantItem.id,
        name: tenantItem.name,
        phone: tenantItem.phone,
        error: err.message,
      });
    }

    job.processed = i + 1;
    job.updatedAt = new Date().toISOString();

    // Persist progress periodically
    if ((i + 1) % 5 === 0 || i === tenantAudience.length - 1) {
      await persistTenantBroadcastJob(job);
    }

    // Anti-ban pacing
    if (i < tenantAudience.length - 1) {
      // Extended cooldown every batchCooldownSize messages
      if ((i + 1) % batchCooldownSize === 0) {
        console.log(`[Tenant Broadcast Anti-Ban] Batch of ${batchCooldownSize} sent. Cooling down for ${cooldownMs / 1000}s...`);
        await sleep(cooldownMs);
      } else {
        const delay = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
        await sleep(delay);
      }
    }
  }

  job.status = job.failedCount === tenantAudience.length ? "failed" : "completed";
  job.finishedAt = new Date().toISOString();
  await persistTenantBroadcastJob(job);
}

// Memory + MongoDB job registry for tenant broadcasts
const tenantBroadcastJobs = new Map();

async function persistTenantBroadcastJob(job) {
  try {
    const key = "whatsapp_tenant_broadcast_jobs";
    let setting = await SystemSetting.findOne({ key });
    let jobs = setting?.value || {};
    jobs[job.id] = { ...job, errors: (job.errors || []).slice(-20) };

    if (setting) {
      setting.value = jobs;
      setting.updated_at = new Date();
      await setting.save();
    } else {
      await SystemSetting.create({ key, value: jobs });
    }
  } catch (e) {
    console.warn("persistTenantBroadcastJob warning:", e.message);
  }
}

function startTenantBroadcastJob(tenantAudience, templateMessage, options = {}) {
  const id = `tbroadcast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const job = {
    id,
    type: "tenant_broadcast",
    status: "pending",
    total: tenantAudience.length,
    processed: 0,
    sentCount: 0,
    failedCount: 0,
    errors: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    finishedAt: null,
    cancelRequested: false,
  };

  tenantBroadcastJobs.set(id, job);

  // Run in background without blocking HTTP response
  runTenantBroadcastJob(job, tenantAudience, templateMessage, options).catch((err) => {
    job.status = "failed";
    job.finishedAt = new Date().toISOString();
    job.errors.push({ error: err.message });
    persistTenantBroadcastJob(job).catch(() => {});
  });

  return job;
}

module.exports = {
  normalizePhone,
  resolveSpintax,
  sendDirectWhatsApp,
  sendStoreWelcomeMessage,
  sendSubscriptionInvoiceWhatsApp,
  sendExpiryReminderWhatsApp,
  processSubscriptionExpiryReminders,
  compileTemplateMessage,
  startTenantBroadcastJob,
  tenantBroadcastJobs,
};
