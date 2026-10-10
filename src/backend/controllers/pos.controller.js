const {
  getCategoriesDB,
  getPaymentTypesDB,
  getPrintSettingDB,
  getStoreSettingDB,
  getStoreTablesDB,
  getServiceChargeDB,
} = require("../services/settings.service");
const {
  getAllMenuItemsDB,
  getAllAddonsDB,
  getAllVariantsDB,
  getAllRecipeItemsDB,
} = require("../services/menu_item.service");
const { createOrderDB, getPOSQROrdersCountDB, getPOSQROrdersDB, updateQROrderStatusDB, cancelAllQROrdersDB } = require("../services/pos.service");
const { createInvoiceDB } = require("../services/orders.service");
const { getPrinterConfigsDB, addPrinterConfigDB, updatePrinterConfigDB, deletePrinterConfigDB } = require("../services/printer.service");
const { QROrder } = require("../models");

// In-memory cache for POS Init Data per tenant (30s TTL for instant repeated loads)
const posInitCache = new Map();
const POS_CACHE_TTL_MS = 30000;

exports.invalidatePOSInitCache = (tenantId) => {
  if (tenantId) {
    posInitCache.delete(Number(tenantId));
  } else {
    posInitCache.clear();
  }
};

exports.getPOSInitData = async (req, res) => {
  try {
    const tenantId = Number(req.user.tenant_id);

    // Check high-speed in-memory cache first
    const cachedEntry = posInitCache.get(tenantId);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < POS_CACHE_TTL_MS) {
      res.setHeader("Cache-Control", "private, max-age=5, stale-while-revalidate=30");
      return res.status(200).json(cachedEntry.data);
    }

    // Run ALL 11 database queries in a SINGLE parallel Promise.all batch
    const [
      categories,
      paymentTypes,
      printSettings,
      storeSettings,
      storeTables,
      serviceCharge,
      printerConfigs,
      menuItems,
      addons,
      variants,
      recipeItems,
    ] = await Promise.all([
      getCategoriesDB(tenantId),
      getPaymentTypesDB(true, tenantId),
      getPrintSettingDB(tenantId),
      getStoreSettingDB(tenantId),
      getStoreTablesDB(tenantId),
      getServiceChargeDB(tenantId),
      getPrinterConfigsDB(tenantId),
      getAllMenuItemsDB(tenantId),
      getAllAddonsDB(tenantId),
      getAllVariantsDB(tenantId),
      getAllRecipeItemsDB(tenantId),
    ]);

    // O(N) grouping via Maps instead of O(N*M) nested filter scans
    const addonsByItem = new Map();
    for (const addon of addons || []) {
      const key = addon.item_id;
      if (!addonsByItem.has(key)) addonsByItem.set(key, []);
      addonsByItem.get(key).push(addon);
    }

    const variantsByItem = new Map();
    for (const variant of variants || []) {
      const key = variant.item_id;
      if (!variantsByItem.has(key)) variantsByItem.set(key, []);
      variantsByItem.get(key).push(variant);
    }

    const recipesByItem = new Map();
    for (const recipe of recipeItems || []) {
      const key = recipe.menu_item_id;
      if (!recipesByItem.has(key)) recipesByItem.set(key, []);
      recipesByItem.get(key).push(recipe);
    }

    const formattedMenuItems = (menuItems || []).map((item) => ({
      ...item,
      addons: addonsByItem.get(item.id) || [],
      variants: variantsByItem.get(item.id) || [],
      recipeItems: recipesByItem.get(item.id) || [],
    }));

    const responseData = {
      categories: categories || [],
      paymentTypes: paymentTypes || [],
      printSettings: printSettings || null,
      storeSettings: storeSettings || null,
      storeTables: storeTables || [],
      menuItems: formattedMenuItems,
      serviceCharge: serviceCharge || null,
      printerConfigs: printerConfigs || [],
    };

    // Cache the assembled payload in memory
    posInitCache.set(tenantId, {
      timestamp: Date.now(),
      data: responseData,
    });

    res.setHeader("Cache-Control", "private, max-age=5, stale-while-revalidate=30");
    return res.status(200).json(responseData);
  } catch (error) {
    console.error("getPOSInitData Error:", error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username;
    const {cart, deliveryType, customerType, customerId, tableId, selectedQrOrderItem, deliveryFee, deliveryAddress} = req.body || {};

    if(!cart || cart.length === 0) {
      return res.status(400).json({
        success: false,
        message: req.__("cart_is_empty") // Translate message
      });
    }

    // Stock level advisory (non-blocking for POS cashier resilience)
    try {
      let allInsufficientIngredients = [];
      for (const item of cart) {
        const result = canPrepareMenuItem(item, item.quantity);
        if (result && result.length > 0) {
          allInsufficientIngredients = [...allInsufficientIngredients, ...result];
        }
      }
      if (allInsufficientIngredients.length > 0) {
        console.warn("Stock level advisory:", allInsufficientIngredients.map(i => `${i.itemTitle} needs ${i.requiredQty} ${i.ingredientTitle}`).join(", "));
      }
    } catch (stockErr) {
      console.warn("Stock advisory check warning:", stockErr);
    }

    const customerPhone = typeof customerId === 'object' ? (customerId?.phone || customerId?.id || customerId?.value || null) : (customerId || null);
    const validTableId = (tableId && !isNaN(Number(tableId))) ? Number(tableId) : null;
    const validCustomerType = String(customerType || "WALKIN").toUpperCase() === "CUSTOMER" ? "CUSTOMER" : "WALKIN";
    const safeDeliveryFee = Number(deliveryFee) || 0;

    let customTokenNo = null;
    const qrOrderId = typeof selectedQrOrderItem === 'object' && selectedQrOrderItem !== null
      ? (selectedQrOrderItem.id || selectedQrOrderItem.order_id)
      : selectedQrOrderItem;

    if (qrOrderId) {
      try {
        const qrOrder = await QROrder.findOne({ id: Number(qrOrderId), tenant_id: tenantId }).lean();
        if (qrOrder && qrOrder.token_no) {
          customTokenNo = qrOrder.token_no;
        }
      } catch (qrErr) {
        console.warn("Failed to lookup QR order token:", qrErr);
      }
    }

    const result = await createOrderDB(tenantId, cart, deliveryType, validCustomerType, customerPhone, validTableId, 'pending', null, username, safeDeliveryFee, deliveryAddress, customTokenNo);

    if(qrOrderId) {
      await updateQROrderStatusDB(tenantId, qrOrderId, "completed");
    }

    if (global.io && tenantId) {
      try {
        global.io.to(String(tenantId)).emit("new_order", {
          orderId: result.orderId,
          tokenNo: result.tokenNo,
        });
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      message: req.__("order_created_token", { token: result.tokenNo }), // Translate message
      tokenNo: result.tokenNo,
      orderId: result.orderId,
    });

  } catch (error) {
    console.error("createOrder Error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || req.__("error_processing_request_try_later") // Translate message
    });
  }
};


function canPrepareMenuItem(menuItem, quantity = 1) {
  if (!menuItem || !menuItem.recipeItems || !Array.isArray(menuItem.recipeItems) || menuItem.recipeItems.length === 0) {
    return [];
  }
  const selectedVariantId = menuItem.variant_id ? parseInt(menuItem.variant_id) : null;
  const selectedAddonIds = (menuItem.addons_ids || []).map(String);

  const relevantRecipeItems = (menuItem.recipeItems || []).filter((recipe) => {
    if (!recipe) return false;
    if (recipe.variant_id === 0 && recipe.addon_id === 0) return true;
    if (recipe.variant_id > 0 && recipe.variant_id == selectedVariantId) return true;
    if (recipe.addon_id > 0 && selectedAddonIds.includes(String(recipe.addon_id))) return true;
    return false;
  });

  const insufficientIngredients = [];

  for (const recipe of relevantRecipeItems) {
    const currentQty = parseFloat(recipe.current_quantity || 0);
    const requiredQty = parseFloat(recipe.recipe_quantity || 0) * (Number(quantity) || 1);
    if (!isNaN(currentQty) && !isNaN(requiredQty) && currentQty < requiredQty) {
      insufficientIngredients.push({
        itemTitle: menuItem.title,
        variantTitle: menuItem.variant?.title || '',
        addonTitle: recipe.addon_title || '',
        ingredientTitle: recipe.ingredient_title || 'Ingredient',
        requiredQty,
        currentQty,
      });
    }
  }

  return insufficientIngredients;
}

exports.createOrderAndInvoice = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username;
    const {cart, deliveryType, customerType, customerId, tableId, netTotal, taxTotal, serviceChargeTotal, total, selectedQrOrderItem, selectedPaymentType, deliveryFee, deliveryAddress} = req.body || {};

    if(!cart || cart.length === 0) {
      return res.status(400).json({
        success: false,
        message: req.__("cart_is_empty") // Translate message
      });
    }

    // Stock level advisory (non-blocking for POS cashier resilience)
    try {
      let allInsufficientIngredients = [];
      for (const item of cart) {
        const result = canPrepareMenuItem(item, item.quantity);
        if (result && result.length > 0) {
          allInsufficientIngredients = [...allInsufficientIngredients, ...result];
        }
      }
      if (allInsufficientIngredients.length > 0) {
        console.warn("Stock level advisory:", allInsufficientIngredients.map(i => `${i.itemTitle} needs ${i.requiredQty} ${i.ingredientTitle}`).join(", "));
      }
    } catch (stockErr) {
      console.warn("Stock advisory check warning:", stockErr);
    }

    // Safe numbers
    const safeNetTotal = Number(netTotal) || 0;
    const safeTaxTotal = Number(taxTotal) || 0;
    const safeServiceChargeTotal = Number(serviceChargeTotal) || 0;
    const safeDeliveryFee = Number(deliveryFee) || 0;
    const safeTotal = Number(total) || (safeNetTotal + safeTaxTotal + safeServiceChargeTotal + safeDeliveryFee);
    const rawPaymentId = typeof selectedPaymentType === 'object' && selectedPaymentType !== null
      ? (selectedPaymentType.id || selectedPaymentType.value || 1)
      : selectedPaymentType;
    const safePaymentType = !isNaN(Number(rawPaymentId)) && Number(rawPaymentId) > 0 ? Number(rawPaymentId) : 1;

    // create invoice
    const now = new Date();
    const date = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    const invoiceId = await createInvoiceDB(safeNetTotal, safeTaxTotal, safeServiceChargeTotal, safeTotal, date, safePaymentType, tenantId, username);
    // create invoice

    const customerPhone = typeof customerId === 'object' ? (customerId?.phone || customerId?.id || customerId?.value || null) : (customerId || null);
    const validTableId = (tableId && !isNaN(Number(tableId))) ? Number(tableId) : null;
    const validCustomerType = String(customerType || "WALKIN").toUpperCase() === "CUSTOMER" ? "CUSTOMER" : "WALKIN";

    let customTokenNo = null;
    const qrOrderId = typeof selectedQrOrderItem === 'object' && selectedQrOrderItem !== null
      ? (selectedQrOrderItem.id || selectedQrOrderItem.order_id)
      : selectedQrOrderItem;

    if (qrOrderId) {
      try {
        const qrOrder = await QROrder.findOne({ id: Number(qrOrderId), tenant_id: tenantId }).lean();
        if (qrOrder && qrOrder.token_no) {
          customTokenNo = qrOrder.token_no;
        }
      } catch (qrErr) {
        console.warn("Failed to lookup QR order token:", qrErr);
      }
    }

    const result = await createOrderDB(tenantId, cart, deliveryType, validCustomerType, customerPhone, validTableId, 'paid', invoiceId, username, safeDeliveryFee, deliveryAddress, customTokenNo);
    const orderId = result.orderId;
    const tokenNo = result.tokenNo;

    if(qrOrderId) {
      await updateQROrderStatusDB(tenantId, qrOrderId, "completed");
    }

    if (global.io && tenantId) {
      try {
        global.io.to(String(tenantId)).emit("new_order", {
          orderId,
          tokenNo,
          invoiceId,
        });
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      message: req.__("order_created_token", { token: tokenNo }), // Translate message
      tokenNo,
      orderId,
      invoiceId
    });

  } catch (error) {
    console.error("createOrderAndInvoice Error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || req.__("error_processing_request_try_later") // Translate message
    });
  }
};

exports.getPOSQROrdersCount = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    const totalQROrders = await getPOSQROrdersCountDB(tenantId);
    return res.status(200).json({
      status: true,
      totalQROrders: totalQROrders
    })
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.getPOSQROrders = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    const { kitchenOrders, kitchenOrdersItems, addons } = await getPOSQROrdersDB(tenantId);

    const formattedOrders = kitchenOrders.map((order)=>{
      const orderItems = kitchenOrdersItems.filter((oi)=>oi.order_id == order.id);

      orderItems.forEach((oi, index)=>{
        const addonsIds = oi?.addons ? JSON.parse(oi?.addons) : null;

        if(addonsIds) {
          const itemAddons = addonsIds.map((addonId)=>{
            const addon = addons.filter((a)=>a.id == addonId);
            return addon[0];
          });
          orderItems[index].addons = [...itemAddons];
        }
      });

      return {
        ...order,
        items: orderItems
      }
    })

    return res.status(200).json(formattedOrders)
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.updatePOSQROrderStatus = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const orderId = req.params.id;
    const status = req.body.status;

    if(!status) {
      return res.status(400).json({
        success: false,
        message: req.__("please_provide_required_details") // Translate message
      });
    }

    await updateQROrderStatusDB(tenantId, orderId, status);
    return res.status(200).json({
      status: true,
      message: req.__("qr_order_item_status_updated") // Translate message
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.cancelAllQROrders = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const status = 'cancelled';

    await cancelAllQROrdersDB(tenantId, status);
    return res.status(200).json({
      status: true,
      message: req.__("all_qr_order_items_cleared") // Translate message
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

// ─── Printer Config CRUD ──────────────────────────────────

exports.addPrinterConfig = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { name, transport, address, paper_size, is_default, is_kot_printer, auto_cut } = req.body;

    if (!name || !transport || !address) {
      return res.status(400).json({ success: false, message: 'Name, transport, and address are required.' });
    }

    const id = await addPrinterConfigDB(tenantId, { name, transport, address, paper_size, is_default, is_kot_printer, auto_cut });

    // Return the full updated list so the client can sync
    const printerConfigs = await getPrinterConfigsDB(tenantId);

    return res.status(200).json({ success: true, id, printerConfigs });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.updatePrinterConfig = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const printerId = req.params.id;
    const updates = req.body;

    await updatePrinterConfigDB(tenantId, printerId, updates);

    const printerConfigs = await getPrinterConfigsDB(tenantId);
    return res.status(200).json({ success: true, printerConfigs });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.deletePrinterConfig = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const printerId = req.params.id;

    await deletePrinterConfigDB(tenantId, printerId);

    const printerConfigs = await getPrinterConfigsDB(tenantId);
    return res.status(200).json({ success: true, printerConfigs });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};
