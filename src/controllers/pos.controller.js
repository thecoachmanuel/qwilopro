import ApiClient from "../helpers/ApiClient";

const DRAFTS_KEY = "RESTROPROSAAS__DRAFTS";

export async function initPOS() {
    try {
      const response = await ApiClient.get("/pos/init");
      return response;
    } catch (error) {
      throw error;
    }
}

// Fields to strip from cart items and nested objects to keep payload small
const CART_STRIP_FIELDS = ['image', 'recipeItems', 'category', 'description', 'category_id'];

const sanitizeCartItem = (item) => {
  if (!item || typeof item !== 'object') return item;
  const clean = { ...item };
  CART_STRIP_FIELDS.forEach((f) => delete clean[f]);
  // Strip images from nested addons array
  if (Array.isArray(clean.addons)) {
    clean.addons = clean.addons.map((a) => {
      if (!a || typeof a !== 'object') return a;
      const { image, ...cleanAddon } = a;
      return cleanAddon;
    });
  }
  // Strip images from nested variants array
  if (Array.isArray(clean.variants)) {
    clean.variants = clean.variants.map((v) => {
      if (!v || typeof v !== 'object') return v;
      const { image, ...cleanVariant } = v;
      return cleanVariant;
    });
  }
  return clean;
};

const sanitizeCart = (cart) => {
  if (!Array.isArray(cart)) return cart;
  return cart.map(sanitizeCartItem);
};

export async function createOrder(cart, deliveryType, customerType, customerId, tableId, selectedQrOrderItem, deliveryFee = 0, deliveryAddress = "") {
  try {
    const cleanCart = sanitizeCart(cart);
    const response = await ApiClient.post("/pos/create-order", {
      cart: cleanCart, deliveryType, customerType, customerId, tableId, selectedQrOrderItem, deliveryFee, deliveryAddress
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function createOrderAndInvoice(cart, deliveryType, customerType, customerId, tableId, netTotal, taxTotal, serviceChargeTotal, total, selectedQrOrderItem, selectedPaymentType, deliveryFee = 0, deliveryAddress = "") {
  try {
    const cleanCart = sanitizeCart(cart);
    const response = await ApiClient.post("/pos/create-order-and-invoice", {
      cart: cleanCart, deliveryType, customerType, customerId, tableId,
      netTotal, taxTotal, serviceChargeTotal, total, selectedQrOrderItem, selectedPaymentType, deliveryFee, deliveryAddress
    });
    return response;
  } catch (error) {
    throw error;
  }
}


// drafts
/**
 * @returns {Array}
 *  */
export function getDrafts() {
  const draftsString = localStorage.getItem(DRAFTS_KEY);
  const drafts = draftsString ? JSON.parse(draftsString) : [];
  return drafts;
}

/**
 * @param {Array} drafts
 *  */
export function setDrafts(drafts) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}
// drafts

// qr orders
export async function getQROrdersCount() {
  try {
    const response = await ApiClient.get("/pos/qrorders/count");
    return response;
  } catch (error) {
    throw error;
  }
}
export async function getQROrders() {
  try {
    const response = await ApiClient.get("/pos/qrorders");
    return response;
  } catch (error) {
    throw error;
  }
}

export async function cancelAllQROrders() {
  try {
    const response = await ApiClient.post("/pos/qrorders/cancel-all");
    return response;
  } catch (error) {
    throw error;
  }
}

export async function cancelQROrder(orderId) {
  try {
    const response = await ApiClient.post(`/pos/qrorders/update-status/${orderId}`, {
      status: "cancelled"
    });
    return response;
  } catch (error) {
    throw error;
  }
}
// qr orders
