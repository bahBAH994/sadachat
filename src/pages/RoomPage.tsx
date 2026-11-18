import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Ban,
  ClipboardList,
  Crown,
  Gamepad2,
  Gift,
  Heart,
  Lock,
  Mail,
  MessageCircle,
  MessageSquareText,
  Mic,
  MicOff,
  Minimize2,
  Music,
  Send,
  Settings,
  Shield,
  Smile,
  Sparkles,
  Trophy,
  UserMinus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { MessagesPage } from './MessagesPage';
import { useAuth } from '../context/AuthContext';
import { useActiveRoom } from '../context/ActiveRoomContext';
import { useMiniProfile } from '../context/MiniProfileContext';
import { resolveAsset } from '../lib/assets';
import {
  ROOM_REACTION_EMOJIS,
  formatCompactMetric,
  formatShortNumericId,
} from '../lib/sadaCatalog';
import { getPlatformState } from '../lib/sadaMappers';
import { toggleFollowAgencyInSupabase } from '../lib/sadaSocialService';
import type { GiftItem, RoomSeat } from '../types';
import { AvatarWithFrame } from '../components/AvatarWithFrame';
import { DragonCinemaOverlay } from '../components/DragonCinemaOverlay';
import { DragonStageBackdrop } from '../components/DragonStageBackdrop';
import { FemaleVerifiedBadge } from '../components/FemaleVoiceVerificationCard';
import { LuckyWheelModal } from '../components/LuckyWheelModal';
import { RoomExitModal } from '../components/RoomExitModal';
import { RoomGamesModal } from '../components/RoomGamesModal';
import { RoomGiftDrawer } from '../components/RoomGiftDrawer';
import { RoomMusicModal } from '../components/RoomMusicModal';
import { RoomSettingsModal } from '../components/RoomSettingsModal';

const COMBO_DURATION_MS = 3000;
const DICE_GLYPHS = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

interface ComboSession {
  gift: GiftItem;
  targetUserIds: string[];
  quantity: number;
  comboCount: number;
  expiresAt: number;
}

export const RoomPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateLocalUser } = useAuth();
  const { openMiniProfile } = useMiniProfile();

  const {
    activeRoomId,
    room,
    extras,
    gifts,
    wheelSegments,
    wheelCost,
    loading,
    error,
    clearError,
    isMinimized,
    mySeat,
    canManage,
    isOwnerOrAdmin,
    micActive,
    micDenied,
    manualSpeakPulse,
    presenceMembers,
    liveListenersCount,
    topGifters,
    supportAndPlayLeaderboard,
    totalVolumeCoins,
    giftBanner,
    wheelBanner,
    entryBanner,
    flyingGifts,
    fullscreenGift,
    seatEmojis,
    musicState,
    musicVolume,
    musicMutedLocally,
    roomAudioMuted,
    setMusicVolume,
    setMusicMutedLocally,
    setRoomAudioMuted,
    minimizeRoom,
    leaveActiveRoom,
    handleSeatClick,
    handleToggleLock,
    handleToggleMute,
    handleManualSpeakToggle,
    handleRequestMicAccess,
    sendChat,
    sendGiftBatch,
    sendSeatEmoji,
    updateRoomFromWheel,
    updateSettings,
    runAdminAction,
    playUploadedMusic,
    toggleMusicPlayPause,
    stopRoomMusic,
    addPlayVolume,
    giftTargetRequest,
    clearGiftTargetRequest,
  } = useActiveRoom();

  const [chatText, setChatText] = useState('');
  const [chatFilter, setChatFilter] = useState<'all' | 'chat'>('all');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftInitialTargets, setGiftInitialTargets] = useState<string[] | undefined>(
    undefined
  );
  const [sendingGift, setSendingGift] = useState(false);

  const [comboSession, setComboSession] = useState<ComboSession | null>(null);
  const [comboRemainingMs, setComboRemainingMs] = useState<number>(0);

  const [showWheelModal, setShowWheelModal] = useState(false);
  const [showGamesOverlay, setShowGamesOverlay] = useState(false);
  const [showInboxOverlay, setShowInboxOverlay] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'agency' | 'members' | 'logs'>(
    'agency'
  );
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [seatActionTarget, setSeatActionTarget] = useState<RoomSeat | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isFollowingAgency, setIsFollowingAgency] = useState(false);
  const [heartBurstTick, setHeartBurstTick] = useState(0);
  const [ownedBackgrounds, setOwnedBackgrounds] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.id || !room?.id) return;
    getPlatformState()
      .then((state) => {
        const followed = state.settings.userFollowedAgencies?.[user.id] || [];
        setIsFollowingAgency(followed.includes(room.id));
        const ownedBgs = state.settings.userOwnedBackgrounds?.[user.id] || [];
        setOwnedBackgrounds(ownedBgs);
      })
      .catch(() => {});
  }, [user?.id, room?.id]);

  // Open room gift drawer directly targeting user when clicked from Mini Profile
  useEffect(() => {
    if (!giftTargetRequest) return;
    setGiftInitialTargets([giftTargetRequest.userId]);
    setShowGiftModal(true);
    clearGiftTargetRequest();
  }, [giftTargetRequest, clearGiftTargetRequest]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const giftBtnRef = useRef<HTMLButtonElement | null>(null);
  const headerAnchorRef = useRef<HTMLDivElement | null>(null);
  const seatRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2600);
  };

  const isMinimizedRef = useRef(isMinimized);
  const activeRoomIdRef = useRef(activeRoomId);
  isMinimizedRef.current = isMinimized;
  activeRoomIdRef.current = activeRoomId;

  // Scroll chat smoothly when room is visible
  useEffect(() => {
    if (isMinimized) return;
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isMinimized, room?.messages.length]);

  // Combo circular countdown ticker (3.0s)
  useEffect(() => {
    if (!comboSession) {
      setComboRemainingMs(0);
      return;
    }
    const updateTicker = () => {
      const left = comboSession.expiresAt - Date.now();
      if (left <= 0) {
        setComboSession(null);
        setComboRemainingMs(0);
      } else {
        setComboRemainingMs(left);
      }
    };
    updateTicker();
    const timer = window.setInterval(updateTicker, 50);
    return () => window.clearInterval(timer);
  }, [comboSession]);

  // History State Trap: Push { inRoom: true } on enter/restore and intercept hardware Back
  useEffect(() => {
    if (!activeRoomId || isMinimized) return;

    if (!window.history.state?.inRoom) {
      window.history.pushState({ inRoom: true }, '');
    }

    const handlePopState = () => {
      if (isMinimizedRef.current || !activeRoomIdRef.current) return;
      setShowExitModal(true);
      window.setTimeout(() => {
        if (!isMinimizedRef.current && activeRoomIdRef.current && !window.history.state?.inRoom) {
          window.history.pushState({ inRoom: true }, '');
        }
      }, 0);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeRoomId, isMinimized]);

  const topSpeakerSeatIndex = useMemo(() => {
    if (!room?.seats?.length) return -1;
    let bestIdx = -1;
    let bestVal = 0;
    for (const s of room.seats) {
      if (s.userId && (s.receivedDiamonds || 0) > bestVal) {
        bestVal = s.receivedDiamonds || 0;
        bestIdx = s.seatIndex;
      }
    }
    if (bestIdx === -1) {
      const firstSeated = room.seats.find((s) => s.userId);
      return firstSeated ? firstSeated.seatIndex : -1;
    }
    return bestIdx;
  }, [room?.seats]);

  const handleFollowAgency = async () => {
    if (!room || !user) return;
    setHeartBurstTick((t) => t + 1);
    try {
      const res = await toggleFollowAgencyInSupabase(user.id, room.id);
      setIsFollowingAgency(res.following);
      const shortId = formatShortNumericId(room.id).slice(0, 6);
      navigator.clipboard?.writeText(shortId).catch(() => {});
      showToast(
        res.following
          ? `♥ تمت متابعة "${room.title}" وإضافتها لقسم الخاص بي (${shortId}) ✓`
          : 'تم إلغاء متابعة الوكالة'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذّر تحديث متابعة الوكالة');
    }
  };

  const micRows = useMemo(() => {
    const seats = room?.seats || [];
    const total = seats.length;
    if (total === 5) {
      return [
        { seats: seats.slice(0, 1), cols: 1, isHero5: true },
        { seats: seats.slice(1, 5), cols: 4, isHero5: false },
      ];
    }
    if (total === 10) {
      return [
        { seats: seats.slice(0, 2), cols: 2, isHero5: false },
        { seats: seats.slice(2, 6), cols: 4, isHero5: false },
        { seats: seats.slice(6, 10), cols: 4, isHero5: false },
      ];
    }
    const rows: Array<{ seats: RoomSeat[]; cols: number; isHero5: boolean }> = [];
    for (let i = 0; i < total; i += 5) {
      rows.push({ seats: seats.slice(i, i + 5), cols: 5, isHero5: false });
    }
    return rows;
  }, [room?.seats]);

  const filteredMessages = useMemo(() => {
    const list = room?.messages || [];
    if (chatFilter === 'chat') {
      return list.filter((m) => m.type === 'chat');
    }
    return list;
  }, [chatFilter, room?.messages]);

  const handleSeatInteraction = async (seat: RoomSeat) => {
    if (!user || !room) return;
    if (seat.isLocked) {
      if (canManage) {
        await handleToggleLock(seat.seatIndex, seat.isLocked);
        showToast(`تم فتح المقعد ${seat.seatIndex + 1}`);
      }
      return;
    }

    if (!seat.userId) {
      await handleSeatClick(seat.seatIndex);
      return;
    }

    if (seat.userId === user.id || canManage) {
      setSeatActionTarget(seat);
      return;
    }

    openMiniProfile(seat.userId, {
      displayName: seat.displayName || undefined,
      avatarUrl: seat.avatarUrl || undefined,
      frameId: seat.frameId || undefined,
      level: seat.level || 1,
      femaleVerifiedBadge: seat.femaleVerifiedBadge || null,
    });
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    const text = chatText.trim();
    setChatText('');
    setShowEmojiPicker(false);
    await sendChat(text);
  };

  const handleSendGiftBatch = async (
    giftId: string,
    targetUserIds: string[],
    quantity: number
  ) => {
    if (!room) return;
    const pickedGift = gifts.find((g) => g.id === giftId);
    setSendingGift(true);
    try {
      await sendGiftBatch(giftId, targetUserIds, quantity, 1);
      setShowGiftModal(false);
      if (pickedGift) {
        setComboSession({
          gift: pickedGift,
          targetUserIds,
          quantity,
          comboCount: 1,
          expiresAt: Date.now() + COMBO_DURATION_MS,
        });
        setComboRemainingMs(COMBO_DURATION_MS);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذّر إرسال الهدية');
    } finally {
      setSendingGift(false);
    }
  };

  const handleComboTap = async () => {
    if (!comboSession || !user) return;
    const batchCost =
      comboSession.gift.coinsCost *
      comboSession.quantity *
      Math.max(1, comboSession.targetUserIds.length);
    if (user.coins < batchCost) {
      setComboSession(null);
      showToast('رصيد الكوينز لا يكفي للاستمرار في الـ Combo');
      return;
    }
    const nextCombo = comboSession.comboCount + 1;
    const snapshot = comboSession;
    setComboSession({
      ...snapshot,
      comboCount: nextCombo,
      expiresAt: Date.now() + COMBO_DURATION_MS,
    });
    setComboRemainingMs(COMBO_DURATION_MS);
    try {
      await sendGiftBatch(
        snapshot.gift.id,
        snapshot.targetUserIds,
        snapshot.quantity,
        nextCombo
      );
    } catch (err) {
      setComboSession(null);
      showToast(err instanceof Error ? err.message : 'تعذّر متابعة الـ Combo');
    }
  };

  const handlePickSeatEmoji = (item: (typeof ROOM_REACTION_EMOJIS)[number]) => {
    setShowEmojiPicker(false);
    sendSeatEmoji({ emoji: item.emoji, label: item.label, isDice: item.isDice });
    if (!mySeat) {
      showToast(`${item.emoji} اصعد على المايك ليظهر التفاعل المتحرك فوق صورتك!`);
    }
  };

  const handleKeepMinimized = () => {
    setShowExitModal(false);
    isMinimizedRef.current = true;
    window.history.pushState({ inRoom: true }, '');
    minimizeRoom();
    navigate('/');
  };

  const handleConfirmLeave = async () => {
    setShowExitModal(false);
    isMinimizedRef.current = true;
    await leaveActiveRoom();
    navigate('/', { replace: true });
  };

  // Resolve exact viewport start & destination coordinates for flying gifts
  const resolveFlyStartPoint = () => {
    const rect = giftBtnRef.current?.getBoundingClientRect();
    if (rect) {
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return {
      x: typeof window !== 'undefined' ? window.innerWidth * 0.28 : 120,
      y: typeof window !== 'undefined' ? window.innerHeight - 44 : 620,
    };
  };

  const resolveRecipientPoint = (recipientId: string, idx: number) => {
    const seat = room?.seats.find((s) => s.userId === recipientId);
    if (seat) {
      const seatRect = seatRefs.current[seat.seatIndex]?.getBoundingClientRect();
      if (seatRect) {
        return {
          x: seatRect.left + seatRect.width / 2,
          y: seatRect.top + seatRect.height / 2,
        };
      }
    }
    const headerRect = headerAnchorRef.current?.getBoundingClientRect();
    if (headerRect) {
      return {
        x: headerRect.left + headerRect.width / 2,
        y: headerRect.top + headerRect.height / 2,
      };
    }
    return {
      x:
        (typeof window !== 'undefined' ? window.innerWidth / 2 : 180) +
        (idx % 3 - 1) * 36,
      y: 150,
    };
  };

  if (loading && !room) {
    if (isMinimized) return null;
    return (
      <div className="min-h-[100dvh] bg-[#0A0805] flex items-center justify-center p-6 text-center">
        <div className="royal-glass rounded-3xl px-7 py-5 text-sm font-extrabold text-[#FCE9A6]">
          جارٍ دخول الوكالة الملكية...
        </div>
      </div>
    );
  }

  if (!room) {
    if (isMinimized) return null;
    return (
      <div className="min-h-[100dvh] bg-[#0A0805] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <p className="text-rose-400 font-bold text-sm">
          {error || 'تعذّر فتح الوكالة الصوتية.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="gold-btn rounded-2xl px-6 py-2.5 text-sm cursor-pointer"
        >
          العودة إلى الوكالات
        </button>
      </div>
    );
  }

  const roomNumericId = formatShortNumericId(room.id).slice(0, 6);
  const comboProgress = Math.max(0, Math.min(1, comboRemainingMs / COMBO_DURATION_MS));
  const comboCircleRadius = 31;
  const comboCircumference = 2 * Math.PI * comboCircleRadius;

  return (
    <div
      className={
        isMinimized
          ? 'hidden pointer-events-none'
          : `relative min-h-[100dvh] h-[100dvh] w-full flex flex-col overflow-hidden text-white ${
              fullscreenGift ? 'animate-dragon-shake' : ''
            }`
      }
    >
      {/* Golden Dragon Dark Stage (or selected/uploaded agency backdrop) */}
      <DragonStageBackdrop coverImage={room.coverImage} />

      <div className="relative z-10 flex-1 flex flex-col max-w-2xl w-full mx-auto px-2.5 sm:px-4 pt-2 pb-2 min-h-0">
        {/* 1. ROOM TOP BAR */}
        <header className="flex items-center justify-between gap-1.5 shrink-0">
          {/* Right Side (RTL start): Agency Square Avatar, Title + Follow Button, ID */}
          <div
            ref={headerAnchorRef}
            className="flex items-center gap-1.5 min-w-0 bg-black/40 backdrop-blur-md border border-[#D4AF37]/35 rounded-2xl p-1 pl-2"
          >
            <button
              type="button"
              onClick={() => {
                if (canManage) {
                  setSettingsInitialTab('agency');
                  setShowSettingsModal(true);
                } else {
                  void handleFollowAgency();
                }
              }}
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-[#F3D37A]/70 shrink-0 cursor-pointer"
              title={canManage ? 'تغيير صورة أو إعدادات الوكالة' : room.title}
            >
              <img
                src={resolveAsset(room.hostAvatar)}
                alt={room.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <h1 className="text-[11px] sm:text-sm font-extrabold text-white truncate max-w-[88px] sm:max-w-[140px] leading-tight">
                  {room.title}
                </h1>
                <button
                  type="button"
                  onClick={() => void handleFollowAgency()}
                  className={`rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold shrink-0 cursor-pointer transition shadow ${
                    isFollowingAgency
                      ? 'bg-[#D4AF37] text-[#070913]'
                      : 'bg-gradient-to-r from-[#2CE376] to-[#0FA958] text-white hover:brightness-110'
                  }`}
                >
                  {isFollowingAgency ? 'متابَع ✓' : 'متابعة الوكالة'}
                </button>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-amber-200/90 font-mono-num">
                <span className="text-amber-400">🔥</span>
                <span>{roomNumericId}</span>
              </div>
            </div>
          </div>

          {/* Left Side (RTL end): Top 3 Gifters (1,2,3) + Live Counter + Heart (♥) + Settings (⚙️) + Minimize */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((rankIdx) => {
                const gifter = topGifters[rankIdx];
                const rankBorder =
                  rankIdx === 0
                    ? 'border-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.65)]'
                    : rankIdx === 1
                    ? 'border-slate-300'
                    : 'border-amber-600';
                const badgeBg =
                  rankIdx === 0
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-600 text-[#070913]'
                    : rankIdx === 1
                    ? 'bg-slate-200 text-slate-900'
                    : 'bg-amber-700 text-amber-100';

                return (
                  <button
                    key={rankIdx}
                    type="button"
                    onClick={() => {
                      if (gifter) {
                        openMiniProfile(gifter.userId, {
                          displayName: gifter.displayName,
                          avatarUrl: gifter.avatarUrl,
                          frameId: gifter.frameId,
                        });
                      } else {
                        setShowLeaderboardModal(true);
                      }
                    }}
                    className="relative flex flex-col items-center cursor-pointer group"
                    title={
                      gifter
                        ? `#${rankIdx + 1} ${gifter.displayName}: ${gifter.totalCoins.toLocaleString('en-US')}`
                        : `المركز ${rankIdx + 1}`
                    }
                  >
                    {/* Explicit Rank Number 1, 2, 3 */}
                    <span
                      className={`absolute -top-1 -right-1 z-10 w-3.5 h-3.5 rounded-full text-[8px] font-mono-num font-black flex items-center justify-center shadow ${badgeBg}`}
                    >
                      {rankIdx + 1}
                    </span>
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border-2 bg-black/50 flex items-center justify-center ${rankBorder}`}
                    >
                      {gifter ? (
                        <img
                          src={resolveAsset(gifter.avatarUrl)}
                          alt={gifter.displayName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Crown className="w-3.5 h-3.5 text-[#D4AF37]/60" />
                      )}
                    </div>
                    <span
                      className={`-mt-1.5 px-1 rounded-full text-[8px] font-mono-num font-extrabold leading-tight shadow ${badgeBg}`}
                    >
                      {gifter ? formatCompactMetric(gifter.totalCoins, true) : '0'}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                if (canManage) {
                  setSettingsInitialTab('members');
                  setShowSettingsModal(true);
                } else {
                  setShowLeaderboardModal(true);
                }
              }}
              className="flex items-center gap-0.5 bg-black/40 border border-white/15 rounded-full px-1.5 sm:px-2 py-1 text-[10px] sm:text-[11px] font-mono-num font-bold text-white cursor-pointer"
              title="المتواجدون الآن داخل الوكالة"
            >
              <span>{liveListenersCount}</span>
              <Users className="w-3 h-3 text-slate-200" />
            </button>

            {/* Heart Follow / Interact Button replacing (X) */}
            <button
              type="button"
              onClick={() => void handleFollowAgency()}
              className={`relative w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer transition active:scale-90 ${
                isFollowingAgency
                  ? 'bg-rose-600/35 border-rose-400 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.55)]'
                  : 'bg-black/45 hover:bg-rose-950/50 border-white/20 text-rose-200'
              }`}
              aria-label="متابعة وتفاعل"
              title="متابعة الوكالة / تفاعل"
            >
              <Heart className={`w-4 h-4 ${isFollowingAgency ? 'fill-rose-400 text-rose-400' : ''}`} />
              {heartBurstTick > 0 && (
                <motion.span
                  key={heartBurstTick}
                  initial={{ scale: 0.7, opacity: 1, y: 0 }}
                  animate={{ scale: 1.7, opacity: 0, y: -18 }}
                  transition={{ duration: 0.65 }}
                  className="pointer-events-none absolute text-rose-400 text-xs"
                >
                  ♥
                </motion.span>
              )}
            </button>

            {/* Agency Settings Icon right beside the Heart */}
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  setSettingsInitialTab('agency');
                  setShowSettingsModal(true);
                }}
                className="w-8 h-8 rounded-full bg-black/45 hover:bg-[#D4AF37]/25 border border-[#D4AF37]/50 text-[#FCE9A6] flex items-center justify-center cursor-pointer"
                aria-label="إعدادات الوكالة"
                title="إعدادات وإدارة الوكالة"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {/* Discreet Minimize / Leave trigger (complements hardware back trap) */}
            <button
              type="button"
              onClick={() => setShowExitModal(true)}
              className="w-7 h-7 rounded-full bg-black/35 hover:bg-black/60 border border-white/15 text-slate-200 flex items-center justify-center cursor-pointer"
              aria-label="تصغير أو خروج"
              title="احتفظ أو خروج"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* SUB-HEADER ROW: Trophy Leaderboard + Wheel + Mute Room | Device Music + Agent Mod Log */}
        <div className="flex items-center justify-between gap-1.5 mt-1.5 mb-1.5 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowLeaderboardModal(true)}
              className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#2D2007]/90 to-[#141008]/90 border border-[#F3D37A]/65 px-2.5 py-1 shadow-[0_0_14px_rgba(212,175,55,0.3)] cursor-pointer hover:brightness-110"
              title="تصنيف اللعب والدعم داخل الوكالة"
            >
              <Trophy className="w-3.5 h-3.5 text-[#FDE047]" />
              <span className="text-[11px] font-mono-num font-extrabold text-[#FCE9A6]">
                {formatCompactMetric(totalVolumeCoins)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowWheelModal(true)}
              className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-rose-700/80 to-amber-700/80 border border-amber-300/50 px-2 py-1 text-[10px] font-extrabold text-white cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-amber-200" />
              <span>دولاب</span>
            </button>

            {/* One-tap Mute Room Audio Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !roomAudioMuted;
                setRoomAudioMuted(next);
                showToast(
                  next ? '🔇 تم كتم صوت الروم من جهازك' : '🔊 تم تشغيل صوت الروم على جهازك'
                );
              }}
              className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-[10px] font-extrabold cursor-pointer transition ${
                roomAudioMuted
                  ? 'bg-rose-600/40 border-rose-400/75 text-rose-100 shadow-[0_0_10px_rgba(244,63,94,0.4)]'
                  : 'bg-black/45 border-white/20 text-slate-200 hover:border-[#D4AF37]/50'
              }`}
              title="كتم جميع أصوات الروم من جهازك"
            >
              {roomAudioMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-300" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-[#FCE9A6]" />
              )}
              <span>{roomAudioMuted ? 'صوت مكتوم' : 'كتم الروم'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowMusicModal(true)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold max-w-[125px] cursor-pointer ${
                musicState?.isPlaying
                  ? 'bg-[#D4AF37]/25 border-[#FCE9A6]/75 text-[#FCE9A6]'
                  : 'bg-black/50 border-white/20 text-slate-200 hover:border-[#D4AF37]/50'
              }`}
              title="تشغيل مقطع صوتي من جهازك"
            >
              <Music
                className={`w-3 h-3 shrink-0 ${
                  musicState?.isPlaying ? 'text-emerald-400 animate-pulse' : 'text-[#FCE9A6]'
                }`}
              />
              <span className="truncate">
                {musicState ? musicState.trackName : 'موسيقى الجهاز'}
              </span>
            </button>

            {isOwnerOrAdmin && (
              <button
                type="button"
                onClick={() => {
                  setSettingsInitialTab('logs');
                  setShowSettingsModal(true);
                }}
                className="inline-flex items-center gap-1 rounded-xl bg-amber-500/20 border border-[#F3D37A]/55 px-2.5 py-1 text-[10px] font-extrabold text-[#FCE9A6] hover:bg-amber-500/30 cursor-pointer"
                title="سجل حركة المشرفين (خاص بالوكيل)"
              >
                <ClipboardList className="w-3 h-3" />
                <span>سجل المشرفين</span>
              </button>
            )}
          </div>
        </div>

        {/* TOAST / ERROR FEEDBACK & CELEBRATION BANNERS */}
        <AnimatePresence>
          {(toastMsg || error) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onClick={clearError}
              className={`mb-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-center shrink-0 cursor-pointer ${
                error
                  ? 'bg-rose-950/90 border border-rose-400/60 text-rose-100'
                  : 'bg-emerald-950/90 border border-emerald-400/50 text-emerald-100'
              }`}
            >
              {error || toastMsg}
            </motion.div>
          )}
          {giftBanner && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12 }}
              className="mb-1.5 rounded-2xl border border-[#FCE9A6]/80 bg-gradient-to-r from-[#362205]/95 via-[#1A1308]/95 to-[#362205]/95 px-3.5 py-2 flex items-center justify-between gap-2 shadow-[0_0_26px_rgba(243,211,122,0.55)] shrink-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xl">{giftBanner.gift.glyph}</span>
                <p className="text-[11px] font-extrabold text-white truncate">
                  أهدى <span className="text-[#FCE9A6]">{giftBanner.senderName}</span>{' '}
                  {giftBanner.gift.name} إلى{' '}
                  <span className="text-[#FCE9A6]">{giftBanner.recipientName}</span>
                </p>
              </div>
              {giftBanner.luckyMultiplier ? (
                <span className="rounded-full bg-emerald-500/25 border border-emerald-400/60 px-2 py-0.5 text-[10px] font-mono-num font-extrabold text-emerald-200 shrink-0">
                  ×{giftBanner.luckyMultiplier}
                </span>
              ) : null}
            </motion.div>
          )}
          {wheelBanner && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-1.5 rounded-xl border border-[#FCE9A6]/70 bg-[#2C1E06]/95 px-3 py-1.5 text-center text-[11px] font-extrabold text-[#FCE9A6] shrink-0"
            >
              {wheelBanner.segment.glyph} فاز {wheelBanner.winnerName} بـ {wheelBanner.segment.label}
            </motion.div>
          )}
          {entryBanner && (
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="mb-1.5 rounded-2xl border border-amber-300/80 bg-gradient-to-r from-[#3E2405]/95 to-[#171209]/95 px-3 py-2 flex items-center gap-2.5 shadow-[0_0_25px_rgba(251,191,36,0.5)] shrink-0"
            >
              <span className="text-2xl">
                {entryBanner.entryId === 'entry_legendary_30d' ? '🐉' : '🚘'}
              </span>
              <p className="text-xs font-extrabold text-[#FCE9A6] truncate">
                دخولية ملكية: شرّف {entryBanner.displayName} الوكالة!
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2. SMART GEOMETRIC MIC GRID (1+4 | 2+4+4 | 5xN up to 30 Larger Mics) */}
        <section
          className={`shrink-0 ${
            showGamesOverlay ? 'max-h-[34dvh]' : 'max-h-[50dvh]'
          } overflow-y-auto no-scrollbar py-1 space-y-2`}
        >
          {micRows.map((row, rIdx) => (
            <div
              key={rIdx}
              className={`flex items-start justify-center ${
                row.cols === 5
                  ? 'grid grid-cols-5 gap-1.5 sm:gap-2'
                  : row.cols === 4
                  ? 'grid grid-cols-4 gap-2 sm:gap-3 max-w-md mx-auto'
                  : row.cols === 2
                  ? 'gap-8 sm:gap-12'
                  : ''
              }`}
            >
              {row.seats.map((seat) => {
                const isMe = seat.userId === user?.id;
                const isActiveSpeaker = Boolean(seat.userId && seat.isSpeaking && !seat.isMuted);
                const isTop1 = Boolean(seat.userId && seat.seatIndex === topSpeakerSeatIndex);
                const seatEmoji = seat.userId ? seatEmojis[seat.userId] : undefined;

                const sizeClass = row.isHero5
                  ? 'w-[62px] h-[62px] sm:w-[68px] sm:h-[68px]'
                  : room.seats.length <= 10
                  ? 'w-[50px] h-[50px] sm:w-[56px] sm:h-[56px]'
                  : 'w-[46px] h-[46px] sm:w-[52px] sm:h-[52px]';

                return (
                  <button
                    key={seat.seatIndex}
                    type="button"
                    onClick={() => void handleSeatInteraction(seat)}
                    className="flex flex-col items-center text-center cursor-pointer group focus:outline-none"
                  >
                    {/* Charisma / Support Points Badge ABOVE circle */}
                    <div className="h-[15px] flex items-center justify-center gap-0.5 mb-0.5">
                      {seat.userId ? (
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 rounded-full text-[9px] font-mono-num font-extrabold leading-tight ${
                            isTop1
                              ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-[#070913]'
                              : (seat.receivedDiamonds || 0) > 0
                              ? 'bg-black/55 text-[#FCE9A6] border border-[#D4AF37]/40'
                              : 'bg-black/40 text-slate-300'
                          }`}
                        >
                          <span>{formatCompactMetric(seat.receivedDiamonds || 0)}</span>
                          <span className="text-[8px]">💎</span>
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono-num text-slate-300/80">
                          {seat.seatIndex + 1}
                        </span>
                      )}
                    </div>

                    {/* Enlarged Circular Seat Container */}
                    <div
                      ref={(el) => {
                        seatRefs.current[seat.seatIndex] = el;
                      }}
                      className="relative flex items-center justify-center"
                    >
                      {/* Golden Speaking Waves */}
                      {isActiveSpeaker && (
                        <>
                          <span className="absolute -inset-1.5 rounded-full border-2 border-[#FCE9A6] animate-gold-wave pointer-events-none" />
                          <span className="absolute -inset-0.5 rounded-full border border-amber-400/90 shadow-[0_0_16px_rgba(251,191,36,0.9)] pointer-events-none" />
                        </>
                      )}

                      {/* TOP 1 Winged Golden Crown Aura */}
                      {isTop1 && (
                        <span
                          aria-hidden="true"
                          className="absolute -inset-2 pointer-events-none flex items-center justify-between text-amber-300 text-xs animate-top1-shimmer"
                        >
                          <span className="-mr-1">🪽</span>
                          <span className="-ml-1 scale-x-[-1]">🪽</span>
                        </span>
                      )}

                      {seat.userId ? (
                        <div
                          className={`relative ${sizeClass} rounded-full overflow-hidden bg-[#14110B] ${
                            isTop1
                              ? 'ring-2 ring-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.85)]'
                              : isMe
                              ? 'ring-2 ring-[#22E568] shadow-[0_0_12px_rgba(34,229,104,0.55)]'
                              : 'ring-[1.5px] ring-[#D4AF37]/65'
                          }`}
                        >
                          <img
                            src={resolveAsset(seat.avatarUrl)}
                            alt={seat.displayName || 'متحدث'}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          className={`${sizeClass} rounded-full flex items-center justify-center border transition ${
                            seat.isLocked
                              ? 'bg-black/50 border-slate-700/70 text-slate-500'
                              : 'bg-black/40 border-[#D4AF37]/35 text-[#D4AF37]/90 group-hover:border-[#FCE9A6] group-hover:bg-[#D4AF37]/15'
                          }`}
                        >
                          {seat.isLocked ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <Mic className={row.isHero5 ? 'w-5 h-5' : 'w-4 h-4'} />
                          )}
                        </div>
                      )}

                      {/* Enlarged High-Impact Animated Reaction / Dice Bubble (Full 4 seconds) */}
                      <AnimatePresence>
                        {seatEmoji && (
                          <motion.div
                            key={seatEmoji.id}
                            initial={{ scale: 0.25, opacity: 0, y: 10 }}
                            animate={{
                              scale: [1, 1.2, 0.96, 1.15, 1],
                              opacity: 1,
                              y: [0, -7, -2, -6, 0],
                              rotate: seatEmoji.diceValue
                                ? [0, 360, 720, 720, 720]
                                : [0, -10, 10, -6, 0],
                            }}
                            exit={{ scale: 0.35, opacity: 0, y: -14 }}
                            transition={{
                              duration: 1.15,
                              repeat: Infinity,
                              repeatType: 'mirror',
                              ease: 'easeInOut',
                            }}
                            className="absolute -inset-2.5 z-20 flex flex-col items-center justify-center pointer-events-none"
                          >
                            <div className="w-[62px] h-[62px] sm:w-[68px] sm:h-[68px] rounded-full bg-black/80 backdrop-blur-[2px] border-2 border-[#FCE9A6] shadow-[0_0_26px_rgba(251,191,36,0.9)] flex flex-col items-center justify-center">
                              <span className="text-3xl sm:text-4xl leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                                {seatEmoji.diceValue
                                  ? DICE_GLYPHS[seatEmoji.diceValue - 1]
                                  : seatEmoji.emoji}
                              </span>
                              {seatEmoji.diceValue && (
                                <span className="mt-0.5 px-1.5 rounded-full bg-[#FCE9A6] text-[#070913] text-[9px] font-mono-num font-black leading-none">
                                  {seatEmoji.diceValue}
                                </span>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* TOP 1 Crest Pill */}
                      {isTop1 && (
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 rounded-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-[#070913] text-[7px] font-extrabold leading-tight shadow z-10 whitespace-nowrap">
                          TOP1
                        </span>
                      )}

                      {/* Mic Muted Badge */}
                      {seat.userId && seat.isMuted && (
                        <span className="absolute -bottom-0.5 -left-0.5 w-4 h-4 rounded-full bg-rose-600 border border-[#0A0805] flex items-center justify-center text-white z-10">
                          <MicOff className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>

                    {/* Speaker Name & Role Micro-Tag */}
                    <div className="mt-1 flex items-center justify-center gap-0.5 max-w-[70px]">
                      {seat.userId ? (
                        <>
                          {seat.userId === room.hostId && (
                            <span className="text-[8px] text-amber-300 shrink-0">👑</span>
                          )}
                          <span className="text-[10px] font-bold text-white/95 truncate leading-tight">
                            {seat.displayName}
                          </span>
                        </>
                      ) : (
                        <span className="text-[9px] font-semibold text-slate-400/90 truncate">
                          {seat.isLocked ? 'مقفل' : 'مايك'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </section>

        {/* 3. PUBLIC CHAT (Compact Height + 2 Filter Tabs: All/Gifts vs Chat Only) */}
        <section className="flex-1 min-h-[100px] max-h-[31dvh] sm:max-h-[34dvh] flex flex-col mt-1 overflow-hidden">
          {/* Compact Chat Filter Tabs */}
          <div className="flex items-center gap-1.5 px-1 mb-1 shrink-0">
            <button
              type="button"
              onClick={() => setChatFilter('all')}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border transition cursor-pointer ${
                chatFilter === 'all'
                  ? 'bg-[#D4AF37]/85 border-[#FCE9A6] text-[#070913]'
                  : 'bg-black/45 border-white/15 text-slate-300 hover:text-white'
              }`}
            >
              <MessageSquareText className="w-3 h-3" />
              <span>الكل / الهدايا</span>
            </button>
            <button
              type="button"
              onClick={() => setChatFilter('chat')}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border transition cursor-pointer ${
                chatFilter === 'chat'
                  ? 'bg-[#D4AF37]/85 border-[#FCE9A6] text-[#070913]'
                  : 'bg-black/45 border-white/15 text-slate-300 hover:text-white'
              }`}
            >
              <MessageCircle className="w-3 h-3" />
              <span>الدردشة فقط</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 px-1 py-0.5">
            {chatFilter === 'all' && (
              <div className="rounded-2xl bg-black/30 backdrop-blur-[2px] border border-[#D4AF37]/25 px-3 py-1.5 text-xs leading-relaxed">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="font-extrabold text-[#FCE9A6]">إعلان الوكالة</span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsInitialTab('agency');
                        setShowSettingsModal(true);
                      }}
                      className="text-[10px] font-bold text-amber-300/90 hover:underline cursor-pointer"
                    >
                      تعديل
                    </button>
                  )}
                </div>
                <p className="text-[11px] font-semibold text-amber-50/95 whitespace-pre-line">
                  {room.description || 'أهلاً بكم في الوكالة الملكية · نتمنى لكم أطيب الأوقات!'}
                </p>
              </div>
            )}

            {filteredMessages.length === 0 ? (
              <div className="rounded-xl bg-black/25 px-3 py-4 text-center text-[11px] text-slate-300">
                {chatFilter === 'chat'
                  ? 'لا توجد رسائل دردشة نصية بعد — ابدأ المحادثة!'
                  : 'لا توجد رسائل بعد.'}
              </div>
            ) : (
              filteredMessages.map((m) => {
                const isJoinSystem =
                  m.type === 'system' && m.text.startsWith('دخل الغرفة');
                if (isJoinSystem) {
                  return (
                    <div key={m.id} className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#18B75D] to-[#0FA958] px-3 py-0.5 text-[11px] font-bold text-white shadow-sm">
                        <span>🔔</span>
                        <span>{m.text}</span>
                      </span>
                    </div>
                  );
                }

                if (m.type === 'system') {
                  return (
                    <div
                      key={m.id}
                      className="inline-block rounded-xl bg-black/45 px-2.5 py-1 text-[11px] text-amber-100/90"
                    >
                      {m.text}
                    </div>
                  );
                }

                if (m.type === 'gift' || m.type === 'wheel' || m.type === 'entry') {
                  return (
                    <div
                      key={m.id}
                      className="rounded-xl border border-[#D4AF37]/45 bg-gradient-to-r from-[#362407]/75 to-[#151008]/75 px-3 py-1.5 text-[11px] font-bold text-[#FCE9A6] shadow-sm"
                    >
                      {m.text}
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    className="rounded-xl bg-black/35 backdrop-blur-[2px] px-2.5 py-1.5 text-xs leading-snug"
                  >
                    <div className="inline-flex flex-wrap items-center gap-1 ml-1.5">
                      <span
                        className={`inline-flex items-center rounded-md px-1.5 py-0.2 text-[9px] font-mono-num font-extrabold ${
                          m.isAdmin
                            ? 'bg-amber-400 text-[#070913]'
                            : m.level >= 15
                            ? 'bg-sky-500/80 text-white'
                            : 'bg-emerald-600/80 text-white'
                        }`}
                      >
                        Lv.{m.level}
                      </span>
                      <FemaleVerifiedBadge badge={m.femaleVerifiedBadge} />
                      <button
                        type="button"
                        onClick={() =>
                          openMiniProfile(m.userId, {
                            displayName: m.displayName,
                            level: m.level,
                            is_admin: m.isAdmin,
                            femaleVerifiedBadge: m.femaleVerifiedBadge,
                          })
                        }
                        className="font-extrabold text-[#FCE9A6] hover:underline cursor-pointer"
                      >
                        {m.displayName}:
                      </button>
                    </div>
                    <span className="text-white/95">{m.text}</span>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>
        </section>

        {/* Interactive Animated Seat Emojis Drawer */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              className="mb-1.5 rounded-2xl bg-[#120E08]/95 backdrop-blur-md border border-[#F3D37A]/45 p-2.5 shadow-[0_0_24px_rgba(0,0,0,0.7)] shrink-0"
            >
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-[11px] font-extrabold text-[#FCE9A6]">
                  سمايلات المايك التفاعلية (4 ثوانٍ)
                </span>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5">
                {ROOM_REACTION_EMOJIS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handlePickSeatEmoji(item)}
                    className="rounded-xl bg-white/5 hover:bg-[#D4AF37]/20 border border-white/10 hover:border-[#F3D37A]/60 py-1.5 px-1 flex flex-col items-center gap-0.5 transition cursor-pointer active:scale-95"
                  >
                    <span className="text-xl leading-none">{item.emoji}</span>
                    <span className="text-[9px] font-bold text-slate-200 truncate max-w-full">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4. FIXED SINGLE-ROW BOTTOM ACTION BAR (Chat Input + 😊 + 🎁 + 🎮 + 🎙️) */}
        <footer className="pt-1.5 pb-[max(env(safe-area-inset-bottom,0px),6px)] shrink-0">
          <div className="flex items-center gap-1.5">
            {/* 1. Public Chat Input Box */}
            <form
              onSubmit={handleSendChat}
              className="flex-1 min-w-0 flex items-center gap-1 rounded-full bg-black/60 border border-white/20 px-3 py-1 backdrop-blur-md"
            >
              <input
                type="text"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="أهلاً..."
                className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none py-1"
              />
              {chatText.trim() && (
                <button
                  type="submit"
                  className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FDE047] to-[#D4AF37] text-[#070913] flex items-center justify-center cursor-pointer shrink-0"
                  aria-label="إرسال"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            {/* 2. Interactive Seat Emojis Button (😊) */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker((v) => !v)}
              className={`w-10 h-10 rounded-full flex items-center justify-center border cursor-pointer shrink-0 transition ${
                showEmojiPicker
                  ? 'bg-[#D4AF37] border-[#FFF3C4] text-[#070913] shadow-[0_0_14px_rgba(243,211,122,0.7)]'
                  : 'bg-black/60 border-white/20 text-[#FCE9A6] hover:border-[#F3D37A]/60'
              }`}
              aria-label="سمايلات تفاعلية"
              title="السمايلات التفاعلية"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* 3. Prominent Glowing Gold Gift Box Button (🎁) */}
            <button
              ref={giftBtnRef}
              type="button"
              onClick={() => {
                setGiftInitialTargets(undefined);
                setShowGiftModal(true);
              }}
              className="relative w-11 h-11 rounded-full bg-gradient-to-br from-[#FEF08A] via-[#D4AF37] to-[#B45309] border-2 border-[#FFF8DC] text-[#070913] flex items-center justify-center shadow-[0_0_22px_rgba(243,211,122,0.85)] hover:scale-105 active:scale-95 transition cursor-pointer shrink-0"
              aria-label="صندوق الهدايا"
              title="صندوق الهدايا الملكية"
            >
              <span className="absolute -inset-0.5 rounded-full border border-[#FDE047]/60 animate-ping opacity-45 pointer-events-none" />
              <Gift className="w-5 h-5 stroke-[2.4]" />
            </button>

            {/* 3b. External Chats / Inbox Button (صندوق الوارد) without leaving room */}
            <button
              type="button"
              onClick={() => setShowInboxOverlay(true)}
              className="w-10 h-10 rounded-full bg-black/60 border border-[#D4AF37]/45 text-[#FCE9A6] hover:border-[#FCE9A6] hover:bg-[#D4AF37]/20 flex items-center justify-center cursor-pointer shrink-0 transition"
              aria-label="الدردشات الخارجية"
              title="الدردشات الخارجية / صندوق الوارد"
            >
              <Mail className="w-4 h-4" />
            </button>

            {/* 4. Games Button directly adjacent (🎮) */}
            <button
              type="button"
              onClick={() => setShowGamesOverlay(true)}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/35 to-teal-700/45 border border-emerald-400/60 text-emerald-100 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.35)] hover:border-emerald-300 cursor-pointer shrink-0"
              aria-label="الألعاب"
              title="مركز الألعاب فوق الغرفة"
            >
              <Gamepad2 className="w-5 h-5" />
            </button>

            {/* 5. Mic Control Button (🎙️ / 🔇) */}
            <button
              type="button"
              onClick={() => {
                if (mySeat) {
                  void handleToggleMute();
                } else {
                  const free = room.seats.find((s) => !s.userId && !s.isLocked);
                  if (free) void handleSeatClick(free.seatIndex);
                  else showToast('جميع المقاعد مشغولة حالياً');
                }
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center border cursor-pointer shrink-0 transition ${
                mySeat
                  ? mySeat.isMuted
                    ? 'bg-rose-600/85 border-rose-400 text-white'
                    : 'bg-emerald-500/85 border-emerald-300 text-white shadow-[0_0_12px_rgba(16,185,129,0.55)]'
                  : 'bg-black/60 border-white/20 text-[#FCE9A6]'
              }`}
              aria-label="التحكم بالمايك"
              title={
                mySeat
                  ? mySeat.isMuted
                    ? 'فتح المايك'
                    : 'كتم المايك'
                  : 'صعود للمايك'
              }
            >
              {mySeat?.isMuted ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          </div>

          {mySeat && micDenied && !mySeat.isMuted && (
            <div className="mt-1.5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void handleRequestMicAccess()}
                className="rounded-full bg-[#D4AF37]/25 border border-[#D4AF37]/60 px-3 py-0.5 text-[10px] font-bold text-[#FCE9A6] cursor-pointer"
              >
                تفعيل إذن المايكروفون
              </button>
              <button
                type="button"
                onClick={() => void handleManualSpeakToggle()}
                className="rounded-full bg-white/10 border border-white/20 px-3 py-0.5 text-[10px] font-bold text-white cursor-pointer"
              >
                {manualSpeakPulse ? 'إيقاف نبض الصوت' : 'تجربة نبض المتحدث'}
              </button>
            </div>
          )}
        </footer>
      </div>

      {/* PULSING CIRCULAR COMBO CONTINUATION BUTTON (3.0s SVG Progress Ring) */}
      <AnimatePresence>
        {comboSession && comboRemainingMs > 0 && (
          <motion.button
            type="button"
            initial={{ scale: 0.3, opacity: 0, y: 20 }}
            animate={{ scale: [1, 1.06, 1], opacity: 1, y: 0 }}
            exit={{ scale: 0.4, opacity: 0, y: 16 }}
            transition={{ scale: { repeat: Infinity, duration: 1.1 } }}
            onClick={() => void handleComboTap()}
            className="fixed left-3.5 bottom-[74px] z-40 w-[74px] h-[74px] rounded-full flex items-center justify-center cursor-pointer active:scale-90 select-none"
            title="اضغط للاستمرار في إرسال الهدية (Combo)"
          >
            <svg
              className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-[0_0_16px_rgba(251,191,36,0.9)]"
              viewBox="0 0 74 74"
            >
              <circle
                cx="37"
                cy="37"
                r={comboCircleRadius}
                fill="rgba(22, 16, 8, 0.9)"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="5"
              />
              <circle
                cx="37"
                cy="37"
                r={comboCircleRadius}
                fill="none"
                stroke="#FDE047"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={comboCircumference}
                strokeDashoffset={comboCircumference * (1 - comboProgress)}
              />
            </svg>
            <div className="relative flex flex-col items-center justify-center text-center leading-none">
              <span className="text-xl drop-shadow">{comboSession.gift.glyph}</span>
              <span className="mt-0.5 text-[10px] font-mono-num font-extrabold text-[#FDE047]">
                Combo ×{comboSession.comboCount}
              </span>
              <span className="text-[8px] font-mono-num text-amber-200/85">
                {(comboRemainingMs / 1000).toFixed(1)}s
              </span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* FLYING GIFT TRAJECTORIES TOWARD EXACT MIC COORDINATES (Non-blocking) */}
      <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
        <AnimatePresence>
          {flyingGifts.map((fly) => {
            const start = resolveFlyStartPoint();
            return fly.recipientIds.map((rid, idx) => {
              const target = resolveRecipientPoint(rid, idx);
              const midX = (start.x + target.x) / 2 + (idx % 2 === 0 ? -24 : 24);
              const midY = Math.min(start.y, target.y) - 42;
              return (
                <React.Fragment key={`${fly.id}_${rid}_${idx}`}>
                  {/* Flying 3D Gift Orb */}
                  <motion.div
                    initial={{
                      x: start.x - 24,
                      y: start.y - 24,
                      scale: 0.45,
                      opacity: 0.95,
                    }}
                    animate={{
                      x: [start.x - 24, midX - 24, target.x - 24],
                      y: [start.y - 24, midY - 24, target.y - 24],
                      scale: [0.55, 1.45, 1.15, 0.75],
                      opacity: [0.95, 1, 1, 0],
                    }}
                    transition={{
                      duration: 1.05,
                      delay: idx * 0.05,
                      ease: 'easeInOut',
                    }}
                    className="fixed top-0 left-0 w-12 h-12 flex items-center justify-center"
                  >
                    <span className="absolute inset-0 rounded-full bg-amber-300/45 blur-md" />
                    <span className="relative text-4xl drop-shadow-[0_4px_14px_rgba(251,191,36,0.9)]">
                      {fly.gift.glyph}
                    </span>
                    {(fly.quantity > 1 || fly.comboCount > 1) && (
                      <span className="absolute -bottom-1 -right-2 rounded-full bg-gradient-to-r from-[#FDE047] to-[#D4AF37] px-1.5 py-[1px] text-[9px] font-mono-num font-extrabold text-[#070913] shadow">
                        ×{fly.quantity}
                      </span>
                    )}
                  </motion.div>

                  {/* Arrival Halo Burst on Target Mic */}
                  <motion.div
                    initial={{
                      x: target.x - 28,
                      y: target.y - 28,
                      scale: 0.2,
                      opacity: 0,
                    }}
                    animate={{
                      scale: [0.2, 1.5, 1.9],
                      opacity: [0, 0.95, 0],
                    }}
                    transition={{
                      duration: 0.65,
                      delay: 0.85 + idx * 0.05,
                      ease: 'easeOut',
                    }}
                    className="fixed top-0 left-0 w-14 h-14 rounded-full border-2 border-[#FDE047] bg-amber-400/20 shadow-[0_0_24px_rgba(251,191,36,0.9)]"
                  />
                </React.Fragment>
              );
            });
          })}
        </AnimatePresence>
      </div>

      {/* FULLSCREEN 5-SECOND DRAGON CINEMA CELEBRATION OVERLAY */}
      <DragonCinemaOverlay event={fullscreenGift} hostName={room.hostName} />

      {/* SEAT INTERACTION SHEET */}
      <AnimatePresence>
        {seatActionTarget && seatActionTarget.userId && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setSeatActionTarget(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="royal-glass w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AvatarWithFrame
                    src={seatActionTarget.avatarUrl}
                    alt={seatActionTarget.displayName || 'متحدث'}
                    frameId={seatActionTarget.frameId}
                    size="md"
                  />
                  <div>
                    <h4 className="text-sm font-extrabold text-white">
                      {seatActionTarget.displayName}
                    </h4>
                    <p className="text-[11px] text-[#FCE9A6] font-mono-num">
                      مايك {seatActionTarget.seatIndex + 1} · 💎{' '}
                      {(seatActionTarget.receivedDiamonds || 0).toLocaleString('en-US')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSeatActionTarget(null)}
                  className="w-8 h-8 rounded-full bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {seatActionTarget.userId === user?.id ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void handleToggleMute();
                      setSeatActionTarget(null);
                    }}
                    className="min-h-[44px] rounded-2xl bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#FCE9A6] text-xs font-extrabold flex flex-col items-center justify-center gap-1 cursor-pointer"
                  >
                    {seatActionTarget.isMuted ? (
                      <Mic className="w-4 h-4" />
                    ) : (
                      <MicOff className="w-4 h-4" />
                    )}
                    <span>{seatActionTarget.isMuted ? 'فتح المايك' : 'كتم المايك'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSeatActionTarget(null);
                      setShowMusicModal(true);
                    }}
                    className="min-h-[44px] rounded-2xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-extrabold flex flex-col items-center justify-center gap-1 cursor-pointer"
                  >
                    <Music className="w-4 h-4" />
                    <span>موسيقى 🎵</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const idx = seatActionTarget.seatIndex;
                      setSeatActionTarget(null);
                      void handleSeatClick(idx);
                    }}
                    className="min-h-[44px] rounded-2xl bg-rose-600/25 border border-rose-400/50 text-rose-200 text-xs font-extrabold flex flex-col items-center justify-center gap-1 cursor-pointer"
                  >
                    <UserMinus className="w-4 h-4" />
                    <span>نزول</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const target = seatActionTarget;
                        setSeatActionTarget(null);
                        openMiniProfile(target.userId!, {
                          displayName: target.displayName || undefined,
                          avatarUrl: target.avatarUrl || undefined,
                          frameId: target.frameId || undefined,
                          level: target.level || 1,
                          femaleVerifiedBadge: target.femaleVerifiedBadge || null,
                        });
                      }}
                      className="min-h-[40px] rounded-xl bg-white/10 text-white text-xs font-bold cursor-pointer"
                    >
                      عرض الملف الشخصي
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGiftInitialTargets([seatActionTarget.userId!]);
                        setSeatActionTarget(null);
                        setShowGiftModal(true);
                      }}
                      className="min-h-[40px] rounded-xl gold-btn text-xs font-extrabold cursor-pointer"
                    >
                      إرسال هدية 🎁
                    </button>
                  </div>

                  {canManage && seatActionTarget.userId !== room.hostId && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          void runAdminAction({
                            type: 'mute_user',
                            targetUserId: seatActionTarget.userId!,
                            isMuted: !seatActionTarget.isMuted,
                          });
                          setSeatActionTarget(null);
                        }}
                        className="min-h-[38px] rounded-xl bg-amber-500/20 border border-amber-400/40 text-[11px] font-bold text-[#FCE9A6] cursor-pointer"
                      >
                        {seatActionTarget.isMuted ? 'فك كتمه' : 'كتم مايكه'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void runAdminAction({
                            type: 'kick_seat',
                            targetUserId: seatActionTarget.userId!,
                          });
                          setSeatActionTarget(null);
                        }}
                        className="min-h-[38px] rounded-xl bg-white/10 text-[11px] font-bold text-slate-200 cursor-pointer"
                      >
                        إنزال من المايك
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleToggleLock(
                            seatActionTarget.seatIndex,
                            seatActionTarget.isLocked
                          );
                          setSeatActionTarget(null);
                        }}
                        className="min-h-[38px] rounded-xl bg-sky-500/20 border border-sky-400/40 text-[11px] font-bold text-sky-200 cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Lock className="w-3 h-3" />
                        <span>قفل المايك</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void runAdminAction({
                            type: 'toggle_moderator',
                            targetUserId: seatActionTarget.userId!,
                            targetName: seatActionTarget.displayName || undefined,
                          });
                          setSeatActionTarget(null);
                        }}
                        className="min-h-[38px] rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-[11px] font-bold text-emerald-200 cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Shield className="w-3 h-3" />
                        <span>مشرف</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void runAdminAction({
                            type: 'kick_room',
                            targetUserId: seatActionTarget.userId!,
                            targetName: seatActionTarget.displayName || undefined,
                          });
                          setSeatActionTarget(null);
                        }}
                        className="min-h-[38px] rounded-xl bg-rose-600/30 border border-rose-400/50 text-[11px] font-bold text-rose-200 cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Ban className="w-3 h-3" />
                        <span>طرد</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LUXURY 3D GIFT DRAWER */}
      <AnimatePresence>
        {showGiftModal && (
          <RoomGiftDrawer
            room={room}
            gifts={gifts}
            userCoins={user?.coins ?? 0}
            currentUserId={user?.id}
            initialTargets={giftInitialTargets}
            sending={sendingGift}
            onSend={handleSendGiftBatch}
            onOpenPM={(uid) => {
              setShowGiftModal(false);
              minimizeRoom();
              navigate(`/messages?to=${uid}`);
            }}
            onRecharge={() => {
              setShowGiftModal(false);
              minimizeRoom();
              navigate('/wallet');
            }}
            onClose={() => setShowGiftModal(false)}
          />
        )}
      </AnimatePresence>

      {/* FLOATING IN-ROOM INBOX OVERLAY (Read/Reply PMs without leaving voice room!) */}
      <AnimatePresence>
        {showInboxOverlay && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setShowInboxOverlay(false)}
          >
            <motion.div
              initial={{ y: 70, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 70, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl h-[86dvh] rounded-t-[28px] overflow-hidden shadow-2xl border-t border-x border-[#D4AF37]/40 bg-[#F5F6FA]"
            >
              <MessagesPage
                embedded
                onCloseEmbedded={() => setShowInboxOverlay(false)}
                onRechargeCoins={() => {
                  setShowInboxOverlay(false);
                  minimizeRoom();
                  navigate('/wallet');
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LUCKY WHEEL MODAL */}
      {showWheelModal && (
        <LuckyWheelModal
          roomId={room.id}
          userCoins={user?.coins ?? 0}
          wheelCost={wheelCost}
          segments={wheelSegments}
          onClose={() => setShowWheelModal(false)}
          onSpinComplete={(nextUser, nextRoom) => {
            updateLocalUser(nextUser);
            void updateRoomFromWheel(nextRoom, wheelCost);
          }}
        />
      )}

      {/* FLOATING GAMES OVERLAY (Keeps audio & mic live!) */}
      <AnimatePresence>
        {showGamesOverlay && (
          <RoomGamesModal
            roomTitle={room.title}
            totalVolumeCoins={totalVolumeCoins}
            mySeat={mySeat}
            micActive={micActive}
            userCoins={user?.coins ?? 0}
            onToggleMute={() => void handleToggleMute()}
            onRecharge={() => {
              setShowGamesOverlay(false);
              minimizeRoom();
              navigate('/wallet');
            }}
            onOpenAgency={() => {
              setShowGamesOverlay(false);
              minimizeRoom();
              navigate('/agency');
            }}
            onPlaySpent={(coins) => void addPlayVolume(coins)}
            onClose={() => setShowGamesOverlay(false)}
          />
        )}
      </AnimatePresence>

      {/* PLAY & SUPPORT LEADERBOARD MODAL (🏆 تصنيف اللعب والدعم) */}
      <AnimatePresence>
        {showLeaderboardModal && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setShowLeaderboardModal(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="royal-glass w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[82vh] flex flex-col"
            >
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FDE047] to-[#B45309] text-[#070913] flex items-center justify-center shadow">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold gold-gradient-text">
                      تصنيف اللعب والدعم 🏆
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      مرتب من الأعلى إلى الأقل حسب نقاط الدعم واللعب داخل الوكالة
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLeaderboardModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
                {supportAndPlayLeaderboard.length === 0 ? (
                  <div className="rounded-2xl bg-[#070913]/70 border border-white/10 py-10 text-center text-xs text-slate-400">
                    لم يتم تسجيل أي نقاط دعم أو لعب في هذه الوكالة حتى الآن.
                  </div>
                ) : (
                  supportAndPlayLeaderboard.map((entry, idx) => (
                    <div
                      key={entry.userId}
                      className={`rounded-2xl border p-3 flex items-center justify-between gap-2 ${
                        idx === 0
                          ? 'bg-gradient-to-r from-[#3B2607]/85 to-[#17120A]/90 border-[#FDE047]/65'
                          : 'bg-[#070913]/80 border-white/10'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowLeaderboardModal(false);
                          openMiniProfile(entry.userId, {
                            displayName: entry.displayName,
                            avatarUrl: entry.avatarUrl,
                            frameId: entry.frameId,
                          });
                        }}
                        className="flex items-center gap-2.5 min-w-0 text-right cursor-pointer"
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono-num font-black shrink-0 ${
                            idx === 0
                              ? 'bg-[#FDE047] text-[#070913]'
                              : idx === 1
                              ? 'bg-slate-200 text-slate-900'
                              : idx === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-white/10 text-slate-300'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <AvatarWithFrame
                          src={entry.avatarUrl}
                          alt={entry.displayName}
                          frameId={entry.frameId}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-white truncate">
                            {entry.displayName}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono-num mt-0.5">
                            <span className="text-amber-300">
                              🎁 دعم: {entry.supportCoins.toLocaleString('en-US')}
                            </span>
                            <span className="text-emerald-300">
                              🎮 لعب: {entry.playCoins.toLocaleString('en-US')}
                            </span>
                          </div>
                        </div>
                      </button>

                      <div className="text-left shrink-0">
                        <span className="block text-xs font-mono-num font-black text-[#FCE9A6]">
                          {entry.totalCoins.toLocaleString('en-US')}
                        </span>
                        <span className="block text-[9px] text-slate-400">إجمالي</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AGENCY SETTINGS MODAL */}
      {showSettingsModal && canManage && (
        <RoomSettingsModal
          room={room}
          extras={extras}
          presenceMembers={presenceMembers}
          isOwnerOrAdmin={isOwnerOrAdmin}
          initialTab={settingsInitialTab}
          ownedBackgrounds={ownedBackgrounds}
          isAdmin={Boolean(user?.is_admin)}
          onUpdateSettings={updateSettings}
          onAdminAction={runAdminAction}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* ROOM MUSIC PLAYER MODAL (Device Audio File Only) */}
      {showMusicModal && (
        <RoomMusicModal
          isOnMic={Boolean(mySeat)}
          musicState={musicState}
          musicVolume={musicVolume}
          musicMutedLocally={musicMutedLocally}
          onVolumeChange={(v) => {
            setMusicVolume(v);
            if (v > 0 && musicMutedLocally) setMusicMutedLocally(false);
          }}
          onToggleLocalMute={() => setMusicMutedLocally(!musicMutedLocally)}
          onPlayUploaded={playUploadedMusic}
          onTogglePlayPause={toggleMusicPlayPause}
          onStopMusic={stopRoomMusic}
          onClimbMic={() => {
            const free = room.seats.find((s) => !s.userId && !s.isLocked);
            if (free) void handleSeatClick(free.seatIndex);
          }}
          onClose={() => setShowMusicModal(false)}
        />
      )}

      {/* EXIT / KEEP MINIMIZED MODAL */}
      <AnimatePresence>
        {showExitModal && (
          <RoomExitModal
            roomTitle={room.title}
            roomAvatar={room.hostAvatar}
            isOnMic={Boolean(mySeat)}
            onKeepMinimized={handleKeepMinimized}
            onLeaveRoom={() => void handleConfirmLeave()}
            onCancel={() => {
              setShowExitModal(false);
              if (!window.history.state?.inRoom) {
                window.history.pushState({ inRoom: true }, '');
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
