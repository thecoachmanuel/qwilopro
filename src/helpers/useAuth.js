import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getUserDetailsInLocalStorage,
  saveUserDetailsInLocalStorage,
} from "./UserDetails";
import apiClient from "./ApiClient";

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
      console.error("Token refresh failed:", error);

      // Only redirect on actual 401 Unauthorized errors if we have no valid token in storage
      if (error?.response?.status === 401) {
        const existingToken = localStorage.getItem("restroprosaas_token");
        if (!existingToken) {
          if (role === "superadmin") {
            navigate("/admin", { replace: true });
          } else {
            navigate("/login", { replace: true });
          }
        }
      }
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
