import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Check,
  Compass,
  Gamepad2,
  MessageCircle,
  Mic2,
  Search,
  Shuffle,
  Sparkles,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMiniProfile } from '../context/MiniProfileContext';
import { ARAB_COUNTRIES, formatShortNumericId } from '../lib/sadaCatalog';
import { listActiveRooms } from '../lib/sadaRoomsService';
import {
  getDiscoveryDirectoryFromSupabase,
  getFollowStatus,
  toggleFollowUserInSupabase,
} from '../lib/sadaSocialService';
import { supabase } from '../lib/supabase';
import type { Room, User } from '../types';
import { AvatarWithFrame } from '../components/AvatarWithFrame';
import { FemaleVerifiedBadge } from '../components/FemaleVoiceVerificationCard';

const RECENT_ONLINE_WINDOW_MS = 5 * 60 * 1000;

export const MeetPage: React.FC = () => {
  const { user, onlineUserIds } = useAuth();
  const { openMiniProfile } = useMiniProfile();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<Room[]>([]);
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
      const [roomsRes, dirRes] = await Promise.all([
        listActiveRooms().catch(() => []),
        getDiscoveryDirectoryFromSupabase(user.id),
      ]);
      setRooms(roomsRes);
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

  const handleRandomVoiceMatch = () => {
    const publicRooms = rooms.filter((r) => !r.hasPassword);
    if (publicRooms.length > 0) {
      const picked = publicRooms[Math.floor(Math.random() * publicRooms.length)];
      navigate(`/room/${picked.id}`);
    } else {
      navigate('/');
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
              size="md"
            />
            {liveOnline && (
              <span
                title="متصل الآن"
                className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white shadow-sm animate-pulse"
              />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                {u.displayName}
              </p>
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
    <div className="min-h-screen bg-[#F5F6FA] pb-28">
      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-5">
        {/* Fast Search Bar by Name or Numeric ID */}
        <section className="light-card rounded-2xl p-3 space-y-2.5">
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
        <section className="space-y-3">
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
                يمكنك البحث بالاسم أو الـ ID أعلاه أو تجربة اللقاء الصوتي السريع.
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

        {/* Quick Match Hero */}
        <section className="rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#132238] to-[#064E3B] p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-1 text-[11px] font-bold text-emerald-200">
                <Compass className="w-3.5 h-3.5" />
                <span>ساحة اللقاء والاكتشاف الحي</span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold">
                لقاء صوتي فوري في الوكالات النشطة
              </h2>
              <p className="text-xs text-slate-300">
                انضم بضغطة واحدة إلى وكالة صوتية عشوائية أو تابع أصدقاءك للدردشة مجاناً.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRandomVoiceMatch}
              className="emerald-btn rounded-2xl px-5 py-3 text-sm font-extrabold flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <Shuffle className="w-4 h-4" />
              <span>لقاء صوتي سريع</span>
            </button>
          </div>
        </section>

        {/* Quick Destination Cards */}
        <section className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/games')}
            className="light-card light-card-hover rounded-2xl p-3.5 text-center space-y-1.5 cursor-pointer"
          >
            <div className="w-10 h-10 mx-auto rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <span className="block text-xs font-extrabold text-slate-900">مركز الألعاب</span>
            <span className="block text-[10px] text-slate-500">سلوتس، نرد، روليت</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/competitions')}
            className="light-card light-card-hover rounded-2xl p-3.5 text-center space-y-1.5 cursor-pointer"
          >
            <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Trophy className="w-5 h-5" />
            </div>
            <span className="block text-xs font-extrabold text-slate-900">المسابقات</span>
            <span className="block text-[10px] text-slate-500">بطولات ودولاب الحظ</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/agency')}
            className="light-card light-card-hover rounded-2xl p-3.5 text-center space-y-1.5 cursor-pointer"
          >
            <div className="w-10 h-10 mx-auto rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="block text-xs font-extrabold text-slate-900">الوكالات</span>
            <span className="block text-[10px] text-slate-500">مضيفون ووكلاء</span>
          </button>
        </section>

        {/* Active Agencies Quick Join */}
        {rooms.length > 0 && (
          <section className="space-y-2.5">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>وكالات صوتية نشطة الآن</span>
            </h2>
            <div className="space-y-2">
              {rooms.slice(0, 4).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/room/${r.id}`)}
                  className="w-full light-card light-card-hover rounded-2xl p-3 flex items-center justify-between gap-3 text-right cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <AvatarWithFrame
                      src={r.hostAvatar}
                      alt={r.hostName}
                      frameId="frame_crescent"
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                        {r.title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{r.hostName}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-extrabold text-emerald-700 flex items-center gap-1 shrink-0">
                    <Mic2 className="w-3 h-3" />
                    دخول
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
