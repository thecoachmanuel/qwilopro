const crypto = require("crypto");
const { CONFIG } = require("../config");
const {
  Order,
  OrderItem,
  Customer,
  StoreTable,
  MenuItem,
  MenuItemVariant,
  MenuItemAddon,
  Tax,
  Invoice,
  QROrder,
  QROrderItem,
} = require("../models");
const { getNextSequenceValue } = require("../db/counter");

const encryptInvoiceId = (id) => {
  try {
    const key = crypto.createHash("sha256").update(CONFIG.ENCRYPTION_KEY).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(String(id), "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + encrypted;
  } catch {
    return String(id);
  }
};

const decryptInvoiceId = (encryptedId) => {
  if (!encryptedId) return null;
  if (!isNaN(encryptedId)) return Number(encryptedId);
  try {
    const key = crypto.createHash("sha256").update(CONFIG.ENCRYPTION_KEY).digest();
    const iv = Buffer.from(encryptedId.slice(0, 32), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedId.slice(32), "hex", "utf8");
    decrypted += decipher.final("utf8");
    return Number(decrypted);
  } catch {
    return Number(encryptedId) || null;
  }
};

exports.getOrdersDB = async (tenantId) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const rawOrders = await Order.find({
      tenant_id: tenantId,
      $or: [
        { status: { $nin: ["completed", "cancelled"] }, date: { $gte: sevenDaysAgo } },
        { status: "completed", date: { $gte: todayStart } },
      ],
    }).sort({ id: -1 }).lean();

    const customerIds = rawOrders.map((o) => o.customer_id).filter(Boolean);
    const tableIds = rawOrders.map((o) => o.table_id).filter(Boolean);

    const [customers, tables] = await Promise.all([
      Customer.find({ phone: { $in: customerIds }, tenant_id: tenantId }).select("phone name").lean(),
      StoreTable.find({ id: { $in: tableIds }, tenant_id: tenantId }).select("id table_title floor").lean(),
    ]);

    const customerMap = new Map(customers.map((c) => [c.phone, c.name]));
    const tableMap = new Map(tables.map((t) => [t.id, t]));

    const kitchenOrders = rawOrders.map((o) => {
      const table = tableMap.get(o.table_id);
      return {
        id: o.id,
        date: o.date,
        delivery_type: o.delivery_type,
        customer_type: o.customer_type,
        customer_id: o.customer_id,
        customer_name: customerMap.get(o.customer_id) || "Walk-in Customer",
        table_id: o.table_id,
        table_title: table?.table_title || null,
        floor: table?.floor || null,
        status: o.status,
        payment_status: o.payment_status,
        token_no: o.token_no,
        delivery_fee: o.delivery_fee || 0,
        delivery_address: o.delivery_address || null,
        invoice_id: o.invoice_id || null,
        created_by: o.created_by || null,
      };
    });

    let kitchenOrdersItems = [];
    let addons = [];

    if (kitchenOrders.length > 0) {
      const orderIds = kitchenOrders.map((o) => o.id);
      const rawItems = await OrderItem.find({ order_id: { $in: orderIds }, tenant_id: tenantId }).lean();

      const itemIds = rawItems.map((i) => i.item_id);
      const [menuItems, variants] = await Promise.all([
        MenuItem.find({ id: { $in: itemIds }, tenant_id: tenantId }).select("id title").lean(),
        MenuItemVariant.find({ item_id: { $in: itemIds }, tenant_id: tenantId }).select("id item_id title").lean(),
      ]);

      const menuItemMap = new Map(menuItems.map((m) => [m.id, m.title]));
      const variantMap = new Map(variants.map((v) => [`${v.item_id}_${v.id}`, v.title]));

      kitchenOrdersItems = rawItems.map((oi) => ({
        id: oi.id,
        order_id: oi.order_id,
        item_id: oi.item_id,
        item_title: menuItemMap.get(oi.item_id) || "",
        variant_id: oi.variant_id,
        variant_title: oi.variant_id ? variantMap.get(`${oi.item_id}_${oi.variant_id}`) || null : null,
        price: oi.price,
        quantity: oi.quantity,
        status: oi.status,
        date: oi.date,
        addons: oi.addons,
        notes: oi.notes,
      }));

      const allAddonIds = [
        ...new Set(
          kitchenOrdersItems.flatMap((o) => {
            try {
              return o.addons ? JSON.parse(o.addons) : [];
            } catch {
              return [];
            }
          })
        ),
      ];

      if (allAddonIds.length > 0) {
        addons = await MenuItemAddon.find({ id: { $in: allAddonIds }, tenant_id: tenantId })
          .select("id item_id title")
          .lean();
      }
    }

    return {
      kitchenOrders,
      kitchenOrdersItems,
      addons,
    };
  } catch (error) {
    console.error("getOrdersDB Error:", error);
    throw error;
  }
};

exports.updateOrderItemStatusDB = async (orderItemId, status, tenantId) => {
  try {
    await OrderItem.updateOne({ id: orderItemId, tenant_id: tenantId }, { $set: { status } });
  } catch (error) {
    console.error("updateOrderItemStatusDB Error:", error);
    throw error;
  }
};

exports.cancelOrderDB = async (orderIds, tenantId) => {
  try {
    const rawIds = Array.isArray(orderIds) ? orderIds : [orderIds];
    const numericIds = rawIds.map(Number).filter((n) => !isNaN(n));
    const combinedIds = [...new Set([...rawIds, ...numericIds])];
    await Order.updateMany(
      { id: { $in: combinedIds }, tenant_id: tenantId },
      { $set: { status: "cancelled" } }
    );
    await OrderItem.updateMany(
      { order_id: { $in: combinedIds }, tenant_id: tenantId },
      { $set: { status: "cancelled" } }
    );
  } catch (error) {
    console.error("cancelOrderDB Error:", error);
    throw error;
  }
};

exports.completeOrderDB = async (orderIds, tenantId) => {
  try {
    const rawIds = Array.isArray(orderIds) ? orderIds : [orderIds];
    const numericIds = rawIds.map(Number).filter((n) => !isNaN(n));
    const combinedIds = [...new Set([...rawIds, ...numericIds])];
    await Order.updateMany(
      { id: { $in: combinedIds }, tenant_id: tenantId },
      { $set: { status: "completed" } }
    );
    await OrderItem.updateMany(
      { order_id: { $in: combinedIds }, tenant_id: tenantId },
      { $set: { status: "completed" } }
    );
  } catch (error) {
    console.error("completeOrderDB Error:", error);
    throw error;
  }
};

exports.getInvoiceIdFromOrderIdsDB = async (orderIds, tenantId) => {
  try {
    const rawIds = Array.isArray(orderIds) ? orderIds : [orderIds];
    const numericIds = rawIds.map(Number).filter((n) => !isNaN(n));
    const combinedIds = [...new Set([...rawIds, ...numericIds])];
    const order = await Order.findOne({ id: { $in: combinedIds }, tenant_id: tenantId }).select("invoice_id customer_id").lean();
    if (!order) return null;

    return {
      invoice_id: encryptInvoiceId(order.invoice_id),
      customer_id: order.customer_id,
    };
  } catch (error) {
    console.error("getInvoiceIdFromOrderIdsDB Error:", error);
    throw error;
  }
};

exports.getEncryptedInvoiceIdDB = async (invoiceId, tenantId) => {
  try {
    const validInvoiceId = Number(invoiceId) || invoiceId;
    const order = await Order.findOne({ invoice_id: validInvoiceId, tenant_id: tenantId }).select("invoice_id customer_id").lean();
    if (!order) {
      return {
        invoice_id: encryptInvoiceId(validInvoiceId),
        customer_id: null,
      };
    }

    return {
      invoice_id: encryptInvoiceId(order.invoice_id),
      customer_id: order.customer_id,
    };
  } catch (error) {
    console.error("getEncryptedInvoiceIdDB Error:", error);
    throw error;
  }
};

exports.encryptInvoiceId = encryptInvoiceId;
exports.decryptInvoiceId = decryptInvoiceId;

exports.checkInvoiceIdDB = async (encryptedInvoiceId) => {
  try {
    if (!encryptedInvoiceId) return { invoice_id: null, customer_id: null };
    const decryptedId = decryptInvoiceId(encryptedInvoiceId);
    if (!decryptedId) return { invoice_id: null, customer_id: null };

    const order = await Order.findOne({ invoice_id: decryptedId }).select("invoice_id customer_id").lean();
    if (order) return order;

    const { QROrder } = require("../models");
    const qrOrder = await QROrder.findOne({ id: decryptedId }).select("id customer_id").lean();
    if (qrOrder) return { invoice_id: qrOrder.id, customer_id: qrOrder.customer_id };

    return { invoice_id: decryptedId, customer_id: null };
  } catch (error) {
    console.error("checkInvoiceIdDB Error:", error);
    return { invoice_id: null, customer_id: null };
  }
};

exports.getOrdersPaymentSummaryDB = async (orderIdsToFindSummary, tenantId) => {
  try {
    const rawIds = Array.isArray(orderIdsToFindSummary)
      ? orderIdsToFindSummary
      : String(orderIdsToFindSummary).split(",").map((s) => s.trim());
    const numericIds = rawIds.map(Number).filter((n) => !isNaN(n));
    const combinedIds = [...new Set([...rawIds, ...numericIds])];

    const rawOrders = await Order.find({
      id: { $in: combinedIds },
      tenant_id: tenantId,
    }).lean();

    const customerIds = rawOrders.map((o) => o.customer_id).filter(Boolean);
    const tableIds = rawOrders.map((o) => o.table_id).filter(Boolean);

    const [customers, tables] = await Promise.all([
      Customer.find({ phone: { $in: customerIds }, tenant_id: tenantId }).select("phone name").lean(),
      StoreTable.find({ id: { $in: tableIds }, tenant_id: tenantId }).select("id table_title floor").lean(),
    ]);

    const customerMap = new Map(customers.map((c) => [c.phone, c.name]));
    const tableMap = new Map(tables.map((t) => [t.id, t]));

    const kitchenOrders = rawOrders.map((o) => {
      const table = tableMap.get(o.table_id);
      return {
        id: o.id,
        date: o.date,
        delivery_type: o.delivery_type,
        customer_type: o.customer_type,
        customer_id: o.customer_id,
        customer_name: customerMap.get(o.customer_id) || "Walk-in Customer",
        table_id: o.table_id,
        table_title: table?.table_title || null,
        floor: table?.floor || null,
        status: o.status,
        payment_status: o.payment_status,
        token_no: o.token_no,
      };
    });

    let kitchenOrdersItems = [];
    let addons = [];

    if (kitchenOrders.length > 0) {
      const orderIds = kitchenOrders.map((o) => o.id);
      const rawItems = await OrderItem.find({
        order_id: { $in: orderIds },
        tenant_id: tenantId,
        status: { $ne: "cancelled" },
      }).lean();

      const itemIds = rawItems.map((i) => i.item_id);
      const menuItems = await MenuItem.find({ id: { $in: itemIds }, tenant_id: tenantId }).lean();
      const taxIds = menuItems.map((m) => m.tax_id).filter(Boolean);
      const taxes = await Tax.find({ id: { $in: taxIds }, tenant_id: tenantId }).lean();
      const variants = await MenuItemVariant.find({ item_id: { $in: itemIds }, tenant_id: tenantId }).lean();

      const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));
      const taxMap = new Map(taxes.map((t) => [t.id, t]));
      const variantMap = new Map(variants.map((v) => [`${v.item_id}_${v.id}`, v]));

      kitchenOrdersItems = rawItems.map((oi) => {
        const mi = menuItemMap.get(oi.item_id);
        const tax = mi?.tax_id ? taxMap.get(mi.tax_id) : null;
        const variant = oi.variant_id ? variantMap.get(`${oi.item_id}_${oi.variant_id}`) : null;

        return {
          id: oi.id,
          order_id: oi.order_id,
          item_id: oi.item_id,
          item_title: mi?.title || "",
          variant_id: oi.variant_id,
          variant_title: variant?.title || null,
          variant_price: variant?.price || 0,
          price: mi?.price || oi.price,
          tax_id: mi?.tax_id || null,
          tax_title: tax?.title || null,
          tax_rate: tax?.rate || 0,
          tax_type: tax?.type || "other",
          quantity: oi.quantity,
          status: oi.status,
          date: oi.date,
          addons: oi.addons,
          notes: oi.notes,
        };
      });

      const allAddonIds = [
        ...new Set(
          kitchenOrdersItems.flatMap((o) => {
            try {
              return o.addons ? JSON.parse(o.addons) : [];
            } catch {
              return [];
            }
          })
        ),
      ];

      if (allAddonIds.length > 0) {
        const numericIds = allAddonIds.map(Number).filter((n) => !isNaN(n));
        const combined = [...new Set([...allAddonIds, ...numericIds])];
        addons = await MenuItemAddon.find({ id: { $in: combined }, tenant_id: tenantId })
          .select("id item_id title price")
          .lean();
      }
    }

    return {
      kitchenOrders,
      kitchenOrdersItems,
      addons,
    };
  } catch (error) {
    console.error("getOrdersPaymentSummaryDB Error:", error);
    throw error;
  }
};

exports.createInvoiceDB = async (
  subtotal,
  taxTotal,
  serviceChargeTotal,
  total,
  date,
  selectedPaymentType,
  tenantId,
  username = null
) => {
  try {
    const key = `invoice_tenant_${tenantId}`;
    let invoiceId = await getNextSequenceValue(key);

    // Guard against collision with pre-existing invoice IDs
    let exists = await Invoice.findOne({ id: invoiceId, tenant_id: tenantId });
    while (exists) {
      invoiceId = await getNextSequenceValue(key);
      exists = await Invoice.findOne({ id: invoiceId, tenant_id: tenantId });
    }

    const rawPaymentTypeId = typeof selectedPaymentType === 'object' && selectedPaymentType !== null
      ? (selectedPaymentType.id || selectedPaymentType.value || 1)
      : selectedPaymentType;
    const safePaymentTypeId = !isNaN(Number(rawPaymentTypeId)) && Number(rawPaymentTypeId) > 0 ? Number(rawPaymentTypeId) : 1;

    await Invoice.create({
      id: invoiceId,
      sub_total: Number(subtotal) || 0,
      tax_total: Number(taxTotal) || 0,
      service_charge_total: Number(serviceChargeTotal) || 0,
      total: Number(total) || 0,
      created_at: date ? new Date(date) : new Date(),
      payment_type_id: safePaymentTypeId,
      tenant_id: tenantId,
      created_by: username,
    });

    return invoiceId;
  } catch (error) {
    console.error("createInvoiceDB Error:", error);
    throw error;
  }
};

exports.completeOrdersAndSaveInvoiceIdDB = async (orderIds, invoiceId, tenantId) => {
  try {
    const rawIds = Array.isArray(orderIds) ? orderIds : [orderIds];
    const numericIds = rawIds.map(Number).filter((n) => !isNaN(n));
    const combinedIds = [...new Set([...rawIds, ...numericIds])];
    const validInvoiceId = Number(invoiceId) || invoiceId;
    await Order.updateMany(
      { id: { $in: combinedIds }, tenant_id: tenantId },
      { $set: { status: "completed", payment_status: "paid", invoice_id: validInvoiceId } }
    );
    await OrderItem.updateMany(
      { order_id: { $in: combinedIds }, tenant_id: tenantId },
      { $set: { status: "completed" } }
    );
  } catch (error) {
    console.error("completeOrdersAndSaveInvoiceIdDB Error:", error);
    throw error;
  }
};

/**
 * Get full detail of a single POS order (kitchen/orders view):
 * includes items with addon titles, variant titles, customer info,
 * table info, delivery address, and time placed.
 */
exports.getOrderDetailDB = async (orderId, tenantId) => {
  try {
    let order = await Order.findOne({ id: Number(orderId), tenant_id: tenantId }).lean();
    let isQROrder = false;

    if (!order) {
      order = await QROrder.findOne({ id: Number(orderId), tenant_id: tenantId }).lean();
      if (!order) return null;
      isQROrder = true;
    }

    const [items, customerArr, tableArr] = await Promise.all([
      isQROrder
        ? QROrderItem.find({ order_id: order.id, tenant_id: tenantId }).lean()
        : OrderItem.find({ order_id: order.id, tenant_id: tenantId }).lean(),
      order.customer_id
        ? Customer.find({ phone: order.customer_id, tenant_id: tenantId }).select("phone name email").lean()
        : Promise.resolve([]),
      order.table_id
        ? StoreTable.find({ id: order.table_id, tenant_id: tenantId }).select("id table_title floor").lean()
        : Promise.resolve([]),
    ]);

    const customer = customerArr[0] || null;
    const table = tableArr[0] || null;

    const itemIds = items.map((i) => i.item_id);
    const variantIds = items.map((i) => i.variant_id).filter(Boolean);
    const allAddonIds = [
      ...new Set(
        items.flatMap((i) => {
          try { return i.addons ? JSON.parse(i.addons) : []; } catch { return []; }
        })
      ),
    ];

    const [menuItems, variants, addons] = await Promise.all([
      MenuItem.find({ id: { $in: itemIds }, tenant_id: tenantId }).select("id title description price").lean(),
      variantIds.length > 0
        ? MenuItemVariant.find({ id: { $in: variantIds }, tenant_id: tenantId }).select("id item_id title price").lean()
        : Promise.resolve([]),
      allAddonIds.length > 0
        ? MenuItemAddon.find({ id: { $in: allAddonIds }, tenant_id: tenantId }).select("id title price").lean()
        : Promise.resolve([]),
    ]);

    const menuMap = new Map(menuItems.map((m) => [m.id, m]));
    const variantMap = new Map(variants.map((v) => [v.id, v]));
    const addonMap = new Map(addons.map((a) => [a.id, a]));

    const formattedItems = items.map((oi) => {
      const menuItem = menuMap.get(oi.item_id) || {};
      const variant = oi.variant_id ? variantMap.get(oi.variant_id) : null;
      let parsedAddonIds = [];
      try { parsedAddonIds = oi.addons ? JSON.parse(oi.addons) : []; } catch { parsedAddonIds = []; }
      const resolvedAddons = parsedAddonIds.map((id) => addonMap.get(id)).filter(Boolean);

      return {
        id: oi.id,
        order_id: oi.order_id,
        item_id: oi.item_id,
        item_title: menuItem.title || "",
        item_description: menuItem.description || "",
        variant_id: oi.variant_id || null,
        variant_title: variant?.title || null,
        variant_price: variant?.price || null,
        price: oi.price,
        quantity: oi.quantity,
        status: oi.status,
        notes: oi.notes || "",
        addons: resolvedAddons,
        date: oi.date,
      };
    });

    return {
      id: order.id,
      date: order.date, // full ISO timestamp — time placed
      delivery_type: order.delivery_type,
      delivery_fee: order.delivery_fee || 0,
      delivery_address: order.delivery_address || null,
      customer_type: order.customer_type,
      status: order.status,
      payment_status: order.payment_status,
      token_no: order.token_no,
      invoice_id: order.invoice_id || null,
      created_by: order.created_by || (isQROrder ? "QR Online Storefront" : null),
      source: isQROrder ? "qr_storefront" : "pos",
      customer: customer
        ? { id: customer.phone, name: customer.name, email: customer.email }
        : { id: order.customer_id, name: order.customer_name || "Walk-in Customer", email: null },
      table: table
        ? { id: table.id, title: table.table_title, floor: table.floor }
        : null,
      items: formattedItems,
    };
  } catch (error) {
    console.error("getOrderDetailDB Error:", error);
    throw error;
  }
};
