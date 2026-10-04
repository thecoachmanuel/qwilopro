const NAVBAR_SIZE_KEY = 'RESTROPROSAAS__NAVBAR';

/**
 * @returns {boolean}
 */  
export function toggleNavbar() {
    if (typeof window === 'undefined') return false;
    const isNavbarCollapsed = localStorage.getItem(NAVBAR_SIZE_KEY);
    if(isNavbarCollapsed === true || isNavbarCollapsed === "true") {
        localStorage.setItem(NAVBAR_SIZE_KEY, false);
        return false;
    } else {
        localStorage.setItem(NAVBAR_SIZE_KEY, true);
        return true;
    }
}

export function getIsNavbarCollapsed() {
    if (typeof window === 'undefined') return false;
    const isNavbarCollapsed = localStorage.getItem(NAVBAR_SIZE_KEY);
    return isNavbarCollapsed === "true" ? true : false;
}