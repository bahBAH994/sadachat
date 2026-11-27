import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getOrCreateDeviceUuid } from '../lib/device';
import {
  fetchCurrentUserFromSupabaseSession,
  loginOrRegisterWithSupabase,
  logoutFromSupabase,
} from '../lib/sadaAuth';
import { supabase } from '../lib/supabase';
import type { User } from '../types';

const BOOT_SAFETY_TIMEOUT_MS = 2500;

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

function areUsersEqualMeaningfully(a: User | null, b: User | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.email === b.email &&
    a.displayName === b.displayName &&
    a.bio === b.bio &&
    a.avatarUrl === b.avatarUrl &&
    a.gender === b.gender &&
    a.femaleVoiceStatus === b.femaleVoiceStatus &&
    a.femaleVerified === b.femaleVerified &&
    a.femaleVerifiedBadge === b.femaleVerifiedBadge &&
    a.isHost === b.isHost &&
    a.isAgent === b.isAgent &&
    a.agencyId === b.agencyId &&
    a.hostBadge === b.hostBadge &&
    a.coins === b.coins &&
    a.diamonds === b.diamonds &&
    a.level === b.level &&
    a.xp === b.xp &&
    a.role === b.role &&
    a.is_admin === b.is_admin &&
    a.is_banned === b.is_banned &&
    a.frameId === b.frameId &&
    a.tempFrameId === b.tempFrameId &&
    a.tempFrameExpiresAt === b.tempFrameExpiresAt &&
    a.activeEntryId === b.activeEntryId &&
    a.tempEntryExpiresAt === b.tempEntryExpiresAt &&
    a.vipLevel === b.vipLevel &&
    (a.unlockedFrames?.length || 0) === (b.unlockedFrames?.length || 0)
  );
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceUuid] = useState(() => getOrCreateDeviceUuid());
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  const userRef = useRef<User | null>(user);
  userRef.current = user;

  const inFlightRefreshRef = useRef<Promise<void> | null>(null);
  const lastRefreshAtRef = useRef<number>(0);
  const skipNextAuthEventRef = useRef<boolean>(false);

  const commitUserSilently = useCallback((next: User | null) => {
    setUser((prev) => (areUsersEqualMeaningfully(prev, next) ? prev : next));
  }, []);

  const refreshUser = useCallback(
    async (options?: { force?: boolean }) => {
      const now = Date.now();
      if (!options?.force && inFlightRefreshRef.current) {
        return inFlightRefreshRef.current;
      }
      if (!options?.force && now - lastRefreshAtRef.current < 1000 && userRef.current) {
        return;
      }

      const task = (async () => {
        try {
          lastRefreshAtRef.current = Date.now();
          const profile = await fetchCurrentUserFromSupabaseSession(deviceUuid);
          commitUserSilently(profile);
        } catch {
          // Keep current user if cached & only clear if no active session and no error recovery
          if (!userRef.current) {
            commitUserSilently(null);
          }
        } finally {
          setLoading(false);
          inFlightRefreshRef.current = null;
        }
      })();

      inFlightRefreshRef.current = task;
      return task;
    },
    [commitUserSilently, deviceUuid]
  );

  useEffect(() => {
    let active = true;

    // Mandatory 2.5s safety timeout so splash/loading screen never freezes on slow phones
    const bootTimer = window.setTimeout(() => {
      if (active) {
        setLoading(false);
      }
    }, BOOT_SAFETY_TIMEOUT_MS);

    void refreshUser({ force: true }).finally(() => {
      if (active) {
        window.clearTimeout(bootTimer);
        setLoading(false);
      }
    });

    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        commitUserSilently(null);
        setLoading(false);
      } else if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        if (event === 'SIGNED_IN' && skipNextAuthEventRef.current) {
          skipNextAuthEventRef.current = false;
          return;
        }
        // Background silent sync — never sets loading=true
        void refreshUser();
      }
    });

    return () => {
      active = false;
      window.clearTimeout(bootTimer);
      authSub.subscription.unsubscribe();
    };
  }, [commitUserSilently, refreshUser]);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;

    const sbChannel = supabase
      .channel(`sada-user-${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sada_users',
          filter: `id=eq.${uid}`,
        },
        (payload) => {
          // Ignore heartbeat-only last_seen updates to prevent infinite/cascading re-renders
          const newRow = payload.new as Record<string, unknown> | undefined;
          const oldRow = payload.old as Record<string, unknown> | undefined;
          if (newRow && oldRow && Object.keys(oldRow).length > 0) {
            const changedKeys = Object.keys(newRow).filter(
              (k) => JSON.stringify(newRow[k]) !== JSON.stringify(oldRow[k])
            );
            if (changedKeys.length === 0 || (changedKeys.length === 1 && changedKeys[0] === 'last_seen')) {
              return;
            }
          }
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
    const uid = user?.id;
    const gender = user?.gender || 'male';
    if (!uid) {
      setOnlineUserIds([]);
      return;
    }

    const onlineChannelRef: {
      current: ReturnType<typeof supabase.channel> | null;
    } = { current: null };

    try {
      onlineChannelRef.current = supabase.channel('sada-global-online', {
        config: { presence: { key: uid } },
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
        const nextIds = Array.from(ids).sort();
        setOnlineUserIds((prev) => {
          if (prev.length === nextIds.length && prev.every((v, idx) => v === nextIds[idx])) {
            return prev;
          }
          return nextIds;
        });
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
                  userId: uid,
                  gender,
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
        .eq('id', uid);
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
      skipNextAuthEventRef.current = true;
      try {
        const result = await loginOrRegisterWithSupabase({
          ...payload,
          deviceUuid,
        });
        commitUserSilently(result.user);
        setLoading(false);
        return result;
      } catch (err) {
        skipNextAuthEventRef.current = false;
        throw err;
      }
    },
    [commitUserSilently, deviceUuid]
  );

  const logout = useCallback(async () => {
    try {
      await logoutFromSupabase();
    } catch {
      // ignore
    }
    commitUserSilently(null);
    setOnlineUserIds([]);
    setLoading(false);
  }, [commitUserSilently]);

  const updateLocalUser = useCallback(
    (next: User) => {
      commitUserSilently(next);
    },
    [commitUserSilently]
  );

  const refreshUserPublic = useCallback(async () => {
    await refreshUser({ force: true });
  }, [refreshUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      deviceUuid,
      onlineUserIds,
      loginOrRegister,
      refreshUser: refreshUserPublic,
      updateLocalUser,
      logout,
    }),
    [
      user,
      loading,
      deviceUuid,
      onlineUserIds,
      loginOrRegister,
      refreshUserPublic,
      updateLocalUser,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
