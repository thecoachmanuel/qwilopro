import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getUserDetailsInLocalStorage,
  saveUserDetailsInLocalStorage,
  clearUserDetailsInLocalStorage,
} from "./UserDetails";
import apiClient from "./ApiClient";

/**
 * Centrally clears all auth state without a hard reload.
 * ApiClient.js handles hard reload on 401 for API requests;
 * this handles the safeRefresh polling path.
 */
function clearAllAuthState(role, navigate) {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("restroprosaas_user");
    localStorage.removeItem("restroprosaas_token");
    localStorage.removeItem("restroprosaas_refresh_token");
  }
  // Clear js-cookie values if available
  try {
    if (typeof document !== "undefined") {
      document.cookie = "restroprosaas__authenticated=; Max-Age=0; path=/";
      document.cookie = "accessToken=; Max-Age=0; path=/";
      document.cookie = "refreshToken=; Max-Age=0; path=/";
    }
  } catch {}
  if (role === "superadmin") {
    navigate("/admin", { replace: true });
  } else {
    navigate("/login", { replace: true });
  }
}

export default function useAuth() {
  const location = useLocation();
  const navigate = useNavigate();

  const user = getUserDetailsInLocalStorage();
  const role = user?.role || "";

  const safeRefresh = async () => {
    if (!user) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return; // Offline mode: keep existing session intact
    }
    try {
      if (role === "superadmin") {
        const res = await apiClient.post("/superadmin/refresh-token");
        if (res?.data?.accessToken) {
          localStorage.setItem("restroprosaas_token", res.data.accessToken);
        }
      } else {
        const res = await apiClient.post("/auth/refresh-token");
        const updatedUser = res.data?.userDetails;
        if (updatedUser) {
          saveUserDetailsInLocalStorage(updatedUser);
        }
        if (res?.data?.newAccessToken) {
          localStorage.setItem("restroprosaas_token", res.data.newAccessToken);
        }
        if (res?.data?.refreshToken) {
          localStorage.setItem("restroprosaas_refresh_token", res.data.refreshToken);
        }
      }
    } catch (error) {
      // If offline or network error occurred, do not boot user
      if (
        (typeof navigator !== "undefined" && !navigator.onLine) ||
        !error.response ||
        error.code === "ERR_NETWORK"
      ) {
        return;
      }

      const status = error?.response?.status;
      const loginNeeded = error?.response?.data?.loginNeeded;

      // Only hard-clear and redirect on explicit 401 with loginNeeded flag
      // (meaning the server deliberately revoked the session — e.g. email change/deactivation).
      // Do NOT redirect on transient 401s (e.g. race condition during token rotation).
      if (status === 401 && loginNeeded) {
        clearAllAuthState(role, navigate);
      }
      // For other 401s (e.g. during rotation), ApiClient interceptor already handles retry.
    }
  };

  // p1 + p2: initial token + refresh every 13 minutes
  useEffect(() => {
    safeRefresh();

    const id = setInterval(() => {
      safeRefresh();
    }, 13 * 60 * 1000); // 13 minutes

    return () => clearInterval(id);
  }, []);

  // p3: get token when window activity changes
  useEffect(() => {
    const handleActivity = () => {
      safeRefresh();
    };

    window.addEventListener("focus", handleActivity);
    document.addEventListener("visibilitychange", handleActivity);

    return () => {
      window.removeEventListener("focus", handleActivity);
      document.removeEventListener("visibilitychange", handleActivity);
    };
  }, []);

  // p4: get token when path changes, (optional) -- require for upgrade/downgrade
  useEffect(() => {
    safeRefresh();
  }, [location.pathname]);
}

