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
    try {
      if (role === "superadmin") {
        await apiClient.post("/superadmin/refresh-token");
      } else {
        const res = await apiClient.post("/auth/refresh-token");
        const updatedUser = res.data.userDetails;
        if (updatedUser) {
          saveUserDetailsInLocalStorage(updatedUser);
        }
      }
    } catch (error) {
      console.error("Token refresh failed:", error);

      // Only redirect on actual 401 Unauthorized errors
      if (error?.response?.status === 401) {
        if (role === "superadmin") {
          navigate("/superadmin", { replace: true });
        } else {
          navigate("/refresh", { replace: true });
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
