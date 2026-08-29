import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: any;
  notifications: any[];
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef<number>(1000);
  const socketRef = useRef<WebSocket | null>(null);

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
      const token = localStorage.getItem('token') || '';
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/${user.id}?token=${encodeURIComponent(token)}`;

      try {
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
          reconnectDelayRef.current = 1000; // Reset backoff delay
        };

        socket.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            setLastMessage(data);

            const evtName = data.event || data.event_type;
            if (evtName === 'INTERVIEW_SCHEDULED') {
              const notifData = data.data || data.metadata || {};
              const notif = {
                id: Date.now().toString(),
                title: `Interview Scheduled (${notifData.round_type || 'Interview'})`,
                message: `Recruiter scheduled your interview for ${notifData.scheduled_date ? new Date(notifData.scheduled_date).toLocaleString() : 'soon'}`,
                timestamp: new Date().toLocaleTimeString()
              };
              setNotifications((prev) => [notif, ...prev]);
            } else if (evtName === 'OFFER_ISSUED' || evtName === 'OFFER_SENT') {
              const notifData = data.data || data.metadata || {};
              const notif = {
                id: Date.now().toString(),
                title: 'Official Offer Letter Received!',
                message: `You received an offer letter for ${notifData.job_title || 'Position'}`,
                timestamp: new Date().toLocaleTimeString()
              };
              setNotifications((prev) => [notif, ...prev]);
            }
          } catch (e) {
            // Ignore parse errors
          }
        };

        socket.onclose = (event) => {
          if (!isMounted) return;
          setIsConnected(false);

          // Exponential backoff reconnect if closed unexpectedly
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

  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage, notifications }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket must be used within WebSocketProvider');
  return context;
};
