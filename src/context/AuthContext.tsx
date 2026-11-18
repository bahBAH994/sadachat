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
  age?: number;
  country?: string;
  referralCode?: string;
  mode: 'login' | 'register';
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  deviceUuid: string;
  onlineUserIds: string[];
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
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

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

  // Global Supabase Realtime Online Presence + last_seen heartbeat
  useEffect(() => {
    if (!user?.id) {
      setOnlineUserIds([]);
      return;
    }

    const onlineChannelRef: {
      current: ReturnType<typeof supabase.channel> | null;
    } = { current: null };

    try {
      onlineChannelRef.current = supabase.channel('sada-global-online', {
        config: { presence: { key: user.id } },
      });
    } catch {
      onlineChannelRef.current = null;
    }

    const syncOnline = () => {
      if (!onlineChannelRef.current) return;
      try {
        const state = onlineChannelRef.current.presenceState<{ userId?: string }>();
        const ids = new Set<string>();
        Object.entries(state || {}).forEach(([key, entries]) => {
          if (key) ids.add(key);
          (entries || []).forEach((entry) => {
            if (entry?.userId) ids.add(String(entry.userId));
          });
        });
        setOnlineUserIds(Array.from(ids));
      } catch {
        // ignore transient presence errors
      }
    };

    if (onlineChannelRef.current) {
      try {
        onlineChannelRef.current
          .on('presence', { event: 'sync' }, syncOnline)
          .on('presence', { event: 'join' }, syncOnline)
          .on('presence', { event: 'leave' }, syncOnline)
          .subscribe((status) => {
            if (status === 'SUBSCRIBED' && onlineChannelRef.current) {
              try {
                void onlineChannelRef.current.track({
                  userId: user.id,
                  gender: user.gender || 'male',
                  onlineAt: Date.now(),
                });
              } catch {
                // ignore track errors
              }
            }
          });
      } catch {
        // ignore subscribe errors
      }
    }

    const updateHeartbeat = () => {
      void supabase
        .from('sada_users')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', user.id);
    };
    updateHeartbeat();
    const hbInterval = window.setInterval(updateHeartbeat, 60_000);

    return () => {
      window.clearInterval(hbInterval);
      if (onlineChannelRef.current) {
        const ch = onlineChannelRef.current;
        onlineChannelRef.current = null;
        try {
          void ch.untrack().catch(() => {});
        } catch {
          // ignore
        }
        try {
          void supabase.removeChannel(ch);
        } catch {
          // ignore
        }
      }
    };
  }, [user?.id, user?.gender]);

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
    setOnlineUserIds([]);
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
        onlineUserIds,
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
