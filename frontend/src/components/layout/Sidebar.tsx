import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Users, FileText, CheckSquare,
  Video, BarChart2, TrendingUp, Settings, Plus, LogOut, Sparkles,
  ChevronLeft, ChevronRight, Star, ClipboardList, Building2, UserCircle, Mail, History
} from 'lucide-react';
import api from '../../services/api';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('candidate');

  useEffect(() => {
    const raw = localStorage.getItem('user_data') || localStorage.getItem('user');
    if (raw) {
      try {
        const u = JSON.parse(raw);
        setUser(u);
        setUserRole(u.role || 'candidate');
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    delete api.defaults.headers.common['Authorization'];
    window.location.href = '/login';
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'AB';

  const navItems = [
    // ── Common ──
    {
      name: 'Dashboard',
      path: userRole === 'recruiter' ? '/recruiter' : userRole === 'admin' ? '/admin' : '/dashboard',
      icon: LayoutDashboard,
      roles: ['candidate', 'recruiter', 'admin'],
    },
    {
      name: 'Jobs',
      path: '/jobs',
      icon: Briefcase,
      roles: ['candidate', 'admin'],
    },

    // ── Candidate-only sidebar items (Unified AI Practice Hub + Core Portal) ──
    {
      name: 'My Applications',
      path: '/applications',
      icon: FileText,
      roles: ['candidate'],
    },
    {
      name: 'AI Practice Hub',
      path: '/practice',
      icon: Sparkles,
      roles: ['candidate', 'admin'],
    },

    // ── Recruiter-only sidebar items ──
    {
      name: 'Posted Jobs',
      path: '/recruiter/posted-jobs',
      icon: Briefcase,
      roles: ['recruiter'],
    },
    {
      name: 'Applications',
      path: '/recruiter/applications',
      icon: ClipboardList,
      roles: ['recruiter'],
    },
    {
      name: 'Shortlisted',
      path: '/recruiter/shortlisted',
      icon: Star,
      roles: ['recruiter'],
    },
    {
      name: 'Assessments',
      path: '/recruiter/assessments',
      icon: CheckSquare,
      roles: ['recruiter'],
    },
    {
      name: 'Interviews',
      path: '/recruiter/interviews',
      icon: Video,
      roles: ['recruiter'],
    },
    {
      name: 'Offers',
      path: '/recruiter/offers',
      icon: Mail,
      roles: ['recruiter'],
    },
    {
      name: 'Reports',
      path: '/recruiter/reports',
      icon: BarChart2,
      roles: ['recruiter'],
    },
    {
      name: 'Analytics',
      path: '/recruiter/analytics',
      icon: TrendingUp,
      roles: ['recruiter'],
    },

    // ── Common bottom items ──
    {
      name: 'Profile',
      path: '/profile',
      icon: UserCircle,
      roles: ['candidate', 'recruiter', 'admin'],
    },
    {
      name: 'Settings',
      path: '/settings',
      icon: Settings,
      roles: ['candidate', 'recruiter', 'admin'],
    },
  ];

  const filteredNav = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <aside
      aria-label="Main Navigation"
      className={`relative sticky top-0 h-screen bg-[#0B0F1B] text-slate-200 transition-all duration-300 z-50 flex flex-col justify-between p-4 border-r border-slate-800/80 shadow-2xl select-none ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        className="absolute -right-3.5 top-8 w-7 h-7 rounded-full bg-indigo-600 text-white border-2 border-[#0B0F1B] flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F1B]"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
        {/* Brand Emblem & Logo */}
        <div className={`flex items-center gap-3 px-2 py-4 mb-4 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
              SmartHire <span className="text-indigo-400 font-extrabold text-sm">AI</span>
            </h1>
          )}
        </div>

        {/* Section Label */}
        {!collapsed && (
          <div className="px-3 mb-2">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
              Workspace Navigation
            </p>
          </div>
        )}

        {/* Navigation Workspace Links */}
        <nav className="space-y-1">
          {filteredNav.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              aria-label={item.name}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0B0F1B] ${
                  isActive
                    ? 'bg-slate-800/90 text-white shadow-inner font-extrabold border border-slate-700/60'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                  {!collapsed && <span>{item.name}</span>}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-indigo-500 rounded-r-full" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Primary Action Button (+ Post New Job) */}
        {!collapsed && (
          <div className="mt-6 mb-4 px-1">
            <button
              onClick={() => {
                if (userRole === 'recruiter' || userRole === 'admin') {
                  navigate('/recruiter?action=create-job');
                } else {
                  navigate('/interview');
                }
              }}
              aria-label={userRole === 'candidate' ? 'Start Practice Session' : 'Post New Job'}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F1B]"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{userRole === 'candidate' ? 'Start Practice Session' : 'Post New Job'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer Profile & Logout Capsule */}
      <div className="pt-3 border-t border-slate-800/80">
        <div className={`flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-indigo-900/80 border border-indigo-500/40 text-indigo-200 font-extrabold text-xs flex items-center justify-center shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-100 truncate leading-tight">
                  {user?.full_name || 'User'}
                </p>
                <p className="text-[10px] font-medium text-slate-400 truncate leading-tight">
                  {user?.email || ''}
                </p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button 
              onClick={handleLogout}
              aria-label="Log out"
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800/50 transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

