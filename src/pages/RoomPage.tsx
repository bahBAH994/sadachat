import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Coins,
  Gift,
  Headphones,
  Lock,
  MessageCircleHeart,
  Mic,
  MicOff,
  Radio,
  Send,
  Sparkles,
  Unlock,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveAsset } from '../lib/assets';
import {
  getRoomDetailsFromSupabase,
  joinRoomInSupabase,
  leaveRoomInSupabase,
  sendRoomChatInSupabase,
  sendRoomGiftInSupabase,
  updateRoomSeatInSupabase,
} from '../lib/sadaRoomsService';
import { supabase } from '../lib/supabase';
import type {
  GiftItem,
  LuckyWheelSegment,
  Room,
  RoomEntryEvent,
  RoomMessage,
} from '../types';
import { AvatarWithFrame } from '../components/AvatarWithFrame';
import { FemaleVerifiedBadge } from '../components/FemaleVoiceVerificationCard';
import { LuckyWheelModal } from '../components/LuckyWheelModal';

export const RoomPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, updateLocalUser } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [chatText, setChatText] = useState('');
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftTab, setGiftTab] = useState<'fixed' | 'lucky' | 'history'>('fixed');
  const [showWheelModal, setShowWheelModal] = useState(false);
  const [wheelSegments, setWheelSegments] = useState<LuckyWheelSegment[]>([]);
  const [wheelCost, setWheelCost] = useState<number>(200);
  const [wheelBanner, setWheelBanner] = useState<{
    winnerName: string;
    segment: LuckyWheelSegment;
  } | null>(null);
  const [selectedGiftTarget, setSelectedGiftTarget] = useState<string>('');
  const [sendingGift, setSendingGift] = useState(false);
  const [giftBanner, setGiftBanner] = useState<{
    senderName: string;
    recipientName: string;
    gift: GiftItem;
    luckyMultiplier?: number | null;
    luckyBonusCoins?: number;
  } | null>(null);
  const [entryBanner, setEntryBanner] = useState<RoomEntryEvent | null>(null);

  const [micActive, setMicActive] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [manualSpeakPulse, setManualSpeakPulse] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const mySeat = useMemo(
    () => room?.seats.find((s) => s.userId === user?.id) || null,
    [room, user]
  );

  const seatedSpeakers = useMemo(
    () => room?.seats.filter((s) => s.userId) || [],
    [room]
  );

  const fixedGifts = useMemo(
    () => gifts.filter((g) => g.category !== 'lucky'),
    [gifts]
  );

  const luckyGifts = useMemo(
    () => gifts.filter((g) => g.category === 'lucky'),
    [gifts]
  );

  const loadRoom = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getRoomDetailsFromSupabase(id);
      setRoom(data.room);
      setGifts(data.gifts);
      setWheelSegments(data.wheelSegments || []);
      setWheelCost(data.wheelCost || 200);
      setSelectedGiftTarget(data.room.hostId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحميل الغرفة.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (!id || !user) return;
    let mounted = true;

    joinRoomInSupabase(id, user)
      .then((res) => {
        if (!mounted) return;
        setRoom(res.room);
        if (res.entryEvent) {
          setEntryBanner(res.entryEvent);
          setTimeout(() => setEntryBanner(null), 5500);
          void channelRef.current?.send({
            type: 'broadcast',
            event: 'room:entry',
            payload: res.entryEvent,
          });
        }
      })
      .catch(() => {});

    const sbRoomChannel = supabase
      .channel(`sada-room-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sada_room_messages',
          filter: `room_id=eq.${id}`,
        },
        (payload) => {
          const r = payload.new as Record<string, unknown> | undefined;
          if (!r || !r.id) return;
          const mapped: RoomMessage = {
            id: String(r.id),
            userId: String(r.user_id || ''),
            displayName: String(r.display_name || ''),
            level: Number(r.level || 1),
            isAdmin: Boolean(r.is_admin),
            vipTier: (r.vip_tier as string | undefined) || undefined,
            hostBadge: (r.host_badge as string | null) || null,
            femaleVerifiedBadge: (r.female_verified_badge as string | null) || null,
            text: String(r.text || ''),
            type: (r.type as RoomMessage['type']) || 'chat',
            timestamp: String(r.timestamp || new Date().toISOString()),
          };
          setRoom((prev) => {
            if (!prev) return prev;
            if (prev.messages.some((m) => m.id === mapped.id)) return prev;
            return { ...prev, messages: [...prev.messages, mapped].slice(-80) };
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sada_rooms',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const r = payload.new as Record<string, unknown> | undefined;
          if (!r) return;
          if (r.is_active === false) {
            navigate('/', { replace: true });
            return;
          }
          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              seats: Array.isArray(r.seats) ? (r.seats as Room['seats']) : prev.seats,
              listenersCount:
                typeof r.listeners_count === 'number' ? r.listeners_count : prev.listenersCount,
              totalGiftsCoins:
                typeof r.total_gifts_coins === 'number'
                  ? r.total_gifts_coins
                  : prev.totalGiftsCoins,
              isActive: typeof r.is_active === 'boolean' ? r.is_active : prev.isActive,
            };
          });
        }
      )
      .on('broadcast', { event: 'room:gift' }, ({ payload }) => {
        const giftData = payload as {
          gift: GiftItem;
          luckyMultiplier?: number | null;
          luckyBonusCoins?: number;
          senderName: string;
          recipientName: string;
        };
        setGiftBanner(giftData);
        setTimeout(() => setGiftBanner(null), 4800);
      })
      .on('broadcast', { event: 'room:entry' }, ({ payload }) => {
        setEntryBanner(payload as RoomEntryEvent);
        setTimeout(() => setEntryBanner(null), 5500);
      })
      .on('broadcast', { event: 'room:wheel-win' }, ({ payload }) => {
        setWheelBanner(payload as { winnerName: string; segment: LuckyWheelSegment });
        setTimeout(() => setWheelBanner(null), 4500);
      })
      .on('broadcast', { event: 'audio:speaking' }, ({ payload }) => {
        const sp = payload as { userId: string; isSpeaking: boolean };
        setRoom((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            seats: prev.seats.map((s) =>
              s.userId === sp.userId ? { ...s, isSpeaking: sp.isSpeaking } : s
            ),
          };
        });
      })
      .subscribe();

    channelRef.current = sbRoomChannel;

    return () => {
      mounted = false;
      channelRef.current = null;
      void leaveRoomInSupabase(id, user.id);
      void supabase.removeChannel(sbRoomChannel);
    };
  }, [id, user?.id, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room?.messages.length]);

  // Real Web Audio API Mic Level Monitor when seated & unmuted
  useEffect(() => {
    const cleanupAudio = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      setMicActive(false);
    };

    if (!mySeat || mySeat.isMuted || !user || !id) {
      cleanupAudio();
      return;
    }

    let cancelled = false;
    let lastSpeaking = false;

    const startMic = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicDenied(true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        audioStreamRef.current = stream;
        setMicActive(true);
        setMicDenied(false);

        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const buffer = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (cancelled) return;
          analyser.getByteFrequencyData(buffer);
          const avg = buffer.reduce((a, b) => a + b, 0) / buffer.length;
          const speaking = avg > 16;
          if (speaking !== lastSpeaking) {
            lastSpeaking = speaking;
            void channelRef.current?.send({
              type: 'broadcast',
              event: 'audio:speaking',
              payload: { userId: user.id, isSpeaking: speaking },
            });
            setRoom((prev) =>
              prev
                ? {
                    ...prev,
                    seats: prev.seats.map((s) =>
                      s.userId === user.id ? { ...s, isSpeaking: speaking } : s
                    ),
                  }
                : prev
            );
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setMicDenied(true);
      }
    };

    startMic();

    return () => {
      cancelled = true;
      cleanupAudio();
    };
  }, [mySeat?.seatIndex, mySeat?.isMuted, id, user?.id]);

  const handleSeatClick = async (seatIndex: number) => {
    if (!room || !user) return;
    const seat = room.seats.find((s) => s.seatIndex === seatIndex);
    if (!seat) return;
    if (seat.isLocked) return;

    try {
      if (seat.userId === user.id) {
        const nextSeats = await updateRoomSeatInSupabase(room.id, user, { type: 'leave' });
        setRoom((prev) => (prev ? { ...prev, seats: nextSeats } : prev));
        return;
      }
      if (!seat.userId) {
        const nextSeats = await updateRoomSeatInSupabase(room.id, user, {
          type: 'take',
          seatIndex,
        });
        setRoom((prev) => (prev ? { ...prev, seats: nextSeats } : prev));
      } else {
        setSelectedGiftTarget(seat.userId);
        setShowGiftModal(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحديث المقعد.');
    }
  };

  const handleToggleLock = async (e: React.MouseEvent, seatIndex: number, isLocked: boolean) => {
    e.stopPropagation();
    if (!room || !user) return;
    try {
      const nextSeats = await updateRoomSeatInSupabase(room.id, user, {
        type: 'lock',
        seatIndex,
        isLocked: !isLocked,
      });
      setRoom((prev) => (prev ? { ...prev, seats: nextSeats } : prev));
    } catch {
      // ignore
    }
  };

  const handleToggleMute = async () => {
    if (!room || !user || !mySeat) return;
    try {
      const nextSeats = await updateRoomSeatInSupabase(room.id, user, {
        type: 'mute',
        isMuted: !mySeat.isMuted,
      });
      setRoom((prev) => (prev ? { ...prev, seats: nextSeats } : prev));
    } catch {
      // ignore
    }
  };

  const handleManualSpeakToggle = async () => {
    if (!room || !user || !mySeat || mySeat.isMuted) return;
    const next = !manualSpeakPulse;
    setManualSpeakPulse(next);
    void channelRef.current?.send({
      type: 'broadcast',
      event: 'audio:speaking',
      payload: { userId: user.id, isSpeaking: next },
    });
    try {
      const nextSeats = await updateRoomSeatInSupabase(room.id, user, {
        type: 'speaking',
        isSpeaking: next,
      });
      setRoom((prev) => (prev ? { ...prev, seats: nextSeats } : prev));
    } catch {
      // ignore
    }
  };

  const handleRequestMicAccess = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicDenied(true);
      setError('متصفحك الحالي لا يدعم الوصول إلى المايكروفون.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicDenied(false);
      setMicActive(true);
      setError(null);
    } catch {
      setMicDenied(true);
      setError('يرجى السماح بإذن المايكروفون من إعدادات المتصفح أو الهاتف.');
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || !user || !chatText.trim()) return;
    const msgText = chatText.trim();
    setChatText('');
    try {
      const sent = await sendRoomChatInSupabase(room.id, user, msgText);
      setRoom((prev) => {
        if (!prev) return prev;
        if (prev.messages.some((m) => m.id === sent.id)) return prev;
        return { ...prev, messages: [...prev.messages, sent].slice(-80) };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إرسال الرسالة.');
    }
  };

  const handleSendGift = async (giftId: string) => {
    if (!room || !user) return;
    setSendingGift(true);
    setError(null);
    try {
      const data = await sendRoomGiftInSupabase(
        room.id,
        user,
        giftId,
        selectedGiftTarget || room.hostId
      );
      updateLocalUser(data.user);
      setRoom(data.room);
      if (data.gift) {
        const target =
          data.room.seats.find((s) => s.userId === (selectedGiftTarget || room.hostId))
            ?.displayName || data.room.hostName;
        const banner = {
          gift: data.gift,
          luckyMultiplier: data.luckyMultiplier,
          luckyBonusCoins: data.luckyBonusCoins,
          senderName: data.user.displayName,
          recipientName: target,
        };
        setGiftBanner(banner);
        setTimeout(() => setGiftBanner(null), 4800);
        void channelRef.current?.send({
          type: 'broadcast',
          event: 'room:gift',
          payload: banner,
        });
      }
      setShowGiftModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إرسال الهدية.');
    } finally {
      setSendingGift(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-center text-slate-300">
        جارٍ دخول المجلس الصوتي...
      </div>
    );
  }

  if (!room) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center space-y-4">
        <p className="text-rose-300">{error || 'الغرفة غير متوفرة.'}</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="gold-btn rounded-xl px-5 py-2.5 text-sm cursor-pointer"
        >
          العودة إلى المجالس
        </button>
      </div>
    );
  }

  const canManageSeats = user?.id === room.hostId || user?.is_admin;

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] flex flex-col max-w-6xl mx-auto px-3 sm:px-6 pt-3 pb-4">
      <div
        className="fixed inset-0 bg-cover bg-center opacity-10 pointer-events-none"
        style={{ backgroundImage: `url(${resolveAsset(room.coverImage)})` }}
      />

      {/* Room Top Bar */}
      <div className="relative z-10 royal-glass rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-[#F3D37A] cursor-pointer shrink-0"
            aria-label="العودة"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-extrabold text-white truncate">
              {room.title}
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-[#F3D37A]">{room.category}</span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1 font-mono-num">
                <Headphones className="w-3 h-3" />
                {room.listenersCount}
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1 font-mono-num text-amber-300">
                <Coins className="w-3 h-3" />
                {room.totalGiftsCoins.toLocaleString('en-US')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {micActive && !mySeat?.isMuted && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-emerald-300">
              <Radio className="w-3.5 h-3.5" />
              <span>بث حي</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowWheelModal(true)}
            className="royal-capsule min-h-[40px] rounded-xl px-3 py-1.5 text-xs font-bold text-[#FCE9A6] hover:border-[#F3D37A]/80 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-[0_0_16px_rgba(212,175,55,0.28)]"
          >
            <Sparkles className="w-4 h-4 text-[#F3D37A]" />
            <span>دولاب الحظ</span>
          </button>
          <button
            type="button"
            onClick={() => setShowGiftModal(true)}
            className="gold-btn min-h-[40px] rounded-xl px-3.5 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Gift className="w-4 h-4" />
            <span>إرسال هدية</span>
          </button>
        </div>
      </div>

      {/* Royal Gift & Lucky Wheel Toast Banners */}
      <AnimatePresence>
        {giftBanner && (
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="relative z-30 mb-3 rounded-3xl border border-[#FCE9A6]/80 bg-gradient-to-r from-[#332206]/95 via-[#171B36]/95 to-[#332206]/95 px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_0_45px_rgba(243,211,122,0.55)] overflow-hidden"
          >
            <div className="flex items-center gap-3.5">
              <motion.span
                initial={{ scale: 0.5, rotate: -14 }}
                animate={{ scale: [1, 1.25, 1], rotate: [0, 8, -6, 0] }}
                transition={{ duration: 0.9 }}
                className="text-4xl drop-shadow-[0_0_16px_rgba(243,211,122,0.9)]"
              >
                {giftBanner.gift.glyph}
              </motion.span>
              <div>
                <p className="text-xs text-[#F3D37A] font-bold">
                  {giftBanner.luckyMultiplier
                    ? `احتفالية هدية الحظ المضاعفة (×${giftBanner.luckyMultiplier}) 🎰`
                    : 'احتفالية إهداء ملكية ✨'}
                </p>
                <p className="text-sm sm:text-base font-extrabold text-white">
                  أهدى <span className="text-[#FCE9A6]">{giftBanner.senderName}</span>{' '}
                  {giftBanner.gift.name} إلى{' '}
                  <span className="text-[#FCE9A6]">{giftBanner.recipientName}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {giftBanner.luckyBonusCoins ? (
                <span className="rounded-full border border-emerald-400/60 bg-emerald-500/20 px-3.5 py-1 text-xs font-mono-num font-extrabold text-emerald-200">
                  مضاعف ×{giftBanner.luckyMultiplier} · +
                  {giftBanner.luckyBonusCoins.toLocaleString('en-US')} كوينز للمرسل!
                </span>
              ) : null}
              <span className="royal-capsule rounded-full px-3.5 py-1 text-xs font-mono-num font-extrabold text-[#FCE9A6]">
                +{giftBanner.gift.coinsCost.toLocaleString('en-US')} كوينز
              </span>
            </div>
          </motion.div>
        )}
        {wheelBanner && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            className="relative z-20 mb-3 rounded-2xl border border-[#FCE9A6]/75 bg-gradient-to-r from-[#382708]/95 via-[#1C1633]/95 to-[#382708]/95 px-4 py-3 flex items-center justify-center gap-3 shadow-[0_0_34px_rgba(243,211,122,0.55)]"
          >
            <span className="text-2xl">{wheelBanner.segment.glyph}</span>
            <p className="text-xs sm:text-sm font-extrabold text-[#FCE9A6]">
              مبارك! فاز <span className="text-white">{wheelBanner.winnerName}</span>{' '}
              في دولاب الحظ بـ {wheelBanner.segment.label}
            </p>
          </motion.div>
        )}
        {entryBanner && (
          <motion.div
            initial={{ opacity: 0, x: 60, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -60, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            className={`relative z-30 mb-3 rounded-3xl px-5 py-4 flex items-center justify-between gap-4 overflow-hidden border ${
              entryBanner.entryId === 'entry_legendary_30d'
                ? 'border-amber-300 bg-gradient-to-r from-[#452406]/95 via-[#1F1238]/95 to-[#452406]/95 shadow-[0_0_48px_rgba(251,191,36,0.65)]'
                : 'border-[#F3D37A]/80 bg-gradient-to-r from-[#2D2108]/95 via-[#121933]/95 to-[#2D2108]/95 shadow-[0_0_36px_rgba(243,211,122,0.48)]'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <motion.div
                initial={{ x: 24, scale: 0.8 }}
                animate={{ x: [24, 0, 4, 0], scale: 1 }}
                transition={{ duration: 0.85 }}
                className="text-3xl sm:text-4xl shrink-0"
              >
                {entryBanner.entryId === 'entry_legendary_30d' ? '🐉' : '🚘'}
              </motion.div>
              <AvatarWithFrame
                src={entryBanner.avatarUrl}
                alt={entryBanner.displayName}
                frameId={entryBanner.frameId}
                size="md"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold text-[#FCE9A6]">
                  {entryBanner.entryId === 'entry_legendary_30d'
                    ? 'الدخولية الأسطورية الملكية ✦'
                    : 'دخولية السيارة الذهبية ✦'}
                </p>
                <p className="text-sm sm:text-base font-extrabold text-white truncate">
                  شرّف <span className="text-[#FCE9A6]">{entryBanner.displayName}</span>{' '}
                  المجلس بحضوره!
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex rounded-xl border border-[#FCE9A6]/50 bg-[#070913]/70 px-3 py-1.5 text-xs font-mono-num font-bold text-[#FCE9A6] shrink-0">
              Lv.{entryBanner.level}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="relative z-10 mb-3 rounded-xl border border-rose-500/40 bg-rose-950/60 px-4 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* Main Content Split: Speaker Stage + Live Chat */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        {/* Speaker Stage */}
        <section className="lg:col-span-7 royal-glass rounded-3xl p-4 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[#F3D37A]">
                منصة المتحدثين ({seatedSpeakers.length}/{room.maxSeats})
              </h2>
              <span className="text-xs text-slate-400">
                اضغط على مقعد فارغ للصعود إلى المايك
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {room.seats.map((seat) => {
                const isMe = seat.userId === user?.id;
                const isActiveSpeaker = Boolean(seat.userId && seat.isSpeaking && !seat.isMuted);
                return (
                  <div
                    key={seat.seatIndex}
                    onClick={() => handleSeatClick(seat.seatIndex)}
                    className={`relative rounded-2xl p-3 flex flex-col items-center justify-center text-center min-h-[130px] transition cursor-pointer border ${
                      isActiveSpeaker
                        ? 'bg-[#D4AF37]/18 border-[#FCE9A6]/80 shadow-[0_0_26px_rgba(243,211,122,0.4)]'
                        : seat.userId
                        ? isMe
                          ? 'bg-[#D4AF37]/12 border-[#D4AF37]/50'
                          : 'bg-[#070913]/65 border-[#D4AF37]/20 hover:border-[#D4AF37]/45'
                        : seat.isLocked
                        ? 'bg-[#070913]/40 border-slate-800/80 opacity-60 cursor-not-allowed'
                        : 'bg-[#070913]/45 border-dashed border-[#D4AF37]/25 hover:border-[#D4AF37]/60 hover:bg-[#D4AF37]/5'
                    }`}
                  >
                    {canManageSeats && !seat.userId && (
                      <button
                        type="button"
                        onClick={(e) => handleToggleLock(e, seat.seatIndex, seat.isLocked)}
                        className="absolute top-2 left-2 p-1 rounded-lg bg-black/40 text-slate-400 hover:text-[#F3D37A] cursor-pointer"
                        title={seat.isLocked ? 'فتح المقعد' : 'قفل المقعد'}
                      >
                        {seat.isLocked ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    {seat.userId ? (
                      <>
                        <div className="relative mb-2">
                          <AvatarWithFrame
                            src={seat.avatarUrl}
                            alt={seat.displayName || 'متحدث'}
                            frameId={seat.frameId}
                            size="md"
                            isSpeaking={isActiveSpeaker}
                          />
                          <span
                            className={`absolute -bottom-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center border border-[#070913] ${
                              seat.isMuted ? 'bg-rose-600 text-white' : 'bg-[#D4AF37] text-[#070913]'
                            }`}
                          >
                            {seat.isMuted ? (
                              <MicOff className="w-3 h-3" />
                            ) : (
                              <Mic className="w-3 h-3" />
                            )}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-white truncate max-w-full">
                          {seat.displayName}
                        </span>
                        {seat.femaleVerifiedBadge && (
                          <FemaleVerifiedBadge
                            badge={seat.femaleVerifiedBadge}
                            className="mt-0.5 scale-90"
                          />
                        )}
                        <span className="text-[11px] text-sky-300 font-mono-num mt-0.5">
                          💎 {seat.receivedDiamonds}
                        </span>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-slate-400">
                        <div className="w-11 h-11 rounded-full border border-[#D4AF37]/30 flex items-center justify-center bg-[#0D1122]/80">
                          {seat.isLocked ? (
                            <Lock className="w-4 h-4 text-slate-500" />
                          ) : (
                            <Mic className="w-4 h-4 text-[#D4AF37]" />
                          )}
                        </div>
                        <span className="text-[11px] font-semibold">
                          {seat.isLocked ? 'مقعد مقفل' : `مايك ${seat.seatIndex + 1}`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seat Audio Controls */}
          <div className="mt-5 pt-4 border-t border-[#D4AF37]/15 flex flex-wrap items-center justify-between gap-2">
            {mySeat ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className={`min-h-[42px] rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
                      mySeat.isMuted
                        ? 'bg-rose-600/25 border border-rose-500/40 text-rose-200'
                        : 'gold-btn'
                    }`}
                  >
                    {mySeat.isMuted ? (
                      <>
                        <MicOff className="w-4 h-4" />
                        <span>إلغاء الكتم</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        <span>كتم المايك</span>
                      </>
                    )}
                  </button>

                  {micDenied && !mySeat.isMuted && (
                    <>
                      <button
                        type="button"
                        onClick={handleRequestMicAccess}
                        className="min-h-[42px] rounded-xl px-3.5 py-2 text-xs font-bold border border-[#D4AF37]/45 bg-[#D4AF37]/15 text-[#FCE9A6] cursor-pointer transition"
                      >
                        تفعيل إذن المايكروفون
                      </button>
                      <button
                        type="button"
                        onClick={handleManualSpeakToggle}
                        className={`min-h-[42px] rounded-xl px-3.5 py-2 text-xs font-bold border cursor-pointer transition ${
                          manualSpeakPulse
                            ? 'bg-[#D4AF37]/25 border-[#D4AF37] text-[#FCE9A6]'
                            : 'bg-white/5 border-white/15 text-slate-300'
                        }`}
                      >
                        {manualSpeakPulse ? 'إيقاف نبض الصوت' : 'تفعيل نبض المتحدث'}
                      </button>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (mySeat) void handleSeatClick(mySeat.seatIndex);
                  }}
                  className="min-h-[42px] rounded-xl px-4 py-2 text-xs font-bold bg-white/5 hover:bg-rose-950/50 border border-white/10 hover:border-rose-500/40 text-slate-200 cursor-pointer"
                >
                  نزول من المايك
                </button>
              </>
            ) : (
              <div className="w-full flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleRequestMicAccess}
                  className="min-h-[40px] rounded-xl px-3.5 py-2 text-xs font-bold bg-white/5 hover:bg-white/10 border border-[#D4AF37]/30 text-[#FCE9A6] cursor-pointer flex items-center gap-1.5"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{micActive ? 'المايكروفون جاهز ✓' : 'تفعيل إذن المايكروفون'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const free = room.seats.find((s) => !s.userId && !s.isLocked);
                    if (free) handleSeatClick(free.seatIndex);
                  }}
                  className="gold-btn min-h-[42px] rounded-xl px-4 py-2 text-xs font-bold cursor-pointer"
                >
                  صعود لأول مايك متاح
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Live Text Chat */}
        <section className="lg:col-span-5 royal-glass rounded-3xl p-4 sm:p-5 flex flex-col h-[420px] lg:h-[540px]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#F3D37A]">
              دردشة المجلس المباشرة
            </h2>
            <button
              type="button"
              onClick={() => setShowWheelModal(true)}
              className="text-xs font-bold text-[#FCE9A6] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>جرّب دولاب الحظ</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2.5 pl-1">
            {room.messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm ${
                  m.type === 'entry'
                    ? 'bg-gradient-to-r from-amber-500/25 via-[#D4AF37]/20 to-transparent border border-amber-300/60 text-[#FCE9A6] font-extrabold shadow-[0_0_20px_rgba(251,191,36,0.28)]'
                    : m.type === 'wheel'
                    ? 'bg-gradient-to-r from-[#F3D37A]/25 via-[#D4AF37]/15 to-transparent border border-[#F3D37A]/55 text-[#FCE9A6] font-bold shadow-[0_0_16px_rgba(212,175,55,0.2)]'
                    : m.type === 'gift'
                    ? 'bg-gradient-to-r from-[#D4AF37]/20 to-transparent border border-[#D4AF37]/35 text-[#FCE9A6]'
                    : m.type === 'system'
                    ? 'bg-white/5 text-slate-300'
                    : 'bg-[#070913]/65 border border-white/5 text-slate-200'
                }`}
              >
                {m.type === 'chat' && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-1 text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap border ${
                        m.isAdmin
                          ? 'bg-gradient-to-r from-[#D4AF37]/35 to-amber-500/20 border-[#FCE9A6]/70 text-[#FCE9A6]'
                          : m.level >= 15
                          ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                          : m.level >= 8
                          ? 'bg-[#D4AF37]/20 border-[#D4AF37]/50 text-[#F7E097]'
                          : 'bg-white/10 border-white/20 text-slate-200'
                      }`}
                    >
                      {m.vipTier ||
                        (m.isAdmin
                          ? 'VIP الإدارة العليا'
                          : m.level >= 15
                          ? 'VIP ماسي'
                          : m.level >= 8
                          ? 'VIP ذهبي'
                          : 'VIP برونزي')}
                    </span>
                    {m.hostBadge && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-[#D4AF37]/18 border border-[#FCE9A6]/50 text-[#FCE9A6]">
                        {m.hostBadge}
                      </span>
                    )}
                    <FemaleVerifiedBadge badge={m.femaleVerifiedBadge} />
                    <span className="font-bold text-[#F3D37A]">{m.displayName}</span>
                    <span className="text-slate-500 font-mono-num">Lv.{m.level}</span>
                  </div>
                )}
                <p className="leading-relaxed">{m.text}</p>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendChat} className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="اكتب رسالة راقية للمجلس..."
              className="flex-1 rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#D4AF37]"
            />
            <button
              type="submit"
              className="gold-btn min-h-[42px] min-w-[42px] rounded-xl flex items-center justify-center cursor-pointer shrink-0"
              aria-label="إرسال"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      </div>

      {/* Royal Gift Store Modal */}
      {showGiftModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
          onClick={() => setShowGiftModal(false)}
        >
          <div
            className="royal-glass w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold gold-gradient-text">
                  متجر الهدايا الملكية
                </h3>
                <p className="text-xs text-slate-400 font-mono-num">
                  رصيدك الحالي: {(user?.coins ?? 0).toLocaleString('en-US')} كوينز
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGiftModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-slate-400 hover:text-white cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Gift Store Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/20">
              <button
                type="button"
                onClick={() => setGiftTab('fixed')}
                className={`flex-1 min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  giftTab === 'fixed'
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                هدايا ثابتة ({fixedGifts.length})
              </button>
              <button
                type="button"
                onClick={() => setGiftTab('lucky')}
                className={`flex-1 min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  giftTab === 'lucky'
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                هدايا الحظ ({luckyGifts.length})
              </button>
              <button
                type="button"
                onClick={() => setGiftTab('history')}
                className={`flex-1 min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  giftTab === 'history'
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                سجل الهدايا
              </button>
            </div>

            {giftTab !== 'history' ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      إهداء إلى:
                    </label>
                    <select
                      value={selectedGiftTarget}
                      onChange={(e) => setSelectedGiftTarget(e.target.value)}
                      className="w-full rounded-xl bg-[#070913]/90 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value={room.hostId}>مضيف المجلس: {room.hostName}</option>
                      {seatedSpeakers
                        .filter((s) => s.userId && s.userId !== room.hostId)
                        .map((s) => (
                          <option key={s.userId} value={s.userId || ''}>
                            المتحدث: {s.displayName}
                          </option>
                        ))}
                    </select>
                  </div>
                  {(selectedGiftTarget || room.hostId) !== user?.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGiftModal(false);
                        navigate(`/messages?to=${selectedGiftTarget || room.hostId}`);
                      }}
                      className="min-h-[42px] rounded-xl px-3.5 py-2 text-xs font-bold border border-[#D4AF37]/40 bg-[#D4AF37]/12 text-[#FCE9A6] hover:bg-[#D4AF37]/25 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <MessageCircleHeart className="w-4 h-4" />
                      <span>رسالة خاصة 💎</span>
                    </button>
                  )}
                </div>

                {giftTab === 'lucky' && (
                  <div className="rounded-2xl border border-[#F3D37A]/35 bg-gradient-to-r from-[#2B1F09]/70 via-[#12172E]/85 to-[#2B1F09]/70 px-3.5 py-2.5 text-xs text-[#FCE9A6] flex items-center justify-between gap-2">
                    <span>
                      🎰 تمنحك هدايا الحظ مضاعفات عشوائية فورية في رصيدك من ×1 حتى ×10!
                    </span>
                    <span className="font-mono-num font-extrabold text-emerald-300 shrink-0">
                      حتى ×10
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[44vh] overflow-y-auto no-scrollbar pr-0.5">
                  {(giftTab === 'lucky' ? luckyGifts : fixedGifts).map((gift) => {
                    const affordable = (user?.coins ?? 0) >= gift.coinsCost;
                    return (
                      <button
                        key={gift.id}
                        type="button"
                        disabled={sendingGift}
                        onClick={() => handleSendGift(gift.id)}
                        className={`royal-glass royal-glass-hover rounded-2xl p-3 flex flex-col items-center text-center gap-1.5 cursor-pointer transition disabled:opacity-50 ${
                          gift.tier === 'imperial'
                            ? 'border-[#FCE9A6]/45 bg-gradient-to-b from-[#2A1E08]/40 to-[#070913]/85'
                            : gift.tier === 'royal'
                            ? 'border-[#D4AF37]/35'
                            : ''
                        } ${!affordable ? 'opacity-70' : ''}`}
                      >
                        <span className="text-3xl">{gift.glyph}</span>
                        <span className="text-xs font-bold text-white leading-snug line-clamp-1">
                          {gift.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {giftTab === 'lucky'
                            ? 'مضاعف عشوائي ×1–×10'
                            : gift.tier === 'imperial'
                            ? 'إمبراطوري'
                            : gift.tier === 'royal'
                            ? 'ملكي'
                            : 'كلاسيكي'}
                        </span>
                        <span className="text-xs font-mono-num text-[#FCE9A6] font-extrabold">
                          {gift.coinsCost.toLocaleString('en-US')} كوينز
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="max-h-[48vh] overflow-y-auto no-scrollbar space-y-2.5">
                {room.messages.filter((m) => m.type === 'gift').length === 0 ? (
                  <p className="text-xs sm:text-sm text-slate-400 text-center py-8">
                    لم تُرسل هدايا في هذه الجلسة بعد — افتتح الاحتفال بهدية من متجر المجلس!
                  </p>
                ) : (
                  room.messages
                    .filter((m) => m.type === 'gift')
                    .slice()
                    .reverse()
                    .map((gm) => (
                      <div
                        key={gm.id}
                        className="rounded-2xl border border-[#D4AF37]/30 bg-[#070913]/75 px-4 py-3 text-xs sm:text-sm text-[#FCE9A6]"
                      >
                        {gm.text}
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showWheelModal && (
        <LuckyWheelModal
          roomId={room.id}
          userCoins={user?.coins ?? 0}
          wheelCost={wheelCost}
          segments={wheelSegments}
          onClose={() => setShowWheelModal(false)}
          onSpinComplete={(nextUser, nextRoom) => {
            updateLocalUser(nextUser);
            setRoom(nextRoom);
          }}
        />
      )}
    </div>
  );
};
