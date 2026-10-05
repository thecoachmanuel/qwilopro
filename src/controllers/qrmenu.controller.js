import axios from "axios";
import { API } from "../config/config";

const DEFAULT_CART_KEY = 'RESTROPROSAAS__CART';

export async function getQRMenuInit(qrcode, tableId) {
    axios.defaults.withCredentials = true;
    try {
        const response = await axios.get(`${API}/qrmenu/${qrcode}?tableId=${tableId}`);
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

export async function createOrderFromQrMenu(deliveryType, cartItems, customerType, customer, tableId, qrcode, deliveryFee = 0) {
    try {
        const response = await axios.post(`${API}/qrmenu/${qrcode}/place-order`, {
           deliveryType, cartItems, customerType, customer, tableId, deliveryFee
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