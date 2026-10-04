const {
  Order,
  OrderItem,
  Invoice,
  Customer,
  MenuItem,
  PaymentType,
  InventoryItem,
  Feedback,
} = require("../models");

const getTodayDateBounds = () => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { startOfDay, endOfDay };
};

const getYesterdayDateBounds = () => {
  const now = new Date();
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
  return { startOfYesterday, endOfYesterday };
};

exports.getTodaysOrdersCountDB = async (tenantId) => {
  try {
    const { startOfDay, endOfDay } = getTodayDateBounds();
    return await Order.countDocuments({
      tenant_id: tenantId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });
  } catch (error) {
    console.error("getTodaysOrdersCountDB Error:", error);
    throw error;
  }
};

exports.getTodaysNewCustomerCountDB = async (tenantId) => {
  try {
    const { startOfDay, endOfDay } = getTodayDateBounds();
    return await Customer.countDocuments({
      tenant_id: tenantId,
      created_at: { $gte: startOfDay, $lte: endOfDay },
    });
  } catch (error) {
    console.error("getTodaysNewCustomerCountDB Error:", error);
    throw error;
  }
};

exports.getTodaysRepeatCustomerCountDB = async (tenantId) => {
  try {
    const { startOfDay, endOfDay } = getTodayDateBounds();
    const result = await Order.distinct("customer_id", {
      tenant_id: tenantId,
      date: { $gte: startOfDay, $lte: endOfDay },
      customer_type: "CUSTOMER",
    });
    return result.filter(Boolean).length;
  } catch (error) {
    console.error("getTodaysRepeatCustomerCountDB Error:", error);
    throw error;
  }
};

exports.getTodaysTopSellingItemsDB = async (tenantId) => {
  try {
    const { startOfDay, endOfDay } = getTodayDateBounds();

    const topItems = await OrderItem.aggregate([
      {
        $match: {
          tenant_id: tenantId,
          status: { $ne: "cancelled" },
          date: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $group: {
          _id: "$item_id",
          orders_count: { $sum: "$quantity" },
        },
      },
      { $sort: { orders_count: -1 } },
      { $limit: 50 },
    ]);

    if (topItems.length === 0) return [];

    const itemIds = topItems.map((t) => t._id);
    const menuItems = await MenuItem.find({ id: { $in: itemIds }, tenant_id: tenantId }).lean();
    const menuMap = new Map(menuItems.map((m) => [m.id, m]));

    return topItems.map((t) => ({
      ...(menuMap.get(t._id) || {}),
      orders_count: t.orders_count,
    }));
  } catch (error) {
    console.error("getTodaysTopSellingItemsDB Error:", error);
    throw error;
  }
};

exports.getTodaysRevenueDB = async (tenantId) => {
  try {
    const { startOfDay, endOfDay } = getTodayDateBounds();

    const agg = await Invoice.aggregate([
      {
        $match: {
          tenant_id: tenantId,
          created_at: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $group: {
          _id: null,
          total_revenue: { $sum: "$total" },
          net_sales: { $sum: "$sub_total" },
          tax_total: { $sum: "$tax_total" },
          service_charge_total: { $sum: "$service_charge_total" },
          average_order_value: { $avg: "$total" },
          invoice_count: { $sum: 1 },
        },
      },
    ]);

    if (agg.length === 0) {
      return {
        total_revenue: 0,
        net_sales: 0,
        tax_total: 0,
        service_charge_total: 0,
        average_order_value: 0,
        invoice_count: 0,
      };
    }

    return agg[0];
  } catch (error) {
    console.error("getTodaysRevenueDB Error:", error);
    throw error;
  }
};

exports.getYesterdaysRevenueDB = async (tenantId) => {
  try {
    const { startOfYesterday, endOfYesterday } = getYesterdayDateBounds();

    const agg = await Invoice.aggregate([
      {
        $match: {
          tenant_id: tenantId,
          created_at: { $gte: startOfYesterday, $lte: endOfYesterday },
        },
      },
      {
        $group: {
          _id: null,
          total_revenue: { $sum: "$total" },
          average_order_value: { $avg: "$total" },
          invoice_count: { $sum: 1 },
        },
      },
    ]);

    if (agg.length === 0) {
      return {
        total_revenue: 0,
        average_order_value: 0,
        invoice_count: 0,
      };
    }

    return agg[0];
  } catch (error) {
    console.error("getYesterdaysRevenueDB Error:", error);
    throw error;
  }
};

exports.getYesterdaysOrdersCountDB = async (tenantId) => {
  try {
    const { startOfYesterday, endOfYesterday } = getYesterdayDateBounds();
    return await Order.countDocuments({
      tenant_id: tenantId,
      date: { $gte: startOfYesterday, $lte: endOfYesterday },
    });
  } catch (error) {
    console.error("getYesterdaysOrdersCountDB Error:", error);
    throw error;
  }
};

exports.getYesterdaysNewCustomerCountDB = async (tenantId) => {
  try {
    const { startOfYesterday, endOfYesterday } = getYesterdayDateBounds();
    return await Customer.countDocuments({
      tenant_id: tenantId,
      created_at: { $gte: startOfYesterday, $lte: endOfYesterday },
    });
  } catch (error) {
    console.error("getYesterdaysNewCustomerCountDB Error:", error);
    throw error;
  }
};

exports.getRevenueTrendDB = async (tenantId) => {
  try {
    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
    sixDaysAgo.setHours(0, 0, 0, 0);

    const trend = await Invoice.aggregate([
      {
        $match: {
          tenant_id: tenantId,
          created_at: { $gte: sixDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          revenue: { $sum: "$total" },
          invoice_count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: "$_id",
          revenue: 1,
          invoice_count: 1,
          _id: 0,
        },
      },
    ]);

    return trend;
  } catch (error) {
    console.error("getRevenueTrendDB Error:", error);
    throw error;
  }
};

exports.getSalesByHourDB = async (tenantId) => {
  try {
    const { startOfDay, endOfDay } = getTodayDateBounds();

    return await Invoice.aggregate([
      {
        $match: {
          tenant_id: tenantId,
          created_at: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $group: {
          _id: { $hour: "$created_at" },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          hour: "$_id",
          revenue: 1,
          orders: 1,
          _id: 0,
        },
      },
    ]);
  } catch (error) {
    console.error("getSalesByHourDB Error:", error);
    throw error;
  }
};

exports.getOrdersByTypeDB = async (tenantId) => {
  try {
    const { startOfDay, endOfDay } = getTodayDateBounds();

    return await Order.aggregate([
      {
        $match: {
          tenant_id: tenantId,
          date: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $group: {
          _id: { $ifNull: ["$delivery_type", "Unassigned"] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      {
        $project: {
          order_type: { $cond: [{ $eq: ["$_id", ""] }, "Unassigned", "$_id"] },
          count: 1,
          _id: 0,
        },
      },
    ]);
  } catch (error) {
    console.error("getOrdersByTypeDB Error:", error);
    throw error;
  }
};

exports.getPaymentMixDB = async (tenantId) => {
  try {
    const { startOfDay, endOfDay } = getTodayDateBounds();

    const agg = await Invoice.aggregate([
      {
        $match: {
          tenant_id: tenantId,
          created_at: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $group: {
          _id: "$payment_type_id",
          count: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const ptIds = agg.map((a) => a._id).filter(Boolean);
    const paymentTypes = await PaymentType.find({ id: { $in: ptIds }, tenant_id: tenantId }).lean();
    const ptMap = new Map(paymentTypes.map((p) => [p.id, p.title]));

    return agg.map((a) => ({
      payment_type: a._id ? ptMap.get(a._id) || "Other" : "Unassigned",
      count: a.count,
      total: a.total,
    }));
  } catch (error) {
    console.error("getPaymentMixDB Error:", error);
    throw error;
  }
};

exports.getLowStockAlertsDB = async (tenantId) => {
  try {
    return await InventoryItem.find({
      tenant_id: tenantId,
      $expr: { $lte: ["$quantity", "$min_quantity_threshold"] },
    })
      .select("id title quantity unit min_quantity_threshold status")
      .sort({ quantity: 1 })
      .limit(6)
      .lean();
  } catch (error) {
    console.error("getLowStockAlertsDB Error:", error);
    throw error;
  }
};

exports.getRecentFeedbackDB = async (tenantId) => {
  try {
    const rawFeedbacks = await Feedback.find({ tenant_id: tenantId })
      .sort({ date: -1 })
      .limit(5)
      .lean();

    const phones = rawFeedbacks.map((f) => f.phone).filter(Boolean);
    const customers = await Customer.find({ phone: { $in: phones }, tenant_id: tenantId }).select("phone name").lean();
    const customerMap = new Map(customers.map((c) => [c.phone, c.name]));

    return rawFeedbacks.map((f) => ({
      id: f.id,
      average_rating: f.average_rating,
      food_quality_rating: f.food_quality_rating,
      service_rating: f.service_rating,
      staff_behavior_rating: f.staff_behavior_rating,
      ambiance_rating: f.ambiance_rating,
      recommend_rating: f.recommend_rating,
      remarks: f.remarks,
      date: f.date,
      customer_name: customerMap.get(f.phone) || f.phone || "Guest",
    }));
  } catch (error) {
    console.error("getRecentFeedbackDB Error:", error);
    throw error;
  }
};

exports.getCancelledOrdersCountDB = async (tenantId) => {
  try {
    const { startOfDay, endOfDay } = getTodayDateBounds();
    return await Order.countDocuments({
      tenant_id: tenantId,
      status: "cancelled",
      date: { $gte: startOfDay, $lte: endOfDay },
    });
  } catch (error) {
    console.error("getCancelledOrdersCountDB Error:", error);
    throw error;
  }
};
