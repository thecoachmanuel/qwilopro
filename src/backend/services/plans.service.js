const { Plan, PlanPrice, Tenant, StoreDetails, SubscriptionHistory, PaymentGateway } = require("../models");
const { CONFIG } = require("../config");
const Stripe = require("stripe");
const Paystack = require("paystack");
const fetch = require("node-fetch");
const axios = require("axios");
const { applyDiscount } = require("../utils/applyDiscount");
const { toStripeAmount } = require("../utils/toStripeAmount");
const { getGatewayDB, activatePaymentGatewayDB } = require("./superadmin.service");
const { decryptCredentials } = require("../utils/encryptCredentials");

exports.getPaymentGateway = (key) => {
  switch (key.gateway_name) {
    case "paystack":
      return {
        name: "paystack",
        createProduct: async (title) => {
          const secretKey = key.credentials?.secret_key || process.env.PAYSTACK_SECRET_KEY;
          const paystack = new Paystack(secretKey);
          return { productId: `PAYSTACK_${Date.now()}`, client: paystack };
        },
        createPrice: async ({ client, amount, currency, interval, trial_days, productId }) => {
          const intervalType = interval === "month" ? "monthly" : "annually";
          const psPlan = await client.plan.create({
            name: `${productId} ${intervalType}`,
            amount: Math.round(amount * 100),
            currency: currency || "NGN",
            interval: intervalType,
          });
          if (psPlan.code?.includes("invalid_amount")) {
            throw new Error(psPlan.message);
          }
          return psPlan.data?.plan_code || `PLN_${Date.now()}`;
        },
      };

    case "stripe":
      return {
        name: "stripe",
        createProduct: async (title) => {
          const stripe = new Stripe(key.credentials.secret_key);
          const product = await stripe.products.create({ name: title });
          return { productId: product.id, client: stripe };
        },
        createPrice: async ({ client, amount, currency, interval, trial_days, productId }) => {
          const price = await client.prices.create({
            unit_amount: toStripeAmount(amount, currency),
            currency,
            recurring: trial_days ? { interval, trial_period_days: trial_days } : { interval },
            product: productId,
          });
          return price.id;
        },
      };

    default:
      return { error: "UNSUPPORTED_PAYMENT_GATEWAY" };
  }
};

exports.createPlanDB = async (
  title,
  features_description,
  features,
  trial_days,
  is_trial = 0,
  is_recommended = 0,
  discount = 0,
  yearlyDiscount = 0,
  currencies
) => {
  const getPaymentGateway = exports.getPaymentGateway;
  try {
    if (!title || !currencies?.length) throw new Error("Invalid data");

    const key = await activatePaymentGatewayDB();
    if (!key?.credentials) {
      throw new Error("Payment gateway not configured");
    }
    const decryptedCredentials = decryptCredentials(key.credentials);
    const keyData = {
      ...key,
      credentials: decryptedCredentials,
    };
    const gateway = getPaymentGateway(keyData);

    if (gateway.error) {
      throw new Error(gateway.error);
    }

    // create product
    const { productId, client } = await gateway.createProduct(title);

    // insert plan
    const plan = await Plan.create({
      payment_gateway_product_id: productId,
      title,
      is_recommended: !!is_recommended,
      is_trial: !!is_trial,
      trial_days: trial_days || null,
      features_description: JSON.stringify(features_description || []),
      features: JSON.stringify(features || []),
      discount: Number(discount) || 0,
      yearly_discount: Number(yearlyDiscount) || 0,
      payment_gateway: gateway.name,
    });

    const plan_id = plan.id;

    // prices
    for (const c of currencies) {
      const monthlyAmount = applyDiscount(c.monthly, discount);
      const yearlyAmount = applyDiscount(c.yearly, yearlyDiscount);

      const monthlyPriceId = await gateway.createPrice({
        client,
        amount: monthlyAmount,
        currency: c.currency,
        interval: "month",
        trial_days: is_trial ? trial_days : null,
        productId,
      });

      const yearlyPriceId = await gateway.createPrice({
        client,
        amount: yearlyAmount,
        currency: c.currency,
        interval: "year",
        trial_days: is_trial ? trial_days : null,
        productId,
      });

      await PlanPrice.create({
        plan_id,
        country: c.country,
        currency: c.currency,
        symbol: c.symbol,
        is_default: !!c.is_default,
        frequency: "monthly",
        amount: monthlyAmount,
        payment_gateway_price_id: monthlyPriceId,
        is_active: true,
      });

      await PlanPrice.create({
        plan_id,
        country: c.country,
        currency: c.currency,
        symbol: c.symbol,
        is_default: !!c.is_default,
        frequency: "yearly",
        amount: yearlyAmount,
        payment_gateway_price_id: yearlyPriceId,
        is_active: true,
      });
    }

    return { success: true, plan_id };
  } catch (error) {
    console.error("Create Plan Error :", error);
    throw error;
  }
};

exports.updatePlanDB = async (planId, title, features_description, features, is_recommended = 0) => {
  try {
    const plan = await Plan.findOne({ id: Number(planId) });
    if (!plan) throw new Error("Plan not found");

    const row = await getGatewayDB("stripe");
    if (row?.credentials) {
      const creds = decryptCredentials(row.credentials);
      const stripe = new Stripe(creds?.secret_key);
      try {
        await stripe.products.update(plan.payment_gateway_product_id, {
          name: title,
        });
      } catch (err) {
        console.error("Stripe product update error:", err);
      }
    }

    await Plan.updateOne(
      { id: Number(planId) },
      {
        $set: {
          title,
          is_recommended: !!is_recommended,
          features_description: JSON.stringify(features_description || []),
          features: JSON.stringify(features || []),
          updated_at: new Date(),
        },
      }
    );
  } catch (error) {
    console.error("Update Plan Error :", error);
    throw error;
  }
};

exports.updateTokenVersion = async (tenantId) => {
  await Tenant.updateOne({ id: Number(tenantId) }, { $inc: { token_version: 1 } });
};

exports.updateTenantPlan = async ({
  subscriptionId,
  currentPlanPriceId,
  nextPlanPriceId,
  newPlanId,
  newEndDateStr,
}) => {
  await Tenant.updateOne(
    { subscription_id: subscriptionId },
    {
      $set: {
        payment_gateway_price_id: currentPlanPriceId,
        subscription_end: newEndDateStr,
        stripe_next_price_id: nextPlanPriceId,
        payment_gateway_product_id: newPlanId,
      },
    }
  );
};

exports.resetQRMenuSettings = async (tenantId) => {
  await StoreDetails.updateOne(
    { tenant_id: Number(tenantId) },
    {
      $set: {
        is_qr_menu_enabled: 0,
        is_qr_order_enabled: 0,
        is_feedback_enabled: 0,
      },
    }
  );
};

exports.getPlansDB = async (page = 1, perPage = 10) => {
  const activeGateways = await PaymentGateway.find({ status: true }, { gateway_name: 1 }).lean();
  let activeGatewayNames = activeGateways.map((g) => g.gateway_name);
  if (activeGatewayNames.length === 0) {
    activeGatewayNames = ["paystack"];
  }

  const plans = await Plan.find({
    is_deleted: false,
    $or: [
      { payment_gateway: { $in: activeGatewayNames } },
      { payment_gateway: null },
      { payment_gateway: { $exists: false } },
    ],
  })
    .sort({ id: -1 })
    .lean();

  const planIds = plans.map((p) => p.id);
  const prices = await PlanPrice.find({ plan_id: { $in: planIds } }).lean();

  const pricesByPlan = {};
  for (const pr of prices) {
    if (!pricesByPlan[pr.plan_id]) pricesByPlan[pr.plan_id] = [];
    pricesByPlan[pr.plan_id].push({
      price_id: pr.id,
      country: pr.country,
      currency: pr.currency,
      frequency: pr.frequency,
      symbol: pr.symbol,
      is_default: pr.is_default ? 1 : 0,
      amount: pr.amount,
      payment_gateway_price_id: pr.payment_gateway_price_id,
      is_active: pr.is_active ? 1 : 0,
    });
  }

  return plans.map((p) => {
    let fd = [];
    let f = [];
    try {
      fd = JSON.parse(p.features_description || "[]");
    } catch (e) {
      fd = [];
    }
    try {
      f = JSON.parse(p.features || "[]");
    } catch (e) {
      f = [];
    }

    return {
      id: p.id,
      title: p.title,
      payment_gateway: p.payment_gateway,
      is_recommended: p.is_recommended ? 1 : 0,
      is_trial: p.is_trial ? 1 : 0,
      trial_days: p.trial_days,
      features_description: fd,
      features: f,
      discount: p.discount,
      yearly_discount: p.yearly_discount,
      payment_gateway_product_id: p.payment_gateway_product_id,
      prices: pricesByPlan[p.id] || [],
    };
  });
};

exports.getAllNonTrialPlans = async (page = 1, perPage = 10) => {
  const plans = await Plan.find({
    is_deleted: false,
    is_trial: false,
  })
    .sort({ id: -1 })
    .lean();

  const planIds = plans.map((p) => p.id);
  const prices = await PlanPrice.find({ plan_id: { $in: planIds } }).lean();

  const pricesByPlan = {};
  for (const pr of prices) {
    if (!pricesByPlan[pr.plan_id]) pricesByPlan[pr.plan_id] = [];
    pricesByPlan[pr.plan_id].push({
      price_id: pr.id,
      country: pr.country,
      currency: pr.currency,
      frequency: pr.frequency,
      symbol: pr.symbol,
      is_default: pr.is_default ? 1 : 0,
      amount: pr.amount,
      payment_gateway_price_id: pr.payment_gateway_price_id,
      is_active: pr.is_active ? 1 : 0,
    });
  }

  return plans.map((p) => {
    let fd = [];
    let f = [];
    try {
      fd = JSON.parse(p.features_description || "[]");
    } catch (e) {
      fd = [];
    }
    try {
      f = JSON.parse(p.features || "[]");
    } catch (e) {
      f = [];
    }

    return {
      id: p.id,
      title: p.title,
      is_recommended: p.is_recommended ? 1 : 0,
      is_trial: p.is_trial ? 1 : 0,
      trial_days: p.trial_days,
      features_description: fd,
      features: f,
      discount: p.discount,
      yearly_discount: p.yearly_discount,
      payment_gateway_product_id: p.payment_gateway_product_id,
      prices: pricesByPlan[p.id] || [],
    };
  });
};

exports.getPlanByIdDB = async (id) => {
  if (!id) throw new Error("Plan id is required");

  const plan = await Plan.findOne({ id: Number(id) }).lean();
  if (!plan) {
    throw new Error("Plan not found");
  }

  const prices = await PlanPrice.find({ plan_id: Number(id) }, { _id: 0 }).lean();

  let fd = [];
  let f = [];
  try {
    fd = JSON.parse(plan.features_description || "[]");
  } catch (e) {
    fd = [];
  }
  try {
    f = JSON.parse(plan.features || "[]");
  } catch (e) {
    f = [];
  }

  return {
    success: true,
    data: {
      id: plan.id,
      title: plan.title,
      is_recommended: plan.is_recommended ? 1 : 0,
      is_trial: plan.is_trial ? 1 : 0,
      trial_days: plan.trial_days,
      discount: plan.discount,
      yearly_discount: plan.yearly_discount,
      payment_gateway_product_id: plan.payment_gateway_product_id,
      features_description: fd,
      features: f,
      prices: prices.map((pr) => ({
        price_id: pr.id,
        country: pr.country,
        currency: pr.currency,
        frequency: pr.frequency,
        symbol: pr.symbol,
        is_default: pr.is_default ? 1 : 0,
        amount: pr.amount,
        payment_gateway_price_id: pr.payment_gateway_price_id,
        is_active: pr.is_active ? 1 : 0,
      })),
    },
  };
};

exports.getSubscriptionHistory = async (id) => {
  const tId = Number(id);
  const rows = await SubscriptionHistory.aggregate([
    { $match: { tenant_id: tId } },
    {
      $lookup: {
        from: "tenants",
        localField: "tenant_id",
        foreignField: "id",
        as: "tenant",
      },
    },
    { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "plans",
        localField: "tenant.payment_gateway_product_id",
        foreignField: "payment_gateway_product_id",
        as: "plan",
      },
    },
    { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "plan_prices",
        localField: "plan.id",
        foreignField: "plan_id",
        as: "plan_price",
      },
    },
    { $unwind: { path: "$plan_price", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        id: 1,
        created_at: 1,
        starts_on: 1,
        expires_on: 1,
        status: 1,
        plan_title: "$plan.title",
        is_trial: "$plan.is_trial",
        amount: "$plan_price.amount",
        symbol: "$plan_price.symbol",
        currency: "$plan_price.currency",
        frequency: "$plan_price.frequency",
      },
    },
  ]);

  return rows;
};

exports.deletePlanByIdDB = async (id) => {
  const planId = Number(id);
  const key = await activatePaymentGatewayDB();
  if (!key?.gateway_name) {
    return { success: false, error: "NO_ACTIVE_GATEWAY" };
  }

  const gatewayName = key.gateway_name.toLowerCase();

  const plan = await Plan.findOne({ id: planId, is_deleted: false }).lean();
  if (!plan) {
    return { success: false, error: "PLAN_NOT_FOUND" };
  }

  const linked = await Tenant.findOne({ payment_gateway_product_id: plan.payment_gateway_product_id }).lean();
  if (linked) {
    return { success: false, error: "PLAN_IN_USE" };
  }

  await Plan.updateOne({ id: planId }, { $set: { is_deleted: true } });
  await PlanPrice.updateMany({ plan_id: planId }, { $set: { is_active: false } });

  if (gatewayName === "stripe") {
    try {
      const creds = decryptCredentials(key.credentials);
      const stripe = new Stripe(creds.secret_key);

      await stripe.products.update(plan.payment_gateway_product_id, {
        active: false,
      });

      const prices = await stripe.prices.list({
        product: plan.payment_gateway_product_id,
        limit: 100,
      });

      for (const price of prices.data) {
        await stripe.prices.update(price.id, { active: false });
      }
    } catch (err) {
      console.error("Stripe product delete error:", err);
    }
  }

  if (gatewayName === "paystack") {
    try {
      const creds = decryptCredentials(key.credentials);
      const paystack = new Paystack(creds.secret_key);

      const planPrices = await PlanPrice.find({ plan_id: planId }).lean();
      for (const price of planPrices) {
        if (!price.payment_gateway_price_id) continue;
        const suffix = price.frequency === "monthly" ? "monthly" : "yearly";
        try {
          await paystack.plan.update(price.payment_gateway_price_id, {
            name: `${plan.title} ${suffix} (inactive)`,
            send_invoices: false,
            send_sms: false,
          });
        } catch (err) {
          console.error(`Paystack deactivate failed for ${price.payment_gateway_price_id}:`, err);
        }
      }
    } catch (err) {
      console.error("Paystack deactivation error:", err);
    }
  }

  return {
    success: true,
    message: "Plan deleted successfully",
  };
};

exports.deletePaystackPlanByIdDB = async (id) => {
  const planId = Number(id);
  const plan = await Plan.findOne({ id: planId, is_deleted: false }).lean();

  if (!plan) return { success: false, error: "PLAN_NOT_FOUND" };
  if (plan.payment_gateway !== "paystack") {
    return { success: false, error: "NOT_PAYSTACK_PLAN" };
  }

  await Plan.updateOne({ id: planId }, { $set: { is_deleted: true } });
  await PlanPrice.updateMany({ plan_id: planId }, { $set: { is_active: false } });

  return { success: true, message: "Paystack plan deleted successfully" };
};

exports.fetchDetailsOfUserByIp = async (id) => {
  try {
    const response = await axios.get("https://ipapi.co/json/");
    const userIp = response.data;
    const result = await axios.get(`https://ipapi.co/${userIp}/json/`);
    return result.data;
  } catch (error) {
    console.error("fetchDetailsOfUserByIp Error:", error);
    throw error;
  }
};

exports.createManageSubscriptionLink = async (stripeCustomerId, subscriptionId, tenantId, deviceId) => {
  const row = await getGatewayDB("stripe");
  if (!row?.credentials) {
    throw new Error("Stripe credentials not configured");
  }

  const creds = decryptCredentials(row.credentials);
  const stripe = new Stripe(creds?.secret_key);

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${CONFIG.FRONTEND_DOMAIN || process.env.FRONTEND_DOMAIN}/dashboard/home`,
  });

  return session.url;
};

exports.getAllPlans = async () => {
  const plans = await Plan.find().sort({ id: 1 }).lean();
  const prices = await PlanPrice.find().lean();

  const pricesByPlan = {};
  for (const pr of prices) {
    if (!pricesByPlan[pr.plan_id]) pricesByPlan[pr.plan_id] = [];
    pricesByPlan[pr.plan_id].push({
      payment_gateway_price_id: pr.payment_gateway_price_id,
      is_trial: 0,
      is_active: pr.is_active ? 1 : 0,
    });
  }

  return plans.map((p) => ({
    id: p.id,
    title: p.title,
    is_trial: p.is_trial ? 1 : 0,
    trial_days: p.trial_days,
    payment_gateway_product_id: p.payment_gateway_product_id,
    prices: pricesByPlan[p.id] || [],
  }));
};

exports.createPortalConfig = async () => {
  const plans = await exports.getAllNonTrialPlans();

  const products = plans.map((plan) => ({
    product: plan.payment_gateway_product_id,
    prices: plan.prices.map((p) => p.payment_gateway_price_id),
  }));

  const row = await getGatewayDB("stripe");
  if (!row?.credentials) {
    throw new Error("Stripe credentials not configured");
  }

  const creds = decryptCredentials(row.credentials);
  const stripe = new Stripe(creds?.secret_key);

  await stripe.billingPortal.configurations.update(creds?.portal_config_id, {
    features: {
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        products,
      },
      subscription_cancel: { enabled: false },
      payment_method_update: { enabled: true },
    },
  });
};

exports.getUserCountry = async (id) => {
  try {
    const res = await fetch("https://ipwho.is/");
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("getUserCountry Error:", error);
    throw error;
  }
};

exports.createPaystackPlanDB = async (
  title,
  features_description,
  features,
  is_recommended,
  discount,
  yearlyDiscount,
  currencies
) => {
  try {
    let key = await getGatewayDB("paystack");
    if (!key?.credentials) {
      key = await activatePaymentGatewayDB();
    }
    const creds = key?.credentials ? decryptCredentials(key.credentials) : null;
    const secretKey = creds?.secret_key || process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      throw new Error("Paystack secret key is not configured. Please configure it in SuperAdmin Payment Gateways or PAYSTACK_SECRET_KEY env.");
    }
    const paystack = new Paystack(secretKey);

    const plan = await Plan.create({
      payment_gateway_product_id: `PAYSTACK_${Date.now()}`,
      title,
      features_description: JSON.stringify(features_description || []),
      features: JSON.stringify(features || []),
      trial_days: null,
      is_trial: false,
      is_recommended: !!is_recommended,
      discount: Number(discount) || 0,
      yearly_discount: Number(yearlyDiscount) || 0,
      payment_gateway: "paystack",
    });

    const planId = plan.id;

    for (const c of currencies) {
      for (const interval of ["month", "year"]) {
        const intervalType = interval === "month" ? "monthly" : "annually";
        const amount =
          interval === "month" ? applyDiscount(c.monthly, discount) : applyDiscount(c.yearly, yearlyDiscount);

        const psPlan = await paystack.plan.create({
          name: `${title} ${intervalType}`,
          amount: amount * 100,
          currency: c.currency,
          interval: intervalType,
        });

        if (psPlan.code?.includes("invalid_amount")) {
          throw new Error(psPlan.message);
        }

        const planCode = psPlan.data.plan_code;

        await PlanPrice.create({
          plan_id: planId,
          country: c.country,
          currency: c.currency,
          symbol: c.symbol,
          is_default: !!c.is_default,
          frequency: interval === "month" ? "monthly" : "yearly",
          amount,
          payment_gateway_price_id: planCode,
          is_active: true,
        });
      }
    }

    return { success: true, planId };
  } catch (err) {
    console.error("createPaystackPlanDB error:", err);
    throw err;
  }
};

exports.updatePaystackPlanDB = async (id, payload) => {
  const planId = Number(id);
  const {
    title,
    features_description = [],
    features = [],
    is_recommended,
    discount,
    yearlyDiscount,
  } = payload;

  try {
    const plan = await Plan.findOne({ id: planId, is_deleted: false }).lean();
    if (!plan) return { success: false, error: "PLAN_NOT_FOUND" };
    if (plan.payment_gateway !== "paystack") return { success: false, error: "NOT_PAYSTACK_PLAN" };

    await Plan.updateOne(
      { id: planId },
      {
        $set: {
          title,
          features_description: JSON.stringify(features_description),
          features: JSON.stringify(features),
          is_recommended: !!is_recommended,
          discount: Number(discount) || 0,
          yearly_discount: Number(yearlyDiscount) || 0,
          updated_at: new Date(),
        },
      }
    );

    const prices = await PlanPrice.find({ plan_id: planId, is_active: true }).lean();
    if (!prices.length) return { success: true };

    const gateway = await getGatewayDB("paystack");
    const secretKey = decryptCredentials(gateway?.credentials || "")?.secret_key;
    if (!secretKey) return { success: true };

    await Promise.all(
      prices
        .filter((p) => p.payment_gateway_price_id)
        .map((p) => {
          const name = `${title} ${p.frequency === "monthly" ? "Monthly" : "Yearly"}`;
          return fetch(`https://api.paystack.co/plan/${p.payment_gateway_price_id}`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${secretKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name }),
          }).catch((err) => console.error("Paystack update failed:", err));
        })
    );

    return { success: true };
  } catch (err) {
    console.error("updatePaystackPlanDB:", err);
    throw err;
  }
};

exports.createPaystackPaymentLink = async ({ priceId, email, tenantId, deviceId }) => {
  try {
    if (!priceId) {
      throw new Error("PAYSTACK_PRICE_ID_REQUIRED");
    }

    const price = await PlanPrice.findOne({
      payment_gateway_price_id: priceId,
      is_active: true,
    }).lean();

    if (!price) {
      throw new Error("PAYSTACK_PLAN_NOT_FOUND");
    }

    const plan = await Plan.findOne({
      id: price.plan_id,
      payment_gateway: "paystack",
    }).lean();

    if (!plan) {
      throw new Error("PAYSTACK_PLAN_NOT_FOUND");
    }

    let key = await getGatewayDB("paystack");
    if (!key?.credentials) {
      key = await activatePaymentGatewayDB();
    }
    const creds = key?.credentials ? decryptCredentials(key.credentials) : null;
    const secretKey = creds?.secret_key || process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      throw new Error("Paystack secret key is not configured. Please configure it in SuperAdmin Payment Gateways or PAYSTACK_SECRET_KEY env.");
    }
    const paystack = new Paystack(secretKey);

    const payload = {
      email,
      amount: price.amount * 100,
      currency: price.currency,
      plan: price.payment_gateway_price_id,
      callback_url: `${CONFIG.FRONTEND_DOMAIN}/success`,
      metadata: {
        tenant_id: tenantId,
        device_id: deviceId || "",
        price_id: priceId,
        product_id: plan.payment_gateway_product_id || null,
        success_url: `${CONFIG.FRONTEND_DOMAIN}/success`,
        cancel_url: `${CONFIG.FRONTEND_DOMAIN}/cancelled-payment`,
      },
    };

    const paymentLink = await paystack.transaction.initialize(payload);
    return paymentLink.data;
  } catch (error) {
    console.error("Create Paystack Payment Link Error:", error);
    throw error;
  }
};

exports.getPaystackManageSubscriptionLink = async (subscriptionCode) => {
  if (!subscriptionCode?.trim()) {
    throw new Error("PAYSTACK_SUBSCRIPTION_CODE_REQUIRED");
  }

  const gateway = await getGatewayDB("paystack");
  if (!gateway?.credentials) {
    console.error("Paystack credentials not configured");
    throw new Error("PAYSTACK_NOT_CONFIGURED");
  }

  const creds = decryptCredentials(gateway.credentials);
  const secretKey = creds?.secret_key;
  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY_MISSING");
  }

  const url = `https://api.paystack.co/subscription/${encodeURIComponent(subscriptionCode.trim())}/manage/link`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!data.status || !data.data?.link) {
    const message = data.message || "Failed to generate Paystack manage link";
    console.error("Paystack manage link error:", message);
    throw new Error(message);
  }

  return { link: data.data.link };
};