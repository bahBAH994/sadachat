import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Building2,
  CalendarCheck,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  Coins,
  Copy,
  Crown,
  Flame,
  Gem,
  Gift,
  LogOut,
  MapPin,
  MessageCircleHeart,
  Mic2,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMiniProfile } from '../context/MiniProfileContext';
import { AVATAR_CHOICES } from '../lib/assets';
import { getUserPublicProfileFromSupabase, updateProfileInSupabase } from '../lib/sadaAuth';
import {
  ARAB_COUNTRIES,
  VIP_TIER_CONFIGS,
  formatShortNumericId,
  getUserVipTierInfo,
  isSuperAdminUser,
  STORE_3D_ITEMS,
  VIP_IDS_CATALOG,
} from '../lib/sadaCatalog';
import { getPlatformState, savePlatformState } from '../lib/sadaMappers';
import {
  getProfileSocialListFromSupabase,
  getUserGiftLevelsFromSupabase,
} from '../lib/sadaSocialService';
import {
  checkInDailyHostTaskInSupabase,
  claimHostTaskMilestoneInSupabase,
  getHostTasksOverviewFromSupabase,
} from '../lib/sadaWalletService';
import { supabase } from '../lib/supabase';
import type { HostTaskProgress, User } from '../types';
import { AvatarWithFrame, VipTierBadge, VipUserName } from '../components/AvatarWithFrame';
import {
  FemaleVerifiedBadge,
  FemaleVoiceVerificationCard,
} from '../components/FemaleVoiceVerificationCard';
import { PWAInstallButton } from '../components/PWAInstallButton';

async function compressStaticImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذّر قراءة الصورة.'));
    reader.onload = () => {
      const rawUrl = String(reader.result);
      if (file.size <= 750_000) {
        resolve(rawUrl);
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(rawUrl);
      img.onload = () => {
        const maxSide = 512;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}

type SocialListKind = 'friends' | 'followers' | 'following' | 'visitors';

const SOCIAL_MODAL_TITLES: Record<SocialListKind, string> = {
  friends: 'الأصدقاء (متابعة متبادلة)',
  followers: 'المتابِعون',
  following: 'الأشخاص الذين أتابعهم',
  visitors: 'زوار ملفي الشخصي',
};

export const ProfilePage: React.FC = () => {
  const { user, updateLocalUser, logout } = useAuth();
  const { openMiniProfile } = useMiniProfile();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || 'host_male');
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null);
  const [gender, setGender] = useState<'female' | 'male'>(user?.gender || 'male');
  const [isHost, setIsHost] = useState<boolean>(Boolean(user?.isHost));
  const [saving, setSaving] = useState(false);
  const [savingPendingAvatar, setSavingPendingAvatar] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPremiumIdModal, setShowPremiumIdModal] = useState(false);
  const [buyingPremiumId, setBuyingPremiumId] = useState(false);
  const showEditModalRef = useRef(false);
  showEditModalRef.current = showEditModal;
  const [copiedId, setCopiedId] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const [userFollows, setUserFollows] = useState<Record<string, string[]>>({});
  const [userVisitors, setUserVisitors] = useState<Record<string, string[]>>({});
  const [giftLevels, setGiftLevels] = useState({ sendLevel: 1, receiveLevel: 1 });

  // Social users modal
  const [socialModalKind, setSocialModalKind] = useState<SocialListKind | null>(null);
  const [socialUsers, setSocialUsers] = useState<User[]>([]);
  const [loadingSocial, setLoadingSocial] = useState(false);

  // Host Tasks 15-day streak modal
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [taskProgress, setTaskProgress] = useState<HostTaskProgress>({
    streakDays: 0,
    lastCheckInDate: null,
    claimedDay7: false,
    claimedDay15: false,
  });
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [taskBusy, setTaskBusy] = useState(false);

  const loadProfileSocialAndUser = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [freshUser, state, levels, tasks] = await Promise.all([
        getUserPublicProfileFromSupabase(user.id).catch(() => null),
        getPlatformState().catch(() => null),
        getUserGiftLevelsFromSupabase(user.id).catch(() => null),
        getHostTasksOverviewFromSupabase(user.id).catch(() => null),
      ]);
      if (freshUser) {
        updateLocalUser(freshUser);
        setDisplayName(freshUser.displayName);
        setBio(freshUser.bio);
        setGender(freshUser.gender || 'male');
        setIsHost(Boolean(freshUser.isHost));
        if (!showEditModalRef.current) {
          setAvatarUrl(freshUser.avatarUrl);
        }
      }
      if (state?.settings) {
        setUserFollows(state.settings.userFollows || {});
        setUserVisitors(state.settings.userVisitors || {});
      }
      if (levels) {
        setGiftLevels({
          sendLevel: levels.sendLevel,
          receiveLevel: levels.receiveLevel,
        });
      }
      if (tasks) {
        setTaskProgress(tasks.progress);
        setCheckedInToday(tasks.checkedInToday);
      }
    } catch {
      // ignore transient error
    }
  }, [user?.id, updateLocalUser]);

  useEffect(() => {
    void loadProfileSocialAndUser();
    if (!user?.id) return;
    const channel = supabase
      .channel(`sada-profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sada_platform_state' },
        () => {
          void loadProfileSocialAndUser();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sada_users', filter: `id=eq.${user.id}` },
        (payload) => {
          const newRow = payload.new as Record<string, unknown> | undefined;
          const oldRow = payload.old as Record<string, unknown> | undefined;
          if (newRow && oldRow && Object.keys(oldRow).length > 0) {
            const changedKeys = Object.keys(newRow).filter(
              (k) => JSON.stringify(newRow[k]) !== JSON.stringify(oldRow[k])
            );
            if (
              changedKeys.length === 0 ||
              (changedKeys.length === 1 && changedKeys[0] === 'last_seen')
            ) {
              return;
            }
          }
          void loadProfileSocialAndUser();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadProfileSocialAndUser, user?.id]);

  const socialCounts = useMemo(() => {
    if (!user?.id) return { friends: 0, followers: 0, following: 0, visitors: 0 };
    const myFollowing = Array.isArray(userFollows[user.id])
      ? userFollows[user.id].filter((id) => id !== user.id)
      : [];
    let followers = 0;
    for (const [uid, list] of Object.entries(userFollows)) {
      if (uid !== user.id && Array.isArray(list) && list.includes(user.id)) {
        followers += 1;
      }
    }
    const friends = myFollowing.filter(
      (fid) => Array.isArray(userFollows[fid]) && userFollows[fid].includes(user.id)
    ).length;
    const visitors = Array.isArray(userVisitors[user.id])
      ? userVisitors[user.id].filter((id) => id !== user.id).length
      : 0;
    return {
      friends,
      followers,
      following: myFollowing.length,
      visitors,
    };
  }, [user?.id, userFollows, userVisitors]);

  if (!user) return null;

  const numericId = formatShortNumericId(user.id);
  const xpNextLevel = Math.pow(user.level, 2) * 120;
  const xpProgress = Math.min(100, Math.round((user.xp / Math.max(1, xpNextLevel)) * 100));
  const vipInfo = getUserVipTierInfo(user);
  const active3D = STORE_3D_ITEMS.find((i) => i.id === user.frameId) || STORE_3D_ITEMS[0];
  const userCountry = user.country
    ? ARAB_COUNTRIES.find((c) => c.code === user.country)
    : null;
  const canViewMyAgency = Boolean(user.isAgent || user.is_admin);

  const handleCopyId = () => {
    navigator.clipboard?.writeText(numericId).catch(() => {});
    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 1600);
  };

  const handlePurchasePremiumId = async (vipId: (typeof VIP_IDS_CATALOG)[number]) => {
    if (buyingPremiumId) return;
    if (user.coins < vipId.priceCoins) {
      setFeedback({ type: 'err', text: `رصيدك لا يكفي. سعر ID ${vipId.number} هو ${vipId.priceCoins.toLocaleString('en-US')} كوينز.` });
      return;
    }
    setBuyingPremiumId(true);
    setFeedback(null);
    try {
      const state = await getPlatformState({ forceRefresh: true });
      const customVipIds = { ...(state.settings.customVipIds || {}) };
      const alreadyOwned = Object.values(customVipIds).includes(vipId.number);
      if (alreadyOwned) throw new Error(`رقم ID ${vipId.number} مستخدم مسبقاً.`);

      const nextCoins = user.coins - vipId.priceCoins;
      const { error } = await supabase.from('sada_users').update({ coins: nextCoins }).eq('id', user.id);
      if (error) throw new Error(error.message);

      customVipIds[user.id] = vipId.number;
      await savePlatformState({
        settings: { ...state.settings, customVipIds },
      });
      updateLocalUser({ ...user, coins: nextCoins });
      setShowPremiumIdModal(false);
      setFeedback({ type: 'ok', text: `تم شراء ID المميز ${vipId.number} بنجاح!` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'تعذّر شراء ID المميز.' });
    } finally {
      setBuyingPremiumId(false);
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const isAnimated =
      file.type === 'image/gif' ||
      file.type === 'image/webp' ||
      /\.(gif|webp)$/i.test(file.name);

    if (isAnimated && file.size > 4_500_000) {
      setFeedback({
        type: 'err',
        text: 'حجم الصورة المتحركة كبير جداً (الحد الأقصى 4.5 ميجابايت).',
      });
      return;
    }

    setUploadingAvatar(true);
    setFeedback(null);
    try {
      let finalDataUrl: string;
      if (isAnimated) {
        finalDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('تعذّر قراءة الصورة المتحركة.'));
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(file);
        });
      } else {
        finalDataUrl = await compressStaticImageToDataUrl(file);
      }

      if (showEditModal) {
        setAvatarUrl(finalDataUrl);
      } else {
        // Preview locally first; persist ONLY when user clicks "حفظ التعديلات"
        setPendingAvatarUrl(finalDataUrl);
      }
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر قراءة الصورة الشخصية.',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleConfirmPendingAvatar = async () => {
    if (!pendingAvatarUrl) return;
    setSavingPendingAvatar(true);
    setFeedback(null);
    try {
      const updated = await updateProfileInSupabase(user, { avatarUrl: pendingAvatarUrl });
      updateLocalUser(updated);
      setAvatarUrl(updated.avatarUrl);
      setPendingAvatarUrl(null);
      setFeedback({
        type: 'ok',
        text: 'تم حفظ وتحديث صورتك الشخصية بنجاح في قاعدة البيانات والمايكات!',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر حفظ الصورة الشخصية.',
      });
    } finally {
      setSavingPendingAvatar(false);
    }
  };

  const handleCancelPendingAvatar = () => {
    setPendingAvatarUrl(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const updatedUser = await updateProfileInSupabase(user, {
        displayName,
        bio,
        avatarUrl,
        gender,
        isHost,
      });
      updateLocalUser(updatedUser);
      setPendingAvatarUrl(null);
      setShowEditModal(false);
      setFeedback({ type: 'ok', text: 'تم حفظ تعديلات ملفك الشخصي بنجاح.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر حفظ التعديلات.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSocialModal = async (kind: SocialListKind) => {
    setSocialModalKind(kind);
    setLoadingSocial(true);
    try {
      const list = await getProfileSocialListFromSupabase(user.id, kind);
      setSocialUsers(list);
    } catch {
      setSocialUsers([]);
    } finally {
      setLoadingSocial(false);
    }
  };

  const handleDailyCheckIn = async () => {
    setTaskBusy(true);
    setFeedback(null);
    try {
      const res = await checkInDailyHostTaskInSupabase(user);
      setTaskProgress(res.progress);
      setCheckedInToday(res.checkedInToday);
      setFeedback({
        type: 'ok',
        text: `تم تسجيل حضورك اليومي بنجاح! سلسلتك الحالية: ${res.progress.streakDays} يوماً متتالياً.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر تسجيل الحضور اليومي.',
      });
    } finally {
      setTaskBusy(false);
    }
  };

  const handleClaimMilestone = async (milestone: 7 | 15) => {
    setTaskBusy(true);
    setFeedback(null);
    try {
      const res = await claimHostTaskMilestoneInSupabase(user, milestone);
      updateLocalUser(res.user);
      setTaskProgress(res.progress);
      setFeedback({ type: 'ok', text: res.rewardMessage });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر استلام المكافأة.',
      });
    } finally {
      setTaskBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-full bg-[#F5F6FA]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.gif,.webp"
        onChange={handleAvatarFileChange}
        className="hidden"
      />

      {/* Dark Royal Profile Top Header */}
      <section className="relative bg-gradient-to-b from-[#090D16] via-[#12192B] to-[#1A2438] text-white pt-4 pb-12 px-4 overflow-hidden">
        <div className="max-w-3xl mx-auto space-y-5 relative z-10">
          {/* Top utility row */}
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setDisplayName(user.displayName);
                setBio(user.bio);
                setAvatarUrl(pendingAvatarUrl || user.avatarUrl);
                setGender(user.gender || 'male');
                setIsHost(Boolean(user.isHost));
                setShowEditModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 px-3 py-1.5 font-bold text-slate-200 cursor-pointer transition"
            >
              <Settings className="w-3.5 h-3.5 text-[#FCE9A6]" />
              <span>تعديل الحساب</span>
            </button>

            <div className="flex items-center gap-2">
              {isSuperAdminUser(user) && (
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="inline-flex items-center gap-1 rounded-full bg-[#D4AF37]/25 border border-[#D4AF37]/50 px-3 py-1 text-[11px] font-bold text-[#FCE9A6] cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>الإدارة العليا</span>
                </button>
              )}
              <span className="inline-flex items-center gap-1 text-slate-300 font-semibold">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {userCountry ? `${userCountry.flag} ${userCountry.label}` : 'صَدَى - SADA'}
                </span>
              </span>
            </div>
          </div>

          {/* Main Identity Row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {/* Circular Avatar + Golden Camera Icon */}
              <div className="relative shrink-0">
                <AvatarWithFrame
                  src={pendingAvatarUrl || user.avatarUrl}
                  alt={user.displayName}
                  frameId={user.frameId}
                  vipTier={vipInfo.key}
                  size="xl"
                />
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  title="معاينة صورة جديدة (يُحفظ بعد الضغط على حفظ التعديلات)"
                  className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-gradient-to-br from-[#FCE9A6] via-[#D4AF37] to-[#A67C1E] text-[#070913] border-2 border-[#0B0F1A] shadow-[0_0_16px_rgba(212,175,55,0.75)] flex items-center justify-center cursor-pointer hover:scale-105 transition disabled:opacity-60 z-20"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center flex-wrap gap-1.5">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-white truncate">
                    <VipUserName name={user.displayName} vipTier={vipInfo.key} />
                  </h1>
                  <VipTierBadge vipTier={vipInfo.key} />
                  <FemaleVerifiedBadge badge={user.femaleVerifiedBadge} />
                  {user.gender === 'female' &&
                    !user.is_admin &&
                    user.femaleVoiceStatus !== 'verified' && (
                      <button
                        type="button"
                        onClick={() => {
                          document
                            .getElementById('female-voice-verification-card')
                            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-pink-500/25 hover:bg-pink-500/35 border border-pink-300/60 px-2.5 py-0.5 text-[11px] font-extrabold text-pink-100 cursor-pointer transition"
                      >
                        <Mic2 className="w-3 h-3 text-pink-200" />
                        <span>توثيق الحساب</span>
                      </button>
                    )}
                </div>

                {/* ID + Separate Send & Receive Level Badges */}
                <div className="flex items-center flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="inline-flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/15 px-2.5 py-0.5 text-xs font-mono-num text-slate-200 cursor-pointer"
                  >
                    <span>ID: {numericId}</span>
                    {copiedId ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-300" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/my-level')}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500/25 border border-amber-300/50 px-2.5 py-0.5 text-[11px] font-extrabold text-[#FCE9A6] font-mono-num cursor-pointer"
                  >
                    <Gift className="w-3 h-3 text-amber-300" />
                    <span>داعم Lv.{giftLevels.sendLevel}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/my-level')}
                    className="inline-flex items-center gap-1 rounded-full bg-sky-500/25 border border-sky-300/50 px-2.5 py-0.5 text-[11px] font-extrabold text-sky-100 font-mono-num cursor-pointer"
                  >
                    <Crown className="w-3 h-3 text-sky-300" />
                    <span>مضيف Lv.{giftLevels.receiveLevel}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-300 line-clamp-1">{user.bio}</p>
              </div>
            </div>
          </div>

          {/* Pending Avatar Explicit Save / Cancel Bar */}
          {pendingAvatarUrl && (
            <div className="rounded-2xl bg-amber-500/15 border border-amber-300/50 p-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#FCE9A6]">
                معاينة الصورة الجديدة جاهزة — اضغط "حفظ التعديلات" لاعتمادها على حسابك والمايكات:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={savingPendingAvatar}
                  onClick={handleConfirmPendingAvatar}
                  className="emerald-btn rounded-xl px-4 py-1.5 text-xs font-extrabold cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingPendingAvatar ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelPendingAvatar}
                  className="rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* 4 Interactive Stats Row + Active 3D Card */}
          <div className="grid grid-cols-12 items-center gap-3 pt-1">
            <div className="col-span-7 grid grid-cols-4 gap-1 text-center">
              <button
                type="button"
                onClick={() => handleOpenSocialModal('friends')}
                className="space-y-0.5 rounded-xl py-1 hover:bg-white/10 transition cursor-pointer"
              >
                <span className="block text-base sm:text-lg font-extrabold font-mono-num">
                  {socialCounts.friends}
                </span>
                <span className="block text-[11px] text-slate-300">الأصدقاء</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenSocialModal('followers')}
                className="space-y-0.5 rounded-xl py-1 hover:bg-white/10 transition cursor-pointer"
              >
                <span className="block text-base sm:text-lg font-extrabold font-mono-num">
                  {socialCounts.followers}
                </span>
                <span className="block text-[11px] text-slate-300">المتابِعون</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenSocialModal('following')}
                className="space-y-0.5 rounded-xl py-1 hover:bg-white/10 transition cursor-pointer"
              >
                <span className="block text-base sm:text-lg font-extrabold font-mono-num">
                  {socialCounts.following}
                </span>
                <span className="block text-[11px] text-slate-300">أتابع</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenSocialModal('visitors')}
                className="space-y-0.5 rounded-xl py-1 hover:bg-white/10 transition cursor-pointer"
              >
                <span className="block text-base sm:text-lg font-extrabold font-mono-num">
                  {socialCounts.visitors}
                </span>
                <span className="block text-[11px] text-slate-300">زائر</span>
              </button>
            </div>

            <div className="col-span-5 flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/store')}
                className="rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 px-3.5 py-2.5 flex items-center gap-1.5 text-xs font-extrabold text-[#FCE9A6] cursor-pointer transition shadow-md"
              >
                <span className="text-base">{active3D.badgeGlyph}</span>
                <span>احصل على SVIP</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Crisp White Rounded Body */}
      <div className="max-w-3xl mx-auto -mt-6 relative z-20 rounded-t-[28px] bg-[#F5F6FA] px-4 pt-5 space-y-4">
        {feedback && (
          <div
            className={`rounded-2xl px-4 py-3 text-xs font-bold border ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* 4 Quick Icons Bar: مستواي - المتجر - الحقيبة - محفظة الألماس (عائلة محذوفة) */}
        <section className="light-card rounded-3xl p-4 grid grid-cols-4 gap-2 text-center">
          <button
            type="button"
            onClick={() => navigate('/my-level')}
            className="flex flex-col items-center gap-1.5 cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-300/70 flex items-center justify-center text-amber-700 group-hover:scale-105 transition">
              <Crown className="w-6 h-6" />
            </div>
            <span className="text-xs font-extrabold text-slate-800">مستواي</span>
            <span className="text-[10px] text-amber-600 font-mono-num font-bold">
              {xpProgress}% · S{giftLevels.sendLevel}/R{giftLevels.receiveLevel}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/store')}
            className="flex flex-col items-center gap-1.5 cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-200 border border-emerald-300/70 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition">
              <Store className="w-6 h-6" />
            </div>
            <span className="text-xs font-extrabold text-slate-800">المتجر</span>
            <span className="text-[10px] text-emerald-600 font-bold">إطارات وخلفيات</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/bag')}
            className="flex flex-col items-center gap-1.5 cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-200 border border-indigo-300/70 flex items-center justify-center text-indigo-700 group-hover:scale-105 transition">
              <Briefcase className="w-6 h-6" />
            </div>
            <span className="text-xs font-extrabold text-slate-800">الحقيبة</span>
            <span className="text-[10px] text-indigo-600 font-bold">ممتلكاتي</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/diamond-wallet')}
            className="flex flex-col items-center gap-1.5 cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-200 border border-sky-300/70 flex items-center justify-center text-sky-700 group-hover:scale-105 transition">
              <Gem className="w-6 h-6" />
            </div>
            <span className="text-xs font-extrabold text-slate-800">محفظة الألماس</span>
            <span className="text-[10px] text-sky-600 font-bold">أرباحي وسحبها</span>
          </button>
        </section>

        {/* Automatic VIP Level & Next-Tier Progress Card */}
        <section className="rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1B223C] to-[#0A0E1A] border border-[#D4AF37]/40 p-4 sm:p-5 text-white shadow-[0_14px_34px_-12px_rgba(15,23,42,0.45)] space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FCE9A6]/20 to-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center text-lg">
                {vipInfo.badgeGlyph}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold text-[#FCE9A6]">
                    مستوى الـ VIP التلقائي
                  </h2>
                  <VipTierBadge vipTier={vipInfo.key} />
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  {vipInfo.arabicTitle} · رصيد التأهل:{' '}
                  <span className="font-mono-num font-extrabold text-white">
                    {vipInfo.score.toLocaleString('en-US')}
                  </span>{' '}
                  عملة
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/wallet')}
              className="gold-btn min-h-[36px] rounded-xl px-3.5 py-1.5 text-[11px] font-extrabold cursor-pointer"
            >
              ترقية بالشحن ✦
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-300">
                {vipInfo.nextTier ? (
                  <>
                    المتبقي للوصول إلى{' '}
                    <span className="text-[#FCE9A6] font-extrabold">{vipInfo.nextTier.label}</span>:{' '}
                    <span className="font-mono-num text-emerald-300 font-extrabold">
                      {vipInfo.coinsToNext.toLocaleString('en-US')} عملة
                    </span>
                  </>
                ) : (
                  <span className="text-[#FEF08A] font-extrabold">
                    👑 لقد وصلت إلى القمة — SVIP الإمبراطوري!
                  </span>
                )}
              </span>
              <span className="font-mono-num text-[#FCE9A6] font-black">
                {vipInfo.progressPct}%
              </span>
            </div>

            <div className="h-3 w-full rounded-full bg-white/10 p-0.5 overflow-hidden border border-white/10">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${vipInfo.progressBarClass} transition-all duration-500`}
                style={{ width: `${Math.max(vipInfo.key === 'none' && vipInfo.score === 0 ? 4 : vipInfo.progressPct, 4)}%` }}
              />
            </div>

            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {VIP_TIER_CONFIGS.filter((t) => t.key !== 'none').map((tier) => {
                const unlocked = vipInfo.rank >= tier.rank;
                return (
                  <div
                    key={tier.key}
                    className={`rounded-xl px-2 py-1.5 text-center border transition ${
                      unlocked
                        ? 'bg-[#D4AF37]/20 border-[#D4AF37]/60 text-[#FCE9A6]'
                        : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  >
                    <p className="text-[10px] font-black truncate">
                      {tier.badgeGlyph} {tier.shortLabel}
                    </p>
                    <p className="text-[9px] font-mono-num opacity-90">
                      {tier.minScore.toLocaleString('en-US')}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Prominent Dual Wallet Summary Card */}
        <section className="light-card rounded-3xl p-4 sm:p-5 grid grid-cols-2 divide-x divide-x-reverse divide-slate-100">
          <button
            type="button"
            onClick={() => navigate('/wallet')}
            className="pl-3 text-right space-y-1.5 cursor-pointer group"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>رصيد الكوينز</span>
              <span className="text-slate-400 group-hover:text-emerald-600 flex items-center gap-0.5">
                الشحن
                <ChevronLeft className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Coins className="w-5 h-5" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono-num truncate">
                {user.coins.toLocaleString('en-US')}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/diamond-wallet')}
            className="pr-4 text-right space-y-1.5 cursor-pointer group"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>رصيد الألماس</span>
              <span className="text-slate-400 group-hover:text-sky-600 flex items-center gap-0.5">
                محفظة الألماس
                <ChevronLeft className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 shrink-0">
                <Gem className="w-5 h-5" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono-num truncate">
                {user.diamonds.toLocaleString('en-US')}
              </span>
            </div>
          </button>
        </section>

        {/* Female Voice Verification Card exclusively inside Profile ("أنا") */}
        {user.gender === 'female' && (
          <div id="female-voice-verification-card">
            <FemaleVoiceVerificationCard />
          </div>
        )}

        {/* Feature Tiles: "وكالتي" visible ONLY for Agency Owners / Admin */}
        <section className="light-card rounded-3xl p-4 grid grid-cols-2 gap-3">
          {canViewMyAgency && (
            <button
              type="button"
              onClick={() => navigate('/agency?tab=my-agency')}
              className="rounded-2xl bg-emerald-50/90 hover:bg-emerald-100/80 border border-emerald-100 p-4 flex items-center justify-between cursor-pointer transition"
            >
              <span className="text-sm font-extrabold text-emerald-950">وكالتي</span>
              <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center text-emerald-600 shadow-sm">
                <Building2 className="w-5 h-5" />
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/agency?tab=host-center')}
            className="rounded-2xl bg-violet-50/90 hover:bg-violet-100/80 border border-violet-100 p-4 flex items-center justify-between cursor-pointer transition"
          >
            <span className="text-sm font-extrabold text-violet-950">مركز المضيف</span>
            <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center text-violet-600 shadow-sm">
              <Mic2 className="w-5 h-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setShowTasksModal(true)}
            className="rounded-2xl bg-amber-50/90 hover:bg-amber-100/80 border border-amber-100 p-4 flex items-center justify-between cursor-pointer transition"
          >
            <div className="text-right">
              <span className="block text-sm font-extrabold text-amber-950">مهام المضيف</span>
              <span className="block text-[10px] font-bold text-amber-700 font-mono-num">
                السلسلة: {taskProgress.streakDays}/15 يوم
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center text-amber-600 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/competitions?tab=referral')}
            className={`${
              !canViewMyAgency ? 'col-span-2' : ''
            } rounded-2xl bg-rose-50/90 hover:bg-rose-100/80 border border-rose-100 p-4 flex items-center justify-between cursor-pointer transition`}
          >
            <span className="text-sm font-extrabold text-rose-950">دعوة الأصدقاء</span>
            <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center text-rose-600 shadow-sm">
              <Gift className="w-5 h-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setShowPremiumIdModal(true)}
            className="col-span-2 rounded-2xl bg-sky-50/90 hover:bg-sky-100/80 border border-sky-100 p-4 flex items-center justify-between cursor-pointer transition"
          >
            <div className="text-right">
              <span className="block text-sm font-extrabold text-sky-950">شراء ID مميز</span>
              <span className="block text-[10px] font-bold text-sky-700">أرقام ملكية حصرية وكوينز</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center text-sky-600 shadow-sm">
              <Crown className="w-5 h-5" />
            </div>
          </button>
        </section>

        {/* Bottom Utility Row */}
        <section className="light-card rounded-3xl p-4 grid grid-cols-3 gap-2 text-center">
          <button
            type="button"
            onClick={() => {
              setDisplayName(user.displayName);
              setBio(user.bio);
              setAvatarUrl(pendingAvatarUrl || user.avatarUrl);
              setGender(user.gender || 'male');
              setIsHost(Boolean(user.isHost));
              setShowEditModal(true);
            }}
            className="flex flex-col items-center gap-1.5 text-slate-600 hover:text-emerald-600 cursor-pointer transition"
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-xs font-bold">الحساب</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/wallet')}
            className="flex flex-col items-center gap-1.5 text-slate-600 hover:text-emerald-600 cursor-pointer transition"
          >
            <Coins className="w-5 h-5" />
            <span className="text-xs font-bold">الشحن USDT</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex flex-col items-center gap-1.5 text-rose-500 hover:text-rose-700 cursor-pointer transition"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-xs font-bold">خروج</span>
          </button>
        </section>

        <div className="flex justify-center">
          <PWAInstallButton variant="full" />
        </div>
      </div>

      {/* Social List Modal (Friends / Followers / Following / Visitors) */}
      {socialModalKind && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          onClick={() => setSocialModalKind(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[80vh] flex flex-col rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden text-slate-900"
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <h2 className="text-sm sm:text-base font-extrabold">
                  {SOCIAL_MODAL_TITLES[socialModalKind]}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSocialModalKind(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto no-scrollbar space-y-2.5 flex-1">
              {loadingSocial ? (
                <p className="text-xs text-center text-slate-400 py-8">جارٍ التحميل...</p>
              ) : socialUsers.length === 0 ? (
                <p className="text-xs text-center text-slate-500 py-8">
                  لا يوجد مستخدمون مسجلون في هذه القائمة حالياً.
                </p>
              ) : (
                socialUsers.map((person) => (
                  <div
                    key={person.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-3 flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSocialModalKind(null);
                        openMiniProfile(person.id, person);
                      }}
                      className="flex items-center gap-3 min-w-0 flex-1 text-right cursor-pointer"
                    >
                      <AvatarWithFrame
                        src={person.avatarUrl}
                        alt={person.displayName}
                        frameId={person.frameId}
                        vipTier={getUserVipTierInfo(person).key}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                            <VipUserName name={person.displayName} vipTier={getUserVipTierInfo(person).key} />
                          </p>
                          <VipTierBadge vipTier={getUserVipTierInfo(person).key} compact />
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono-num">
                          ID: {formatShortNumericId(person.id)} · Lv.{person.level}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSocialModalKind(null);
                        navigate(`/messages?to=${person.id}`);
                      }}
                      className="rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 text-[11px] font-extrabold text-emerald-700 cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <MessageCircleHeart className="w-3.5 h-3.5" />
                      <span>مراسلة</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Host Tasks 15-Day Streak Modal ("مهام المضيف") */}
      {showTasksModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          onClick={() => setShowTasksModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[88vh] overflow-y-auto no-scrollbar rounded-3xl bg-white border border-slate-200 p-5 sm:p-6 space-y-5 shadow-2xl text-slate-900"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black">مهام المضيف اليومية (15 يوماً)</h2>
                  <p className="text-[11px] text-slate-500">
                    سجّل دخولك يومياً دون انقطاع لفتح الإطار والدخولية المجانية!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTasksModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Streak Progress Header */}
            <div className="rounded-2xl bg-gradient-to-r from-[#0F172A] to-[#064E3B] p-4 text-white flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] text-amber-200 font-bold">سلسلة المواظبة الحالية</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Flame className="w-6 h-6 text-amber-400" />
                  <span className="text-2xl font-black font-mono-num">
                    {taskProgress.streakDays} / 15 يوم
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={checkedInToday || taskBusy}
                onClick={handleDailyCheckIn}
                className={`min-h-[42px] rounded-2xl px-4 text-xs font-extrabold cursor-pointer transition ${
                  checkedInToday
                    ? 'bg-white/15 text-emerald-200 border border-emerald-400/40'
                    : 'gold-btn'
                }`}
              >
                {checkedInToday ? 'تم تسجيل اليوم ✓' : 'تسجيل حضور اليوم'}
              </button>
            </div>

            {/* 15-Day Grid */}
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 15 }, (_, idx) => {
                const dayNum = idx + 1;
                const done = taskProgress.streakDays >= dayNum;
                const isMilestone = dayNum === 7 || dayNum === 15;
                return (
                  <div
                    key={dayNum}
                    className={`rounded-2xl p-2 text-center border text-xs font-mono-num ${
                      done
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                        : isMilestone
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <span className="block text-[10px] font-bold">يوم {dayNum}</span>
                    <span className="block text-base mt-0.5">
                      {done ? '✅' : dayNum === 7 ? '🎁' : dayNum === 15 ? '🏎️' : '⭐'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Milestone Rewards */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-rose-950">
                    🎁 مكافأة 7 أيام متتالية: إطار مهام المضيف (7 أيام)
                  </h3>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    إطار متحرك مجاني لمدة 7 أيام فور إتمام الأسبوع الأول.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={taskBusy || taskProgress.claimedDay7 || taskProgress.streakDays < 7}
                  onClick={() => handleClaimMilestone(7)}
                  className={`min-h-[38px] rounded-xl px-3.5 text-xs font-extrabold shrink-0 cursor-pointer ${
                    taskProgress.claimedDay7
                      ? 'bg-emerald-100 text-emerald-700'
                      : taskProgress.streakDays >= 7
                      ? 'emerald-btn'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {taskProgress.claimedDay7
                    ? 'تم الاستلام ✓'
                    : taskProgress.streakDays >= 7
                    ? 'استلام الإطار'
                    : `${taskProgress.streakDays}/7`}
                </button>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-amber-950">
                    🏎️ مكافأة 15 يوماً متتالية: دخولية مهام المضيف الملكية (7 أيام)
                  </h3>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    دخولية 3D فاخرة مجانية لمدة 7 أيام عند إتمام 15 يوماً متتالية.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={taskBusy || taskProgress.claimedDay15 || taskProgress.streakDays < 15}
                  onClick={() => handleClaimMilestone(15)}
                  className={`min-h-[38px] rounded-xl px-3.5 text-xs font-extrabold shrink-0 cursor-pointer ${
                    taskProgress.claimedDay15
                      ? 'bg-emerald-100 text-emerald-700'
                      : taskProgress.streakDays >= 15
                      ? 'gold-btn'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {taskProgress.claimedDay15
                    ? 'تم الاستلام ✓'
                    : taskProgress.streakDays >= 15
                    ? 'استلام الدخولية'
                    : `${taskProgress.streakDays}/15`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPremiumIdModal && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowPremiumIdModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#0B0F20] border border-sky-300/30 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-sky-100">شراء ID مميز</h3>
                <p className="text-[11px] text-slate-400">اختر رقماً ملكياً حصرياً</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPremiumIdModal(false)}
                className="w-9 h-9 rounded-full bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[55vh] overflow-y-auto no-scrollbar">
              {VIP_IDS_CATALOG.map((vipId) => (
                <button
                  key={vipId.id}
                  type="button"
                  disabled={buyingPremiumId}
                  onClick={() => void handlePurchasePremiumId(vipId)}
                  className="rounded-2xl border border-sky-300/25 bg-gradient-to-br from-sky-950/70 to-[#070913] p-3 text-right flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50"
                >
                  <div>
                    <span className="block text-lg font-black font-mono-num text-sky-100">{vipId.number}</span>
                    <span className="block text-[11px] text-slate-300">{vipId.title}</span>
                  </div>
                  <span className="rounded-full bg-sky-400/15 border border-sky-300/30 px-2 py-1 text-[10px] font-mono-num font-bold text-sky-100">
                    {vipId.priceCoins.toLocaleString('en-US')} كوينز
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile & Avatar Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          onClick={() => setShowEditModal(false)}
        >
          <form
            onSubmit={handleSave}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar rounded-3xl bg-white border border-slate-200 p-6 space-y-4 shadow-2xl text-slate-900"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900">تعديل الملف الشخصي</h2>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                الصورة الشخصية (اختر رمزاً أو ارفع صورة — تُحفظ فقط عند الضغط على حفظ التعديلات)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 px-3.5 py-2 text-xs font-extrabold text-amber-800 flex items-center gap-1.5 cursor-pointer hover:bg-amber-100 transition"
                >
                  <Camera className="w-4 h-4 text-amber-600" />
                  <span>رفع صورة / GIF من المعرض</span>
                </button>
                {AVATAR_CHOICES.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => setAvatarUrl(choice.id)}
                    className={`p-1 rounded-xl border cursor-pointer transition ${
                      avatarUrl === choice.id
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <img
                      src={choice.src}
                      alt={choice.label}
                      loading="lazy"
                      decoding="async"
                      className="w-9 h-9 rounded-lg object-cover"
                    />
                  </button>
                ))}
              </div>
              {avatarUrl !== user.avatarUrl && (
                <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تم اختيار صورة جديدة للمعاينة — اضغط "حفظ التعديلات" لتثبيتها.</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الاسم الظاهر
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                النبذة التعريفية
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  فئة الحساب
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender('male')}
                    className={`min-h-[40px] rounded-xl text-xs font-bold border cursor-pointer ${
                      gender === 'male'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    عضو
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('female')}
                    className={`min-h-[40px] rounded-xl text-xs font-bold border cursor-pointer ${
                      gender === 'female'
                        ? 'bg-pink-50 border-pink-400 text-pink-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    حساب نسائي 💎
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  وضع المضيف
                </label>
                <button
                  type="button"
                  onClick={() => setIsHost((prev) => !prev)}
                  className={`w-full min-h-[40px] rounded-xl text-xs font-bold border cursor-pointer px-3 ${
                    isHost
                      ? 'bg-sky-50 border-sky-400 text-sky-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {isHost ? 'مضيف وكالة مفعّل ✓' : 'تفعيل حساب كمضيف وكالة'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="emerald-btn w-full min-h-[46px] rounded-2xl py-2.5 text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
