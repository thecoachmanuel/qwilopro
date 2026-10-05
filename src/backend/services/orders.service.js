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
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneDayLater = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const rawOrders = await Order.find({
      tenant_id: tenantId,
      status: { $nin: ["completed", "cancelled"] },
      date: { $gte: oneDayAgo, $lte: oneDayLater },
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
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    await Order.updateMany(
      { id: { $in: ids }, tenant_id: tenantId },
      { $set: { status: "cancelled" } }
    );
  } catch (error) {
    console.error("cancelOrderDB Error:", error);
    throw error;
  }
};

exports.completeOrderDB = async (orderIds, tenantId) => {
  try {
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    await Order.updateMany(
      { id: { $in: ids }, tenant_id: tenantId },
      { $set: { status: "completed" } }
    );
  } catch (error) {
    console.error("completeOrderDB Error:", error);
    throw error;
  }
};

exports.getInvoiceIdFromOrderIdsDB = async (orderIds, tenantId) => {
  try {
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    const order = await Order.findOne({ id: { $in: ids }, tenant_id: tenantId }).select("invoice_id customer_id").lean();
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
    const order = await Order.findOne({ invoice_id: invoiceId, tenant_id: tenantId }).select("invoice_id customer_id").lean();
    if (!order) return null;

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
    const ids = Array.isArray(orderIdsToFindSummary)
      ? orderIdsToFindSummary
      : String(orderIdsToFindSummary).split(",").map(Number);

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneDayLater = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const rawOrders = await Order.find({
      id: { $in: ids },
      tenant_id: tenantId,
      status: { $nin: ["completed", "cancelled"] },
      date: { $gte: oneDayAgo, $lte: oneDayLater },
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
        addons = await MenuItemAddon.find({ id: { $in: allAddonIds }, tenant_id: tenantId })
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

    await Invoice.create({
      id: invoiceId,
      sub_total: Number(subtotal) || 0,
      tax_total: Number(taxTotal) || 0,
      service_charge_total: Number(serviceChargeTotal) || 0,
      total: Number(total) || 0,
      created_at: date ? new Date(date) : new Date(),
      payment_type_id: selectedPaymentType ? Number(selectedPaymentType) : null,
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
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    await Order.updateMany(
      { id: { $in: ids }, tenant_id: tenantId },
      { $set: { status: "completed", payment_status: "paid", invoice_id: invoiceId } }
    );
  } catch (error) {
    console.error("completeOrdersAndSaveInvoiceIdDB Error:", error);
    throw error;
  }
};
