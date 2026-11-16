import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, getStoredToken, getWsUrl, setStoredToken } from '../lib/api';
import { getOrCreateDeviceUuid } from '../lib/device';
import { supabase } from '../lib/supabase';
import type { User } from '../types';

interface AuthPayload {
  email: string;
  password: string;
  displayName?: string;
  gender?: 'female' | 'male';
  referralCode?: string;
  mode: 'login' | 'register';
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  deviceUuid: string;
  loginOrRegister: (payload: AuthPayload) => Promise<{ user: User; redirectTo: string }>;
  refreshUser: () => Promise<void>;
  updateLocalUser: (user: User) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceUuid] = useState(() => getOrCreateDeviceUuid());

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch<{ user: User }>('/api/auth/me');
      setUser(data.user);
    } catch {
      setStoredToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (!user?.id) return;
    const ws = new WebSocket(getWsUrl());
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'user:auth', userId: user.id }));
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as { event: string; payload: User };
        if (msg.event === 'wallet:updated' && msg.payload?.id === user.id) {
          setUser(msg.payload);
        }
      } catch {
        // ignore
      }
    };

    const sbChannel = supabase
      .channel(`sada-user-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sada_users',
          filter: `id=eq.${user.id}`,
        },
        () => {
          void refreshUser();
        }
      )
      .subscribe();

    return () => {
      ws.close();
      void supabase.removeChannel(sbChannel);
    };
  }, [user?.id, refreshUser]);

  const loginOrRegister = useCallback(
    async (payload: AuthPayload) => {
      const data = await apiFetch<{ token: string; user: User; redirectTo: string }>(
        '/api/auth/login-or-register',
        {
          method: 'POST',
          body: JSON.stringify({
            ...payload,
            device_uuid: deviceUuid,
          }),
        }
      );
      setStoredToken(data.token);
      setUser(data.user);
      return { user: data.user, redirectTo: data.redirectTo };
    },
    [deviceUuid]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network error on logout
    }
    setStoredToken(null);
    setUser(null);
  }, []);

  const updateLocalUser = useCallback((next: User) => {
    setUser(next);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        deviceUuid,
        loginOrRegister,
        refreshUser,
        updateLocalUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
