'use client';
import React from 'react';

/**
 * AppErrorBoundary — catches any React render error and auto-reloads once.
 *
 * "Error shows then disappears after refresh" was caused by old cached JS
 * bundles crashing on the first render (e.g. React Rules of Hooks violation).
 * With no-store headers now in place, refreshes always load the new bundle.
 * This boundary makes the first-load recovery automatic — no manual refresh needed.
 */
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, reloaded: false };
  }

  componentDidMount() {
    // Once the app mounts successfully without crashing, clear any reload flag after 3s
    this.healthyTimer = setTimeout(() => {
      try {
        sessionStorage.removeItem('app_error_reload_v1');
      } catch {}
    }, 3000);
  }

  componentWillUnmount() {
    if (this.healthyTimer) clearTimeout(this.healthyTimer);
  }

  static getDerivedStateFromError(error) {
    let alreadyReloaded = false;
    try {
      alreadyReloaded = !!sessionStorage.getItem('app_error_reload_v1');
    } catch {}
    return { hasError: true, reloaded: !alreadyReloaded };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary] caught error:', error, info);

    const reloadKey = 'app_error_reload_v1';
    let alreadyReloaded = false;
    try {
      alreadyReloaded = !!sessionStorage.getItem(reloadKey);
    } catch {}

    if (!alreadyReloaded) {
      try {
        sessionStorage.setItem(reloadKey, '1');
      } catch {}
      setTimeout(() => window.location.reload(), 400);
    }
  }

  render() {
    if (this.state.hasError && !this.state.reloaded) {
      // Only shown if auto-reload already ran and it's still crashing
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          fontFamily: 'system-ui, sans-serif', background: '#f9fafb',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111827', margin: 0 }}>Something went wrong</h2>
          <p style={{ color: '#6b7280', margin: 0 }}>The page encountered an unexpected error.</p>
          <button
            onClick={() => { sessionStorage.removeItem('app_error_reload_v1'); window.location.reload(); }}
            style={{
              marginTop: 8, padding: '10px 24px', borderRadius: 10, border: 'none',
              background: '#16a34a', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 15,
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    if (this.state.reloaded) {
      // Show a spinner while the page auto-reloads
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12,
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{
            width: 40, height: 40, border: '3px solid #dcfce7',
            borderTopColor: '#16a34a', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ color: '#6b7280', margin: 0, fontSize: 14 }}>Loading QwiloPro...</p>
        </div>
      );
    }

    return this.props.children;
  }
}
