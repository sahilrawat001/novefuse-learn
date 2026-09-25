import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch, setAuthToken } from '../api/apiClient';

export interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const checkAuth = async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(errData.error || 'Login failed');
    }
    const data = await res.json();
    if (data.token) {
      setAuthToken(data.token);
    }
    setUser(data.user);
  };

  const signup = async (email: string, password: string, name?: string) => {
    const res = await apiFetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Signup failed' }));
      throw new Error(errData.error || 'Signup failed');
    }
    const data = await res.json();
    if (data.token) {
      setAuthToken(data.token);
    }
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setAuthToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
