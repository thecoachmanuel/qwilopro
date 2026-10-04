'use client';

import dynamic from 'next/dynamic';

const App = dynamic(() => import('../../App'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen w-full flex items-center justify-center bg-white dark:bg-black">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500 dark:text-neutral-400">Loading QwiloPro...</p>
      </div>
    </div>
  ),
});

export default function CatchAllPage() {
  return <App />;
}
