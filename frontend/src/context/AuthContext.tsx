import React, { createContext, useContext, useState } from 'react';
import { User, RoleType } from '../types';
import api from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password?: string, role?: RoleType) => Promise<void>;
  googleLogin: () => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user_data') || localStorage.getItem('user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('access_token') || localStorage.getItem('token') || null;
  });

  // Set the auth header on initial load if we have a token
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  const login = async (email: string, password?: string, role: RoleType = 'candidate') => {
    const pwd = password || 'Password123!';
    const res = await api.post('/auth/login', { email, password: pwd, role });
    const { user: userData, tokens } = res.data;
    const accessToken = tokens?.access_token || res.data.access_token;
    const refreshToken = tokens?.refresh_token || res.data.refresh_token;
    
    setToken(accessToken);
    setUser(userData);

    // Store under all keys for full consistency
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('user_data', JSON.stringify(userData));
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', accessToken);
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    }

    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  };

  const googleLogin = async () => {
    const res = await api.post('/auth/google', {
      email: 'google_user@smarthire.ai',
      full_name: 'Google Authenticated User',
      role: 'candidate'
    });
    const { user: userData, tokens } = res.data;
    const accessToken = tokens?.access_token || res.data.access_token;
    const refreshToken = tokens?.refresh_token || res.data.refresh_token;
    
    setToken(accessToken);
    setUser(userData);

    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('user_data', JSON.stringify(userData));
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', accessToken);
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    }

    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  };

  const logout = () => {
    if (token) {
      api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, login, googleLogin, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
