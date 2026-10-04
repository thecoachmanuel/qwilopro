const LANGUAGE_KEY = "RESTRO__LANG";

export function getLanguage() {
    if (typeof window === 'undefined') return "en";
    return localStorage.getItem(LANGUAGE_KEY) || "en";
}

export function setLanguage(lang) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LANGUAGE_KEY, lang);
}