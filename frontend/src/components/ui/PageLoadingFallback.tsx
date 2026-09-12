import React from 'react';

export const PageLoadingFallback: React.FC = () => {
  return (
    <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-8 transition-opacity duration-200">
      {/* Top subtle indeterminate progress bar */}
      <div className="fixed top-0 left-0 right-0 h-[2.5px] bg-slate-200 dark:bg-slate-800 overflow-hidden z-50">
        <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 animate-pulse w-full" />
      </div>

      {/* Branded Glowing Pulse Indicator */}
      <div className="relative flex flex-col items-center gap-4">
        <div className="relative w-14 h-14 flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 dark:bg-indigo-500/30 blur-xl animate-pulse" />
          <div className="w-12 h-12 rounded-2xl border-2 border-indigo-500/40 border-t-indigo-600 dark:border-t-indigo-400 animate-spin flex items-center justify-center">
            <div className="w-6 h-6 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-xs font-bold tracking-wider text-slate-700 dark:text-slate-300 uppercase">
            Loading
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Preparing your experience...
          </span>
        </div>
      </div>
    </div>
  );
};

export default PageLoadingFallback;
