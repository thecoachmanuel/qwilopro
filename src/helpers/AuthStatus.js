export function isRestroUserAuthenticated() {
    if (typeof window === "undefined" || typeof document === "undefined") return false;
    const hasCookie = document.cookie.includes("restroprosaas__authenticated=true");
    const hasToken = typeof localStorage !== "undefined" && !!localStorage.getItem("restroprosaas_token");
    const hasUser = typeof localStorage !== "undefined" && !!localStorage.getItem("restroprosaas_user");
    
    // User is only considered logged in if they have both user details and an auth token/cookie
    return (hasCookie || hasToken) && hasUser;
}