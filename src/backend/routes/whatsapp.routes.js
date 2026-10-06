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

module.exports = router;
