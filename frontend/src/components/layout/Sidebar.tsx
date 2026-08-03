import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Video, FileText, Briefcase, Award, Settings,
  LogOut, Sparkles, Shield, ChevronLeft, ChevronRight, BarChart3, Users
} from 'lucide-react';
import api from '../../services/api';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [userRole, setUserRole] = useState<string>('candidate');

  useEffect(() => {
    const raw = localStorage.getItem('user_data') || localStorage.getItem('user');
    if (raw) {
      try {
        const u = JSON.parse(raw);
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

  const navItems = [
    {
      name: 'Dashboard',
      path: userRole === 'recruiter' ? '/recruiter' : userRole === 'admin' ? '/admin' : '/dashboard',
      icon: LayoutDashboard,
      roles: ['candidate', 'recruiter', 'admin'],
    },
    {
      name: 'Job Openings',
      path: '/jobs',
      icon: Briefcase,
      roles: ['candidate'],
    },
    {
      name: 'My Applications',
      path: '/applications',
      icon: FileText,
      roles: ['candidate'],
    },
    {
      name: 'AI Mock Session',
      path: '/interview',
      icon: Video,
      roles: ['candidate'],
    },
    {
      name: 'Resume Analyzer',
      path: '/resume',
      icon: FileText,
      roles: ['candidate', 'recruiter'],
    },
    {
      name: 'Evaluation Reports',
      path: '/reports',
      icon: BarChart3,
      roles: ['candidate', 'recruiter', 'admin'],
    },
    {
      name: 'Offers',
      path: '/offers',
      icon: Award,
      roles: ['candidate'],
    },
    {
      name: 'Recruiter Workspace',
      path: '/recruiter',
      icon: Users,
      roles: ['recruiter', 'admin'],
    },
    {
      name: 'Admin Governance',
      path: '/admin',
      icon: Shield,
      roles: ['admin'],
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
      className={`relative sticky top-0 h-screen bg-brand-ink text-brand-bg transition-all duration-300 z-50 flex flex-col justify-between p-4 shadow-floating ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3.5 top-8 w-7 h-7 rounded-full bg-brand-primary text-brand-accent border-2 border-white flex items-center justify-center shadow-md hover:scale-110 transition-transform"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div>
        {/* Brand Emblem & Logo */}
        <div className={`flex items-center gap-3 px-2 py-4 mb-6 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-secondary to-brand-primary flex items-center justify-center shadow-luxury">
            <Sparkles className="w-5 h-5 text-brand-accent" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-1">
                SmartHire <span className="text-brand-accent text-xs px-1.5 py-0.5 rounded-lg bg-brand-primary">AI</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-semibold">Enterprise AI Recruitment</p>
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        {!collapsed && userRole === 'candidate' && (
          <button
            onClick={() => navigate('/interview')}
            className="w-full mb-6 py-3 px-4 rounded-2xl bg-brand-secondary hover:bg-sb-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-soft transition-all"
          >
            <Video className="w-4 h-4" />
            <span>Start Practice Session</span>
          </button>
        )}

        {/* Navigation Workspace Links */}
        <nav className="space-y-1.5">
          {filteredNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-extrabold transition-all group relative ${
                  isActive
                    ? 'bg-brand-primary text-brand-accent shadow-soft'
                    : 'text-slate-300 hover:bg-sb-800/80 hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-brand-accent' : 'text-slate-400 group-hover:text-white'}`} />
                  {!collapsed && <span>{item.name}</span>}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-brand-accent rounded-r-full" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer Profile & Logout */}
      <div className="pt-4 border-t border-sb-800">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-extrabold text-rose-400 hover:bg-rose-950/40 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};
