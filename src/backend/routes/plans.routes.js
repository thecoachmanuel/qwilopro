const express = require("express");
const {
    isLoggedIn,
    isAuthenticated,
    hasRefreshToken,
    authorize,
    isSuperAdmin,
} = require("../middlewares/auth.middleware");
const {
    getPlanById,
    getPlans,
    createPlan,
    updatePlan,
    deletePlanById,
    createManageSubscriptionLink,
    getSubscriptionHistory,
    getUserCountry,
    createPaystackPlan,
    createPaystackPaymentLink,
    verifyPaystackPayment,
    updatePaystackPlan,
    deletePaystackPlan,
    generatePaystackManageSubscriptionLink,
    activateTrial,
    updatePlanTrialDays,
} = require("../controllers/plans.controller");

const router = express.Router();

router.post("/activate-trial", isLoggedIn, isAuthenticated, activateTrial);

router.get("/", getPlans);
router.get("/country-details", getUserCountry);
router.get("/:id", isLoggedIn, isAuthenticated, isSuperAdmin, getPlanById);
router.post("/", isLoggedIn, isAuthenticated, isSuperAdmin, createPlan);
router.put("/:id", isLoggedIn, isAuthenticated, isSuperAdmin, updatePlan);
router.patch("/:id/trial-days", isLoggedIn, isAuthenticated, isSuperAdmin, updatePlanTrialDays);
router.delete("/:id", isLoggedIn, isAuthenticated, isSuperAdmin, deletePlanById);
router.post(
    "/stripe/manage-subscription",
    isLoggedIn,
    isAuthenticated,
    createManageSubscriptionLink
);
router.get(
    "/subscription-history/:id",
    isLoggedIn,
    isAuthenticated,
    isSuperAdmin,
    getSubscriptionHistory
);

// paystack api routes
router.post(
    "/paystack/create-plan",
    isLoggedIn,
    isAuthenticated,
    isSuperAdmin,
    createPaystackPlan
);
router.put(
    "/paystack/update-plan/:id",
    isLoggedIn,
    isAuthenticated,
    isSuperAdmin,
    updatePaystackPlan
);
router.delete(
    "/paystack/delete-plan/:id",
    isLoggedIn,
    isAuthenticated,
    isSuperAdmin,
    deletePaystackPlan
);
router.post(
    "/paystack/create-payment-link",
    isLoggedIn,
    isAuthenticated,
    createPaystackPaymentLink
);
router.get(
    "/paystack/verify",
    isLoggedIn,
    isAuthenticated,
    verifyPaystackPayment
);
router.post(
    "/paystack/verify",
    isLoggedIn,
    isAuthenticated,
    verifyPaystackPayment
);
router.get(
    "/paystack/manage-subscription",
    isLoggedIn,
    isAuthenticated,
    generatePaystackManageSubscriptionLink
);

module.exports = router;