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
import { useAuth } from '../context/AuthContext';
import { useMiniProfile } from '../context/MiniProfileContext';
import { ARAB_COUNTRIES, formatShortNumericId, getUserVipTierInfo } from '../lib/sadaCatalog';
import {
  getDiscoveryDirectoryFromSupabase,
  getFollowStatus,
  toggleFollowUserInSupabase,
} from '../lib/sadaSocialService';
import { supabase } from '../lib/supabase';
import type { User } from '../types';
import { AvatarWithFrame, VipTierBadge, VipUserName } from '../components/AvatarWithFrame';
import { FemaleVerifiedBadge } from '../components/FemaleVoiceVerificationCard';

const RECENT_ONLINE_WINDOW_MS = 5 * 60 * 1000;

export const MeetPage: React.FC = () => {
  const { user, onlineUserIds } = useAuth();
  const { openMiniProfile } = useMiniProfile();
  const navigate = useNavigate();

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [userFollows, setUserFollows] = useState<Record<string, string[]>>({});
  const [seatedUserIds, setSeatedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllDirectory, setShowAllDirectory] = useState(false);
  const [togglingFollowId, setTogglingFollowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDirectory = useCallback(async () => {
    if (!user?.id) return;
    try {
      const dirRes = await getDiscoveryDirectoryFromSupabase(user.id);
      setAllUsers(dirRes.users);
      setUserFollows(dirRes.userFollows);
      setSeatedUserIds(dirRes.seatedUserIds);
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

  const targetGender: 'male' | 'female' = user?.gender === 'female' ? 'male' : 'female';
  const targetLabel = targetGender === 'female' ? 'البنات المتصلات حالياً' : 'الشباب المتصلين حالياً';

  const onlineIdSet = useMemo(() => {
    const s = new Set<string>([...onlineUserIds, ...seatedUserIds]);
    return s;
  }, [onlineUserIds, seatedUserIds]);

  const isUserLiveOnline = useCallback(
    (u: User) => {
      if (onlineIdSet.has(u.id)) return true;
      const lastSeenMs = new Date(u.lastSeen).getTime();
      return Number.isFinite(lastSeenMs) && Date.now() - lastSeenMs <= RECENT_ONLINE_WINDOW_MS;
    },
    [onlineIdSet]
  );

  const { onlineOpposite, searchableOfflineOpposite } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const oppositePool = allUsers.filter((u) => u.gender === targetGender);
    const activePool = showAllDirectory ? allUsers : oppositePool;

    const matchesQuery = (u: User) => {
      if (!q) return true;
      const numId = formatShortNumericId(u.id);
      return (
        u.displayName.toLowerCase().includes(q) ||
        numId.includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    };

    const filtered = activePool.filter(matchesQuery);
    const online = filtered
      .filter((u) => isUserLiveOnline(u))
      .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

    const offline = filtered
      .filter((u) => !isUserLiveOnline(u))
      .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

    return {
      onlineOpposite: online,
      searchableOfflineOpposite: offline,
    };
  }, [allUsers, targetGender, showAllDirectory, searchQuery, isUserLiveOnline]);

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
              <VipTierBadge vipTier={vipInfo.key} compact />
              {u.femaleVerifiedBadge && <FemaleVerifiedBadge badge={u.femaleVerifiedBadge} />}
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
              <span>{targetLabel} ({onlineOpposite.length})</span>
            </span>
            <button
              type="button"
              onClick={() => setShowAllDirectory((prev) => !prev)}
              className="font-bold text-slate-500 hover:text-emerald-700 cursor-pointer"
            >
              {showAllDirectory ? 'عرض الجنس المقابل فقط' : 'عرض جميع الأعضاء'}
            </button>
          </div>
        </section>

        {/* Online Opposite-Gender Users */}
        <section className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>{targetLabel}</span>
            </h1>
            <span className="text-[11px] font-semibold text-slate-500">
              توثيق حقيقي ومتابعة متبادلة للدردشة المجانية
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="light-card rounded-2xl h-32 animate-pulse" />
              ))}
            </div>
          ) : onlineOpposite.length === 0 ? (
            <div className="light-card rounded-2xl p-6 text-center space-y-2">
              <p className="text-xs sm:text-sm font-bold text-slate-700">
                لا يوجد حسابات {targetGender === 'female' ? 'بنات' : 'شباب'} متصلة الآن في هذه اللحظة.
              </p>
              <p className="text-[11px] text-slate-500">
                يمكنك البحث بالاسم أو الـ ID أعلاه للوصول إلى جميع الأعضاء المسجلين.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {onlineOpposite.map((u) => renderUserCard(u, true))}
            </div>
          )}

          {/* Offline searchable members when filtering or available */}
          {searchableOfflineOpposite.length > 0 && (
            <div className="pt-2 space-y-2.5">
              <h2 className="text-xs font-extrabold text-slate-500">
                {searchQuery.trim()
                  ? `نتائج البحث من الأعضاء المسجلين (${searchableOfflineOpposite.length})`
                  : `أعضاء ${targetGender === 'female' ? 'البنات' : 'الشباب'} المسجلون (${searchableOfflineOpposite.length})`}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {searchableOfflineOpposite.slice(0, searchQuery.trim() ? 20 : 8).map((u) =>
                  renderUserCard(u, false)
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
