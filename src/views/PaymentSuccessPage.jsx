import React, { useEffect, useState } from 'react'
import AppBarDropdown from '../components/AppBarDropdown'
import Page from "../components/Page";
import Logo from "../assets/logo.svg";
import LogoDark from "../assets/LogoDark.svg"
import { IconCircleCheckFilled, IconDashboard, IconLayoutDashboard, IconLogout, IconDeviceTablet, IconChefHat } from '@tabler/icons-react';
import { iconStroke } from '../config/config';
import toast from 'react-hot-toast';
import { signOut } from '../controllers/auth.controller';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from "react-i18next";
import { useTheme } from '../contexts/ThemeContext';
import useAuth from '../helpers/useAuth';
import { verifyPaystackPayment } from '../controllers/plans.controller';
import { getUserDetailsInLocalStorage, saveUserDetailsInLocalStorage } from '../helpers/UserDetails';

export default function PaymentSuccessPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("trxref");
  const [isVerifying, setIsVerifying] = useState(!!reference);
  const [verifiedPlan, setVerifiedPlan] = useState(null);

  useAuth();

  useEffect(() => {
    if (!reference) return;

    let isMounted = true;
    const verify = async () => {
      try {
        const res = await verifyPaystackPayment(reference);
        if (isMounted && res.data?.success) {
          const user = getUserDetailsInLocalStorage();
          if (user) {
            let features = ["DASHBOARD", "POS", "ORDERS", "KITCHEN", "INVOICES", "SETTINGS", "REPORTS", "USER", "QRMENU"];
            if (res.data?.features) {
              try {
                features = typeof res.data.features === "string" ? JSON.parse(res.data.features) : res.data.features;
              } catch {}
            }

            const updatedUser = {
              ...user,
              is_active: 1,
              subscription_is_active: 1,
              subscription_end: res.data?.subscriptionEnd || user.subscription_end,
              plan_title: res.data?.planTitle || user.plan_title,
              planFeatures: features,
              planFeautures: features,
              plan_features: features,
              features: features,
            };
            saveUserDetailsInLocalStorage(updatedUser);
            window.dispatchEvent(new Event("restro_user_updated"));
          }
          setVerifiedPlan(res.data?.planTitle || "Plan");
          toast.success("Subscription activated successfully! Welcome aboard.");
        }
      } catch (err) {
        console.warn("Paystack verification status:", err?.response?.data?.message || err?.message);
      } finally {
        if (isMounted) setIsVerifying(false);
      }
    };

    verify();
    return () => {
      isMounted = false;
    };
  }, [reference]);

  return (
    <Page className=''>
      <div className="fixed flex items-center justify-between px-4 py-3 border-b border-restro-border-green w-full dark:bg-black">
        <img src={(theme === "black" ? LogoDark : Logo)?.src || (theme === "black" ? LogoDark : Logo)} alt="logo" className="h-12 block" />

        {/* profile */}
        <AppBarDropdown />
        {/* profile */}
      </div>

      <div className="min-h-screen container mx-auto flex items-center justify-center flex-col px-4">
        {isVerifying ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
            <p className="text-base font-medium text-slate-700 dark:text-neutral-300">
              Confirming your subscription payment with Paystack...
            </p>
          </div>
        ) : (
          <>
            <IconCircleCheckFilled className='text-restro-green' size={56} />
            <h1 className="text-3xl font-bold mt-3 text-center">{t("payment_success.title")}</h1>
            <p className="text-center text-slate-600 dark:text-neutral-400 mt-2 max-w-md">
              {verifiedPlan ? `Your ${verifiedPlan} subscription is now fully active!` : t("payment_success.message")}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <button
                onClick={() => navigate("/dashboard/pos", { replace: true })}
                className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 bg-restro-green text-white font-medium shadow hover:opacity-90 active:scale-95 transition text-sm"
              >
                <IconDeviceTablet stroke={iconStroke} size={18} /> Open POS
              </button>
              <button
                onClick={() => navigate("/dashboard/orders", { replace: true })}
                className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 border border-restro-border-green text-restro-green dark:text-emerald-400 font-medium hover:bg-restro-green/10 active:scale-95 transition text-sm"
              >
                <IconChefHat stroke={iconStroke} size={18} /> View Orders & Kitchen
              </button>
              <button
                onClick={() => navigate("/dashboard/home", { replace: true })}
                className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 bg-gray-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-medium hover:bg-gray-200 active:scale-95 transition text-sm"
              >
                <IconLayoutDashboard stroke={iconStroke} size={18} /> Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
