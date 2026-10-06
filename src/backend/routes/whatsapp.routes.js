const { Router } = require("express");
const { isLoggedIn, isAuthenticated, isSuperAdmin } = require("../middlewares/auth.middleware");
const {
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
} = require("../controllers/whatsapp.controller");

const router = Router();

// Middleware chain for super admin WhatsApp routes
const superAdminAuth = [isLoggedIn, isAuthenticated, isSuperAdmin];

// ─── Connection & Session Management ──────────────────────────────────────────
router.get("/status", superAdminAuth, getWhatsAppStatus);
router.get("/qr", superAdminAuth, getWhatsAppQR);
router.post("/connect", superAdminAuth, connectSession);
router.post("/disconnect", superAdminAuth, disconnectSession);
router.get("/gateway-info", superAdminAuth, getGatewayInfo);

// ─── Lead Management ─────────────────────────────────────────────────────────
router.post("/leads/upload", superAdminAuth, uploadLeads);
router.post("/leads/save", superAdminAuth, saveLeadBatch);
router.get("/leads", superAdminAuth, getSavedLeads);
router.delete("/leads/:id", superAdminAuth, deleteSavedLeadBatch);

// ─── Group Management ────────────────────────────────────────────────────────
router.get("/groups", superAdminAuth, getGroups);
router.post("/groups/create", superAdminAuth, createGroup);
router.post("/groups/add-contacts", superAdminAuth, addContactsToGroup);

// ─── Broadcast / Messaging ───────────────────────────────────────────────────
router.post("/broadcast", superAdminAuth, sendBroadcast);

// ─── Background Job Management ────────────────────────────────────────────────
// Returns all recent broadcast / add-contacts jobs
router.get("/jobs", superAdminAuth, listJobs);
// Poll progress for a specific job (safe to poll every 3-5s from the UI)
router.get("/jobs/:jobId", superAdminAuth, getJobStatus);
// Request graceful cancellation of a running job
router.post("/jobs/:jobId/cancel", superAdminAuth, cancelJob);

module.exports = router;

