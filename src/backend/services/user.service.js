const { User, Tenant, Plan, RefreshToken } = require("../models");

exports.getUserDB = async (username, tenantId) => {
  const results = await User.aggregate([
    {
      $match: {
        username: username,
        tenant_id: Number(tenantId),
      },
    },
    {
      $lookup: {
        from: "tenants",
        localField: "tenant_id",
        foreignField: "id",
        as: "tenant",
      },
    },
    {
      $unwind: {
        path: "$tenant",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "plans",
        let: { pId: "$tenant.payment_gateway_product_id", planId: "$tenant.plan_id" },
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
        as: "plan",
      },
    },
    {
      $unwind: {
        path: "$plan",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        username: 1,
        role: 1,
        scope: 1,
        plan_features: "$plan.features",
        features_description: "$plan.features_description",
        plan_title: "$plan.title",
        is_active: "$tenant.is_active",
        subscription_start: "$tenant.subscription_start",
        subscription_end: "$tenant.subscription_end",
        payment_gateway_product_id: "$tenant.payment_gateway_product_id",
        name: "$tenant.name",
      },
    },
    { $limit: 1 },
  ]);

  if (!results[0]) return null;
  const user = results[0];

  let parsedFeatures = [];
  if (user.plan_features) {
    if (Array.isArray(user.plan_features)) {
      parsedFeatures = user.plan_features;
    } else if (typeof user.plan_features === "string") {
      try {
        const p = JSON.parse(user.plan_features);
        parsedFeatures = Array.isArray(p) ? p : [user.plan_features];
      } catch {
        parsedFeatures = user.plan_features.split(",").map((s) => s.trim());
      }
    }
  }

  // Fallback: If no plan features were loaded for this tenant, look up the default active plan
  if (parsedFeatures.length === 0) {
    const defaultPlan = await Plan.findOne({ is_deleted: false }).sort({ id: 1 }).lean();
    if (defaultPlan?.features) {
      try {
        parsedFeatures =
          typeof defaultPlan.features === "string"
            ? JSON.parse(defaultPlan.features)
            : defaultPlan.features;
      } catch {
        parsedFeatures = String(defaultPlan.features)
          .split(",")
          .map((s) => s.trim());
      }
      user.plan_title = defaultPlan.title;
    }
  }

  user.plan_features = parsedFeatures;
  user.planFeatures = parsedFeatures;
  user.planFeautures = parsedFeatures;
  return user;
};

exports.getAllUsersDB = async (tenantId) => {
  const users = await User.find(
    { tenant_id: Number(tenantId) },
    { _id: 0, username: 1, name: 1, role: 1, photo: 1, designation: 1, phone: 1, email: 1, scope: 1 }
  )
    .sort({ role: 1, name: 1 })
    .lean();

  return users;
};

exports.doUserExistDB = async (username) => {
  const exists = await User.exists({ username: username });
  return !!exists;
};

exports.addUserDB = async (
  tenantId,
  username,
  encryptedPassword,
  name,
  role,
  photo,
  designation,
  phone,
  email,
  scope
) => {
  await User.create({
    tenant_id: Number(tenantId),
    username,
    password: encryptedPassword,
    name: name || "",
    role: role || "user",
    photo: photo || null,
    designation: designation || null,
    phone: phone || null,
    email: email || null,
    scope: scope || null,
  });
};

exports.deleteUserDB = async (username, tenantId) => {
  const tId = Number(tenantId);
  await RefreshToken.deleteMany({ username, tenant_id: tId });
  await User.deleteOne({ username, tenant_id: tId });
};

exports.deleteUserRefreshTokensDB = async (username, tenantId) => {
  await RefreshToken.deleteMany({ username, tenant_id: Number(tenantId) });
};

exports.updateUserDB = async (username, name, photo, designation, phone, email, scope, tenantId) => {
  await User.updateOne(
    { username, tenant_id: Number(tenantId) },
    {
      $set: {
        name,
        photo,
        designation,
        phone,
        email,
        scope,
      },
    }
  );
};

exports.updateUserPasswordDB = async (username, password, tenantId) => {
  await User.updateOne(
    { username, tenant_id: Number(tenantId) },
    {
      $set: {
        password,
      },
    }
  );
};