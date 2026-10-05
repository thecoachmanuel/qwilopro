import React from "react";
import {
  IconCircleCheckFilled,
  IconStar,
  IconArrowLeft,
  IconTruck,
  IconReceipt,
  IconMapPin,
  IconStars,
  IconChefHat
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { iconStroke } from "../config/config";

export default function OrderSuccessPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    orderId,
    invoiceId,
    qrcode,
    hasFeedback = true,
    deliveryType,
    deliveryFee,
    payableTotal,
    currency = "₦",
    customerName,
    deliveryAddress,
  } = location.state || {};

  const feedbackUrl = qrcode
    ? `/m/${qrcode}/feedback${invoiceId ? `?_ref=${invoiceId}` : ''}`
    : null;

  const menuUrl = qrcode ? `/m/${qrcode}` : "/";

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black px-4 py-8">
      <div className="w-full max-w-md bg-white dark:bg-[#121212] rounded-3xl shadow-xl border border-gray-200/70 dark:border-white/10 p-6 md:p-8 flex flex-col items-center text-center transition-all animate-fadeIn">
        
        {/* Animated Success Badge */}
        <div className="relative mb-5 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center animate-pulse">
            <IconCircleCheckFilled className="text-emerald-500" size={72} />
          </div>
        </div>

        {/* Title & Description */}
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-1.5">
          {t("order_success.order_placed_message") || "Order Placed Successfully!"}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
          {t("order_success.thank_you_message") || "Thank you for your order! It has been received and sent to the kitchen."}
        </p>

        {/* Order Reference Card */}
        <div className="w-full bg-gray-50 dark:bg-[#1a1a1a] rounded-2xl p-4 border border-gray-100 dark:border-white/5 mb-6 text-left space-y-2.5">
          {orderId && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5 font-medium">
                <IconReceipt size={15} stroke={iconStroke} /> Order Reference
              </span>
              <span className="font-bold text-gray-800 dark:text-gray-200 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full">
                #{orderId}
              </span>
            </div>
          )}

          {deliveryType && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1.5">
                {deliveryType === 'delivery' ? (
                  <IconTruck size={15} stroke={iconStroke} className="text-emerald-500" />
                ) : (
                  <IconChefHat size={15} stroke={iconStroke} />
                )}
                Order Type
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200 capitalize">
                {deliveryType === 'delivery' ? 'Home Delivery' : deliveryType === 'takeaway' ? 'Takeaway / Pickup' : 'Dine-In'}
              </span>
            </div>
          )}

          {deliveryAddress && (
            <div className="pt-2 border-t border-gray-200/60 dark:border-white/5 text-xs">
              <span className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1 mb-1">
                <IconMapPin size={14} stroke={iconStroke} className="text-emerald-500" /> Delivery Address
              </span>
              <p className="text-gray-700 dark:text-gray-300 font-medium line-clamp-2 pl-4">
                {deliveryAddress}
              </p>
            </div>
          )}

          {payableTotal !== undefined && (
            <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-200/60 dark:border-white/5">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Total Paid / Payable</span>
              <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                {currency}{Number(payableTotal).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Feedback / Review Section (Prompted if feedback is enabled) */}
        {hasFeedback && feedbackUrl && (
          <div className="w-full mb-5 p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 text-center">
            <div className="flex items-center justify-center gap-1 text-amber-500 mb-1.5">
              {[...Array(5)].map((_, i) => (
                <IconStar key={i} size={18} fill="currentColor" stroke={0} />
              ))}
            </div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-0.5">
              Rate Your Experience
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Your honest feedback helps us serve you even better.
            </p>
            <button
              onClick={() => navigate(feedbackUrl)}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs transition active:scale-95 shadow-sm flex items-center justify-center gap-1.5"
            >
              <IconStars size={16} stroke={iconStroke} />
              Leave a Quick Review
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="w-full flex flex-col gap-2.5">
          <Link
            to={menuUrl}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition active:scale-95 shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
          >
            <IconArrowLeft size={18} stroke={iconStroke} />
            Back to Digital Menu
          </Link>
        </div>

      </div>
    </div>
  );
}
