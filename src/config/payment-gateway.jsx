import React from "react";
import { IconCreditCard } from "@tabler/icons-react";
import { iconStroke } from "./config";
import { API } from "./config";

// Payment Gateway Image URLs
export const PAYMENT_GATEWAY_IMAGES = {
  paystack: "https://logosandtypes.com/wp-content/uploads/2024/02/Paystack.png",
  stripe:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/2560px-Stripe_Logo%2C_revised_2016.svg.png",
  paypal: "https://upload.wikimedia.org/wikipedia/commons/3/39/PayPal_logo.svg",
};

// Payment Gateway Base Configuration
export const PAYMENT_GATEWAYS = {
  paystack: {
    id: "paystack",
    name: "paystack",
    displayName: "Paystack",
    iconUrl: PAYMENT_GATEWAY_IMAGES.paystack,
    description: "Accept payments across Nigeria and Africa with Paystack (Primary)",
    website: "https://paystack.com",
    supportedCountries: ["Nigeria", "Ghana", "South Africa", "Kenya"],
    supportedCurrencies: ["NGN", "USD", "GHS", "ZAR", "KES", "XOF"],
    requiredCredentials: [
      {
        key: "public_key",
        label: "Public Key",
        type: "text",
        required: true,
        description: "Your Paystack public key (starts with pk_)",
        placeholder: "pk_test_...",
      },
      {
        key: "secret_key",
        label: "Secret Key",
        type: "password",
        required: true,
        description: "Your Paystack secret key (starts with sk_)",
        placeholder: "sk_test_...",
      },
    ],
    webhookUrl: `${API}/auth/paystack-webhook`,
    isEnabled: true,
    isPrimary: true,
  },
  stripe: {
    id: "stripe",
    name: "stripe",
    displayName: "Stripe",
    iconUrl: PAYMENT_GATEWAY_IMAGES.stripe,
    description: "Accept payments globally with Stripe (Optional)",
    website: "https://stripe.com",
    supportedCountries: ["Global", "Nigeria"],
    supportedCurrencies: ["Global", "NGN", "USD"],
    requiredCredentials: [
      {
        key: "publishable_key",
        label: "Publishable Key",
        type: "text",
        required: true,
        description: "Your Stripe publishable API key (starts with pk_)",
        placeholder: "pk_test_...",
      },
      {
        key: "secret_key",
        label: "Secret Key",
        type: "password",
        required: true,
        description: "Your Stripe secret API key (starts with sk_)",
        placeholder: "sk_test_...",
      },
      {
        key: "webhook_secret",
        label: "Webhook Secret",
        type: "password",
        required: false,
        description: "Your Stripe webhook signing secret (starts with whsec_)",
        placeholder: "whsec_...",
      },
      {
        key: "portal_config_id",
        label: "Portal Config ID",
        type: "text",
        required: false,
        description: "Your Stripe portal config ID",
        placeholder: "Enter your portal config ID...",
      },
    ],
    webhookUrl: `${API}/auth/stripe-webhook`,
    isEnabled: true,
    isPrimary: false,
  },
};

export const getPaymentGatewayCredentials = (gatewayName) => {
  const gateway = PAYMENT_GATEWAYS[gatewayName];
  if (!gateway) {
    return [];
  }
  return gateway.requiredCredentials;
};

// Get payment gateway by name
export const getPaymentGateway = (gatewayName) => {
  return PAYMENT_GATEWAYS[gatewayName] || null;
};

// Get payment gateway icon URL
export const getPaymentGatewayIconUrl = (gatewayName) => {
  const gateway = PAYMENT_GATEWAYS[gatewayName];
  if (!gateway || !gateway.iconUrl) {
    return null;
  }
  return gateway.iconUrl;
};

// Get payment gateway icon as image element
export const getPaymentGatewayIcon = (gatewayName, size = 32) => {
  const gateway = PAYMENT_GATEWAYS[gatewayName];
  if (!gateway || !gateway.iconUrl) {
    return <IconCreditCard size={size} stroke={iconStroke} />;
  }
  return (
    <img
      src={gateway.iconUrl}
      alt={gateway.displayName}
      className="w-full h-full object-contain"
      style={{ width: size, height: size }}
    />
  );
};

// Get payment gateway display name
export const getPaymentGatewayName = (gatewayName) => {
  const gateway = PAYMENT_GATEWAYS[gatewayName];
  if (!gateway) {
    return gatewayName;
  }
  return gateway.displayName;
};

// Get all payment gateways as array
export const getAllPaymentGateways = () => {
  return Object.values(PAYMENT_GATEWAYS);
};
