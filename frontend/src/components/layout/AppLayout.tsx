import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 font-sans flex overflow-hidden selection:bg-indigo-500/30 transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen relative min-w-0">
        <Navbar />
        <main className="flex-1 overflow-auto bg-slate-50/60 dark:bg-[#0B0F19] transition-colors duration-300">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
