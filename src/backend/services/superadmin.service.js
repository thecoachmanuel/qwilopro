const bcrypt = require("bcrypt");
const {
  SuperAdmin,
  Tenant,
  User,
  StoreDetails,
  Order,
  OrderItem,
  Invoice,
  ExchangeRate,
  SubscriptionHistory,
  Customer,
  PaymentGateway,
  RefreshToken,
  Plan,
} = require("../models");
const { doUserExistDB } = require("./user.service");
const { CONFIG } = require("../config");

const buildDateFilter = (field, type, from, to) => {
  const now = new Date();
  const startOfDay = (d) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };
  const endOfDay = (d) => {
    const copy = new Date(d);
    copy.setHours(23, 59, 59, 999);
    return copy;
  };

  const isValidDate = (d) => {
    if (!d || d === "null" || d === "undefined") return false;
    const dateObj = new Date(d);
    return !isNaN(dateObj.getTime());
  };

  switch (type) {
    case "custom": {
      const start = isValidDate(from) ? startOfDay(new Date(from)) : new Date(0);
      const end = isValidDate(to) ? endOfDay(new Date(to)) : new Date();
      return { [field]: { $gte: start, $lte: end } };
    }
    case "today": {
      return { [field]: { $gte: startOfDay(now), $lte: endOfDay(now) } };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { [field]: { $gte: start, $lte: end } };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { [field]: { $gte: start, $lte: end } };
    }
    case "last_7days": {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      return { [field]: { $gte: startOfDay(past), $lte: endOfDay(now) } };
    }
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { [field]: { $gte: startOfDay(y), $lte: endOfDay(y) } };
    }
    case "tomorrow": {
      const t = new Date(now);
      t.setDate(t.getDate() + 1);
      return { [field]: { $gte: startOfDay(t), $lte: endOfDay(t) } };
    }
    default:
      return {};
  }
};

exports.signInDB = async (username, password) => {
  const cleanEmail = (username || "").trim().toLowerCase();
  let user = await SuperAdmin.findOne({ email: { $regex: new RegExp(`^${cleanEmail}$`, "i") } }).lean();

  if (!user) {
    // Check if no superadmin exists yet in database -> create default one
    const count = await SuperAdmin.countDocuments();
    if (count === 0) {
      const defaultEmail = (process.env.DEFAULT_SUPERADMIN_EMAIL || "superadmin@qwilopro.com").trim().toLowerCase();
      const defaultPass = process.env.DEFAULT_SUPERADMIN_PASSWORD || "admin123";
      const hashedPassword = await bcrypt.hash(defaultPass, CONFIG.PASSWORD_SALT);
      const created = await SuperAdmin.create({
        email: defaultEmail,
        password: hashedPassword,
        name: "Super Admin",
      });
      if (cleanEmail === defaultEmail) {
        user = created.toObject ? created.toObject() : created;
      }
    }
  }

  if (!user) {
    return null;
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (passwordMatch) {
    return user;
  } else {
    return null;
  }
};

exports.getAdminUserDB = async (username) => {
  const cleanEmail = (username || "").trim().toLowerCase();
  const user = await SuperAdmin.findOne(
    { email: { $regex: new RegExp(`^${cleanEmail}$`, "i") } },
    { email: 1, password: 1, name: 1, _id: 0 }
  ).lean();
  return user || null;
};

exports.getOrdersProcessedTodayDB = async () => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const count = await Order.countDocuments({ date: { $gte: start, $lte: end } });
  return count;
};

exports.getSalesVolumeTodayDB = async () => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const results = await Invoice.aggregate([
    { $match: { created_at: { $gte: start, $lte: end } } },
    {
      $lookup: {
        from: "store_details",
        localField: "tenant_id",
        foreignField: "tenant_id",
        as: "store",
      },
    },
    { $unwind: { path: "$store", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "exchange_rates",
        localField: "store.currency",
        foreignField: "currency_code",
        as: "rate",
      },
    },
    { $unwind: { path: "$rate", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        usd_total: {
          $multiply: ["$total", { $ifNull: ["$rate.rate_to_usd", 1] }],
        },
      },
    },
    {
      $group: {
        _id: null,
        sales_volume: { $sum: "$usd_total" },
      },
    },
  ]);

  return results[0]?.sales_volume || 0;
};

exports.getMRRValueDB = async () => {
  const count = await Tenant.countDocuments({ is_active: 1 });
  return count;
};

exports.getARRValueDB = async () => {
  const count = await Tenant.countDocuments({ is_active: 1 });
  return count;
};

exports.getActiveTenantsDB = async () => {
  const count = await Tenant.countDocuments({ is_active: 1 });
  return count;
};

exports.getInActiveTenantsDB = async () => {
  const count = await Tenant.countDocuments({ is_active: 0 });
  return count;
};

exports.getAllTenantsDB = async () => {
  const count = await Tenant.countDocuments();
  return count;
};

exports.getTenantSubscriptionHistoryDB = async (tenantId) => {
  const tId = Number(tenantId);
  const tenant = await Tenant.findOne({ id: tId }).lean();
  let planTitle = "";
  if (tenant?.payment_gateway_product_id || tenant?.plan_id) {
    const plan = await Plan.findOne({
      $or: [
        ...(tenant.payment_gateway_product_id ? [{ payment_gateway_product_id: tenant.payment_gateway_product_id }] : []),
        ...(tenant.plan_id ? [{ id: tenant.plan_id }] : []),
      ],
      is_deleted: false,
    }).lean();
    if (plan) planTitle = plan.title;
  }

  const results = await SubscriptionHistory.find(
    { tenant_id: tId },
    { _id: 0, id: 1, tenant_id: 1, created_at: 1, starts_on: 1, expires_on: 1, status: 1 }
  )
    .sort({ created_at: -1 })
    .lean();

  return results.map((r) => ({
    ...r,
    plan_title: planTitle || "Subscription",
  }));
};

exports.getTenantTotalUsersDB = async (tenantId) => {
  const count = await User.countDocuments({ tenant_id: Number(tenantId) });
  return count;
};

exports.getTenantDetailsDB = async (tenantId) => {
  const tenant = await Tenant.findOne(
    { id: Number(tenantId) },
    {
      _id: 0,
      id: 1,
      name: 1,
      is_active: 1,
      created_at: 1,
      subscription_id: 1,
      payment_customer_id: 1,
      subscription_start: 1,
      subscription_end: 1,
      plan_id: 1,
      payment_gateway_product_id: 1,
      isTrialPlan: 1,
      hasTrial: 1,
    }
  ).lean();

  if (!tenant) return null;

  let plan = null;
  if (tenant.payment_gateway_product_id || tenant.plan_id) {
    plan = await Plan.findOne({
      $or: [
        ...(tenant.payment_gateway_product_id ? [{ payment_gateway_product_id: tenant.payment_gateway_product_id }] : []),
        ...(tenant.plan_id ? [{ id: tenant.plan_id }] : []),
      ],
      is_deleted: false,
    }).lean();
  }

  return {
    ...tenant,
    plan_title: plan?.title || "Starter",
    payment_gateway_product_id: plan?.payment_gateway_product_id || tenant.payment_gateway_product_id || null,
  };
};

exports.getTenantStoreDetailsDB = async (tenantId) => {
  const store = await StoreDetails.findOne(
    { tenant_id: Number(tenantId) },
    {
      _id: 0,
      tenant_id: 1,
      store_name: 1,
      address: 1,
      phone: 1,
      email: 1,
      currency: 1,
      is_qr_menu_enabled: 1,
      unique_qr_code: 1,
    }
  ).lean();
  return store || null;
};

exports.getTenantsDB = async (page, perPage, search, status, type, from, to) => {
  const currentPage = parseInt(page) || 1;
  const limit = parseInt(perPage) || 5;
  const offset = (currentPage - 1) * limit;

  const match = {};
  if (status === "active") match.is_active = 1;
  else if (status === "inactive") match.is_active = 0;

  const dateFilter = buildDateFilter("created_at", type, from, to);
  Object.assign(match, dateFilter);

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "users",
        let: { tId: "$id" },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ["$tenant_id", "$$tId"] }, { $eq: ["$role", "admin"] }] } } },
          { $project: { username: 1 } },
          { $limit: 1 },
        ],
        as: "adminUser",
      },
    },
    {
      $addFields: {
        email: { $arrayElemAt: ["$adminUser.username", 0] },
      },
    },
  ];

  if (search) {
    const regex = new RegExp(search, "i");
    pipeline.push({
      $match: {
        $or: [{ name: regex }, { email: regex }],
      },
    });
  }

  pipeline.push({
    $lookup: {
      from: "plans",
      let: { pId: "$payment_gateway_product_id", planId: "$plan_id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $or: [
                { $and: [{ $ne: ["$$pId", null] }, { $eq: ["$payment_gateway_product_id", "$$pId"] }] },
                { $and: [{ $ne: ["$$planId", null] }, { $eq: ["$id", "$$planId"] }] },
              ],
            },
          },
        },
        { $limit: 1 },
      ],
      as: "matchedPlan",
    },
  });

  pipeline.push({
    $addFields: {
      plan_title: { $ifNull: [{ $arrayElemAt: ["$matchedPlan.title", 0] }, "Starter"] },
      payment_gateway_product_id: {
        $ifNull: ["$payment_gateway_product_id", { $arrayElemAt: ["$matchedPlan.payment_gateway_product_id", 0] }],
      },
    },
  });

  pipeline.push({ $sort: { id: -1 } });
  pipeline.push({ $skip: offset });
  pipeline.push({ $limit: limit });

  const tenants = await Tenant.aggregate(pipeline);

  return {
    tenants,
    currentPage,
    perPage: limit,
  };
};

exports.addTenantDB = async ({ name, email, password, isAdmin, isActive }) => {
  const userExist = await doUserExistDB(email);
  if (userExist) {
    throw "User already exist! Try Different Email!";
  }

  const tenant = await Tenant.create({
    name,
    is_active: isActive ? 1 : 0,
  });

  const encryptedPassword = await bcrypt.hash(password, CONFIG.PASSWORD_SALT);
  const role = isAdmin ? "admin" : "user";

  await User.create({
    username: email,
    password: encryptedPassword,
    name,
    role,
    tenant_id: tenant.id,
  });

  return { tenantId: tenant.id, name, isActive, role };
};

exports.getTenantCntByIdDB = async (tenantId) => {
  const count = await Tenant.countDocuments({ id: Number(tenantId) });
  return count;
};

exports.getTenantDetailsByIdDB = async (tenantId) => {
  const tId = Number(tenantId);
  const tenant = await Tenant.findOne({ id: tId }).lean();
  if (!tenant) return null;

  const user = await User.findOne({ tenant_id: tId }).lean();
  return {
    is_active: tenant.is_active,
    username: user ? user.username : null,
  };
};

exports.updateTenantDB = async (
  tenantId,
  name,
  email,
  isActive,
  existingEmail,
  subscription_start,
  subscription_end,
  payment_gateway_product_id
) => {
  const tId = Number(tenantId);
  const tenant = await Tenant.findOne({ id: tId });
  if (!tenant) throw new Error("Tenant not found");

  const tenantUpdates = {
    is_active: isActive ? 1 : 0,
    name,
  };

  // Find the selected Plan
  let selectedPlan = null;
  if (payment_gateway_product_id) {
    selectedPlan = await Plan.findOne({
      $or: [
        { payment_gateway_product_id: String(payment_gateway_product_id).trim() },
        { id: !isNaN(payment_gateway_product_id) ? Number(payment_gateway_product_id) : -1 },
        { title: new RegExp(`^${String(payment_gateway_product_id).trim()}$`, "i") },
      ],
      is_deleted: false,
    }).lean();
  }

  if (selectedPlan) {
    tenantUpdates.payment_gateway_product_id = selectedPlan.payment_gateway_product_id;
    tenantUpdates.plan_id = selectedPlan.id;
    tenantUpdates.plan_title = selectedPlan.title;
  } else if (payment_gateway_product_id) {
    tenantUpdates.payment_gateway_product_id = payment_gateway_product_id;
  }

  // Handle subscription start
  if (subscription_start !== undefined && subscription_start !== null && subscription_start !== "") {
    tenantUpdates.subscription_start = new Date(subscription_start);
  } else if (isActive && !tenant.subscription_start) {
    tenantUpdates.subscription_start = new Date();
  }

  // Handle subscription end
  if (subscription_end !== undefined && subscription_end !== null && subscription_end !== "") {
    tenantUpdates.subscription_end = new Date(subscription_end);
  } else if (isActive && (!tenant.subscription_end || new Date(tenant.subscription_end) < new Date())) {
    // Default 1 year from now if activated by admin without explicit end date
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    tenantUpdates.subscription_end = oneYearLater;
  }

  // Only bump token_version for security-relevant changes (email or active status change).
  // Routine updates (name, plan, subscription dates) must NOT invalidate active sessions.
  const currentUser = await User.findOne({ tenant_id: tId, username: existingEmail }).lean();
  const emailChanging = currentUser && currentUser.username !== email;
  const activeStatusChanging = tenant.is_active !== (isActive ? 1 : 0);
  if (emailChanging || activeStatusChanging) {
    tenantUpdates.token_version = (tenant.token_version || 1) + 1;
  }

  await Tenant.updateOne({ id: tId }, { $set: tenantUpdates });

  // Record history log
  const effectiveStarts = tenantUpdates.subscription_start || tenant.subscription_start || new Date();
  const effectiveExpires = tenantUpdates.subscription_end || tenant.subscription_end || null;
  await SubscriptionHistory.create({
    tenant_id: tId,
    starts_on: effectiveStarts,
    expires_on: effectiveExpires,
    status: selectedPlan ? "plan_changed" : isActive ? "updated" : "cancelled",
  }).catch((e) => console.error("Subscription history log error:", e));

  if (currentUser) {
    const updates = {};
    if (currentUser.name !== name) {
      updates.name = name;
    }
    if (currentUser.username !== email) {
      updates.username = email;
    }
    if (Object.keys(updates).length > 0) {
      await User.updateOne({ tenant_id: tId, username: existingEmail }, { $set: updates });
    }
  }

  return {
    success: true,
    tenant_id: tId,
    plan_title: selectedPlan?.title || null,
    payment_gateway_product_id: tenantUpdates.payment_gateway_product_id || null,
  };
};

exports.logoutAllUsersOfTenantDB = async (tenantId) => {
  await RefreshToken.deleteMany({ tenant_id: Number(tenantId) });
};

exports.deleteTenantDB = async (tenantId) => {
  const tId = Number(tenantId);
  await Tenant.deleteOne({ id: tId });
  await User.deleteMany({ tenant_id: tId });
  await StoreDetails.deleteOne({ tenant_id: tId });
  await RefreshToken.deleteMany({ tenant_id: tId });
};

exports.getRestaurantsTotalCustomersDB = async () => {
  const count = await Customer.countDocuments();
  return count;
};

exports.getTenantsDataByStatusDB = async (is_active) => {
  const match = {};
  if (is_active !== null && is_active !== undefined) {
    match.is_active = Number(is_active);
  }

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "users",
        let: { tId: "$id" },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ["$tenant_id", "$$tId"] }, { $eq: ["$role", "admin"] }] } } },
          { $project: { username: 1 } },
          { $limit: 1 },
        ],
        as: "adminUser",
      },
    },
    {
      $addFields: {
        email: { $arrayElemAt: ["$adminUser.username", 0] },
      },
    },
  ];

  return await Tenant.aggregate(pipeline);
};

exports.getSuperAdminTopSellingItemsDB = async (type, from, to) => {
  const dateFilter = buildDateFilter("date", type, from, to);
  const results = await OrderItem.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: { item_id: "$item_id", tenant_id: "$tenant_id" },
        qty: { $sum: 1 },
      },
    },
    { $sort: { qty: -1 } },
    { $limit: 50 },
    {
      $lookup: {
        from: "menu_items",
        localField: "_id.item_id",
        foreignField: "id",
        as: "item",
      },
    },
    { $unwind: { path: "$item", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "tenants",
        localField: "_id.tenant_id",
        foreignField: "id",
        as: "tenant",
      },
    },
    { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        tenant_id: "$_id.tenant_id",
        tenant_name: { $ifNull: ["$tenant.name", ""] },
        item_id: "$_id.item_id",
        title: { $ifNull: ["$item.title", ""] },
        qty: 1,
      },
    },
    { $sort: { qty: -1 } },
  ]);

  return results;
};

exports.getSuperAdminSalesVolumeDB = async (type, from, to) => {
  const dateFilter = buildDateFilter("created_at", type, from, to);
  const results = await Invoice.aggregate([
    { $match: dateFilter },
    {
      $lookup: {
        from: "store_details",
        localField: "tenant_id",
        foreignField: "tenant_id",
        as: "store",
      },
    },
    { $unwind: { path: "$store", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "exchange_rates",
        localField: "store.currency",
        foreignField: "currency_code",
        as: "rate",
      },
    },
    { $unwind: { path: "$rate", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        usd_total: {
          $multiply: ["$total", { $ifNull: ["$rate.rate_to_usd", 1] }],
        },
      },
    },
    {
      $group: {
        _id: null,
        sales_volume: { $sum: "$usd_total" },
      },
    },
  ]);

  return results[0]?.sales_volume || 0;
};

exports.getSuperAdminOrdersProcessedDB = async (type, from, to) => {
  const dateFilter = buildDateFilter("date", type, from, to);
  const count = await Order.countDocuments(dateFilter);
  return count;
};

exports.upsertGatewayDB = async (gatewayName, credentials) => {
  const credsStr = typeof credentials === "string" ? credentials : JSON.stringify(credentials);
  await PaymentGateway.findOneAndUpdate(
    { gateway_name: gatewayName },
    { $set: { credentials: credsStr } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return true;
};

exports.getGatewayDB = async (paymentGatewayName) => {
  const row = await PaymentGateway.findOne({ gateway_name: paymentGatewayName }).lean();
  if (!row) return null;
  let creds = null;
  try {
    creds = row.credentials ? JSON.parse(row.credentials) : null;
  } catch (e) {
    creds = row.credentials;
  }
  return {
    id: row.id,
    gateway_name: row.gateway_name,
    status: row.status ? 1 : 0,
    credentials: creds,
    created_at: row.created_at,
  };
};

exports.updateGatewayStatusDB = async (paymentGatewayName, status) => {
  await PaymentGateway.findOneAndUpdate(
    { gateway_name: paymentGatewayName },
    { $set: { status: !!status } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // If all gateways were turned off, fallback paystack as primary active
  const activeCount = await PaymentGateway.countDocuments({ status: true });
  if (activeCount === 0) {
    await PaymentGateway.findOneAndUpdate(
      { gateway_name: "paystack" },
      { $set: { status: true } },
      { upsert: true }
    );
  }
  return true;
};

exports.activatePaymentGatewayDB = async () => {
  let row = await PaymentGateway.findOne({ status: true }).lean();
  if (!row) {
    row = await PaymentGateway.findOne({ gateway_name: "paystack" }).lean();
  }
  if (!row) {
    row = await PaymentGateway.findOne().lean();
  }
  if (!row) return null;

  let creds = null;
  try {
    creds = row.credentials ? JSON.parse(row.credentials) : null;
  } catch (e) {
    creds = row.credentials;
  }
  return {
    id: row.id,
    gateway_name: row.gateway_name,
    status: row.status ? 1 : 0,
    credentials: creds,
    created_at: row.created_at,
  };
};

exports.getAllPaymentGatewaysDB = async () => {
  const rows = await PaymentGateway.find().lean();
  return rows.map((row) => {
    let creds = null;
    try {
      creds = row.credentials ? JSON.parse(row.credentials) : null;
    } catch (e) {
      creds = row.credentials;
    }
    return {
      id: row.id,
      gateway_name: row.gateway_name,
      status: row.status ? 1 : 0,
      credentials: creds,
      created_at: row.created_at,
    };
  });
};
