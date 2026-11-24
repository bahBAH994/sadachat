import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Ban,
  ClipboardList,
  Copy,
  Coins,
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
  Plus,
  Send,
  Settings,
  Shield,
  Smile,
  Sparkles,
  Trash2,
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
  getUserVipTierInfo,
  parseVipTierKey,
} from '../lib/sadaCatalog';
import { getPlatformState } from '../lib/sadaMappers';
import { toggleFollowAgencyInSupabase } from '../lib/sadaSocialService';
import {
  canClearRoomChatFromData,
  isRoomOrAgencyOwnerFromData,
} from '../lib/sadaRoomsService';
import type { RoomMessage, RoomSeat, User, VipTierKey } from '../types';
import type {
  RoomSeatEmojiEvent,
  SeatGiftReactionEvent,
} from '../context/ActiveRoomContext';
import { AvatarWithFrame, VipTierBadge, VipUserName } from '../components/AvatarWithFrame';
import { GenderBadge } from '../components/GenderBadge';
import { DragonCinemaOverlay } from '../components/DragonCinemaOverlay';
import { DragonStageBackdrop } from '../components/DragonStageBackdrop';
import { FemaleVerifiedBadge } from '../components/FemaleVoiceVerificationCard';
import { Fluent3DAsset } from '../components/Fluent3DAsset';
import { RoomContestModal } from '../components/RoomContestModal';
import { RoomExitModal } from '../components/RoomExitModal';
import { RoomGamesModal } from '../components/RoomGamesModal';
import { RoomMusicModal } from '../components/RoomMusicModal';
import { RoomSettingsModal } from '../components/RoomSettingsModal';
import { Royal3DDieFaceBadge } from '../components/Royal3DDice';
import { TieredGiftEffectsOverlay } from '../components/TieredGiftEffectsOverlay';
import { VipEntranceOverlay } from '../components/VipEntranceOverlay';
import { safeGetItem } from '../lib/safeStorage';
import { supabase } from '../lib/supabase';

const FIXED_CHAT_EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '😭', '😡', '👍', '👏', '🙏', '❤️', '🔥'];
const AGENCY_ID = '954546';
const ROOM_WHEEL_ENTRY_FEES = [100, 500, 1000, 5000];
const ROOM_WHEEL_SPIN_DURATION_MS = 2500;

interface RoomWheelPlayer {
  userId: string;
  displayName: string;
  avatarUrl: string;
  test: boolean;
}

interface RoomWheelRound {
  id: string;
  roomId: string;
  creatorId: string;
  entryFee: number;
  prizePool: number;
  players: RoomWheelPlayer[];
  eliminated: string[];
  spinningPlayerId: string | null;
  lastEliminatedId: string | null;
  status: 'registering' | 'spinning' | 'finished';
  winnerId: string | null;
}

interface RoomWheelMember {
  userId: string;
  displayName: string;
  avatarUrl: string;
}

interface RoomWheelGameProps {
  roomId: string;
  userCoins: number;
  members: RoomWheelMember[];
  onPlaySpent: (amount: number) => void;
  onSendChat: (message: string) => Promise<void>;
  onClose: () => void;
}

async function changeProfileCoins(userId: string, amount: number): Promise<number> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: profile, error: loadError } = await supabase
      .from('profiles')
      .select('coins')
      .eq('id', userId)
      .maybeSingle();
    if (loadError) throw new Error(loadError.message);
    if (!profile || !Number.isFinite(Number(profile.coins))) {
      throw new Error('تعذّر العثور على رصيد الحساب.');
    }

    const currentCoins = Number(profile.coins);
    const nextCoins = currentCoins + amount;
    if (nextCoins < 0) throw new Error('رصيد الكوينز غير كافٍ لقيمة الدخول.');

    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({ coins: nextCoins })
      .eq('id', userId)
      .eq('coins', currentCoins)
      .select('coins')
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (updatedProfile) return Number(updatedProfile.coins);
  }
  throw new Error('تعذّر تحديث الرصيد بسبب تغيّر متزامن. حاول مجدداً.');
}

const RoomWheelGame: React.FC<RoomWheelGameProps> = ({
  roomId,
  userCoins,
  members,
  onPlaySpent,
  onSendChat,
  onClose,
}) => {
  const { user, updateLocalUser } = useAuth();
  const [round, setRound] = useState<RoomWheelRound | null>(null);
  const [entryFee, setEntryFee] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addingCompetitor, setAddingCompetitor] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const roundRef = useRef<RoomWheelRound | null>(round);
  const userRef = useRef(user);
  roundRef.current = round;
  userRef.current = user;
  const rotationRef = useRef(0);
  const animatedPlayerRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const joiningRef = useRef(false);
  const settledRoundRef = useRef<string | null>(null);
  const cancelledRoundsRef = useRef<Set<string>>(new Set());

  const updateOwnBalance = useCallback(
    (coins: number) => {
      const currentUser = userRef.current;
      if (currentUser) updateLocalUser({ ...currentUser, coins });
    },
    [updateLocalUser]
  );

  const sendEvent = useCallback(
    async (event: string, payload: Record<string, unknown>) => {
      const channel = channelRef.current;
      if (!channel) throw new Error('قناة الغرفة غير متصلة بعد.');
      const status = await channel.send({ type: 'broadcast', event, payload });
      if (status !== 'ok') throw new Error('تعذّر إرسال تحديث اللعبة إلى الغرفة.');
    },
    []
  );

  const publishRound = useCallback(
    async (nextRound: RoomWheelRound) => {
      roundRef.current = nextRound;
      setRound(nextRound);
      await sendEvent('round_state', { round: nextRound });
    },
    [sendEvent]
  );

  const refundMyEntry = useCallback(
    async (cancelledRound: RoomWheelRound) => {
      const currentUser = userRef.current;
      if (!currentUser || cancelledRoundsRef.current.has(cancelledRound.id)) return;
      cancelledRoundsRef.current.add(cancelledRound.id);
      const player = cancelledRound.players.find(
        (candidate) => candidate.userId === currentUser.id && !candidate.test
      );
      if (!player) return;
      try {
        const updatedCoins = await changeProfileCoins(
          currentUser.id,
          cancelledRound.entryFee
        );
        updateOwnBalance(updatedCoins);
      } catch (refundError) {
        cancelledRoundsRef.current.delete(cancelledRound.id);
        throw refundError;
      }
    },
    [updateOwnBalance]
  );

  useEffect(() => {
    const channel = supabase.channel(`room-lucky-wheel:${roomId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'round_state' }, ({ payload }) => {
        const nextRound = payload?.round as RoomWheelRound | undefined;
        if (!nextRound || nextRound.roomId !== roomId) return;
        const currentRound = roundRef.current;
        if (currentRound && currentRound.id !== nextRound.id) return;
        roundRef.current = nextRound;
        setRound(nextRound);
        if (nextRound.winnerId === user?.id && Number.isFinite(Number(payload.winnerCoins))) {
          updateOwnBalance(Number(payload.winnerCoins));
        }
      })
      .on('broadcast', { event: 'state_request' }, () => {
        const currentRound = roundRef.current;
        if (currentRound?.creatorId === user?.id) {
          void sendEvent('round_state', { round: currentRound });
        }
      })
      .on('broadcast', { event: 'player_joined' }, ({ payload }) => {
        const joinedRoundId = payload?.roundId as string | undefined;
        const player = payload?.player as RoomWheelPlayer | undefined;
        if (!player || player.test || !joinedRoundId) return;
        const current = roundRef.current;
        if (!current || current.id !== joinedRoundId || current.status !== 'registering') {
          return;
        }
        if (current.players.some((candidate) => candidate.userId === player.userId)) return;
        const next = {
          ...current,
          players: [...current.players, player],
          prizePool: current.prizePool + current.entryFee,
        };
        roundRef.current = next;
        setRound(next);
        if (current.creatorId === user?.id) {
          void sendEvent('round_state', { round: next });
        }
      })
      .on('broadcast', { event: 'round_cancelled' }, ({ payload }) => {
        const cancelledRound = payload?.round as RoomWheelRound | undefined;
        if (!cancelledRound || cancelledRound.roomId !== roomId) return;
        void refundMyEntry(cancelledRound).catch((refundError: unknown) => {
          setNotice(
            refundError instanceof Error
              ? `تعذّر استرداد رسوم الدخول: ${refundError.message}`
              : 'تعذّر استرداد رسوم الدخول.'
          );
        });
        if (roundRef.current?.id === cancelledRound.id) {
          roundRef.current = null;
          setRound(null);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void sendEvent('state_request', { userId: user?.id });
        }
      });

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [roomId, user?.id, refundMyEntry, sendEvent, updateOwnBalance]);

  useEffect(() => {
    if (!round?.spinningPlayerId) {
      animatedPlayerRef.current = null;
      setSpinning(false);
      return;
    }
    if (animatedPlayerRef.current === round.spinningPlayerId) return;
    const alive = round.players.filter(
      (player) => !round.eliminated.includes(player.userId)
    );
    const selectedIndex = alive.findIndex(
      (player) => player.userId === round.spinningPlayerId
    );
    if (selectedIndex < 0 || !alive.length) return;
    animatedPlayerRef.current = round.spinningPlayerId;
    const sectorAngle = 360 / alive.length;
    const sectorCenter = selectedIndex * sectorAngle + sectorAngle / 2;
    const spinAngle = (360 - ((sectorCenter + rotationRef.current) % 360)) % 360;
    rotationRef.current += 1800 + spinAngle;
    setRotation(rotationRef.current);
    setSpinning(true);
    const timer = window.setTimeout(
      () => setSpinning(false),
      ROOM_WHEEL_SPIN_DURATION_MS
    );
    return () => window.clearTimeout(timer);
  }, [round]);

  const alivePlayers = round
    ? round.players.filter((player) => !round.eliminated.includes(player.userId))
    : [];
  const isCreator = Boolean(round && user && round.creatorId === user.id);
  const hasJoined = Boolean(round?.players.some((player) => player.userId === user?.id));
  const practiceRound = Boolean(round?.players.some((player) => player.test));

  const handleCreateRound = async () => {
    if (!user || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const createdRound: RoomWheelRound = {
        id: `wheel_${roomId}_${user.id}_${Date.now()}`,
        roomId,
        creatorId: user.id,
        entryFee,
        prizePool: 0,
        players: [],
        eliminated: [],
        spinningPlayerId: null,
        lastEliminatedId: null,
        status: 'registering',
        winnerId: null,
      };
      await publishRound(createdRound);
    } catch (createError) {
      setNotice(
        createError instanceof Error ? createError.message : 'تعذّر إنشاء الجولة.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleJoinRound = async () => {
    if (!user || !round || busy || joiningRef.current || hasJoined || practiceRound) return;
    joiningRef.current = true;
    setBusy(true);
    setNotice(null);
    let charged = false;
    try {
      const updatedCoins = await changeProfileCoins(user.id, -round.entryFee);
      charged = true;
      updateOwnBalance(updatedCoins);
      const player: RoomWheelPlayer = {
        userId: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        test: false,
      };
      const next = {
        ...round,
        players: [...round.players, player],
        prizePool: round.prizePool + round.entryFee,
      };
      roundRef.current = next;
      setRound(next);
      await sendEvent('player_joined', { roundId: round.id, player });
      onPlaySpent(round.entryFee);
    } catch (joinError) {
      if (charged) {
        roundRef.current = round;
        setRound(round);
        try {
          updateOwnBalance(await changeProfileCoins(user.id, round.entryFee));
        } catch (refundError) {
          setNotice(
            refundError instanceof Error
              ? `تعذّر إكمال الانضمام أو استرداد الرسوم: ${refundError.message}`
              : 'تعذّر إكمال الانضمام أو استرداد الرسوم.'
          );
          return;
        }
      }
      setNotice(
        joinError instanceof Error ? joinError.message : 'تعذّر الانضمام إلى الجولة.'
      );
    } finally {
      joiningRef.current = false;
      setBusy(false);
    }
  };

  const handleAddCompetitor = async (member: RoomWheelMember) => {
    if (!user || !round || busy || !isCreator || round.prizePool > 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const nextPlayer: RoomWheelPlayer = { ...member, test: true };
      const next = { ...round, players: [...round.players, nextPlayer] };
      await publishRound(next);
      setAddingCompetitor(false);
    } catch (addError) {
      setNotice(addError instanceof Error ? addError.message : 'تعذّرت إضافة المنافس.');
    } finally {
      setBusy(false);
    }
  };

  const handleStartRound = async () => {
    if (
      !user ||
      !round ||
      !isCreator ||
      round.players.length < 2 ||
      busy ||
      startingRef.current
    ) {
      return;
    }
    startingRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      let currentRound: RoomWheelRound = {
        ...round,
        status: 'spinning',
        spinningPlayerId: null,
      };
      await publishRound(currentRound);
      let alive = currentRound.players.filter(
        (player) => !currentRound.eliminated.includes(player.userId)
      );
      while (alive.length > 1) {
        const eliminated = alive[Math.floor(Math.random() * alive.length)];
        const spinningRound = {
          ...currentRound,
          spinningPlayerId: eliminated.userId,
          lastEliminatedId: null,
        };
        await publishRound(spinningRound);
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, ROOM_WHEEL_SPIN_DURATION_MS)
        );
        currentRound = {
          ...spinningRound,
          eliminated: [...spinningRound.eliminated, eliminated.userId],
          spinningPlayerId: null,
          lastEliminatedId: eliminated.userId,
        };
        await publishRound(currentRound);
        setNotice(`تم إقصاء ${eliminated.displayName}!`);
        try {
          await onSendChat(`🎡 تم إقصاء ${eliminated.displayName} من دولاب الإقصاء!`);
        } catch (chatError) {
          setNotice(
            chatError instanceof Error
              ? `تم الإقصاء لكن تعذّر إرسال إشعار الشات: ${chatError.message}`
              : 'تم الإقصاء لكن تعذّر إرسال إشعار الشات.'
          );
        }
        alive = alive.filter((player) => player.userId !== eliminated.userId);
      }

      const winner = alive[0];
      let winnerCoins: number | undefined;
      const payout = winner && !winner.test ? Math.floor(currentRound.prizePool * 0.8) : 0;
      if (winner && payout > 0 && settledRoundRef.current !== currentRound.id) {
        settledRoundRef.current = currentRound.id;
        winnerCoins = await changeProfileCoins(winner.userId, payout);
        if (winner.userId === user.id) updateOwnBalance(winnerCoins);
      }
      const finishedRound: RoomWheelRound = {
        ...currentRound,
        status: 'finished',
        winnerId: winner?.userId ?? null,
        spinningPlayerId: null,
      };
      roundRef.current = finishedRound;
      setRound(finishedRound);
      await sendEvent('round_state', { round: finishedRound, winnerCoins });
      setNotice(
        winner
          ? `🏆 تهانينا ${winner.displayName}! فاز بـ ${payout.toLocaleString('en-US')} كوينز.`
          : 'انتهت الجولة.'
      );
      try {
        await onSendChat(
          `🏆 تهانينا ${winner?.displayName || ''}! فاز بدولاب الإقصاء وربح ${payout.toLocaleString('en-US')} كوينز بعد خصم عمولة المنصة 20%.`
        );
      } catch (chatError) {
        setNotice(
          chatError instanceof Error
            ? `تم توزيع الجائزة لكن تعذّر إرسال تهنئة الشات: ${chatError.message}`
            : 'تم توزيع الجائزة لكن تعذّر إرسال تهنئة الشات.'
        );
      }
    } catch (startError) {
      setNotice(
        startError instanceof Error ? startError.message : 'تعذّر إكمال السحب.'
      );
    } finally {
      startingRef.current = false;
      setSpinning(false);
      setBusy(false);
    }
  };

  const handleCancelRound = async () => {
    if (!user || !round || !isCreator || busy || round.status !== 'registering') return;
    setBusy(true);
    setNotice(null);
    try {
      await refundMyEntry(round);
      roundRef.current = null;
      setRound(null);
      await sendEvent('round_cancelled', { round });
      setNotice('تم إلغاء الجولة واسترداد رسوم دخول المشاركين.');
    } catch (cancelError) {
      setNotice(
        cancelError instanceof Error ? cancelError.message : 'تعذّر إلغاء الجولة.'
      );
    } finally {
      setBusy(false);
    }
  };

  const wheelGradient = alivePlayers.length
    ? `conic-gradient(${alivePlayers
        .map((_, index) => {
          const angle = (index * 360) / alivePlayers.length;
          const nextAngle = ((index + 1) * 360) / alivePlayers.length;
          return `${index % 2 ? '#18213A' : '#9A7021'} ${angle}deg ${nextAngle}deg`;
        })
        .join(', ')})`
    : 'conic-gradient(#9A7021 0deg 180deg, #18213A 180deg 360deg)';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md"
      onClick={() => !spinning && !busy && onClose()}
    >
      <section
        className="royal-glass relative flex max-h-[92dvh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-3xl border-2 border-[#F3D37A]/60 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.85)]"
        onClick={(event) => event.stopPropagation()}
        dir="rtl"
      >
        <header className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#FCE9A6]">
              <Sparkles className="h-5 w-5" />
              دولاب الإقصاء الجماعي
            </h2>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-300">
              <Coins className="h-3.5 w-3.5 text-[#F3D37A]" />
              رصيدك {userCoins.toLocaleString('en-US')} كوينز
            </p>
          </div>
          <button
            type="button"
            disabled={spinning || busy}
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 disabled:opacity-40"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {notice && (
          <p role="status" className="rounded-xl border border-[#F3D37A]/40 bg-[#D4AF37]/10 p-2 text-center text-sm font-bold text-[#FCE9A6]">
            {notice}
          </p>
        )}

        {!round ? (
          <div className="space-y-3 rounded-2xl bg-black/25 p-3">
            <p className="text-sm font-bold text-white">أنشئ جولة واختر قيمة الدخول</p>
            <div className="grid grid-cols-4 gap-2">
              {ROOM_WHEEL_ENTRY_FEES.map((fee) => (
                <button
                  key={fee}
                  type="button"
                  disabled={busy}
                  onClick={() => setEntryFee(fee)}
                  className={`rounded-xl border px-2 py-2 text-sm font-extrabold ${
                    entryFee === fee
                      ? 'border-[#FCE9A6] bg-[#D4AF37] text-[#070913]'
                      : 'border-white/15 bg-white/5 text-white'
                  }`}
                >
                  {fee.toLocaleString('en-US')}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy || !user}
              onClick={() => void handleCreateRound()}
              className="gold-btn w-full rounded-xl py-2.5 text-sm font-extrabold disabled:opacity-50"
            >
              {busy ? 'جارٍ إنشاء الجولة...' : 'إنشاء جولة'}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2 text-xs">
              <span className="text-slate-300">
                الدخول: <b className="text-[#FCE9A6]">{round.entryFee.toLocaleString('en-US')}</b>
              </span>
              <span className="text-slate-300">
                مجموع الجائزة: <b className="text-emerald-300">{round.prizePool.toLocaleString('en-US')}</b>
              </span>
            </div>

            <div className="relative mx-auto h-64 w-64 shrink-0 rounded-full border-[7px] border-[#D4AF37] p-1 shadow-[0_0_35px_rgba(212,175,55,0.35)]">
              <span className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 border-x-[12px] border-t-[22px] border-x-transparent border-t-rose-500 drop-shadow-md" />
              <div
                className="relative h-full w-full overflow-hidden rounded-full border-2 border-[#FCE9A6]/70 transition-transform"
                style={{
                  background: wheelGradient,
                  transform: `rotate(${rotation}deg)`,
                  transitionDuration: spinning ? `${ROOM_WHEEL_SPIN_DURATION_MS}ms` : '0ms',
                  transitionTimingFunction: 'cubic-bezier(0.12, 0.78, 0.22, 1)',
                }}
              >
                {alivePlayers.map((player, index) => {
                  const angle = (index * 360) / alivePlayers.length + 180 / alivePlayers.length - 90;
                  const radians = (angle * Math.PI) / 180;
                  const left = 50 + 36 * Math.cos(radians);
                  const top = 50 + 36 * Math.sin(radians);
                  return (
                    <div
                      key={player.userId}
                      className="absolute flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
                      style={{ left: `${left}%`, top: `${top}%` }}
                    >
                      <img
                        src={player.avatarUrl}
                        alt=""
                        className="h-9 w-9 rounded-full border-2 border-[#FCE9A6] bg-slate-800 object-cover"
                      />
                      <span className="mt-0.5 max-w-full truncate rounded bg-black/70 px-1 text-[9px] font-bold text-white">
                        {player.displayName}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-10 w-10 rounded-full border-2 border-[#FCE9A6] bg-[#070913] shadow-lg" />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-300">
              <Trophy className="h-4 w-4 text-[#F3D37A]" />
              {alivePlayers.length} متنافس متبقٍ من {round.players.length}
            </div>

            {round.status === 'registering' && !hasJoined && (
              <button
                type="button"
                disabled={busy || practiceRound || userCoins < round.entryFee}
                onClick={() => void handleJoinRound()}
                className="gold-btn w-full rounded-xl py-2.5 text-sm font-extrabold disabled:opacity-50"
              >
                {busy
                  ? 'جارٍ الانضمام...'
                  : practiceRound
                  ? 'جولة تدريبية بدون رسوم'
                  : `انضمام للجولة (${round.entryFee.toLocaleString('en-US')} كوينز)`}
              </button>
            )}

            {isCreator && round.status === 'registering' && (
              <div className="space-y-2">
                {round.prizePool === 0 && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setAddingCompetitor((value) => !value)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-white/5 py-2 text-xs font-bold text-[#FCE9A6]"
                    >
                      <Plus className="h-4 w-4" />
                      إضافة منافس
                    </button>
                    {addingCompetitor && (
                      <div className="max-h-28 space-y-1 overflow-y-auto rounded-xl bg-black/30 p-2">
                        {members
                          .filter(
                            (member) =>
                              member.userId !== user?.id &&
                              !round.players.some((player) => player.userId === member.userId)
                          )
                          .map((member) => (
                            <button
                              key={member.userId}
                              type="button"
                              disabled={busy}
                              onClick={() => void handleAddCompetitor(member)}
                              className="flex w-full items-center gap-2 rounded-lg p-1.5 text-right text-xs text-white hover:bg-white/10"
                            >
                              <img src={member.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                              <span>{member.displayName}</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </>
                )}
                <button
                  type="button"
                  disabled={busy || round.players.length < 2}
                  onClick={() => void handleStartRound()}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 py-2.5 text-sm font-extrabold text-white disabled:opacity-45"
                >
                  {busy ? 'جارٍ بدء السحب...' : 'ابدأ السحب'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleCancelRound()}
                  className="w-full rounded-xl border border-rose-400/40 bg-rose-950/30 py-2 text-xs font-bold text-rose-200 disabled:opacity-45"
                >
                  إلغاء الجولة واسترداد الرسوم
                </button>
              </div>
            )}

            {round.status === 'spinning' && (
              <p className="text-center text-sm font-extrabold text-[#FCE9A6]">
                {spinning ? 'يدور الدولاب...' : 'تتم الإقصاءات تلقائياً حتى يبقى فائز واحد'}
              </p>
            )}
            {round.status === 'finished' && round.winnerId && (
              <p className="text-center text-sm font-extrabold text-emerald-300">
                انتهت الجولة — الفائز: {round.players.find((player) => player.userId === round.winnerId)?.displayName}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
};

interface RoomSeatItemProps {
  seat: RoomSeat;
  isMe: boolean;
  isTop1: boolean;
  isHost: boolean;
  isHero5: boolean;
  vipLevel?: VipTierKey | null;
  sizeClass: string;
  seatEmoji?: RoomSeatEmojiEvent;
  seatGiftReaction?: SeatGiftReactionEvent;
  seatHaloActive?: boolean;
  onSeatClick: (seat: RoomSeat) => void;
  registerSeatRef: (seatIndex: number, el: HTMLDivElement | null) => void;
}

const RoomSeatItem = memo<RoomSeatItemProps>(
  ({
    seat,
    isMe,
    isTop1,
    isHost,
    isHero5,
    vipLevel,
    sizeClass,
    seatEmoji,
    seatGiftReaction,
    seatHaloActive = false,
    onSeatClick,
    registerSeatRef,
  }) => {
    const isActiveSpeaker = Boolean(seat.userId && seat.isSpeaking && !seat.isMuted);
    const resolvedVip = vipLevel || seat.vipLevel || 'none';
    return (
      <button
        type="button"
        onClick={() => onSeatClick(seat)}
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
          ref={(el) => registerSeatRef(seat.seatIndex, el)}
          className="relative flex items-center justify-center"
        >
          {/* Golden Speaking Waves */}
          {isActiveSpeaker && (
            <>
              <span className="absolute -inset-1.5 rounded-full border-2 border-[#FCE9A6] animate-gold-wave pointer-events-none" />
              <span className="absolute -inset-0.5 rounded-full border border-amber-400/90 shadow-[0_0_16px_rgba(251,191,36,0.9)] pointer-events-none" />
            </>
          )}

          {/* Tier 2 Medium Gift Radiant Golden Recipient Halo (3 Seconds) */}
          {seatHaloActive && (
            <>
              <motion.span
                aria-hidden="true"
                initial={{ scale: 0.85, opacity: 0.4 }}
                animate={{ scale: [1, 1.24, 1], opacity: [0.95, 0.45, 0.95] }}
                transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -inset-2.5 rounded-full border-2 border-[#FEF08A] bg-amber-400/20 shadow-[0_0_28px_rgba(251,191,36,0.95)] pointer-events-none z-10"
              />
              <span
                aria-hidden="true"
                className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-amber-300/35 via-yellow-200/20 to-orange-400/35 blur-sm pointer-events-none z-10"
              />
            </>
          )}

          {/* 3D Mic Reaction Subtle Light Halo Around Mic Frame (3 Seconds) */}
          {seatEmoji && !seatHaloActive && (
            <span
              key={`halo_${seatEmoji.id}`}
              aria-hidden="true"
              className="absolute -inset-2 rounded-full border-2 border-[#FEF08A]/80 bg-gradient-to-tr from-amber-300/20 via-yellow-100/10 to-rose-400/20 shadow-[0_0_22px_rgba(252,233,166,0.78),0_0_36px_rgba(244,63,94,0.35)] animate-mic-halo-3s pointer-events-none z-10"
            />
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
            <AvatarWithFrame
              src={seat.avatarUrl}
              alt={seat.displayName || 'متحدث'}
              frameId={seat.frameId}
              vipTier={resolvedVip}
              size={isHero5 ? 'lg' : 'md'}
              customSizeClass={sizeClass}
            />
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
                <Mic className={isHero5 ? 'w-5 h-5' : 'w-4 h-4'} />
              )}
            </div>
          )}

          {/* Tier 1 & 2: Floating 3D Gift Above Recipient Mic Avatar */}
          <AnimatePresence>
            {seatGiftReaction && (
              <motion.div
                key={seatGiftReaction.id}
                initial={{ scale: 0.35, opacity: 0, y: 12 }}
                animate={{
                  scale: [0.35, 1.2, 1],
                  opacity: [0, 1, 1],
                  y: [12, -8, -4],
                }}
                exit={{ scale: 0.5, opacity: 0, y: -14 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="absolute -top-7 sm:-top-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none"
              >
                <div className="relative flex items-center justify-center">
                  <span
                    aria-hidden="true"
                    className="absolute -inset-2 rounded-full bg-gradient-to-tr from-amber-400/55 via-yellow-200/35 to-orange-500/40 blur-md"
                  />
                  <Fluent3DAsset
                    glyph={seatGiftReaction.gift.glyph}
                    imageUrl={seatGiftReaction.gift.imageUrl}
                    alt={seatGiftReaction.gift.name}
                    priority
                    sizeClass="w-10 h-10 sm:w-11 sm:h-11"
                    fallbackTextClass="text-3xl"
                    className="drop-shadow-[0_8px_14px_rgba(0,0,0,0.9)]"
                  />
                  {(seatGiftReaction.quantity > 1 || seatGiftReaction.comboCount > 1) && (
                    <span className="absolute -bottom-1 -right-2 rounded-full bg-gradient-to-r from-[#FEF08A] to-[#D4AF37] px-1 text-[8px] font-mono-num font-black text-[#070913] shadow">
                      ×{seatGiftReaction.comboCount > 1 ? seatGiftReaction.comboCount : seatGiftReaction.quantity}
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* High-Resolution 3D Fluent Mic Reaction / 3D Die Face (3 Seconds Scale & Float) */}
          <AnimatePresence>
            {seatEmoji && (
              <motion.div
                key={seatEmoji.id}
                initial={{ scale: 0.3, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.4, opacity: 0, y: -14 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="absolute -inset-3 z-20 flex flex-col items-center justify-center pointer-events-none"
              >
                <div className="relative flex flex-col items-center justify-center animate-reaction-3d">
                  <span
                    aria-hidden="true"
                    className="absolute -inset-2 rounded-full bg-gradient-to-tr from-amber-400/45 via-yellow-200/25 to-rose-400/35 blur-md"
                  />
                  {seatEmoji.diceValue ? (
                    <div className="relative flex flex-col items-center">
                      <Royal3DDieFaceBadge
                        value={seatEmoji.diceValue}
                        sizeClass="w-11 h-11 sm:w-12 sm:h-12"
                      />
                      <span className="-mt-1.5 px-1.5 py-[1px] rounded-full bg-gradient-to-r from-[#FEF08A] to-[#D4AF37] text-[#070913] text-[9px] font-mono-num font-black leading-tight shadow">
                        {seatEmoji.diceValue}
                      </span>
                    </div>
                  ) : (
                    <Fluent3DAsset
                      glyph={seatEmoji.emoji}
                      alt={seatEmoji.label || 'تفاعل'}
                      priority
                      sizeClass="w-12 h-12 sm:w-14 sm:h-14"
                      fallbackTextClass="text-4xl"
                      className="drop-shadow-[0_10px_18px_rgba(0,0,0,0.85)]"
                    />
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
        <div className="mt-1 flex items-center justify-center gap-0.5 w-full max-w-[52px] mx-auto px-0.5 text-center">
          {seat.userId ? (
            <>
              {isHost && <span className="text-[8px] text-amber-300 shrink-0">👑</span>}
              <VipUserName
                name={seat.displayName || 'متحدث'}
                vipTier={resolvedVip}
                className="text-[9px] font-medium text-white/95 truncate leading-tight w-full max-w-[52px] mx-auto px-0.5 text-center"
              />
            </>
          ) : (
            <span className="text-[9px] font-medium text-slate-400/90 truncate w-full max-w-[52px] mx-auto px-0.5 text-center">
              {seat.isLocked ? 'مقفل' : 'مايك'}
            </span>
          )}
        </div>
      </button>
    );
  }
);

interface RoomChatMessageItemProps {
  message: RoomMessage;
  senderAvatarUrl?: string;
  senderFrameId?: string;
  senderGender?: User['gender'];
  senderLevel?: number;
  senderVipTier?: VipTierKey;
  onOpenMiniProfile: (userId: string, preview?: Partial<User>) => void;
}

const RoomChatMessageItem = memo<RoomChatMessageItemProps>(
  ({ message: m, senderAvatarUrl, senderFrameId, senderGender, senderLevel, senderVipTier, onOpenMiniProfile }) => {
    const resolvedVip: VipTierKey =
      senderVipTier && senderVipTier !== 'none'
        ? senderVipTier
        : parseVipTierKey(m.vipLevel || m.vipTier);
    const resolvedLevel = senderLevel ?? m.level;

    const isJoinSystem = m.type === 'system' && m.text.startsWith('دخل الغرفة');
    if (isJoinSystem) {
      return (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#18B75D] to-[#0FA958] px-3 py-0.5 text-[11px] font-bold text-white shadow-sm">
            <span>🔔</span>
            <span>{m.text}</span>
          </span>
        </div>
      );
    }

    if (m.type === 'system') {
      return (
        <div className="inline-block rounded-xl bg-black/45 px-2.5 py-1 text-[11px] text-amber-100/90">
          {m.text}
        </div>
      );
    }

    if (m.type === 'entry') {
      if (resolvedVip === 'vip1' || m.text.includes('VIP 1')) {
        return (
          <div className="vip-bronze-entry-bar rounded-xl px-3 py-1.5 text-[11px] font-extrabold text-[#FFF3DF] flex items-center gap-2">
            <VipTierBadge vipTier="vip1" compact />
            <span className="truncate">{m.text}</span>
          </div>
        );
      }
      if (resolvedVip === 'vip2' || m.text.includes('VIP 2')) {
        return (
          <div className="rounded-xl border border-sky-200/75 bg-gradient-to-r from-slate-800/90 via-sky-900/90 to-slate-900/90 px-3 py-1.5 text-[11px] font-extrabold text-sky-100 flex items-center gap-2 shadow-[0_4px_14px_rgba(56,189,248,0.3)]">
            <VipTierBadge vipTier="vip2" compact />
            <span className="truncate">{m.text}</span>
          </div>
        );
      }
      if (resolvedVip === 'svip' || m.text.includes('الإمبراطور')) {
        return (
          <div className="rounded-xl border-2 border-[#FEF08A] bg-gradient-to-r from-[#581C0C]/95 via-[#78350F]/95 to-[#1E1B4B]/95 px-3 py-2 text-xs font-black text-[#FFFBEB] flex items-center gap-2 shadow-[0_0_24px_rgba(251,191,36,0.55)]">
            <VipTierBadge vipTier="svip" compact />
            <VipUserName name={m.text} vipTier="svip" className="truncate" />
          </div>
        );
      }
      return (
        <div className="rounded-xl border border-[#D4AF37]/60 bg-gradient-to-r from-[#452806]/90 to-[#181006]/90 px-3 py-1.5 text-[11px] font-extrabold text-[#FCE9A6] flex items-center gap-2 shadow-sm">
          {resolvedVip !== 'none' && <VipTierBadge vipTier={resolvedVip} compact />}
          <span className="truncate">{m.text}</span>
        </div>
      );
    }

    if (m.type === 'gift' || m.type === 'wheel') {
      return (
        <div className="rounded-xl border border-[#D4AF37]/45 bg-gradient-to-r from-[#362407]/75 to-[#151008]/75 px-3 py-1.5 text-[11px] font-bold text-[#FCE9A6] shadow-sm">
          {m.text}
        </div>
      );
    }

    return (
      <div className="rounded-xl bg-black/50 px-2.5 py-1.5 text-xs leading-snug flex items-start gap-2">
        <button
          type="button"
          onClick={() =>
            onOpenMiniProfile(m.userId, {
              displayName: m.displayName,
              avatarUrl: senderAvatarUrl || m.avatarUrl,
              frameId: senderFrameId || m.frameId,
              gender: senderGender,
              level: resolvedLevel,
              is_admin: m.isAdmin,
              vipLevel: resolvedVip,
              femaleVerifiedBadge: m.femaleVerifiedBadge,
            })
          }
          className="shrink-0 mt-0.5 cursor-pointer"
        >
          <AvatarWithFrame
            src={senderAvatarUrl || m.avatarUrl}
            alt={m.displayName}
            frameId={senderFrameId || m.frameId || 'frame_obsidian'}
            vipTier={resolvedVip}
            size="xs"
          />
        </button>

        <div className="min-w-0 flex-1">
          <div className="inline-flex flex-wrap items-center gap-1 ml-1.5">
            <VipTierBadge vipTier={resolvedVip} compact />
            <span
              className={`inline-flex items-center rounded-md px-1.5 py-0.2 text-[9px] font-mono-num font-extrabold ${
                m.isAdmin
                  ? 'bg-amber-400 text-[#070913]'
                  : resolvedLevel >= 15
                  ? 'bg-sky-500/80 text-white'
                  : 'bg-emerald-600/80 text-white'
              }`}
            >
              Lv.{resolvedLevel}
            </span>
            <FemaleVerifiedBadge badge={m.femaleVerifiedBadge} />
            <button
              type="button"
              onClick={() =>
                onOpenMiniProfile(m.userId, {
                  displayName: m.displayName,
                  avatarUrl: senderAvatarUrl || m.avatarUrl,
                  frameId: senderFrameId || m.frameId,
                  gender: senderGender,
                  level: resolvedLevel,
                  is_admin: m.isAdmin,
                  vipLevel: resolvedVip,
                  femaleVerifiedBadge: m.femaleVerifiedBadge,
                })
              }
              className="font-extrabold text-[#FCE9A6] hover:underline cursor-pointer"
            >
              <VipUserName name={`${m.displayName}:`} vipTier={resolvedVip} />
              <GenderBadge gender={senderGender} />
            </button>
          </div>
          <span className="text-white/95">{m.text}</span>
        </div>
      </div>
    );
  }
);

export const RoomPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateLocalUser } = useAuth();
  const { openMiniProfile } = useMiniProfile();

  const {
    activeRoomId,
    room,
    extras,
    loading,
    error,
    clearError,
    isMinimized,
    exitModalOpen,
    setExitModalOpen,
    mySeat,
    micActive,
    totalVolumeCoins,
    canManage,
    isOwnerOrAdmin,
    micDenied,
    manualSpeakPulse,
    micRequest,
    micApprovedRequest,
    approveMicRequest,
    denyMicRequest,
    presenceMembers,
    topGifters,
    supportAndPlayLeaderboard,
    giftBanner,
    wheelBanner,
    entryBanner,
    flyingGifts,
    tier1SideNotices,
    mediumCelebrationGift,
    fullscreenGift,
    seatGiftReactions,
    seatHaloEffects,
    seatEmojis,
    musicState,
    musicVolume,
    musicMutedLocally,
    roomAudioMuted,
    effectsMuted,
    setMusicVolume,
    setMusicMutedLocally,
    setRoomAudioMuted,
    setEffectsMuted,
    handleSeatClick,
    handleToggleLock,
    handleToggleMute,
    handleManualSpeakToggle,
    handleRequestMicAccess,
    sendChat,
    sendSeatEmoji,
    updateSettings,
    runAdminAction,
    clearRoomChat,
    playUploadedMusic,
    toggleMusicPlayPause,
    stopRoomMusic,
    addPlayVolume,
    startContest,
    joinContest,
    voteContest,
    finishContest,
    clearContest,
    submitContestQuizAnswer,
    advanceContestQuizQuestion,
    giftTargetRequest,
    clearGiftTargetRequest,
  } = useActiveRoom();

  const [chatText, setChatText] = useState('');
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const [chatFilter, setChatFilter] = useState<'all' | 'chat'>('all');
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [visualViewportTop, setVisualViewportTop] = useState(0);
  const [canManageRoomActions, setCanManageRoomActions] = useState(false);
  const [isAgencyOwner, setIsAgencyOwner] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showWheelModal, setShowWheelModal] = useState(false);
  const [showGamesOverlay, setShowGamesOverlay] = useState(false);
  const [showInboxOverlay, setShowInboxOverlay] = useState(false);
  const [inboxSessionId, setInboxSessionId] = useState(0);
  const [clearingRoomChat, setClearingRoomChat] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [micPermissionOverride, setMicPermissionOverride] = useState<boolean | null>(null);
  const [showAgencyInfo, setShowAgencyInfo] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'agency' | 'members' | 'logs' | 'contests'>(
    'agency'
  );
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [leaderboardModalTab, setLeaderboardModalTab] = useState<
    'supporters' | 'heroes' | 'presence'
  >(
    'heroes'
  );
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [showContestModal, setShowContestModal] = useState(false);
  const [seatActionTarget, setSeatActionTarget] = useState<RoomSeat | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<'success' | 'error'>('success');
  const [isFollowingAgency, setIsFollowingAgency] = useState(false);
  const [ownedBackgrounds, setOwnedBackgrounds] = useState<string[]>([]);
  const requireMicPermission = micPermissionOverride ?? extras.requireMicPermission;
  const roomSettingsExtras =
    micPermissionOverride === null
      ? extras
      : { ...extras, requireMicPermission: micPermissionOverride };

  const handleUpdateRoomSettings = useCallback(
    async (patch: Parameters<typeof updateSettings>[0]) => {
      if (typeof patch.requireMicPermission === 'boolean') {
        setMicPermissionOverride(patch.requireMicPermission);
      }
      try {
        await updateSettings(patch);
      } catch (error) {
        if (typeof patch.requireMicPermission === 'boolean') {
          setMicPermissionOverride(null);
        }
        throw error;
      }
    },
    [updateSettings]
  );

  useEffect(() => {
    if (micPermissionOverride === extras.requireMicPermission) {
      setMicPermissionOverride(null);
    }
  }, [extras.requireMicPermission, micPermissionOverride]);

  useEffect(() => {
    const viewport = window.visualViewport;
    let maxViewportHeight = Math.max(window.innerHeight, viewport?.height || 0);
    let orientationTimer: number | undefined;
    const updateKeyboardState = () => {
      const height = viewport?.height ?? window.innerHeight;
      maxViewportHeight = Math.max(maxViewportHeight, height);
      setViewportHeight(height);
      setVisualViewportTop(viewport?.offsetTop || 0);
      window.scrollTo(0, 0);
      setIsKeyboardOpen(maxViewportHeight - height > 120);
    };
    const resetAfterOrientationChange = () => {
      window.clearTimeout(orientationTimer);
      orientationTimer = window.setTimeout(() => {
        const height = viewport?.height ?? window.innerHeight;
        maxViewportHeight = height;
        setIsKeyboardOpen(false);
        setViewportHeight(height);
        setVisualViewportTop(viewport?.offsetTop || 0);
        window.scrollTo(0, 0);
      }, 350);
    };

    viewport?.addEventListener('resize', updateKeyboardState);
    viewport?.addEventListener('scroll', updateKeyboardState);
    window.addEventListener('resize', updateKeyboardState);
    window.addEventListener('orientationchange', resetAfterOrientationChange);
    updateKeyboardState();

    return () => {
      viewport?.removeEventListener('resize', updateKeyboardState);
      viewport?.removeEventListener('scroll', updateKeyboardState);
      window.removeEventListener('resize', updateKeyboardState);
      window.removeEventListener('orientationchange', resetAfterOrientationChange);
      window.clearTimeout(orientationTimer);
    };
  }, []);

  const chatFeedRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const headerAnchorRef = useRef<HTMLDivElement | null>(null);
  const seatRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const showToast = useCallback((msg: string, variant: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastVariant(variant);
    setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const canClearRoomChat = Boolean(user?.is_admin || canManageRoomActions);

  const handleCopyAgencyId = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('النسخ غير متاح في هذا المتصفح.');
      }
      await navigator.clipboard.writeText(AGENCY_ID);
      showToast('تم النسخ.');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذّر نسخ رقم الوكالة.',
        'error'
      );
    }
  };

  const handleClearRoomChat = async () => {
    if (!canClearRoomChat || clearingRoomChat) return;
    setClearingRoomChat(true);
    try {
      await clearRoomChat();
      showToast('تم مسح الدردشة من الغرفة.');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذّر مسح دردشة الغرفة.',
        'error'
      );
    } finally {
      setClearingRoomChat(false);
    }
  };

  useEffect(() => {
    let active = true;
    setCanManageRoomActions(false);
    if (!room?.hostId || !user?.id) return;

    void canClearRoomChatFromData(
      { hostId: room.hostId },
      { id: user.id },
      { deputyIds: extras.deputyIds }
    )
      .then((allowed) => {
        if (active) setCanManageRoomActions(allowed);
      })
      .catch((err: unknown) => {
        if (!active) return;
        showToast(
          err instanceof Error
            ? err.message
            : 'تعذّر التحقق من صلاحيات إدارة الغرفة.',
          'error'
        );
      });

    return () => {
      active = false;
    };
  }, [extras.deputyIds, room?.hostId, showToast, user?.id]);

  useEffect(() => {
    let active = true;
    setIsAgencyOwner(false);
    if (!room?.hostId || !user?.id) return;

    void isRoomOrAgencyOwnerFromData({ hostId: room.hostId }, { id: user.id })
      .then((allowed) => {
        if (active) setIsAgencyOwner(allowed);
      })
      .catch((err: unknown) => {
        if (!active) return;
        showToast(
          err instanceof Error ? err.message : 'تعذّر التحقق من صلاحية الوكيل.',
          'error'
        );
      });

    return () => {
      active = false;
    };
  }, [room?.hostId, showToast, user?.id]);

  const registerSeatRef = useCallback((seatIndex: number, el: HTMLDivElement | null) => {
    seatRefs.current[seatIndex] = el;
  }, []);
  const equippedFrameId = user
    ? safeGetItem('sada_equipped_frame') || user.frameId
    : undefined;
  const canApproveMicRequests = canManageRoomActions;
  const canJoinMicWithoutApproval = !requireMicPermission || canApproveMicRequests;

  const userProfileLookup = useMemo(() => {
    const map = new Map<
      string,
      {
        avatarUrl?: string;
        frameId?: string;
        gender?: User['gender'];
        level?: number;
        vipLevel?: VipTierKey;
        displayName?: string;
      }
    >();
    if (Array.isArray(room?.seats)) {
      for (const s of room.seats) {
        if (s?.userId) {
          map.set(s.userId, {
            avatarUrl: s.avatarUrl || undefined,
            frameId: s.frameId || undefined,
            level: s.level ?? undefined,
            vipLevel: s.vipLevel || undefined,
            displayName: s.displayName || undefined,
          });
        }
      }
    }
    for (const p of presenceMembers) {
      const prev = map.get(p.userId);
      map.set(p.userId, {
        avatarUrl: p.avatarUrl || prev?.avatarUrl,
        frameId: p.frameId || prev?.frameId,
        gender: p.gender || prev?.gender,
        level: p.level ?? prev?.level,
        vipLevel: p.vipLevel && p.vipLevel !== 'none' ? p.vipLevel : prev?.vipLevel,
        displayName: p.displayName || prev?.displayName,
      });
    }
    if (user?.id) {
      const myVip = getUserVipTierInfo(user).key;
      const prev = map.get(user.id);
      map.set(user.id, {
        avatarUrl: user.avatarUrl || prev?.avatarUrl,
        frameId: equippedFrameId || prev?.frameId,
        gender: user.gender,
        level: user.level,
        vipLevel: myVip !== 'none' ? myVip : prev?.vipLevel,
        displayName: user.displayName || prev?.displayName,
      });
    }
    return map;
  }, [equippedFrameId, presenceMembers, room?.seats, user]);

  const unifiedPresenceList = useMemo(() => {
    const map = new Map<
      string,
      {
        userId: string;
        displayName: string;
        avatarUrl: string;
        frameId?: string;
        gender?: User['gender'];
        level: number;
        vipLevel: VipTierKey;
      }
    >();
    for (const p of presenceMembers) {
      const existing = map.get(p.userId);
      const fallback = userProfileLookup.get(p.userId);
      map.set(p.userId, {
        userId: p.userId,
        displayName: p.displayName || existing?.displayName || 'عضو',
        avatarUrl: p.avatarUrl || existing?.avatarUrl || 'host_male',
        frameId: p.frameId || existing?.frameId || 'frame_obsidian',
        gender: p.gender || existing?.gender || fallback?.gender,
        level: p.level ?? existing?.level ?? fallback?.level ?? 1,
        vipLevel:
          p.vipLevel && p.vipLevel !== 'none'
            ? p.vipLevel
            : fallback?.vipLevel || existing?.vipLevel || 'none',
      });
    }
    if (user?.id && !map.has(user.id)) {
      const profile = userProfileLookup.get(user.id);
      map.set(user.id, {
        userId: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        frameId: equippedFrameId,
        gender: profile?.gender ?? user.gender,
        level: profile?.level ?? user.level ?? 1,
        vipLevel: profile?.vipLevel || getUserVipTierInfo(user).key,
      });
    }
    return Array.from(map.values());
  }, [equippedFrameId, presenceMembers, user, userProfileLookup]);

  const supportersLeaderboard = useMemo(
    () =>
      supportAndPlayLeaderboard
        .filter((entry) => entry.supportCoins > 0)
        .sort((a, b) => b.supportCoins - a.supportCoins),
    [supportAndPlayLeaderboard]
  );
  const gameHeroesLeaderboard = useMemo(
    () =>
      supportAndPlayLeaderboard
        .filter((entry) => entry.playCoins > 0)
        .sort((a, b) => b.playCoins - a.playCoins),
    [supportAndPlayLeaderboard]
  );
  const activeLeaderboard =
    leaderboardModalTab === 'supporters'
      ? supportersLeaderboard
      : gameHeroesLeaderboard;

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

  useEffect(() => {
    if (!giftTargetRequest) return;
    window.dispatchEvent(new Event('sada:minimize'));
    navigate(`/messages?to=${encodeURIComponent(giftTargetRequest.userId)}&gift=1`);
    clearGiftTargetRequest();
  }, [giftTargetRequest, clearGiftTargetRequest, navigate]);

  useEffect(() => {
    if (!micApprovedRequest || !user || micApprovedRequest.userId !== user.id || !room) return;
    const free = (Array.isArray(room.seats) ? room.seats : []).find(
      (seat) => !seat.userId && !seat.isLocked
    );
    if (free) {
      void handleSeatClick(free.seatIndex);
      showToast('تمت الموافقة: تم إصعادك إلى المايك');
    } else {
      showToast('جميع المقاعد مشغولة حالياً');
    }
  }, [micApprovedRequest, room, user, handleSeatClick, showToast]);

  useEffect(() => {
    if (extras.activeContest?.status === 'active' && extras.activeContest.agencyQuiz) {
      setShowContestModal(true);
    }
  }, [
    extras.activeContest?.agencyQuiz?.currentIndex,
    extras.activeContest?.id,
    extras.activeContest?.status,
  ]);

  const handleSeatInteraction = useCallback(
    async (seat: RoomSeat) => {
      if (!user || !room) return;
      if (seat.isLocked) {
        if (canManage) {
          await handleToggleLock(seat.seatIndex, seat.isLocked);
          showToast(`تم فتح المقعد ${seat.seatIndex + 1}`);
        }
        return;
      }

      if (!seat.userId) {
        if (canJoinMicWithoutApproval) {
          await handleSeatClick(seat.seatIndex);
        } else {
          await handleRequestMicAccess();
          showToast('تم إرسال طلب الصعود إلى المايك بانتظار موافقة الوكيل');
        }
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
    },
    [
      user,
      room,
      canManage,
      handleToggleLock,
      showToast,
      handleSeatClick,
      canJoinMicWithoutApproval,
      handleRequestMicAccess,
      openMiniProfile,
    ]
  );

  const onSeatItemClick = useCallback(
    (seat: RoomSeat) => {
      void handleSeatInteraction(seat);
    },
    [handleSeatInteraction]
  );

  const isMinimizedRef = useRef(isMinimized);
  const activeRoomIdRef = useRef(activeRoomId);
  isMinimizedRef.current = isMinimized;
  activeRoomIdRef.current = activeRoomId;

  useEffect(() => {
    if (!activeRoomId || isMinimized) {
      setExitModalOpen?.(false);
      setSeatActionTarget(null);
      setShowEmojiPicker(false);
    }
  }, [activeRoomId, isMinimized, setExitModalOpen]);

  // Scroll chat smoothly when room is visible
  useEffect(() => {
    if (isMinimized) return;
    const timeout = window.setTimeout(() => {
      const feed = chatFeedRef.current;
      if (feed) {
        feed.scrollTop = feed.scrollHeight;
      }
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    return () => window.clearTimeout(timeout);
  }, [isMinimized, room?.messages]);

  // History State Trap: Push { inRoom: true } on enter/restore and intercept hardware Back
  useEffect(() => {
    if (!activeRoomId || isMinimized) return;

    if (!window.history.state?.inRoom) {
      window.history.pushState({ inRoom: true }, '');
    }

    const handlePopState = () => {
      if (isMinimizedRef.current || !activeRoomIdRef.current) return;
      setExitModalOpen(true);
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
  }, [activeRoomId, isMinimized, setExitModalOpen]);

  const topSpeakerSeatIndex = useMemo(() => {
    const seats = Array.isArray(room?.seats) ? room.seats : [];
    if (!seats.length) return -1;
    let bestIdx = -1;
    let bestVal = 0;
    for (const s of seats) {
      if (s?.userId && (s.receivedDiamonds || 0) > bestVal) {
        bestVal = s.receivedDiamonds || 0;
        bestIdx = s.seatIndex;
      }
    }
    if (bestIdx === -1) {
      const firstSeated = seats.find((s) => s?.userId);
      return firstSeated ? firstSeated.seatIndex : -1;
    }
    return bestIdx;
  }, [room?.seats]);

  const handleFollowAgency = async () => {
    if (!room || !user) return;
    try {
      const res = await toggleFollowAgencyInSupabase(user.id, room.id);
      setIsFollowingAgency(res.following);
      showToast(
        res.following
          ? `♥ تمت متابعة "${room.title}" وإضافتها لقسم الخاص بي ✓`
          : 'تم إلغاء متابعة الوكالة'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذّر تحديث متابعة الوكالة');
    }
  };

  const filteredMessages = useMemo(() => {
    const list = room?.messages || [];
    const seenJoinUserIds = new Set<string>();
    const seenEntryMessages = new Set<string>();
    const deduplicated = list.filter((m) => {
      const isJoinMessage =
        m.type === 'system' && typeof m.text === 'string' && m.text.startsWith('دخل الغرفة');
      if (isJoinMessage) {
        if (seenJoinUserIds.has(m.userId)) return false;
        seenJoinUserIds.add(m.userId);
        return true;
      }
      if (m.type === 'entry') {
        const entryKey = `${m.userId}:${m.text}`;
        if (seenEntryMessages.has(entryKey)) return false;
        seenEntryMessages.add(entryKey);
      }
      return true;
    });
    if (chatFilter === 'chat') {
      return deduplicated.filter((m) => m.type === 'chat');
    }
    return deduplicated;
  }, [chatFilter, room?.messages]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    const text = chatText.trim();
    setChatText('');
    setShowEmojiPicker(false);
    await sendChat(text);
  };

  const handlePickSeatEmoji = (item: (typeof ROOM_REACTION_EMOJIS)[number]) => {
    setShowEmojiPicker(false);
    sendSeatEmoji({ emoji: item.emoji, label: item.label, isDice: item.isDice });
    if (!mySeat) {
      showToast(`${item.emoji} اصعد على المايك ليظهر التفاعل المتحرك فوق صورتك!`);
    }
  };

  // Resolve exact viewport start & destination coordinates for flying gifts
  const resolveFlyStartPoint = () => {
    return {
      x: typeof window !== 'undefined' ? window.innerWidth * 0.28 : 120,
      y: typeof window !== 'undefined' ? window.innerHeight - 44 : 620,
    };
  };

  const resolveRecipientPoint = (recipientId: string, idx: number) => {
    const seat = Array.isArray(room?.seats)
      ? room.seats.find((s) => s?.userId === recipientId)
      : undefined;
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

  const micSeats = (room?.seats || []).slice(0, 24);
  const micGridClass =
    micSeats.length === 6
      ? 'grid-cols-3 gap-6'
      : micSeats.length === 12
      ? 'grid-cols-4 gap-4'
      : 'grid-cols-6 gap-3';
  const renderMicSeat = (seat: RoomSeat) => {
    const seatLookup = seat.userId ? userProfileLookup.get(seat.userId) : undefined;
    return (
      <RoomSeatItem
        key={seat.seatIndex}
        isMe={seat.userId === user?.id}
        isTop1={Boolean(seat.userId && seat.seatIndex === topSpeakerSeatIndex)}
        isHost={Boolean(seat.userId && seat.userId === room?.hostId)}
        isHero5={false}
        vipLevel={seatLookup?.vipLevel || seat.vipLevel || 'none'}
        sizeClass={micSeats.length === 6 && seat.seatIndex === 0 ? 'w-12 h-12' : 'w-11 h-11'}
        seat={
          seat.userId === user?.id && equippedFrameId
            ? { ...seat, frameId: equippedFrameId }
            : seat
        }
        seatEmoji={seat.userId ? seatEmojis[seat.userId] : undefined}
        seatGiftReaction={seat.userId ? seatGiftReactions[seat.userId] : undefined}
        seatHaloActive={Boolean(seat.userId && seatHaloEffects[seat.userId])}
        onSeatClick={onSeatItemClick}
        registerSeatRef={registerSeatRef}
      />
    );
  };

  return (
    <div
      style={{
        top: `${visualViewportTop}px`,
        height: viewportHeight ? `${viewportHeight}px` : '100dvh',
      }}
      className={`fixed inset-x-0 z-50 flex flex-col overflow-hidden bg-[#0b0e17] text-white ${
        fullscreenGift ? 'animate-dragon-shake' : ''
      }`}
    >
      {!room ? (
        loading ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div className="royal-glass rounded-3xl px-7 py-5 text-sm font-extrabold text-[#FCE9A6]">
              جارٍ دخول الغرفة الصوتية...
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <p className="text-rose-400 font-bold text-sm">
              {error || 'تعذّر فتح الغرفة الصوتية.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="gold-btn rounded-2xl px-6 py-2.5 text-sm cursor-pointer"
            >
              العودة إلى الوكالات
            </button>
          </div>
        )
      ) : (
        <>
          {/* Golden Dragon Dark Stage (or selected/uploaded agency backdrop) */}
          <DragonStageBackdrop coverImage={room.coverImage} />
          <div aria-hidden="true" className="fixed inset-0 z-[1] pointer-events-none bg-black/25" />

      <div className="relative z-10 flex flex-1 min-h-0 flex-col gap-1 max-w-2xl w-full mx-auto px-2.5 sm:px-4 pt-1 pb-2">
        {/* 1. ROOM TOP BAR */}
        <header
          className="relative z-30 shrink-0 pt-2 px-2.5 pb-1 bg-[#0b0e17]/95 flex items-center justify-between gap-1.5"
        >
          {/* Right Side (RTL start): Agency Square Avatar, Title + Follow Button, ID */}
          <div
            ref={headerAnchorRef}
            className="flex items-center gap-1.5 min-w-0 bg-[#14161f]/95 border border-[#D4AF37]/35 rounded-2xl p-1 pl-2"
          >
            <button
              type="button"
              onClick={() => setShowAgencyInfo(true)}
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-[#F3D37A]/70 shrink-0 cursor-pointer"
              title="معلومات الوكالة"
              aria-label="معلومات الوكالة"
            >
              <img
                src={resolveAsset(room.hostAvatar)}
                alt={room.title}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </button>

            <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => setShowAgencyInfo(true)}
                className="min-w-0 break-words text-[11px] sm:text-sm font-extrabold text-white leading-tight text-right cursor-pointer hover:text-[#FCE9A6]"
                title="معلومات الوكالة"
              >
                <h1 className="min-w-0 break-words text-[11px] sm:text-sm font-extrabold text-white leading-tight">
                  {room.title}
                </h1>
              </button>
                <button
                  type="button"
                  onClick={() => void handleFollowAgency()}
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition ${
                    isFollowingAgency
                      ? 'bg-rose-600/35 border border-rose-400 text-rose-300'
                      : 'bg-black/45 border border-white/20 text-rose-200 hover:bg-rose-950/50'
                  }`}
                  aria-label={isFollowingAgency ? 'إلغاء متابعة الوكالة' : 'متابعة الوكالة'}
                  title={isFollowingAgency ? 'إلغاء متابعة الوكالة' : 'متابعة الوكالة'}
                >
                  <Heart className={`w-3.5 h-3.5 ${isFollowingAgency ? 'fill-rose-400 text-rose-400' : ''}`} />
                </button>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-mono-num font-bold text-amber-100/95 shadow-inner backdrop-blur-md">
                <span>ID الوكالة: {AGENCY_ID}</span>
                <button
                  type="button"
                  onClick={() => void handleCopyAgencyId()}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-amber-100 hover:bg-white/15 cursor-pointer"
                  aria-label="نسخ رقم الوكالة"
                  title="نسخ رقم الوكالة"
                >
                  <Copy className="w-3 h-3" />
                </button>
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

                const gifterVip = gifter
                  ? userProfileLookup.get(gifter.userId)?.vipLevel || gifter.vipLevel || 'none'
                  : 'none';
                return (
                  <button
                    key={rankIdx}
                    type="button"
                    onClick={() => {
                      setLeaderboardModalTab('supporters');
                      setShowLeaderboardModal(true);
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
                      className={`absolute -top-1 -right-1 z-20 w-3.5 h-3.5 rounded-full text-[8px] font-mono-num font-black flex items-center justify-center shadow ${badgeBg}`}
                    >
                      {rankIdx + 1}
                    </span>
                    {gifter ? (
                      <AvatarWithFrame
                        src={gifter.avatarUrl}
                        alt={gifter.displayName}
                        frameId={gifter.frameId}
                        vipTier={gifterVip}
                        size="xs"
                      />
                    ) : (
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border-2 bg-black/50 flex items-center justify-center ${rankBorder}`}
                      >
                        <Crown className="w-3.5 h-3.5 text-[#D4AF37]/60" />
                      </div>
                    )}
                    <span
                      className={`-mt-1.5 relative z-10 px-1 rounded-full text-[8px] font-mono-num font-extrabold leading-tight shadow ${badgeBg}`}
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
                  setLeaderboardModalTab('presence');
                  setShowLeaderboardModal(true);
                }
              }}
              className="flex items-center gap-0.5 bg-black/40 border border-white/15 rounded-full px-1.5 sm:px-2 py-1 text-[10px] sm:text-[11px] font-mono-num font-bold text-white cursor-pointer"
              title="المتواجدون الآن داخل الغرفة"
            >
              <span>{unifiedPresenceList.length}</span>
              <Users className="w-3 h-3 text-slate-200" />
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
                aria-label="إعدادات الغرفة"
                title="إعدادات وإدارة الغرفة"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {/* Discreet Minimize / Leave trigger (complements hardware back trap) */}
            <button
              type="button"
              onClick={() => setExitModalOpen(true)}
              className="w-7 h-7 rounded-full bg-black/35 hover:bg-black/60 border border-white/15 text-slate-200 flex items-center justify-center cursor-pointer"
              aria-label="تصغير أو خروج"
              title="تصغير أو خروج"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* SUB-HEADER ROW: Trophy Leaderboard + Mute Room | Device Music + Agent Mod Log */}
        <div className="flex items-center justify-between gap-1.5 mt-1.5 mb-1.5 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setLeaderboardModalTab('heroes');
                setShowLeaderboardModal(true);
              }}
              className="inline-flex w-7 h-7 sm:w-8 sm:h-8 items-center justify-center rounded-full overflow-hidden border-2 border-amber-300 bg-gradient-to-r from-[#2D2007]/90 to-[#141008]/90 shadow-[0_0_14px_rgba(212,175,55,0.3)] cursor-pointer hover:brightness-110"
              title="تصنيف أبطال الألعاب والمسابقات"
              aria-label="تصنيف أبطال الألعاب والمسابقات"
            >
              <Trophy className="w-4 h-4 text-[#FDE047]" />
            </button>

            <button
              type="button"
              onClick={() => setShowWheelModal(true)}
              className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-rose-700/80 to-amber-700/80 border border-amber-300/50 px-2 py-1 text-[10px] font-extrabold text-white cursor-pointer"
              title="دولاب الإقصاء الجماعي بالكوينز"
            >
              <Sparkles className="w-3 h-3 text-amber-200" />
              <span>دولاب الإقصاء</span>
            </button>

            {isAgencyOwner && (
              <button
                type="button"
                onClick={() => {
                  setSettingsInitialTab('contests');
                  setShowSettingsModal(true);
                }}
                className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-600/85 to-teal-700/85 border border-emerald-300/60 px-2.5 py-1 text-[10px] font-extrabold text-white hover:brightness-110 cursor-pointer"
                title="إدارة مسابقة الوكالة الثقافية"
              >
                <Trophy className="w-3 h-3 text-[#FCE9A6]" />
                <span>مسابقة الوكالة</span>
              </button>
            )}

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

            {canClearRoomChat && (
              <button
                type="button"
                disabled={clearingRoomChat}
                onClick={() => void handleClearRoomChat()}
                className="inline-flex items-center gap-1 rounded-xl bg-rose-950/60 border border-rose-400/50 px-2 py-1 text-[10px] font-extrabold text-rose-200 hover:bg-rose-900/70 cursor-pointer disabled:opacity-50"
                title="مسح جميع رسائل الدردشة في الغرفة"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-300" />
                <span>{clearingRoomChat ? 'جارٍ المسح...' : 'مسح الدردشة'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {canManageRoomActions && (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* LIVE CONTEST BANNER FOR ALL ROOM MEMBERS */}
        {extras?.activeContest && (
          <button
            type="button"
            onClick={() => setShowContestModal(true)}
            className="mb-1.5 w-full rounded-2xl border border-[#FCE9A6]/70 bg-gradient-to-r from-[#2E2107]/95 via-[#181209]/95 to-[#0B2E22]/95 px-3 py-1.5 flex items-center justify-between gap-2 shadow-[0_0_20px_rgba(212,175,55,0.35)] shrink-0 cursor-pointer hover:brightness-110 transition"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Trophy className="w-4 h-4 text-[#FCE9A6] shrink-0" />
              <p className="text-[11px] font-extrabold text-white truncate">
                {extras.activeContest.status === 'active'
                  ? `مسابقة جارية: ${extras.activeContest.title}`
                  : `الفائز: ${extras.activeContest.winnerName || extras.activeContest.title}`}
              </p>
            </div>
            <span className="rounded-full bg-[#FCE9A6]/20 border border-[#FCE9A6]/50 px-2 py-0.5 text-[10px] font-mono-num font-extrabold text-[#FCE9A6] shrink-0">
              {extras.activeContest.status === 'active'
                ? `${Array.isArray(extras.activeContest.entries) ? extras.activeContest.entries.length : 0} مشارك · شارك/صوّت`
                : 'عرض النتيجة'}
            </span>
          </button>
        )}

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
                  : toastVariant === 'error'
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
              <div className="flex items-center gap-2.5 min-w-0">
                <Fluent3DAsset
                  glyph={giftBanner.gift.glyph}
                  imageUrl={giftBanner.gift.imageUrl}
                  alt={giftBanner.gift.name}
                  priority
                  sizeClass="w-8 h-8"
                  fallbackTextClass="text-2xl"
                />
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
              className="mb-1.5 rounded-xl border border-[#FCE9A6]/70 bg-[#2C1E06]/95 px-3 py-1.5 flex items-center justify-center gap-2 text-[11px] font-extrabold text-[#FCE9A6] shrink-0"
            >
              <Fluent3DAsset
                glyph={wheelBanner.segment.glyph}
                alt={wheelBanner.segment.label}
                priority
                sizeClass="w-5 h-5"
                fallbackTextClass="text-sm"
              />
              <span>فاز {wheelBanner.winnerName} بـ {wheelBanner.segment.label}</span>
            </motion.div>
          )}
          <VipEntranceOverlay entry={entryBanner} />
        </AnimatePresence>

        {/* 2. TAKA MIC GRID */}
        <section className="shrink-0 relative z-20 min-h-[270px] flex flex-col justify-center">
          <div className={`grid w-full content-center justify-items-center px-1.5 ${micGridClass}`}>
            {micSeats.map(renderMicSeat)}
          </div>
        </section>

        {/* 3. PUBLIC CHAT (Compact Height + 2 Filter Tabs: All/Gifts vs Chat Only) */}
        <section className="flex-1 min-h-0 overflow-y-auto px-3 pb-1 py-1 flex flex-col mt-1">
          {/* Compact Chat Filter Tabs */}
          <div
            className={`flex items-center gap-1.5 px-1 mb-1 shrink-0 ${
              isKeyboardOpen ? 'hidden' : ''
            }`}
          >
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

          <div ref={chatFeedRef} className="flex-1 min-h-0 overflow-y-auto mt-1 no-scrollbar space-y-1.5 px-1 py-0.5">
            {chatFilter === 'all' && (
              <div className="rounded-2xl bg-black/45 border border-[#D4AF37]/25 px-3 py-1.5 text-xs leading-relaxed">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="font-extrabold text-[#FCE9A6]">إعلان الغرفة</span>
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
                  {room.description || 'أهلاً بكم في الغرفة الصوتية · نتمنى لكم أطيب الأوقات!'}
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
                const senderInfo = userProfileLookup.get(m.userId);
                return (
                  <RoomChatMessageItem
                    key={m.id}
                    message={m}
                    senderAvatarUrl={senderInfo?.avatarUrl || m.avatarUrl}
                    senderFrameId={senderInfo?.frameId || m.frameId}
                    senderGender={senderInfo?.gender}
                    senderLevel={senderInfo?.level}
                    senderVipTier={senderInfo?.vipLevel}
                    onOpenMiniProfile={openMiniProfile}
                  />
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
              className="mb-1.5 rounded-2xl bg-[#14161f]/95 border border-[#F3D37A]/45 p-2.5 shadow-[0_0_24px_rgba(0,0,0,0.7)] shrink-0"
            >
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-[11px] font-extrabold text-[#FCE9A6]">
                  سمايلات الدردشة والمايك
                </span>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-[9px] font-bold text-slate-300 mb-1">سمايلات الدردشة الثابتة</p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {FIXED_CHAT_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setChatText((prev) => `${prev}${emoji}`)}
                        className="h-8 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xl flex items-center justify-center cursor-pointer"
                        aria-label={`إضافة ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-[#FCE9A6] mb-1">
                    سمايلات تفاعلية متحركة فوق المايك
                  </p>
                  <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5">
                    {ROOM_REACTION_EMOJIS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handlePickSeatEmoji(item)}
                        className="rounded-xl bg-white/5 hover:bg-[#D4AF37]/20 border border-white/10 hover:border-[#F3D37A]/60 py-1.5 px-1 flex flex-col items-center gap-1 transition cursor-pointer active:scale-95"
                      >
                        <Fluent3DAsset
                          glyph={item.emoji}
                          alt={item.label}
                          priority
                          sizeClass="w-7 h-7"
                          fallbackTextClass="text-xl"
                        />
                        <span className="text-[9px] font-bold text-slate-200 truncate max-w-full">
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {micRequest && canApproveMicRequests && (
          <div className="mb-1.5 rounded-2xl border border-[#D4AF37]/50 bg-[#15100A]/95 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold text-[#FCE9A6] truncate">
                طلب صعود للمايك: {micRequest.displayName}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => approveMicRequest(micRequest)}
                className="rounded-xl bg-emerald-600/80 border border-emerald-300/70 px-3 py-1 text-[10px] font-extrabold text-white cursor-pointer"
              >
                موافقة
              </button>
              <button
                type="button"
                onClick={() => denyMicRequest(micRequest)}
                className="rounded-xl bg-rose-950/70 border border-rose-400/50 px-3 py-1 text-[10px] font-extrabold text-rose-200 cursor-pointer"
              >
                رفض
              </button>
            </div>
          </div>
        )}

        {/* 4. FIXED SINGLE-ROW BOTTOM ACTION BAR */}
        <footer className="relative z-30 shrink-0 bg-[#14161f] px-2 py-2 pb-4">
          <div className="flex items-center gap-1.5">
            {/* 1. Public Chat Input Box */}
            <form
              onSubmit={handleSendChat}
              className="flex-1 min-w-0 flex items-center gap-1 rounded-full bg-[#14161f]/95 border border-white/20 px-3 py-1"
            >
              <input
                ref={chatInputRef}
                type="text"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onFocus={() => {
                  setShowEmojiPicker(false);
                  window.scrollTo(0, 0);
                  const viewport = window.visualViewport;
                  setVisualViewportTop(viewport?.offsetTop || 0);
                  setViewportHeight(viewport?.height || window.innerHeight);
                }}
                placeholder="أهلاً..."
                className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none py-1"
              />
              {isKeyboardOpen && (
                <button
                  type="button"
                  onClick={() => {
                    chatInputRef.current?.blur();
                    setShowEmojiPicker((current) => !current);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#FCE9A6] cursor-pointer shrink-0"
                  aria-label="سمايلات"
                >
                  <Smile className="w-5 h-5" />
                </button>
              )}
              <button
                type="submit"
                disabled={!chatText.trim()}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FEF08A] via-[#D4AF37] to-[#B45309] border border-[#FFF8DC] text-[#070913] flex items-center justify-center cursor-pointer shrink-0 shadow-[0_0_12px_rgba(212,175,55,0.45)] disabled:opacity-50 disabled:cursor-default active:scale-95"
                aria-label="إرسال"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

            {!isKeyboardOpen && (
              <>
            {/* 2. Interactive Seat Emojis Button (😊) */}
            <button
              type="button"
              onClick={() => {
                chatInputRef.current?.blur();
                setShowEmojiPicker((v) => !v);
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center border cursor-pointer shrink-0 transition active:scale-95 ${
                showEmojiPicker
                  ? 'bg-[#D4AF37] border-[#FFF3C4] text-[#070913] shadow-[0_0_14px_rgba(243,211,122,0.7)]'
                  : 'bg-black/60 border-white/20 text-[#FCE9A6] hover:border-[#F3D37A]/60'
              }`}
              aria-label="سمايلات تفاعلية"
              title="السمايلات التفاعلية"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* External Chats / Inbox Button (صندوق الوارد) without leaving room */}
            <button
              type="button"
              onClick={() => {
                setInboxSessionId((sessionId) => sessionId + 1);
                setShowInboxOverlay(true);
              }}
              className="w-10 h-10 rounded-full bg-black/60 border border-[#D4AF37]/45 text-[#FCE9A6] hover:border-[#FCE9A6] hover:bg-[#D4AF37]/20 flex items-center justify-center cursor-pointer shrink-0 transition active:scale-95"
              aria-label="الدردشات الخارجية"
              title="الدردشات الخارجية / صندوق الوارد"
            >
              <Mail className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowGamesOverlay(true)}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/35 to-teal-700/45 border border-emerald-400/60 text-emerald-100 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.35)] hover:border-emerald-300 cursor-pointer shrink-0 active:scale-95"
              aria-label="الألعاب"
              title="مركز الألعاب داخل الغرفة"
            >
              <Gamepad2 className="w-5 h-5" />
            </button>

            {/* Mic Control Button (🎙️ / 🔇) */}
            <button
              type="button"
              onClick={() => {
                if (mySeat) {
                  void handleToggleMute?.();
                } else {
                  if (canJoinMicWithoutApproval) {
                    const free = (Array.isArray(room?.seats) ? room.seats : []).find(
                      (seat) => !seat.userId && !seat.isLocked
                    );
                    if (free) void handleSeatClick(free.seatIndex);
                    else showToast('جميع المقاعد مشغولة حالياً');
                  } else {
                    void handleRequestMicAccess();
                    showToast('تم إرسال طلب الصعود إلى المايك بانتظار موافقة الوكيل');
                  }
                }
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center border cursor-pointer shrink-0 transition active:scale-95 ${
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
              </>
            )}
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
                      x: start.x - 28,
                      y: start.y - 28,
                      scale: 0.45,
                      opacity: 0.95,
                    }}
                    animate={{
                      x: [start.x - 28, midX - 28, target.x - 28],
                      y: [start.y - 28, midY - 28, target.y - 28],
                      scale: [0.55, 1.5, 1.2, 0.75],
                      opacity: [0.95, 1, 1, 0],
                    }}
                    transition={{
                      duration: 1.05,
                      delay: idx * 0.05,
                      ease: 'easeInOut',
                    }}
                    className="fixed top-0 left-0 w-14 h-14 flex items-center justify-center"
                  >
                    <span className="absolute -inset-2 rounded-full bg-gradient-to-tr from-amber-400/65 via-yellow-200/35 to-rose-500/45 blur-md" />
                    <span className="absolute inset-0 rounded-full border border-[#FCE9A6]/75 shadow-[0_0_24px_rgba(251,191,36,0.95)]" />
                    <Fluent3DAsset
                      glyph={fly.gift.glyph}
                      alt={fly.gift.name}
                      priority
                      sizeClass="w-12 h-12"
                      fallbackTextClass="text-4xl"
                      className="drop-shadow-[0_6px_16px_rgba(251,191,36,0.95)]"
                    />
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

      {/* TIER 1 SIDE COMBO BANNERS & TIER 2 3-SECOND CENTER GLOWING CELEBRATION */}
      <TieredGiftEffectsOverlay
        tier1SideNotices={tier1SideNotices}
        mediumCelebrationGift={mediumCelebrationGift}
        hostName={room.hostName}
      />

      {/* TIER 3 FULLSCREEN 4.5-SECOND ROYAL GIFT CINEMA OVERLAY */}
      <DragonCinemaOverlay event={fullscreenGift} hostName={room.hostName} />

      {/* SEAT INTERACTION SHEET */}
      <AnimatePresence>
        {seatActionTarget && seatActionTarget.userId && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:p-4"
            onClick={() => setSeatActionTarget(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="royal-glass room-modal-panel w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 pb-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                {(() => {
                  const targetVip =
                    seatActionTarget.vipLevel ||
                    userProfileLookup.get(seatActionTarget.userId!)?.vipLevel ||
                    'none';
                  return (
                    <div className="flex items-center gap-3">
                      <AvatarWithFrame
                        src={seatActionTarget.avatarUrl}
                        alt={seatActionTarget.displayName || 'متحدث'}
                        frameId={seatActionTarget.frameId}
                        vipTier={targetVip}
                        size="md"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-extrabold text-white">
                            <VipUserName
                              name={seatActionTarget.displayName || 'متحدث'}
                              vipTier={targetVip}
                            />
                          </h4>
                          <VipTierBadge vipTier={targetVip} compact />
                        </div>
                        <p className="text-[11px] text-[#FCE9A6] font-mono-num">
                          مايك {seatActionTarget.seatIndex + 1} · 💎{' '}
                          {(seatActionTarget.receivedDiamonds || 0).toLocaleString('en-US')}
                        </p>
                      </div>
                    </div>
                  );
                })()}
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
                        const targetUserId = seatActionTarget.userId!;
                        setSeatActionTarget(null);
                        window.dispatchEvent(new Event('sada:minimize'));
                        navigate(`/messages?to=${encodeURIComponent(targetUserId)}&gift=1`);
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

      {/* FLOATING IN-ROOM INBOX OVERLAY (Read/Reply PMs without leaving voice room!) */}
      <AnimatePresence>
        {showInboxOverlay && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-[#0d111e]"
            onClick={() => setShowInboxOverlay(false)}
          >
            <motion.div
              initial={{ y: 70, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 70, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl h-[86dvh] rounded-t-[28px] overflow-hidden shadow-2xl border-t border-x border-[#D4AF37]/40 bg-[#0d111e]"
            >
              <MessagesPage
                key={inboxSessionId}
                embedded
                onCloseEmbedded={() => setShowInboxOverlay(false)}
                onRechargeCoins={() => {
                  setShowInboxOverlay(false);
                  window.dispatchEvent(new Event('sada:minimize'));
                  navigate('/wallet');
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LUCKY WHEEL MODAL */}
      {showWheelModal && (
        <RoomWheelGame
          roomId={room.id}
          userCoins={user?.coins ?? 0}
          members={presenceMembers}
          onPlaySpent={(coins) => void addPlayVolume(coins)}
          onSendChat={sendChat}
          onClose={() => setShowWheelModal(false)}
        />
      )}

      {showGamesOverlay && (
        <div id="room-games-overlay">
          <style>{`
            #room-games-overlay > .fixed.inset-0.z-50 {
              background: transparent !important;
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
            }
            #room-games-overlay > .fixed.inset-0.z-50 > div {
              opacity: 1 !important;
              transform: none !important;
              transition: none !important;
            }
          `}</style>
          <RoomGamesModal
            roomId={room.id}
            roomTitle={room.title}
            totalVolumeCoins={totalVolumeCoins}
            mySeat={mySeat}
            micActive={micActive}
            userCoins={user?.coins ?? 0}
            onToggleMute={() => void handleToggleMute()}
            onRecharge={() => {
              setShowGamesOverlay(false);
              window.dispatchEvent(new Event('sada:minimize'));
              navigate('/wallet');
            }}
            onOpenAgency={() => {
              setShowGamesOverlay(false);
              window.dispatchEvent(new Event('sada:minimize'));
              navigate('/agency');
            }}
            onPlaySpent={(coins) => void addPlayVolume(coins)}
            onClose={() => setShowGamesOverlay(false)}
          />
        </div>
      )}

      {/* PLAY & SUPPORT LEADERBOARD + ROOM PRESENCE MODAL */}
      <AnimatePresence>
        {showLeaderboardModal && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0d111e] p-0 sm:p-4"
            onClick={() => setShowLeaderboardModal(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="royal-glass room-modal-panel w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3 max-h-[82vh] flex flex-col"
            >
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FDE047] to-[#B45309] text-[#070913] flex items-center justify-center shadow">
                    {leaderboardModalTab === 'presence' ? (
                      <Users className="w-5 h-5" />
                    ) : (
                      leaderboardModalTab === 'supporters' ? (
                        <Gift className="w-5 h-5" />
                      ) : (
                        <Trophy className="w-5 h-5" />
                      )
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold gold-gradient-text">
                      {leaderboardModalTab === 'presence'
                        ? `المتواجدون في الغرفة (${unifiedPresenceList.length})`
                        : leaderboardModalTab === 'supporters'
                        ? 'أكبر الداعمين في الغرفة'
                        : 'تصنيف أبطال الألعاب والمسابقات'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {leaderboardModalTab === 'presence'
                        ? 'مجموع الجالسين على المايكات والمستمعين دون تكرار'
                        : leaderboardModalTab === 'supporters'
                        ? 'ترتيب الداعمين بحسب قيمة الهدايا المرسلة'
                        : 'ترتيب الأعضاء بحسب نقاط الألعاب والمسابقات'}
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

              <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/20 shrink-0">
                <button
                  type="button"
                  onClick={() => setLeaderboardModalTab('supporters')}
                  className={`min-h-[38px] rounded-xl px-1 text-[10px] sm:text-xs font-extrabold transition cursor-pointer ${
                    leaderboardModalTab === 'supporters'
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  🎁 الداعمون
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardModalTab('heroes')}
                  className={`min-h-[38px] rounded-xl px-1 text-[10px] sm:text-xs font-extrabold transition cursor-pointer ${
                    leaderboardModalTab === 'heroes'
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  🏆 الأبطال
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardModalTab('presence')}
                  className={`min-h-[38px] rounded-xl px-1 text-[10px] sm:text-xs font-extrabold transition cursor-pointer ${
                    leaderboardModalTab === 'presence'
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  👥 المتواجدون ({unifiedPresenceList.length})
                </button>
              </div>

              {leaderboardModalTab === 'heroes' && canManageRoomActions && (
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaderboardModal(false);
                    setShowContestModal(true);
                  }}
                  className="min-h-[44px] shrink-0 rounded-xl border border-amber-300/50 bg-gradient-to-r from-amber-500/25 to-yellow-700/25 px-3 text-xs font-extrabold text-[#FCE9A6] cursor-pointer active:scale-95"
                >
                  <Trophy className="ml-1 inline h-4 w-4" />
                  إطلاق المسابقات والأسئلة التفاعلية
                </button>
              )}

              {leaderboardModalTab === 'presence' ? (
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
                  {unifiedPresenceList.length === 0 ? (
                    <div className="rounded-2xl bg-[#070913]/70 border border-white/10 py-10 text-center text-xs text-slate-400">
                      لا يوجد أعضاء ظاهرون في القائمة حالياً.
                    </div>
                  ) : (
                    unifiedPresenceList.map((member) => (
                      <div
                        key={member.userId}
                        className="w-full rounded-2xl border border-white/10 bg-[#070913]/80 p-3 flex items-center gap-3 text-right"
                      >
                        <AvatarWithFrame
                          src={member.avatarUrl}
                          alt={member.displayName}
                          frameId={member.frameId}
                          vipTier={member.vipLevel}
                          size="sm"
                        />
                        <VipUserName
                          name={member.displayName}
                          vipTier={member.vipLevel}
                          className="min-w-0 flex-1 truncate text-xs font-extrabold text-white"
                        />
                        <GenderBadge gender={member.gender} />
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="rounded-md border border-sky-400/40 bg-sky-500/15 px-1.5 py-[1px] text-[9px] font-black leading-tight text-sky-200">
                            Lv.{member.level}
                          </span>
                          <VipTierBadge vipTier={member.vipLevel} compact />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
                  {activeLeaderboard.length === 0 ? (
                    <div className="rounded-2xl bg-[#070913]/70 border border-white/10 py-10 text-center text-xs text-slate-400">
                      {leaderboardModalTab === 'supporters'
                        ? 'لم تُسجل هدايا داعمة في الغرفة حتى الآن.'
                        : 'لم تُسجل نقاط ألعاب أو مسابقات في الغرفة حتى الآن.'}
                    </div>
                  ) : (
                    activeLeaderboard.map((entry, idx) => {
                      const entryInfo = userProfileLookup.get(entry.userId);
                      const entryVip = entryInfo?.vipLevel || entry.vipLevel || 'none';
                      return (
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
                                vipLevel: entryVip,
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
                              vipTier={entryVip}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 flex-wrap">
                                <VipUserName
                                  name={entry.displayName}
                                  vipTier={entryVip}
                                  className="text-xs font-extrabold text-white truncate"
                                />
                                <VipTierBadge vipTier={entryVip} compact />
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono-num mt-0.5">
                                {leaderboardModalTab === 'supporters' ? (
                                  <span className="text-amber-300">
                                    🎁 دعم: {entry.supportCoins.toLocaleString('en-US')}
                                  </span>
                                ) : (
                                  <span className="text-emerald-300">
                                    🎮 لعب: {entry.playCoins.toLocaleString('en-US')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>

                          <div className="text-left shrink-0">
                            <span className="block text-xs font-mono-num font-black text-[#FCE9A6]">
                              {(leaderboardModalTab === 'supporters'
                                ? entry.supportCoins
                                : entry.playCoins
                              ).toLocaleString('en-US')}
                            </span>
                            <span className="block text-[9px] text-slate-400">
                              {leaderboardModalTab === 'supporters' ? 'كوينز' : 'نقطة'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AGENCY INFORMATION MODAL */}
      <AnimatePresence>
        {showAgencyInfo && room && (
          <div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
            onClick={() => setShowAgencyInfo(false)}
          >
            <motion.div
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 32, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              className="royal-glass w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="agency-info-title"
            >
              <div className="flex items-center justify-between">
                <h2 id="agency-info-title" className="text-lg font-extrabold gold-gradient-text">
                  معلومات الوكالة
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAgencyInfo(false)}
                  className="w-8 h-8 rounded-full bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"
                  aria-label="إغلاق معلومات الوكالة"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <img
                  src={resolveAsset(room.hostAvatar)}
                  alt={room.title}
                  className="w-16 h-16 rounded-2xl object-cover border border-[#F3D37A]/60"
                />
                <div className="min-w-0">
                  <h3 className="truncate text-base font-extrabold text-white">{room.title}</h3>
                  <button
                    type="button"
                    onClick={() => void handleCopyAgencyId()}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-mono-num font-bold text-amber-100 backdrop-blur-md cursor-pointer hover:bg-white/15"
                  >
                    <span>ID الوكالة: {AGENCY_ID}</span>
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-2 rounded-2xl border border-white/10 bg-black/25 p-3 text-sm">
                <div>
                  <p className="text-[10px] font-bold text-slate-400">الوصف</p>
                  <p className="whitespace-pre-line text-slate-100">
                    {room.description || 'لا يوجد وصف للوكالة.'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400">الوكيل</p>
                  <p className="font-bold text-[#FCE9A6]">{room.hostName || 'غير محدد'}</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AGENCY SETTINGS MODAL */}
      {showSettingsModal && canManage && (
        <RoomSettingsModal
          room={room}
          extras={roomSettingsExtras}
          presenceMembers={presenceMembers}
          isOwnerOrAdmin={isOwnerOrAdmin}
          isAgencyOwner={isAgencyOwner}
          canClearRoomChat={canClearRoomChat}
          initialTab={settingsInitialTab}
          ownedBackgrounds={ownedBackgrounds}
          onOpenStore={() => {
            window.dispatchEvent(new Event('sada:minimize'));
            navigate('/store');
          }}
          effectsMuted={effectsMuted}
          onToggleEffectsMuted={(nextMuted) => {
            setEffectsMuted(nextMuted);
            showToast(
              nextMuted
                ? '🔇 تم كتم صوت مؤثرات الهدايا والألعاب'
                : '🔊 تم تشغيل صوت مؤثرات الهدايا والألعاب'
            );
          }}
          onUpdateSettings={handleUpdateRoomSettings}
          onClearRoomChat={async () => {
            await clearRoomChat();
            showToast('تم مسح الدردشة بواسطة الإدارة');
          }}
          onAdminAction={runAdminAction}
          onStartAgencyContest={async (payload) => {
            await startContest(payload);
            setShowSettingsModal(false);
            setShowContestModal(true);
          }}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* LIVE IN-ROOM CONTEST MODAL */}
      {showContestModal && (
        <RoomContestModal
          contest={extras.activeContest || null}
          canManageContest={
            extras.activeContest?.agencyQuiz
              ? isAgencyOwner
              : canManageRoomActions
          }
          currentUserId={user?.id}
          onStartContest={startContest}
          onJoinContest={joinContest}
          onVoteContest={voteContest}
          onFinishContest={finishContest}
          onClearContest={clearContest}
          onSubmitQuizAnswer={submitContestQuizAnswer}
          onAdvanceQuizQuestion={advanceContestQuizQuestion}
          onClose={() => setShowContestModal(false)}
        />
      )}

      {/* ROOM MUSIC PLAYER MODAL (Device Audio File Only) */}
      {showMusicModal && (
        <RoomMusicModal
          isOnMic={Boolean(mySeat)}
          musicState={musicState}
          musicVolume={musicVolume}
          musicMutedLocally={musicMutedLocally}
          effectsMuted={effectsMuted}
          onVolumeChange={(v) => {
            setMusicVolume(v);
            if (v > 0 && musicMutedLocally) setMusicMutedLocally(false);
          }}
          onToggleLocalMute={() => setMusicMutedLocally(!musicMutedLocally)}
          onToggleEffectsMuted={() => {
            const nextMuted = !effectsMuted;
            setEffectsMuted(nextMuted);
            showToast(
              nextMuted
                ? '🔇 تم كتم صوت مؤثرات الهدايا والألعاب'
                : '🔊 تم تشغيل صوت مؤثرات الهدايا والألعاب'
            );
          }}
          onPlayUploaded={playUploadedMusic}
          onTogglePlayPause={toggleMusicPlayPause}
          onStopMusic={stopRoomMusic}
          onClimbMic={() => {
            const free = (Array.isArray(room?.seats) ? room.seats : []).find(
              (s) => !s?.userId && !s?.isLocked
            );
            if (free) void handleSeatInteraction(free);
          }}
          onClose={() => setShowMusicModal(false)}
        />
      )}

          {/* EXIT / KEEP MINIMIZED MODAL (Portaled at z-[999999] with pointer-events-auto) */}
          {exitModalOpen && (
            <RoomExitModal
              roomTitle={room?.title || 'الغرفة'}
              roomAvatar={room?.hostAvatar || ''}
              isOnMic={Boolean(mySeat)}
              onCancel={() => {
                setExitModalOpen(false);
                if (!window.history.state?.inRoom) {
                  window.history.pushState({ inRoom: true }, '');
                }
              }}
            />
          )}
        </>
      )}
    </div>
  );
};
