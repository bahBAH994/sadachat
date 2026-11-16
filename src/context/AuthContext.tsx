import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getOrCreateDeviceUuid } from '../lib/device';
import {
  fetchCurrentUserFromSupabaseSession,
  loginOrRegisterWithSupabase,
  logoutFromSupabase,
} from '../lib/sadaAuth';
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
    try {
      const profile = await fetchCurrentUserFromSupabaseSession(deviceUuid);
      setUser(profile);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [deviceUuid]);

  useEffect(() => {
    void refreshUser();

    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void refreshUser();
      }
    });

    return () => {
      authSub.subscription.unsubscribe();
    };
  }, [refreshUser]);

  useEffect(() => {
    if (!user?.id) return;

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
      void supabase.removeChannel(sbChannel);
    };
  }, [user?.id, refreshUser]);

  const loginOrRegister = useCallback(
    async (payload: AuthPayload) => {
      const result = await loginOrRegisterWithSupabase({
        ...payload,
        deviceUuid,
      });
      setUser(result.user);
      return result;
    },
    [deviceUuid]
  );

  const logout = useCallback(async () => {
    try {
      await logoutFromSupabase();
    } catch {
      // ignore
    }
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
