import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getUserDetailsInLocalStorage, saveUserDetailsInLocalStorage } from "./UserDetails";
import { PLAN_FEATURES, SCOPES } from "../config/scopes";
import apiClient from "./ApiClient";

const DEFAULT_STARTER_FEATURES = [
  "DASHBOARD",
  "POS",
  "ORDERS",
  "INVOICES",
  "SETTINGS",
  "REPORTS",
  "USER",
];

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
  const [user, setUser] = useState(getUserDetailsInLocalStorage());
  const [checkedServer, setCheckedServer] = useState(false);

  useEffect(() => {
    const handleUserUpdated = () => {
      setUser(getUserDetailsInLocalStorage());
    };
    window.addEventListener("restro_user_updated", handleUserUpdated);
    return () => window.removeEventListener("restro_user_updated", handleUserUpdated);
  }, []);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = user.role;
  if (role === "superadmin") {
    return children;
  }

  let userPlanFeatures = parseFeatures(
    user?.planFeatures || user?.planFeautures || user?.plan_features || user?.features
  );

  // If active tenant admin has empty features in storage, grant base starter features so they are never locked out
  if (role === "admin" && userPlanFeatures.length === 0 && Number(user?.is_active) === 1) {
    userPlanFeatures = DEFAULT_STARTER_FEATURES;
  }

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

  // 1. Check Plan Features Access
  const hasPlanAccess = scopes.some((scope) => {
    const normalized = String(scope).trim().toUpperCase();
    const parentFeature = SCOPE_TO_PLAN_FEATURE[normalized] || normalized;
    return (
      userPlanFeatures.includes(normalized) ||
      userPlanFeatures.includes(parentFeature)
    );
  });

  // If tenant admin has plan access, let them in
  if (hasPlanAccess && role === "admin") {
    return children;
  }

  // If staff user, check granular permissions in user.scope
  if (hasPlanAccess && role !== "admin") {
    const userScopes = (user.scope || "")
      .split(",")
      .map((s) => s.trim().toUpperCase());

    const hasStaffAccess = scopes.some((scope) =>
      userScopes.includes(String(scope).trim().toUpperCase())
    );

    if (hasStaffAccess) {
      return children;
    }
  }

  // If access not recognized yet, but we are online and haven't synced fresh plan claims with the server:
  if (!checkedServer && typeof navigator !== "undefined" && navigator.onLine) {
    apiClient
      .post("/auth/refresh-token")
      .then((res) => {
        const freshUser = res.data?.userDetails;
        if (freshUser) {
          saveUserDetailsInLocalStorage(freshUser);
          setUser(freshUser);
        }
      })
      .catch((err) => {
        console.warn("Permission sync check:", err);
      })
      .finally(() => {
        setCheckedServer(true);
      });

    // Render smooth transition loader while verifying with server
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-medium text-slate-500 dark:text-neutral-400">Verifying plan permissions...</p>
      </div>
    );
  }

  return <Navigate to="/no-access" replace />;
};

export default ScopeProtectedRoute;
