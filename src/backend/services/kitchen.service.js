const {
  Order,
  OrderItem,
  Customer,
  StoreTable,
  MenuItem,
  MenuItemVariant,
  MenuItemAddon,
} = require("../models");

exports.getKitchenOrdersDB = async (tenantId) => {
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
      const rawItems = await OrderItem.find({ order_id: { $in: orderIds } }).lean();

      const itemIds = rawItems.map((i) => i.item_id);
      const [menuItems, variants] = await Promise.all([
        MenuItem.find({ id: { $in: itemIds } }).select("id title").lean(),
        MenuItemVariant.find({ item_id: { $in: itemIds } }).select("id item_id title").lean(),
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
        addons = await MenuItemAddon.find({ id: { $in: allAddonIds } })
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
    console.error("getKitchenOrdersDB Error:", error);
    throw error;
  }
};

exports.updateOrderItemStatusDB = async (orderItemId, status) => {
  try {
    await OrderItem.updateOne({ id: orderItemId }, { $set: { status } });
  } catch (error) {
    console.error("updateOrderItemStatusDB Error:", error);
    throw error;
  }
};