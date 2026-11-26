import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  MessageCircle,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AgencyIcon, FriendsIcon } from '../components/AppIcons';
import { useAuth } from '../context/AuthContext';
import { useMiniProfile } from '../context/MiniProfileContext';
import { ARAB_COUNTRIES, formatShortNumericId, getUserVipTierInfo } from '../lib/sadaCatalog';
import {
  getDiscoveryDirectoryFromSupabase,
  getFollowStatus,
  searchUsersForFriendInSupabase,
  toggleFollowUserInSupabase,
} from '../lib/sadaSocialService';
import { rowToUser, USER_COLUMNS } from '../lib/sadaMappers';
import { supabase } from '../lib/supabase';
import type { User } from '../types';
import { AvatarWithFrame, VipTierBadge, VipUserName } from '../components/AvatarWithFrame';
import { FemaleVerifiedBadge } from '../components/FemaleVoiceVerificationCard';
import { GenderBadge } from '../components/GenderBadge';

export const MeetPage: React.FC = () => {
  const { user, onlineUserIds } = useAuth();
  const { openMiniProfile } = useMiniProfile();
  const navigate = useNavigate();

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [userFollows, setUserFollows] = useState<Record<string, string[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [togglingFollowId, setTogglingFollowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDirectory = useCallback(async () => {
    if (!user?.id) return;
    try {
      const dirRes = await getDiscoveryDirectoryFromSupabase(user.id);
      setAllUsers(dirRes.users);
      setUserFollows(dirRes.userFollows);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadDirectory();
    const channel = supabase
      .channel('sada-meet-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sada_platform_state' },
        () => {
          void loadDirectory();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sada_users' },
        () => {
          void loadDirectory();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadDirectory]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!user?.id || !query) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    setSearchError(false);
    const timer = window.setTimeout(async () => {
      try {
        const pattern = `%${query}%`;
        const [nameResult, idResult, shortIdMatches] = await Promise.all([
          supabase
            .from('sada_users')
            .select(USER_COLUMNS)
            .eq('is_banned', false)
            .ilike('display_name', pattern)
            .order('last_seen', { ascending: false })
            .limit(25),
          supabase
            .from('sada_users')
            .select(USER_COLUMNS)
            .eq('is_banned', false)
            .ilike('id', pattern)
            .order('last_seen', { ascending: false })
            .limit(25),
          /^\d+$/.test(query) ? searchUsersForFriendInSupabase(user.id, query) : [],
        ]);

        if (nameResult.error) throw nameResult.error;
        if (idResult.error) throw idResult.error;
        const matchedUsers = [
          ...(nameResult.data || []).map(rowToUser),
          ...(idResult.data || []).map(rowToUser),
          ...shortIdMatches,
        ];
        const uniqueUsers = new Map(
          matchedUsers
            .filter((matchedUser) => matchedUser.id !== user.id)
            .map((matchedUser) => [matchedUser.id, matchedUser])
        );
        if (!cancelled) setSearchResults(Array.from(uniqueUsers.values()).slice(0, 25));
      } catch {
        if (!cancelled) {
          setSearchResults([]);
          setSearchError(true);
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, user?.id]);

  const targetGender: 'male' | 'female' = user?.gender === 'female' ? 'male' : 'female';

  const onlineIdSet = useMemo(() => {
    return new Set<string>(onlineUserIds);
  }, [onlineUserIds]);

  const isUserLiveOnline = useCallback(
    (u: User) => onlineIdSet.has(u.id),
    [onlineIdSet]
  );

  const { onlineUsers, onlineCount } = useMemo(() => {
    const activePool = allUsers.filter((u) => u.gender === targetGender);
    const online = activePool
      .filter((u) => isUserLiveOnline(u))
      .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

    return {
      onlineUsers: online,
      onlineCount: online.length,
    };
  }, [allUsers, targetGender, isUserLiveOnline]);

  const handleToggleFollow = async (targetUserId: string) => {
    if (!user?.id) return;
    setTogglingFollowId(targetUserId);
    try {
      const nextFollows = await toggleFollowUserInSupabase(user.id, targetUserId);
      setUserFollows(nextFollows.userFollows);
    } finally {
      setTogglingFollowId(null);
    }
  };

  const getCountryDisplay = (code?: string) => {
    if (!code) return null;
    const found = ARAB_COUNTRIES.find((c) => c.code === code);
    return found ? `${found.flag} ${found.label}` : code;
  };

  const isSearching = Boolean(searchQuery.trim());
  const displayedUsers = isSearching ? searchResults : onlineUsers;
  const isDirectoryLoading = isSearching ? searchLoading : loading;

  const renderUserCard = (u: User, liveOnline: boolean) => {
    const rel = user ? getFollowStatus(userFollows, user.id, u.id) : { iFollowThem: false, theyFollowMe: false, isMutual: false };
    const numId = formatShortNumericId(u.id);
    const countryLabel = getCountryDisplay(u.country);
    const isToggling = togglingFollowId === u.id;
    const vipInfo = getUserVipTierInfo(u);

    return (
      <div
        key={u.id}
        className="light-card light-card-hover rounded-2xl p-3.5 flex flex-col justify-between gap-3"
      >
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => openMiniProfile(u.id, u)}
        >
          <div className="relative shrink-0">
            <AvatarWithFrame
              src={u.avatarUrl}
              alt={u.displayName}
              frameId={u.frameId}
              vipTier={vipInfo.key}
              size="md"
            />
            {liveOnline && (
              <span
                title="متصل الآن"
                className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white shadow-sm animate-pulse z-20"
              />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                <VipUserName name={u.displayName} vipTier={vipInfo.key} />
              </p>
              <GenderBadge gender={u.gender} />
              <VipTierBadge vipTier={vipInfo.key} compact />
              {u.femaleVerifiedBadge && <FemaleVerifiedBadge badge={u.femaleVerifiedBadge} />}
              {(u.isAgent || u.isHost) && (
                <span title="مضيف أو وكيل معتمد">
                  <AgencyIcon className="w-4 h-4" />
                </span>
              )}
            </div>

            <div className="flex items-center flex-wrap gap-1.5 text-[10px] font-bold">
              {liveOnline ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  متصل الآن
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 font-mono-num">
                  ID: {numId}
                </span>
              )}

              {u.age && (
                <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-800 font-mono-num">
                  {u.age} سنة
                </span>
              )}

              {countryLabel && (
                <span className="rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-sky-700">
                  {countryLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate(`/messages?to=${encodeURIComponent(u.id)}`)}
            className="flex-1 emerald-btn min-h-[36px] rounded-xl px-3 py-1.5 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>مراسلة</span>
          </button>

          <button
            type="button"
            disabled={isToggling}
            onClick={() => handleToggleFollow(u.id)}
            className={`min-h-[36px] rounded-xl px-3 py-1.5 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer transition border disabled:opacity-50 ${
              rel.isMutual
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : rel.iFollowThem
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            {rel.isMutual ? (
              <>
                <UserCheck className="w-3.5 h-3.5" />
                <span>أصدقاء 🤝</span>
              </>
            ) : rel.iFollowThem ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>متابع ✓</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>متابعة</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-[#F5F6FA]">
      <div className="w-full max-w-3xl mx-auto px-4 pt-4 flex-1 min-h-0 flex flex-col gap-5">
        {/* Fast Search Bar by Name or Numeric ID */}
        <section className="light-card rounded-2xl p-3 space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الـ ID..."
              className="w-full rounded-xl bg-slate-100 border border-slate-200 pr-10 pl-9 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="مسح البحث"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-extrabold text-emerald-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {isSearching
                  ? `نتائج البحث (${searchResults.length})`
                  : `الأصدقاء المتصلون حالياً (${onlineCount})`}
              </span>
            </span>
          </div>
        </section>

        <section className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y pb-4 space-y-3">
          <h1 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <FriendsIcon className="w-5 h-5" />
            <span>الأصدقاء المتصلون حالياً</span>
          </h1>

          {isDirectoryLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="light-card rounded-2xl h-32 animate-pulse" />
              ))}
            </div>
          ) : searchError ? (
            <div className="light-card rounded-2xl p-6 text-center">
              <p className="text-xs sm:text-sm font-bold text-rose-700">
                تعذّر البحث عن الأعضاء. يرجى المحاولة مرة أخرى.
              </p>
            </div>
          ) : displayedUsers.length === 0 ? (
            <div className="light-card rounded-2xl p-6 text-center space-y-2">
              <p className="text-xs sm:text-sm font-bold text-slate-700">
                {isSearching
                  ? 'لا توجد نتائج تطابق البحث.'
                  : 'لا يوجد أصدقاء متصلون حالياً'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {displayedUsers.map((u) => renderUserCard(u, isUserLiveOnline(u)))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
