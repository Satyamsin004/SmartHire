import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Moon, Sun, User as UserIcon, LogOut, CheckCheck, X, Sparkles, BarChart3, Camera } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useWebSocket } from '../../context/WebSocketContext';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { lastMessage } = useWebSocket();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('candidate');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);

  useEffect(() => {
    const loadUserData = () => {
      const raw = localStorage.getItem('user_data') || localStorage.getItem('user');
      if (raw) {
        try {
          const parsedUser = JSON.parse(raw);
          setUser(parsedUser);
          setUserRole(parsedUser.role || 'candidate');
          setAvatarImgError(false);
        } catch (e) {
          console.error(e);
        }
      }
    };

    loadUserData();
    fetchNotifications();

    // Listen for cross-component avatar or profile updates
    window.addEventListener('user_profile_updated', loadUserData);
    window.addEventListener('storage', loadUserData);

    // Sync authoritative user profile from backend
    api.get('/users/me').then(res => {
      if (res.data) {
        const raw = localStorage.getItem('user_data') || localStorage.getItem('user');
        const curr = raw ? JSON.parse(raw) : {};
        const fresh = {
          ...curr,
          ...res.data,
          profile_image: res.data.profile_image || res.data.avatar_url || curr.profile_image,
          avatar_url: res.data.profile_image || res.data.avatar_url || curr.avatar_url
        };
        setUser(fresh);
        localStorage.setItem('user_data', JSON.stringify(fresh));
        localStorage.setItem('user', JSON.stringify(fresh));
        setAvatarImgError(false);
      }
    }).catch(() => {});

    return () => {
      window.removeEventListener('user_profile_updated', loadUserData);
      window.removeEventListener('storage', loadUserData);
    };
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/uploads/avatar', formData);
      const newUrl = res.data?.profile_image || res.data?.avatar_url || res.data?.url;
      if (newUrl) {
        setAvatarImgError(false);
        const updated = {
          ...user,
          profile_image: newUrl,
          avatar_url: newUrl
        };
        setUser(updated);
        localStorage.setItem('user_data', JSON.stringify(updated));
        localStorage.setItem('user', JSON.stringify(updated));
        window.dispatchEvent(new Event('user_profile_updated'));
      }
    } catch (err) {
      console.warn('Avatar upload error:', err);
    } finally {
      setUploadingAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  const avatarUrl = !avatarImgError ? (user?.profile_image || user?.avatar_url || null) : null;

  // Re-fetch notifications in real-time when WebSocket message arrives
  useEffect(() => {
    if (lastMessage) {
      fetchNotifications();
    }
  }, [lastMessage]);

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

  const handleNotificationClick = (notif: any) => {
    if (!notif.is_read) {
      handleMarkRead(notif.id);
    }
    setShowNotifications(false);
    if (notif.link) {
      navigate(notif.link);
      return;
    }
    if (notif.notification_type === 'interview_completed' || notif.notification_type === 'interview_evaluation_ready') {
      if (notif.interview_id) {
        navigate(`/report/${notif.interview_id}`);
      } else {
        navigate('/reports');
      }
    } else if (
      notif.notification_type === 'interview_scheduled' ||
      notif.notification_type === 'interview_reminder' ||
      notif.notification_type === 'interview_rescheduled'
    ) {
      if (notif.interview_id) {
        navigate(`/interview-lobby?schedule_id=${notif.interview_id}`);
      } else {
        navigate(userRole === 'recruiter' ? '/recruiter-scheduling' : '/interview/config');
      }
    } else if (notif.notification_type === 'assessment_scheduled') {
      navigate('/assessment-lobby');
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'application_status_update': return '📋';
      case 'interview_scheduled': return '🎯';
      case 'interview_rescheduled': return '🔄';
      case 'interview_cancelled': return '❌';
      case 'interview_reminder': return '⏰';
      case 'interview_completed': return '📊';
      case 'interview_evaluation_ready': return '🏆';
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
      <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4">
        {/* Progress & Reports Dedicated Navigation Button (Candidates & Recruiters only) */}
        {userRole !== 'admin' && (
          <button
            onClick={() => navigate(userRole === 'recruiter' ? '/recruiter/reports' : '/reports')}
            id="navbar-reports-btn"
            className={`flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border shadow-xs cursor-pointer ${
              location.pathname === '/reports' || location.pathname === '/recruiter/reports' || location.pathname.startsWith('/report')
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/20'
                : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30'
            }`}
            title="Progress & Reports Dashboard"
          >
            <BarChart3 className={`w-3.5 h-3.5 shrink-0 ${
              location.pathname === '/reports' || location.pathname === '/recruiter/reports' || location.pathname.startsWith('/report')
                ? 'text-white'
                : 'text-indigo-600 dark:text-indigo-400'
            }`} />
            <span className="hidden md:inline font-black tracking-tight">Reports & Analytics</span>
            <span className="inline md:hidden text-[11px] font-black">Reports</span>
          </button>
        )}

        {/* Search Bar */}
        <div className="relative w-40 md:w-64 hidden lg:block">
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
                      onClick={() => handleNotificationClick(notif)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
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
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarUpload}
          />

          <button
            onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-slate-900 dark:from-indigo-500 dark:to-purple-700 text-white font-extrabold text-xs flex items-center justify-center shadow-xs cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all overflow-hidden"
            title={user?.full_name || 'User Profile'}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user?.full_name || 'User'}
                className="w-full h-full object-cover rounded-full"
                onError={() => setAvatarImgError(true)}
              />
            ) : (
              initials
            )}
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-3 w-60 bg-white dark:bg-[#111827] rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-50">
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center gap-3">
                <div
                  className="relative group/avatar cursor-pointer shrink-0"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Click to upload profile picture"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-slate-900 dark:from-indigo-500 dark:to-purple-700 text-white font-extrabold text-xs flex items-center justify-center shadow-xs overflow-hidden border border-indigo-500/30">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={user?.full_name || 'User'}
                        className="w-full h-full object-cover"
                        onError={() => setAvatarImgError(true)}
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">{user?.full_name || 'User'}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user?.email || ''}</p>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline mt-0.5 flex items-center gap-1"
                  >
                    <Camera className="w-3 h-3" />
                    <span>{uploadingAvatar ? 'Uploading...' : 'Change Photo'}</span>
                  </button>
                </div>
              </div>
              {userRole !== 'admin' ? (
                <button
                  onClick={() => { setShowProfileMenu(false); navigate(userRole === 'recruiter' ? '/recruiter/reports' : '/reports'); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Reports & Analytics
                </button>
              ) : (
                <button
                  onClick={() => { setShowProfileMenu(false); navigate('/admin?tab=interviews'); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Interview Audits
                </button>
              )}
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

