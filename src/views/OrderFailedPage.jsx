import React from "react";
import { IconCircleXFilled, IconArrowLeft, IconHome } from '@tabler/icons-react';
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { useNavigate, useLocation } from "react-router-dom";

function OrderFailedPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Support navigating back to the specific store that failed
  const qrcode = location.state?.qrcode || null;

  const handleTryAgain = () => {
    if (window.history.length > 2) {
      window.history.back();
    } else if (qrcode) {
      navigate(`/${qrcode}`);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="w-full min-h-screen flex justify-center items-center p-4">
      <div className="w-full max-w-sm mx-auto shadow-lg rounded-2xl px-10 py-10 flex flex-col items-center gap-6">

        <div className="text-center">
          <p className="text-sm text-gray-500">{t("order_failed.oops_message")}</p>
        </div>

        <div className="text-center">
          <IconCircleXFilled className="text-red-500 mx-auto" size={120} />
          <p className="text-lg font-bold tracking-wide mt-3">
            {t("order_failed.order_failed_message")}
          </p>
          <p className="text-sm text-gray-500 tracking-wide mt-2">
            {t("order_failed.try_again_message")}
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            id="btn-try-again"
            onClick={handleTryAgain}
            className="w-full flex items-center justify-center gap-2 bg-restro-green text-white font-semibold py-3 px-6 rounded-xl active:scale-95 transition"
          >
            <IconArrowLeft size={18} stroke={2} />
            {t("order_failed.try_again_message") || "Try Again"}
          </button>

          <button
            id="btn-go-home"
            onClick={() => navigate(qrcode ? `/${qrcode}` : '/')}
            className="w-full flex items-center justify-center gap-2 border border-restro-border-green-light text-gray-600 dark:text-white font-semibold py-3 px-6 rounded-xl active:scale-95 transition"
          >
            <IconHome size={18} stroke={2} />
            {"Go to Menu"}
          </button>
        </div>

      </div>
    </div>
  );
}

export default OrderFailedPage;
