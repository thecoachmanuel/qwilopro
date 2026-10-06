'use client';
import React, { useEffect, useState, lazy, Suspense } from "react";
import "./i18n";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import PrivateRoute from "./helpers/PrivateRoute";
import LoginPage from "./views/LoginPage";
import DashboardLayout from "./views/DashboardLayout";
import DashboardPage from "./views/DashboardPage";
import POSPage from "./views/POSPage";

// Code-split heavy routes for rapid initial app load speed
const OrdersPage = lazy(() => import("./views/OrdersPage"));
const KitchenPage = lazy(() => import("./views/KitchenPage"));
const ReservationPage = lazy(() => import("./views/ReservationPage"));
const CustomersPage = lazy(() => import("./views/CustomersPage"));
const InvoicesPage = lazy(() => import("./views/InvoicesPage"));
const UsersPage = lazy(() => import("./views/UsersPage"));
const ReportsPage = lazy(() => import("./views/ReportsPage"));
const SettingsPage = lazy(() => import("./views/SettingsPage"));
const SettingDetailsPage = lazy(() => import("./views/SettingsViews/SettingDetailsPage"));
const PrintSettingsPage = lazy(() => import("./views/SettingsViews/PrintSettingsPage"));
const TablesSettingsPage = lazy(() => import("./views/SettingsViews/TableSettingsPage"));
const MenuItemsSettingsPage = lazy(() => import("./views/SettingsViews/MenuItemsSettingsPage"));
const TaxSetupPage = lazy(() => import("./views/SettingsViews/TaxSetupPage"));
const PaymentTypesPage = lazy(() => import("./views/SettingsViews/PaymentTypesPage"));
const DevicesPage = lazy(() => import("./views/SettingsViews/DevicesPage"));
const ContactSupport = lazy(() => import("./views/SettingsViews/ContactSupportPage"));
const CategoriesPage = lazy(() => import("./views/SettingsViews/CategoriesPage"));
const MenuItemViewPage = lazy(() => import("./views/SettingsViews/MenuItemViewPage"));
const PrintReceiptPage = lazy(() => import("./views/PrintReceiptPage"));
const PrintTokenPage = lazy(() => import("./views/PrintTokenPage"));
const TokenDisplayPage = lazy(() => import("./views/TokenDisplayPage"));
const CustomerDisplayPage = lazy(() => import("./views/CustomerDisplayPage"));
const NoAccessPage = lazy(() => import("./views/NoAccessPage"));
const ProfilePage = lazy(() => import("./views/ProfilePage"));
const RegistrationPage = lazy(() => import("./views/RegistrationPage"));
const ForgotPasswordPage = lazy(() => import("./views/ForgotPasswordPage"));
const InActiveSubscriptionPage = lazy(() => import("./views/InActiveSubscriptionPage"));
const PaymentSuccessPage = lazy(() => import("./views/PaymentSuccessPage"));
const PaymentCancelledPage = lazy(() => import("./views/PaymentCancelledPage"));
const ResetPasswordPage = lazy(() => import("./views/ResetPasswordPage"));
const QRMenuPage = lazy(() => import("./views/QRMenuPage"));
const CartPage = lazy(() => import("./views/CartPage"));
const OrderSuccessPage = lazy(() => import("./views/OrderSuccessPage"));
const OrderFailedPage = lazy(() => import("./views/OrderFailedPage"));
const CustomersImportPage = lazy(() => import("./views/CustomersImportPage"));
const FeedbackCollectPage = lazy(() => import("./views/FeedbackCollectPage"));
const FeedbackCollectSuccessPage = lazy(() => import("./views/FeedbackCollectSuccessPage"));
const FeedbackPage = lazy(() => import("./views/FeedbackPage"));
const LanguagePage = lazy(() => import("./views/LanguagePage"));
const InventoryPage = lazy(() => import("./views/InventoryPage"));
const InventoryLogsPage = lazy(() => import("./views/InventoryLogsPage"));
const InventoryDashboardPage = lazy(() => import("./views/InventoryDashboard"));
const RefreshPage = lazy(() => import("./views/RefreshPage"));

// SuperAdmin Views
const SuperAdminLoginPage = lazy(() => import("./views/SuperAdmin/LoginPage"));
const SuperAdminDashboadLayout = lazy(() => import("./views/SuperAdmin/SuperAdminDashboadLayout"));
const SuperAdminDashboardPage = lazy(() => import("./views/SuperAdmin/SuperAdminDashboardPage"));
const SuperAdminContactSupportPage = lazy(() => import("./views/SuperAdmin/SuperAdminContactSupportPage"));
const SuperAdminTenantsPage = lazy(() => import("./views/SuperAdmin/SuperAdminTenantsPage"));
const SuperAdminReportsPage = lazy(() => import("./views/SuperAdmin/SuperAdminReportsPage"));
const SuperAdminTenantSubscriptionHistoryPage = lazy(() => import("./views/SuperAdmin/SuperAdminTenantSubscriptionHistoryPage"));
const SuperAdminPlansPage = lazy(() => import("./views/SuperAdmin/SuperAdminPlansPage"));
const SuperAdminPlanDetails = lazy(() => import("./views/SuperAdmin/SuperAdminPlanDetails"));
const SuperAdminPaymentGatewaysPage = lazy(() => import("./views/SuperAdmin/SuperAdminPaymentGatewaysPage"));
const SuperAdminWhatsAppPage = lazy(() => import("./views/SuperAdmin/SuperAdminWhatsAppPage"));


import { NavbarContext } from "./contexts/NavbarContext";
import { getIsNavbarCollapsed } from "./helpers/NavbarSettings";
import { SCOPES } from "./config/scopes";
import ScopeProtectedRoute from "./helpers/ScopeProtectedRoute";
import { SocketProvider } from "./contexts/SocketContext";
import SuperAdminProtectedRoute from "./helpers/SuperAdminProtectedRoute";
import { ThemeProvider } from "./contexts/ThemeContext";
import MyToaster from "./components/MyToaster";

export default function App() {
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useState(
    getIsNavbarCollapsed()
  );

  return (
    <SocketProvider>
    <ThemeProvider>
    <NavbarContext.Provider value={[isNavbarCollapsed, setIsNavbarCollapsed]}>
      <BrowserRouter>
        <Suspense fallback={
          <div className="w-full min-h-[60vh] flex items-center justify-center bg-transparent">
            <div className="w-8 h-8 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
          </div>
        }>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegistrationPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/print-receipt" element={<PrintReceiptPage />} />
          <Route path="/print-token" element={<PrintTokenPage />} />
          <Route path="/display/token" element={<TokenDisplayPage />} />
          <Route path="/display/customer" element={<CustomerDisplayPage />} />
          <Route path="/no-access" element={<NoAccessPage />} />
          <Route path="/success" element={<PaymentSuccessPage />} />
          <Route path="/cancelled-payment" element={<PaymentCancelledPage />} />
          <Route path="/refresh" element={<RefreshPage/>} />

          <Route path="/dashboard/inactive-subscription" element={<InActiveSubscriptionPage />} />

          <Route path="/m/:qrcode" element={<QRMenuPage />} />
          <Route path="/m/:qrcode/cart" element={<CartPage />} />
          <Route path="/m/order-success" element={<OrderSuccessPage />} />
          <Route path="/m/order-failed" element={<OrderFailedPage />} />

          <Route path="/m/:qrcode/feedback" element={<FeedbackCollectPage />} />
          <Route path="/m/:qrcode/feedback/success" element={<FeedbackCollectSuccessPage />} />


          {/* app routes */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <DashboardLayout />
              </PrivateRoute>
            }
          >
            <Route
              path=""
              element={
                <ScopeProtectedRoute scopes={[SCOPES.DASHBOARD]}>
                  <DashboardPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="home"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.DASHBOARD]}>
                  <DashboardPage />
                </ScopeProtectedRoute>
              }
            />
            <Route path="profile" element={<ProfilePage />} />

            <Route
              path="pos"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.POS]}>
                  <POSPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="orders"
              element={
                <ScopeProtectedRoute
                  scopes={[
                    SCOPES.POS,
                    SCOPES.ORDERS,
                    SCOPES.ORDER_STATUS,
                    SCOPES.ORDER_STATUS_DISPLAY,
                  ]}
                >
                  <OrdersPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="kitchen"
              element={
                <ScopeProtectedRoute
                  scopes={[SCOPES.KITCHEN, SCOPES.KITCHEN_DISPLAY]}
                >
                  <KitchenPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="reservation"
              element={
                <ScopeProtectedRoute
                  scopes={[
                    SCOPES.RESERVATIONS,
                    SCOPES.VIEW_RESERVATIONS,
                    SCOPES.MANAGE_RESERVATIONS,
                  ]}
                >
                  <ReservationPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="customers"
              element={
                <ScopeProtectedRoute
                  scopes={[
                    SCOPES.CUSTOMERS,
                    SCOPES.VIEW_CUSTOMERS,
                    SCOPES.MANAGE_CUSTOMERS,
                  ]}
                >
                  <CustomersPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="customers/import"
              element={
                <ScopeProtectedRoute
                  scopes={[
                    SCOPES.CUSTOMERS,
                    SCOPES.VIEW_CUSTOMERS,
                    SCOPES.MANAGE_CUSTOMERS,
                  ]}
                >
                  <CustomersImportPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="invoices"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.INVOICES]}>
                  <InvoicesPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="inventory"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.INVENTORY]}>
                  <InventoryPage/>
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="inventory/dashboard"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.INVENTORY]}>
                  <InventoryDashboardPage/>
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="inventory/stock-movements"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.INVENTORY]}>
                  <InventoryLogsPage />
                </ScopeProtectedRoute>
              }
            />
            <Route path="users" element={<ScopeProtectedRoute scopes={[SCOPES.USER]}><UsersPage /></ScopeProtectedRoute>} />
            <Route
              path="reports"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.REPORTS]}>
                  <ReportsPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="reports/:reportId"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.REPORTS]}>
                  <ReportsPage />
                </ScopeProtectedRoute>
              }
            />

            <Route
              path="feedbacks"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.FEEDBACK]}>
                  <FeedbackPage />
                </ScopeProtectedRoute>
              }
            />

            <Route path="devices" element={<DevicesPage />} />
            <Route path="contact-support" element={<ContactSupport />} />
            <Route path="language" element={<LanguagePage />} />

            <Route
              path="settings"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.SETTINGS]}>
                  <SettingsPage />
                </ScopeProtectedRoute>
              }
            >
              <Route path="" element={<SettingDetailsPage />} />
              <Route path="details" element={<SettingDetailsPage />} />
              <Route path="print-settings" element={<PrintSettingsPage />} />
              <Route path="tables" element={<TablesSettingsPage />} />
              <Route path="menu-items" element={<MenuItemsSettingsPage />} />
              <Route path="menu-items/:id" element={<MenuItemViewPage />} />
              <Route
                path="menu-items/categories"
                element={<CategoriesPage />}
              />
              <Route path="tax-setup" element={<TaxSetupPage />} />
              <Route path="payment-types" element={<PaymentTypesPage />} />
            </Route>
          </Route>
          {/* app routes */}


          {/* admin / superadmin routes */}
          <Route path="/admin" element={<SuperAdminLoginPage />} />
          <Route path="/admin/login" element={<SuperAdminLoginPage />} />
          <Route path="/admin/dashboard" element={<PrivateRoute><SuperAdminDashboadLayout/></PrivateRoute>}>
            <Route path="" element={<SuperAdminProtectedRoute><SuperAdminDashboardPage /></SuperAdminProtectedRoute>} />
            <Route path="home" element={<SuperAdminProtectedRoute><SuperAdminDashboardPage /></SuperAdminProtectedRoute>} />
            <Route path="whatsapp" element={<SuperAdminProtectedRoute><SuperAdminWhatsAppPage /></SuperAdminProtectedRoute>} />
            <Route path="plans" element={<SuperAdminProtectedRoute><SuperAdminPlansPage /></SuperAdminProtectedRoute>} />
            <Route path="payment-gateways" element={<SuperAdminProtectedRoute><SuperAdminPaymentGatewaysPage /></SuperAdminProtectedRoute>} />
            <Route path="tenants" element={<SuperAdminProtectedRoute><SuperAdminTenantsPage /></SuperAdminProtectedRoute>} />
            <Route path="tenants/:id/subscription-history" element={<SuperAdminProtectedRoute><SuperAdminTenantSubscriptionHistoryPage /></SuperAdminProtectedRoute>} />
            <Route path="plans/:id" element={<SuperAdminProtectedRoute><SuperAdminPlanDetails /></SuperAdminProtectedRoute>} />
            <Route path="reports" element={<SuperAdminProtectedRoute><SuperAdminReportsPage /></SuperAdminProtectedRoute>} />
            <Route path="contact-support" element={<SuperAdminProtectedRoute><SuperAdminContactSupportPage /></SuperAdminProtectedRoute>} />
            <Route path="language" element={<LanguagePage />} />
          </Route>

          {/* superadmin backward-compatibility aliases */}
          <Route path="/superadmin" element={<SuperAdminLoginPage />} />
          <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
          <Route path="/superadmin/dashboard" element={<PrivateRoute><SuperAdminDashboadLayout/></PrivateRoute>}>
            <Route path="" element={<SuperAdminProtectedRoute><SuperAdminDashboardPage /></SuperAdminProtectedRoute>} />
            <Route path="home" element={<SuperAdminProtectedRoute><SuperAdminDashboardPage /></SuperAdminProtectedRoute>} />
            <Route path="whatsapp" element={<SuperAdminProtectedRoute><SuperAdminWhatsAppPage /></SuperAdminProtectedRoute>} />
            <Route path="plans" element={<SuperAdminProtectedRoute><SuperAdminPlansPage /></SuperAdminProtectedRoute>} />
            <Route path="payment-gateways" element={<SuperAdminProtectedRoute><SuperAdminPaymentGatewaysPage /></SuperAdminProtectedRoute>} />
            <Route path="tenants" element={<SuperAdminProtectedRoute><SuperAdminTenantsPage /></SuperAdminProtectedRoute>} />
            <Route path="tenants/:id/subscription-history" element={<SuperAdminProtectedRoute><SuperAdminTenantSubscriptionHistoryPage /></SuperAdminProtectedRoute>} />
            <Route path="plans/:id" element={<SuperAdminProtectedRoute><SuperAdminPlanDetails /></SuperAdminProtectedRoute>} />
            <Route path="reports" element={<SuperAdminProtectedRoute><SuperAdminReportsPage /></SuperAdminProtectedRoute>} />
            <Route path="contact-support" element={<SuperAdminProtectedRoute><SuperAdminContactSupportPage /></SuperAdminProtectedRoute>} />
            <Route path="language" element={<LanguagePage />} />
          </Route>

          {/* admin / superadmin routes */}

          {/* storefront slug routes (e.g. /the-restaurant-slug) */}
          <Route path="/order-success" element={<OrderSuccessPage />} />
          <Route path="/order-failed" element={<OrderFailedPage />} />
          <Route path="/:slug" element={<QRMenuPage />} />
          <Route path="/:slug/cart" element={<CartPage />} />
          <Route path="/:slug/feedback" element={<FeedbackCollectPage />} />
          <Route path="/:slug/feedback/success" element={<FeedbackCollectSuccessPage />} />

        </Routes>
        </Suspense>
        {/* <Toaster  /> */}
        <MyToaster />
      </BrowserRouter>
    </NavbarContext.Provider>
    </ThemeProvider>
    </SocketProvider>
  );
}
