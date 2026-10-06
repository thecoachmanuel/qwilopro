import axios from "axios";
import { API } from "../config/config";

const DEFAULT_CART_KEY = 'RESTROPROSAAS__CART';

export async function getQRMenuInit(qrcode, tableId) {
    axios.defaults.withCredentials = true;
    try {
        const query = (tableId && tableId !== "null" && tableId !== "undefined") ? `?tableId=${encodeURIComponent(tableId)}` : "";
        const response = await axios.get(`${API}/qrmenu/${qrcode}${query}`);
        return response;
    } catch (error) {
        throw error;
    }
}

export function getCart(storeIdentifier) {
    if (typeof window === 'undefined') return [];
    const key = storeIdentifier ? `RESTROPROSAAS__CART_${storeIdentifier}` : DEFAULT_CART_KEY;
    const cartString = localStorage.getItem(key);
    if (cartString) {
        try { return JSON.parse(cartString); } catch (e) { return []; }
    }
    if (storeIdentifier) {
        const legacy = localStorage.getItem(DEFAULT_CART_KEY);
        if (legacy) {
            try { return JSON.parse(legacy); } catch (e) { return []; }
        }
    }
    return [];
}

export function setCart(cart, storeIdentifier) {
    if (typeof window === 'undefined') return;
    const key = storeIdentifier ? `RESTROPROSAAS__CART_${storeIdentifier}` : DEFAULT_CART_KEY;
    localStorage.setItem(key, JSON.stringify(cart));
}

const STRIP_FIELDS = ['image', 'recipeItems', 'category', 'description', 'category_id'];

function deepSanitizeCartItem(item) {
    if (!item || typeof item !== 'object') return item;
    const clean = { ...item };
    STRIP_FIELDS.forEach((f) => delete clean[f]);
    if (Array.isArray(clean.addons)) {
        clean.addons = clean.addons.map((a) => {
            if (!a || typeof a !== 'object') return a;
            const { image, ...ca } = a; return ca;
        });
    }
    if (Array.isArray(clean.variants)) {
        clean.variants = clean.variants.map((v) => {
            if (!v || typeof v !== 'object') return v;
            const { image, ...cv } = v; return cv;
        });
    }
    return clean;
}

export async function createOrderFromQrMenu(deliveryType, cartItems, customerType, customer, tableId, qrcode, deliveryFee = 0) {
    try {
        const cleanCartItems = Array.isArray(cartItems)
            ? cartItems.map(deepSanitizeCartItem)
            : cartItems;

        const response = await axios.post(`${API}/qrmenu/${qrcode}/place-order`, {
           deliveryType, cartItems: cleanCartItems, customerType, customer, tableId, deliveryFee
        });
        return response;
    } catch (error) {
        throw error;
    }
}


export async function saveFeedback(qrcode, invoiceId, customerId, name, phone, email, birthdate, food_quality, service, ambiance, staff_behavior, recommend, remarks) {
    try {
        const response = await axios.post(`${API}/qrmenu/${qrcode}/feedback` , {
            invoiceId, customerId, name, phone, email, birthdate, food_quality, service, ambiance, staff_behavior, recommend, remarks
        });
        return response;
    } catch (error) {
        throw error;
    }
}