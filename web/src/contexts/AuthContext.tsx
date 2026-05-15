'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { API, User } from '@/lib/api';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('cardscanner_token');
    if (!stored) {
      setIsLoading(false);
      return;
    }
    API.setToken(stored);
    setToken(stored);

    API.getMe()
      .then(({ user }) => {
        setUser(user);
      })
      .catch(() => {
        API.setToken(null);
        setToken(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token: t, user: u } = await API.login(email, password);
    setToken(t);
    setUser(u);
  }, []);

  const signup = useCallback(
    async (email: string, username: string, password: string) => {
      const { token: t, user: u } = await API.signup(email, username, password);
      setToken(t);
      setUser(u);
    },
    []
  );

  const logout = useCallback(() => {
    API.setToken(null);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
