import React from "react";
import Page from "../components/Page";
import { useDashboard } from "../controllers/dashboard.controller";
import { CURRENCIES } from "../config/currencies.config";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  IconChevronRight,
  IconLoader2,
  IconReceipt2,
  IconShoppingCart,
  IconTicket,
  IconUserPlus,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import {
  KPICard,
  RevenueTrendChart,
  PeakHoursChart,
  DonutWidget,
  TopItemsList,
  LowStockAlerts,
  FeedbackWidget,
  ReservationWidget,
  calcDelta,
} from "../components/DashboardWidgets";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data, error, isLoading } = useDashboard();

  if (isLoading) {
    return (
      <Page>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-restro-text">
          <IconLoader2 className="animate-spin text-restro-green" size={40} stroke={iconStroke} />
          <p className="font-medium">{t("dashboard.loading_message")}</p>
        </div>
      </Page>
    );
  }

  if (error) {
    console.error(error);
    return (
      <Page>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="rounded-2xl border border-dashed border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-10 text-center text-red-600">
            <h3 className="text-lg font-bold">{t("dashboard.error")}</h3>
          </div>
        </div>
      </Page>
    );
  }

  const {
    // Existing data
    reservations,
    topSellingItems,
    ordersCount,
    newCustomerCount,
    repeatedCustomerCount,
    currency: currencyCode,
    // New analytics data
    todayRevenue,
    yesterdayRevenue,
    yesterdayOrders,
    yesterdayNewCustomers,
    revenueTrend,
    salesByHour,
    ordersByType,
    paymentMix,
    lowStockAlerts,
    recentFeedback,
    cancelledOrders,
  } = data;

  const currency = CURRENCIES.find((c) => c.cc === currencyCode);
  const sym = currency?.symbol || "";

  // Calculate deltas
  const revenueDelta = calcDelta(
    Number(todayRevenue?.total_revenue || 0),
    Number(yesterdayRevenue?.total_revenue || 0)
  );
  const ordersDelta = calcDelta(
    Number(ordersCount || 0),
    Number(yesterdayOrders || 0)
  );
  const aovDelta = calcDelta(
    Number(todayRevenue?.average_order_value || 0),
    Number(yesterdayRevenue?.average_order_value || 0)
  );
  const customersDelta = calcDelta(
    Number(newCustomerCount || 0),
    Number(yesterdayNewCustomers || 0)
  );

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const todayStr = new Intl.DateTimeFormat("en", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <Page>
      <div className="px-1 pb-10">
        {/* ─── Header ────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              {greeting} 👋
            </h1>
            <p className="mt-1 text-sm text-restro-text">{todayStr}</p>
          </div>
          <Link
            to="/dashboard/reports"
            className="inline-flex items-center gap-1.5 rounded-xl bg-restro-green px-4 py-2.5 text-sm font-bold text-white transition hover:bg-restro-green/90 active:scale-95 shrink-0"
          >
            View Reports <IconChevronRight size={16} stroke={iconStroke} />
          </Link>
        </div>

        {/* ─── KPI Cards ────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <KPICard
            label="Today's Revenue"
            value={todayRevenue?.total_revenue || 0}
            delta={revenueDelta}
            icon={IconReceipt2}
            iconColor="#70B56A"
            isMoney
            currencySymbol={sym}
          />
          <KPICard
            label="Orders"
            value={ordersCount || 0}
            delta={ordersDelta}
            icon={IconShoppingCart}
            iconColor="#4ECDC4"
            currencySymbol={sym}
          />
          <KPICard
            label="Avg Order Value"
            value={todayRevenue?.average_order_value || 0}
            delta={aovDelta}
            icon={IconTicket}
            iconColor="#A78BFA"
            isMoney
            currencySymbol={sym}
          />
          <KPICard
            label="New Customers"
            value={newCustomerCount || 0}
            delta={customersDelta}
            icon={IconUserPlus}
            iconColor="#F97316"
            currencySymbol={sym}
          />
        </div>

        {/* ─── Revenue Trend (Full Width) ────────────────── */}
        <div className="mb-6">
          <RevenueTrendChart data={revenueTrend} currencySymbol={sym} />
        </div>

        {/* ─── Row 2: Top Items + Order Type Donut ───────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <TopItemsList items={topSellingItems} currencySymbol={sym} />
          <DonutWidget
            title="Order Type Breakdown"
            data={ordersByType}
            labelKey="order_type"
            valueKey="count"
            isMoney={false}
            currencySymbol={sym}
          />
        </div>

        {/* ─── Row 3: Payment Mix + Peak Hours ───────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <DonutWidget
            title="Payment Mix"
            data={paymentMix}
            labelKey="payment_type"
            valueKey="total"
            isMoney
            currencySymbol={sym}
          />
          <PeakHoursChart data={salesByHour} currencySymbol={sym} />
        </div>

        {/* ─── Row 4: Low Stock + Feedback + Reservations ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
          <LowStockAlerts items={lowStockAlerts} />
          <FeedbackWidget feedbacks={recentFeedback} />
          <ReservationWidget reservations={reservations} />
        </div>

        {/* ─── Quick Stats Footer ────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-restro-border-green bg-background p-4 text-center">
            <p className="text-2xl font-extrabold text-foreground">{repeatedCustomerCount || 0}</p>
            <p className="text-xs font-semibold text-restro-text mt-1">Repeat Customers</p>
          </div>
          <div className="rounded-xl border border-restro-border-green bg-background p-4 text-center">
            <p className="text-2xl font-extrabold text-foreground">{cancelledOrders || 0}</p>
            <p className="text-xs font-semibold text-restro-text mt-1">Cancelled Orders</p>
          </div>
          <div className="rounded-xl border border-restro-border-green bg-background p-4 text-center">
            <p className="text-2xl font-extrabold text-foreground">
              {sym}{Number(todayRevenue?.tax_total || 0).toFixed(0)}
            </p>
            <p className="text-xs font-semibold text-restro-text mt-1">Tax Collected</p>
          </div>
          <div className="rounded-xl border border-restro-border-green bg-background p-4 text-center">
            <p className="text-2xl font-extrabold text-foreground">
              {sym}{Number(todayRevenue?.service_charge_total || 0).toFixed(0)}
            </p>
            <p className="text-xs font-semibold text-restro-text mt-1">Service Charge</p>
          </div>
        </div>
      </div>
    </Page>
  );
}
