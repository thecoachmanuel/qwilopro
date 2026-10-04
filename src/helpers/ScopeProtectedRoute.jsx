import { Navigate } from "react-router-dom";
import { getUserDetailsInLocalStorage } from "./UserDetails";
import { PLAN_FEATURES, SCOPES } from "../config/scopes";

// Map sub-scopes to their parent plan feature
const SCOPE_TO_PLAN_FEATURE = {
  CUSTOMER_DISPLAY: PLAN_FEATURES.POS,
  KITCHEN_DISPLAY: PLAN_FEATURES.KITCHEN,
  ORDER_STATUS_DISPLAY: PLAN_FEATURES.POS,
  ORDER_STATUS: PLAN_FEATURES.POS,
  VIEW_RESERVATIONS: PLAN_FEATURES.RESERVATIONS,
  MANAGE_RESERVATIONS: PLAN_FEATURES.RESERVATIONS,
  VIEW_CUSTOMERS: PLAN_FEATURES.CUSTOMERS,
  MANAGE_CUSTOMERS: PLAN_FEATURES.CUSTOMERS,
  VIEW_INVENTORY: PLAN_FEATURES.INVENTORY,
  MANAGE_INVENTORY: PLAN_FEATURES.INVENTORY,
};

function parseFeatures(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((f) => String(f).trim().toUpperCase());
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((f) => String(f).trim().toUpperCase());
    } catch {
      // not json
    }
    return raw.split(",").map((f) => f.trim().toUpperCase()).filter(Boolean);
  }
  return [];
}

const ScopeProtectedRoute = ({ children, scopes }) => {
  const user = getUserDetailsInLocalStorage();
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = user.role;
  if (role === "superadmin") {
    return children;
  }

  const userPlanFeatures = parseFeatures(
    user?.planFeatures || user?.planFeautures || user?.plan_features || user?.features
  );

  // Check subscription active status & expiry date
  const isActive = Number(user?.is_active) === 1;
  const isExpired = user?.subscription_end
    ? new Date(user.subscription_end).getTime() < new Date().setHours(0, 0, 0, 0)
    : false;

  if (!isActive || isExpired) {
    return <Navigate to="/dashboard/inactive-subscription" replace />;
  }

  // If no specific scopes required for this route, allow access
  if (!scopes || scopes.length === 0) {
    return children;
  }

  // 1. Check Plan Features Access (applies to ALL roles, including admin)
  const hasPlanAccess = scopes.some((scope) => {
    const normalized = String(scope).trim().toUpperCase();
    const parentFeature = SCOPE_TO_PLAN_FEATURE[normalized] || normalized;
    return (
      userPlanFeatures.includes(normalized) ||
      userPlanFeatures.includes(parentFeature)
    );
  });

  if (!hasPlanAccess) {
    return <Navigate to="/no-access" replace />;
  }

  // Tenant Admin has full access to all features included in their plan
  if (role === "admin") {
    return children;
  }

  // 2. For Staff Users: check granular permissions in user.scope
  const userScopes = (user.scope || "")
    .split(",")
    .map((s) => s.trim().toUpperCase());

  const hasStaffAccess = scopes.some((scope) =>
    userScopes.includes(String(scope).trim().toUpperCase())
  );

  if (hasStaffAccess) {
    return children;
  }

  return <Navigate to="/no-access" replace />;
};

export default ScopeProtectedRoute;
