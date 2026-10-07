import React, { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Page from "../components/Page";
import {
  cancelKitchenOrder,
  completeKitchenOrder,
  getCompleteOrderPaymentSummary,
  getInvoiceIdFromOrderId,
  getOrders,
  getOrdersInit,
  payAndCompleteKitchenOrder,
  updateKitchenOrderItemStatus,
  getOrderDetail,
} from "../controllers/orders.controller";
import { toast } from "react-hot-toast";
import {
  IconArmchair,
  IconBoxSeam,
  IconCash,
  IconCheck,
  IconChecks,
  IconClock,
  IconDotsVertical,
  IconExternalLink,
  IconReceipt,
  IconRefresh,
  IconSpeakerphone,
  IconStars,
  IconX,
  IconTruck,
  IconSearch,
  IconFilter,
  IconEye,
  IconMapPin,
  IconUser,
  IconPhone,
  IconCalendarTime,
} from "@tabler/icons-react";
import { FRONTEND_DOMAIN, VITE_BACKEND_SOCKET_IO, iconStroke } from "../config/config";
import { CURRENCIES } from "../config/currencies.config";
import { PAYMENT_ICONS } from "../config/payment_icons";
import { setDetailsForReceiptPrint } from "../helpers/ReceiptHelper";

import { SocketContext } from "../contexts/SocketContext";
import { initSocket } from "../utils/socket";
import { textToSpeech } from "../utils/textToSpeech";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import QRCode from "qrcode"
import { getQRMenuLink } from "../helpers/QRMenuHelper";
import { useTheme } from "../contexts/ThemeContext";
import clsx from "clsx";
import {
  getOrdersSnapshot,
  saveOrdersSnapshot,
  getOfflineOrdersQueue,
  isAppOnline,
} from "../utils/offlineStorage";
import { IconWifiOff } from "@tabler/icons-react";

export default function OrdersPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const printReceiptRef = useRef();
  const user = getUserDetailsInLocalStorage();
  const { socket, isSocketConnected } = useContext(SocketContext);

  const [state, setState] = useState({
    kitchenOrders: [],
    printSettings: null,
    storeSettings: null,
    paymentTypes: [],
    isLoading: true,

    cancelOrderIds: [],
    completeOrderIds: [],
    completeTokenIds: "",

    currency: null,

    summaryNetTotal: 0,
    summaryTaxTotal: 0,
    summaryServiceChargeTotal:0,
    summaryTotal: 0,
    summaryOrders: [],
    order: null,

    selectedPaymentType: null,

    feedbackInvoiceId: null,
    feedbackCustomerId: null,
    feedbackQRCode: null,
  });

  const [activeTab, setActiveTab] = useState("all"); // "all" | "new" | "ongoing" | "completed"
  const [searchQuery, setSearchQuery] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("all"); // "all" | "dinein" | "takeaway" | "delivery"
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);
  const [isLoadingOrderDetail, setIsLoadingOrderDetail] = useState(false);

  const formatOrderTime = (dateStr) => {
    if (!dateStr) return { formatted: "", timeOnly: "", relative: "" };
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { formatted: "", timeOnly: "", relative: "" };
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

      let relative = "just now";
      if (diffSec >= 86400) {
        const days = Math.floor(diffSec / 86400);
        relative = `${days}d ago`;
      } else if (diffSec >= 3600) {
        const hrs = Math.floor(diffSec / 3600);
        relative = `${hrs}h ago`;
      } else if (diffSec >= 60) {
        const mins = Math.floor(diffSec / 60);
        relative = `${mins}m ago`;
      }

      const timeStr = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "numeric", hour12: true }).format(d);
      const dateStrFormatted = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "numeric" }).format(d);
      return { formatted: dateStrFormatted, timeOnly: timeStr, relative };
    } catch {
      return { formatted: "", timeOnly: "", relative: "" };
    }
  };

  const btnShowOrderDetail = async (orderId, fallbackOrder = null) => {
    setSelectedOrderDetail(fallbackOrder || null);
    document.getElementById("modal-order-detail")?.showModal();
    if (!orderId) return;

    try {
      setIsLoadingOrderDetail(true);
      const res = await getOrderDetail(orderId);
      if (res?.data?.success && res.data.order) {
        setSelectedOrderDetail(res.data.order);
      } else if (res?.data?.order) {
        setSelectedOrderDetail(res.data.order);
      } else if (res?.data?.id) {
        setSelectedOrderDetail(res.data);
      }
    } catch (err) {
      console.warn("Could not fetch detailed order from server:", err);
    } finally {
      setIsLoadingOrderDetail(false);
    }
  };

  useEffect(() => {
    _init();
    _initSocket();

    const handleQueueChange = () => {
      _init();
    };
    window.addEventListener("restro_offline_orders_changed", handleQueueChange);
    window.addEventListener("restro_offline_orders_synced", handleQueueChange);
    window.addEventListener("online", handleQueueChange);
    window.addEventListener("offline", handleQueueChange);

    return () => {
      // socket.disconnect()
      socket?.off?.('new_order');
      socket?.off?.('order_update');
      window.removeEventListener("restro_offline_orders_changed", handleQueueChange);
      window.removeEventListener("restro_offline_orders_synced", handleQueueChange);
      window.removeEventListener("online", handleQueueChange);
      window.removeEventListener("offline", handleQueueChange);
    };
  }, []);

  const {
    kitchenOrders,
    printSettings,
    storeSettings,
    paymentTypes,
    isLoading,
    currency,
  } = state;

  const classifyOrderGroup = (orderGroup) => {
    const orders = orderGroup?.orders || [];
    if (orders.length > 0 && orders.every((o) => o?.status === "completed")) {
      return "completed";
    }

    const allItems = orders.flatMap((o) => o?.items || []);
    if (allItems.length === 0) {
      return "new";
    }

    const allFinished = allItems.every((i) =>
      ["completed", "delivered", "cancelled"].includes(i?.status)
    );
    if (allFinished) {
      return "completed";
    }

    const anyPreparing = allItems.some((i) => i?.status === "preparing");
    const anyFinished = allItems.some((i) =>
      ["completed", "delivered"].includes(i?.status)
    );

    if (anyPreparing || anyFinished) {
      return "ongoing";
    }

    return "new";
  };

  const tabCounts = {
    all: kitchenOrders?.length || 0,
    new: (kitchenOrders || []).filter((og) => classifyOrderGroup(og) === "new").length,
    ongoing: (kitchenOrders || []).filter((og) => classifyOrderGroup(og) === "ongoing").length,
    completed: (kitchenOrders || []).filter((og) => classifyOrderGroup(og) === "completed").length,
  };

  const filteredOrders = (kitchenOrders || []).filter((orderGroup) => {
    if (activeTab !== "all") {
      if (classifyOrderGroup(orderGroup) !== activeTab) {
        return false;
      }
    }

    if (deliveryFilter !== "all") {
      const deliveryType = orderGroup?.orders?.[0]?.delivery_type;
      if (deliveryType !== deliveryFilter) {
        return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const tokens = (orderGroup?.orders || [])
        .map((o) => String(o?.token_no || ""))
        .join(" ");
      const customerName = (orderGroup?.orders || [])
        .map((o) => o?.customer_name || "")
        .join(" ")
        .toLowerCase();
      const customerPhone = (orderGroup?.orders || [])
        .map((o) => String(o?.customer_id || ""))
        .join(" ");
      const tableTitle = (orderGroup?.table_title || "").toLowerCase();
      const floor = (orderGroup?.floor || "").toLowerCase();
      const itemTitles = (orderGroup?.orders || [])
        .flatMap((o) => o?.items || [])
        .map((i) => (i?.item_title || i?.title || "").toLowerCase())
        .join(" ");

      const matches =
        tokens.includes(q) ||
        customerName.includes(q) ||
        customerPhone.includes(q) ||
        tableTitle.includes(q) ||
        floor.includes(q) ||
        itemTitles.includes(q);

      if (!matches) {
        return false;
      }
    }

    return true;
  });

  const formatOfflineOrdersGroup = (offlineQueue) => {
    if (!offlineQueue || offlineQueue.length === 0) return [];
    return [{
      table_id: null,
      table_title: "Offline Orders (Pending Sync)",
      floor: "Saved Locally on Device",
      is_offline_group: true,
      order_ids: offlineQueue.map((o) => o.localOrderId),
      orders: offlineQueue.map((o) => ({
        id: o.localOrderId,
        token_no: o.tokenNo,
        payment_status: o.type === "order_and_invoice" ? "paid" : "unpaid",
        delivery_type: o.deliveryType,
        customer_name: o.customerId?.name || "Walk-in",
        created_at: o.createdAt,
        total: o.payableTotal,
        is_offline: true,
        items: (o.cart || []).map((item) => ({
          id: item.id,
          title: item.title,
          quantity: item.quantity,
          status: "pending",
          variant_title: item.variant?.title,
          notes: item.notes,
        })),
      })),
    }];
  };

  const _init = async () => {
    const offlineQueue = getOfflineOrdersQueue();
    const offlineGroups = formatOfflineOrdersGroup(offlineQueue);

    if (!isAppOnline()) {
      const cached = getOrdersSnapshot();
      const currency = CURRENCIES.find(
        (c) => c.cc == cached?.ordersInit?.storeSettings?.currency
      );

      setState((prev) => ({
        ...prev,
        kitchenOrders: [...offlineGroups, ...(cached?.orders || [])],
        printSettings: cached?.ordersInit?.printSettings || {},
        storeSettings: cached?.ordersInit?.storeSettings || {},
        paymentTypes: Array.isArray(cached?.ordersInit?.paymentTypes) ? cached.ordersInit.paymentTypes : [],
        currency: currency?.symbol || "₦",
        isLoading: false,
      }));
      return;
    }

    try {
      const [ordersResponse, ordersInitResponse] = await Promise.all([
        getOrders(),
        getOrdersInit(),
      ]);

      if (ordersResponse.status == 200 && ordersInitResponse.status == 200) {
        const orders = ordersResponse?.data || [];
        const ordersInit = ordersInitResponse.data;

        saveOrdersSnapshot(orders, ordersInit);

        const currency = CURRENCIES.find(
          (c) => c.cc == ordersInit?.storeSettings?.currency
        );

        setState((prev) => ({
          ...prev,
          kitchenOrders: [...offlineGroups, ...orders],
          printSettings: ordersInit.printSettings || {},
          storeSettings: ordersInit.storeSettings || {},
          paymentTypes: Array.isArray(ordersInit.paymentTypes) ? ordersInit.paymentTypes : [],
          currency: currency?.symbol || "₦",
          isLoading: false,
        }));
      }
    } catch (error) {
      console.warn("Online orders load failed, checking offline cache:", error);
      const cached = getOrdersSnapshot();
      const currency = CURRENCIES.find(
        (c) => c.cc == cached?.ordersInit?.storeSettings?.currency
      );

      setState((prev) => ({
        ...prev,
        kitchenOrders: [...offlineGroups, ...(cached?.orders || [])],
        printSettings: cached?.ordersInit?.printSettings || {},
        storeSettings: cached?.ordersInit?.storeSettings || {},
        paymentTypes: Array.isArray(cached?.ordersInit?.paymentTypes) ? cached.ordersInit.paymentTypes : [],
        currency: currency?.symbol || "₦",
        isLoading: false,
      }));
    }
  };

  const refreshOrders = async () => {
    const offlineQueue = getOfflineOrdersQueue();
    const offlineGroups = formatOfflineOrdersGroup(offlineQueue);

    if (!isAppOnline()) {
      const cached = getOrdersSnapshot();
      setState((prev) => ({
        ...prev,
        kitchenOrders: [...offlineGroups, ...(cached?.orders || [])],
        isLoading: false,
      }));
      toast("Refreshed from offline storage.", { icon: "📡" });
      return;
    }

    try {
      toast.loading(t('orders.loading_message'));
      const res = await getOrders();
      toast.dismiss();
      if (res.status == 200) {
        toast.success(t('orders.orders_loaded'));
        setState((prev) => ({
          ...prev,
          kitchenOrders: [...offlineGroups, ...res.data],
          isLoading: false,
        }));
      }
    } catch (error) {
      toast.dismiss();
      const cached = getOrdersSnapshot();
      setState((prev) => ({
        ...prev,
        kitchenOrders: [...offlineGroups, ...(cached?.orders || [])],
        isLoading: false,
      }));
      toast("Loaded orders from offline cache.", { icon: "📡" });
    }
  };

  const _initSocket = () => {
    const tenantId = user?.tenant_id;
    if (!tenantId || !socket) return;

    const playNewOrderAudio = () => {
      try {
        const audio = new Audio("/new_order_sound.mp3");
        audio.play().catch(() => {});
      } catch {}
    };

    socket.emit("authenticate", tenantId);
    socket.on("new_order", (payload) => {
      playNewOrderAudio();
      const token = payload?.tokenNo || payload?.token_no;
      if (token) {
        try {
          textToSpeech(`New order received! Token number ${token}`);
        } catch {}
      }
      refreshOrders();
    });

    socket.on("order_update", () => {
      refreshOrders();
    });
  };

  const btnCallToken = (tokenNo) => {
    const tenantId = user?.tenant_id;
    if (!tenantId || !tokenNo) return;
    socket?.emit?.("token_call_backend", { tokenNo }, tenantId);
    try {
      textToSpeech(`Token number ${tokenNo}, please collect your order.`);
    } catch {}
    toast.success(`Calling Token #${tokenNo}...`);
  };

  const sendOrderUpdateEvent = () => {
    const u = getUserDetailsInLocalStorage();
    const tenantId = u?.tenant_id;
    if (!tenantId) return;
    socket?.emit?.("order_update_backend", {}, tenantId);
  };

  if (state.isLoading) {
    return <Page>{t('orders.loading_message')}</Page>;
  }

  const btnChangeOrderItemStatus = async (orderItemId, status) => {
    try {
      toast.loading(t('orders.loading_message'));
      const res = await updateKitchenOrderItemStatus(orderItemId, status);
      toast.dismiss();
      if (res.status == 200) {
        sendOrderUpdateEvent();
        await refreshOrders();
        toast.success(res.data.message);
        document.getElementById("modal-order-item-status-update").showModal();
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Error processing your request, Please try later!";
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };

  const btnShowCancelOrderModal = (orderIds) => {
    setState({
      ...state,
      cancelOrderIds: orderIds,
    });
    document.getElementById("modal-order-cancel").showModal();
  };
  const btnCancelOrder = async () => {
    try {
      toast.loading(t('orders.loading_message'));
      const res = await cancelKitchenOrder(state.cancelOrderIds);
      toast.dismiss();
      if (res.status == 200) {
        sendOrderUpdateEvent();
        await refreshOrders();
        toast.success(res.data.message);
        document.getElementById("modal-order-cancel").close();
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Error processing your request, Please try later!";
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };

  const btnShowCompleteOrderModal = (orderIds) => {
    setState({
      ...state,
      completeOrderIds: orderIds,
    });
    document.getElementById("modal-order-complete").showModal();
  };
  const btnCompleteOrder = async () => {
    try {
      toast.loading(t('orders.loading_message'));
      const res = await completeKitchenOrder(state.completeOrderIds);
      toast.dismiss();
      if (res.status == 200) {
        sendOrderUpdateEvent();
        await refreshOrders();
        toast.success(res.data.message);
        document.getElementById("modal-order-complete").close();
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Error processing your request, Please try later!";
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };

  const btnShowPayAndComplete = async (orderIds, order) => {
    try {
      toast.loading(t('orders.loading_message'));
      const res = await getCompleteOrderPaymentSummary(orderIds);
      toast.dismiss();

      if (res.status == 200) {
        const { subtotal, taxTotal, serviceChargeTotal, total, orders } = res.data;

        const tokenNoArray = orders.map(o=>o.token_no);
        const tokens = tokenNoArray.join(",");

        const defaultPaymentType = state.selectedPaymentType || (paymentTypes?.length > 0 ? paymentTypes[0]?.id : 1);

        setState({
          ...state,
          selectedPaymentType: defaultPaymentType,
          summaryNetTotal: subtotal,
          summaryTaxTotal: taxTotal,
          summaryServiceChargeTotal:serviceChargeTotal,
          summaryTotal: total,
          summaryOrders: orders,
          completeOrderIds: orderIds,
          completeTokenIds: tokens,
          order: order,
        });

        document.getElementById("modal-order-summary-complete").showModal();
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Error processing your request, Please try later!";
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };
  const btnPayAndComplete = async () => {
    const isPrintReceipt = printReceiptRef.current.checked || false;
    const activePaymentId = state.selectedPaymentType || (paymentTypes?.length > 0 ? paymentTypes[0]?.id : 1);

    try {
      toast.loading(t('orders.loading_message'));
      const res = await payAndCompleteKitchenOrder(
        state.completeOrderIds,
        state.summaryNetTotal,
        state.summaryTaxTotal,
        state.summaryServiceChargeTotal,
        state.summaryTotal,
        activePaymentId,
      );
      toast.dismiss();
      if (res.status == 200) {
        const invoiceId = res.data?.invoiceId || null;
        const customerId = res.data?.customerId || null;

        sendOrderUpdateEvent();
        await refreshOrders();
        toast.success(res.data.message);
        document.getElementById("modal-order-summary-complete").close();

        if (isPrintReceipt) {
          const { table_id, table_title, floor } = state.order || {};

          const orders = [];
          const orderIds = state.completeOrderIds.join(", ");

          for (const o of state.summaryOrders || []) {
            const items = o.items || [];
            items.forEach((i) => {
              const variant = i.variant_id
                ? {
                    id: i.variant_id,
                    title: i.variant_title,
                    price: i.variant_price,
                  }
                : null;
              orders.push({
                ...i,
                title: i.item_title,
                addons_ids:
                  i?.addons?.length > 0 ? i?.addons?.map((a) => a.id) : [],
                variant: variant,
              });
            });
          }

          const firstOrder = state.summaryOrders?.[0] || {};
          const {
            customer_id,
            customer_type,
            customer_name,
            date,
            delivery_type,
          } = firstOrder;

          const paymentType = (paymentTypes || []).find((v)=>v.id == activePaymentId);
          let paymentMethodText = paymentType?.title || "Cash";

          setDetailsForReceiptPrint({
            cartItems: orders,
            deliveryType: delivery_type,
            customerType: customer_type,
            customer: { id: customer_id, name: customer_name },
            tableId: table_id,
            currency,
            storeSettings,
            printSettings,
            itemsTotal: state.summaryNetTotal,
            taxTotal: state.summaryTaxTotal,
            serviceChargeTotal:state.summaryServiceChargeTotal,
            payableTotal: state.summaryTotal,
            tokenNo: state.completeTokenIds,
            orderId: orderIds,
            paymentMethod: paymentMethodText
          });

          const receiptWindow = window.open(
            "/print-receipt",
            "_blank",
            "toolbar=yes,scrollbars=yes,resizable=yes,top=500,left=500,width=400,height=400"
          );
          if (receiptWindow) {
            receiptWindow.onload = (e) => {
              setTimeout(() => {
                receiptWindow.print();
              }, 400);
            };
          }
        }

        // Feedback
        if (storeSettings?.is_feedback_enabled && invoiceId) {
          try {
            const link = getQRMenuLink(storeSettings?.unique_qr_code, storeSettings?.slug) + `/feedback?_ref=${invoiceId}${customerId?`&_cref=${customerId}`:''}`;
            const qrDataURL = await QRCode.toDataURL(link, {width: 1080});
            setState((prev)=>({...prev,
              selectedPaymentType: null,
              feedbackInvoiceId: invoiceId,
              feedbackCustomerId: customerId,
              feedbackQRCode: qrDataURL
            }));
            document.getElementById("modal-collect-feedback").showModal();
          } catch (qrErr) {
            console.error("Feedback QR code generation error:", qrErr);
          }
        } else {
          setState((prev)=>({...prev, selectedPaymentType: null }));
        }
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Error processing your request, Please try later!";
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };

  const btnPrintReceipt = async (orderIdsArr, tokens) => {
    try {
      toast.loading(t('orders.loading_message'));
      const res = await getCompleteOrderPaymentSummary(orderIdsArr);
      toast.dismiss();

      if (res.status == 200) {
        const { subtotal, taxTotal, serviceChargeTotal, total, orders: ordersArr } = res.data;

        const orders = [];
        const orderIds = orderIdsArr.join(", ");

        for (const o of ordersArr) {
          const items = o.items;
          items.forEach((i) => {
            const variant = i.variant_id
              ? {
                  id: i.variant_id,
                  title: i.variant_title,
                  price: i.variant_price,
                }
              : null;
            orders.push({
              ...i,
              title: i.item_title,
              addons_ids:
                i?.addons?.length > 0 ? i?.addons?.map((a) => a.id) : [],
              variant: variant,
            });
          });
        }

        const firstOrder = (Array.isArray(ordersArr) ? ordersArr[0] : ordersArr) || {};
        const {
          customer_id,
          customer_type,
          customer_name,
          date,
          delivery_type,
        } = firstOrder;

        setDetailsForReceiptPrint({
          cartItems: orders,
          deliveryType: delivery_type,
          customerType: customer_type,
          customer: { id: customer_id, name: customer_name },
          tableId: null,
          currency,
          storeSettings,
          printSettings,
          itemsTotal: subtotal,
          taxTotal: taxTotal,
          serviceChargeTotal:serviceChargeTotal,
          payableTotal: total,
          tokenNo: tokens,
          orderId: orderIds,
        });

        const receiptWindow = window.open(
          "/print-receipt",
          "_blank",
          "toolbar=yes,scrollbars=yes,resizable=yes,top=500,left=500,width=400,height=400"
        );
        receiptWindow.onload = (e) => {
          setTimeout(() => {
            receiptWindow.print();
          }, 400);
        };
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Error processing your request, Please try later!";
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };

  const btnCollectFeedback = async (orderIdsArr) => {
    try {
      toast.loading(t('orders.loading_message'));
      const res = await getInvoiceIdFromOrderId(orderIdsArr);
      toast.dismiss();

      if (res.status == 200) {
        const { invoiceId, customerId } = res.data;

        if(!invoiceId) {
          toast.error("Please finish the order to collect feedback!");
          return;
        }

        const link = getQRMenuLink(storeSettings?.unique_qr_code, storeSettings?.slug) + `/feedback?_ref=${invoiceId}${customerId?`&_cref=${customerId}`:''}`;

        const qrDataURL = await QRCode.toDataURL(link, {width: 1080});

        setState({
          ...state,
          feedbackInvoiceId: invoiceId,
          feedbackCustomerId: customerId,
          feedbackQRCode: qrDataURL
        })

        document.getElementById("modal-collect-feedback").showModal();
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Error processing your request, Please try later!";
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };

  const btnOpenFeedbackLink = () => {
    const a = document.createElement("a");
    a.href = getQRMenuLink(storeSettings?.unique_qr_code, storeSettings?.slug) + `/feedback?_ref=${state.feedbackInvoiceId}${state.feedbackCustomerId?`&_cref=${state.feedbackCustomerId}`:''}`;
    a.target = '_blank';
    a.click();
    a.remove();

    document.getElementById("modal-collect-feedback").close();
  };

  return (
    <Page>
      <div className="flex items-center gap-6">
        <h3 className="text-3xl font-light">{t('orders.title')}</h3>
        <button
          onClick={refreshOrders}
          className = "flex items-center gap-1 rounded-xl text-restro-text shadow-none transition active:scale-95 px-2 py-1 bg-restro-gray hover:bg-restro-button-hover border border-restro-border-green"
        >
          <IconRefresh size={22} stroke={iconStroke} /> {t('orders.refresh')}
        </button>
      </div>

      {/* Industry Standard Filter & Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 mb-2">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-restro-gray border border-restro-border-green overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition active:scale-95 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "all"
                ? (theme === 'black' ? 'bg-restro-green-dark-mode text-white shadow-sm' : 'bg-restro-green text-white shadow-sm')
                : 'text-restro-text hover:bg-restro-button-hover'
            }`}
          >
            All
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === "all"
                ? 'bg-white/20 text-white'
                : 'bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-gray-300'
            }`}>
              {tabCounts.all}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("new")}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition active:scale-95 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "new"
                ? (theme === 'black' ? 'bg-restro-green-dark-mode text-white shadow-sm' : 'bg-restro-green text-white shadow-sm')
                : 'text-restro-text hover:bg-restro-button-hover'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            New
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === "new"
                ? 'bg-white/20 text-white'
                : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            }`}>
              {tabCounts.new}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("ongoing")}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition active:scale-95 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "ongoing"
                ? (theme === 'black' ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-500 text-white shadow-sm')
                : 'text-restro-text hover:bg-restro-button-hover'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Ongoing
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === "ongoing"
                ? 'bg-white/20 text-white'
                : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
            }`}>
              {tabCounts.ongoing}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("completed")}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition active:scale-95 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "completed"
                ? (theme === 'black' ? 'bg-neutral-700 text-white shadow-sm' : 'bg-slate-700 text-white shadow-sm')
                : 'text-restro-text hover:bg-restro-button-hover'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Completed
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === "completed"
                ? 'bg-white/20 text-white'
                : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
            }`}>
              {tabCounts.completed}
            </span>
          </button>
        </div>

        {/* Search & Delivery Type Filter */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center px-3 py-1.5 rounded-xl bg-restro-gray border border-restro-border-green w-56 sm:w-64 gap-2">
            <IconSearch size={18} stroke={iconStroke} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search token, table, customer..."
              className="w-full bg-transparent outline-none text-sm placeholder:text-gray-400 text-restro-text"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600">
                <IconX size={16} stroke={iconStroke} />
              </button>
            )}
          </div>

          <select
            value={deliveryFilter}
            onChange={(e) => setDeliveryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-sm bg-restro-gray border border-restro-border-green outline-none text-restro-text cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="dinein">🍽️ Dine In</option>
            <option value="takeaway">🛍️ Takeaway</option>
            <option value="delivery">🚚 Delivery</option>
          </select>
        </div>
      </div>

      {kitchenOrders?.length == 0 && (
        <div className="w-full h-[calc(100vh-22vh)] flex gap-4 flex-col items-center justify-center">
          <img
            src="/assets/illustrations/orders-not-found.webp"
            alt={t('orders.no_orders_img_alt')}
            className="w-1/2 md:w-60"
          />
          <p className="text-gray-400">{t('orders.no_orders')}</p>
        </div>
      )}

      {kitchenOrders?.length > 0 && filteredOrders?.length == 0 && (
        <div className="w-full py-16 flex gap-3 flex-col items-center justify-center text-center">
          <p className="text-gray-400 text-sm">No orders matching the selected filter</p>
          <button
            onClick={() => { setActiveTab("all"); setSearchQuery(""); setDeliveryFilter("all"); }}
            className="text-xs px-3 py-1.5 rounded-xl bg-restro-green text-white font-semibold hover:bg-restro-green-button-hover transition active:scale-95"
          >
            Clear Filters
          </button>
        </div>
      )}

      {filteredOrders?.length > 0 && (
        <div className={`mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 `}>
          {filteredOrders.map((order, index) => {
            const { table_id, table_title, floor, orders = [], order_ids = [] } = order || {};

            const tokenNoArray = (orders || []).map((o) => o?.token_no).filter(Boolean);
            const tokens = tokenNoArray.join(",");

            const isPaid = (orders || []).length > 0 && orders.every((o) => o?.payment_status == 'paid');

            return (
              <div
                key={index}
                className = "flex flex-col divide-y divide-dashed divide-gray-200 dark:divide-gray-700 px-4 py-5 border rounded-2xl border-restro-border-green"
              >
                <div className="flex md:items-center flex-col md:flex-row md:justify-between md:text-center gap-2 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex w-12 h-12 rounded-2xl items-center justify-center bg-restro-gray">
                      {table_id ? (
                        <IconArmchair size={24} stroke={iconStroke} />
                      ) : orders[0]?.delivery_type === "delivery" ? (
                        <IconTruck size={24} stroke={iconStroke} className="text-emerald-500" />
                      ) : (
                        <IconReceipt size={24} stroke={iconStroke} />
                      )}
                    </div>
                    <div>
                      <p className="font-bold">
                        {table_id ? `${table_title}` : orders[0]?.delivery_type === "delivery" ? "🚚 Delivery" : "🛍️ Takeaway / Dine Out"}
                      </p>
                      {floor && <p className="text-sm">{floor}</p>}
                    </div>
                  </div>
                  <div className="dropdown dropdown-end">
                    <div
                      tabIndex={0}
                      role="button"
                      className="m-1 btn btn-sm btn-circle bg-transparent border-none shadow-none p-2 rounded-full hover:bg-restro-button-hover"
                    >
                      <IconDotsVertical size={18} stroke={iconStroke} />
                    </div>
                    <ul
                      tabIndex={0}
                      className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-lg w-52 border border-restro-border-green "
                    >
                      <li>
                        <button
                          className="flex items-center gap-2 bg-transparent border-none shadow-none text-primary"
                          onClick={() => {
                            btnShowOrderDetail(orders[0]?.id, orders[0]);
                          }}
                        >
                          <IconEye size={18} stroke={iconStroke} /> View Order Details
                        </button>
                      </li>
                      <li>
                        <button
                          className="flex items-center gap-2 bg-transparent border-none shadow-none "
                          onClick={() => {
                            btnPrintReceipt(order_ids, tokens);
                          }}
                        >
                          <IconReceipt size={18} stroke={iconStroke} /> {t('orders.print_receipt')}
                        </button>
                      </li>
                      {tokens ? (
                        <li>
                          <button
                            className="flex items-center gap-2 bg-transparent border-none shadow-none text-restro-green"
                            onClick={() => {
                              btnCallToken(tokens);
                            }}
                          >
                            <IconSpeakerphone size={18} stroke={iconStroke} /> Call Token ({tokens})
                          </button>
                        </li>
                      ) : null}
                      {storeSettings?.is_feedback_enabled ? <li>
                        <button
                          className="flex items-center gap-2 bg-transparent border-none shadow-none "
                          onClick={() => {
                            btnCollectFeedback(order_ids);
                          }}
                        >
                          <IconStars size={18} stroke={iconStroke} /> {t('orders.collect_feedback')}
                        </button>
                      </li>:<></>}
                      <li>
                        <button
                          className="flex items-center gap-2 bg-transparent border-none shadow-none text-restro-red"
                          onClick={() => {
                            btnShowCancelOrderModal(order_ids);
                          }}
                        >
                          <IconX size={18} stroke={iconStroke} /> {t('orders.cancel')}
                        </button>
                      </li>
                      <li>
                        <button
                          className="flex items-center gap-2 bg-transparent border-none shadow-none text-restro-green"
                          onClick={() => {
                            if(isPaid == false) {
                              toast.error(t('orders.payment_not_collected_error'));
                              return;
                            }
                            btnShowCompleteOrderModal(order_ids);
                          }}
                        >
                          <IconCheck size={18} stroke={iconStroke} /> {t('orders.complete')}
                        </button>
                      </li>
                      <li>
                        <button
                          className="flex items-center gap-2 bg-transparent border-none shadow-none "
                          onClick={() => {
                            if(isPaid == true) {
                              toast.error(t('orders.payment_already_collected_error'));
                              return;
                            }
                            btnShowPayAndComplete(order_ids, order);
                          }}
                        >
                          <IconCash size={18} stroke={iconStroke} /> {t('orders.pay_complete')}
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>

                {orders.map((o, i) => {
                  const {
                    id,
                    date,
                    delivery_type,
                    customer_type,
                    customer_id,
                    customer_name,
                    status,
                    payment_status,
                    token_no,
                    items,
                  } = o;

                  return (
                    <div className = "py-2 px-2 mt-2 mb-2 rounded-xl bg-gray-50 dark:bg-restro-gray" key={i}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center justify-center flex-col text-center">
                          <p>{t('orders.token')}</p>
                          <div className = "w-12 h-12 flex items-center justify-center font-bold rounded-full bg-gray-700 dark:bg-[#0a0a0a] text-white" >
                            {token_no}
                          </div>
                          {token_no && (
                            <button
                              onClick={() => btnCallToken(token_no)}
                              title="Announce token on displays and speakers"
                              className="mt-1 text-[11px] px-2 py-0.5 rounded-lg bg-restro-border-green-light text-restro-green-dark hover:bg-restro-green hover:text-white transition active:scale-95 flex items-center gap-1 font-semibold"
                            >
                              <IconSpeakerphone size={12} stroke={iconStroke} /> Call
                            </button>
                          )}
                        </div>
                        <div className="text-end">
                          <div className="flex items-center gap-1 justify-end text-xs font-semibold text-gray-700 dark:text-gray-300">
                            <IconClock size={14} stroke={iconStroke} className="text-primary" />
                            <span>
                              {(() => {
                                try {
                                  return date
                                    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "numeric", hour12: true }).format(new Date(date))
                                    : "";
                                } catch {
                                  return "";
                                }
                              })()}
                            </span>
                          </div>
                          {(() => {
                            const timeInfo = formatOrderTime(date);
                            return timeInfo.relative ? (
                              <span className="text-[10px] text-gray-400 block">{timeInfo.relative}</span>
                            ) : null;
                          })()}
                          <p className={clsx("flex gap-1.5 items-center justify-end text-xs font-semibold mt-1", {
                            "text-amber-500": payment_status == "pending",
                            "text-restro-green": payment_status == "paid",
                          })}>
                            <IconCash stroke={iconStroke} size={15} />
                            {(payment_status || "pending").toUpperCase()}
                          </p>
                        </div>
                      </div>

                      {/* Delivery badge & address preview */}
                      {delivery_type === "delivery" && (
                        <div className="mt-2 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs">
                          <div className="flex items-center justify-between font-bold text-emerald-700 dark:text-emerald-400">
                            <span className="flex items-center gap-1">
                              <IconTruck size={14} stroke={iconStroke} /> Home Delivery
                            </span>
                            {o.delivery_fee > 0 && <span className="font-normal text-[11px]">Fee: {currency}{o.delivery_fee}</span>}
                          </div>
                          {o.delivery_address && (
                            <p className="mt-1 text-gray-700 dark:text-gray-300 flex items-start gap-1 text-[11px]">
                              <IconMapPin size={13} stroke={iconStroke} className="flex-shrink-0 mt-0.5 text-emerald-600" />
                              <span className="font-medium">{o.delivery_address}</span>
                            </p>
                          )}
                          {(customer_name || customer_id) && (
                            <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5 flex items-center gap-1">
                              <IconUser size={12} stroke={iconStroke} /> {customer_name || "Customer"} {customer_id ? `(${customer_id})` : ""}
                            </p>
                          )}
                        </div>
                      )}

                      {/* order items */}
                      <div className="mt-4 flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
                        {(items || []).map((item, index) => {
                          const {
                            id: orderItemId,
                            order_id,
                            item_id,
                            item_title,
                            variant_id,
                            variant_title,
                            quantity,
                            status,
                            date,
                            addons,
                            notes,
                          } = item;

                          const addonsText =
                            addons?.length > 0
                              ? addons?.map((a) => a.title)?.join(", ")
                              : null;

                          return (
                            <div
                              key={index}
                              className="flex items-center gap-2 py-2"
                            >
                              {/* status */}
                              {status == "preparing" && (
                                <IconClock
                                  stroke={iconStroke}
                                  className="text-restro-yellow"
                                />
                              )}
                              {status == "completed" && (
                                <IconCheck
                                  stroke={iconStroke}
                                  className="text-restro-green"
                                />
                              )}
                              {status == "cancelled" && (
                                <IconX
                                  stroke={iconStroke}
                                  className="text-restro-red"
                                />
                              )}
                              {status == "delivered" && (
                                <IconChecks
                                  stroke={iconStroke}
                                  className="text-restro-green"
                                />
                              )}
                              {/* status */}

                              {/* item title */}
                              <div className="flex-1">
                                <p>
                                  {item_title} {variant_title} x {quantity}
                                </p>
                                {addonsText && (
                                  <p className="text-sm text-gray-700 dark:text-white">
                                    Addons: {addonsText}
                                  </p>
                                )}
                                {notes && (
                                  <p className="text-sm text-gray-700 dark:text-white">
                                    Notes: {notes}
                                  </p>
                                )}
                              </div>
                              {/* item title */}

                              {/* action */}
                              <div className="dropdown dropdown-left">
                                <div
                                  tabIndex={0}
                                  role="button"
                                  className="btn btn-sm btn-circle bg-transparent border-none shadow-none m-1"
                                >
                                  <IconDotsVertical
                                    size={18}
                                    stroke={iconStroke}
                                  />
                                </div>
                                <ul
                                  tabIndex={0}
                                  className="dropdown-content z-[1] menu p-2 shadow bg-base-100 w-52 rounded-lg border border-restro-border-green"
                                >
                                  <li>
                                    <button
                                      className="flex items-center gap-2 bg-transparent border-none shadow-none text-restro-yellow"
                                      onClick={() => {
                                        btnChangeOrderItemStatus(
                                          orderItemId,
                                          "preparing"
                                        );
                                      }}
                                    >
                                      <IconClock
                                        size={18}
                                        stroke={iconStroke}
                                      />{" "}
                                      {t('orders.preparing')}
                                    </button>
                                  </li>
                                  <li>
                                    <button
                                      className="flex items-center gap-2 bg-transparent border-none shadow-none text-restro-green"
                                      onClick={() => {
                                        btnChangeOrderItemStatus(
                                          orderItemId,
                                          "completed"
                                        );
                                      }}
                                    >
                                      <IconCheck
                                        size={18}
                                        stroke={iconStroke}
                                      />{" "}
                                      {t('orders.completed')}
                                    </button>
                                  </li>
                                  <li>
                                    <button
                                      className="flex items-center gap-2 bg-transparent border-none shadow-none "
                                      onClick={() => {
                                        btnChangeOrderItemStatus(
                                          orderItemId,
                                          "delivered"
                                        );
                                      }}
                                    >
                                      <IconChecks
                                        size={18}
                                        stroke={iconStroke}
                                      />{" "}
                                      {t('orders.delivered')}
                                    </button>
                                  </li>
                                  <li>
                                    <button
                                      className="flex items-center gap-2 bg-transparent border-none shadow-none text-restro-red"
                                      onClick={() => {
                                        btnChangeOrderItemStatus(
                                          orderItemId,
                                          "cancelled"
                                        );
                                      }}
                                    >
                                      <IconX size={18} stroke={iconStroke} />{" "}
                                      {t('orders.cancelled')}
                                    </button>
                                  </li>
                                </ul>
                              </div>
                              {/* action */}
                            </div>
                          );
                        })}
                      </div>
                      {/* order items */}

                      {/* view full order detail button */}
                      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <button
                          type="button"
                          onClick={() => btnShowOrderDetail(id, o)}
                          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-primary/10 transition active:scale-95"
                        >
                          <IconEye size={15} stroke={iconStroke} /> View Full Order Details
                        </button>
                        <span className="text-[11px] text-gray-400">
                          {items?.length || 0} item{items?.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* dialog: successful order item status update */}
      <dialog id="modal-order-item-status-update" className="modal">
        <div className = "modal-box border border-restro-border-green rounded-2xl">
          <h3 className="font-bold text-lg">{t('orders.success')}</h3>
          <p className="py-4">{t('orders.order_item_status_success')}</p>
          <div className="modal-action">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn transition active:scale-95 hover:shadow-lg px-4 py-3 border border-restro-border-green rounded-xl dark:hover:border-restro-gray">{t('orders.close')}</button>
            </form>
          </div>
        </div>
      </dialog>
      {/* dialog: successful order item status update */}

      {/* dialog: cancel order */}
      <dialog id="modal-order-cancel" className="modal">
        <div className="modal-box border border-restro-border-green rounded-2xl ">
          <h3 className="font-bold text-lg">{t('orders.alert')}</h3>
          <p className="py-4">
            {t('orders.cancel_order_alert')}
          </p>
          <div className="modal-action">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn transition active:scale-95 hover:shadow-lg px-4 py-3 border border-restro-border-green rounded-xl bg-restro-gray hover:bg-restro-button-hover">{t('orders.dismiss')}</button>
              <button
                onClick={() => {
                  btnCancelOrder();
                }}
                className={`ml-2 btn bg-restro-red text-white hover:bg-red-500 transition active:scale-95 px-4 py-3 rounded-xl border-restro-red hover:border-red-600`}
              >
                {t('orders.confirm')}
              </button>
            </form>
          </div>
        </div>
      </dialog>
      {/* dialog: cancel order */}

      {/* dialog: complete order */}
      <dialog id="modal-order-complete" className="modal">
        <div className="modal-box border border-restro-border-green rounded-2xl ">
          <h3 className="font-bold text-lg">{t('orders.alert')}</h3>
          <p className="py-4">
            {t('orders.complete_order_alert')}
          </p>
          <div className="modal-action">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn border-restro-gray bg-restro-gray rounded-xl hover:bg-restro-button-hover">{t('orders.dismiss')}</button>
              <button
                onClick={() => {
                  btnCompleteOrder();
                }}
                className="ml-2 btn bg-restro-green border-restro-green-light hover:bg-restro-green-button-hover rounded-xl"
              >
                {t('orders.confirm')}
              </button>
            </form>
          </div>
        </div>
      </dialog>
      {/* dialog: complete order */}

      {/* dialog: complete order & payment summary */}
      <dialog id="modal-order-summary-complete" className="modal">
        <div className="modal-box border border-restro-border-green rounded-2xl ">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">{t('orders.pay_complete_order')}</h3>
            <form method='dialog'>
              <button className="btn btn-sm btn-circle text-restro-red border-none transition active:scale-95 hover:bg-restro-gray"><IconX size={18} stroke={iconStroke} /></button>
            </form>
          </div>

          <div className="my-6">
            <div className="my-8 space-y-4 px-1">
            {[
              { label: t('orders.items_net_total'), value: state.summaryNetTotal },
              { label: t('orders.tax_total'), value: state.summaryTaxTotal, prefix: "+" },
              { label: t('orders.service_charge_total'), value: state.summaryServiceChargeTotal, prefix: "+" },
            ].map(({ label, value, prefix = "" }, index) => (
              <div key={index} className="flex items-center justify-between text-restro-text">
                <p>{label}</p>
                <p className="text-lg">
                  {prefix}{currency}{value.toFixed(2)}
                </p>
              </div>
            ))}

            <div className="flex items-center justify-between border-t border-gray-300 dark:border-restro-bg-gray pt-2 mt-2">
              <p className="text-xl font-medium">{t('orders.payable_total')}</p>
              <p className="text-xl font-bold text-restro-green">
                {currency}{state.summaryTotal.toFixed(2)}
              </p>
            </div>
          </div>

            <label
              htmlFor="print_receipt"
              className="mt-4 w-full flex justify-end items-center gap-2 "
            >
              <input
                type="checkbox"
                className="checkbox rounded-lg"
                id="print_receipt"
                ref={printReceiptRef}
              />{" "}
              {t('orders.print_receipt_option')}
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {paymentTypes.map((paymentType, i)=>{
              const uniqueId = `icon-${paymentType?.id}`;
              return <label key={i} className=''>
                <input
                checked={state?.selectedPaymentType == paymentType?.id}
                onChange={e=>{
                  setState({
                    ...state,
                    selectedPaymentType: e.target.value,
                  });
                }} type="radio" name="payment_type" id={uniqueId} value={paymentType?.id} className='peer hidden' />
                <label htmlFor={uniqueId} className='border dark:border-restro-gray rounded-2xl flex items-center justify-center gap-1 flex-col px-4 py-3 peer-checked:border-restro-green peer-checked:text-restro-green peer-checked:font-bold cursor-pointer transition'>
                  {paymentType?.icon ? <div>{PAYMENT_ICONS[paymentType?.icon]}</div>:<></>}
                  <p className='text-xs'>{paymentType.title}</p>
                </label>
              </label>
            })}
          </div>

          <div className="modal-action">
            
              {/* if there is a button in form, it will close the modal */}
              <button
                onClick={() => {
                  btnPayAndComplete();
                }}
                className="w-full rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 bg-restro-green hover:bg-restro-green-button-hover"
              >
                {t('orders.pay_complete_order')}
              </button>
           
          </div>
        </div>
      </dialog>
      {/* dialog: complete order & payment summary */}

      {/* dialog: complete order */}
      <dialog id="modal-collect-feedback" className="modal">
        <div className="modal-box border border-restro-border-green rounded-2xl ">
          <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-restro-gray">
            <IconStars stroke={iconStroke} />
          </div>
          <h3 className="mt-4 font-bold text-lg text-center">{t('orders.collect_feedback')}</h3>

          <div className="absolute top-6 right-6">
            <form method="dialog">
              <button className="btn btn-sm btn-circle border-none transition active:scale-95 text-restro-red hover:bg-restro-button-hover">
                <IconX stroke={iconStroke} size={18} />
              </button>
            </form>
          </div>

          <div className="my-4">
            <img src={state.feedbackQRCode} alt={t('orders.feedback_qr_img_alt')} className="w-52 h-52 mx-auto border rounded-lg" />
          </div>

          <p className="text-center italic mb-10" dangerouslySetInnerHTML={{__html: t('orders.feedback_message')}}>

          </p>

          <div className="flex items-center gap-2 text-sm">
            <div className="flex-1 border-b border-restro-gray"></div>
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-restro-gray">
              OR
            </div>
            <div className="flex-1 border-b border-restro-gray"></div>
          </div>

          <div className="modal-action justify-center">
            <form method="dialog">
              <button
                onClick={() => {
                  btnOpenFeedbackLink();
                }}
                className="btn ml-2 transition active:scale-95 hover:shadow-lg px-4 py-3 border bg-restro-green hover:bg-restro-green-button-hover text-white rounded-xl"
              >
                {t('orders.open_in_new_tab')} <IconExternalLink stroke={iconStroke} />
              </button>
            </form>
          </div>
          </div>
      </dialog>
      {/* dialog: complete order */}

      {/* modal: rich order details (POS & QR storefront) */}
      <dialog id="modal-order-detail" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box max-w-2xl bg-white dark:bg-restro-card-bg border border-restro-border-green rounded-2xl p-6">
          <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                Order #{selectedOrderDetail?.id || selectedOrderDetail?.token_no || ""}
                {selectedOrderDetail?.token_no ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                    Token #{selectedOrderDetail.token_no}
                  </span>
                ) : null}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                {selectedOrderDetail?.source === "qr_storefront" ? (
                  <span className="text-emerald-600 font-semibold">📱 QR Digital Menu Storefront Order</span>
                ) : (
                  <span className="text-blue-600 font-semibold">🖥️ POS Cashier In-Store Order</span>
                )}
                {selectedOrderDetail?.created_by && ` • by ${selectedOrderDetail.created_by}`}
              </p>
            </div>
            <button
              onClick={() => document.getElementById("modal-order-detail")?.close()}
              className="btn btn-sm btn-circle btn-ghost"
            >
              <IconX size={18} stroke={iconStroke} />
            </button>
          </div>

          {isLoadingOrderDetail ? (
            <div className="py-12 text-center text-sm text-gray-500">
              Loading full order details...
            </div>
          ) : (
            <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Timing & Badges banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-gray-50 dark:bg-restro-gray text-xs">
                <div className="flex items-center gap-1.5">
                  <IconCalendarTime size={16} stroke={iconStroke} className="text-primary" />
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    Placed: {formatOrderTime(selectedOrderDetail?.date).formatted || "N/A"}
                  </span>
                  {formatOrderTime(selectedOrderDetail?.date).relative && (
                    <span className="text-gray-400 font-normal">
                      ({formatOrderTime(selectedOrderDetail?.date).relative})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={clsx("px-2.5 py-0.5 rounded-full font-bold text-xs", {
                    "bg-amber-100 text-amber-700": selectedOrderDetail?.payment_status === "pending",
                    "bg-emerald-100 text-emerald-700": selectedOrderDetail?.payment_status === "paid",
                  })}>
                    {(selectedOrderDetail?.payment_status || "pending").toUpperCase()}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full font-semibold text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {(selectedOrderDetail?.status || "created").toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Delivery / Table / Customer Section */}
              <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-restro-gray/40 text-xs space-y-2">
                <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-gray-800">
                  <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    {selectedOrderDetail?.delivery_type === "delivery" ? (
                      <>
                        <IconTruck size={16} stroke={iconStroke} className="text-emerald-500" />
                        Delivery Order Details
                      </>
                    ) : selectedOrderDetail?.table ? (
                      <>
                        <IconArmchair size={16} stroke={iconStroke} className="text-blue-500" />
                        Dine-in Table Details
                      </>
                    ) : (
                      <>
                        <IconBoxSeam size={16} stroke={iconStroke} className="text-amber-500" />
                        Takeaway / Pickup Order Details
                      </>
                    )}
                  </span>
                  {selectedOrderDetail?.delivery_fee > 0 && (
                    <span className="font-semibold text-emerald-600">
                      Delivery Fee: {currency}{selectedOrderDetail.delivery_fee}
                    </span>
                  )}
                </div>

                {selectedOrderDetail?.delivery_type === "delivery" && (
                  <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/60">
                    <p className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-start gap-1">
                      <IconMapPin size={15} stroke={iconStroke} className="flex-shrink-0 mt-0.5 text-emerald-600" />
                      <span>Delivery Address: {selectedOrderDetail?.delivery_address || "No address specified on order"}</span>
                    </p>
                  </div>
                )}

                {selectedOrderDetail?.table && (
                  <p className="text-gray-700 dark:text-gray-300">
                    <span className="font-semibold">Table:</span> {selectedOrderDetail.table.title || selectedOrderDetail.table_title}{" "}
                    {selectedOrderDetail.table.floor && `(${selectedOrderDetail.table.floor})`}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-gray-600 dark:text-gray-300">
                  <p className="flex items-center gap-1">
                    <IconUser size={14} stroke={iconStroke} />
                    <span className="font-semibold">Customer:</span>{" "}
                    {selectedOrderDetail?.customer?.name || selectedOrderDetail?.customer_name || "Walk-in Customer"}
                  </p>
                  {(selectedOrderDetail?.customer?.phone || selectedOrderDetail?.customer_id) && (
                    <p className="flex items-center gap-1">
                      <IconPhone size={14} stroke={iconStroke} />
                      <span className="font-semibold">Phone:</span>{" "}
                      {selectedOrderDetail?.customer?.phone || selectedOrderDetail?.customer_id}
                    </p>
                  )}
                </div>
              </div>

              {/* Items Breakdown */}
              <div>
                <h4 className="font-bold text-sm text-foreground mb-2">Order Items</h4>
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                  {(selectedOrderDetail?.items || []).map((item, idx) => {
                    const addonsText = item?.addons?.length > 0
                      ? item.addons.map((a) => (typeof a === "object" ? a.title : a)).join(", ")
                      : null;
                    const lineTotal = (Number(item?.price) || 0) * (Number(item?.quantity) || 1);

                    return (
                      <div key={idx} className="p-3 flex items-start justify-between gap-3 bg-white dark:bg-restro-card-bg">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            {item?.item_title || item?.title || "Item"}{" "}
                            {item?.variant_title && (
                              <span className="text-muted-foreground font-normal">({item.variant_title})</span>
                            )}
                          </p>
                          {addonsText && (
                            <p className="text-gray-500 text-[11px] mt-0.5">
                              Addons: {addonsText}
                            </p>
                          )}
                          {item?.notes && (
                            <p className="text-amber-600 dark:text-amber-400 text-[11px] mt-0.5 italic">
                              Note: {item.notes}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900 dark:text-gray-100">
                            {currency}{lineTotal.toLocaleString()}
                          </p>
                          <p className="text-gray-400 text-[11px]">
                            {item?.quantity} × {currency}{Number(item?.price || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order Financial Totals */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-restro-gray text-xs space-y-1.5">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Items Subtotal:</span>
                  <span className="font-semibold">
                    {currency}
                    {(
                      (selectedOrderDetail?.items || []).reduce(
                        (sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1),
                        0
                      )
                    ).toLocaleString()}
                  </span>
                </div>
                {selectedOrderDetail?.delivery_fee > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Delivery Fee:</span>
                    <span className="font-semibold">+{currency}{selectedOrderDetail.delivery_fee}</span>
                  </div>
                )}
                {selectedOrderDetail?.invoice_id && (
                  <div className="flex justify-between text-gray-500 pt-1 border-t border-gray-200 dark:border-gray-700">
                    <span>Invoice #:</span>
                    <span className="font-semibold">#{selectedOrderDetail.invoice_id}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="modal-action flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => {
                const orderId = selectedOrderDetail?.id;
                const token = selectedOrderDetail?.token_no;
                if (orderId) btnPrintReceipt([orderId], token);
              }}
              className="btn btn-sm rounded-xl border bg-white dark:bg-restro-gray text-gray-700 dark:text-gray-200 hover:bg-gray-100"
            >
              <IconReceipt size={16} stroke={iconStroke} /> Print Receipt
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("modal-order-detail")?.close()}
              className="btn btn-sm rounded-xl bg-restro-green text-white hover:bg-restro-green-button-hover"
            >
              Close
            </button>
          </div>
        </div>
      </dialog>
    </Page>
  );
}
