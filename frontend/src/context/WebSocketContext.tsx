import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';

export interface RealtimeNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  eventType: string;
  data?: any;
}

interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: any;
  notifications: RealtimeNotification[];
  lastEventTimestamp: number;
  activeToast: RealtimeNotification | null;
  clearNotifications: () => void;
  showToast: (toast: RealtimeNotification) => void;
  dismissToast: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [lastEventTimestamp, setLastEventTimestamp] = useState<number>(Date.now());
  const [activeToast, setActiveToast] = useState<RealtimeNotification | null>(null);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef<number>(1000);
  const socketRef = useRef<WebSocket | null>(null);

  const showToast = (toast: RealtimeNotification) => {
    setActiveToast(toast);
  };

  const dismissToast = () => {
    setActiveToast(null);
  };

  // Check for any recent unread high-priority notification upon login / mount
  useEffect(() => {
    if (!user) return;

    const checkRecentUnread = async () => {
      try {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        if (!token) return;
        const res = await fetch('/api/v1/notifications/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const json = await res.json();
        const unread = (json.notifications || []).filter((n: any) => !n.is_read);
        if (unread.length > 0) {
          if (user.role === 'candidate') {
            const highPriority = unread.find((n: any) => 
              n.notification_type === 'shortlisted' || 
              n.notification_type === 'assessment_scheduled' ||
              n.notification_type === 'interview_scheduled' ||
              n.notification_type === 'offer_sent'
            );

            if (highPriority) {
              const dismissedKey = `toast_seen_${highPriority.id}`;
              if (!sessionStorage.getItem(dismissedKey)) {
                sessionStorage.setItem(dismissedKey, 'true');
                setActiveToast({
                  id: highPriority.id,
                  title: highPriority.title,
                  message: highPriority.message,
                  timestamp: highPriority.timestamp || 'Just now',
                  eventType: highPriority.notification_type?.toUpperCase() || 'NOTIFICATION',
                  data: highPriority
                });
              }
            }
          } else if (user.role === 'recruiter') {
            const highPriority = unread.find((n: any) => 
              n.notification_type === 'new_application' || 
              n.notification_type === 'offer_response' ||
              n.notification_type === 'interview_completed'
            );

            if (highPriority) {
              const dismissedKey = `toast_seen_${highPriority.id}`;
              if (!sessionStorage.getItem(dismissedKey)) {
                sessionStorage.setItem(dismissedKey, 'true');
                setActiveToast({
                  id: highPriority.id,
                  title: highPriority.title,
                  message: highPriority.message,
                  timestamp: highPriority.timestamp || 'Just now',
                  eventType: highPriority.notification_type?.toUpperCase() || 'NOTIFICATION',
                  data: highPriority
                });
              }
            }
          }
        }
      } catch (err) {
        // silent
      }
    };

    const timer = setTimeout(checkRecentUnread, 1500);
    return () => clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    let isMounted = true;

    const connectWebSocket = () => {
      const token = localStorage.getItem('access_token') || localStorage.getItem('token') || '';
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      let wsHost = window.location.host;
      if (window.location.port === '3001') {
        wsHost = `${window.location.hostname}:8000`;
      }
      const wsUrl = `${protocol}//${wsHost}/ws/${user.id}?token=${encodeURIComponent(token)}`;

      try {
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
          reconnectDelayRef.current = 1000;
        };

        socket.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            setLastMessage(data);
            setLastEventTimestamp(Date.now());

            try {
              window.dispatchEvent(new CustomEvent('smarthire:realtime-event', { detail: data }));
            } catch (e) {}

            const evtName = data.event || data.event_type;
            const notifData = data.data || data.metadata || {};

            let newNotif: RealtimeNotification | null = null;

            if (evtName === 'CANDIDATE_SHORTLISTED' || evtName === 'RESUME_SHORTLISTED') {
              newNotif = {
                id: Date.now().toString(),
                title: '🎉 Resume Shortlisted!',
                message: `Congratulations! Your profile has been shortlisted for ${notifData.job_title || 'the position'}${notifData.ats_score ? ` (ATS Match: ${notifData.ats_score}%)` : ''}.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                eventType: evtName,
                data: notifData
              };
            } else if (evtName === 'ASSESSMENT_SCHEDULED') {
              newNotif = {
                id: Date.now().toString(),
                title: '⚡ Online Assessment Scheduled!',
                message: `Recruiter scheduled an Online Skills Assessment for ${notifData.job_title || 'your application'} (Passing Cutoff: ${notifData.passing_score || 50}%).`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                eventType: evtName,
                data: notifData
              };
            } else if (evtName === 'INTERVIEW_SCHEDULED') {
              newNotif = {
                id: Date.now().toString(),
                title: `Interview Scheduled (${notifData.round_type || 'Interview'})`,
                message: `Recruiter scheduled your interview for ${notifData.scheduled_date ? new Date(notifData.scheduled_date).toLocaleString() : 'the upcoming date'}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                eventType: evtName,
                data: notifData
              };
            } else if (evtName === 'INTERVIEW_RESCHEDULED') {
              newNotif = {
                id: Date.now().toString(),
                title: 'Interview Rescheduled',
                message: `Your interview has been rescheduled to ${notifData.scheduled_date ? new Date(notifData.scheduled_date).toLocaleString() : 'a new time'}.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                eventType: evtName,
                data: notifData
              };
            } else if (evtName === 'OFFER_ISSUED' || evtName === 'OFFER_SENT') {
              newNotif = {
                id: Date.now().toString(),
                title: 'Official Offer Letter Received!',
                message: `You received an official offer letter for ${notifData.job_title || 'Position'}!`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                eventType: evtName,
                data: notifData
              };
            } else if (evtName === 'OFFER_RESPONSE' || evtName === 'OFFER_ACCEPTED' || evtName === 'OFFER_REJECTED') {
              const statusText = notifData.status || (evtName === 'OFFER_ACCEPTED' ? 'Accepted' : 'Declined');
              newNotif = {
                id: Date.now().toString(),
                title: `Offer ${statusText}`,
                message: `${notifData.candidate_name || 'Candidate'} has ${statusText.toLowerCase()} the offer for ${notifData.job_title || 'the role'}.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                eventType: evtName,
                data: notifData
              };
            } else if (evtName === 'STATUS_CHANGED' || evtName === 'APPLICATION_STATUS_UPDATED') {
              newNotif = {
                id: Date.now().toString(),
                title: 'Application Status Updated',
                message: `Your application status has been moved to: ${notifData.status || notifData.new_status || 'Next Stage'}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                eventType: evtName,
                data: notifData
              };
            } else if (evtName === 'NEW_APPLICATION_RECEIVED' || evtName === 'APPLICATION_SUBMITTED') {
              newNotif = {
                id: Date.now().toString(),
                title: 'New Application Received',
                message: `${notifData.candidate_name || 'A candidate'} applied for ${notifData.job_title || 'Position'}.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                eventType: evtName,
                data: notifData
              };
            } else if (evtName === 'NEW_JOB_POSTED' || evtName === 'JOB_POSTED') {
              newNotif = {
                id: Date.now().toString(),
                title: 'New Job Opportunity Available',
                message: `${notifData.company_name || 'Employer'} posted a new requisition: ${notifData.title || 'Role'}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                eventType: evtName,
                data: notifData
              };
            } else if (evtName === 'REPORT_GENERATED' || evtName === 'INTERVIEW_COMPLETED') {
              newNotif = {
                id: Date.now().toString(),
                title: 'AI Evaluation Report Ready',
                message: 'Comprehensive AI interview analysis and behavioral telemetry report is now available.',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                eventType: evtName,
                data: notifData
              };
            }

            if (newNotif) {
              setNotifications((prev) => [newNotif!, ...prev.slice(0, 49)]);
              
              // Automatically trigger real-time toast pop-up for high-value actions
              // MANDATORY for Candidate Dashboard; suppressed for Recruiter Dashboard on candidate-directed actions
              if (user?.role === 'candidate') {
                if ([
                  'CANDIDATE_SHORTLISTED', 'RESUME_SHORTLISTED',
                  'ASSESSMENT_SCHEDULED', 'INTERVIEW_SCHEDULED',
                  'INTERVIEW_RESCHEDULED', 'OFFER_ISSUED', 'OFFER_SENT',
                  'STATUS_CHANGED', 'APPLICATION_STATUS_UPDATED'
                ].includes(evtName)) {
                  setActiveToast(newNotif);
                }
              } else if (user?.role === 'recruiter') {
                if ([
                  'NEW_APPLICATION_RECEIVED', 'APPLICATION_SUBMITTED',
                  'OFFER_RESPONSE', 'OFFER_ACCEPTED', 'OFFER_REJECTED',
                  'INTERVIEW_COMPLETED', 'ASSESSMENT_COMPLETED'
                ].includes(evtName)) {
                  setActiveToast(newNotif);
                }
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        };

        socket.onclose = (event) => {
          if (!isMounted) return;
          setIsConnected(false);

          if (event.code !== 1000 && event.code !== 4001 && event.code !== 4003) {
            const delay = reconnectDelayRef.current;
            reconnectDelayRef.current = Math.min(delay * 2, 30000);
            reconnectTimeoutRef.current = setTimeout(() => {
              if (isMounted) connectWebSocket();
            }, delay);
          }
        };

        socket.onerror = () => {
          if (!isMounted) return;
          setIsConnected(false);
        };
      } catch (e) {
        setIsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close(1000, 'User logged out or unmounted');
        socketRef.current = null;
      }
    };
  }, [user]);

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <WebSocketContext.Provider value={{
      isConnected,
      lastMessage,
      notifications,
      lastEventTimestamp,
      activeToast,
      clearNotifications,
      showToast,
      dismissToast
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket must be used within WebSocketProvider');
  return context;
};
