import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Copy,
  Crown,
  Gem,
  Gift,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react';
import { useActiveRoom } from '../context/ActiveRoomContext';
import { useAuth } from '../context/AuthContext';
import { useMiniProfile } from '../context/MiniProfileContext';
import { getUserPublicProfileFromSupabase } from '../lib/sadaAuth';
import {
  ARAB_COUNTRIES,
  formatShortNumericId,
  getUserVipTierInfo,
  getVipTierLabel,
  parseVipTierKey,
} from '../lib/sadaCatalog';
import { getPlatformState } from '../lib/sadaMappers';
import { safeGetItem } from '../lib/safeStorage';
import {
  getFollowStatus,
  getUserGiftLevelsFromSupabase,
  recordProfileVisitInSupabase,
  toggleFollowUserInSupabase,
} from '../lib/sadaSocialService';
import type { User } from '../types';
import { AvatarWithFrame, VipTierBadge, VipUserName } from './AvatarWithFrame';
import { FemaleVerifiedBadge } from './FemaleVoiceVerificationCard';

export const UserMiniProfileModal: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { activeRoomId, isMinimized, requestGiftForUser } = useActiveRoom();
  const { selectedUserId, previewUser, closeMiniProfile } = useMiniProfile();
  const navigate = useNavigate();

  const [fetchedUser, setFetchedUser] = useState<User | null>(null);
  const [userFollows, setUserFollows] = useState<Record<string, string[]>>({});
  const [giftLevels, setGiftLevels] = useState<{ sendLevel: number; receiveLevel: number }>({
    sendLevel: 1,
    receiveLevel: 1,
  });
  const [togglingFollow, setTogglingFollow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (!selectedUserId) {
      setFetchedUser(null);
      return;
    }
    let active = true;
    setLoading(true);
    if (currentUser?.id && currentUser.id !== selectedUserId) {
      void recordProfileVisitInSupabase(selectedUserId, currentUser.id).catch(() => {});
    }
    Promise.all([
      getUserPublicProfileFromSupabase(selectedUserId),
      getPlatformState().catch(() => null),
      getUserGiftLevelsFromSupabase(selectedUserId).catch(() => null),
    ])
      .then(([res, platState, gl]) => {
        if (!active) return;
        if (res) setFetchedUser(res);
        if (platState?.settings?.userFollows) {
          setUserFollows(platState.settings.userFollows);
        }
        if (gl) {
          setGiftLevels({ sendLevel: gl.sendLevel, receiveLevel: gl.receiveLevel });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedUserId, currentUser?.id]);

  if (!selectedUserId) return null;

  const profile = {
    id: selectedUserId,
    displayName: fetchedUser?.displayName || previewUser?.displayName || 'عضو صَدَى',
    avatarUrl: fetchedUser?.avatarUrl || previewUser?.avatarUrl || 'host_male',
    frameId:
      (selectedUserId === currentUser?.id ? safeGetItem('sada_equipped_frame') : null) ||
      fetchedUser?.frameId ||
      previewUser?.frameId ||
      'frame_obsidian',
    level: fetchedUser?.level || previewUser?.level || 1,
    bio: fetchedUser?.bio || previewUser?.bio || 'عضو في وكالات صَدَى الصوتية الفاخرة.',
    is_admin: fetchedUser?.is_admin ?? previewUser?.is_admin ?? false,
    isHost: fetchedUser?.isHost ?? previewUser?.isHost ?? false,
    hostAgencyName: fetchedUser?.hostAgencyName ?? previewUser?.hostAgencyName ?? null,
    femaleVerifiedBadge:
      fetchedUser?.femaleVerifiedBadge ?? previewUser?.femaleVerifiedBadge ?? null,
    activeEntryName: fetchedUser?.activeEntryName ?? previewUser?.activeEntryName ?? null,
    gender: fetchedUser?.gender ?? previewUser?.gender ?? 'male',
    age: fetchedUser?.age ?? previewUser?.age,
    country: fetchedUser?.country ?? previewUser?.country,
    vipLevel: parseVipTierKey(
      fetchedUser?.vipLevel || previewUser?.vipLevel,
      fetchedUser || previewUser
    ),
  };

  const resolvedVipTier =
    profile.vipLevel !== 'none'
      ? profile.vipLevel
      : getUserVipTierInfo(fetchedUser || previewUser).key;

  const numericId = formatShortNumericId(profile.id);
  const isSelf = currentUser?.id === profile.id;
  const followRel = currentUser
    ? getFollowStatus(userFollows, currentUser.id, profile.id)
    : { iFollowThem: false, theyFollowMe: false, isMutual: false };
  const countryInfo = profile.country
    ? ARAB_COUNTRIES.find((c) => c.code === profile.country)
    : null;
  const isInsideActiveRoom = Boolean(activeRoomId && !isMinimized);

  const handleToggleFollow = async () => {
    if (!currentUser || isSelf) return;
    setTogglingFollow(true);
    try {
      const next = await toggleFollowUserInSupabase(currentUser.id, profile.id);
      setUserFollows(next.userFollows);
    } finally {
      setTogglingFollow(false);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard?.writeText(numericId).catch(() => {});
    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 1600);
  };

  const handlePrivateChat = () => {
    closeMiniProfile();
    if (activeRoomId && !isMinimized) {
      window.dispatchEvent(new Event('sada:minimize'));
    }
    if (isSelf) {
      navigate('/profile');
    } else {
      navigate(`/messages?to=${encodeURIComponent(profile.id)}`);
    }
  };

  const handleGiftAction = () => {
    closeMiniProfile();
    if (activeRoomId && !isMinimized) {
      requestGiftForUser(profile.id);
    } else if (!isSelf) {
      navigate(`/messages?to=${encodeURIComponent(profile.id)}&gift=1`);
    } else {
      navigate('/store');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-sm p-0 sm:p-4"
      onClick={closeMiniProfile}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dark Royal Header */}
        <div className="relative bg-gradient-to-br from-[#0F172A] via-[#17203B] to-[#0B1020] px-5 pt-5 pb-6 text-white">
          <button
            type="button"
            onClick={closeMiniProfile}
            className="absolute top-3.5 left-3.5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col items-center text-center gap-2.5 pt-2">
            <AvatarWithFrame
              src={profile.avatarUrl}
              alt={profile.displayName}
              frameId={profile.frameId}
              vipTier={resolvedVipTier}
              size="xl"
            />

            <div className="space-y-1">
              <div className="flex items-center justify-center flex-wrap gap-1.5">
                <h3 className="text-lg font-extrabold text-white">
                  <VipUserName name={profile.displayName} vipTier={resolvedVipTier} />
                </h3>
                <VipTierBadge vipTier={resolvedVipTier} />
                {profile.is_admin && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#D4AF37]/25 border border-[#D4AF37]/60 px-2 py-0.5 text-[10px] font-bold text-[#FCE9A6]">
                    <ShieldCheck className="w-3 h-3" />
                    إدارة
                  </span>
                )}
                {profile.femaleVerifiedBadge && (
                  <FemaleVerifiedBadge badge={profile.femaleVerifiedBadge} />
                )}
              </div>

              <div className="flex items-center justify-center flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/15 px-2.5 py-0.5 font-mono-num text-slate-200 cursor-pointer transition"
                >
                  <span>ID: {numericId}</span>
                  {copiedId ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-300" />
                  )}
                </button>

                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/25 to-yellow-500/20 border border-amber-300/40 px-2.5 py-0.5 font-bold text-[#FCE9A6] font-mono-num">
                  <Crown className="w-3 h-3" />
                  Lv.{giftLevels.sendLevel}
                </span>

                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-300/40 px-2.5 py-0.5 font-bold text-[#FCE9A6] font-mono-num">
                  <Gift className="w-3 h-3 text-[#FCE9A6]" />
                  Lv.{giftLevels.receiveLevel}
                </span>

                {resolvedVipTier === 'none' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 font-bold text-emerald-200">
                    {getVipTierLabel(profile.level, profile.is_admin)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Light Body */}
        <div className="p-5 space-y-4">
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2">
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {loading && !fetchedUser ? 'جارٍ تحميل الملف الشخصي...' : profile.bio}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
              {profile.isHost && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-0.5">
                  <UserCheck className="w-3 h-3" />
                  <span>{profile.hostAgencyName ? `مضيف · ${profile.hostAgencyName}` : 'مضيف رسمي'}</span>
                </span>
              )}
              {profile.activeEntryName && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-0.5">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>{profile.activeEntryName}</span>
                </span>
              )}
              {profile.age && (
                <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-0.5 font-mono-num">
                  {profile.age} سنة
                </span>
              )}
              {countryInfo && (
                <span className="inline-flex items-center rounded-full bg-sky-50 border border-sky-200 text-sky-700 px-2.5 py-0.5">
                  {countryInfo.flag} {countryInfo.label}
                </span>
              )}
              {profile.gender === 'female' && !profile.femaleVerifiedBadge && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5">
                  <Gem className="w-3 h-3 text-slate-400" />
                  <span>بانتظار التوثيق الصوتي</span>
                </span>
              )}
            </div>
          </div>

          {isInsideActiveRoom && !isSelf && currentUser ? (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={togglingFollow}
                onClick={handleToggleFollow}
                className={`min-h-[46px] rounded-2xl border px-2 py-2 text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer transition disabled:opacity-50 ${
                  followRel.iFollowThem
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                }`}
              >
                {followRel.iFollowThem ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <UserPlus className="w-3.5 h-3.5" />
                )}
                <span>{followRel.iFollowThem ? 'متابَع' : 'متابعة'}</span>
              </button>
              <button
                type="button"
                onClick={handlePrivateChat}
                className="min-h-[46px] rounded-2xl bg-emerald-600 text-white px-2 py-2 text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>محادثة خاصة</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  closeMiniProfile();
                  window.dispatchEvent(new Event('sada:minimize'));
                  navigate(`/profile/${encodeURIComponent(profile.id)}`);
                }}
                className="min-h-[46px] rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-2 py-2 text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
              >
                <UserRound className="w-3.5 h-3.5" />
                <span>الملف الشخصي</span>
              </button>
            </div>
          ) : (
          <div className="flex items-center gap-2">
            {!isInsideActiveRoom && (
              <button
                type="button"
                onClick={handlePrivateChat}
                className="emerald-btn flex-1 min-h-[46px] rounded-2xl px-4 py-2.5 text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{isSelf ? 'فتح ملفي الشخصي' : 'مراسلة خاصة'}</span>
              </button>
            )}
            {!isSelf && currentUser && (
              <button
                type="button"
                disabled={togglingFollow}
                onClick={handleToggleFollow}
                className={`min-h-[46px] rounded-2xl border px-3.5 py-2.5 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-50 ${
                  followRel.isMutual
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : followRel.iFollowThem
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                }`}
              >
                {followRel.isMutual ? (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>أصدقاء 🤝</span>
                  </>
                ) : followRel.iFollowThem ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>متابع ✓</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>متابعة</span>
                  </>
                )}
              </button>
            )}
            {!isInsideActiveRoom && (
              <button
                type="button"
                onClick={handleGiftAction}
                className="gold-btn min-h-[46px] rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition shrink-0"
              >
                <Gift className="w-4 h-4" />
                <span>هدية</span>
              </button>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
