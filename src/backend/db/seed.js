const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { SuperAdmin, ExchangeRate, PaymentGateway, Plan, PlanPrice } = require("../models");
const { CONFIG } = require("../config");

const seedPlans = async () => {
  const plansCount = await Plan.countDocuments({ is_deleted: false });
  if (plansCount > 0) {
    return;
  }

  console.log("[Seed] Seeding default SaaS plans with Nigerian Naira as primary...");

  const initialPlans = [
    {
      id: 1,
      title: "Starter",
      payment_gateway: "paystack",
      payment_gateway_product_id: "plan_starter_ngn",
      is_recommended: false,
      is_trial: true,
      trial_days: 14,
      features_description: JSON.stringify([
        "Complete Point of Sale (POS)",
        "Order & Table Management",
        "Receipt & Kitchen Token Printing",
        "Basic Sales Reports & Daily Insights",
        "Up to 3 Staff Accounts",
        "Standard Email Support"
      ]),
      features: JSON.stringify([
        "DASHBOARD",
        "POS",
        "ORDERS",
        "KITCHEN",
        "INVOICES",
        "SETTINGS",
        "REPORTS",
        "USER",
        "QRMENU"
      ]),
      discount: 0,
      yearly_discount: 17,
      prices: [
        {
          country: "Nigeria",
          currency: "NGN",
          symbol: "₦",
          frequency: "monthly",
          amount: 5000,
          is_default: true,
          is_active: true,
          payment_gateway_price_id: "PLN_starter_m_ngn"
        },
        {
          country: "Nigeria",
          currency: "NGN",
          symbol: "₦",
          frequency: "yearly",
          amount: 50000,
          is_default: true,
          is_active: true,
          payment_gateway_price_id: "PLN_starter_y_ngn"
        },
        {
          country: "United States",
          currency: "USD",
          symbol: "$",
          frequency: "monthly",
          amount: 5,
          is_default: false,
          is_active: true,
          payment_gateway_price_id: "price_starter_m_usd"
        },
        {
          country: "United States",
          currency: "USD",
          symbol: "$",
          frequency: "yearly",
          amount: 50,
          is_default: false,
          is_active: true,
          payment_gateway_price_id: "price_starter_y_usd"
        }
      ]
    },
    {
      id: 2,
      title: "Professional",
      payment_gateway: "paystack",
      payment_gateway_product_id: "plan_professional_ngn",
      is_recommended: true,
      is_trial: true,
      trial_days: 14,
      features_description: JSON.stringify([
        "Everything in Starter, plus:",
        "Kitchen Display System (KDS)",
        "Table Reservation & Booking System",
        "Customer Loyalty & Membership CRM",
        "Live Inventory & Ingredient Tracking",
        "Customer Feedback & Ratings",
        "Digital QR Code Menu & Contactless Ordering",
        "Unlimited Staff Accounts",
        "Priority 24/7 Support"
      ]),
      features: JSON.stringify([
        "DASHBOARD",
        "POS",
        "ORDERS",
        "KITCHEN",
        "RESERVATIONS",
        "CUSTOMERS",
        "INVOICES",
        "MEMBERSHIP",
        "INVENTORY",
        "SETTINGS",
        "REPORTS",
        "FEEDBACK",
        "USER",
        "QRMENU"
      ]),
      discount: 0,
      yearly_discount: 20,
      prices: [
        {
          country: "Nigeria",
          currency: "NGN",
          symbol: "₦",
          frequency: "monthly",
          amount: 12000,
          is_default: true,
          is_active: true,
          payment_gateway_price_id: "PLN_pro_m_ngn"
        },
        {
          country: "Nigeria",
          currency: "NGN",
          symbol: "₦",
          frequency: "yearly",
          amount: 115000,
          is_default: true,
          is_active: true,
          payment_gateway_price_id: "PLN_pro_y_ngn"
        },
        {
          country: "United States",
          currency: "USD",
          symbol: "$",
          frequency: "monthly",
          amount: 12,
          is_default: false,
          is_active: true,
          payment_gateway_price_id: "price_pro_m_usd"
        },
        {
          country: "United States",
          currency: "USD",
          symbol: "$",
          frequency: "yearly",
          amount: 115,
          is_default: false,
          is_active: true,
          payment_gateway_price_id: "price_pro_y_usd"
        }
      ]
    },
    {
      id: 3,
      title: "Enterprise",
      payment_gateway: "paystack",
      payment_gateway_product_id: "plan_enterprise_ngn",
      is_recommended: false,
      is_trial: false,
      trial_days: 0,
      features_description: JSON.stringify([
        "Everything in Professional, plus:",
        "Multi-Outlet & Central Kitchen Sync",
        "Purchase Orders & Supplier Management",
        "Custom Domain & White-Label Receipts",
        "Dedicated Account Manager",
        "99.9% Uptime SLA & Priority Phone Support"
      ]),
      features: JSON.stringify([
        "DASHBOARD",
        "POS",
        "ORDERS",
        "KITCHEN",
        "RESERVATIONS",
        "CUSTOMERS",
        "INVOICES",
        "MEMBERSHIP",
        "INVENTORY",
        "SETTINGS",
        "REPORTS",
        "FEEDBACK",
        "USER",
        "QRMENU"
      ]),
      discount: 0,
      yearly_discount: 25,
      prices: [
        {
          country: "Nigeria",
          currency: "NGN",
          symbol: "₦",
          frequency: "monthly",
          amount: 25000,
          is_default: true,
          is_active: true,
          payment_gateway_price_id: "PLN_ent_m_ngn"
        },
        {
          country: "Nigeria",
          currency: "NGN",
          symbol: "₦",
          frequency: "yearly",
          amount: 225000,
          is_default: true,
          is_active: true,
          payment_gateway_price_id: "PLN_ent_y_ngn"
        },
        {
          country: "United States",
          currency: "USD",
          symbol: "$",
          frequency: "monthly",
          amount: 25,
          is_default: false,
          is_active: true,
          payment_gateway_price_id: "price_ent_m_usd"
        },
        {
          country: "United States",
          currency: "USD",
          symbol: "$",
          frequency: "yearly",
          amount: 225,
          is_default: false,
          is_active: true,
          payment_gateway_price_id: "price_ent_y_usd"
        }
      ]
    }
  ];

  for (const pData of initialPlans) {
    const { prices, ...planFields } = pData;
    const createdPlan = await Plan.create(planFields);
    const planId = createdPlan.id || pData.id;

    for (const priceData of prices) {
      await PlanPrice.create({
        plan_id: planId,
        ...priceData
      });
    }
  }

  console.log("[Seed] Successfully initialized 3 default plans with Naira pricing.");
};

exports.seedPlans = seedPlans;

exports.seedDatabase = async () => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }
  try {
    // 1. Ensure SuperAdmin exists
    const defaultEmail = process.env.DEFAULT_SUPERADMIN_EMAIL || "superadmin@qwilopro.com";
    const defaultPass = process.env.DEFAULT_SUPERADMIN_PASSWORD || "admin123";
    const existingSuperAdmin = await SuperAdmin.findOne({ email: defaultEmail });
    if (!existingSuperAdmin) {
      const hashedPassword = await bcrypt.hash(defaultPass, CONFIG.PASSWORD_SALT);
      await SuperAdmin.create({
        email: defaultEmail,
        password: hashedPassword,
        name: "Super Admin",
      });
      console.log(`[Seed] Created default SuperAdmin: ${defaultEmail} / ${defaultPass}`);
    }

    // 2. Ensure basic Exchange Rates exist for reporting (Naira replaces INR with 0.00074 since 1 USD = 1350 NGN)
    const defaultRates = [
      { currency_code: "NGN", rate_to_usd: 0.00074 },
      { currency_code: "₦", rate_to_usd: 0.00074 },
      { currency_code: "$", rate_to_usd: 1.0 },
      { currency_code: "USD", rate_to_usd: 1.0 },
      { currency_code: "EUR", rate_to_usd: 1.08 },
      { currency_code: "GBP", rate_to_usd: 1.26 },
      { currency_code: "AED", rate_to_usd: 0.27 },
      { currency_code: "SAR", rate_to_usd: 0.27 },
      { currency_code: "CAD", rate_to_usd: 0.74 },
      { currency_code: "AUD", rate_to_usd: 0.65 },
    ];

    const ratesCount = await ExchangeRate.countDocuments();
    if (ratesCount === 0) {
      await ExchangeRate.insertMany(defaultRates);
      console.log(`[Seed] Initialized ${defaultRates.length} currency exchange rates.`);
    } else {
      // Upsert NGN & ₦ rates to ensure 0.00074 conversion rate is always current
      await ExchangeRate.findOneAndUpdate(
        { currency_code: "NGN" },
        { $set: { currency_code: "NGN", rate_to_usd: 0.00074 } },
        { upsert: true }
      );
      await ExchangeRate.findOneAndUpdate(
        { currency_code: "₦" },
        { $set: { currency_code: "₦", rate_to_usd: 0.00074 } },
        { upsert: true }
      );
      // Remove obsolete INR exchange rate
      await ExchangeRate.deleteOne({ currency_code: "INR" });
    }

    // 3. Ensure Paystack is primary payment gateway and Stripe is optional
    const paystackGateway = await PaymentGateway.findOne({ gateway_name: "paystack" });
    if (!paystackGateway) {
      await PaymentGateway.create({
        gateway_name: "paystack",
        status: true, // Primary payment active by default
      });
      console.log("[Seed] Initialized primary payment gateway: paystack");
    }

    const stripeGateway = await PaymentGateway.findOne({ gateway_name: "stripe" });
    if (!stripeGateway) {
      await PaymentGateway.create({
        gateway_name: "stripe",
        status: false, // Optional when set by admin
      });
      console.log("[Seed] Initialized optional payment gateway: stripe");
    }

    // Clean up razorpay if present in database
    await PaymentGateway.deleteOne({ gateway_name: "razorpay" });

    // 4. Ensure default SaaS plans exist with Naira as primary currency
    await seedPlans();

  } catch (error) {
    console.error("[Seed] Error seeding initial database data:", error);
  }
};
