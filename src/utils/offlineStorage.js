/**
 * Offline Storage & Queue Manager for QwiloPro POS
 * Enables 100% smooth business operations even when internet / data drops.
 */

const POS_CACHE_KEY = "RESTROPROSAAS__POS_CACHE";
const ORDERS_CACHE_KEY = "RESTROPROSAAS__ORDERS_CACHE";
const OFFLINE_ORDERS_QUEUE_KEY = "RESTROPROSAAS__OFFLINE_ORDERS_QUEUE";
const OFFLINE_TOKEN_COUNTER_KEY = "RESTROPROSAAS__OFFLINE_TOKEN_COUNTER";

/**
 * Check if browser has active connectivity
 */
export function isAppOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
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
    localStorage.setItem(POS_CACHE_KEY, JSON.stringify(payload));
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
    const raw = localStorage.getItem(POS_CACHE_KEY);
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
    localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(payload));
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
    const raw = localStorage.getItem(ORDERS_CACHE_KEY);
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
    const raw = localStorage.getItem(OFFLINE_ORDERS_QUEUE_KEY);
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
    let current = parseInt(localStorage.getItem(OFFLINE_TOKEN_COUNTER_KEY) || "100", 10);
    if (isNaN(current) || current > 9999) current = 100;
    const next = current + 1;
    localStorage.setItem(OFFLINE_TOKEN_COUNTER_KEY, String(next));
    return `OFF-${next}`;
  } catch {
    return `OFF-${Math.floor(100 + Math.random() * 900)}`;
  }
}

/**
 * Save an order to the offline queue
 */
export function saveOfflineOrder(orderData) {
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
      localStorage.setItem(OFFLINE_ORDERS_QUEUE_KEY, JSON.stringify(queue));
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

  return {
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
      localStorage.setItem(OFFLINE_ORDERS_QUEUE_KEY, JSON.stringify(queue));
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
  if (isSyncing) return { inProgress: true };
  if (!isAppOnline()) return { offline: true };

  const queue = getOfflineOrdersQueue();
  if (queue.length === 0) return { total: 0, synced: 0, failed: 0 };

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    for (const order of queue) {
      try {
        let res;
        if (order.type === "order_and_invoice") {
          res = await createOrderAndInvoiceFn(
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
          res = await createOrderFn(
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
        // If server is unreachable, stop trying remainder until next retry
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
