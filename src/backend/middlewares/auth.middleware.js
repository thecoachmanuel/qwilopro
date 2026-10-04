const { getUserDB } = require("../services/user.service");
const { verifyToken, generateAccessToken, generateRefreshToken } = require("../utils/jwt");
const { ROLES } = require("../config/user.config");
const { getAdminUserDB } = require("../services/superadmin.service");
const { getTenantById, addRefreshTokenDB } = require("../services/auth.service");
const { CONFIG } = require("../config");
const { getClearCookieOptions } = require("../utils/cookieHelper");

exports.isLoggedIn = (req, res, next) => {
    let token;
   

    if(req.cookies.accessToken || 
        (req.headers.authorization && req.headers.authorization.startsWith('Bearer'))
    ) {
        token = req.cookies.accessToken || req.headers.authorization.split(" ")[1];
    }

    if(!token) {
        return res.status(401).json({
            success: false,
            message: req.__("login_again_to_access")
        });
    }
    req.token = token;
    next();
} 

exports.isAuthenticated = async (req, res, next) => {
  try {
    const accessToken = req.token || req.cookies.accessToken;
    if (!accessToken) throw new Error("No token");

    let decoded = verifyToken(accessToken);  
    
    // if(decoded.tenant_id){
    //      const tenant = await getTenantById(decoded.tenant_id);
    //     if (!tenant) throw new Error("Tenant not found");

    //     if (decoded.tokenVersion !== tenant.token_version) {
    //       throw new Error("Token version mismatch");
    //     }
    // }
    
   

    // if(decoded.tenant_id) {
    //     const tenant = await getTenantById(decoded.tenant_id);
    //     if (!tenant) throw new Error("Tenant not found");

    //     console.log('Token version:', decoded.tokenVersion, 'Tenant token version:', tenant.token_version);
    //     // 🔄 Token outdated → refresh silently
    //     if (decoded.tokenVersion !== tenant.token_version) {
    //       const user = await getUserDB(decoded.username, decoded.tenant_id);

    //       const payload = {
    //         tenant_id: user.tenant_id,
    //         username: user.username,
    //         name: user.name,
    //         role: user.role,
    //         is_active: user.is_active,
    //         tokenVersion: tenant.token_version,
    //       };

    //       const newAccessToken = generateAccessToken(payload);
    //       const newRefreshToken = generateRefreshToken(payload);

    //       console.log(newAccessToken);
    //       console.log("refreshtoken",newRefreshToken);

    //       const cookieOptions = {
    //         expires: new Date(Date.now() + Number(CONFIG.COOKIE_EXPIRY)),
    //         httpOnly: true,
    //         domain: CONFIG.FRONTEND_DOMAIN_COOKIE,
    //         sameSite: false,
    //         secure: process.env.NODE_ENV === "production",
    //         path: "/",
    //       };


    //       const refreshTokenExpiry = new Date(
    //         Date.now() + Number(CONFIG.COOKIE_EXPIRY_REFRESH)
    //       );



    //       res.cookie("accessToken", newAccessToken, cookieOptions);
    //       res.cookie("refreshToken", newRefreshToken, {
    //         ...cookieOptions,
    //         expires: refreshTokenExpiry,
    //       });

    //       const deviceIP = req.connection.remoteAddress;
    //       const deviceName = `${deviceDetails.platform}\nBrowser: ${deviceDetails.browser}`;
    //       const deviceLocation = "";
    //       await addRefreshTokenDB(user.username, newRefreshToken, refreshTokenExpiry, deviceIP, deviceName, deviceLocation, user.tenant_id);

    //       // ✅ update decoded user
    //       req.user = payload;
    //       return next();
    //     }
    // }
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: req.__("operation_not_allowed"),
    });
  }
};


const SCOPE_TO_PLAN_FEATURE = {
    CUSTOMER_DISPLAY: "POS",
    KITCHEN_DISPLAY: "KITCHEN",
    ORDER_STATUS_DISPLAY: "POS",
    ORDER_STATUS: "POS",
    VIEW_RESERVATIONS: "RESERVATIONS",
    MANAGE_RESERVATIONS: "RESERVATIONS",
    VIEW_CUSTOMERS: "CUSTOMERS",
    MANAGE_CUSTOMERS: "CUSTOMERS",
    VIEW_INVENTORY: "INVENTORY",
    MANAGE_INVENTORY: "INVENTORY",
};

exports.isSubscriptionActive = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user || !user.tenant_id) {
            return res.status(401).json({
                success: false,
                message: req.__("login_again_to_access")
            });
        }

        // Fetch fresh tenant/subscription info
        const tenant = await getTenantById(user.tenant_id);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: req.__("tenant_not_found")
            });
        }

        const isActive = Number(tenant.is_active) === 1;
        const isExpired = tenant.subscription_end
            ? new Date(tenant.subscription_end).getTime() < new Date().setHours(0, 0, 0, 0)
            : false;

        if (isActive && !isExpired) {
            return next();
        } else {
            return res.status(402).json({
                success: false,
                message: req.__("subscription_cancelled_no_longer_charged")
            });
        }
    } catch (error) {
        console.error("isSubscriptionActive error:", error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
};

exports.hasRefreshToken = (req, res, next) => {
    let token =
        req.cookies?.refreshToken ||
        req.headers["x-refresh-token"] ||
        req.body?.refreshToken;

    let isAccessTokenFallback = false;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
        isAccessTokenFallback = true;
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: req.__("login_again_to_access")
        });
    }
    try {
        const decodedToken = verifyToken(token);
        req.user = decodedToken;
        req.refreshToken = token;
        req.isAccessTokenFallback = isAccessTokenFallback;

        next();
    } catch (error) {
        console.error(error);

        res.clearCookie('accessToken', getClearCookieOptions(true));
        res.clearCookie('refreshToken', getClearCookieOptions(true));
        res.clearCookie('restroprosaas__authenticated', getClearCookieOptions(false));

        return res.status(401).json({
            success: false,
            message: req.__("operation_not_allowed")
        });
    }
} 

exports.authorize = (requiredScopes) => {
    return async (req, res, next) => {
        try {
            const { username, tenant_id } = req.user;
            const user = await getUserDB(username, tenant_id);

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: req.__("operation_not_allowed")
                });
            }

            // If no specific scopes required, allow
            if (!requiredScopes || requiredScopes.length === 0) {
                return next();
            }

            // 1. Parse Plan Features
            let userPlanFeatures = [];
            const rawPlan = user.plan_features || user.planFeatures || user.features;
            if (Array.isArray(rawPlan)) {
                userPlanFeatures = rawPlan;
            } else if (typeof rawPlan === "string") {
                try {
                    const parsed = JSON.parse(rawPlan);
                    userPlanFeatures = Array.isArray(parsed) ? parsed : [rawPlan];
                } catch {
                    userPlanFeatures = rawPlan.split(",");
                }
            }
            userPlanFeatures = userPlanFeatures.map((s) => String(s).trim().toUpperCase());

            // 2. Check Plan Access (applies to ALL roles, including admin)
            const hasPlanAccess = requiredScopes.some((scope) => {
                const normalized = String(scope).trim().toUpperCase();
                const parentFeature = SCOPE_TO_PLAN_FEATURE[normalized] || normalized;
                return (
                    userPlanFeatures.includes(normalized) ||
                    userPlanFeatures.includes(parentFeature)
                );
            });

            if (!hasPlanAccess) {
                return res.status(403).json({
                    success: false,
                    message: req.__("operation_not_allowed")
                });
            }

            // Tenant Admin has full access to features in their plan
            if (user.role == ROLES.ADMIN) {
                return next();
            }

            // 3. For Staff Users: check granular permissions in user.scope
            const userScopesArr = (user.scope || "")
                .split(",")
                .map((s) => s.trim().toUpperCase());

            const isOperationAllowed = requiredScopes.some((scope) =>
                userScopesArr.includes(String(scope).trim().toUpperCase())
            );

            if (!isOperationAllowed) {
                return res.status(403).json({
                    success: false,
                    message: req.__("operation_not_allowed")
                });
            }

            next();
        } catch (error) {
            console.error("authorize error:", error);
            return res.status(500).json({
                success: false,
                message: req.__("something_went_wrong_try_later")
            });
        }
    };
};

exports.isSuperAdmin = async (req, res, next) => {
    try {
        const {username, role} = req.user;
    
        const user = await getAdminUserDB(username);

        if(!user) {
            return res.status(401).json({
                success: false, 
                message: req.__("operation_not_allowed")
            });
        }

        next();

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
}
