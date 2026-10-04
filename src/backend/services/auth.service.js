const bcrypt = require("bcrypt");
const { CONFIG } = require("../config/index");
const {
  User,
  Tenant,
  Plan,
  RefreshToken,
  ResetPasswordToken,
  SubscriptionHistory,
  PaymentGateway,
  StoreDetails,
  PrintSetting,
  InvoiceSequence,
  TokenSequence,
} = require("../models");

exports.signInDB = async (username, password) => {
  try {
    const user = await User.findOne({ username }).lean();
    if (!user) return null;

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return null;

    let tenant = null;
    let plan = null;
    if (user.tenant_id) {
      tenant = await Tenant.findOne({ id: user.tenant_id }).lean();
      if (tenant?.payment_gateway_product_id || tenant?.plan_id) {
        plan = await Plan.findOne({
          $or: [
            ...(tenant.payment_gateway_product_id ? [{ payment_gateway_product_id: tenant.payment_gateway_product_id }] : []),
            ...(tenant.plan_id ? [{ id: tenant.plan_id }] : []),
          ],
          is_deleted: false,
        }).lean();
      }
      if (!plan) {
        plan = await Plan.findOne({ is_deleted: false }).sort({ id: 1 }).lean();
      }
    }

    let parsedPlanFeatures = [];
    if (plan?.features) {
      try {
        parsedPlanFeatures = typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features;
      } catch {
        parsedPlanFeatures = String(plan.features).split(",").map((s) => s.trim());
      }
    }

    return {
      username: user.username,
      password: user.password,
      name: user.name,
      role: user.role,
      photo: user.photo,
      designation: user.designation,
      phone: user.phone,
      email: user.email,
      scope: user.scope,
      tenant_id: user.tenant_id,
      is_active: tenant?.is_active ?? 0,
      subscription_start: tenant?.subscription_start || null,
      subscription_end: tenant?.subscription_end || null,
      payment_gateway_product_id: plan?.payment_gateway_product_id || tenant?.payment_gateway_product_id || null,
      token_version: tenant?.token_version || 1,
      plan_title: plan?.title || null,
      is_trial: plan?.is_trial || 0,
      trial_days: plan?.trial_days || 0,
      features_description: plan?.features_description || null,
      features: plan?.features || null,
      planFeatures: parsedPlanFeatures,
      planFeautures: parsedPlanFeatures,
      plan_features: parsedPlanFeatures,
    };
  } catch (error) {
    console.error("signInDB Error:", error);
    throw error;
  }
};

exports.getUserDB = async (username, tenantId) => {
  try {
    const user = await User.findOne({ username, tenant_id: tenantId }).lean();
    if (!user) return null;

    let tenant = null;
    let plan = null;
    if (tenantId) {
      tenant = await Tenant.findOne({ id: tenantId }).lean();
      if (tenant?.payment_gateway_product_id || tenant?.plan_id) {
        plan = await Plan.findOne({
          $or: [
            ...(tenant.payment_gateway_product_id ? [{ payment_gateway_product_id: tenant.payment_gateway_product_id }] : []),
            ...(tenant.plan_id ? [{ id: tenant.plan_id }] : []),
          ],
          is_deleted: false,
        }).lean();
      }
      if (!plan) {
        plan = await Plan.findOne({ is_deleted: false }).sort({ id: 1 }).lean();
      }
    }

    let parsedPlanFeatures = [];
    if (plan?.features) {
      try {
        parsedPlanFeatures = typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features;
      } catch {
        parsedPlanFeatures = String(plan.features).split(",").map((s) => s.trim());
      }
    }

    return {
      username: user.username,
      name: user.name,
      role: user.role,
      designation: user.designation,
      photo: user.photo,
      phone: user.phone,
      email: user.email,
      scope: user.scope,
      tenant_id: user.tenant_id,
      token_version: tenant?.token_version || 1,
      is_active: tenant?.is_active ?? 0,
      isTrialPlan: tenant?.isTrialPlan ?? 0,
      subscription_start: tenant?.subscription_start || null,
      subscription_end: tenant?.subscription_end || null,
      payment_gateway_product_id: tenant?.payment_gateway_product_id || null,
      planFeatures: plan?.features || null,
      planFeautures: parsedPlanFeatures,
      features: plan?.features || null,
      features_description: plan?.features_description || null,
      plan_title: plan?.title || null,
      is_trial: plan?.is_trial || 0,
      trial_days: plan?.trial_days || 0,
      plan_features: parsedPlanFeatures,
    };
  } catch (error) {
    console.error("getUserDB Error:", error);
    throw error;
  }
};

exports.checkEmailExistsDB = async (email) => {
  try {
    const user = await User.findOne({ username: email }).select("username").lean();
    return !!user;
  } catch (error) {
    console.error("checkEmailExistsDB Error:", error);
    throw error;
  }
};

exports.checkEmailExistsSuperadminDB = async (email, tenantId) => {
  try {
    const user = await User.findOne({ username: email, tenant_id: { $ne: tenantId } }).select("username").lean();
    return !!user;
  } catch (error) {
    console.error("checkEmailExistsSuperadminDB Error:", error);
    throw error;
  }
};

exports.signUpDB = async (bizName, username, password) => {
  try {
    const tenant = await Tenant.create({
      name: bizName,
      is_active: 0,
      subscription_id: null,
    });

    await User.create({
      username,
      password,
      name: bizName,
      role: "admin",
      tenant_id: tenant.id,
    });

    // Create default records for tenant
    await StoreDetails.create({
      tenant_id: tenant.id,
      store_name: bizName,
      currency: "NGN",
    }).catch(() => {});

    await PrintSetting.create({
      tenant_id: tenant.id,
      page_format: "58mm",
      is_enable_print: true,
      show_store_details: true,
      show_customer_details: true,
      print_token: true,
      show_notes: true,
    }).catch(() => {});

    await InvoiceSequence.create({
      tenant_id: tenant.id,
      sequence_no: 0,
    }).catch(() => {});

    await TokenSequence.create({
      tenant_id: tenant.id,
      sequence_no: 0,
      last_updated: new Date(),
    }).catch(() => {});

    return tenant.id;
  } catch (error) {
    console.error("signUpDB Error:", error);
    throw error;
  }
};

exports.addRefreshTokenDB = async (username, refreshToken, expiry, deviceIP, deviceName, deviceLocation, tenantId) => {
  try {
    const item = await RefreshToken.create({
      username,
      refresh_token: refreshToken,
      device_ip: deviceIP,
      device_name: deviceName,
      device_location: deviceLocation,
      expiry,
      tenant_id: tenantId,
    });
    return item.device_id || item._id;
  } catch (error) {
    console.error("addRefreshTokenDB Error:", error);
    throw error;
  }
};

exports.removeRefreshTokenDB = async (username, refreshToken) => {
  try {
    await RefreshToken.deleteMany({
      $or: [
        { username, refresh_token: refreshToken },
        { username, expiry: { $lt: new Date() } },
      ],
    });
  } catch (error) {
    console.error("removeRefreshTokenDB Error:", error);
    throw error;
  }
};

exports.removeRefreshTokenByDeviceIdDB = async (username, deviceId) => {
  try {
    await RefreshToken.deleteMany({
      $or: [
        { username, device_id: deviceId },
        { username, expiry: { $lt: new Date() } },
      ],
    });
  } catch (error) {
    console.error("removeRefreshTokenByDeviceIdDB Error:", error);
    throw error;
  }
};

exports.getDevicesDB = async (username) => {
  try {
    return await RefreshToken.find({ username })
      .select("device_id refresh_token device_ip device_name device_location created_at")
      .lean();
  } catch (error) {
    console.error("getDevicesDB Error:", error);
    throw error;
  }
};

exports.verifyRefreshTokenDB = async (refreshToken) => {
  try {
    return await RefreshToken.findOne({ refresh_token: refreshToken })
      .select("username refresh_token")
      .lean();
  } catch (error) {
    console.error("verifyRefreshTokenDB Error:", error);
    throw error;
  }
};

exports.forgotPasswordDB = async (email, token, tokenValidity) => {
  try {
    await ResetPasswordToken.findOneAndUpdate(
      { username: email },
      { reset_token: token, expires_at: tokenValidity },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("forgotPasswordDB Error:", error);
    throw error;
  }
};

exports.deleteForgotPasswordTokenDB = async (token) => {
  try {
    await ResetPasswordToken.deleteMany({ reset_token: token });
  } catch (error) {
    console.error("deleteForgotPasswordTokenDB Error:", error);
    throw error;
  }
};

exports.checkForgotPasswordTokenDB = async (token, date) => {
  try {
    const rt = await ResetPasswordToken.findOne({
      reset_token: token,
      expires_at: { $gt: date },
    }).lean();

    if (!rt) return null;

    const user = await User.findOne({ username: rt.username }).select("tenant_id").lean();

    return {
      username: rt.username,
      tenant_id: user?.tenant_id || null,
      reset_token: rt.reset_token,
      expires_at: rt.expires_at,
    };
  } catch (error) {
    console.error("checkForgotPasswordTokenDB Error:", error);
    throw error;
  }
};

exports.getSubscriptionDetailsDB = async (tenantId) => {
  try {
    const tenant = await Tenant.findOne({ id: tenantId }).lean();
    if (!tenant) return null;

    const latestSubHistory = await SubscriptionHistory.findOne({ tenant_id: tenantId })
      .sort({ created_at: -1 })
      .lean();

    const gateway = await PaymentGateway.findOne({ status: true }).lean();

    return {
      id: tenant.id,
      name: tenant.name,
      is_active: tenant.is_active,
      subscription_id: tenant.subscription_id,
      payment_customer_id: tenant.payment_customer_id,
      subscription_start: tenant.subscription_start,
      subscription_end: tenant.subscription_end,
      isTrialPlan: tenant.isTrialPlan,
      status: latestSubHistory?.status || null,
      starts_on: latestSubHistory?.starts_on || null,
      expires_on: latestSubHistory?.expires_on || null,
      payment_gateway: gateway?.gateway_name || null,
    };
  } catch (error) {
    console.error("getSubscriptionDetailsDB Error:", error);
    throw error;
  }
};

exports.updateTenantSubscriptionAccess = async (
  email,
  status,
  subscriptionId,
  paymentCustomerId,
  subscriptionStartTimestamp,
  subscriptionEndTimestamp
) => {
  try {
    const user = await User.findOne({ username: email }).select("tenant_id").lean();
    if (!user?.tenant_id) return;

    await Tenant.updateOne(
      { id: user.tenant_id },
      {
        $set: {
          is_active: status,
          subscription_id: subscriptionId,
          payment_customer_id: paymentCustomerId,
          subscription_start: subscriptionStartTimestamp,
          subscription_end: subscriptionEndTimestamp,
        },
      }
    );
  } catch (error) {
    console.error("updateTenantSubscriptionAccess Error:", error);
    throw error;
  }
};

exports.addTenantSubsctiptionDetails = async (email, productId, priceId) => {
  try {
    const user = await User.findOne({ username: email }).select("tenant_id").lean();
    if (!user?.tenant_id) return;

    await Tenant.updateOne(
      { id: user.tenant_id },
      {
        $set: {
          payment_gateway_product_id: productId,
          payment_gateway_price_id: priceId,
        },
      }
    );
  } catch (error) {
    console.error("addTenantSubsctiptionDetails Error:", error);
    throw error;
  }
};

exports.updateTenantTrialStatus = async (email, hasTrial) => {
  try {
    const user = await User.findOne({ username: email }).select("tenant_id").lean();
    if (!user?.tenant_id) return;

    await Tenant.updateOne({ id: user.tenant_id }, { $set: { hasTrial } });
  } catch (error) {
    console.error("updateTenantTrialStatus Error:", error);
    throw error;
  }
};

exports.updateTenantIsTrailRunningStatus = async (email, isTrailPlanRuning) => {
  try {
    const user = await User.findOne({ username: email }).select("tenant_id").lean();
    if (!user?.tenant_id) return;

    await Tenant.updateOne({ id: user.tenant_id }, { $set: { isTrialPlan: isTrailPlanRuning } });
  } catch (error) {
    console.error("updateTenantIsTrailRunningStatus Error:", error);
    throw error;
  }
};

exports.updateSubscriptionHistory = async (tenantId, starts_on, expires_on, status) => {
  try {
    await SubscriptionHistory.create({
      tenant_id: tenantId,
      created_at: new Date(),
      starts_on,
      expires_on,
      status,
    });
  } catch (error) {
    console.error("updateSubscriptionHistory Error:", error);
    throw error;
  }
};

exports.getTenantIdFromCustomerEmail = async (customerEmail) => {
  try {
    const user = await User.findOne({ username: customerEmail }).select("tenant_id").lean();
    return user?.tenant_id || null;
  } catch (error) {
    console.error("getTenantIdFromCustomerEmail Error:", error);
    throw error;
  }
};

exports.getTenantById = async (tenantId) => {
  try {
    return await Tenant.findOne({ id: tenantId })
      .select("hasTrial is_active token_version")
      .lean();
  } catch (error) {
    console.error("getTenantById Error:", error);
    throw error;
  }
};

exports.getUserDeviceId = async (username) => {
  try {
    const item = await RefreshToken.findOne({ username }).select("device_id").lean();
    return item?.device_id || null;
  } catch (error) {
    console.error("getUserDeviceId Error:", error);
    throw error;
  }
};

exports.rotateRefreshTokenDB = async (
  username,
  deviceIP,
  deviceName,
  deviceLocation,
  newRefreshToken,
  tenantId
) => {
  try {
    await RefreshToken.create({
      username,
      tenant_id: tenantId,
      refresh_token: newRefreshToken,
      expiry: new Date(Date.now() + Number(CONFIG.COOKIE_EXPIRY_REFRESH)),
      device_ip: deviceIP,
      device_name: deviceName,
      device_location: deviceLocation,
    });
    return true;
  } catch (error) {
    console.error("rotateRefreshTokenDB Error:", error);
    throw error;
  }
};

exports.removeRefreshTokenByTenanatId = async (tenantId) => {
  try {
    await RefreshToken.deleteMany({ tenant_id: tenantId });
    return true;
  } catch (error) {
    console.error("removeRefreshTokenByTenanatId Error:", error);
    throw error;
  }
};
