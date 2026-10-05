'use client';
import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import { SocketContext } from '../contexts/SocketContext';
import { getUserDetailsInLocalStorage } from '../helpers/UserDetails';
import { textToSpeech } from '../utils/textToSpeech';
import { useTheme } from '../contexts/ThemeContext';
import { getImageURL } from '../helpers/ImageHelper';

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

export default function TokenDisplayPage() {
  const { socket, isSocketConnected } = useContext(SocketContext);
  const user = getUserDetailsInLocalStorage();
  const { theme } = useTheme();

  const [calledTokens, setCalledTokens] = useState([]);
  const [currentToken, setCurrentToken] = useState(null);
  const [newOrderTokens, setNewOrderTokens] = useState([]);
  const [storeMeta, setStoreMeta] = useState(null);
  const [resolvedTenantId, setResolvedTenantId] = useState(user?.tenant_id || null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioUnlockedRef = useRef(false);

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

    // Fetch store branding if missing
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

  // Unlock browser audio upon first click anywhere
  const enableAudio = useCallback(() => {
    if (!audioUnlockedRef.current) {
      audioUnlockedRef.current = true;
      setAudioUnlocked(true);
      try {
        const audio = new Audio('/new_order_sound.mp3');
        audio.volume = 0.1;
        audio.play().catch(() => {});
      } catch (e) {}
    }
  }, []);

  // 2. Real-time socket events with tenant room isolation
  useEffect(() => {
    if (!resolvedTenantId || !socket) return;

    socket.emit('authenticate', resolvedTenantId);

    const handleNewOrder = (payload) => {
      const tokenNo = payload?.tokenNo;
      if (!tokenNo) return;
      setNewOrderTokens((prev) => (prev.includes(tokenNo) ? prev : [...prev, tokenNo]));
      try {
        textToSpeech('New order, token number ' + tokenNo);
      } catch (e) {}
      try {
        new Audio('/new_order_sound.mp3').play().catch(() => {});
      } catch (e) {}
    };

    const handleTokenCall = (payload) => {
      const tokenNo = payload?.tokenNo;
      if (!tokenNo) return;
      setCurrentToken(tokenNo);
      setCalledTokens((prev) => [tokenNo, ...prev.filter((t) => t !== tokenNo)].slice(0, 8));
      setNewOrderTokens((prev) => prev.filter((t) => t !== tokenNo));

      try {
        textToSpeech('Token number ' + tokenNo + ', please collect your order.');
      } catch (e) {}
      try {
        new Audio('/new_order_sound.mp3').play().catch(() => {});
      } catch (e) {}
    };

    socket.on('new_order', handleNewOrder);
    socket.on('token_call', handleTokenCall);

    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('token_call', handleTokenCall);
    };
  }, [socket, resolvedTenantId]);

  const isDark = theme === 'black';
  const storeImage = storeMeta?.store_image;
  const storeName = storeMeta?.store_name || 'Token Display';
  const logoUrl = storeImage ? getImageURL(storeImage) : null;
  const isConnected = socket && socket.connected;

  const outerCls =
    "min-h-screen flex flex-col font-['Nunito'] transition-colors duration-300 " +
    (isDark ? 'bg-[#0d0d0d] text-white' : 'bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/30 text-gray-900');

  const headerCls =
    'w-full py-4 px-6 md:px-10 flex items-center justify-between border-b backdrop-blur-md sticky top-0 z-20 ' +
    (isDark ? 'border-[#222] bg-[#111]/90' : 'border-emerald-100 bg-white/90 shadow-sm');

  const mainCardCls =
    'w-full max-w-xl text-center rounded-3xl border shadow-2xl px-8 py-10 transition transform duration-300 ' +
    (isDark
      ? 'bg-gradient-to-b from-[#1a1a1a] to-[#121212] border-[#2a2a2a]'
      : 'bg-white border-emerald-100/80 shadow-emerald-900/5');

  const sectionCls =
    'w-full max-w-xl rounded-2xl border px-6 py-5 backdrop-blur-sm ' +
    (isDark ? 'bg-[#181818]/90 border-[#2a2a2a]' : 'bg-white border-emerald-100 shadow-sm');

  const tokenNumCls =
    'text-8xl md:text-[140px] font-black leading-none my-2 tracking-tight ' +
    (isDark ? 'text-emerald-400' : 'text-emerald-700');

  return (
    <div className={outerCls} onClick={enableAudio} style={{ userSelect: 'none' }}>
      {/* Audio permission banner if needed */}
      {!audioUnlocked && (
        <div className="bg-emerald-600 text-white text-xs font-semibold py-1.5 px-4 text-center cursor-pointer shadow-sm hover:bg-emerald-700 transition">
          🔔 Click anywhere on the screen to enable audio announcements
        </div>
      )}

      {/* Top Header */}
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
            <div className="h-11 w-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-base shadow-md">
              {storeName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-extrabold text-base tracking-tight leading-none text-emerald-600 dark:text-emerald-400">
              {storeName}
            </h1>
            <p className="text-xs opacity-50 font-medium mt-0.5">Order Token Calling Screen</p>
          </div>
        </div>

        {/* Live Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-current/10 bg-current/5 text-xs font-semibold">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          ></span>
          <span className="opacity-80">
            {isConnected ? 'Live' : 'Connecting...'}
          </span>
        </div>
      </header>

      {/* Body Area */}
      <main className="flex-1 flex flex-col items-center justify-center w-full px-6 py-10 gap-6">
        {/* Main Card: Now Serving */}
        <div className={mainCardCls}>
          {/* Prominent Tenant Store Logo */}
          {logoUrl ? (
            <div className="flex justify-center mb-4">
              <img
                src={logoUrl}
                alt={storeName}
                className="h-20 w-20 rounded-2xl object-cover shadow-lg ring-4 ring-emerald-500/20"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          ) : (
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-2xl bg-emerald-600 text-white font-black text-3xl flex items-center justify-center shadow-lg">
                {storeName.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          <p className="text-sm md:text-base font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">
            Now Serving
          </p>

          {currentToken ? (
            <div className="animate-bounce-short">
              <div className={tokenNumCls}>#{currentToken}</div>
              <p className="text-sm opacity-70 font-semibold mt-1">
                Please collect your order at the counter
              </p>
            </div>
          ) : (
            <div className="py-10">
              <p className="text-4xl md:text-5xl font-light opacity-30 tracking-wide">
                Waiting...
              </p>
              <p className="text-xs opacity-50 mt-3">
                Tokens called from POS or Kitchen will appear here
              </p>
            </div>
          )}
        </div>

        {/* Pending Orders Grid */}
        {newOrderTokens.length > 0 && (
          <div className={sectionCls}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                Preparing Orders
              </p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-bold">
                {newOrderTokens.length} in queue
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {newOrderTokens.map((tok) => (
                <div
                  key={tok}
                  className={`w-14 h-14 rounded-xl flex items-center justify-center text-lg font-extrabold border shadow-sm transition hover:scale-105 ${
                    isDark
                      ? 'bg-[#222] border-[#333] text-amber-400'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  #{tok}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recently Called Row */}
        {calledTokens.length > 1 && (
          <div className={sectionCls}>
            <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-3">
              Recently Called
            </p>
            <div className="flex flex-wrap gap-2.5">
              {calledTokens.slice(1).map((tok) => (
                <div
                  key={tok}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold border opacity-60 ${
                    isDark
                      ? 'bg-[#222] border-[#333] text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-700'
                  }`}
                >
                  #{tok}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer Notice */}
      <footer className="w-full py-3 px-8 text-center text-xs opacity-50 border-t border-current/10">
        {storeName} · Real-time token display · Auto-updates instantly
      </footer>
    </div>
  );
}
