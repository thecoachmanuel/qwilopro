export const API = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_BACKEND_URL) || "/api/v1";
export const VITE_BACKEND_SOCKET_IO = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SOCKET_IO) || (typeof window !== 'undefined' ? window.location.origin : "http://localhost:3000");
export const API_IMAGES_BASE_URL = (typeof window !== 'undefined' ? window.location.origin : "");
export const FRONTEND_DOMAIN = (typeof window !== 'undefined' ? window.location.origin : "http://localhost:3000");

export const iconStroke = 1.5;

export const supportEmail = "hi@uiflow.in";
export const appVersion = "2.1.0";

export const subscriptionAmount = 5;
export const subscriptionPrice = subscriptionAmount;

export const PRIMARY_CURRENCY = "NGN";
export const PRIMARY_CURRENCY_SYMBOL = "₦";
export const NAIRA_CONVERSION_RATE_TO_USD = 0.00074; // 1 USD = 1350 NGN

export const stripeProductSubscriptionId = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_STRIPE_PRODUCT_SUBSCRIPTION_KEY) || "price_1POsjYSCWiCS3BoQN2lnBMTz";