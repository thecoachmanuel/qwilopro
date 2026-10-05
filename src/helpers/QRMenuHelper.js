import { FRONTEND_DOMAIN } from "../config/config";

export const getQRMenuLink = (codeOrSettings, slug) => {
    let identifier;
    if (codeOrSettings && typeof codeOrSettings === 'object') {
        identifier = codeOrSettings.slug || codeOrSettings.unique_qr_code;
    } else {
        identifier = slug || codeOrSettings;
    }
    return `${FRONTEND_DOMAIN}/${identifier}`;
};

export const getTableQRMenuLink = (codeOrSettings, tableId, slug) => {
    let identifier;
    if (codeOrSettings && typeof codeOrSettings === 'object') {
        identifier = codeOrSettings.slug || codeOrSettings.unique_qr_code;
    } else {
        identifier = slug || codeOrSettings;
    }
    return `${FRONTEND_DOMAIN}/${identifier}?table=${tableId}`;
};

