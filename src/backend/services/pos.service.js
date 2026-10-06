const {
  Order,
  OrderItem,
  QROrder,
  QROrderItem,
  InventoryItem,
  InventoryLog,
  Customer,
  StoreTable,
  MenuItem,
  Tax,
  MenuItemVariant,
  MenuItemAddon,
  MenuItemRecipe,
} = require("../models");
const { getNextDailyTokenValue } = require("../db/counter");

exports.createOrderDB = async (
  tenantId,
  cartItems,
  deliveryType,
  customerType,
  customerId,
  tableId,
  paymentStatus = "pending",
  invoiceId = null,
  username = null,
  deliveryFee = 0,
  deliveryAddress = null
) => {
  try {
    const tokenNo = await getNextDailyTokenValue(tenantId);
    const validTableId = (tableId && !isNaN(Number(tableId))) ? Number(tableId) : null;
    const validCustomerType = String(customerType || "WALKIN").toUpperCase() === "CUSTOMER" ? "CUSTOMER" : "WALKIN";

    const order = await Order.create({
      delivery_type: deliveryType || "dinein",
      delivery_fee: Number(deliveryFee) || 0,
      delivery_address: deliveryAddress || null,
      customer_type: validCustomerType,
      customer_id: customerId ? String(customerId) : null,
      table_id: validTableId,
      token_no: tokenNo,
      payment_status: paymentStatus || "pending",
      invoice_id: invoiceId ? Number(invoiceId) : null,
      tenant_id: tenantId,
      created_by: username,
    });

    const orderId = order.id;

    if (cartItems && cartItems.length > 0) {
      const orderItemsData = cartItems.map((item) => ({
        order_id: orderId,
        item_id: Number(item.id) || 1,
        variant_id: item.variant_id ? Number(item.variant_id) : null,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        notes: item.notes || "",
        addons: item?.addons_ids?.length > 0 ? JSON.stringify(item.addons_ids) : null,
        tenant_id: tenantId,
      }));

      await OrderItem.insertMany(orderItemsData);
    }

    // Recipe & Inventory usage deduction
    const inventoryUsage = {};

    cartItems.forEach((item) => {
      (item.recipeItems || []).forEach((recipe) => {
        const { inventory_item_id, recipe_quantity, ingredient_title, unit, variant_id, addon_id } = recipe;

        if (variant_id && variant_id != item.variant_id) return;
        if (addon_id && !item.addons_ids?.map(String).includes(String(addon_id))) return;

        const invId = inventory_item_id;
        const qtyNeeded = parseFloat(recipe_quantity) * item.quantity;

        if (!inventoryUsage[invId]) {
          inventoryUsage[invId] = {
            ingredient_title,
            unit,
            total_quantity: 0,
          };
        }

        inventoryUsage[invId].total_quantity += qtyNeeded;
      });
    });

    for (const [inventoryItemId, usage] of Object.entries(inventoryUsage)) {
      const invId = parseInt(inventoryItemId);
      const qtyUsed = parseFloat(usage.total_quantity);

      const currentItem = await InventoryItem.findOne({ id: invId, tenant_id: tenantId });
      if (!currentItem) continue;

      const previousQty = parseFloat(currentItem.quantity || 0);
      const newQty = previousQty - qtyUsed;
      const minQuantityThreshold = parseFloat(currentItem.min_quantity_threshold || 0);

      await InventoryLog.create({
        tenant_id: tenantId,
        inventory_item_id: invId,
        type: "OUT",
        quantity_change: qtyUsed,
        previous_quantity: previousQty,
        new_quantity: newQty,
        note: invoiceId
          ? `Auto deduction for recipe usage in invoice #${invoiceId}`
          : "Auto deduction for recipe usage in order",
        created_by: username,
      });

      let status = "out";
      if (newQty > 0 && newQty <= minQuantityThreshold) {
        status = "low";
      } else if (newQty > minQuantityThreshold) {
        status = "in";
      }

      currentItem.quantity = newQty;
      currentItem.status = status;
      await currentItem.save();
    }

    return {
      tokenNo,
      orderId,
    };
  } catch (error) {
    console.error("createOrderDB Error:", error);
    throw error;
  }
};

exports.getPOSQROrdersCountDB = async (tenantId) => {
  try {
    return await QROrder.countDocuments({
      tenant_id: tenantId,
      status: { $nin: ["completed", "cancelled"] },
    });
  } catch (error) {
    console.error("getPOSQROrdersCountDB Error:", error);
    throw error;
  }
};

exports.getPOSQROrdersDB = async (tenantId) => {
  try {
    const rawKitchenOrders = await QROrder.find({
      status: { $nin: ["completed", "cancelled"] },
      tenant_id: tenantId,
    }).lean();

    const customerIds = rawKitchenOrders.map((o) => o.customer_id).filter(Boolean);
    const tableIds = rawKitchenOrders.map((o) => o.table_id).filter(Boolean);

    const [customers, tables] = await Promise.all([
      Customer.find({ phone: { $in: customerIds }, tenant_id: tenantId }).select("phone name").lean(),
      StoreTable.find({ id: { $in: tableIds }, tenant_id: tenantId }).select("id table_title floor").lean(),
    ]);

    const customerMap = new Map(customers.map((c) => [c.phone, c.name]));
    const tableMap = new Map(tables.map((t) => [t.id, t]));

    const kitchenOrders = rawKitchenOrders.map((o) => {
      const table = tableMap.get(o.table_id);
      return {
        id: o.id,
        date: o.date,
        delivery_type: o.delivery_type,
        customer_type: o.customer_type,
        customer_id: o.customer_id,
        customer_name: customerMap.get(o.customer_id) || "Guest",
        table_id: o.table_id,
        table_title: table?.table_title || null,
        floor: table?.floor || null,
        status: o.status,
        payment_status: o.payment_status,
      };
    });

    let kitchenOrdersItems = [];
    let addons = [];

    if (kitchenOrders.length > 0) {
      const orderIds = kitchenOrders.map((o) => o.id);
      const rawItems = await QROrderItem.find({ order_id: { $in: orderIds }, tenant_id: tenantId }).lean();

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
          tax_id: mi?.tax_id || null,
          tax_title: tax?.title || null,
          tax_rate: tax?.rate || 0,
          tax_type: tax?.type || "other",
          variant_id: oi.variant_id,
          variant_title: variant?.title || null,
          variant_price: variant?.price || 0,
          price: oi.price,
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
          .select("id item_id title")
          .lean();
      }
    }

    // Attach recipes
    const recipes = await MenuItemRecipe.find({ tenant_id: tenantId }).lean();
    const invIds = recipes.map((r) => r.inventory_item_id);
    const invItems = await InventoryItem.find({ id: { $in: invIds }, tenant_id: tenantId }).lean();
    const invMap = new Map(invItems.map((i) => [i.id, i]));

    kitchenOrdersItems = kitchenOrdersItems.map((oi) => {
      const relevantRecipeItems = recipes
        .filter(
          (ri) =>
            ri.menu_item_id === oi.item_id &&
            (ri.variant_id == 0 || ri.variant_id === oi.variant_id) &&
            (ri.addon_id === 0 || oi.addons?.includes(String(ri.addon_id)))
        )
        .map((ri) => {
          const inv = invMap.get(ri.inventory_item_id);
          return {
            ...ri,
            ingredient_title: inv?.title || "",
            unit: inv?.unit || "",
            current_quantity: inv?.quantity || 0,
            min_quantity_threshold: inv?.min_quantity_threshold || 0,
            recipe_quantity: ri.quantity,
          };
        });

      return {
        ...oi,
        recipeItems: relevantRecipeItems,
      };
    });

    return {
      kitchenOrders,
      kitchenOrdersItems,
      addons,
    };
  } catch (error) {
    console.error("getPOSQROrdersDB Error:", error);
    throw error;
  }
};

exports.updateQROrderStatusDB = async (tenantId, orderId, status) => {
  try {
    await QROrder.updateOne({ tenant_id: tenantId, id: orderId }, { $set: { status } });
  } catch (error) {
    console.error("updateQROrderStatusDB Error:", error);
    throw error;
  }
};

exports.cancelAllQROrdersDB = async (tenantId, status) => {
  try {
    await QROrder.updateMany({ tenant_id: tenantId }, { $set: { status } });
  } catch (error) {
    console.error("cancelAllQROrdersDB Error:", error);
    throw error;
  }
};
