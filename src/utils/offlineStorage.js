/**
 * Offline Storage & Queue Manager for QwiloPro POS
 * Enables 100% smooth business operations even when internet / data drops,
 * while strictly safeguarding SaaS subscription validity and plan feature gating.
 */
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { createOrder, createOrderAndInvoice } from "../controllers/pos.controller";
import toast from "react-hot-toast";

const POS_CACHE_KEY = "RESTROPROSAAS__POS_CACHE";
const ORDERS_CACHE_KEY = "RESTROPROSAAS__ORDERS_CACHE";
const OFFLINE_ORDERS_QUEUE_KEY = "RESTROPROSAAS__OFFLINE_ORDERS_QUEUE";
const OFFLINE_TOKEN_COUNTER_KEY = "RESTROPROSAAS__OFFLINE_TOKEN_COUNTER";

function getTenantSuffix() {
  const user = getUserDetailsInLocalStorage();
  return user?.tenant_id ? `_t${user.tenant_id}` : "";
}

function getPosCacheKey() {
  return POS_CACHE_KEY + getTenantSuffix();
}

function getOrdersCacheKey() {
  return ORDERS_CACHE_KEY + getTenantSuffix();
}

function getOfflineQueueKey() {
  return OFFLINE_ORDERS_QUEUE_KEY + getTenantSuffix();
}

function getTokenCounterKey() {
  return OFFLINE_TOKEN_COUNTER_KEY + getTenantSuffix();
}

// Anti-tamper: Maximum 7 days offline lease allowed before requiring online server check
const MAX_OFFLINE_LEASE_DAYS = 7;

/**
 * Check if browser has active connectivity
 */
export function isAppOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

/**
 * Validate that the tenant has an active, unexpired subscription before allowing offline operations.
 * Prevents revenue loss from cancelled/expired tenants running the POS offline indefinitely.
 */
export function validateOfflineSubscription() {
  const user = getUserDetailsInLocalStorage();
  if (!user) {
    return { valid: false, reason: "No user session found. Please log in online." };
  }

  // SuperAdmin has full unrestricted access
  if (user.role === "superadmin") {
    return { valid: true };
  }

  // 1. Check account active status
  if (Number(user.is_active) !== 1) {
    return {
      valid: false,
      reason: "Your subscription is inactive. Please connect to the internet to activate your subscription.",
    };
  }

  // 2. Check subscription expiration date
  if (user.subscription_end) {
    const expiryTime = new Date(user.subscription_end).getTime();
    const nowTime = new Date().setHours(0, 0, 0, 0);
    if (expiryTime < nowTime) {
      return {
        valid: false,
        reason: "Your subscription has expired. Please reconnect to the internet to renew your subscription.",
      };
    }
  }

  // 3. Check anti-tamper offline lease duration
  const cachedData = getPOSSnapshot();
  if (cachedData?.cachedAt) {
    const lastOnlineTime = new Date(cachedData.cachedAt).getTime();
    const elapsedMs = Date.now() - lastOnlineTime;
    const maxLeaseMs = MAX_OFFLINE_LEASE_DAYS * 24 * 60 * 60 * 1000;
    if (elapsedMs > maxLeaseMs) {
      return {
        valid: false,
        reason: `Maximum offline lease exceeded (${MAX_OFFLINE_LEASE_DAYS} days). Please reconnect to the internet to verify your subscription with the server.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate feature accessibility in offline mode based on tenant plan
 */
export function validateOfflineFeatureAccess(featureName) {
  const user = getUserDetailsInLocalStorage();
  if (!user) return false;
  if (user.role === "superadmin") return true;

  const rawFeatures =
    user?.planFeatures || user?.planFeautures || user?.plan_features || user?.features;
  let features = [];
  if (Array.isArray(rawFeatures)) {
    features = rawFeatures.map((f) => String(f).trim().toUpperCase());
  } else if (typeof rawFeatures === "string") {
    try {
      const p = JSON.parse(rawFeatures);
      features = Array.isArray(p) ? p.map((f) => String(f).trim().toUpperCase()) : [String(rawFeatures).trim().toUpperCase()];
    } catch {
      features = rawFeatures.split(",").map((f) => f.trim().toUpperCase());
    }
  }

  // Default starter features fallback for admin
  if (user.role === "admin" && features.length === 0) {
    features = ["DASHBOARD", "POS", "ORDERS", "INVOICES", "SETTINGS", "REPORTS", "USER"];
  }

  const normalized = String(featureName).trim().toUpperCase();
  return features.includes(normalized);
}

/**
 * Save POS master data snapshot (categories, items, tables, taxes, settings)
 */
export function savePOSSnapshot(data) {
  if (typeof localStorage === "undefined" || !data) return;
  try {
    const payload = {
      ...data,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(getPosCacheKey(), JSON.stringify(payload));
  } catch (err) {
    console.warn("Failed to cache POS snapshot:", err);
  }
}

/**
 * Retrieve cached POS master data snapshot
 */
export function getPOSSnapshot() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(getPosCacheKey()) || localStorage.getItem(POS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("Failed to parse cached POS snapshot:", err);
    return null;
  }
}

/**
 * Save orders page snapshot
 */
export function saveOrdersSnapshot(orders, ordersInit) {
  if (typeof localStorage === "undefined") return;
  try {
    const payload = {
      orders: orders || [],
      ordersInit: ordersInit || {},
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(getOrdersCacheKey(), JSON.stringify(payload));
  } catch (err) {
    console.warn("Failed to cache orders snapshot:", err);
  }
}

/**
 * Retrieve cached orders snapshot
 */
export function getOrdersSnapshot() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(getOrdersCacheKey()) || localStorage.getItem(ORDERS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("Failed to parse cached orders snapshot:", err);
    return null;
  }
}

/**
 * Get all queued offline orders
 */
export function getOfflineOrdersQueue() {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(getOfflineQueueKey()) || localStorage.getItem(OFFLINE_ORDERS_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Failed to read offline orders queue:", err);
    return [];
  }
}

/**
 * Get count of pending offline orders
 */
export function getOfflineOrdersCount() {
  return getOfflineOrdersQueue().length;
}

/**
 * Get next sequential offline token number
 */
function getNextOfflineToken() {
  if (typeof localStorage === "undefined") return "OFF-001";
  try {
    const key = getTokenCounterKey();
    let current = parseInt(localStorage.getItem(key) || localStorage.getItem(OFFLINE_TOKEN_COUNTER_KEY) || "100", 10);
    if (isNaN(current) || current > 9999) current = 100;
    const next = current + 1;
    localStorage.setItem(key, String(next));
    return `OFF-${next}`;
  } catch {
    return `OFF-${Math.floor(100 + Math.random() * 900)}`;
  }
}

/**
 * Save an order to the offline queue with strict subscription validity enforcement
 */
export function saveOfflineOrder(orderData) {
  // Validate subscription before accepting offline order to prevent fund loss
  const subscriptionCheck = validateOfflineSubscription();
  if (!subscriptionCheck.valid) {
    return {
      success: false,
      error: subscriptionCheck.reason,
      isBlocked: true,
    };
  }

  const localOrderId = `OFFLINE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const tokenNo = getNextOfflineToken();

  const queuedOrder = {
    ...orderData,
    localOrderId,
    tokenNo,
    status: "pending_sync",
    createdAt: new Date().toISOString(),
  };

  const queue = getOfflineOrdersQueue();
  queue.push(queuedOrder);

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(getOfflineQueueKey(), JSON.stringify(queue));
    } catch (err) {
      console.error("Failed to save offline order to localStorage:", err);
    }
  }

  // Notify components about queue change
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("restro_offline_orders_changed", {
        detail: { count: queue.length, order: queuedOrder },
      })
    );
  }

  // Schedule auto-sync if internet is detected
  if (typeof window !== "undefined" && isAppOnline()) {
    setTimeout(() => {
      autoSyncOfflineOrders();
    }, 2500);
  }

  return {
    success: true,
    orderId: localOrderId,
    tokenNo,
    isOffline: true,
  };
}

/**
 * Remove a successfully synced order from the queue
 */
export function removeOfflineOrder(localOrderId) {
  const queue = getOfflineOrdersQueue().filter((o) => o.localOrderId !== localOrderId);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(getOfflineQueueKey(), JSON.stringify(queue));
    } catch (err) {}
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("restro_offline_orders_changed", {
        detail: { count: queue.length },
      })
    );
  }
  return queue;
}

/**
 * Clear the entire offline orders queue
 */
export function clearOfflineOrdersQueue() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(getOfflineQueueKey());
    localStorage.removeItem(OFFLINE_ORDERS_QUEUE_KEY);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("restro_offline_orders_changed", {
        detail: { count: 0 },
      })
    );
  }
}

let isSyncing = false;

/**
 * Synchronize all pending offline orders with the server
 */
export async function syncOfflineOrders(createOrderAndInvoiceFn, createOrderFn) {
  const invoiceFn = createOrderAndInvoiceFn || createOrderAndInvoice;
  const orderFn = createOrderFn || createOrder;

  if (isSyncing) return { inProgress: true };
  if (!isAppOnline()) return { offline: true };

  const queue = getOfflineOrdersQueue();
  if (queue.length === 0) return { total: 0, synced: 0, failed: 0, remaining: 0 };

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    for (const order of queue) {
      try {
        let res;
        if (order.type === "order_and_invoice") {
          res = await invoiceFn(
            order.cart,
            order.deliveryType,
            order.customerType,
            order.customerId,
            order.tableId,
            order.netTotal,
            order.taxTotal,
            order.serviceChargeTotal,
            order.payableTotal,
            null, // selectedQrOrderItem
            order.selectedPaymentType
          );
        } else {
          res = await orderFn(
            order.cart,
            order.deliveryType,
            order.customerType,
            order.customerId,
            order.tableId,
            null // selectedQrOrderItem
          );
        }

        if (res && (res.status === 200 || res.status === 201)) {
          removeOfflineOrder(order.localOrderId);
          synced += 1;
        } else {
          failed += 1;
        }
      } catch (err) {
        console.error("Failed to sync offline order:", order.localOrderId, err);
        failed += 1;
        // If server returned 402 Payment Required or 403 Forbidden, subscription expired!
        if (err?.response?.status === 402 || err?.response?.status === 403) {
          console.warn("Tenant subscription expired during offline sync.");
          break;
        }
        // If network disconnects mid-sync, halt until connection returns
        if (!err.response || err.code === "ERR_NETWORK") {
          break;
        }
      }
    }
  } finally {
    isSyncing = false;
  }

  const remaining = getOfflineOrdersCount();

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("restro_offline_orders_synced", {
        detail: { synced, failed, remaining },
      })
    );
  }

  return { total: queue.length, synced, failed, remaining };
}

/**
 * Automatically syncs offline orders in background without user having to click any button
 */
export async function autoSyncOfflineOrders() {
  if (isSyncing) return;
  if (!isAppOnline()) return;

  const count = getOfflineOrdersCount();
  if (count === 0) return;

  try {
    const res = await syncOfflineOrders();
    if (res && res.synced > 0) {
      if (typeof window !== "undefined") {
        toast.success(
          `Cloud sync complete! ${res.synced} offline order${res.synced > 1 ? "s" : ""} automatically synced.`,
          { id: "offline-auto-sync-success", duration: 5000, icon: "✅" }
        );
      }
    }
  } catch (err) {
    console.error("Background auto-sync failed:", err);
  }
}

let isAutoSyncInitialized = false;

/**
 * Initialize automatic listeners to auto-sync whenever internet is restored or window is focused
 */
export function initAutoSyncListener() {
  if (typeof window === "undefined" || isAutoSyncInitialized) return;
  isAutoSyncInitialized = true;

  // 1. Immediately trigger when internet connection comes back online
  window.addEventListener("online", () => {
    console.log("[QwiloPro POS] Reconnected to internet. Auto-syncing pending orders...");
    setTimeout(() => {
      autoSyncOfflineOrders();
    }, 1200);
  });

  // 2. Trigger when user returns to window tab
  window.addEventListener("focus", () => {
    if (isAppOnline() && getOfflineOrdersCount() > 0) {
      autoSyncOfflineOrders();
    }
  });

  // 3. Heartbeat check every 20 seconds to guarantee no orders remain un-synced
  setInterval(() => {
    if (isAppOnline() && getOfflineOrdersCount() > 0) {
      autoSyncOfflineOrders();
    }
  }, 20000);

  // 4. Initial check upon app startup
  if (isAppOnline() && getOfflineOrdersCount() > 0) {
    setTimeout(() => {
      autoSyncOfflineOrders();
    }, 2000);
  }
}

// Auto-activate listener in browser
if (typeof window !== "undefined") {
  initAutoSyncListener();
}
