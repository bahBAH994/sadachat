import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { setAudioMuted } from '../lib/sadaAudio';
import {
  adminControlRoomInSupabase,
  canManageRoom,
  clearRoomContestInSupabase,
  createEmptyRoomExtras,
  finishRoomContestInSupabase,
  getRoomDetailsFromSupabase,
  getRoomExtrasFromSupabase,
  incrementRoomPlayVolumeInSupabase,
  joinRoomContestInSupabase,
  joinRoomInSupabase,
  leaveRoomInSupabase,
  sendRoomChatInSupabase,
  sendRoomGiftBatchInSupabase,
  sendRoomGiftInSupabase,
  startRoomContestInSupabase,
  updateRoomMusicInSupabase,
  updateRoomSeatInSupabase,
  updateRoomSettingsInSupabase,
  voteRoomContestInSupabase,
} from '../lib/sadaRoomsService';
import { supabase } from '../lib/supabase';
import type {
  GiftItem,
  LuckyWheelSegment,
  Room,
  RoomEntryEvent,
  RoomExtrasConfig,
  RoomGifterEntry,
  RoomLiveContest,
  RoomMessage,
  RoomMusicState,
  RoomSeat,
} from '../types';

export interface RoomPresenceMember {
  roomId: string;
  userId: string;
  displayName: string;
  avatarUrl: string;
  frameId?: string;
  level?: number;
}

export interface RoomFlyingGiftEvent {
  id: string;
  gift: GiftItem;
  quantity: number;
  comboCount: number;
  senderId: string;
  senderName: string;
  recipientIds: string[];
  recipientNames: string[];
  luckyMultiplier?: number | null;
  luckyBonusCoins?: number;
  isFullscreen: boolean;
}

export interface RoomSeatEmojiEvent {
  id: string;
  userId: string;
  displayName: string;
  emoji: string;
  label: string;
  diceValue?: number;
  expiresAt: number;
}

export interface RoomPlaySupportEntry {
  userId: string;
  displayName: string;
  avatarUrl: string;
  frameId?: string;
  supportCoins: number;
  playCoins: number;
  totalCoins: number;
}

interface ActiveRoomContextValue {
  activeRoomId: string | null;
  room: Room | null;
  extras: RoomExtrasConfig;
  gifts: GiftItem[];
  wheelSegments: LuckyWheelSegment[];
  wheelCost: number;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  isMinimized: boolean;
  mySeat: RoomSeat | null;
  canManage: boolean;
  isOwnerOrAdmin: boolean;
  micActive: boolean;
  micDenied: boolean;
  manualSpeakPulse: boolean;
  presenceMembers: RoomPresenceMember[];
  liveListenersCount: number;
  topGifters: RoomGifterEntry[];
  supportAndPlayLeaderboard: RoomPlaySupportEntry[];
  totalVolumeCoins: number;
  giftBanner: {
    senderName: string;
    recipientName: string;
    gift: GiftItem;
    luckyMultiplier?: number | null;
    luckyBonusCoins?: number;
  } | null;
  wheelBanner: {
    winnerName: string;
    segment: LuckyWheelSegment;
  } | null;
  entryBanner: RoomEntryEvent | null;
  flyingGifts: RoomFlyingGiftEvent[];
  fullscreenGift: RoomFlyingGiftEvent | null;
  seatEmojis: Record<string, RoomSeatEmojiEvent>;
  musicState: RoomMusicState | null;
  musicVolume: number;
  musicMutedLocally: boolean;
  roomAudioMuted: boolean;
  setMusicVolume: (vol: number) => void;
  setMusicMutedLocally: (muted: boolean) => void;
  setRoomAudioMuted: (muted: boolean) => void;
  enterRoom: (roomId: string) => Promise<void>;
  minimizeRoom: () => void;
  restoreRoom: () => void;
  leaveActiveRoom: () => Promise<void>;
  handleSeatClick: (seatIndex: number) => Promise<'opened_profile' | 'updated' | 'locked' | 'noop'>;
  handleToggleLock: (seatIndex: number, isLocked: boolean) => Promise<void>;
  handleToggleMute: () => Promise<void>;
  handleManualSpeakToggle: () => Promise<void>;
  handleRequestMicAccess: () => Promise<void>;
  sendChat: (text: string) => Promise<void>;
  sendGift: (giftId: string, targetUserId?: string) => Promise<void>;
  sendGiftBatch: (
    giftId: string,
    targetUserIds: string[],
    quantity: number,
    comboCount?: number
  ) => Promise<void>;
  sendSeatEmoji: (payload: {
    emoji: string;
    label: string;
    isDice?: boolean;
  }) => void;
  updateRoomFromWheel: (nextRoom: Room, coinsCost: number) => Promise<void>;
  updateSettings: (patch: {
    maxSeats?: number;
    hostAvatar?: string;
    coverImage?: string;
    description?: string;
    title?: string;
  }) => Promise<void>;
  runAdminAction: (
    action:
      | { type: 'mute_all' }
      | { type: 'clear_all' }
      | { type: 'mute_user'; targetUserId: string; isMuted: boolean }
      | { type: 'kick_seat'; targetUserId: string }
      | { type: 'kick_room'; targetUserId: string; targetName?: string }
      | { type: 'unban_room'; targetUserId: string }
      | { type: 'toggle_deputy'; targetUserId: string; targetName?: string }
      | { type: 'toggle_moderator'; targetUserId: string; targetName?: string }
  ) => Promise<void>;
  playUploadedMusic: (trackName: string, dataUrl: string) => Promise<void>;
  toggleMusicPlayPause: () => Promise<void>;
  stopRoomMusic: () => Promise<void>;
  addPlayVolume: (coinsAmount: number) => Promise<void>;
  startContest: (payload: {
    title: string;
    mode: RoomLiveContest['mode'];
    prizeLabel: string;
  }) => Promise<void>;
  joinContest: (note?: string) => Promise<void>;
  voteContest: (contestantUserId: string) => Promise<void>;
  finishContest: (winnerUserId?: string) => Promise<void>;
  clearContest: () => Promise<void>;
  giftTargetRequest: { userId: string; nonce: number } | null;
  requestGiftForUser: (userId: string) => void;
  clearGiftTargetRequest: () => void;
}

const ActiveRoomContext = createContext<ActiveRoomContextValue | undefined>(undefined);

export const ActiveRoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, updateLocalUser } = useAuth();

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [extras, setExtras] = useState<RoomExtrasConfig>(createEmptyRoomExtras());
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [wheelSegments, setWheelSegments] = useState<LuckyWheelSegment[]>([]);
  const [wheelCost, setWheelCost] = useState<number>(200);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const [presenceMembers, setPresenceMembers] = useState<RoomPresenceMember[]>([]);
  const [micActive, setMicActive] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [manualSpeakPulse, setManualSpeakPulse] = useState(false);

  const [giftBanner, setGiftBanner] = useState<ActiveRoomContextValue['giftBanner']>(null);
  const [wheelBanner, setWheelBanner] = useState<ActiveRoomContextValue['wheelBanner']>(null);
  const [entryBanner, setEntryBanner] = useState<RoomEntryEvent | null>(null);
  const [flyingGifts, setFlyingGifts] = useState<RoomFlyingGiftEvent[]>([]);
  const [fullscreenGift, setFullscreenGift] = useState<RoomFlyingGiftEvent | null>(null);
  const [seatEmojis, setSeatEmojis] = useState<Record<string, RoomSeatEmojiEvent>>({});

  const [musicVolume, setMusicVolume] = useState<number>(0.45);
  const [musicMutedLocally, setMusicMutedLocally] = useState<boolean>(false);
  const [roomAudioMuted, setRoomAudioMutedState] = useState<boolean>(false);
  const [giftTargetRequest, setGiftTargetRequest] = useState<{
    userId: string;
    nonce: number;
  } | null>(null);

  const requestGiftForUser = useCallback((userId: string) => {
    setGiftTargetRequest({ userId, nonce: Date.now() });
  }, []);

  const clearGiftTargetRequest = useCallback(() => {
    setGiftTargetRequest(null);
  }, []);

  const setRoomAudioMuted = useCallback((muted: boolean) => {
    setRoomAudioMutedState(muted);
    setAudioMuted(muted);
  }, []);

  const roomChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);

  // Mic monitoring refs
  const audioStreamRef = useRef<MediaStream | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  // Room Music Playback ref (HTMLAudioElement for device-uploaded tracks only)
  const musicAudioElRef = useRef<HTMLAudioElement | null>(null);

  const stopMusicEngines = useCallback(() => {
    if (musicAudioElRef.current) {
      try {
        musicAudioElRef.current.pause();
        musicAudioElRef.current.src = '';
      } catch {
        // ignore
      }
    }
  }, []);

  const cleanupMicMonitor = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current = null;
    micAudioCtxRef.current?.close().catch(() => {});
    micAudioCtxRef.current = null;
    setMicActive(false);
  }, []);

  const teardownActiveChannels = useCallback(async () => {
    cleanupMicMonitor();
    stopMusicEngines();
    const prevId = activeRoomIdRef.current;
    activeRoomIdRef.current = null;
    const presenceChannel = presenceChannelRef.current;
    const roomChannel = roomChannelRef.current;
    presenceChannelRef.current = null;
    roomChannelRef.current = null;

    const tasks: Promise<unknown>[] = [];
    if (prevId && user?.id) {
      tasks.push(leaveRoomInSupabase(prevId, user.id).catch(() => {}));
    }
    if (presenceChannel) {
      tasks.push(
        presenceChannel
          .untrack()
          .catch(() => {})
          .finally(() => supabase.removeChannel(presenceChannel).catch(() => {}))
      );
    }
    if (roomChannel) {
      tasks.push(supabase.removeChannel(roomChannel).catch(() => {}));
    }
    await Promise.allSettled(tasks);
  }, [cleanupMicMonitor, stopMusicEngines, user?.id]);

  const leaveActiveRoom = useCallback(async () => {
    cleanupMicMonitor();
    stopMusicEngines();
    setActiveRoomId(null);
    setRoom(null);
    setExtras(createEmptyRoomExtras());
    setIsMinimized(false);
    setPresenceMembers([]);
    setGiftBanner(null);
    setWheelBanner(null);
    setEntryBanner(null);
    setError(null);
    setRoomAudioMuted(false);
    await teardownActiveChannels();
  }, [cleanupMicMonitor, setRoomAudioMuted, stopMusicEngines, teardownActiveChannels]);

  const enterRoom = useCallback(
    async (roomId: string) => {
      if (!user) return;
      if (activeRoomIdRef.current === roomId && room) {
        setIsMinimized(false);
        return;
      }

      if (activeRoomIdRef.current && activeRoomIdRef.current !== roomId) {
        await teardownActiveChannels();
      }

      setLoading(true);
      setError(null);
      setIsMinimized(false);
      setActiveRoomId(roomId);
      activeRoomIdRef.current = roomId;

      try {
        const details = await getRoomDetailsFromSupabase(roomId);
        if (activeRoomIdRef.current !== roomId) return;
        setRoom(details.room);
        setExtras(details.extras);
        setGifts(details.gifts);
        setWheelSegments(details.wheelSegments || []);
        setWheelCost(details.wheelCost || 200);

        // Subscribe to room DB & broadcasts
        const sbRoomChannel = supabase
          .channel(`sada-room-${roomId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'sada_room_messages',
              filter: `room_id=eq.${roomId}`,
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
              filter: `id=eq.${roomId}`,
            },
            (payload) => {
              const r = payload.new as Record<string, unknown> | undefined;
              if (!r) return;
              if (r.is_active === false) {
                void leaveActiveRoom();
                setError('تم إغلاق الوكالة الصوتية من قبل الإدارة.');
                return;
              }
              setRoom((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  title: typeof r.title === 'string' ? r.title : prev.title,
                  description: typeof r.description === 'string' ? r.description : prev.description,
                  hostAvatar: typeof r.host_avatar === 'string' ? r.host_avatar : prev.hostAvatar,
                  coverImage: typeof r.cover_image === 'string' ? r.cover_image : prev.coverImage,
                  maxSeats: typeof r.max_seats === 'number' ? r.max_seats : prev.maxSeats,
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
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'sada_platform_state',
              filter: `id=eq.global`,
            },
            (payload) => {
              const r = payload.new as Record<string, unknown> | undefined;
              const rawSettings = r?.settings as
                | { roomConfigs?: Record<string, RoomExtrasConfig> }
                | undefined;
              const nextRoomCfg = rawSettings?.roomConfigs?.[roomId];
              if (nextRoomCfg) {
                setExtras({
                  ...createEmptyRoomExtras(),
                  ...nextRoomCfg,
                  deputyIds: Array.isArray(nextRoomCfg.deputyIds) ? nextRoomCfg.deputyIds : [],
                  moderatorIds: Array.isArray(nextRoomCfg.moderatorIds)
                    ? nextRoomCfg.moderatorIds
                    : [],
                  kickedUserIds: Array.isArray(nextRoomCfg.kickedUserIds)
                    ? nextRoomCfg.kickedUserIds
                    : [],
                  kickedUserNames:
                    nextRoomCfg.kickedUserNames &&
                    typeof nextRoomCfg.kickedUserNames === 'object'
                      ? nextRoomCfg.kickedUserNames
                      : {},
                  mutedUserIds: Array.isArray(nextRoomCfg.mutedUserIds)
                    ? nextRoomCfg.mutedUserIds
                    : [],
                  gifters: nextRoomCfg.gifters || {},
                  players:
                    nextRoomCfg.players && typeof nextRoomCfg.players === 'object'
                      ? nextRoomCfg.players
                      : {},
                  modLogs: Array.isArray(nextRoomCfg.modLogs) ? nextRoomCfg.modLogs : [],
                  playVolumeCoins: Number(nextRoomCfg.playVolumeCoins || 0),
                  musicState: nextRoomCfg.musicState || null,
                  activeContest: nextRoomCfg.activeContest || null,
                });
              }
            }
          )
          .on('broadcast', { event: 'room:gift' }, ({ payload }) => {
            const giftData = payload as NonNullable<ActiveRoomContextValue['giftBanner']>;
            setGiftBanner(giftData);
            setTimeout(() => setGiftBanner(null), 4800);
          })
          .on('broadcast', { event: 'room:gift-fly' }, ({ payload }) => {
            const flyData = payload as RoomFlyingGiftEvent;
            setFlyingGifts((prev) => [...prev, flyData]);
            setTimeout(() => {
              setFlyingGifts((prev) => prev.filter((item) => item.id !== flyData.id));
            }, 1700);
            if (flyData.isFullscreen) {
              setFullscreenGift(flyData);
              setTimeout(() => {
                setFullscreenGift((curr) => (curr?.id === flyData.id ? null : curr));
              }, 5000);
            }
          })
          .on('broadcast', { event: 'seat:emoji' }, ({ payload }) => {
            const em = payload as RoomSeatEmojiEvent;
            setSeatEmojis((prev) => ({ ...prev, [em.userId]: em }));
            setTimeout(() => {
              setSeatEmojis((prev) => {
                if (prev[em.userId]?.id !== em.id) return prev;
                const copy = { ...prev };
                delete copy[em.userId];
                return copy;
              });
            }, 4000);
          })
          .on('broadcast', { event: 'room:entry' }, ({ payload }) => {
            setEntryBanner(payload as RoomEntryEvent);
            setTimeout(() => setEntryBanner(null), 5500);
          })
          .on('broadcast', { event: 'room:wheel-win' }, ({ payload }) => {
            setWheelBanner(payload as NonNullable<ActiveRoomContextValue['wheelBanner']>);
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
          .on('broadcast', { event: 'music:sync' }, ({ payload }) => {
            const m = payload as RoomMusicState | null;
            setExtras((prev) => ({ ...prev, musicState: m }));
          })
          .on('broadcast', { event: 'room:contest' }, ({ payload }) => {
            const nextContest = (payload as RoomLiveContest | null) ?? null;
            setExtras((prev) => ({ ...prev, activeContest: nextContest }));
          })
          .subscribe();

        roomChannelRef.current = sbRoomChannel;

        // Shared presence channel for Lobby & Room member count
        const lobbyPresenceChannel = supabase.channel('sada-agencies-presence', {
          config: { presence: { key: `${roomId}_${user.id}` } },
        });
        const syncRoomPresence = () => {
          const state = lobbyPresenceChannel.presenceState<RoomPresenceMember>();
          const membersInRoom: RoomPresenceMember[] = [];
          Object.values(state).forEach((entries) => {
            entries.forEach((entry) => {
              if (entry.roomId === roomId && entry.userId) {
                if (!membersInRoom.some((m) => m.userId === entry.userId)) {
                  membersInRoom.push(entry);
                }
              }
            });
          });
          setPresenceMembers(membersInRoom);
        };
        lobbyPresenceChannel
          .on('presence', { event: 'sync' }, syncRoomPresence)
          .on('presence', { event: 'join' }, syncRoomPresence)
          .on('presence', { event: 'leave' }, syncRoomPresence)
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              void lobbyPresenceChannel.track({
                roomId,
                userId: user.id,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                frameId: user.frameId,
                level: user.level,
              });
            }
          });
        presenceChannelRef.current = lobbyPresenceChannel;

        // Join room & emit entry banner
        const joinRes = await joinRoomInSupabase(roomId, user);
        if (activeRoomIdRef.current !== roomId) return;
        setRoom(joinRes.room);
        setExtras(joinRes.extras);
        if (joinRes.entryEvent) {
          setEntryBanner(joinRes.entryEvent);
          setTimeout(() => setEntryBanner(null), 5500);
          void sbRoomChannel.send({
            type: 'broadcast',
            event: 'room:entry',
            payload: joinRes.entryEvent,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذّر دخول الغرفة.');
        await teardownActiveChannels();
        setRoom(null);
      } finally {
        setLoading(false);
      }
    },
    [leaveActiveRoom, room, teardownActiveChannels, user]
  );

  // Auto-eject if kicked from agency by manager
  useEffect(() => {
    if (!room || !user) return;
    if (
      !user.is_admin &&
      user.id !== room.hostId &&
      extras.kickedUserIds.includes(user.id)
    ) {
      void leaveActiveRoom();
      setError('تم طردك من هذه الوكالة بقرار من إدارة الوكالة.');
    }
  }, [extras.kickedUserIds, leaveActiveRoom, room, user]);

  // Cleanup everything on user logout
  useEffect(() => {
    if (!user && activeRoomIdRef.current) {
      void leaveActiveRoom();
    }
  }, [leaveActiveRoom, user]);

  const mySeat = useMemo(
    () => room?.seats.find((s) => s.userId === user?.id) || null,
    [room, user?.id]
  );

  // Persistent Web Audio API Mic Level Monitor (survives tab switching while minimized!)
  useEffect(() => {
    if (!mySeat || mySeat.isMuted || !user || !activeRoomId) {
      cleanupMicMonitor();
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
        micAudioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const buffer = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (cancelled) return;
          analyser.getByteFrequencyData(buffer);
          const avg = buffer.reduce((a, b) => a + b, 0) / buffer.length;
          const speaking = avg > 15;
          if (speaking !== lastSpeaking) {
            lastSpeaking = speaking;
            void roomChannelRef.current?.send({
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

    void startMic();

    return () => {
      cancelled = true;
      cleanupMicMonitor();
    };
  }, [activeRoomId, cleanupMicMonitor, mySeat?.seatIndex, mySeat?.isMuted, user?.id]);

  // Persistent Room Music Player Effect (device audio file only, respects local/room mute)
  useEffect(() => {
    const music = extras.musicState;
    stopMusicEngines();

    if (!music || !music.isPlaying || musicMutedLocally || roomAudioMuted || !activeRoomId) {
      return;
    }

    if (music.sourceType === 'file' && music.audioDataUrl) {
      try {
        const el = musicAudioElRef.current || new Audio();
        musicAudioElRef.current = el;
        el.src = music.audioDataUrl;
        el.loop = true;
        el.volume = Math.max(0, Math.min(1, musicVolume));
        el.play().catch(() => {});
      } catch {
        // ignore browser autoplay restriction until user interacts
      }
    }

    return () => {
      stopMusicEngines();
    };
  }, [
    activeRoomId,
    extras.musicState?.isPlaying,
    extras.musicState?.trackName,
    extras.musicState?.audioDataUrl,
    extras.musicState?.updatedAt,
    musicMutedLocally,
    roomAudioMuted,
    stopMusicEngines,
  ]);

  // Live volume adjustment for active HTMLAudioElement
  useEffect(() => {
    if (musicAudioElRef.current) {
      musicAudioElRef.current.volume =
        musicMutedLocally || roomAudioMuted ? 0 : Math.max(0, Math.min(1, musicVolume));
    }
  }, [musicVolume, musicMutedLocally, roomAudioMuted]);

  const minimizeRoom = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const restoreRoom = useCallback(() => {
    setIsMinimized(false);
  }, []);

  const handleSeatClick = useCallback(
    async (seatIndex: number): Promise<'opened_profile' | 'updated' | 'locked' | 'noop'> => {
      if (!room || !user) return 'noop';
      const seat = room.seats.find((s) => s.seatIndex === seatIndex);
      if (!seat) return 'noop';
      if (seat.isLocked) return 'locked';

      try {
        if (seat.userId === user.id) {
          const nextSeats = await updateRoomSeatInSupabase(room.id, user, { type: 'leave' });
          setRoom((prev) => (prev ? { ...prev, seats: nextSeats } : prev));
          return 'updated';
        }
        if (!seat.userId) {
          const nextSeats = await updateRoomSeatInSupabase(room.id, user, {
            type: 'take',
            seatIndex,
          });
          setRoom((prev) => (prev ? { ...prev, seats: nextSeats } : prev));
          return 'updated';
        }
        return 'opened_profile';
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذّر تحديث المقعد.');
        return 'noop';
      }
    },
    [room, user]
  );

  const handleToggleLock = useCallback(
    async (seatIndex: number, isLocked: boolean) => {
      if (!room || !user) return;
      try {
        const nextSeats = await updateRoomSeatInSupabase(room.id, user, {
          type: 'lock',
          seatIndex,
          isLocked: !isLocked,
        });
        setRoom((prev) => (prev ? { ...prev, seats: nextSeats } : prev));
        const nextExtras = await getRoomExtrasFromSupabase(room.id);
        setExtras(nextExtras);
      } catch {
        // ignore
      }
    },
    [room, user]
  );

  const handleToggleMute = useCallback(async () => {
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
  }, [mySeat, room, user]);

  const handleManualSpeakToggle = useCallback(async () => {
    if (!room || !user || !mySeat || mySeat.isMuted) return;
    const next = !manualSpeakPulse;
    setManualSpeakPulse(next);
    void roomChannelRef.current?.send({
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
  }, [manualSpeakPulse, mySeat, room, user]);

  const handleRequestMicAccess = useCallback(async () => {
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
      setError('يرجى السماح بإذن المايكروفون من إعدادات الهاتف أو المتصفح.');
    }
  }, []);

  const sendChat = useCallback(
    async (text: string) => {
      if (!room || !user || !text.trim()) return;
      try {
        const sent = await sendRoomChatInSupabase(room.id, user, text);
        setRoom((prev) => {
          if (!prev) return prev;
          if (prev.messages.some((m) => m.id === sent.id)) return prev;
          return { ...prev, messages: [...prev.messages, sent].slice(-80) };
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذّر إرسال الرسالة.');
      }
    },
    [room, user]
  );

  const sendGift = useCallback(
    async (giftId: string, targetUserId?: string) => {
      if (!room || !user) return;
      setError(null);
      const data = await sendRoomGiftInSupabase(
        room.id,
        user,
        giftId,
        targetUserId || room.hostId
      );
      updateLocalUser(data.user);
      setRoom(data.room);

      const targetName =
        data.room.seats.find((s) => s.userId === (targetUserId || room.hostId))
          ?.displayName || data.room.hostName;
      const banner = {
        gift: data.gift,
        luckyMultiplier: data.luckyMultiplier,
        luckyBonusCoins: data.luckyBonusCoins,
        senderName: data.user.displayName,
        recipientName: targetName,
      };
      setGiftBanner(banner);
      setTimeout(() => setGiftBanner(null), 4800);
      void roomChannelRef.current?.send({
        type: 'broadcast',
        event: 'room:gift',
        payload: banner,
      });

      const refreshed = await getRoomDetailsFromSupabase(room.id);
      setExtras(refreshed.extras);
    },
    [room, updateLocalUser, user]
  );

  const sendGiftBatch = useCallback(
    async (
      giftId: string,
      targetUserIds: string[],
      quantity: number,
      comboCount = 1
    ) => {
      if (!room || !user) return;
      setError(null);
      const data = await sendRoomGiftBatchInSupabase(
        room.id,
        user,
        giftId,
        targetUserIds,
        quantity,
        comboCount
      );
      updateLocalUser(data.user);
      setRoom(data.room);
      setExtras(data.extras);

      const totalCoinsSpent =
        data.gift.coinsCost * data.quantity * Math.max(1, data.recipientIds.length);
      const isFullscreen =
        ['gift_05', 'gift_06', 'gift_07', 'gift_28'].includes(data.gift.id) ||
        data.gift.tier === 'imperial' ||
        data.gift.coinsCost >= 12000 ||
        totalCoinsSpent >= 25000;

      const flyEvent: RoomFlyingGiftEvent = {
        id: `fly_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        gift: data.gift,
        quantity: data.quantity,
        comboCount,
        senderId: data.user.id,
        senderName: data.user.displayName,
        recipientIds: data.recipientIds,
        recipientNames: data.recipientNames,
        luckyMultiplier: data.luckyMultiplier,
        luckyBonusCoins: data.luckyBonusCoins,
        isFullscreen,
      };

      setFlyingGifts((prev) => [...prev, flyEvent]);
      setTimeout(() => {
        setFlyingGifts((prev) => prev.filter((item) => item.id !== flyEvent.id));
      }, 1700);

      if (isFullscreen) {
        setFullscreenGift(flyEvent);
        setTimeout(() => {
          setFullscreenGift((curr) => (curr?.id === flyEvent.id ? null : curr));
        }, 5000);
      }

      const targetLabel =
        data.recipientNames.length > 1
          ? `الجميع (${data.recipientNames.length})`
          : data.recipientNames[0] || data.room.hostName;
      const banner = {
        gift: data.gift,
        luckyMultiplier: data.luckyMultiplier,
        luckyBonusCoins: data.luckyBonusCoins,
        senderName: data.user.displayName,
        recipientName:
          data.quantity > 1 || comboCount > 1
            ? `${targetLabel} (×${data.quantity}${comboCount > 1 ? ` · Combo x${comboCount}` : ''})`
            : targetLabel,
      };
      setGiftBanner(banner);
      setTimeout(() => setGiftBanner(null), 4800);

      void roomChannelRef.current?.send({
        type: 'broadcast',
        event: 'room:gift-fly',
        payload: flyEvent,
      });
      void roomChannelRef.current?.send({
        type: 'broadcast',
        event: 'room:gift',
        payload: banner,
      });
    },
    [room, updateLocalUser, user]
  );

  const sendSeatEmoji = useCallback(
    (payload: { emoji: string; label: string; isDice?: boolean }) => {
      if (!user || !room) return;
      const diceValue = payload.isDice ? Math.floor(Math.random() * 6) + 1 : undefined;
      const event: RoomSeatEmojiEvent = {
        id: `emo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: user.id,
        displayName: user.displayName,
        emoji: payload.emoji,
        label: payload.label,
        diceValue,
        expiresAt: Date.now() + 4000,
      };

      setSeatEmojis((prev) => ({ ...prev, [user.id]: event }));
      setTimeout(() => {
        setSeatEmojis((prev) => {
          if (prev[user.id]?.id !== event.id) return prev;
          const copy = { ...prev };
          delete copy[user.id];
          return copy;
        });
      }, 4000);

      void roomChannelRef.current?.send({
        type: 'broadcast',
        event: 'seat:emoji',
        payload: event,
      });
    },
    [room, user]
  );

  const updateRoomFromWheel = useCallback(
    async (nextRoom: Room, coinsCost: number) => {
      setRoom(nextRoom);
      if (!activeRoomId) return;
      const nextExtras = await incrementRoomPlayVolumeInSupabase(activeRoomId, coinsCost, user);
      setExtras(nextExtras);
    },
    [activeRoomId, user]
  );

  const updateSettings = useCallback(
    async (patch: {
      maxSeats?: number;
      hostAvatar?: string;
      coverImage?: string;
      description?: string;
      title?: string;
    }) => {
      if (!room || !user) return;
      const updatedRoom = await updateRoomSettingsInSupabase(room.id, user, patch);
      setRoom(updatedRoom);
    },
    [room, user]
  );

  const runAdminAction = useCallback(
    async (
      action:
        | { type: 'mute_all' }
        | { type: 'clear_all' }
        | { type: 'mute_user'; targetUserId: string; isMuted: boolean }
        | { type: 'kick_seat'; targetUserId: string }
        | { type: 'kick_room'; targetUserId: string; targetName?: string }
        | { type: 'unban_room'; targetUserId: string }
        | { type: 'toggle_deputy'; targetUserId: string; targetName?: string }
        | { type: 'toggle_moderator'; targetUserId: string; targetName?: string }
    ) => {
      if (!room || !user) return;
      const res = await adminControlRoomInSupabase(room.id, user, action);
      setRoom((prev) => (prev ? { ...prev, seats: res.seats } : prev));
      setExtras(res.extras);
    },
    [room, user]
  );

  const broadcastMusicState = useCallback(
    async (nextMusic: RoomMusicState | null) => {
      if (!room) return;
      setExtras((prev) => ({ ...prev, musicState: nextMusic }));
      void roomChannelRef.current?.send({
        type: 'broadcast',
        event: 'music:sync',
        payload: nextMusic,
      });
      const updated = await updateRoomMusicInSupabase(room.id, nextMusic);
      setExtras(updated);
    },
    [room]
  );

  const playUploadedMusic = useCallback(
    async (trackName: string, dataUrl: string) => {
      if (!user) return;
      const syncDataUrl = dataUrl.length <= 450_000 ? dataUrl : null;
      if (!syncDataUrl) {
        try {
          const el = musicAudioElRef.current || new Audio();
          musicAudioElRef.current = el;
          el.src = dataUrl;
          el.loop = true;
          el.volume = musicMutedLocally || roomAudioMuted ? 0 : musicVolume;
          void el.play();
        } catch {
          // ignore
        }
      }
      await broadcastMusicState({
        isPlaying: true,
        trackName,
        djUserId: user.id,
        djName: user.displayName,
        sourceType: 'file',
        audioDataUrl: syncDataUrl,
        updatedAt: Date.now(),
      });
    },
    [broadcastMusicState, musicMutedLocally, musicVolume, roomAudioMuted, user]
  );

  const toggleMusicPlayPause = useCallback(async () => {
    if (!extras.musicState) return;
    await broadcastMusicState({
      ...extras.musicState,
      isPlaying: !extras.musicState.isPlaying,
      updatedAt: Date.now(),
    });
  }, [broadcastMusicState, extras.musicState]);

  const stopRoomMusic = useCallback(async () => {
    await broadcastMusicState(null);
  }, [broadcastMusicState]);

  const addPlayVolume = useCallback(
    async (coinsAmount: number) => {
      if (!activeRoomId) return;
      const next = await incrementRoomPlayVolumeInSupabase(activeRoomId, coinsAmount, user);
      setExtras(next);
    },
    [activeRoomId, user]
  );

  const broadcastContest = useCallback((contest: RoomLiveContest | null) => {
    void roomChannelRef.current?.send({
      type: 'broadcast',
      event: 'room:contest',
      payload: contest,
    });
  }, []);

  const startContest = useCallback(
    async (payload: {
      title: string;
      mode: RoomLiveContest['mode'];
      prizeLabel: string;
    }) => {
      if (!room || !user) return;
      const next = await startRoomContestInSupabase(room.id, user, payload);
      setExtras(next);
      broadcastContest(next.activeContest || null);
    },
    [broadcastContest, room, user]
  );

  const joinContest = useCallback(
    async (note?: string) => {
      if (!room || !user) return;
      const next = await joinRoomContestInSupabase(room.id, user, note);
      setExtras(next);
      broadcastContest(next.activeContest || null);
    },
    [broadcastContest, room, user]
  );

  const voteContest = useCallback(
    async (contestantUserId: string) => {
      if (!room || !user) return;
      const next = await voteRoomContestInSupabase(room.id, user, contestantUserId);
      setExtras(next);
      broadcastContest(next.activeContest || null);
    },
    [broadcastContest, room, user]
  );

  const finishContest = useCallback(
    async (winnerUserId?: string) => {
      if (!room || !user) return;
      const next = await finishRoomContestInSupabase(room.id, user, winnerUserId);
      setExtras(next);
      broadcastContest(next.activeContest || null);
    },
    [broadcastContest, room, user]
  );

  const clearContest = useCallback(async () => {
    if (!room || !user) return;
    const next = await clearRoomContestInSupabase(room.id, user);
    setExtras(next);
    broadcastContest(null);
  }, [broadcastContest, room, user]);

  const canManage = useMemo(
    () => (room ? canManageRoom(room, extras, user) : false),
    [extras, room, user]
  );

  const isOwnerOrAdmin = useMemo(
    () => Boolean(room && user && (user.is_admin || user.id === room.hostId)),
    [room, user]
  );

  const liveListenersCount = useMemo(() => {
    if (!room) return 0;
    const connectedIds = new Set(presenceMembers.map((p) => p.userId));
    if (user?.id) connectedIds.add(user.id);
    return connectedIds.size;
  }, [presenceMembers, room, user?.id]);

  const topGifters = useMemo(() => {
    const entries = Object.values(extras.gifters || {});
    return entries.sort((a, b) => b.totalCoins - a.totalCoins).slice(0, 3);
  }, [extras.gifters]);

  const supportAndPlayLeaderboard = useMemo<RoomPlaySupportEntry[]>(() => {
    const map = new Map<string, RoomPlaySupportEntry>();
    for (const g of Object.values(extras.gifters || {})) {
      map.set(g.userId, {
        userId: g.userId,
        displayName: g.displayName,
        avatarUrl: g.avatarUrl,
        frameId: g.frameId,
        supportCoins: g.totalCoins || 0,
        playCoins: 0,
        totalCoins: g.totalCoins || 0,
      });
    }
    for (const p of Object.values(extras.players || {})) {
      const existing = map.get(p.userId);
      if (existing) {
        existing.playCoins += p.playCoins || 0;
        existing.totalCoins = existing.supportCoins + existing.playCoins;
      } else {
        map.set(p.userId, {
          userId: p.userId,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          frameId: p.frameId,
          supportCoins: 0,
          playCoins: p.playCoins || 0,
          totalCoins: p.playCoins || 0,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalCoins - a.totalCoins);
  }, [extras.gifters, extras.players]);

  const totalVolumeCoins = useMemo(() => {
    if (!room) return 0;
    return Math.max(room.totalGiftsCoins || 0, extras.playVolumeCoins || 0);
  }, [extras.playVolumeCoins, room]);

  return (
    <ActiveRoomContext.Provider
      value={{
        activeRoomId,
        room,
        extras,
        gifts,
        wheelSegments,
        wheelCost,
        loading,
        error,
        clearError: () => setError(null),
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
        musicState: extras.musicState || null,
        musicVolume,
        musicMutedLocally,
        roomAudioMuted,
        setMusicVolume,
        setMusicMutedLocally,
        setRoomAudioMuted,
        enterRoom,
        minimizeRoom,
        restoreRoom,
        leaveActiveRoom,
        handleSeatClick,
        handleToggleLock,
        handleToggleMute,
        handleManualSpeakToggle,
        handleRequestMicAccess,
        sendChat,
        sendGift,
        sendGiftBatch,
        sendSeatEmoji,
        updateRoomFromWheel,
        updateSettings,
        runAdminAction,
        playUploadedMusic,
        toggleMusicPlayPause,
        stopRoomMusic,
        addPlayVolume,
        startContest,
        joinContest,
        voteContest,
        finishContest,
        clearContest,
        giftTargetRequest,
        requestGiftForUser,
        clearGiftTargetRequest,
      }}
    >
      {children}
    </ActiveRoomContext.Provider>
  );
};

export function useActiveRoom() {
  const ctx = useContext(ActiveRoomContext);
  if (!ctx) {
    throw new Error('useActiveRoom must be used inside ActiveRoomProvider');
  }
  return ctx;
}
