import axios from "axios";
import { API } from "../config/config";
import Cookie from "js-cookie";
import { getUserDetailsInLocalStorage } from "./UserDetails";
import { getLanguage } from "./LocalizationHelper";

const apiClient = axios.create({
  baseURL: API,
});

apiClient.interceptors.request.use(
  (config) => {
    // If URL starts with /api/v1, strip it so baseURL is not duplicated
    if (config.url && config.url.startsWith("/api/v1")) {
      config.url = config.url.replace(/^\/api\/v1/, "") || "/";
    }

    // Attach Bearer token from localStorage or cookie for bulletproof authentication
    const token =
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("restroprosaas_token")) ||
      Cookie.get("accessToken");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    const refreshToken =
      typeof localStorage !== "undefined" &&
      localStorage.getItem("restroprosaas_refresh_token");
    if (refreshToken) {
      config.headers = config.headers || {};
      config.headers["x-refresh-token"] = refreshToken;
    }

    // Add 'lang' as a query parameter from localStorage
    const lang = getLanguage(); // Get 'lang' from localStorage

    if (lang) {
      const separator = config.url.includes("?") ? "&" : "?"; // Check if the URL already has query params
      config.url = `${config.url}${separator}lang=${lang}`; // Append the 'lang' query param
    }

    config.withCredentials = true;
    return config;
  },
  (error) => Promise.reject(error)
);

let retryCounter = 0;

const clearAuthAndRedirect = (role) => {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("restroprosaas_user");
    localStorage.removeItem("restroprosaas_token");
    localStorage.removeItem("restroprosaas_refresh_token");
  }
  Cookie.remove("restroprosaas__authenticated");
  Cookie.remove("accessToken");
  Cookie.remove("refreshToken");

  if (typeof window !== "undefined") {
    const currentPath = window.location.pathname;
    const isAlreadyAtLogin =
      currentPath === "/login" ||
      currentPath === "/admin" ||
      currentPath === "/admin/login" ||
      currentPath === "/superadmin/login";
    if (!isAlreadyAtLogin) {
      if (role === "superadmin") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/login";
      }
    }
  }
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const user = getUserDetailsInLocalStorage();
    const role = user?.role || "";

    // 402 Payment Required: subscription is inactive or expired
    if (error?.response?.status === 402) {
      if (
        typeof window !== "undefined" &&
        role !== "superadmin" &&
        !window.location.pathname.includes("/dashboard/inactive-subscription")
      ) {
        window.location.href = "/dashboard/inactive-subscription";
      }
      return Promise.reject(error);
    }

    // NEVER retry a refresh-token endpoint
    if (originalRequest?.url && originalRequest.url.includes("refresh-token")) {
      return Promise.reject(error);
    }

    // 401 Unauthorized / 403 Forbidden: attempt token refresh
    if (
      (error?.response?.status === 401 || error?.response?.status === 403) &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      retryCounter += 1;

      if (retryCounter > 3) {
        clearAuthAndRedirect(role);
        return Promise.reject(error);
      }

      try {
        let res;
        if (role === "superadmin") {
          res = await apiClient.post("/superadmin/refresh-token");
        } else {
          res = await apiClient.post("/auth/refresh-token");
        }

        if (res.status === 401 || res.status === 403) {
          clearAuthAndRedirect(role);
          return Promise.reject(error);
        }

        const newAccessToken =
          res.data?.newAccessToken || res.data?.accessToken;
        if (newAccessToken && typeof localStorage !== "undefined") {
          localStorage.setItem("restroprosaas_token", newAccessToken);
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        if (res.data?.refreshToken && typeof localStorage !== "undefined") {
          localStorage.setItem("restroprosaas_refresh_token", res.data.refreshToken);
        }

        retryCounter = 0;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        console.error("Auto refresh on 401 failed:", refreshErr);
        // Do not boot user if offline or network error occurred
        if (
          (typeof navigator !== "undefined" && !navigator.onLine) ||
          !refreshErr.response ||
          refreshErr.code === "ERR_NETWORK"
        ) {
          return Promise.reject(refreshErr);
        }
        clearAuthAndRedirect(role);
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;