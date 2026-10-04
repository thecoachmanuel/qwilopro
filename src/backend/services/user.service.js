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
        localField: "tenant.payment_gateway_product_id",
        foreignField: "payment_gateway_product_id",
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
        is_active: "$tenant.is_active",
        name: "$tenant.name",
      },
    },
    { $limit: 1 },
  ]);

  return results[0] || null;
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