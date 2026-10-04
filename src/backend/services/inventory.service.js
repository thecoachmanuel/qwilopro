const {
  InventoryItem,
  InventoryLog,
  InventoryVendor,
  InventoryPurchaseOrderDraft,
  InventoryPurchaseOrder,
  InventoryPurchaseOrderItem,
  MenuItem,
  MenuItemRecipe,
} = require("../models");
const { getNextSequenceValue } = require("../db/counter");

const getDateFilterCondition = (type, from, to) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (type) {
    case "custom": {
      return {
        $gte: new Date(from),
        $lte: new Date(new Date(to).setHours(23, 59, 59, 999)),
      };
    }
    case "today": {
      return { $gte: startOfDay, $lte: endOfDay };
    }
    case "this_month": {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { $gte: startOfMonth, $lte: endOfMonth };
    }
    case "last_month": {
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      return { $gte: oneMonthAgo, $lte: endOfDay };
    }
    case "last_7days": {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { $gte: sevenDaysAgo, $lte: endOfDay };
    }
    case "yesterday": {
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      return { $gte: startOfYesterday, $lte: endOfYesterday };
    }
    case "tomorrow": {
      const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999);
      return { $gte: startOfTomorrow, $lte: endOfTomorrow };
    }
    default:
      return null;
  }
};

exports.addInventoryItemDB = async (
  title,
  quantity,
  unit,
  minQuantityThreshold,
  tenantId,
  username
) => {
  try {
    const qty = parseFloat(quantity || 0);
    const threshold = parseFloat(minQuantityThreshold || 0);

    let status = "out";
    if (qty > 0 && qty <= threshold) {
      status = "low";
    } else if (qty > threshold) {
      status = "in";
    }

    const item = await InventoryItem.create({
      title,
      quantity: qty,
      unit,
      min_quantity_threshold: threshold,
      status,
      tenantId,
      tenant_id: tenantId,
    });

    await InventoryLog.create({
      tenant_id: tenantId,
      inventory_item_id: item.id,
      type: "IN",
      quantity_change: qty,
      previous_quantity: 0,
      new_quantity: qty,
      note: "Initial stock",
      created_by: username,
    });

    return item.id;
  } catch (error) {
    console.error("addInventoryItemDB Error:", error);
    throw error;
  }
};

exports.getInventoryItemsDB = async (status, tenantId) => {
  try {
    const statusCountsAgg = await InventoryItem.aggregate([
      { $match: { tenant_id: tenantId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const statusCounts = { in: 0, low: 0, out: 0 };
    statusCountsAgg.forEach((s) => {
      if (statusCounts[s._id] !== undefined) {
        statusCounts[s._id] = s.count;
      }
    });

    const query = { tenant_id: tenantId };
    if (status && status !== "all") {
      query.status = status;
    }

    const items = await InventoryItem.find(query).sort({ id: -1 }).lean();

    return { items, statusCounts };
  } catch (error) {
    console.error("getInventoryItemsDB Error:", error);
    throw error;
  }
};

exports.updateInventoryItemDB = async (
  itemId,
  title,
  unit,
  minQuantityThreshold,
  tenantId
) => {
  try {
    const item = await InventoryItem.findOne({ id: itemId, tenant_id: tenantId });
    if (!item) return;

    const qty = parseFloat(item.quantity || 0);
    const threshold = parseFloat(minQuantityThreshold || 0);

    let status = "out";
    if (qty > 0 && qty <= threshold) {
      status = "low";
    } else if (qty > threshold) {
      status = "in";
    }

    item.title = title;
    item.unit = unit;
    item.min_quantity_threshold = threshold;
    item.status = status;
    item.updated_at = new Date();
    await item.save();
  } catch (error) {
    console.error("updateInventoryItemDB Error:", error);
    throw error;
  }
};

exports.addInventoryItemStockMovementDB = async (
  req,
  itemId,
  movementType,
  quantity,
  note,
  tenantId,
  username
) => {
  try {
    const item = await InventoryItem.findOne({ id: itemId, tenant_id: tenantId });
    if (!item) throw new Error(req ? req.__("inventory_item_not_found_message") : "Item not found");

    const previousQuantity = parseFloat(item.quantity || 0);
    const minQuantityThreshold = parseFloat(item.min_quantity_threshold || 0);
    const parsedQty = parseFloat(quantity || 0);

    let deltaQuantity;
    switch (movementType) {
      case "IN":
        deltaQuantity = parsedQty;
        break;
      case "OUT":
      case "WASTAGE":
        deltaQuantity = -1 * parsedQty;
        break;
      default:
        throw new Error(req ? req.__("invalid_movement_type_message") : "Invalid movement type");
    }

    const newQuantity = previousQuantity + deltaQuantity;
    if (newQuantity < 0) {
      throw new Error(req ? req.__("insufficient_inventory_quantity_message") : "Insufficient stock");
    }

    let status = "out";
    if (newQuantity > 0 && newQuantity <= minQuantityThreshold) {
      status = "low";
    } else if (newQuantity > minQuantityThreshold) {
      status = "in";
    }

    item.quantity = newQuantity;
    item.status = status;
    item.updated_at = new Date();
    await item.save();

    await InventoryLog.create({
      tenant_id: tenantId,
      inventory_item_id: itemId,
      type: movementType,
      quantity_change: Math.abs(deltaQuantity),
      previous_quantity: previousQuantity,
      new_quantity: newQuantity,
      note: note || "",
      created_by: username,
    });
  } catch (error) {
    console.error("addInventoryItemStockMovementDB Error:", error);
    throw error;
  }
};

exports.deleteInventoryItemDB = async (itemId, tenantId) => {
  try {
    await Promise.all([
      InventoryItem.deleteOne({ id: itemId, tenant_id: tenantId }),
      InventoryLog.deleteMany({ inventory_item_id: itemId, tenant_id: tenantId }),
      MenuItemRecipe.deleteMany({ inventory_item_id: itemId, tenant_id: tenantId }),
    ]);
  } catch (error) {
    console.error("deleteInventoryItemDB Error:", error);
    throw error;
  }
};

exports.getInventoryLogsDB = async (movementType, type, from, to, tenantId) => {
  try {
    const query = { tenant_id: tenantId };
    if (movementType && movementType !== "all") {
      query.type = movementType.toUpperCase();
    }

    const dateFilter = getDateFilterCondition(type, from, to);
    if (dateFilter) {
      query.created_at = dateFilter;
    }

    const rawLogs = await InventoryLog.find(query).sort({ created_at: -1 }).lean();
    if (rawLogs.length === 0) return [];

    const itemIds = [...new Set(rawLogs.map((l) => l.inventory_item_id))];
    const items = await InventoryItem.find({ id: { $in: itemIds }, tenant_id: tenantId }).select("id title unit").lean();
    const itemMap = new Map(items.map((i) => [i.id, i]));

    return rawLogs.map((l) => {
      const item = itemMap.get(l.inventory_item_id);
      return {
        id: l.id,
        inventory_item_id: l.inventory_item_id,
        title: item?.title || "",
        unit: item?.unit || "",
        type: l.type,
        quantity: l.quantity_change,
        note: l.note,
        created_by: l.created_by,
        created_at: l.created_at,
      };
    });
  } catch (error) {
    console.error("getInventoryLogsDB Error:", error);
    throw error;
  }
};

exports.getCummulativeInventoryMovementsDB = async (type, from, to, tenantId) => {
  try {
    const match = { tenant_id: tenantId };
    const dateFilter = getDateFilterCondition(type, from, to);
    if (dateFilter) {
      match.created_at = dateFilter;
    }

    const agg = await InventoryLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$inventory_item_id",
          total_in: {
            $sum: {
              $cond: [{ $eq: [{ $toUpper: "$type" }, "IN"] }, "$quantity_change", 0],
            },
          },
          total_out: {
            $sum: {
              $cond: [{ $eq: [{ $toUpper: "$type" }, "OUT"] }, "$quantity_change", 0],
            },
          },
          total_wastage: {
            $sum: {
              $cond: [{ $eq: [{ $toUpper: "$type" }, "WASTAGE"] }, "$quantity_change", 0],
            },
          },
          movement_count: { $sum: 1 },
        },
      },
      {
        $project: {
          inventory_item_id: "$_id",
          total_in: 1,
          total_out: 1,
          total_wastage: 1,
          movement_count: 1,
          total_activity: { $add: ["$total_in", "$total_out", "$total_wastage"] },
        },
      },
      { $sort: { total_activity: -1 } },
    ]);

    const itemIds = agg.map((a) => a._id);
    const items = await InventoryItem.find({ id: { $in: itemIds }, tenant_id: tenantId }).select("id title unit").lean();
    const itemMap = new Map(items.map((i) => [i.id, i]));

    return agg.map((a) => {
      const item = itemMap.get(a._id);
      return {
        inventory_item_id: a._id,
        title: item?.title || "",
        unit: item?.unit || "",
        total_in: a.total_in,
        total_out: a.total_out,
        total_wastage: a.total_wastage,
        movement_count: a.movement_count,
      };
    });
  } catch (error) {
    console.error("getCummulativeInventoryMovementsDB Error:", error);
    throw error;
  }
};

exports.getInventoryUsageVsCurrentStockDB = async (type, from, to, tenantId) => {
  try {
    const items = await InventoryItem.find({ tenant_id: tenantId }).lean();
    if (items.length === 0) return [];

    const match = {
      tenant_id: tenantId,
      type: { $in: ["OUT", "out"] },
    };
    const dateFilter = getDateFilterCondition(type, from, to);
    if (dateFilter) {
      match.created_at = dateFilter;
    }

    const usageAgg = await InventoryLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$inventory_item_id",
          total_usage: { $sum: "$quantity_change" },
        },
      },
    ]);

    const usageMap = new Map(usageAgg.map((u) => [u._id, u.total_usage]));

    return items
      .map((i) => ({
        inventory_item_id: i.id,
        title: i.title,
        current_stock: i.quantity,
        min_quantity_threshold: i.min_quantity_threshold,
        unit: i.unit,
        status: i.status,
        total_usage: usageMap.get(i.id) || 0,
      }))
      .sort((a, b) => b.total_usage - a.total_usage);
  } catch (error) {
    console.error("getInventoryUsageVsCurrentStockDB Error:", error);
    throw error;
  }
};

/* Vendors */
exports.addVendorDB = async (phone, name, contactPerson, addressLine1, addressLine2, city, state, country, zipcode, taxIdNo, tenantId) => {
  try {
    const vendor = await InventoryVendor.create({
      phone,
      name,
      contact_person: contactPerson || "",
      address_line1: addressLine1 || "",
      address_line2: addressLine2 || "",
      city: city || "",
      state: state || "",
      country: country || "",
      zipcode: zipcode || "",
      tax_id_no: taxIdNo || "",
      tenant_id: tenantId,
    });
    return vendor.id;
  } catch (error) {
    console.error("addVendorDB Error:", error);
    throw error;
  }
};

exports.getVendorsDB = async (page, perPage, sort, filter, tenantId) => {
  try {
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(perPage, 10) || 10, 1), 100);
    const skip = (currentPage - 1) * limit;

    const query = { tenant_id: tenantId };
    if (filter) {
      query.$or = [
        { name: { $regex: filter, $options: "i" } },
        { phone: { $regex: filter, $options: "i" } },
      ];
    }

    let sortObj = { created_at: -1 };
    if (sort) {
      const field = sort.startsWith("-") ? sort.substring(1) : sort;
      sortObj = { [field]: sort.startsWith("-") ? -1 : 1 };
    }

    const [vendors, total] = await Promise.all([
      InventoryVendor.find(query).sort(sortObj).skip(skip).limit(limit).lean(),
      InventoryVendor.countDocuments(query),
    ]);

    return {
      vendors,
      currentPage,
      perPage: limit,
      totalPages: Math.ceil(total / limit),
      totalVendors: total,
    };
  } catch (error) {
    console.error("getVendorsDB Error:", error);
    throw error;
  }
};

exports.getAllVendorsDB = async (tenantId) => {
  try {
    return await InventoryVendor.find({ tenant_id: tenantId }).sort({ created_at: -1 }).lean();
  } catch (error) {
    console.error("getAllVendorsDB Error:", error);
    throw error;
  }
};

exports.getVendorDB = async (id, tenantId) => {
  try {
    return await InventoryVendor.findOne({ id, tenant_id: tenantId }).lean();
  } catch (error) {
    console.error("getVendorDB Error:", error);
    throw error;
  }
};

exports.searchVendorDB = async (searchString, tenantId) => {
  try {
    return await InventoryVendor.find({
      tenant_id: tenantId,
      $or: [
        { phone: { $regex: searchString, $options: "i" } },
        { name: { $regex: searchString, $options: "i" } },
      ],
    })
      .limit(10)
      .lean();
  } catch (error) {
    console.error("searchVendorDB Error:", error);
    throw error;
  }
};

exports.updateVendorDB = async (id, phone, name, contactPerson, addressLine1, addressLine2, city, state, country, zipcode, taxIdNo, tenantId) => {
  try {
    await InventoryVendor.updateOne(
      { id, tenant_id: tenantId },
      {
        $set: {
          name,
          phone,
          contact_person: contactPerson,
          address_line1: addressLine1,
          address_line2: addressLine2,
          city,
          state,
          country,
          zipcode,
          tax_id_no: taxIdNo,
          updated_at: new Date(),
        },
      }
    );
  } catch (error) {
    console.error("updateVendorDB Error:", error);
    throw error;
  }
};

exports.deleteVendorDB = async (id, tenantId) => {
  try {
    await InventoryVendor.deleteOne({ id, tenant_id: tenantId });
  } catch (error) {
    console.error("deleteVendorDB Error:", error);
    throw error;
  }
};

/* Purchase Orders */
exports.addItemToPurchaseOrdersDraftsDB = async (inventoryItemId, tenantId, quantity) => {
  try {
    const draft = await InventoryPurchaseOrderDraft.create({
      item_id: inventoryItemId,
      quantity,
      tenant_id: tenantId,
    });
    return draft.id;
  } catch (error) {
    console.error("addItemToPurchaseOrdersDraftsDB Error:", error);
    throw error;
  }
};

exports.addBulkItemsToPurchaseOrdersDraftsDB = async (items) => {
  try {
    const docs = items.map((it) => {
      const [item_id, quantity, tenant_id] = Array.isArray(it)
        ? it
        : [it.item_id, it.quantity, it.tenant_id];
      return { item_id, quantity, tenant_id };
    });
    await InventoryPurchaseOrderDraft.insertMany(docs);
  } catch (error) {
    console.error("addBulkItemsToPurchaseOrdersDraftsDB Error:", error);
    throw error;
  }
};

exports.getPurchaseOrderDraftsDB = async (tenantId) => {
  try {
    const drafts = await InventoryPurchaseOrderDraft.find({ tenant_id: tenantId }).lean();
    if (drafts.length === 0) return [];

    const itemIds = drafts.map((d) => d.item_id);
    const items = await InventoryItem.find({ id: { $in: itemIds }, tenant_id: tenantId }).select("id title unit").lean();
    const itemMap = new Map(items.map((i) => [i.id, i]));

    return drafts.map((d) => {
      const it = itemMap.get(d.item_id);
      return {
        id: d.id,
        item_id: d.item_id,
        quantity: d.quantity,
        created_at: d.created_at,
        title: it?.title || "",
        unit: it?.unit || "",
      };
    });
  } catch (error) {
    console.error("getPurchaseOrderDraftsDB Error:", error);
    throw error;
  }
};

exports.updatePurchaseOrderDraftItemQuantityDB = async (id, quantity, tenantId) => {
  try {
    await InventoryPurchaseOrderDraft.updateOne(
      { id, tenant_id: tenantId },
      { $set: { quantity, updated_at: new Date() } }
    );
  } catch (error) {
    console.error("updatePurchaseOrderDraftItemQuantityDB Error:", error);
    throw error;
  }
};

exports.deletePurchaseOrderDraftItemDB = async (id, tenantId) => {
  try {
    await InventoryPurchaseOrderDraft.deleteOne({ id, tenant_id: tenantId });
  } catch (error) {
    console.error("deletePurchaseOrderDraftItemDB Error:", error);
    throw error;
  }
};

exports.createPurchaseOrderDB = async (vendorId, vendorName, contactPerson, taxIdNo, address, notes, items, userId, tenantId) => {
  try {
    const purchaseOrderId = await getNextSequenceValue(`po_tenant_${tenantId}`);

    await InventoryPurchaseOrder.create({
      id: purchaseOrderId,
      tenant_id: tenantId,
      vendor_id: vendorId,
      vendor_name: vendorName,
      contact_person: contactPerson,
      tax_id_no: taxIdNo,
      address,
      created_by: userId,
      notes,
      status: "ordered",
      created_at: new Date(),
    });

    const poItems = items.map((item) => ({
      purchase_order_id: purchaseOrderId,
      tenant_id: tenantId,
      inventory_item_id: item.item_id,
      inventory_item_name: item.title,
      inventory_item_unit: item.unit,
      quantity: item.quantity,
    }));
    await InventoryPurchaseOrderItem.insertMany(poItems);

    const draftIds = items.map((i) => i.id);
    await InventoryPurchaseOrderDraft.deleteMany({ id: { $in: draftIds }, tenant_id: tenantId });

    return purchaseOrderId;
  } catch (error) {
    console.error("createPurchaseOrderDB Error:", error);
    throw error;
  }
};

exports.updatePurchaseOrderToCompleteDB = async (id, fullfilledDate, userId, tenantId) => {
  try {
    await InventoryPurchaseOrder.updateOne(
      { id, tenant_id: tenantId },
      { $set: { status: "completed", fullfilled_at: fullfilledDate || new Date() } }
    );

    const poItems = await InventoryPurchaseOrderItem.find({ purchase_order_id: id, tenant_id: tenantId }).lean();

    for (const poItem of poItems) {
      const invItem = await InventoryItem.findOne({ id: poItem.inventory_item_id, tenant_id: tenantId });
      if (invItem) {
        const prevQty = parseFloat(invItem.quantity || 0);
        const addedQty = parseFloat(poItem.quantity || 0);
        const newQty = prevQty + addedQty;
        const threshold = parseFloat(invItem.min_quantity_threshold || 0);

        let status = "out";
        if (newQty > 0 && newQty <= threshold) {
          status = "low";
        } else if (newQty > threshold) {
          status = "in";
        }

        invItem.quantity = newQty;
        invItem.status = status;
        await invItem.save();

        await InventoryLog.create({
          tenant_id: tenantId,
          inventory_item_id: invItem.id,
          type: "IN",
          quantity_change: addedQty,
          previous_quantity: prevQty,
          new_quantity: newQty,
          note: `Purchase Order #${id} fulfilled`,
          created_by: userId,
          created_at: new Date(),
        });
      }
    }

    // Auto-enable menu items if stock replenished
    const disabledItems = await MenuItem.find({ is_enabled: false, tenant_id: tenantId }).lean();
    for (const item of disabledItems) {
      const recipes = await MenuItemRecipe.find({
        menu_item_id: item.id,
        variant_id: 0,
        addon_id: 0,
        tenant_id: tenantId,
      }).lean();

      if (recipes.length > 0) {
        let canEnable = true;
        for (const r of recipes) {
          const ing = await InventoryItem.findOne({ id: r.inventory_item_id, tenant_id: tenantId }).lean();
          if (!ing || parseFloat(ing.quantity || 0) < parseFloat(r.quantity || 0)) {
            canEnable = false;
            break;
          }
        }
        if (canEnable) {
          await MenuItem.updateOne({ id: item.id, tenant_id: tenantId }, { $set: { is_enabled: true } });
        }
      }
    }
  } catch (error) {
    console.error("updatePurchaseOrderToCompleteDB Error:", error);
    throw error;
  }
};

exports.getPurchaseOrdersDB = async (type, from, to, tenantId) => {
  try {
    const query = { tenant_id: tenantId };
    const dateFilter = getDateFilterCondition(type, from, to);
    if (dateFilter) {
      query.created_at = dateFilter;
    }

    return await InventoryPurchaseOrder.find(query).sort({ created_at: -1 }).lean();
  } catch (error) {
    console.error("getPurchaseOrdersDB Error:", error);
    throw error;
  }
};

exports.getPurchaseOrderItemsDB = async (purchaseOrderIds, tenantId) => {
  try {
    const ids = Array.isArray(purchaseOrderIds) ? purchaseOrderIds : [purchaseOrderIds];
    return await InventoryPurchaseOrderItem.find({ purchase_order_id: { $in: ids }, tenant_id: tenantId }).lean();
  } catch (error) {
    console.error("getPurchaseOrderItemsDB Error:", error);
    throw error;
  }
};
