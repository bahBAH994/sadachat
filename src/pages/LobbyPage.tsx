import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  Headphones,
  Heart,
  Lock,
  MessageCircle,
  Mic,
  Mic2,
  Plus,
  Radio,
  Search,
  Sparkles,
  Trophy,
  Unlock,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useActiveRoom } from '../context/ActiveRoomContext';
import { useMiniProfile } from '../context/MiniProfileContext';
import { resolveAsset } from '../lib/assets';
import { ARAB_COUNTRIES, formatShortNumericId, getUserVipTierInfo } from '../lib/sadaCatalog';
import { getPlatformState } from '../lib/sadaMappers';
import {
  createRoomInSupabase,
  getUserActiveRoomsInSupabase,
  isRoomAgencyOwnerOrHostFromData,
  listActiveRooms,
  verifyRoomPasswordInSupabase,
} from '../lib/sadaRoomsService';
import {
  getDiscoveryDirectoryFromSupabase,
  getFollowStatus,
  toggleFollowUserInSupabase,
} from '../lib/sadaSocialService';
import { supabase } from '../lib/supabase';
import type { Room, RoomExtrasConfig, User, VipTierKey } from '../types';
import { AvatarWithFrame, VipTierBadge, VipUserName } from '../components/AvatarWithFrame';
import { FemaleVerifiedBadge } from '../components/FemaleVoiceVerificationCard';

type FilterChip = 'الوكالات' | 'الغرف الخاصة' | 'لايف';

interface PresenceUser {
  roomId: string;
  userId: string;
  displayName: string;
  avatarUrl: string;
  frameId?: string;
  level?: number;
  vipLevel?: VipTierKey;
}

const COUNTRY_FILTERS = [
  { code: 'ALL', label: 'الكل', flag: '🌍' },
  { code: 'SY', label: 'سوريا', flag: '🇸🇾' },
  { code: 'SA', label: 'السعودية', flag: '🇸🇦' },
  { code: 'AE', label: 'الإمارات', flag: '🇦🇪' },
  { code: 'EG', label: 'مصر', flag: '🇪🇬' },
  { code: 'IQ', label: 'العراق', flag: '🇮🇶' },
  { code: 'JO', label: 'الأردن', flag: '🇯🇴' },
  { code: 'LB', label: 'لبنان', flag: '🇱🇧' },
  { code: 'KW', label: 'الكويت', flag: '🇰🇼' },
  { code: 'QA', label: 'قطر', flag: '🇶🇦' },
  { code: 'MA', label: 'المغرب', flag: '🇲🇦' },
  { code: 'TR', label: 'تركيا', flag: '🇹🇷' },
  { code: 'US', label: 'أمريكا', flag: '🇺🇸' },
  { code: 'DE', label: 'ألمانيا', flag: '🇩🇪' },
  { code: 'GB', label: 'بريطانيا', flag: '🇬🇧' },
  { code: 'FR', label: 'فرنسا', flag: '🇫🇷' },
  { code: 'CA', label: 'كندا', flag: '🇨🇦' },
  { code: 'SE', label: 'السويد', flag: '🇸🇪' },
];

const getCountryFlag = (country?: string) => {
  const normalizedCountry = country?.trim();
  return (
    COUNTRY_FILTERS.find(
      (c) =>
        c.code === normalizedCountry?.toUpperCase() || c.label === normalizedCountry
    )?.flag || '🎙️'
  );
};

const getLobbyRoomCover = (room: Room) => room.coverImage || room.hostAvatar;

interface LobbyRoomCardProps {
  room: Room;
  members: PresenceUser[];
  liveCount: number;
  hostCountryCode?: string;
  isPinned?: boolean;
  isAgencyLocked?: boolean;
  onEnter: (room: Room) => void;
  onOpenMiniProfile: (userId: string, preview?: Partial<User>) => void;
}

const LobbyRoomCard = memo<LobbyRoomCardProps>(
  ({
    room,
    members,
    liveCount,
    hostCountryCode,
    isPinned,
    isAgencyLocked = false,
    onEnter,
    onOpenMiniProfile,
  }) => {
    const flag = getCountryFlag(hostCountryCode);

    return (
      <article
        onClick={() => onEnter(room)}
        className={`light-card light-card-hover rounded-2xl p-3 flex items-center gap-3 cursor-pointer ${
          isPinned ? 'border-amber-300 bg-gradient-to-r from-amber-50/60 via-white to-white shadow-md' : ''
        }`}
      >
        <div className="relative w-24 h-24 rounded-2xl overflow-hidden shrink-0 border border-slate-200 bg-slate-900">
          <img
            src={resolveAsset(getLobbyRoomCover(room))}
            alt={room.title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute top-1.5 right-1.5 rounded-md bg-slate-950/75 px-1.5 py-0.5 text-[10px] font-bold text-[#FCE9A6]">
            {room.category}
          </div>
          {isPinned && (
            <div className="absolute bottom-1.5 right-1.5 rounded-md bg-gradient-to-r from-[#FDE047] to-[#D4AF37] px-1.5 py-0.5 text-[9px] font-black text-[#070913] shadow">
              مثبتة 📌
            </div>
          )}
          {room.hasPassword && (
            <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-slate-950/80 flex items-center justify-center text-amber-300">
              <Lock className="w-3 h-3" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{flag}</span>
            <div className="flex items-center gap-1 min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                {room.title}
              </h3>
              {isAgencyLocked && (
                <Lock
                  className="w-3.5 h-3.5 text-amber-600 shrink-0"
                  aria-label="الوكالة مقفلة برمز سري"
                />
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500 truncate">{room.description}</p>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center -space-x-1.5 space-x-reverse">
              {members.slice(0, 4).map((m) => (
                <button
                  key={m.userId}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenMiniProfile(m.userId, {
                      displayName: m.displayName,
                      avatarUrl: m.avatarUrl,
                      frameId: m.frameId,
                      level: m.level,
                      vipLevel: m.vipLevel,
                    });
                  }}
                  title={m.displayName}
                  className="hover:scale-110 transition cursor-pointer"
                >
                  <AvatarWithFrame
                    src={m.avatarUrl}
                    alt={m.displayName}
                    frameId={m.frameId}
                    vipTier={m.vipLevel || 'none'}
                    size="xs"
                  />
                </button>
              ))}
              {members.length === 0 && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Mic className="w-3 h-3 text-emerald-500" />
                  <span>متاحة للدخول</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500 text-white px-2.5 py-0.5 text-[11px] font-extrabold font-mono-num shadow-sm">
                <Headphones className="w-3 h-3" />
                <span>{liveCount}</span>
              </span>
            </div>
          </div>
        </div>
      </article>
    );
  }
);

export const LobbyPage: React.FC = () => {
  const { user, onlineUserIds } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;
  const { activeRoomId, isMinimized } = useActiveRoom();
  const { openMiniProfile } = useMiniProfile();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [exitToastVisible, setExitToastVisible] = useState(false);
  const lastBackPressRef = useRef<number>(0);
  const exitToastTimerRef = useRef<number | null>(null);
  const isFullScreenRoomRef = useRef<boolean>(false);
  const activeRoomIdRef = useRef<string | null>(activeRoomId);
  isFullScreenRoomRef.current = Boolean(activeRoomId && !isMinimized);
  activeRoomIdRef.current = activeRoomId;

  useEffect(() => {
    if (activeRoomId && !isMinimized) return;

    if (!window.history.state?.homeGuard) {
      window.history.pushState({ homeGuard: true }, '');
    }

    const handleHomePopState = () => {
      if (isFullScreenRoomRef.current) return;
      const now = Date.now();
      if (now - lastBackPressRef.current > 2000) {
        lastBackPressRef.current = now;
        setExitToastVisible(true);
        if (exitToastTimerRef.current !== null) {
          window.clearTimeout(exitToastTimerRef.current);
        }
        exitToastTimerRef.current = window.setTimeout(() => {
          setExitToastVisible(false);
        }, 2000);

        window.setTimeout(() => {
          if (!isFullScreenRoomRef.current && !window.history.state?.homeGuard) {
            window.history.pushState({ homeGuard: true }, '');
          }
        }, 0);
      } else {
        window.history.back();
      }
    };

    window.addEventListener('popstate', handleHomePopState);
    return () => {
      window.removeEventListener('popstate', handleHomePopState);
      if (exitToastTimerRef.current !== null) {
        window.clearTimeout(exitToastTimerRef.current);
      }
    };
  }, [activeRoomId, isMinimized]);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingMyRoomEntry, setPendingMyRoomEntry] = useState(false);
  const [openingMyRoom, setOpeningMyRoom] = useState(false);
  const openingMyRoomRef = useRef(false);
  const [mainTab, setMainTab] = useState<'party' | 'mine'>('party');
  const [activeChip, setActiveChip] = useState<FilterChip>('الوكالات');
  const [showMyRoomChoice, setShowMyRoomChoice] = useState(false);
  const [myRoomOptions, setMyRoomOptions] = useState<{
    personalRoom: Room;
    agencyRoom: Room;
  } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_FILTERS[0]);
  const [showCountryMenu, setShowCountryMenu] = useState(false);

  const [presenceByRoom, setPresenceByRoom] = useState<Record<string, PresenceUser[]>>({});
  const [presenceReady, setPresenceReady] = useState(false);
  const [directoryUsers, setDirectoryUsers] = useState<User[]>([]);
  const [userFollows, setUserFollows] = useState<Record<string, string[]>>({});
  const [userMeta, setUserMeta] = useState<Record<string, { age?: number; country?: string }>>({});
  const [followedAgencyRoomIds, setFollowedAgencyRoomIds] = useState<string[]>([]);
  const [agencyOwnerMap, setAgencyOwnerMap] = useState<Record<string, string>>({});
  const [roomConfigs, setRoomConfigs] = useState<Record<string, RoomExtrasConfig>>({});
  const [pinnedRoomIds, setPinnedRoomIds] = useState<string[]>([]);
  const [seatedUserIds, setSeatedUserIds] = useState<string[]>([]);
  const [togglingFollowId, setTogglingFollowId] = useState<string | null>(null);
  const publishedPresenceCountsRef = useRef<Record<string, number>>({});

  const [showCreate, setShowCreate] = useState(false);
  const [agencyToastVisible, setAgencyToastVisible] = useState(false);
  const [myRoomEntryError, setMyRoomEntryError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<Room['category']>('حوار');
  const [newDesc, setNewDesc] = useState('');
  const [newSeats, setNewSeats] = useState<number>(12);
  const [newPrivate, setNewPrivate] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [passwordPromptRoom, setPasswordPromptRoom] = useState<Room | null>(null);
  const [roomPasswordInput, setRoomPasswordInput] = useState('');
  const [roomPasswordError, setRoomPasswordError] = useState<string | null>(null);
  const [passwordPromptType, setPasswordPromptType] = useState<'room' | 'agency'>('room');
  const [verifiedAgencyLockRoomId, setVerifiedAgencyLockRoomId] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  const requestMicPermission = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicPermission('denied');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicPermission('granted');
    } catch {
      setMicPermission('denied');
    }
  };

  const loadRooms = useCallback(async () => {
    try {
      const data = await listActiveRooms();
      setRooms(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDirectory = useCallback(
    async (forceRefresh = false) => {
      if (!user?.id) {
        return;
      }
      try {
        const [dir, platState, agenciesRes] = await Promise.all([
          getDiscoveryDirectoryFromSupabase(user.id),
          getPlatformState({ forceRefresh }).catch(() => null),
          supabase.from('sada_agencies').select('id, owner_id'),
        ]);
        setDirectoryUsers(dir.users);
        setUserFollows(dir.userFollows);
        setUserMeta(dir.userMeta || {});
        setSeatedUserIds(dir.seatedUserIds);
        if (platState?.settings?.userFollowedAgencies?.[user.id]) {
          setFollowedAgencyRoomIds(platState.settings.userFollowedAgencies[user.id]);
        } else {
          setFollowedAgencyRoomIds([]);
        }
        setRoomConfigs(platState?.settings?.roomConfigs || {});
        setPinnedRoomIds(
          Array.isArray(platState?.settings?.pinnedRoomIds)
            ? platState.settings.pinnedRoomIds
            : []
        );
        const ownerLookup: Record<string, string> = {};
        for (const ag of agenciesRes.data || []) {
          ownerLookup[String(ag.id)] = String(ag.owner_id);
        }
        setAgencyOwnerMap(ownerLookup);
      } catch {
        // ignore transient error
      }
    },
    [user?.id]
  );

  useEffect(() => {
    void loadRooms();
    void loadDirectory();
    const dbChannel = supabase
      .channel('sada-lobby-rooms')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sada_rooms' },
        () => {
          void loadRooms();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sada_platform_state' },
        () => {
          void loadDirectory(true);
        }
      )
      .subscribe();

    // Real-time live user presence inside agency rooms
    const presenceChannelRef: {
      current: ReturnType<typeof supabase.channel> | null;
    } = { current: null };

    try {
      presenceChannelRef.current = supabase.channel('sada-agencies-presence');
    } catch {
      presenceChannelRef.current = null;
    }

    const syncPresence = () => {
      if (!presenceChannelRef.current) return;
      try {
        const state = presenceChannelRef.current.presenceState<PresenceUser>();
        const grouped: Record<string, PresenceUser[]> = {};
        Object.values(state || {}).forEach((entries) => {
          (entries || []).forEach((entry) => {
            if (!entry?.roomId || !entry?.userId) return;
            if (!grouped[entry.roomId]) grouped[entry.roomId] = [];
            if (!grouped[entry.roomId].some((x) => x.userId === entry.userId)) {
              grouped[entry.roomId].push(entry);
            }
          });
        });
        setPresenceByRoom(grouped);
        setPresenceReady(true);
      } catch {
        // ignore transient presence errors
      }
    };

    if (presenceChannelRef.current) {
      try {
        presenceChannelRef.current
          .on('presence', { event: 'sync' }, syncPresence)
          .on('presence', { event: 'join' }, syncPresence)
          .on('presence', { event: 'leave' }, syncPresence)
          .subscribe();
      } catch {
        // ignore presence subscribe errors
      }
    }

    return () => {
      try {
        if (dbChannel) {
          void supabase.removeChannel(dbChannel);
        }
      } catch {
        // ignore
      }
      if (presenceChannelRef.current && !activeRoomIdRef.current) {
        try {
          void supabase.removeChannel(presenceChannelRef.current);
        } catch {
          // ignore
        }
      }
      presenceChannelRef.current = null;
    };
  }, [loadRooms, loadDirectory]);

  useEffect(() => {
    if (!presenceReady) return;

    rooms.forEach((room) => {
      const liveCount = presenceByRoom[room.id]?.length || 0;
      if (publishedPresenceCountsRef.current[room.id] === liveCount) return;
      publishedPresenceCountsRef.current[room.id] = liveCount;

      void supabase
        .from('sada_rooms')
        .update({ listeners_count: liveCount })
        .eq('id', room.id)
        .then(({ error: countError }) => {
          if (countError) {
            console.warn('Failed to sync room participant count:', countError);
          }
        });
    });
  }, [presenceByRoom, presenceReady, rooms]);

  const targetGender: 'male' | 'female' = user?.gender === 'female' ? 'male' : 'female';
  const onlineDiscoveryUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const onlineSet = new Set<string>([...onlineUserIds, ...seatedUserIds]);
    const isLive = (u: User) => {
      if (onlineSet.has(u.id)) return true;
      const ms = new Date(u.lastSeen).getTime();
      return Number.isFinite(ms) && Date.now() - ms <= 5 * 60 * 1000;
    };
    const pool = directoryUsers.filter((u) => {
      if (q) {
        const numId = formatShortNumericId(u.id);
        return (
          u.displayName.toLowerCase().includes(q) ||
          numId.includes(q) ||
          u.id.toLowerCase().includes(q)
        );
      }
      return u.gender === targetGender && isLive(u);
    });
    return pool
      .sort((a, b) => Number(isLive(b)) - Number(isLive(a)))
      .slice(0, 10)
      .map((u) => ({ user: u, live: isLive(u) }));
  }, [directoryUsers, onlineUserIds, seatedUserIds, search, targetGender]);

  const handleToggleFollowInSearch = async (targetUserId: string) => {
    if (!user?.id) return;
    setTogglingFollowId(targetUserId);
    try {
      const next = await toggleFollowUserInSupabase(user.id, targetUserId);
      setUserFollows(next.userFollows);
    } finally {
      setTogglingFollowId(null);
    }
  };

  const getRoomLiveInfo = useCallback(
    (room: Room) => {
      const presUsers = presenceByRoom[room.id] || [];
      return {
        members: presUsers,
        liveCount: presenceReady ? presUsers.length : room.listenersCount,
      };
    },
    [presenceByRoom, presenceReady]
  );

  const myOwnedRooms = useMemo(() => {
    if (!user) return [];
    return rooms.filter((r) => r.hostId === user.id && !r.isAgency);
  }, [rooms, user]);

  const myAgencyRoom = useMemo(() => {
    if (!user?.agencyId) return undefined;
    const ownerId = agencyOwnerMap[user.agencyId];
    return (
      rooms.find((r) => r.isAgency && ownerId && r.hostId === ownerId) ||
      rooms.find((r) => r.isAgency && r.hostId === user.id)
    );
  }, [rooms, user, agencyOwnerMap]);

  const myFollowedRooms = useMemo(() => {
    if (!followedAgencyRoomIds.length) return [];
    return rooms.filter((r) => followedAgencyRoomIds.includes(r.id));
  }, [rooms, followedAgencyRoomIds]);

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rooms.filter((r) => {
      if (activeChip === 'الوكالات' && !r.isAgency) return false;
      if (activeChip === 'الغرف الخاصة' && r.isAgency) return false;
      if (selectedCountry.code !== 'ALL') {
        const hostCountry = userMeta[r.hostId]?.country?.trim();
        if (
          !hostCountry ||
          (hostCountry.toUpperCase() !== selectedCountry.code &&
            hostCountry !== selectedCountry.label)
        ) {
          return false;
        }
      }
      if (q) {
        return (
          r.title.toLowerCase().includes(q) ||
          r.hostName.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const pinRank = (roomId: string) => {
      const idx = pinnedRoomIds.indexOf(roomId);
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    };

    return [...list].sort((a, b) => {
      const pDiff = pinRank(a.id) - pinRank(b.id);
      if (pDiff !== 0) return pDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [rooms, activeChip, search, selectedCountry, userMeta, pinnedRoomIds]);

  useEffect(() => {
    if (searchParams.get('enterMyRoom') !== '1') return;
    setPendingMyRoomEntry(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('enterMyRoom');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const enterRoom = useCallback(
    async (room: Room) => {
      setVerifiedAgencyLockRoomId(null);
      setRoomPasswordError(null);
      try {
        const platformState = await getPlatformState({ forceRefresh: true });
        const latestRoomConfigs = platformState.settings.roomConfigs || {};
        setRoomConfigs(latestRoomConfigs);
        const isAgencyLocked = latestRoomConfigs[room.id]?.agencyLockEnabled === true;
        if (isAgencyLocked) {
          let canBypassLock = false;
          try {
            canBypassLock = Boolean(
              user?.id && (await isRoomAgencyOwnerOrHostFromData(room.hostId, user.id))
            );
          } catch (error) {
            setPasswordPromptRoom(room);
            setPasswordPromptType('agency');
            setRoomPasswordInput('');
            setRoomPasswordError(
              error instanceof Error ? error.message : 'تعذّر التحقق من صلاحيات الوكالة.'
            );
            return;
          }
          if (!canBypassLock) {
            setPasswordPromptRoom(room);
            setPasswordPromptType('agency');
            setRoomPasswordInput('');
            return;
          }
          setVerifiedAgencyLockRoomId(room.id);
        }
        if (room.hasPassword) {
          setPasswordPromptRoom(room);
          setPasswordPromptType('room');
          setRoomPasswordInput('');
          return;
        }
        navigate(`/room/${room.id}`, {
          state: isAgencyLocked ? { agencyLockAuthorizedRoomId: room.id } : undefined,
        });
      } catch (error) {
        setPasswordPromptRoom(room);
        setPasswordPromptType('agency');
        setRoomPasswordInput('');
        setRoomPasswordError(
          error instanceof Error ? error.message : 'تعذّر التحقق من إعدادات الوكالة.'
        );
      }
    },
    [navigate, user?.id]
  );

  const handleGoToAgencyChat = useCallback(async () => {
    if (!user || openingMyRoomRef.current) return;
    openingMyRoomRef.current = true;
    setOpeningMyRoom(true);
    setMyRoomEntryError(null);
    try {
      const { personalRoom, agencyRoom } = await getUserActiveRoomsInSupabase(user);
      if (personalRoom && agencyRoom) {
        setMyRoomOptions({ personalRoom, agencyRoom });
        setShowMyRoomChoice(true);
      } else {
        const room = personalRoom || agencyRoom;
        if (room) {
          await enterRoom(room);
        } else {
          setNewTitle(`${user.displayName} الخاصة`);
          setCreateError(null);
          setShowCreate(true);
        }
      }
    } catch (error) {
      setMyRoomEntryError(
        error instanceof Error ? error.message : 'تعذّر التحقق من الغرف والوكالة.'
      );
      setAgencyToastVisible(true);
      window.setTimeout(() => setAgencyToastVisible(false), 3500);
    } finally {
      openingMyRoomRef.current = false;
      setOpeningMyRoom(false);
    }
  }, [enterRoom, user]);

  useEffect(() => {
    if (!pendingMyRoomEntry) return;
    setPendingMyRoomEntry(false);
    void handleGoToAgencyChat();
  }, [pendingMyRoomEntry, handleGoToAgencyChat]);

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordPromptRoom) return;
    setRoomPasswordError(null);
    try {
      let lockAuthorized = verifiedAgencyLockRoomId === passwordPromptRoom.id;
      if (passwordPromptType === 'agency') {
        const platformState = await getPlatformState({ forceRefresh: true });
        const latestRoomConfigs = platformState.settings.roomConfigs || {};
        setRoomConfigs(latestRoomConfigs);
        const roomLock = latestRoomConfigs[passwordPromptRoom.id];
        if (roomLock?.agencyLockEnabled) {
          const canBypassLock = Boolean(
            user?.id &&
              (await isRoomAgencyOwnerOrHostFromData(passwordPromptRoom.hostId, user.id))
          );
          if (!canBypassLock && roomPasswordInput !== roomLock.agencyLockPassword) {
            throw new Error('الرمز السري للوكالة غير صحيح.');
          }
          lockAuthorized = true;
          setVerifiedAgencyLockRoomId(passwordPromptRoom.id);
        }
        if (passwordPromptRoom.hasPassword) {
          setPasswordPromptType('room');
          setRoomPasswordInput('');
          return;
        }
      } else {
        await verifyRoomPasswordInSupabase(passwordPromptRoom.id, roomPasswordInput);
      }
      const targetId = passwordPromptRoom.id;
      setPasswordPromptRoom(null);
      navigate(`/room/${targetId}`, {
        state: lockAuthorized ? { agencyLockAuthorizedRoomId: targetId } : undefined,
      });
    } catch (err) {
      setRoomPasswordError(
        err instanceof Error ? err.message : 'كلمة المرور غير صحيحة.'
      );
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreateError(null);
    setCreating(true);
    try {
      const room = await createRoomInSupabase(user, {
        title: newTitle,
        category: newCategory,
        description: newDesc,
        maxSeats: newSeats,
        isPrivate: newPrivate,
        password: newPrivate ? newPassword : '',
      });
      setShowCreate(false);
      navigate(`/room/${room.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'تعذّر إنشاء الغرفة.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-[#F5F6FA]">
      {/* Top App Header matching screenshot */}
      <header className="sticky top-0 z-30 shrink-0 bg-white/95 border-b border-slate-100 pt-[max(env(safe-area-inset-top),32px)]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          {/* Right Brand + Tabs (حفلة / الخاص بي) */}
          <div className="flex items-center gap-3.5 sm:gap-5">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-black text-emerald-700 shrink-0">
              صَدَى - SADA
            </span>
            <button
              type="button"
              onClick={() => setMainTab('party')}
              className={`relative py-2 text-base sm:text-lg font-extrabold cursor-pointer transition ${
                mainTab === 'party' ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              <span>حفلة</span>
              {mainTab === 'party' && (
                <span className="absolute bottom-0 inset-x-1 h-1 rounded-full bg-gradient-to-r from-[#22E568] to-[#10B981]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setMainTab('mine')}
              className={`relative py-2 text-sm sm:text-base font-bold cursor-pointer transition ${
                mainTab === 'mine' ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              <span>الخاص بي</span>
              {mainTab === 'mine' && (
                <span className="absolute bottom-0 inset-x-1 h-1 rounded-full bg-gradient-to-r from-[#22E568] to-[#10B981]" />
              )}
            </button>
          </div>

          {/* Left Country Filter + Search */}
          <div className="flex items-center gap-2 relative">
            <button
              type="button"
              onClick={() => setShowCountryMenu((prev) => !prev)}
              className="flex items-center gap-1 rounded-full bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 cursor-pointer transition"
            >
              <span className="text-sm">{selectedCountry.flag}</span>
              <span>{selectedCountry.label}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            <button
              type="button"
              onClick={() => setShowSearch((prev) => !prev)}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer transition"
              aria-label="بحث"
            >
              <Search className="w-4 h-4" />
            </button>

            {showCountryMenu && (
              <div
                className="absolute top-11 left-0 z-40 w-48 max-h-72 overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 space-y-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                {COUNTRY_FILTERS.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      setSelectedCountry(c);
                      setShowCountryMenu(false);
                    }}
                    className={`w-full rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-between cursor-pointer transition ${
                      selectedCountry.code === c.code
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{c.label}</span>
                    <span>{c.flag}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {showSearch && (
          <div className="max-w-3xl mx-auto px-4 pb-3.5 space-y-3 border-t border-slate-100 pt-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو رقم الـ ID أو اسم الوكالة..."
                className="w-full rounded-2xl bg-slate-100 border border-slate-200 pr-10 pl-9 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Live Opposite-Gender Online Discovery inside Search */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-extrabold text-emerald-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    {search.trim()
                      ? `نتائج البحث في الأعضاء (${onlineDiscoveryUsers.length})`
                      : targetGender === 'female'
                      ? `البنات المتصلات الآن (${onlineDiscoveryUsers.length})`
                      : `الشباب المتصلون الآن (${onlineDiscoveryUsers.length})`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowSearch(false);
                    navigate('/meet');
                  }}
                  className="font-bold text-slate-500 hover:text-emerald-700 cursor-pointer"
                >
                  عرض الكل في لقاء &larr;
                </button>
              </div>

              {onlineDiscoveryUsers.length === 0 ? (
                <p className="text-[11px] text-slate-500 bg-slate-50 rounded-xl px-3 py-2 text-center">
                  لا يوجد نتائج مطابقة حالياً — جرّب البحث برقم الـ ID أو الاسم.
                </p>
              ) : (
                <div className="max-h-60 overflow-y-auto no-scrollbar space-y-2">
                  {onlineDiscoveryUsers.map(({ user: u, live }) => {
                    const rel = user
                      ? getFollowStatus(userFollows, user.id, u.id)
                      : { iFollowThem: false, theyFollowMe: false, isMutual: false };
                    const countryInfo = u.country
                      ? ARAB_COUNTRIES.find((c) => c.code === u.country)
                      : null;
                    return (
                      <div
                        key={u.id}
                        className="rounded-2xl bg-slate-50 border border-slate-200/80 p-2.5 flex items-center justify-between gap-2.5"
                      >
                        <div
                          className="flex items-center gap-2.5 min-w-0 cursor-pointer"
                          onClick={() => openMiniProfile(u.id, u)}
                        >
                          <div className="relative shrink-0">
                            <AvatarWithFrame
                              src={u.avatarUrl}
                              alt={u.displayName}
                              frameId={u.frameId}
                              vipTier={getUserVipTierInfo(u).key}
                              size="sm"
                            />
                            {live && (
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white z-20" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-xs font-extrabold text-slate-900 truncate">
                                <VipUserName name={u.displayName} vipTier={getUserVipTierInfo(u).key} />
                              </span>
                              <VipTierBadge vipTier={getUserVipTierInfo(u).key} compact />
                              {u.femaleVerifiedBadge && (
                                <FemaleVerifiedBadge badge={u.femaleVerifiedBadge} />
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 truncate font-mono-num">
                              {live ? '🟢 متصل الآن' : `ID: ${formatShortNumericId(u.id)}`}
                              {u.age ? ` · ${u.age} سنة` : ''}
                              {countryInfo ? ` · ${countryInfo.flag} ${countryInfo.label}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setShowSearch(false);
                              navigate(`/messages?to=${encodeURIComponent(u.id)}`);
                            }}
                            className="emerald-btn rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>مراسلة</span>
                          </button>
                          <button
                            type="button"
                            disabled={togglingFollowId === u.id}
                            onClick={() => handleToggleFollowInSearch(u.id)}
                            className={`rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold border flex items-center gap-1 cursor-pointer transition disabled:opacity-50 ${
                              rel.isMutual
                                ? 'bg-amber-50 border-amber-300 text-amber-800'
                                : rel.iFollowThem
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            {rel.isMutual ? (
                              <>
                                <UserCheck className="w-3 h-3" />
                                <span>أصدقاء 🤝</span>
                              </>
                            ) : rel.iFollowThem ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>متابع</span>
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-3 h-3" />
                                <span>متابعة</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {mainTab === 'party' && (
        <div className="w-full max-w-3xl mx-auto shrink-0 px-3.5 sm:px-4 pt-3 space-y-3">
          <section className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => navigate('/grand-competition')}
              className="w-full min-h-[92px] rounded-3xl bg-gradient-to-l from-sky-50 via-white to-indigo-50 border border-sky-200/80 p-4 flex items-center justify-between gap-4 text-right cursor-pointer hover:border-sky-300 hover:shadow-md transition shadow-sm"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-white shadow-md shrink-0">
                <Trophy className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-base sm:text-lg font-black text-slate-900">مسابقة صدى الكبرى</span>
                <span className="block mt-1 text-xs text-slate-500 font-semibold">الجوائز وشروط المشاركة</span>
              </div>
              <ChevronDown className="w-5 h-5 -rotate-90 text-sky-600 shrink-0" />
            </button>
          </section>

          <section className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto touch-pan-x no-scrollbar py-0.5">
              {(['الوكالات', 'الغرف الخاصة', 'لايف'] as FilterChip[]).map((chip) => {
                const active = activeChip === chip;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setActiveChip(chip)}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold whitespace-nowrap cursor-pointer transition flex items-center gap-1 ${
                      active
                        ? 'bg-amber-50 border border-amber-300 text-amber-900 shadow-sm'
                        : 'bg-white border border-slate-200/70 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{chip}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y pb-4">
        <div className="max-w-3xl mx-auto px-3.5 sm:px-4 pt-3 space-y-4">
        {mainTab === 'party' && (
          <>
        {/* Agencies / Private Rooms / Live Content */}
        <section className="space-y-2.5">
          {activeChip === 'لايف' ? (
            <div className="light-card rounded-3xl p-10 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-rose-500/15 to-amber-500/15 border border-rose-200 flex items-center justify-center text-rose-500">
                <Radio className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                قريباً - خدمة البث المباشر قيد التفعيل
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                نعمل حالياً على تجهيز تجربة البث المرئي المباشر لتنطلق بأعلى جودة قريباً.
              </p>
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="light-card rounded-2xl h-28 animate-pulse" />
              ))}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="light-card rounded-3xl p-8 text-center space-y-3">
              <p className="text-sm font-bold text-slate-700">
                {activeChip === 'الوكالات'
                  ? 'لا توجد وكالات صوتية مطابقة حالياً'
                  : 'لا توجد غرف خاصة مطابقة حالياً'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setMainTab('party');
                  setActiveChip('الوكالات');
                  setSearch('');
                }}
                className="emerald-btn rounded-xl px-5 py-2 text-xs cursor-pointer"
              >
                عرض جميع الوكالات
              </button>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const { members, liveCount } = getRoomLiveInfo(room);
              return (
                <LobbyRoomCard
                  key={room.id}
                  room={room}
                  members={members}
                  liveCount={liveCount}
                  hostCountryCode={userMeta[room.hostId]?.country}
                  isPinned={pinnedRoomIds.includes(room.id)}
                  isAgencyLocked={roomConfigs[room.id]?.agencyLockEnabled === true}
                  onEnter={enterRoom}
                  onOpenMiniProfile={openMiniProfile}
                />
              );
            })
          )}
        </section>
          </>
        )}

        {mainTab === 'mine' && (
          <div className="space-y-4">
            {/* 1. User's Own Room / Agency at Top */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Mic2 className="w-4 h-4 text-emerald-600" />
                  <span>غرفتي الصوتية</span>
                </h2>
                <button
                  type="button"
                  disabled={openingMyRoom}
                  onClick={() => void handleGoToAgencyChat()}
                  className="emerald-btn rounded-xl px-3 py-1.5 text-xs font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-60"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{openingMyRoom ? 'جارٍ الفتح...' : 'غرفتي / وكالتي'}</span>
                </button>
              </div>

              {myOwnedRooms.length === 0 ? (
                <div className="light-card rounded-3xl p-6 text-center space-y-2.5">
                  <p className="text-xs sm:text-sm font-bold text-slate-600">
                    لا توجد غرفة صوتية خاصة بك مفتوحة حالياً
                  </p>
                </div>
              ) : (
                myOwnedRooms.map((room) => {
                  const { liveCount } = getRoomLiveInfo(room);
                  return (
                    <article
                      key={room.id}
                      onClick={() => enterRoom(room)}
                      className="light-card light-card-hover rounded-2xl p-3 flex items-center gap-3 cursor-pointer border-emerald-200"
                    >
                      <img
                        src={resolveAsset(getLobbyRoomCover(room))}
                        alt={room.title}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-emerald-200 bg-slate-900"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <span className="inline-block rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                          غرفتي الملكية ✦
                        </span>
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                          <span className="inline-flex items-center gap-1">
                            <span>{getCountryFlag(userMeta[room.hostId]?.country)}</span>
                            {room.title}
                            {roomConfigs[room.id]?.agencyLockEnabled && (
                              <Lock
                                className="w-3.5 h-3.5 text-amber-600 shrink-0"
                                aria-label="الوكالة مقفلة برمز سري"
                              />
                            )}
                          </span>
                        </h3>
                        <p className="text-xs text-slate-500 truncate">{room.description}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500 text-white px-2.5 py-1 text-[11px] font-extrabold font-mono-num shrink-0">
                        <Headphones className="w-3 h-3" />
                        <span>{liveCount}</span>
                      </span>
                    </article>
                  );
                })
              )}
            </section>

            {/* 2. Followed Agencies Directly Underneath */}
            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-rose-500" />
                <span>الوكالات التي أتابعها ({myFollowedRooms.length})</span>
              </h2>

              {myFollowedRooms.length === 0 ? (
                <div className="light-card rounded-3xl p-6 text-center space-y-2">
                  <p className="text-xs sm:text-sm font-bold text-slate-600">
                    لم تتابع أي وكالة بعد.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    اضغط على زر (+) أعلى أي غرفة صوتية لإضافتها هنا والوصول إليها فوراً.
                  </p>
                </div>
              ) : (
                myFollowedRooms.map((room) => {
                  const { liveCount } = getRoomLiveInfo(room);
                  return (
                    <article
                      key={room.id}
                      onClick={() => enterRoom(room)}
                      className="light-card light-card-hover rounded-2xl p-3 flex items-center gap-3 cursor-pointer"
                    >
                      <img
                        src={resolveAsset(getLobbyRoomCover(room))}
                        alt={room.title}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-slate-200 bg-slate-900"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                          <span className="inline-flex items-center gap-1">
                            <span>{getCountryFlag(userMeta[room.hostId]?.country)}</span>
                            {room.title}
                            {roomConfigs[room.id]?.agencyLockEnabled && (
                              <Lock
                                className="w-3.5 h-3.5 text-amber-600 shrink-0"
                                aria-label="الوكالة مقفلة برمز سري"
                              />
                            )}
                          </span>
                        </h3>
                        <p className="text-xs text-slate-500 truncate">{room.description}</p>
                        <p className="text-[11px] text-emerald-700 font-bold">
                          المضيف: {room.hostName}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500 text-white px-2.5 py-1 text-[11px] font-extrabold font-mono-num shrink-0">
                        <Headphones className="w-3 h-3" />
                        <span>{liveCount}</span>
                      </span>
                    </article>
                  );
                })
              )}
            </section>
          </div>
        )}
        </div>
      </div>

      <div className="fixed bottom-24 left-3 z-30">
        <button
          type="button"
          onClick={() => void handleGoToAgencyChat()}
          disabled={openingMyRoom}
          className="emerald-btn rounded-full px-3 py-1.5 text-xs shadow-lg font-extrabold flex items-center gap-2 cursor-pointer disabled:opacity-70"
        >
          <Mic2 className="w-4 h-4" />
          <span>{openingMyRoom ? 'جارٍ التحقق...' : 'غرفتي / وكالتي'}</span>
        </button>
      </div>

      {showMyRoomChoice && myRoomOptions && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          onClick={() => setShowMyRoomChoice(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lobby-my-room-choice-title"
            className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-5 space-y-4 shadow-2xl text-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 id="lobby-my-room-choice-title" className="text-lg font-extrabold">
                  اختر وجهتك
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  لديك غرفة خاصة وغرفة وكالة نشطتان
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMyRoomChoice(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {([
              ['personalRoom', 'غرفتي الخاصة', Mic2],
              ['agencyRoom', 'وكالتي', Radio],
            ] as const).map(([roomKey, label, Icon]) => {
              const targetRoom = myRoomOptions[roomKey];
              return (
                <button
                  key={roomKey}
                  type="button"
                  onClick={() => {
                    setShowMyRoomChoice(false);
                    void enterRoom(targetRoom);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 p-4 flex items-center gap-3 text-right transition cursor-pointer"
                >
                  <span className="w-11 h-11 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-sm">
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold text-slate-900">{label}</span>
                    <span className="block text-xs text-slate-500 truncate mt-1">
                      {targetRoom.title}
                    </span>
                  </span>
                  <ChevronDown className="w-4 h-4 -rotate-90 text-slate-400" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Personal Room Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 space-y-4 shadow-2xl text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <span>إنشاء غرفتي الخاصة</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 font-semibold">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عنوان الغرفة
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: سهرة الشعر والطرب الأصيل"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    التصنيف
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as Room['category'])}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="حوار">حوار</option>
                    <option value="مسابقات">مسابقات</option>
                    <option value="شعر وأدب">شعر وأدب</option>
                    <option value="طرب">طرب</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    عدد مقاعد المايك
                  </label>
                  <select
                    value={newSeats}
                    onChange={(e) => setNewSeats(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value={6}>6 مايكات</option>
                    <option value={12}>12 مايك</option>
                    <option value={18}>18 مايك</option>
                    <option value={24}>24 مايك</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  وصف مختصر
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="اكتب نبذة ترحيبية للضيوف..."
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  خصوصية الغرفة
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100">
                  <button
                    type="button"
                    onClick={() => setNewPrivate(false)}
                    className={`min-h-[38px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      !newPrivate ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>غرفة عامة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPrivate(true)}
                    className={`min-h-[38px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      newPrivate ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>غرفة خاصة برمز PIN</span>
                  </button>
                </div>
              </div>

              {newPrivate && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الرمز السري للغرفة (PIN)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={8}
                    dir="ltr"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="4820"
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 text-left font-mono-num focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5">
                <span className="text-xs text-slate-600">
                  {micPermission === 'granted'
                    ? 'إذن المايكروفون مفعّل وجاهز'
                    : micPermission === 'denied'
                    ? 'تعذّر الوصول للمايكروفون من المتصفح'
                    : 'تفعيل إذن المايكروفون قبل البث'}
                </span>
                <button
                  type="button"
                  onClick={requestMicPermission}
                  className="text-xs font-extrabold text-emerald-600 hover:underline whitespace-nowrap cursor-pointer"
                >
                  {micPermission === 'granted' ? 'مُفعّل ✓' : 'تفعيل المايك'}
                </button>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="emerald-btn w-full min-h-[46px] rounded-2xl py-2.5 text-sm cursor-pointer disabled:opacity-60"
              >
                {creating ? 'جارٍ فتح الغرفة...' : 'فتح غرفتي الآن'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Password Prompt Modal */}
      {passwordPromptRoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          onClick={() => setPasswordPromptRoom(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-6 space-y-4 shadow-2xl text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-slate-900">
              {passwordPromptType === 'agency'
                ? 'أدخل الرمز السري للوكالة'
                : 'وكالة محمية برمز سري (PIN)'}
            </h3>
            <p className="text-xs text-slate-500">{passwordPromptRoom.title}</p>
            {roomPasswordError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
                {roomPasswordError}
              </div>
            )}
            <form onSubmit={handleVerifyPassword} className="space-y-3">
              <input
                type="password"
                inputMode={passwordPromptType === 'agency' ? 'text' : 'numeric'}
                required
                dir="ltr"
                value={roomPasswordInput}
                onChange={(e) =>
                  setRoomPasswordInput(
                    passwordPromptType === 'agency'
                      ? e.target.value.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 4)
                      : e.target.value
                  )
                }
                maxLength={passwordPromptType === 'agency' ? 4 : undefined}
                placeholder={
                  passwordPromptType === 'agency'
                    ? 'أدخل 4 أرقام أو أحرف'
                    : 'أدخل الرمز السري PIN'
                }
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 text-left font-mono-num focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="emerald-btn w-full min-h-[44px] rounded-xl py-2 text-sm cursor-pointer"
              >
                تحقق ودخول
              </button>
            </form>
          </div>
        </div>
      )}

      {agencyToastVisible && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] pointer-events-none">
          <div className="rounded-full bg-slate-900/95 text-white border border-white/15 px-4 py-2.5 text-xs font-extrabold shadow-xl whitespace-nowrap">
            {myRoomEntryError || 'تعذّر التحقق من الغرف والوكالة.'}
          </div>
        </div>
      )}

      {/* Double-back exit warning toast on Home Page */}
      {exitToastVisible && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] pointer-events-none">
          <div className="rounded-full bg-slate-900/95 text-white border border-white/15 px-5 py-2.5 text-xs sm:text-sm font-extrabold shadow-xl whitespace-nowrap">
            اضغط مرة أخرى للخروج من التطبيق
          </div>
        </div>
      )}
    </div>
  );
};
