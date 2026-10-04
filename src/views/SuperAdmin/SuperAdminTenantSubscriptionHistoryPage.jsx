import React, { useEffect, useState, useRef } from 'react'
import Page from '../../components/Page'
import { Link, useParams } from 'react-router-dom'
import {
  useSuperAdminTenantSubscriptionHistory,
  updateTenant,
} from '../../controllers/superadmin.controller'
import { IconCheck, IconCreditCard, IconX, IconPencil, IconCalendar } from '@tabler/icons-react';
import { iconStroke, subscriptionPrice } from '../../config/config';
import { useTranslation } from "react-i18next";
import { useTheme } from '../../contexts/ThemeContext';
import { getSubscriptionHistory, getPlans } from '../../controllers/plans.controller';
import { toast } from 'react-hot-toast';
import { mutate } from 'swr';

export default function SuperAdminTenantSubscriptionHistoryPage() {
  const { t } = useTranslation();
  const params = useParams();
  const tenantId = params.id;
  const { APIURL, data, error, isLoading } = useSuperAdminTenantSubscriptionHistory(tenantId);
  const { theme } = useTheme();
  const [subscriptionHistory, setSubscriptionHistory] = useState([]);
  const [availablePlans, setAvailablePlans] = useState([]);

  // Form refs for update modal
  const editNameRef = useRef();
  const editEmailRef = useRef();
  const editIsActiveRef = useRef();
  const editSubStartRef = useRef();
  const editSubEndRef = useRef();
  const editPlanRef = useRef();

  const fetchSubscriptionDetails = async () => {
    try {
      const res = await getSubscriptionHistory(tenantId);
      const plans = res.data;
      setSubscriptionHistory(plans);
    } catch (err) {
      console.error("Failed to load history details:", err);
    } 
  };
  
  useEffect(() => {
    if (!tenantId) return;
    fetchSubscriptionDetails();

    async function loadPlans() {
      try {
        const res = await getPlans();
        if (res?.data?.data) {
          setAvailablePlans(res.data.data);
        }
      } catch (e) {
        console.error("Failed to load plans:", e);
      }
    }
    loadPlans();
  }, [tenantId]);

  if (isLoading) {
    return <Page>{t("superadmin_reports.loading_message")}</Page>;
  }

  if (error) {
    console.error(error);
    return <Page>{t("superadmin_reports.error_message")}</Page>;
  }

  const {
    tenantInfo,
    storeDetails,
    totalUsers,
  } = data || {};

  const handleOpenEditModal = () => {
    if (editNameRef.current) editNameRef.current.value = tenantInfo?.name || "";
    if (editEmailRef.current) editEmailRef.current.value = storeDetails?.email || tenantInfo?.email || "";
    if (editIsActiveRef.current) editIsActiveRef.current.checked = Number(tenantInfo?.is_active) === 1;
    if (editSubStartRef.current) {
      editSubStartRef.current.value = tenantInfo?.subscription_start
        ? new Date(tenantInfo.subscription_start).toISOString().split("T")[0]
        : "";
    }
    if (editSubEndRef.current) {
      editSubEndRef.current.value = tenantInfo?.subscription_end
        ? new Date(tenantInfo.subscription_end).toISOString().split("T")[0]
        : "";
    }
    if (editPlanRef.current) {
      const matched = availablePlans.find(
        (p) =>
          p.payment_gateway_product_id === tenantInfo?.payment_gateway_product_id ||
          p.title?.toLowerCase() === tenantInfo?.plan_title?.toLowerCase()
      );
      editPlanRef.current.value = matched?.payment_gateway_product_id || tenantInfo?.payment_gateway_product_id || "";
    }

    document.getElementById("modal-edit-sub")?.showModal();
  };

  const handleSaveSubscription = async () => {
    const name = editNameRef.current?.value || tenantInfo?.name;
    const email = editEmailRef.current?.value || storeDetails?.email;
    const isActive = editIsActiveRef.current?.checked ? 1 : 0;
    const subscription_start = editSubStartRef.current?.value || null;
    const subscription_end = editSubEndRef.current?.value || null;
    const payment_gateway_product_id = editPlanRef.current?.value || null;

    try {
      toast.loading("Saving changes...");
      const res = await updateTenant(
        name,
        email,
        isActive,
        tenantId,
        subscription_start,
        subscription_end,
        payment_gateway_product_id
      );

      if (res.status === 200) {
        await mutate(APIURL);
        await fetchSubscriptionDetails();
        document.getElementById("modal-edit-sub")?.close();
        toast.dismiss();
        toast.success(res.data?.message || "Subscription updated successfully!");
      }
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error(err?.response?.data?.message || "Failed to update subscription");
    }
  };

  return (
    <Page>
      {/* breadcrumbs */}
      <div className="breadcrumbs text-sm">
        <ul>
          <li><Link to="/admin/dashboard/tenants">{t('superadmin_tenant_subscription_history.tenants')}</Link></li>
          <li>{tenantInfo?.name || "Tenant"}</li>
          <li>{t('superadmin_tenant_subscription_history.subscription_history')}</li>
        </ul>
      </div>
      {/* breadcrumbs */}

      <div className="flex flex-col lg:flex-row gap-4 mt-6">
        <div className='w-full lg:w-4/12 border rounded-3xl px-5 py-6 border-restro-border-green '>
          <div className="flex items-center justify-between">
            <p className='text-xl font-bold'>{t("superadmin_tenant_subscription_history.tenant_details")}</p>
            <button
              onClick={handleOpenEditModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-restro-green text-white hover:bg-restro-green-button-hover active:scale-95 transition"
            >
              <IconPencil size={14} stroke={iconStroke} />
              Edit Subscription
            </button>
          </div>

          <p className='mt-4 text-sm text-restro-text'>{t("superadmin_tenant_subscription_history.tenant_name")}</p>
          <p className="font-semibold text-base">{tenantInfo?.name}</p>

          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <p className='text-sm text-restro-text'>{t("superadmin_tenant_subscription_history.status")}</p>
              {tenantInfo?.is_active == 1 ? (
                <div className='w-fit flex items-center justify-center text-sm rounded-full text-emerald-600 font-semibold'>
                  <IconCheck className='text-emerald-500 mr-1' size={16} stroke={iconStroke} /> {t("superadmin_tenant_subscription_history.active")}
                </div>
              ) : (
                <div className='w-fit flex items-center justify-center text-sm rounded-full text-red-600 font-semibold'>
                  <IconX className='text-red-500 mr-1' size={16} stroke={iconStroke} /> {t("superadmin_tenant_subscription_history.inactive")}
                </div>
              )}
            </div>

            <div className="flex-1">
              <p className='text-sm text-restro-text'>Current Plan</p>
              <span className="font-bold text-sm px-2.5 py-0.5 rounded-full bg-restro-green-10 text-restro-green border border-restro-border-green">
                {tenantInfo?.plan_title || "Starter"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 p-3 rounded-2xl bg-gray-50 dark:bg-restro-gray/40 border border-restro-border-green">
            <div>
              <p className="text-xs text-gray-500">Subscription Start</p>
              <p className="font-bold text-sm mt-0.5">
                {tenantInfo?.subscription_start
                  ? new Date(tenantInfo.subscription_start).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Subscription End</p>
              <p className="font-bold text-sm mt-0.5">
                {tenantInfo?.subscription_end
                  ? new Date(tenantInfo.subscription_end).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </div>

          <p className='mt-4 text-sm text-gray-500'>{t("superadmin_tenant_subscription_history.users")}</p>
          <p className="font-semibold">{totalUsers} {t("superadmin_tenant_subscription_history.users")}</p>

          <p className='mt-4 text-sm text-gray-500'>{t("superadmin_tenant_subscription_history.address")}</p>
          <p>{storeDetails?.address || "-"}</p>

          <div className="flex">
            <div className="flex-1">
              <p className='mt-4 text-sm text-gray-500'>{t("superadmin_tenant_subscription_history.email")}</p>
              <p className="text-sm font-medium">{storeDetails?.email || tenantInfo?.email || "-"}</p>
            </div>

            <div className="flex-1">
              <p className='mt-4 text-sm text-gray-500'>{t("superadmin_tenant_subscription_history.phone")}</p>
              <p className="text-sm font-medium">{storeDetails?.phone || "-"}</p>
            </div>
          </div>

          <div className="flex">
            <div className="flex-1">
              <p className='mt-4 text-sm text-gray-500'>{t("superadmin_tenant_subscription_history.currency")}</p>
              <p className="font-semibold">{storeDetails?.currency || "NGN"}</p>
            </div>

            <div className="flex-1">
              <p className='mt-4 text-sm text-gray-500'>{t("superadmin_tenant_subscription_history.qr_menu")}</p>
              <p>{storeDetails?.is_qr_menu_enabled ? t("superadmin_tenant_subscription_history.enabled") : t("superadmin_tenant_subscription_history.disabled")}</p>
            </div>
          </div>
        </div>

        <div className='w-full lg:w-8/12 border rounded-3xl px-5 py-6 border-restro-green'>
          <p className='text-xl font-bold'>{t("superadmin_tenant_subscription_history.payment_history")}</p>

          <div className="flex flex-col gap-4 mt-4">
            {(!subscriptionHistory || subscriptionHistory.length === 0) ? (
              <div className="text-center py-12 text-gray-400">
                No subscription history recorded yet.
              </div>
            ) : (
              subscriptionHistory
                ?.filter((item) => item.status !== "updated")
                ?.map((item, i) => {
                  const {
                    id,
                    tenant_id,
                    created_at,
                    starts_on,
                    expires_on,
                    status,
                    plan_title,
                    is_trial,
                    amount,
                    currency,
                    symbol,
                    frequency,
                  } = item;

                  return (
                    <div key={i} className="flex items-center gap-4 w-full p-3 rounded-2xl border border-gray-100 dark:border-restro-border-green/50">
                      <div className='w-14 h-14 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-restro-gray'>
                        <IconCreditCard stroke={iconStroke} />
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between w-full gap-1">
                          <p className="text-base font-bold">
                            <span>
                              {plan_title
                                ? `${symbol || "₦"}${amount || "0"}/${frequency || "monthly"}`
                                : t("superadmin_tenant_subscription_history.subscription_price", { price: subscriptionPrice })}
                            </span>
                            <span className='text-sm font-medium text-gray-500'>
                              {" "}{plan_title && `(${plan_title})`}{" "}
                            </span>
                          </p>
                          <div
                            className={`text-xs font-semibold py-1 px-3 rounded-full min-w-20 text-center ${
                              status === "cancelled" || status === "cancelAtPeriodEnd"
                                ? "bg-red-100 text-red-500 border border-red-500"
                                : status === "created"
                                ? "bg-green-100 text-green-500 border border-green-500"
                                : "bg-blue-100 text-blue-500 border border-blue-500"
                            }`}
                          >
                            {status}
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-2 md:gap-8 mt-1">
                          <p className="text-xs text-gray-500">
                            {status === "cancelled" || status === "cancelAtPeriodEnd"
                              ? t("superadmin_tenant_subscription_history.cancelled_on")
                              : t("superadmin_tenant_subscription_history.paid_on")}
                            :{" "}
                            {created_at ? new Date(created_at).toLocaleString("en", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }) : "-"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {t("superadmin_tenant_subscription_history.billing_period")}:{" "}
                            {starts_on ? new Date(starts_on).toLocaleDateString() : "-"}{" — "}
                            {expires_on ? new Date(expires_on).toLocaleDateString() : "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* Edit Subscription Modal */}
      <dialog id="modal-edit-sub" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box border border-restro-border-green dark:rounded-2xl">
          <h3 className="font-bold text-lg">Update Tenant Subscription</h3>
          <p className="text-xs text-gray-500 mt-1">Manually adjust subscription dates, plan tier, and active status.</p>

          <div className="mt-4">
            <label className="mb-1 block text-gray-500 text-sm">Tenant Name</label>
            <input
              ref={editNameRef}
              type="text"
              className="text-sm w-full border rounded-lg px-4 py-2 border-restro-border-green dark:bg-black outline-restro-border-green"
              placeholder="Tenant Name"
            />
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-gray-500 text-sm">Tenant Email</label>
            <input
              ref={editEmailRef}
              type="email"
              className="text-sm w-full border rounded-lg px-4 py-2 border-restro-border-green dark:bg-black outline-restro-border-green"
              placeholder="Email address"
            />
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-gray-500 text-sm">Assigned Plan</label>
            <select
              ref={editPlanRef}
              className="select select-sm w-full border border-restro-border-green rounded-lg focus:outline-none dark:bg-black dark:text-white"
            >
              <option value="">-- Select Plan --</option>
              {availablePlans.map((p) => (
                <option key={p.id} value={p.payment_gateway_product_id}>
                  {p.title} ({p.payment_gateway_product_id})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="mb-1 block text-gray-500 text-sm">Subscription Start</label>
              <input
                ref={editSubStartRef}
                type="date"
                className="text-sm w-full border rounded-lg px-3 py-1.5 border-restro-border-green dark:bg-black outline-restro-border-green"
              />
            </div>
            <div>
              <label className="mb-1 block text-gray-500 text-sm">Subscription End</label>
              <input
                ref={editSubEndRef}
                type="date"
                className="text-sm w-full border rounded-lg px-3 py-1.5 border-restro-border-green dark:bg-black outline-restro-border-green"
              />
            </div>
          </div>

          <div className="flex items-center mt-5 ml-1 gap-2">
            <label className="text-gray-500 text-sm mr-2">{t('superadmin_tenants.active')}</label>
            <label className="relative inline-flex items-center cursor-pointer no-drag">
              <input
                ref={editIsActiveRef}
                type="checkbox"
                name="isActive"
                className="sr-only peer"
              />
              <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-100 after:border-restro-bg-gray after:border after:rounded-full after:h-5 after:w-5 after:transition-all bg-restro-checkbox peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-restro-ring-light peer-checked:bg-restro-green peer-checked:after:border-restro-border-green"></div>
            </label>
          </div>

          <div className="modal-action mt-6">
            <form method="dialog" className="flex gap-2">
              <button
                type="button"
                onClick={() => document.getElementById("modal-edit-sub")?.close()}
                className="btn transition active:scale-95 hover:shadow-lg px-4 py-2.5 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSubscription}
                className="btn transition active:scale-95 hover:shadow-lg px-5 py-2.5 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover rounded-xl"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </Page>
  );
}
