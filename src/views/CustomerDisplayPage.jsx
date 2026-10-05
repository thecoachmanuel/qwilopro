'use client';
import React, { useContext, useEffect, useState } from 'react';
import { SocketContext } from '../contexts/SocketContext';
import { getUserDetailsInLocalStorage } from '../helpers/UserDetails';
import { useTheme } from '../contexts/ThemeContext';

export default function CustomerDisplayPage() {
  const { socket } = useContext(SocketContext);
  const user = getUserDetailsInLocalStorage();
  const { theme } = useTheme();
  const [cartData, setCartData] = useState(null);

  useEffect(() => {
    const tenantId = user?.tenant_id;
    if (!tenantId || !socket) return;
    socket.emit('authenticate', tenantId);

    const handleCartUpdate = (payload) => {
      setCartData(payload);
    };

    socket.on('cart_update', handleCartUpdate);
    return () => {
      socket.off('cart_update', handleCartUpdate);
    };
  }, [socket, user?.tenant_id]);

  const isDark = theme === 'black';
  const cart = cartData?.cart || [];
  const summary = cartData?.summary || {};
  const customer = cartData?.customer;

  const outerCls = 'min-h-screen flex flex-col font-[\'Nunito\'] ' + (isDark ? 'bg-[#0d0d0d] text-white' : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50 text-gray-900');
  const headerCls = 'w-full py-4 px-8 flex items-center justify-between border-b ' + (isDark ? 'border-[#2a2a2a] bg-[#111]' : 'border-emerald-100 bg-white/60 backdrop-blur');
  const leftBg = isDark ? 'bg-[#111]' : 'bg-emerald-700';
  const rightBg = 'w-full md:w-[420px] flex flex-col ' + (isDark ? 'bg-[#141414]' : 'bg-white');
  const rightHeaderCls = 'px-6 py-4 border-b font-bold text-sm uppercase tracking-widest ' + (isDark ? 'border-[#2a2a2a] text-gray-400' : 'border-gray-100 text-gray-500');
  const dividerCls = 'flex justify-between text-base font-bold pt-2 border-t ' + (isDark ? 'border-[#333]' : 'border-gray-200');
  const totalAmtCls = isDark ? 'text-emerald-400' : 'text-emerald-700';
  const titleCls = 'font-bold text-lg ' + (isDark ? 'text-emerald-400' : 'text-emerald-700');
  const dotCls = 'w-2.5 h-2.5 rounded-full ' + (socket && socket.connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400');

  return (
    <div className={outerCls} style={{ userSelect: 'none' }}>
      <div className={headerCls}>
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-10 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
          <p className={titleCls}>Customer Display</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={dotCls}></span>
          <span className="text-sm font-medium opacity-70">{socket && socket.connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left: Welcome/Branding */}
        <div className={'flex-1 flex flex-col items-center justify-center p-12 ' + leftBg}>
          <img
            src="/logo.png"
            alt="Logo"
            className="h-20 mb-6 object-contain brightness-200"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h1 className="text-4xl font-black text-white text-center mb-2">
            {customer && customer.name ? 'Hello, ' + customer.name + '!' : 'Welcome!'}
          </h1>
          <p className="text-emerald-100 text-center text-base opacity-80 mt-1">
            {customer && customer.phone ? customer.phone : 'Thank you for visiting us today'}
          </p>
          <div className="mt-10 p-6 rounded-2xl bg-white/10 backdrop-blur text-center w-full max-w-xs">
            <p className="text-white/70 text-sm uppercase tracking-widest mb-1">Your Total</p>
            <p className="text-5xl font-black text-white">
              {summary.currency || ''}{Number(summary.payableTotal || 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Right: Order Items */}
        <div className={rightBg}>
          <div className={rightHeaderCls}>Your Order</div>
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center opacity-30 py-12">
                <p className="text-4xl mb-3">🛒</p>
                <p className="text-sm">No items yet</p>
              </div>
            ) : (
              cart.map((item, i) => (
                <div
                  key={i}
                  className={'flex items-start justify-between gap-3 py-3 border-b ' + (isDark ? 'border-[#222]' : 'border-gray-50')}
                >
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{item.title}</p>
                    {item.variant && item.variant.title && (
                      <p className="text-xs opacity-60">{item.variant.title}</p>
                    )}
                    {item.notes && (
                      <p className="text-xs italic opacity-50 mt-0.5">{item.notes}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium">x{item.quantity}</p>
                    <p className={'text-sm font-bold ' + totalAmtCls}>
                      {summary.currency || ''}{(Number(item.price) * Number(item.quantity)).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          {cart.length > 0 && (
            <div className={'px-6 py-4 border-t space-y-2 ' + (isDark ? 'border-[#2a2a2a]' : 'border-gray-100')}>
              <div className="flex justify-between text-sm">
                <span className="opacity-60">Subtotal</span>
                <span>{summary.currency || ''}{Number(summary.itemsTotal || 0).toFixed(2)}</span>
              </div>
              {Number(summary.taxTotal) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="opacity-60">Tax</span>
                  <span>{summary.currency || ''}{Number(summary.taxTotal).toFixed(2)}</span>
                </div>
              )}
              {Number(summary.serviceChargeTotal) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="opacity-60">Service Charge</span>
                  <span>{summary.currency || ''}{Number(summary.serviceChargeTotal).toFixed(2)}</span>
                </div>
              )}
              <div className={dividerCls}>
                <span>Total</span>
                <span className={totalAmtCls}>
                  {summary.currency || ''}{Number(summary.payableTotal || 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
