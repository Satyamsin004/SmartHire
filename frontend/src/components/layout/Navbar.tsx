import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Moon, Sun, User as UserIcon, LogOut, CheckCheck, X, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('candidate');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let parsedUser: any = null;
    const raw = localStorage.getItem('user_data') || localStorage.getItem('user');
    if (raw) {
      try {
        parsedUser = JSON.parse(raw);
        setUser(parsedUser);
        setUserRole(parsedUser.role || 'candidate');
      } catch (e) {
        console.error(e);
      }
    }
    fetchNotifications();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfileMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications/me');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) {
      // Silently fail if notifications endpoint unavailable
    }
  };

  const handleMarkRead = async (notifId: string) => {
    try {
      await api.post(`/notifications/${notifId}/read`);
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    delete api.defaults.headers.common['Authorization'];
    window.location.href = '/login';
  };

  const firstName = user?.full_name ? user.full_name.split(' ')[0] : 'User';
  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'application_status_update': return '📋';
      case 'interview_scheduled': return '🎯';
      case 'resume_updated': return '📄';
      case 'recruiter_action_required': return '⚡';
      case 'offer_received': return '🎉';
      default: return '🔔';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-6 lg:px-8 py-3 flex items-center justify-between shadow-xs transition-colors duration-300">
      {/* Workspace Category & Greeting */}
      <div>
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-none">
            {userRole === 'recruiter' ? 'RECRUITER WORKSPACE' : userRole === 'admin' ? 'ADMIN WORKSPACE' : 'CANDIDATE WORKSPACE'}
          </p>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800">
            <Sparkles className="w-2.5 h-2.5 mr-0.5" /> AI Ready
          </span>
        </div>
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
          Welcome back, {firstName}
        </h2>
      </div>

      {/* Action Tools & Profile Circle */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Search Bar */}
        <div className="relative w-48 md:w-72 hidden sm:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search jobs, skills, sessions..."
            className="w-full bg-slate-100/90 dark:bg-slate-800/80 border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 rounded-full pl-10 pr-4 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Notifications Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false); }}
            className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-[9px] font-bold text-white flex items-center justify-center shadow-xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-[#111827] rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 transition-colors cursor-pointer"
                  >
                    <CheckCheck className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500">No notifications yet</p>
                  </div>
                ) : (
                  notifications.slice(0, 15).map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => { if (!notif.is_read) handleMarkRead(notif.id); }}
                      className={`w-full text-left px-4 py-3 border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        !notif.is_read ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-base mt-0.5">{getNotifIcon(notif.notification_type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-bold truncate ${!notif.is_read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                            {notif.title}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-400 font-medium line-clamp-2 mt-0.5">
                            {notif.message}
                          </p>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mt-1">
                            {notif.timestamp || 'Just now'}
                          </p>
                        </div>
                        {!notif.is_read && (
                          <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Dark / Light Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full text-slate-500 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-amber-300 transition-all cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 rotate-0 transition-transform duration-300" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600 hover:text-indigo-600 transition-transform duration-300" />
          )}
        </button>

        {/* User Avatar Circle Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-slate-900 dark:from-indigo-500 dark:to-purple-700 text-white font-extrabold text-xs flex items-center justify-center shadow-xs cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all"
          >
            {initials}
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-[#111827] rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-50">
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 mb-1">
                <p className="text-xs font-extrabold text-slate-900 dark:text-white">{user?.full_name || 'User'}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email || ''}</p>
              </div>
              <button
                onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
              >
                <UserIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Account Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-2xl transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

