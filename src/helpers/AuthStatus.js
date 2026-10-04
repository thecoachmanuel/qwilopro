export function isRestroUserAuthenticated() {
    if (typeof document === "undefined") return false;
    const hasCookie = document.cookie.includes("restroprosaas__authenticated=");
    const hasLocalStorage = typeof localStorage !== "undefined" && !!localStorage.getItem("restroprosaas_user");
    return hasCookie || hasLocalStorage;
}