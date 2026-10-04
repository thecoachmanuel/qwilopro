const Stripe = require("stripe");
const { CONFIG } = require("../config");
const { getCookieOptions, getClearCookieOptions } = require("../utils/cookieHelper");
const { removeRefreshTokenDB, addRefreshTokenDB, verifyRefreshTokenDB } = require("../services/auth.service");
const { signInDB, getAdminUserDB, getActiveTenantsDB, getInActiveTenantsDB, getAllTenantsDB, getOrdersProcessedTodayDB, getSalesVolumeTodayDB, getMRRValueDB, getARRValueDB, getRestaurantsTotalCustomersDB, getSuperAdminTopSellingItemsDB, getSuperAdminSalesVolumeDB, getSuperAdminOrdersProcessedDB, getTenantsDB, addTenantDB, updateTenantDB, getTenantCntByIdDB, getTenantDetailsByIdDB, logoutAllUsersOfTenantDB, deleteTenantDB, getTenantsDataByStatusDB, getTenantSubscriptionHistoryDB, getTenantTotalUsersDB, getTenantDetailsDB, getTenantStoreDetailsDB, upsertGatewayDB, getGatewayDB, updateGatewayStatusDB, getAllPaymentGatewaysDB, activatePaymentGatewayDB } = require("../services/superadmin.service")
const { generateAccessToken, generateRefreshToken } = require("../utils/jwt");
const { checkEmailExistsSuperadminDB } = require('../services/auth.service');
const { encryptCredentials, sanitizeCredentialsForUI } = require("../utils/encryptCredentials");

exports.signIn = async (req, res) => {
    try {

        const username = req.body.username;
        const password = req.body.password;

        if (!(username && password)) {
            return res.status(400).json({
                success: false,
                message: req.__("please_provide_required_details") // Translate message
            });
        }

        const result = await signInDB(username, password);

        if (result) {
            // set cookie
            const cookieOptions = getCookieOptions(CONFIG.COOKIE_EXPIRY, true);
            const cookieRefreshTokenOptions = getCookieOptions(CONFIG.COOKIE_EXPIRY_REFRESH, true);
            const cookieAuthStatusOptions = getCookieOptions(CONFIG.COOKIE_EXPIRY_REFRESH, false);
            const refreshTokenExpiry = cookieRefreshTokenOptions.expires;

            result.password = undefined;

            const payload = {
                username: result.email,
                name: result.name,
                role: "superadmin",
            }
            const accessToken = generateAccessToken(payload);
            const refreshToken = generateRefreshToken(payload);

            res.cookie('accessToken', accessToken, cookieOptions);
            res.cookie('refreshToken', refreshToken, cookieRefreshTokenOptions);
            res.cookie('restroprosaas__authenticated', 'true', cookieAuthStatusOptions);

            // set refresh token in DB.
            const deviceDetails = req.useragent || {};
            const deviceIP = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || req.ip || "127.0.0.1";
            const deviceName = `${deviceDetails.platform || "Unknown"}\nBrowser: ${deviceDetails.browser || "Unknown"}`;
            const deviceLocation = null;
            await addRefreshTokenDB(username, refreshToken, refreshTokenExpiry, deviceIP, deviceName, deviceLocation, null);

            return res.status(200).json({
                success: true,
                message: req.__("login_successful"), // Translate message
                accessToken,
                user: payload
            })

        } else {
            return res.status(401).json({
                success: false,
                message: req.__("email_or_password_invalid") // Translate message
            });
        }


    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("facing_issues_try_later") // Translate message
        });
    }
}
exports.signOut = async (req, res) => {
    try {
        const user = req.user;
        const refreshToken = req.cookies.refreshToken;

        res.clearCookie('accessToken', getClearCookieOptions(true));
        res.clearCookie('refreshToken', getClearCookieOptions(true));
        res.clearCookie('restroprosaas__authenticated', getClearCookieOptions(false));

        // remove refreshToken in DB.
        await removeRefreshTokenDB(user.username, refreshToken);

        return res.status(200).json({
            success: true,
            message: req.__("logout_successful") // Translate message
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
}

exports.getNewAccessToken = async (req, res) => {
    try {
        const user = req.user;
        const refreshToken = req.cookies.refreshToken;

        // verify the refresh token with the DB
        const isExist = await verifyRefreshTokenDB(refreshToken);

        if (isExist) {
            const cookieOptions = getCookieOptions(CONFIG.COOKIE_EXPIRY, true);
            const u = await getAdminUserDB(user.username);
            const payload = {
                username: u.email,
                name: u.name,
                role: "superadmin",
            }
            const accessToken = generateAccessToken(payload);

            res.cookie('accessToken', accessToken, cookieOptions);

            return res.status(200).json({
                success: true,
                message: req.__("new_token_created_successfully"), // Translate message
                accessToken
            });
        } else {
            res.clearCookie('accessToken', getClearCookieOptions(true));
            res.clearCookie('refreshToken', getClearCookieOptions(true));
            res.clearCookie('restroprosaas__authenticated', getClearCookieOptions(false));
            return res.status(401).json({
                success: false,
                loginNeeded: true,
                message: req.__("login_again_to_access") // Translate message
            });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.getTenants = async (req, res) => {
    try {
        const { page, perPage, search, status, type, from, to } = req.query;

        // if (!type) {
        //     return res.status(400).json({
        //       success: false,
        //       message: req.__("please_provide_required_details") // Translate message
        //     });
        //   }

        if (type == "custom") {
            if (!(from && to)) {
                return res.status(400).json({
                    success: false,
                    message: req.__("provide_from_to_dates") // Translate message
                });
            }
        }

        const result = await getTenantsDB(page, perPage, search, status, type, from, to);

        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
}

exports.getSuperAdminTenantsCntData = async (req, res) => {
    try {

        const [activeTenants, inactiveTenants, allTenants] = await Promise.all([
            getActiveTenantsDB(),
            getInActiveTenantsDB(),
            getAllTenantsDB(),
        ]);

        return res.status(200).json({
            activeTenants, inactiveTenants, allTenants
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
}

exports.getSuperAdminDashboardData = async (req, res) => {
    try {

        const [activeTenants, ordersProcessedToday, salesVolumeToday, mrr, arr] = await Promise.all([
            getActiveTenantsDB(),
            getOrdersProcessedTodayDB(),
            getSalesVolumeTodayDB(),
            getMRRValueDB(),
            getARRValueDB()
        ]);

        const NAIRA_PER_USD = 1350;
        const subscriptionAmountUsd = 5;
        const mrrUsd = Number(mrr || 0) * subscriptionAmountUsd;
        const arrUsd = Number(arr || 0) * subscriptionAmountUsd * 12;
        const mrrNgn = Math.round(mrrUsd * NAIRA_PER_USD);
        const arrNgn = Math.round(arrUsd * NAIRA_PER_USD);
        const salesVolumeTodayNgn = Math.round(Number(salesVolumeToday || 0) * NAIRA_PER_USD);

        return res.status(200).json({
            activeTenants, ordersProcessedToday, salesVolumeToday, mrr, arr,
            mrrUsd, arrUsd, mrrNgn, arrNgn, salesVolumeTodayNgn,
            currency: "NGN",
            currencySymbol: "₦"
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.addTenant = async (req, res) => {
    try {
        const { name, email, password, isActive } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({
                message: req.__("please_provide_required_details") // Translate message
            });
        }

        const isAdmin = 1;

        const tenantData = await addTenantDB({ name, email, password, isAdmin, isActive });

        return res.status(200).json({ message: req.__("tenant_added_successfully"), tenant: tenantData }); // Translate message
    } catch (error) {
        console.error("Error adding tenant:", error);

        if (error == "User already exist! Try Different Email!") {
            return res.status(409).json({ message: req.__("user_already_exist_try_different_email") }); // Translate message
        }

        return res.status(500).json({ message: req.__("error_adding_tenant") }); // Translate message
    }
};


exports.updateTenant = async (req, res) => {
    try {
        const tenantId = req.params.id;
        const {
            name,
            email,
            isActive,
            subscription_start,
            subscription_end,
            payment_gateway_product_id
        } = req.body;

        if (!tenantId) {
            return res.status(400).json({ message: req.__("invalid_tenant") }); // Translate message
        }
        if (!name || !email || isActive === undefined) {
            return res.status(400).json({ message: req.__("missing_required_fields") }); // Translate message
        }

        const tenantCnt = await getTenantCntByIdDB(tenantId);

        if (tenantCnt != 1) {
            return res.status(404).json({ message: req.__("tenant_not_found") }); // Translate message
        }

        const currentTenant = await getTenantDetailsByIdDB(tenantId);

        if (currentTenant.username !== email) {
            // check if email exists
            const isEmailExists = await checkEmailExistsSuperadminDB(email, tenantId);

            if (isEmailExists) {
                return res.status(400).json({
                    success: false,
                    message: req.__("account_exists_try_login") // Translate message
                });
            }
        }

        await updateTenantDB(
            tenantId,
            name,
            email,
            isActive,
            currentTenant.username,
            subscription_start,
            subscription_end,
            payment_gateway_product_id
        );

        if (currentTenant.username !== email || (isActive == 0 && currentTenant.is_active == 1)) {
            await logoutAllUsersOfTenantDB(tenantId);
        }

        return res.status(200).json({ message: req.__("tenant_updated_successfully") }); // Translate message
    } catch (error) {
        console.error('Error updating tenant:', error);
        return res.status(500).json({ message: req.__("error_updating_tenant") }); // Translate message
    }
};

exports.deleteTenant = async (req, res) => {
    try {
        const tenantId = req.params.id;

        if (!tenantId) {
            return res.status(400).json({ message: req.__("invalid_tenant") }); // Translate message
        }

        const tenantCnt = await getTenantCntByIdDB(tenantId);

        if (tenantCnt != 1) {
            return res.status(404).json({ message: req.__("tenant_not_found") }); // Translate message
        }

        await deleteTenantDB(tenantId);

        return res.status(200).json({
            success: true,
            message: req.__("tenant_deleted_successfully") // Translate message
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
}

exports.getTenantsDataByStatus = async (req, res) => {
    try {
        const status = req.params.status;

        if (status != 'active' && status != 'inactive' && status != 'all') {
            return res.status(400).json({
                success: false,
                message: req.__("invalid_status_try_again_later") // Translate message
            });
        }

        let data;

        if (status == 'active') {
            data = await getTenantsDataByStatusDB(1);
        } else if (status == 'inactive') {
            data = await getTenantsDataByStatusDB(0);
        } else if (status == 'all') {
            data = await getTenantsDataByStatusDB(null);

        }

        return res.status(200).json(data);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
}

exports.getTenantSubscriptionHistory = async (req, res) => {
    try {
        const tenantId = req.params.id;

        const subscriptionHistory = await getTenantSubscriptionHistoryDB(tenantId);

        // tenant info
        const tenantDetails = await getTenantDetailsDB(tenantId);

        // store details
        const storeDetails = await getTenantStoreDetailsDB(tenantId);

        // tenant users
        const tenantTotalUsers = await getTenantTotalUsersDB(tenantId);

        return res.status(200).json({
            tenantInfo: tenantDetails,
            storeDetails: storeDetails,
            totalUsers: tenantTotalUsers,
            subscriptionHistory: subscriptionHistory
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
}

exports.getSuperAdminReportsData = async (req, res) => {
    try {
        let from = req.query.from || null;
        let to = req.query.to || null;
        if (from === "null" || from === "undefined") from = null;
        if (to === "null" || to === "undefined") to = null;

        const type = req.query.type;

        if (!type) {
            return res.status(400).json({
                success: false,
                message: req.__("please_provide_required_details") // Translate message
            });
        }

        if (type == 'custom') {
            if (!(from && to)) {
                return res.status(400).json({
                    success: false,
                    message: req.__("provide_from_to_dates") // Translate message
                });
            }
        }

        const [activeTenants, mrr, arr, totalCustomers, topSellingItems, salesVolume, ordersProcessed] = await Promise.all([
            getActiveTenantsDB(),
            getMRRValueDB(),
            getARRValueDB(),
            getRestaurantsTotalCustomersDB(),
            getSuperAdminTopSellingItemsDB(type, from, to),
            getSuperAdminSalesVolumeDB(type, from, to),
            getSuperAdminOrdersProcessedDB(type, from, to)
        ]);

        const NAIRA_PER_USD = 1350;
        const subscriptionAmountUsd = 5;
        const mrrUsd = Number(mrr || 0) * subscriptionAmountUsd;
        const arrUsd = Number(arr || 0) * subscriptionAmountUsd * 12;
        const mrrNgn = Math.round(mrrUsd * NAIRA_PER_USD);
        const arrNgn = Math.round(arrUsd * NAIRA_PER_USD);
        const salesVolumeNgn = Math.round(Number(salesVolume || 0) * NAIRA_PER_USD);

        return res.status(200).json({
            activeTenants, mrr, arr, totalCustomers, topSellingItems,
            salesVolume, ordersProcessed,
            mrrUsd, arrUsd, mrrNgn, arrNgn, salesVolumeNgn,
            currency: "NGN",
            currencySymbol: "₦"
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

// payment-gateways
exports.updateGatewayCredentials = async (req, res) => {
    try {
        const { gateway_name, credentials } = req.body;

        if (!gateway_name || !credentials || typeof credentials !== 'object') {
            return res.status(400).json({ message: req.__("invalid_payload") });
        }

        // validate stripe key
        if (gateway_name === "stripe" && credentials.secret_key) {
            try {
                const stripe = new Stripe(credentials?.secret_key);
                await stripe.accounts.retrieve(); // validation call
            } catch {
                return res.status(400).json({ message: "Invalid Stripe API key" });
            }
        }

         // 2️⃣ Get existing encrypted credentials
        const existing = await getGatewayDB(gateway_name);

        const existingCredentials = existing?.credentials || {};

        console.log("Existing credentials:", existing);
        console.log("new credentials:", credentials);

        // 3️⃣ Encrypt only updated fields
        const encryptedUpdates = encryptCredentials(credentials);

        // 4️⃣ Merge (THIS IS THE KEY PART)
        const finalCredentials = {
          ...(existingCredentials || {}),
          ...encryptedUpdates
        };

        await upsertGatewayDB(gateway_name, finalCredentials);

        return res.json({ message: req.__("payment_gateway_saved_successfully") });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.updateGatewayStatus = async (req, res) => {
    try {
        const { name, status } = req.body;
        await updateGatewayStatusDB(name, status);
        return res.json({ message: req.__("payment_gateway_status_updated_successfully") });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.getGatewayDetails = async (req, res) => {
    try {
        const name = req.params.name;
        const row = await getGatewayDB(name);
        return res.json({
          gateway_name: row.gateway_name,
          status: row.status,
          credentials: sanitizeCredentialsForUI(row.credentials)
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};

exports.activatePaymentGateway = async (req, res) => {
    try {
        const result = await activatePaymentGatewayDB();
        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: req.__("something_went_wrong_try_later") }); // Translate message
    }
};

exports.getAllPaymentGateways = async (req, res) => {
    try {
        const data = await getAllPaymentGatewaysDB();
        
        const sanitized = data.map(row => ({
          id: row.id,
          gateway_name: row.gateway_name,
          status: row.status,
          created_at: row.created_at,
          credentials: sanitizeCredentialsForUI(row.credentials)
        }));

        return res.json(sanitized);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later") // Translate message
        });
    }
};