import { API_IMAGES_BASE_URL } from "../config/config";

export function getImageURL(path) {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:") || path.startsWith("blob:")) {
        return path;
    }
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const baseUrl = (typeof API_IMAGES_BASE_URL !== "undefined" && API_IMAGES_BASE_URL) 
        ? API_IMAGES_BASE_URL 
        : (typeof window !== "undefined" ? window.location.origin : "");
    return baseUrl + cleanPath;
}