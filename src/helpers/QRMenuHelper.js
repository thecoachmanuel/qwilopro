import { FRONTEND_DOMAIN } from "../config/config";

export const getQRMenuLink = (code, slug) => {
    const identifier = slug || code;
    return `${FRONTEND_DOMAIN}/${identifier}`;
}

export const getTableQRMenuLink = (code, tableId, slug) => {
    const identifier = slug || code;
    return `${FRONTEND_DOMAIN}/${identifier}?table=${tableId}`;
}
