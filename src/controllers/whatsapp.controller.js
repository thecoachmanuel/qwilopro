import apiClient from "../helpers/ApiClient";

/**
 * Fetch current WhatsApp gateway connection status for Qwilo Pro
 */
export async function getWhatsAppStatus() {
  try {
    const response = await apiClient.get("/whatsapp/status");
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Fetch the dynamic QR code base64 image from the WhatsApp gateway
 */
export async function getWhatsAppQR() {
  try {
    const response = await apiClient.get("/whatsapp/qr");
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Start/initialize a WhatsApp session on the gateway to generate a fresh QR code
 */
export async function connectWhatsApp() {
  try {
    const response = await apiClient.post("/whatsapp/connect");
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Disconnect/logout the active WhatsApp session
 */
export async function disconnectWhatsApp() {
  try {
    const response = await apiClient.post("/whatsapp/disconnect");
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Fetch WhatsApp gateway environment and session info
 */
export async function getGatewayInfo() {
  try {
    const response = await apiClient.get("/whatsapp/gateway-info");
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Upload parsed lead rows and headers to extract valid phone numbers
 * @param {Object} payload { headers: string[], rows: any[][] }
 */
export async function uploadLeads(payload) {
  try {
    const response = await apiClient.post("/whatsapp/leads/upload", payload);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Save an extracted batch of leads
 * @param {Object} payload { name: string, leads: object[] }
 */
export async function saveLeadBatch(payload) {
  try {
    const response = await apiClient.post("/whatsapp/leads/save", payload);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get all previously saved lead batches
 */
export async function getSavedLeads() {
  try {
    const response = await apiClient.get("/whatsapp/leads");
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Delete a saved lead batch
 * @param {string} id
 */
export async function deleteSavedLeadBatch(id) {
  try {
    const response = await apiClient.delete(`/whatsapp/leads/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get WhatsApp groups
 */
export async function getWhatsAppGroups() {
  try {
    const response = await apiClient.get("/whatsapp/groups");
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Create a new WhatsApp group
 * @param {Object} payload { name: string, phones: string[], description?: string }
 */
export async function createWhatsAppGroup(payload) {
  try {
    const response = await apiClient.post("/whatsapp/groups/create", payload);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Add contacts to an existing WhatsApp group
 * @param {Object} payload { groupId: string, phones: string[] }
 */
export async function addContactsToWhatsAppGroup(payload) {
  try {
    const response = await apiClient.post("/whatsapp/groups/add-contacts", payload);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Send WhatsApp broadcast / direct message to multiple numbers
 * @param {Object} payload { phones: string[], message: string, delayMs?: number }
 */
export async function sendWhatsAppBroadcast(payload) {
  try {
    const response = await apiClient.post("/whatsapp/broadcast", payload);
    return response.data;
  } catch (error) {
    throw error;
  }
}
