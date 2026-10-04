const KEY = 'restroprosaas_user';

export function saveUserDetailsInLocalStorage(user) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(KEY, JSON.stringify(user));
}

export function getUserDetailsInLocalStorage() {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem(KEY);
    if (!userStr || userStr === "undefined") return null;

    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
}

export function clearUserDetailsInLocalStorage() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(KEY);
}