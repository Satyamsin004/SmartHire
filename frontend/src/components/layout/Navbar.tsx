import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Moon, User as UserIcon, LogOut, CheckCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
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
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 px-8 py-3 flex items-center justify-between shadow-xs">
      {/* Workspace Category & Greeting */}
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 leading-none">
          {userRole === 'recruiter' ? 'RECRUITER WORKSPACE' : userRole === 'admin' ? 'ADMIN WORKSPACE' : 'CANDIDATE WORKSPACE'}
        </p>
        <h2 className="text-base font-extrabold text-slate-800 tracking-tight mt-0.5">
          Welcome back, {firstName}
        </h2>
      </div>

      {/* Action Tools & Profile Circle */}
      <div className="flex items-center gap-4">
        {/* Search Bar */}
        <div className="relative w-64 md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search jobs, applications, skills..."
            className="w-full bg-slate-100/80 border border-transparent hover:border-slate-200 focus:bg-white focus:border-indigo-400 rounded-full pl-10 pr-4 py-1.5 text-xs font-medium text-slate-700 focus:outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Notifications Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false); }}
            className="p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-[9px] font-bold text-white flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-xl border border-slate-200 z-50 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-900">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    <CheckCheck className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-400">No notifications yet</p>
                  </div>
                ) : (
                  notifications.slice(0, 15).map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => { if (!notif.is_read) handleMarkRead(notif.id); }}
                      className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                        !notif.is_read ? 'bg-indigo-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-base mt-0.5">{getNotifIcon(notif.notification_type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-bold truncate ${!notif.is_read ? 'text-slate-900' : 'text-slate-600'}`}>
                            {notif.title}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium line-clamp-2 mt-0.5">
                            {notif.message}
                          </p>
                          <p className="text-[9px] text-slate-300 font-semibold mt-1">
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

        {/* Dark Mode Moon Toggle */}
        <button className="p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors">
          <Moon className="w-4 h-4" />
        </button>

        {/* User Avatar Circle Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }}
            className="w-8 h-8 rounded-full bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center shadow-xs cursor-pointer hover:bg-indigo-900 transition-colors"
          >
            {initials}
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-3 w-56 bg-white rounded-3xl shadow-xl border border-slate-200 p-2 z-50">
              <div className="p-3 border-b border-slate-100 mb-1">
                <p className="text-xs font-extrabold text-slate-900">{user?.full_name || 'User'}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email || ''}</p>
              </div>
              <button
                onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-2xl transition-colors"
              >
                <UserIcon className="w-4 h-4 text-indigo-600" />
                Account Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-2xl transition-colors"
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
