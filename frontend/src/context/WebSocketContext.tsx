import React, { createContext, useContext, useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/${user.id}`;

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          if (data.event === 'INTERVIEW_SCHEDULED') {
            const notif = {
              id: Date.now().toString(),
              title: `Interview Scheduled (${data.data.round_type})`,
              message: `Recruiter scheduled your interview for ${new Date(data.data.scheduled_date).toLocaleString()}`,
              timestamp: new Date().toLocaleTimeString()
            };
            setNotifications((prev) => [notif, ...prev]);
          }
        } catch (e) {
          // Silent message parse error handling
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
      };
    } catch (e) {
      // Silent connection error handling
    }

    return () => {
      if (socket) socket.close();
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

