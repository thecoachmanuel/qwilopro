'use client';
import React, { useContext, useEffect, useState } from 'react';
import { SocketContext } from '../contexts/SocketContext';
import { getUserDetailsInLocalStorage } from '../helpers/UserDetails';
import { textToSpeech } from '../utils/textToSpeech';
import { useTheme } from '../contexts/ThemeContext';

export default function TokenDisplayPage() {
  const { socket } = useContext(SocketContext);
  const user = getUserDetailsInLocalStorage();
  const { theme } = useTheme();
  const [calledTokens, setCalledTokens] = useState([]);
  const [currentToken, setCurrentToken] = useState(null);
  const [newOrderTokens, setNewOrderTokens] = useState([]);

  useEffect(() => {
    const tenantId = user?.tenant_id;
    if (!tenantId || !socket) return;
    socket.emit('authenticate', tenantId);

    const handleNewOrder = (payload) => {
      const tokenNo = payload?.tokenNo;
      if (!tokenNo) return;
      setNewOrderTokens((prev) => prev.includes(tokenNo) ? prev : [...prev, tokenNo]);
      try { textToSpeech('New order! Token number ' + tokenNo); } catch(e) {}
      try { new Audio('/new_order_sound.mp3').play().catch(() => {}); } catch(e) {}
    };

    const handleTokenCall = (payload) => {
      const tokenNo = payload?.tokenNo;
      if (!tokenNo) return;
      setCurrentToken(tokenNo);
      setCalledTokens((prev) => [tokenNo, ...prev.filter((t) => t !== tokenNo)].slice(0, 10));
      setNewOrderTokens((prev) => prev.filter((t) => t !== tokenNo));
      try { textToSpeech('Token number ' + tokenNo + ', please collect your order.'); } catch(e) {}
      try { new Audio('/new_order_sound.mp3').play().catch(() => {}); } catch(e) {}
    };

    socket.on('new_order', handleNewOrder);
    socket.on('token_call', handleTokenCall);
    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('token_call', handleTokenCall);
    };
  }, [socket, user?.tenant_id]);

  const isDark = theme === 'black';
  const outerCls = 'min-h-screen flex flex-col items-center justify-center font-[\'Nunito\'] ' + (isDark ? 'bg-[#0d0d0d] text-white' : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50 text-gray-900');
  const headerCls = 'w-full py-4 px-8 flex items-center justify-between border-b ' + (isDark ? 'border-[#2a2a2a] bg-[#111]' : 'border-emerald-100 bg-white/60 backdrop-blur');
  const mainCardCls = 'w-full max-w-lg text-center rounded-3xl border shadow-2xl px-8 py-12 ' + (isDark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-emerald-100');
  const sectionCls = 'w-full max-w-lg rounded-2xl border px-6 py-5 ' + (isDark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-emerald-100');
  const pendingLblCls = 'text-xs font-bold uppercase tracking-widest mb-4 ' + (isDark ? 'text-yellow-400' : 'text-yellow-600');
  const pendingItemCls = 'w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold border ' + (isDark ? 'bg-[#242424] border-[#333] text-white' : 'bg-yellow-50 border-yellow-200 text-yellow-700');
  const calledItemCls = 'w-12 h-12 rounded-xl flex items-center justify-center text-base font-semibold border opacity-40 ' + (isDark ? 'bg-[#242424] border-[#333] text-white' : 'bg-gray-50 border-gray-200 text-gray-600');
  const tokenNumCls = 'text-9xl md:text-[160px] font-black leading-none ' + (isDark ? 'text-white' : 'text-emerald-700');
  const nowServingLblCls = 'text-base font-semibold uppercase tracking-widest mb-3 ' + (isDark ? 'text-emerald-400' : 'text-emerald-600');
  const footerCls = 'w-full py-3 px-8 text-center text-xs opacity-40 border-t ' + (isDark ? 'border-[#2a2a2a]' : 'border-emerald-100');
  const titleCls = 'font-bold text-lg ' + (isDark ? 'text-emerald-400' : 'text-emerald-700');
  const dotCls = 'w-2.5 h-2.5 rounded-full ' + (socket && socket.connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400');

  return (
    <div className={outerCls} style={{ userSelect: 'none' }}>
      <div className={headerCls}>
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-10 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
          <p className={titleCls}>Order Token Display</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={dotCls}></span>
          <span className="text-sm font-medium opacity-70">{socket && socket.connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center w-full px-6 py-12 gap-8">
        <div className={mainCardCls}>
          <p className={nowServingLblCls}>Now Serving</p>
          {currentToken ? (
            <div className={tokenNumCls}>#{currentToken}</div>
          ) : (
            <div className="text-5xl font-light opacity-30">Waiting...</div>
          )}
          <p className="mt-4 text-sm opacity-60">Please collect your order at the counter</p>
        </div>
        {newOrderTokens.length > 0 && (
          <div className={sectionCls}>
            <p className={pendingLblCls}>Pending Orders</p>
            <div className="flex flex-wrap gap-3">
              {newOrderTokens.map((tok) => (
                <div key={tok} className={pendingItemCls}>#{tok}</div>
              ))}
            </div>
          </div>
        )}
        {calledTokens.length > 1 && (
          <div className={sectionCls}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4 opacity-50">Recently Called</p>
            <div className="flex flex-wrap gap-3">
              {calledTokens.slice(1).map((tok) => (
                <div key={tok} className={calledItemCls}>#{tok}</div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className={footerCls}>This display auto-updates in real time — no need to refresh</div>
    </div>
  );
}
