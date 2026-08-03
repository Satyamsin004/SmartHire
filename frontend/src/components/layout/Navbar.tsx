import React, { useState, useEffect } from 'react';
import { Search, Bell, Sparkles, User as UserIcon, LogOut, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    let parsedUser: any = null;
    const raw = localStorage.getItem('user_data') || localStorage.getItem('user');
    if (raw) {
      try {
        parsedUser = JSON.parse(raw);
        setUser(parsedUser);
      } catch (e) {
        console.error(e);
      }
    }

    const fetchNotifs = () => {
      api.get('/notifications')
        .then((res) => setNotifications(res.data || []))
        .catch((err) => console.warn('Fetch notifications error:', err));
    };

    fetchNotifs();

    // Real-Time WebSocket Connection
    if (parsedUser && parsedUser.id) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/v1/ws/${parsedUser.id}`;
      
      let ws: WebSocket | null = null;
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && data.event) {
              fetchNotifs();
            }
          } catch (e) {
            console.error('WS Message error:', e);
          }
        };
      } catch (err) {
        console.warn('WS Connection skipped in dev mode:', err);
      }

      return () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    }
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    delete api.defaults.headers.common['Authorization'];
    window.location.href = '/login';
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-stoneBorder/80 px-6 py-3.5 flex items-center justify-between shadow-soft">
      {/* Search Input Bar */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search candidates, mock interviews, jobs..."
            className="w-full bg-cream-200/80 border border-stoneBorder rounded-2xl pl-10 pr-12 py-2 text-xs font-semibold text-brand-ink focus:outline-none focus:border-brand-secondary transition-all placeholder:text-slate-400"
          />
          <kbd className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-bold text-slate-400 bg-white rounded-lg border border-stoneBorder">
            Ctrl K
          </kbd>
        </div>
      </div>

      {/* Action Indicators & User Avatar */}
      <div className="flex items-center gap-4">
        {/* Gemini AI Status Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-brand-accent/40 border border-brand-accent text-brand-primary text-xs font-extrabold">
          <Sparkles className="w-3.5 h-3.5 text-brand-secondary animate-pulse" />
          <span>AI Engine Connected</span>
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2.5 rounded-2xl hover:bg-cream-200 transition-colors text-brand-ink"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-emerald-500 text-white font-extrabold text-[9px] flex items-center justify-center rounded-full border-2 border-white">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-floating border border-stoneBorder p-4 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-3 border-b border-stoneBorder mb-3">
                <h4 className="text-xs font-bold text-brand-ink">Notifications</h4>
                <span className="text-[10px] font-extrabold text-brand-secondary">{unreadCount} Unread</span>
              </div>
              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No recent notifications</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="p-2.5 rounded-2xl bg-cream-100 hover:bg-cream-200 transition-colors flex gap-2.5 items-start">
                      <CheckCircle2 className="w-4 h-4 text-brand-secondary shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-xs font-bold text-brand-ink">{n.title}</h5>
                        <p className="text-[11px] text-slate-500 line-clamp-2">{n.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-3 p-1.5 rounded-2xl hover:bg-cream-200 transition-colors border border-stoneBorder/60 bg-cream-100"
          >
            <div className="w-8 h-8 rounded-xl bg-brand-primary text-brand-bg flex items-center justify-center font-extrabold text-xs shadow-sm">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="hidden sm:block text-left pr-2">
              <h4 className="text-xs font-extrabold text-brand-ink line-clamp-1">{user?.full_name || 'Guest User'}</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{user?.role || 'Candidate'}</p>
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-3 w-56 bg-white rounded-3xl shadow-floating border border-stoneBorder p-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="p-3 border-b border-stoneBorder mb-1">
                <p className="text-xs font-extrabold text-brand-ink">{user?.full_name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-brand-ink hover:bg-cream-200 rounded-2xl transition-colors"
              >
                <UserIcon className="w-4 h-4 text-brand-secondary" />
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
