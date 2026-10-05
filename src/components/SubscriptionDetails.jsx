import { IconCreditCard } from "@tabler/icons-react";
import React from "react";
import { iconStroke } from "../config/config";
import { cancelSubscription, useSubscriptionDetails } from "../controllers/auth.controller";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { getManageSubscriptionLink, getPaystackManageSubscriptionLink } from "../controllers/plans.controller";

export default function SubscriptionDetails() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { error, isLoading, data } = useSubscriptionDetails();
  const { theme } = useTheme();

  if(isLoading) {
    return <div>{t("toast.please_wait")}</div>
  }

  if(error) {
    console.error(error);
    return <div>{t("toast.something_went_wrong")}</div>
  }  

  const btnCancelSubscription = async () => {
    const subscriptionId = data?.subscription_id;
    const paymentGateway = data?.payment_gateway;

    const isConfirm = data?.isTrialPlan
      ? window.confirm(t("subscription.cancel_confirm"))
      : window.confirm(
          `Do you want to cancel this plan? You’ll retain access until ${String(
            data?.subscription_end
          ).substring(
            0,
            10
          )}, after which your subscription will end and you won't be charged further.`
        );

    if (!isConfirm) {
      return;
    }

    try {
      toast.loading(t("toast.please_wait"));

      if (paymentGateway == "paystack") {
        if (!subscriptionId) {
          toast.dismiss();
          toast.error(t("toast.something_went_wrong"));
          return;
        }

        const res = await getPaystackManageSubscriptionLink(subscriptionId);

        if (res.status === 200 && res.data?.url) {
          toast.dismiss();
          window.location.href = res.data.url;
        } else {
          toast.dismiss();
          toast.error(t("toast.something_went_wrong"));
        }

        return;
      }

      // Default (e.g. Stripe) – call cancel subscription API
      const res = await cancelSubscription(subscriptionId);
      if (res.status === 200) {
        toast.dismiss();
        toast.success(t("subscription.cancel_success"));
        data?.isTrialPlan && navigate("/dashboard/inactive-subscription");
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message || t("subscription.cancel_error");
      toast.dismiss();
      toast.error(message);
    }
  };

  const btnManageSubscription = async () => {
    const paymentGateway = data?.payment_gateway;
    const paymentCustomerId = data?.payment_customer_id;

    if (paymentCustomerId) {
      try {
        toast.loading(t("toast.please_wait"));
        const res =
          paymentGateway === "paystack"
            ? await getPaystackManageSubscriptionLink(paymentCustomerId)
            : await getManageSubscriptionLink(paymentCustomerId);

        if (res.status === 200 && res.data?.url) {
          toast.dismiss();
          window.location.href = res.data.url;
          return;
        }
      } catch (error) {
        console.warn("Manage subscription portal unavailable, redirecting to plan manager:", error);
      } finally {
        toast.dismiss();
      }
    }

    // Fallback: navigate to plans & subscription management page
    navigate("/dashboard/inactive-subscription?manage=true");
  };

  return (
    <div className="w-full md:w-96 rounded-3xl border border-restro-border-green px-4 py-3 bg-restro-card-bg">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 flex items-center justify-center rounded-2xl bg-restro-green text-white">
          <IconCreditCard stroke={iconStroke} />
        </div>
        <p className="font-semibold">{t("subscription.details")}</p>
      </div>
      {data?.is_active && data?.status != "cancelAtPeriodEnd" ? (
        <div>
          <p className="mt-4 text-sm">
            <span className="text-gray-400">{t("subscription.status")}:</span>{" "}
            <span className="text-restro-green font-semibold">{t("subscription.active")}</span>
          </p>
      
          <p className="mt-2 text-sm">
            <span className="text-gray-400">{t("subscription.renews_at")}:</span>{" "}
            <span className="font-medium">{String(data?.subscription_end).substring(0,10)}</span>
          </p>
      
          <div className="flex flex-col gap-2 mt-4">
            <button 
              onClick={btnManageSubscription}
              className="w-full block bg-restro-green text-white px-4 py-2 rounded-2xl transition hover:bg-restro-green-button-hover active:scale-95 text-sm font-semibold"
            >
              {t("Manage / Upgrade Subscription")}
            </button>
            <button 
              onClick={btnCancelSubscription}
              className="w-full block bg-red-50 dark:bg-red-950/30 text-red-500 px-4 py-2 rounded-2xl transition hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-95 text-sm"
            >
              {t("subscription.cancel_subscription")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-gray-500">
            {data?.isTrialPlan == 0 ? (
              <>Your subscription has been canceled or expired.</>
            ) : (
              <>Your free trial has ended.</>
            )}
          </p>
          <button 
            onClick={btnManageSubscription}
            className="w-full block mt-4 bg-restro-green text-white px-4 py-2.5 rounded-2xl transition hover:bg-restro-green-button-hover active:scale-95 text-sm font-semibold shadow-sm"
          >
            {t("subscription.renew_or_change_plan") || "Subscribe / Upgrade Plan"}
          </button>
        </div>
      )}
    </div>
  );
}
