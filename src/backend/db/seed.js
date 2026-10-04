const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { SuperAdmin, ExchangeRate, PaymentGateway } = require("../models");
const { CONFIG } = require("../config");

exports.seedDatabase = async () => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }
  try {
    // 1. Ensure at least one SuperAdmin exists
    const superAdminCount = await SuperAdmin.countDocuments();
    if (superAdminCount === 0) {
      const defaultEmail = process.env.DEFAULT_SUPERADMIN_EMAIL || "superadmin@qwilopro.com";
      const defaultPass = process.env.DEFAULT_SUPERADMIN_PASSWORD || "admin123";
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

  } catch (error) {
    console.error("[Seed] Error seeding initial database data:", error);
  }
};
