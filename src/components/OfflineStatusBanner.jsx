'use client';
import React, { useEffect, useState } from "react";
import {
  IconWifiOff,
  IconWifi,
  IconRefresh,
  IconCheck,
  IconCloudUpload,
  IconAlertTriangle,
} from "@tabler/icons-react";
import {
  getOfflineOrdersCount,
  isAppOnline,
  syncOfflineOrders,
} from "../utils/offlineStorage";
import { createOrder, createOrderAndInvoice } from "../controllers/pos.controller";
import { toast } from "react-hot-toast";

export default function OfflineStatusBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    // Initial check
    setIsOnline(isAppOnline());
    setPendingCount(getOfflineOrdersCount());

    const handleOnline = async () => {
      setIsOnline(true);
      const currentCount = getOfflineOrdersCount();
      setPendingCount(currentCount);

      if (currentCount > 0) {
        toast("Internet restored! Automatically syncing offline orders...", {
          icon: "🌐",
        });
        await handleSync();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setPendingCount(getOfflineOrdersCount());
      toast.error(
        "Internet connection lost! QwiloPro is in Offline Mode. Orders will be saved locally.",
        { duration: 5000 }
      );
    };

    const handleQueueChanged = (e) => {
      if (e?.detail?.count !== undefined) {
        setPendingCount(e.detail.count);
      } else {
        setPendingCount(getOfflineOrdersCount());
      }
    };

    const handleSynced = (e) => {
      setPendingCount(getOfflineOrdersCount());
      if (e?.detail?.synced > 0) {
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 4000);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("restro_offline_orders_changed", handleQueueChanged);
    window.addEventListener("restro_offline_orders_synced", handleSynced);

    // Heartbeat check every 25 seconds
    const interval = setInterval(() => {
      const currentOnline = isAppOnline();
      setIsOnline(currentOnline);
      setPendingCount(getOfflineOrdersCount());
    }, 25000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("restro_offline_orders_changed", handleQueueChanged);
      window.removeEventListener("restro_offline_orders_synced", handleSynced);
      clearInterval(interval);
    };
  }, []);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await syncOfflineOrders(createOrderAndInvoice, createOrder);
      if (res?.synced > 0) {
        toast.success(
          `Successfully synced ${res.synced} offline order${res.synced > 1 ? "s" : ""} to the cloud!`
        );
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 4000);
      }
      if (res?.failed > 0 && res?.remaining > 0) {
        toast.error(`${res.remaining} order(s) could not sync yet. Will retry.`);
      }
    } catch (err) {
      console.error("Manual sync failed:", err);
      toast.error("Failed to sync offline orders. Please check your connection.");
    } finally {
      setIsSyncing(false);
      setPendingCount(getOfflineOrdersCount());
    }
  };

  // If online and nothing pending and not just synced, don't show the banner
  if (isOnline && pendingCount === 0 && !justSynced) {
    return null;
  }

  // Just synced flash banner
  if (isOnline && justSynced && pendingCount === 0) {
    return (
      <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-2 flex items-center justify-between text-xs md:text-sm text-emerald-800 dark:text-emerald-200 transition-all duration-300">
        <div className="flex items-center gap-2">
          <IconCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="font-semibold">All offline orders successfully synced with server!</span>
        </div>
      </div>
    );
  }

  // Offline banner
  if (!isOnline) {
    return (
      <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm text-amber-900 dark:text-amber-200 transition-all duration-300">
        <div className="flex items-center gap-2">
          <IconWifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse flex-shrink-0" />
          <span className="font-bold tracking-wide uppercase text-[11px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
            Offline Mode
          </span>
          <span className="hidden sm:inline text-slate-700 dark:text-neutral-300">
            No internet connection. POS is running locally — you can continue taking orders and printing receipts without interruption.
          </span>
          <span className="inline sm:hidden text-slate-700 dark:text-neutral-300">
            Running offline. Orders saved locally.
          </span>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold text-xs flex items-center gap-1">
              <IconCloudUpload className="w-3.5 h-3.5" />
              {pendingCount} order{pendingCount > 1 ? "s" : ""} pending sync
            </span>
          </div>
        )}
      </div>
    );
  }

  // Online with pending orders banner
  return (
    <div className="bg-sky-500/10 border-b border-sky-500/30 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm text-sky-900 dark:text-sky-200 transition-all duration-300">
      <div className="flex items-center gap-2">
        <IconWifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <span className="font-semibold text-slate-800 dark:text-neutral-200">
          Internet connection detected. You have <strong className="text-restro-green">{pendingCount}</strong> order{pendingCount > 1 ? "s" : ""} waiting to sync.
        </span>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1 bg-restro-green hover:bg-restro-green-dark text-white rounded-lg font-medium text-xs shadow-sm transition disabled:opacity-50"
        >
          <IconRefresh className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing..." : "Sync Orders Now"}
        </button>
      </div>
    </div>
  );
}
