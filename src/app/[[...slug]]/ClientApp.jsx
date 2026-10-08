'use client';

import dynamic from 'next/dynamic';
import AppErrorBoundary from '../../components/AppErrorBoundary';

const App = dynamic(() => import('../../App'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen w-full flex items-center justify-center bg-white dark:bg-[#121212] transition-colors duration-200">
      <div className="flex flex-col items-center gap-4 p-6 text-center max-w-sm">
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-3 border-emerald-500/20 border-t-emerald-600 dark:border-t-emerald-400 animate-spin" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-base font-semibold text-slate-800 dark:text-neutral-200 tracking-tight">QwiloPro</h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400">Loading your restaurant experience...</p>
        </div>
      </div>
    </div>
  ),
});

export default function ClientApp() {
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}
