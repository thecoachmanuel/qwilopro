'use client';
import React, { useContext, useEffect, useState, useCallback } from 'react';
import { SocketContext } from '../contexts/SocketContext';
import { getUserDetailsInLocalStorage } from '../helpers/UserDetails';
import { useTheme } from '../contexts/ThemeContext';
import { getImageURL } from '../helpers/ImageHelper';

// Read POS cache for store branding fallback
function getStoreMetaFromCache(tenantId) {
  try {
    const key = tenantId
      ? `RESTROPROSAAS__POS_CACHE_t${tenantId}`
      : 'RESTROPROSAAS__POS_CACHE';
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.storeSettings || null;
  } catch {
    return null;
  }
}

export default function CustomerDisplayPage() {
  const { socket, isSocketConnected } = useContext(SocketContext);
  const user = getUserDetailsInLocalStorage();
  const { theme } = useTheme();

  const [cartData, setCartData] = useState(null);
  const [storeMeta, setStoreMeta] = useState(null);
  const [resolvedTenantId, setResolvedTenantId] = useState(user?.tenant_id || null);

  // 1. Resolve tenant from URL query parameters (?tenant_id=, ?tenant=, ?t=) or localStorage
  useEffect(() => {
    let tId = user?.tenant_id || null;
    let tSlug = null;

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTenantId = params.get('tenant_id') || params.get('t');
      const urlTenantSlug = params.get('tenant') || params.get('slug');

      if (urlTenantId && !isNaN(Number(urlTenantId))) {
        tId = Number(urlTenantId);
      } else if (urlTenantSlug) {
        tSlug = urlTenantSlug;
      }
    }

    if (tId) {
      setResolvedTenantId(tId);
      const cached = getStoreMetaFromCache(tId);
      if (cached) setStoreMeta(cached);
    }

    // If store branding is not yet in cache, fetch public store settings
    const identifier = tSlug || tId || 'royal-savor';
    if (!storeMeta || !storeMeta.store_name) {
      fetch(`/api/v1/qrmenu/${identifier}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.storeSettings) {
            setStoreMeta(data.storeSettings);
            if (data.storeSettings.tenant_id) {
              setResolvedTenantId(data.storeSettings.tenant_id);
            }
          }
        })
        .catch(() => {});
    }
  }, [user?.tenant_id]);

  // 2. Connect socket and authenticate tenant channel/room
  useEffect(() => {
    if (!resolvedTenantId || !socket) return;

    socket.emit('authenticate', resolvedTenantId);

    const handleCartUpdate = (payload) => {
      setCartData(payload);
    };

    socket.on('cart_update', handleCartUpdate);

    return () => {
      socket.off('cart_update', handleCartUpdate);
    };
  }, [socket, resolvedTenantId]);

  const isDark = theme === 'black';
  const cart = cartData?.cart || [];
  const summary = cartData?.summary || {};
  const customer = cartData?.customer;

  const storeImage = storeMeta?.store_image;
  const storeName = storeMeta?.store_name || 'Customer Display';
  const logoUrl = storeImage ? getImageURL(storeImage) : null;
  const currency = summary.currency || storeMeta?.currency || '$';

  const isConnected = socket && socket.connected;

  const outerCls =
    "min-h-screen flex flex-col font-['Nunito'] transition-colors duration-300 " +
    (isDark ? 'bg-[#0d0d0d] text-white' : 'bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/40 text-gray-900');

  const headerCls =
    'w-full py-4 px-6 md:px-10 flex items-center justify-between border-b backdrop-blur-md sticky top-0 z-20 ' +
    (isDark ? 'border-[#222] bg-[#111]/90' : 'border-emerald-100 bg-white/90 shadow-sm');

  const leftBg = isDark
    ? 'bg-gradient-to-br from-[#161616] to-[#0f0f0f] border-r border-[#222]'
    : 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white';

  const rightBg =
    'w-full md:w-[460px] lg:w-[500px] flex flex-col ' +
    (isDark ? 'bg-[#141414]' : 'bg-white shadow-xl');

  const totalAmtCls = isDark ? 'text-emerald-400' : 'text-emerald-700';

  return (
    <div className={outerCls} style={{ userSelect: 'none' }}>
      {/* Top Navigation Bar */}
      <header className={headerCls}>
        <div className="flex items-center gap-3.5">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={storeName}
              className="h-11 w-11 rounded-2xl object-cover shadow-md ring-2 ring-emerald-500/20"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="h-11 w-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-extrabold text-base shadow-md">
              {storeName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-extrabold text-base tracking-tight leading-none text-emerald-600 dark:text-emerald-400">
              {storeName}
            </h1>
            <p className="text-xs opacity-50 font-medium mt-0.5">Customer Display Screen</p>
          </div>
        </div>

        {/* Live Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-current/10 bg-current/5 text-xs font-semibold">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          ></span>
          <span className="opacity-80">
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
      </header>

      {/* Main Content Split Screen */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Branded Welcome Hero & Big Total Display */}
        <section className={`flex-1 flex flex-col items-center justify-center p-8 md:p-14 ${leftBg}`}>
          <div className="flex flex-col items-center text-center max-w-md w-full animate-fadeIn">
            {/* Prominent Store Logo */}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={storeName}
                className="h-28 w-28 rounded-3xl object-cover mb-6 shadow-2xl ring-4 ring-white/20"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="h-28 w-28 rounded-3xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white font-black text-5xl mb-6 shadow-2xl">
                {storeName.charAt(0).toUpperCase()}
              </div>
            )}

            <h2 className="text-3xl md:text-5xl font-black mb-2 tracking-tight text-white">
              {customer?.name ? `Hello, ${customer.name}!` : 'Welcome!'}
            </h2>
            <p className="text-white/80 text-sm md:text-base mb-8 font-medium">
              {customer?.phone
                ? customer.phone
                : `Thank you for choosing ${storeName}`}
            </p>

            {/* Total Card */}
            <div className="w-full p-6 md:p-8 rounded-3xl bg-black/20 backdrop-blur-lg border border-white/10 shadow-2xl text-center">
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1.5">
                Total Payable
              </p>
              <p className="text-4xl md:text-6xl font-black text-white tracking-tight">
                {currency}{Number(summary.payableTotal || 0).toFixed(2)}
              </p>
              {Number(summary.itemsTotal || 0) > 0 && (
                <p className="text-xs text-white/60 mt-2 font-medium">
                  {cart.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0)} items in order
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Right Side: Live Order Items List */}
        <section className={rightBg}>
          <div className="px-6 py-4 border-b flex items-center justify-between font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <span>Order Summary</span>
            <span className="text-emerald-600 dark:text-emerald-400">
              {cart.length > 0 ? `${cart.length} item${cart.length > 1 ? 's' : ''}` : 'Empty'}
            </span>
          </div>

          {/* Items scroll area */}
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center opacity-40">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-3xl mb-3">
                  🛍️
                </div>
                <p className="font-bold text-base">Your cart is empty</p>
                <p className="text-xs mt-1">Items added at the POS will appear here live</p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div
                  key={index}
                  className={`flex items-start justify-between gap-4 py-3 border-b transition ${
                    isDark ? 'border-[#222]' : 'border-gray-100'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm leading-snug truncate">
                      {item.title}
                    </p>
                    {item.variant?.title && (
                      <p className="text-xs opacity-60 mt-0.5">{item.variant.title}</p>
                    )}
                    {item.addons && item.addons.length > 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                        + {item.addons.filter(Boolean).map((a) => a.title).join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-xs italic opacity-50 mt-0.5">“{item.notes}”</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-current/5 mr-2">
                      x{item.quantity}
                    </span>
                    <span className={`text-sm font-extrabold ${totalAmtCls}`}>
                      {currency}{(Number(item.price) * Number(item.quantity)).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Breakdown Footer */}
          {cart.length > 0 && (
            <div
              className={`p-6 border-t space-y-2 backdrop-blur-sm ${
                isDark ? 'border-[#222] bg-[#161616]' : 'border-gray-100 bg-gray-50/80'
              }`}
            >
              <div className="flex justify-between text-xs opacity-70">
                <span>Subtotal</span>
                <span>{currency}{Number(summary.itemsTotal || 0).toFixed(2)}</span>
              </div>
              {Number(summary.taxTotal) > 0 && (
                <div className="flex justify-between text-xs opacity-70">
                  <span>Tax</span>
                  <span>{currency}{Number(summary.taxTotal).toFixed(2)}</span>
                </div>
              )}
              {Number(summary.serviceChargeTotal) > 0 && (
                <div className="flex justify-between text-xs opacity-70">
                  <span>Service Charge</span>
                  <span>{currency}{Number(summary.serviceChargeTotal).toFixed(2)}</span>
                </div>
              )}
              <div
                className={`flex justify-between text-base font-extrabold pt-2 border-t ${
                  isDark ? 'border-[#333]' : 'border-gray-200'
                }`}
              >
                <span>Total Amount</span>
                <span className={totalAmtCls}>
                  {currency}{Number(summary.payableTotal || 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
