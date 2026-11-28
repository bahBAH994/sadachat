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
import {
  getEffectsMutedSetting,
  setAudioMuted,
  setEffectsMuted as setAudioEffectsMuted,
} from '../lib/sadaAudio';
import {
  getGiftEffectTier,
  getUserVipTierInfo,
  type GiftEffectTier,
} from '../lib/sadaCatalog';
import {
  adminControlRoomInSupabase,
  canManageRoomMicRequestsFromData,
  clearRoomChatInSupabase,
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
  submitRoomQuizAnswerInSupabase,
  advanceRoomQuizQuestionInSupabase,
  updateRoomMusicInSupabase,
  updateRoomSeatInSupabase,
  updateRoomSettingsInSupabase,
  voteRoomContestInSupabase,
} from '../lib/sadaRoomsService';
import { refreshGameUserFromSupabase } from '../lib/sadaGamesService';
import { getEquippedStoreAsset } from '../lib/sadaStoreService';
import { supabase } from '../lib/supabase';
import { safeGetItem, safeRemoveItem, safeSetItem } from '../lib/safeStorage';
import type {
  GiftItem,
  GlobalAdminAnnouncement,
  GlobalRoyalGiftAnnouncement,
  LuckyWheelSegment,
  Room,
  RoomEntryEvent,
  RoomExtrasConfig,
  RoomGifterEntry,
  RoomLiveContest,
  RoomMessage,
  RoomMusicState,
  RoomSeat,
  User,
  VipTierKey,
} from '../types';

export interface RoomPresenceMember {
  roomId: string;
  userId: string;
  displayName: string;
  avatarUrl: string;
  frameId?: string;
  frameUrl?: string;
  gender?: User['gender'];
  level?: number;
  vipLevel?: VipTierKey;
}

export interface RoomFlyingGiftEvent {
  id: string;
  gift: GiftItem;
  tierLevel: GiftEffectTier;
  quantity: number;
  comboCount: number;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  recipientIds: string[];
  recipientNames: string[];
  luckyMultiplier?: number | null;
  luckyBonusCoins?: number;
  isFullscreen: boolean;
}

export interface Tier1SideNotice {
  id: string;
  comboKey: string;
  gift: GiftItem;
  senderId: string;
  senderName: string;
  recipientName: string;
  quantity: number;
  comboCount: number;
  luckyMultiplier?: number | null;
}

export interface SeatGiftReactionEvent {
  id: string;
  gift: GiftItem;
  senderName: string;
  quantity: number;
  comboCount: number;
  tierLevel: GiftEffectTier;
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
  vipLevel?: VipTierKey;
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
  exitModalOpen: boolean;
  setExitModalOpen: (open: boolean) => void;
  mySeat: RoomSeat | null;
  canManage: boolean;
  isOwnerOrAdmin: boolean;
  micActive: boolean;
  micDenied: boolean;
  manualSpeakPulse: boolean;
  micRequest: { userId: string; displayName: string; nonce: number } | null;
  micApprovedRequest: { userId: string; nonce: number } | null;
  approveMicRequest: (request: { userId: string; displayName: string; nonce: number }) => Promise<void>;
  denyMicRequest: (request: { userId: string; displayName: string; nonce: number }) => Promise<void>;
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
  tier1SideNotices: Tier1SideNotice[];
  mediumCelebrationGift: RoomFlyingGiftEvent | null;
  fullscreenGift: RoomFlyingGiftEvent | null;
  globalRoyalGift: GlobalRoyalGiftAnnouncement | null;
  dismissGlobalRoyalGift: () => void;
  adminAnnouncement: GlobalAdminAnnouncement | null;
  dismissAdminAnnouncement: () => void;
  broadcastAdminAnnouncement: (announcement: GlobalAdminAnnouncement) => void;
  seatGiftReactions: Record<string, SeatGiftReactionEvent>;
  seatHaloEffects: Record<string, string>;
  seatEmojis: Record<string, RoomSeatEmojiEvent>;
  musicState: RoomMusicState | null;
  musicVolume: number;
  musicMutedLocally: boolean;
  roomAudioMuted: boolean;
  effectsMuted: boolean;
  setMusicVolume: (vol: number) => void;
  setMusicMutedLocally: (muted: boolean) => void;
  setRoomAudioMuted: (muted: boolean) => void;
  setEffectsMuted: (muted: boolean) => void;
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
    backgroundImage?: string;
    description?: string;
    title?: string;
    requireMicPermission?: boolean;
    agencyLockEnabled?: boolean;
    agencyLockPassword?: string;
  }) => Promise<void>;
  runAdminAction: (
    action:
      | { type: 'mute_all' }
      | { type: 'clear_all' }
      | { type: 'mute_user'; targetUserId: string; isMuted: boolean }
      | { type: 'kick_seat'; targetUserId: string }
      | { type: 'temporary_kick_room'; targetUserId: string; targetName?: string }
      | { type: 'kick_room'; targetUserId: string; targetName?: string }
      | { type: 'unban_room'; targetUserId: string }
      | { type: 'toggle_deputy'; targetUserId: string; targetName?: string }
      | { type: 'toggle_moderator'; targetUserId: string; targetName?: string }
  ) => Promise<void>;
  clearRoomChat: () => Promise<void>;
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
  submitContestQuizAnswer: (answerIndex: number) => Promise<void>;
  advanceContestQuizQuestion: () => Promise<void>;
  giftTargetRequest: { userId: string; nonce: number } | null;
  requestGiftForUser: (userId: string) => void;
  clearGiftTargetRequest: () => void;
}

const ActiveRoomContext = createContext<ActiveRoomContextValue | undefined>(undefined);
const ACTIVE_ROOM_STORAGE_KEY = 'sada_active_room_id';

export const ActiveRoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, updateLocalUser } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => safeGetItem('sada_persist_room_id'));
  const [room, setRoom] = useState<Room | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;
  const [extras, setExtras] = useState<RoomExtrasConfig>(createEmptyRoomExtras());
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [wheelSegments, setWheelSegments] = useState<LuckyWheelSegment[]>([]);
  const [wheelCost, setWheelCost] = useState<number>(200);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [exitModalOpen, setExitModalOpen] = useState<boolean>(false);

  const [presenceMembers, setPresenceMembers] = useState<RoomPresenceMember[]>([]);
  const presenceMembersRef = useRef<RoomPresenceMember[]>([]);
  const [micActive, setMicActive] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [manualSpeakPulse, setManualSpeakPulse] = useState(false);
  const [micRequest, setMicRequest] = useState<{
    userId: string;
    displayName: string;
    nonce: number;
  } | null>(null);
  const [micApprovedRequest, setMicApprovedRequest] = useState<{
    userId: string;
    nonce: number;
  } | null>(null);

  const [giftBanner, setGiftBanner] = useState<ActiveRoomContextValue['giftBanner']>(null);
  const [wheelBanner, setWheelBanner] = useState<ActiveRoomContextValue['wheelBanner']>(null);
  const [entryBanner, setEntryBanner] = useState<RoomEntryEvent | null>(null);
  const [flyingGifts, setFlyingGifts] = useState<RoomFlyingGiftEvent[]>([]);
  const [tier1SideNotices, setTier1SideNotices] = useState<Tier1SideNotice[]>([]);
  const [mediumCelebrationGift, setMediumCelebrationGift] =
    useState<RoomFlyingGiftEvent | null>(null);
  const [fullscreenGift, setFullscreenGift] = useState<RoomFlyingGiftEvent | null>(null);
  const [globalRoyalGift, setGlobalRoyalGift] =
    useState<GlobalRoyalGiftAnnouncement | null>(null);
  const [adminAnnouncement, setAdminAnnouncement] =
    useState<GlobalAdminAnnouncement | null>(null);
  const [seatGiftReactions, setSeatGiftReactions] = useState<
    Record<string, SeatGiftReactionEvent>
  >({});
  const [seatHaloEffects, setSeatHaloEffects] = useState<Record<string, string>>({});
  const [seatEmojis, setSeatEmojis] = useState<Record<string, RoomSeatEmojiEvent>>({});

  const [musicVolume, setMusicVolume] = useState<number>(0.45);
  const [musicMutedLocally, setMusicMutedLocally] = useState<boolean>(false);
  const [roomAudioMuted, setRoomAudioMutedState] = useState<boolean>(false);
  const [effectsMuted, setEffectsMutedState] = useState<boolean>(() =>
    getEffectsMutedSetting()
  );

  const [giftTargetRequest, setGiftTargetRequest] = useState<{
    userId: string;
    nonce: number;
  } | null>(null);

  const processedGiftIdsRef = useRef<Set<string>>(new Set());
  const processedGlobalGiftIdsRef = useRef<Set<string>>(new Set());
  const processedAdminAnnIdsRef = useRef<Set<string>>(new Set());
  const globalAnnouncementTimerRef = useRef<number | null>(null);
  const adminAnnouncementTimerRef = useRef<number | null>(null);
  const globalChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const entryTimerRef = useRef<number | null>(null);

  const dismissGlobalRoyalGift = useCallback(() => {
    if (globalAnnouncementTimerRef.current) {
      window.clearTimeout(globalAnnouncementTimerRef.current);
      globalAnnouncementTimerRef.current = null;
    }
    setGlobalRoyalGift(null);
  }, []);

  const dismissAdminAnnouncement = useCallback(() => {
    if (adminAnnouncementTimerRef.current) {
      window.clearTimeout(adminAnnouncementTimerRef.current);
      adminAnnouncementTimerRef.current = null;
    }
    setAdminAnnouncement(null);
  }, []);

  const showAdminAnnouncement = useCallback((announcement: GlobalAdminAnnouncement) => {
    if (!announcement?.id || !announcement?.message) return;
    if (processedAdminAnnIdsRef.current.has(announcement.id)) return;
    processedAdminAnnIdsRef.current.add(announcement.id);
    if (processedAdminAnnIdsRef.current.size > 60) {
      const oldest = processedAdminAnnIdsRef.current.values().next().value;
      if (oldest) processedAdminAnnIdsRef.current.delete(oldest);
    }

    if (adminAnnouncementTimerRef.current) {
      window.clearTimeout(adminAnnouncementTimerRef.current);
      adminAnnouncementTimerRef.current = null;
    }
    setAdminAnnouncement(announcement);
    adminAnnouncementTimerRef.current = window.setTimeout(() => {
      setAdminAnnouncement((prev) => (prev?.id === announcement.id ? null : prev));
      adminAnnouncementTimerRef.current = null;
    }, 15000);
  }, []);

  const broadcastAdminAnnouncement = useCallback(
    (announcement: GlobalAdminAnnouncement) => {
      showAdminAnnouncement(announcement);
      void globalChannelRef.current?.send({
        type: 'broadcast',
        event: 'global:admin-announcement',
        payload: announcement,
      });
    },
    [showAdminAnnouncement]
  );

  const showGlobalRoyalGift = useCallback((announcement: GlobalRoyalGiftAnnouncement) => {
    if (!announcement?.id || !announcement.roomId) return;
    if (processedGlobalGiftIdsRef.current.has(announcement.id)) return;
    processedGlobalGiftIdsRef.current.add(announcement.id);
    if (processedGlobalGiftIdsRef.current.size > 80) {
      const oldest = processedGlobalGiftIdsRef.current.values().next().value;
      if (oldest) processedGlobalGiftIdsRef.current.delete(oldest);
    }

    if (globalAnnouncementTimerRef.current) {
      window.clearTimeout(globalAnnouncementTimerRef.current);
      globalAnnouncementTimerRef.current = null;
    }
    setGlobalRoyalGift(announcement);
    globalAnnouncementTimerRef.current = window.setTimeout(() => {
      setGlobalRoyalGift((prev) => (prev?.id === announcement.id ? null : prev));
      globalAnnouncementTimerRef.current = null;
    }, 8500);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      if (globalChannelRef.current) {
        void supabase.removeChannel(globalChannelRef.current);
        globalChannelRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel('sada-global-announcements', {
        config: { broadcast: { self: true } },
      })
      .on('broadcast', { event: 'global:royal-gift' }, ({ payload }) => {
        if (payload) {
          showGlobalRoyalGift(payload as GlobalRoyalGiftAnnouncement);
        }
      })
      .on('broadcast', { event: 'global:admin-announcement' }, ({ payload }) => {
        if (payload) {
          showAdminAnnouncement(payload as GlobalAdminAnnouncement);
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sada_platform_state',
          filter: 'id=eq.global',
        },
        (payload) => {
          const settings = (payload.new as Record<string, unknown> | undefined)?.settings as
            | { latestAdminAnnouncement?: GlobalAdminAnnouncement | null }
            | undefined;
          const latest = settings?.latestAdminAnnouncement;
          if (latest?.id && latest?.timestamp) {
            const ageMs = Date.now() - new Date(latest.timestamp).getTime();
            if (Number.isFinite(ageMs) && ageMs <= 120_000) {
              showAdminAnnouncement(latest);
            }
          }
        }
      )
      .subscribe();

    globalChannelRef.current = channel;
    return () => {
      if (globalAnnouncementTimerRef.current) {
        window.clearTimeout(globalAnnouncementTimerRef.current);
        globalAnnouncementTimerRef.current = null;
      }
      if (adminAnnouncementTimerRef.current) {
        window.clearTimeout(adminAnnouncementTimerRef.current);
        adminAnnouncementTimerRef.current = null;
      }
      if (globalChannelRef.current === channel) {
        globalChannelRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [showAdminAnnouncement, showGlobalRoyalGift, user?.id]);

  const showTimedEntryBanner = useCallback((ev: RoomEntryEvent) => {
    if (entryTimerRef.current) {
      window.clearTimeout(entryTimerRef.current);
      entryTimerRef.current = null;
    }
    setEntryBanner(ev);
    const duration = ev.entranceAssetUrl
      ? 4000
      : ev.vipLevel === 'svip'
        ? 3500
        : ev.vipLevel === 'vip3'
          ? 3500
          : ev.vipLevel === 'vip2'
            ? 3200
            : 4500;
    entryTimerRef.current = window.setTimeout(() => {
      setEntryBanner((prev) =>
        prev && prev.userId === ev.userId && prev.timestamp === ev.timestamp ? null : prev
      );
      entryTimerRef.current = null;
    }, duration);
  }, []);

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

  const setEffectsMuted = useCallback((muted: boolean) => {
    setEffectsMutedState(muted);
    setAudioEffectsMuted(muted);
  }, []);

  const dispatchTieredGiftEffects = useCallback((rawFly: RoomFlyingGiftEvent) => {
    if (!rawFly?.id || !rawFly?.gift) return;
    if (rawFly.gift.category === 'lucky') return;
    if (processedGiftIdsRef.current.has(rawFly.id)) return;
    processedGiftIdsRef.current.add(rawFly.id);
    if (processedGiftIdsRef.current.size > 120) {
      const oldest = processedGiftIdsRef.current.values().next().value;
      if (oldest) processedGiftIdsRef.current.delete(oldest);
    }

    const tierLevel = rawFly.tierLevel || getGiftEffectTier(rawFly.gift.coinsCost);
    const flyData: RoomFlyingGiftEvent = {
      ...rawFly,
      tierLevel,
      isFullscreen: tierLevel === 3 || Boolean(rawFly.isFullscreen),
    };

    // 1) Flying 3D Gift Trajectory toward recipient mics
    setFlyingGifts((prev) => [...prev, flyData]);
    window.setTimeout(() => {
      setFlyingGifts((prev) => prev.filter((item) => item.id !== flyData.id));
    }, 2500);
  }, []);

  const pendingLuckyGiftBonusRef = useRef(0);
  const updateGiftSenderBalance = useCallback(
    (giftUser: User, gift: GiftItem, luckyBonusCoins: number) => {
      if (gift.category !== 'lucky' || luckyBonusCoins <= 0) {
        updateLocalUser(giftUser);
        return;
      }

      pendingLuckyGiftBonusRef.current += luckyBonusCoins;
      updateLocalUser({
        ...giftUser,
        coins: Math.max(0, giftUser.coins - pendingLuckyGiftBonusRef.current),
      });
      window.setTimeout(() => {
        pendingLuckyGiftBonusRef.current = Math.max(
          0,
          pendingLuckyGiftBonusRef.current - luckyBonusCoins
        );
        void refreshGameUserFromSupabase(giftUser.id)
          .then((freshUser) =>
            updateLocalUser({
              ...freshUser,
              coins: Math.max(0, freshUser.coins - pendingLuckyGiftBonusRef.current),
            })
          )
          .catch((refreshError: unknown) => {
            setError(
              refreshError instanceof Error
                ? `تعذّر تحديث رصيد جائزة هدية الحظ: ${refreshError.message}`
                : 'تعذّر تحديث رصيد جائزة هدية الحظ.'
            );
          });
      }, 3500);
    },
    [updateLocalUser]
  );

  const roomChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const roomDataChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const restoredRoomKeyRef = useRef<string | null>(null);

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
    const roomDataChannel = roomDataChannelRef.current;
    presenceChannelRef.current = null;
    roomChannelRef.current = null;
    roomDataChannelRef.current = null;
    const currentUserId = userRef.current?.id;
    let leaveError: unknown = null;

    if (prevId && currentUserId) {
      try {
        const connectedIds = new Set(
          presenceMembersRef.current
            .filter((member) => member.roomId === prevId)
            .map((member) => member.userId)
        );
        connectedIds.add(currentUserId);
        await leaveRoomInSupabase(
          prevId,
          currentUserId,
          Math.max(0, connectedIds.size - 1)
        );
      } catch (err) {
        leaveError = err;
        console.warn('leaveRoomInSupabase error:', err);
      }
    }
    if (presenceChannel) {
      try {
        await presenceChannel.untrack();
      } catch (err) {
        console.warn('Unable to untrack room presence:', err);
      }
      try {
        await supabase.removeChannel(presenceChannel);
      } catch (err) {
        console.warn('Unable to remove room presence channel:', err);
      }
    }
    if (roomChannel) {
      try {
        await supabase.removeChannel(roomChannel);
      } catch (err) {
        console.warn('Unable to remove active room channel:', err);
      }
    }
    if (roomDataChannel) {
      try {
        await supabase.removeChannel(roomDataChannel);
      } catch (err) {
        console.warn('Unable to remove room data channel:', err);
      }
    }
    presenceMembersRef.current = [];
    setPresenceMembers([]);
    if (leaveError) {
      setError(
        leaveError instanceof Error
          ? `غادرت الغرفة، لكن تعذّر تحديث حالتها: ${leaveError.message}`
          : 'غادرت الغرفة، لكن تعذّر تحديث حالتها.'
      );
    }
  }, [cleanupMicMonitor, stopMusicEngines]);

  const leaveActiveRoom = useCallback(async () => {
    setExitModalOpen(false);
    setIsMinimized(false);
    setActiveRoomId(null);
    setRoom(null);
    setError(null);
    setFlyingGifts([]);
    setTier1SideNotices([]);
    setMediumCelebrationGift(null);
    setFullscreenGift(null);
    setSeatGiftReactions({});
    setSeatHaloEffects({});
    safeRemoveItem(ACTIVE_ROOM_STORAGE_KEY);

    try {
      cleanupMicMonitor();
      stopMusicEngines();
      await teardownActiveChannels();
    } catch (leaveError) {
      setError(
        leaveError instanceof Error
          ? `غادرت الغرفة، لكن تعذّر تحديث حالتها: ${leaveError.message}`
          : 'غادرت الغرفة، لكن تعذّر تحديث حالتها.'
      );
    }
  }, [cleanupMicMonitor, stopMusicEngines, teardownActiveChannels]);

  const enterRoom = useCallback(
    async (roomId: string) => {
      const currentUser = userRef.current;
      if (!currentUser) return;
      if (activeRoomIdRef.current === roomId) {
        setIsMinimized(false);
        return;
      }

      if (activeRoomIdRef.current && activeRoomIdRef.current !== roomId) {
        await teardownActiveChannels();
      }

      setLoading(true);
      setError(null);
      setIsMinimized(false);
      setFlyingGifts([]);
      setTier1SideNotices([]);
      setMediumCelebrationGift(null);
      setFullscreenGift(null);
      setSeatGiftReactions({});
      setSeatHaloEffects({});
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

        // Keep database subscriptions unique while broadcasts share a room topic.
        const roomDataChannel = supabase
          .channel(
            `sada-room-${roomId}-${Date.now()}-${Math.random().toString(36).slice(2)}`
          )
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
                const msgs = Array.isArray(prev.messages) ? prev.messages : [];
                if (msgs.some((m) => m.id === mapped.id)) return prev;
                return { ...prev, messages: [...msgs, mapped].slice(-40) };
              });
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'sada_room_messages',
            },
            (payload) => {
              const deleted = payload.old as Record<string, unknown> | undefined;
              if (!deleted || String(deleted.room_id || '') !== roomId) return;
              const deletedId = String(deleted.id || '');
              if (!deletedId) return;
              setRoom((prev) =>
                prev
                  ? { ...prev, messages: prev.messages.filter((message) => message.id !== deletedId) }
                  : prev
              );
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
                  coverImage:
                    typeof r.cover_url === 'string'
                      ? r.cover_url
                      : typeof r.avatar_url === 'string'
                        ? r.avatar_url
                        : prev.coverImage,
                  backgroundImage:
                    typeof r.background_url === 'string'
                      ? r.background_url
                      : prev.backgroundImage,
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
          .subscribe();
        roomDataChannelRef.current = roomDataChannel;

        const sbRoomChannel = supabase
          .channel(`sada-room-${roomId}`)
          .on('broadcast', { event: 'room:gift' }, ({ payload }) => {
            const giftData = payload as NonNullable<ActiveRoomContextValue['giftBanner']>;
            if (giftData?.gift && giftData.gift.category !== 'lucky') {
              setGiftBanner(giftData);
              setTimeout(() => setGiftBanner(null), 3500);
            }
          })
          .on('broadcast', { event: 'room:gift-fly' }, ({ payload }) => {
            const flyData = payload as RoomFlyingGiftEvent;
            dispatchTieredGiftEffects(flyData);
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
            }, 3000);
          })
          .on('broadcast', { event: 'room:entry' }, ({ payload }) => {
            if (payload) {
              showTimedEntryBanner(payload as RoomEntryEvent);
            }
          })
          .on('broadcast', { event: 'room:wheel-win' }, ({ payload }) => {
            setWheelBanner(payload as NonNullable<ActiveRoomContextValue['wheelBanner']>);
            setTimeout(() => setWheelBanner(null), 4500);
          })
          .on('broadcast', { event: 'audio:speaking' }, ({ payload }) => {
            const sp = payload as { userId: string; isSpeaking: boolean };
            setRoom((prev) => {
              if (!prev) return prev;
              const seats = Array.isArray(prev.seats) ? prev.seats : [];
              return {
                ...prev,
                seats: seats.map((s) =>
                  s.userId === sp.userId ? { ...s, isSpeaking: sp.isSpeaking } : s
                ),
              };
            });
          })
          .on('broadcast', { event: 'mic:request' }, ({ payload }) => {
            const request = payload as {
              userId: string;
              displayName: string;
              nonce: number;
            };
            if (request?.userId) setMicRequest(request);
          })
          .on('broadcast', { event: 'mic:approve' }, ({ payload }) => {
            const approval = payload as { userId: string; nonce: number };
            if (approval?.userId) setMicApprovedRequest(approval);
          })
          .on('broadcast', { event: 'mic:deny' }, ({ payload }) => {
            const denied = payload as { userId: string; nonce: number };
            if (denied?.userId === user?.id) setMicRequest(null);
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
        try {
          const lobbyPresenceChannel = supabase.channel('sada-agencies-presence', {
            config: { presence: { key: `${roomId}_${currentUser.id}` } },
          });
          presenceChannelRef.current = lobbyPresenceChannel;

          const syncRoomPresence = () => {
            if (!presenceChannelRef.current) return;
            try {
              const state = presenceChannelRef.current.presenceState<RoomPresenceMember>();
              const membersInRoom: RoomPresenceMember[] = [];
              Object.values(state || {}).forEach((entries) => {
                (entries || []).forEach((entry) => {
                  if (entry?.roomId === roomId && entry?.userId) {
                    if (!membersInRoom.some((m) => m.userId === entry.userId)) {
                      membersInRoom.push(entry);
                    }
                  }
                });
              });
              presenceMembersRef.current = membersInRoom;
              setPresenceMembers(membersInRoom);
            } catch {
              // ignore transient presence errors
            }
          };

          if (presenceChannelRef.current) {
            presenceChannelRef.current
              .on('presence', { event: 'sync' }, syncRoomPresence)
              .on('presence', { event: 'join' }, syncRoomPresence)
              .on('presence', { event: 'leave' }, syncRoomPresence)
              .subscribe((status) => {
                if (status === 'SUBSCRIBED' && presenceChannelRef.current) {
                  const activeUser = userRef.current || currentUser;
                  void (async () => {
                    let frameUrl: string | undefined;
                    let frameId = activeUser.frameId;
                    try {
                      const equippedFrame = await getEquippedStoreAsset(
                        activeUser.id,
                        'frames'
                      );
                      frameUrl = equippedFrame?.assetUrl || undefined;
                      frameId = equippedFrame?.frameId || frameId;
                    } catch (error) {
                      console.warn('Unable to load equipped room frame:', error);
                    }

                    if (presenceChannelRef.current !== lobbyPresenceChannel) return;
                    try {
                      await lobbyPresenceChannel.track({
                        roomId,
                        userId: activeUser.id,
                        displayName: activeUser.displayName,
                        avatarUrl: activeUser.avatarUrl,
                        frameId,
                        frameUrl,
                        gender: activeUser.gender,
                        level: activeUser.level,
                        vipLevel: getUserVipTierInfo(activeUser).key,
                      });
                    } catch {
                      // ignore presence track errors
                    }
                  })();
                }
              });
          }
        } catch {
          presenceChannelRef.current = null;
        }

        // Join room & emit entry banner
        const joinRes = await joinRoomInSupabase(roomId, userRef.current || currentUser);
        if (activeRoomIdRef.current !== roomId) return;
        safeSetItem(ACTIVE_ROOM_STORAGE_KEY, roomId);
        setRoom(joinRes.room);
        setExtras(joinRes.extras);
        if (joinRes.entryEvent) {
          showTimedEntryBanner(joinRes.entryEvent);
          if (roomChannelRef.current) {
            try {
              void roomChannelRef.current.send({
                type: 'broadcast',
                event: 'room:entry',
                payload: joinRes.entryEvent,
              });
            } catch {
              // ignore broadcast errors
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذّر دخول الغرفة.');
        await teardownActiveChannels();
        setRoom(null);
      } finally {
        setLoading(false);
      }
    },
    [leaveActiveRoom, showTimedEntryBanner, teardownActiveChannels]
  );

  useEffect(() => {
    if (!user?.id) {
      restoredRoomKeyRef.current = null;
      return;
    }
    const savedRoomId = safeGetItem(ACTIVE_ROOM_STORAGE_KEY);
    if (!savedRoomId) return;
    const restoreKey = `${user.id}:${savedRoomId}`;
    if (restoredRoomKeyRef.current === restoreKey) return;
    restoredRoomKeyRef.current = restoreKey;
    let active = true;
    void (async () => {
      const { data, error: roomLookupError } = await supabase
        .from('sada_rooms')
        .select('id, is_active')
        .eq('id', savedRoomId)
        .maybeSingle();
      if (!active) return;
      if (roomLookupError) {
        setError(`تعذّر التحقق من الغرفة المحفوظة: ${roomLookupError.message}`);
        return;
      }
      if (!data || data.is_active !== true) {
        safeRemoveItem(ACTIVE_ROOM_STORAGE_KEY);
        restoredRoomKeyRef.current = null;
        return;
      }
      void enterRoom(savedRoomId);
    })();
    return () => {
      active = false;
    };
  }, [enterRoom, user?.id]);

  // Auto-eject if kicked from agency by manager
  useEffect(() => {
    const activeRoom = roomRef.current;
    const activeUser = userRef.current;
    if (!activeRoom || !activeUser) return;
    if (
      !activeUser.is_admin &&
      activeUser.id !== activeRoom.hostId &&
      Array.isArray(extras?.kickedUserIds) &&
      extras.kickedUserIds.includes(activeUser.id)
    ) {
      void leaveActiveRoom();
      setError('تم طردك من هذه الوكالة بقرار من إدارة الوكالة.');
    }
    const temporaryExpiry = extras?.temporaryKickExpiresAt?.[activeUser.id];
    if (
      temporaryExpiry &&
      new Date(temporaryExpiry).getTime() > Date.now() &&
      !activeUser.is_admin &&
      activeUser.id !== activeRoom.hostId
    ) {
      void leaveActiveRoom();
      setError('تم طردك من هذه الوكالة لمدة 3 أيام');
    }
  }, [
    extras?.kickedUserIds,
    extras?.temporaryKickExpiresAt,
    leaveActiveRoom,
    room?.hostId,
    user?.id,
    user?.is_admin,
  ]);

  // Cleanup everything on user logout
  useEffect(() => {
    if (!user?.id && activeRoomIdRef.current) {
      void leaveActiveRoom();
    }
  }, [leaveActiveRoom, user?.id]);

  const mySeat = useMemo(
    () => (Array.isArray(room?.seats) ? room.seats.find((s) => s.userId === user?.id) : null) || null,
    [room?.seats, user?.id]
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
                    seats: (Array.isArray(prev.seats) ? prev.seats : []).map((s) =>
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
    setExitModalOpen(false);
    setIsMinimized(true);
  }, []);

  const restoreRoom = useCallback(() => {
    setExitModalOpen(false);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تغيير حالة المايك.');
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
      if (user && room) {
        const nonce = Date.now();
        const request = {
          userId: user.id,
          displayName: user.displayName,
          nonce,
        };
        setMicRequest(request);
        await roomChannelRef.current?.send({
          type: 'broadcast',
          event: 'mic:request',
          payload: request,
        });
      }
    } catch {
      setMicDenied(true);
      setError('يرجى السماح بإذن المايكروفون من إعدادات الهاتف أو المتصفح.');
    }
  }, [room, user]);

  const approveMicRequest = useCallback(
    async (request: { userId: string; displayName: string; nonce: number }) => {
      if (!room || !user) return;
      let manager = false;
      try {
        manager = await canManageRoomMicRequestsFromData(
          { hostId: room.hostId },
          { id: user.id },
          { deputyIds: extras.deputyIds }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذّر التحقق من صلاحية الموافقة.');
        return;
      }
      if (!manager) return;
      const approval = { userId: request.userId, nonce: request.nonce };
      setMicRequest(null);
      void roomChannelRef.current?.send({
        type: 'broadcast',
        event: 'mic:approve',
        payload: approval,
      });
    },
    [extras, room, user]
  );

  const denyMicRequest = useCallback(
    async (request: { userId: string; displayName: string; nonce: number }) => {
      if (!room || !user) return;
      let manager = false;
      try {
        manager = await canManageRoomMicRequestsFromData(
          { hostId: room.hostId },
          { id: user.id },
          { deputyIds: extras.deputyIds }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذّر التحقق من صلاحية رفض الطلب.');
        return;
      }
      if (!manager) return;
      setMicRequest(null);
      void roomChannelRef.current?.send({
        type: 'broadcast',
        event: 'mic:deny',
        payload: { userId: request.userId, nonce: request.nonce },
      });
    },
    [extras, room, user]
  );

  const sendChat = useCallback(
    async (text: string) => {
      if (!room || !user || !text.trim()) return;
      try {
        const sent = await sendRoomChatInSupabase(room.id, user, text);
        setRoom((prev) => {
          if (!prev) return prev;
          if (prev.messages.some((m) => m.id === sent.id)) return prev;
          return { ...prev, messages: [...prev.messages, sent].slice(-40) };
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذّر إرسال الرسالة.');
        throw err;
      }
    },
    [room, user]
  );

  const clearRoomChat = useCallback(async () => {
    if (!room || !user) {
      throw new Error('يجب دخول الغرفة قبل مسح الدردشة.');
    }
    const previousMessages = room.messages;
    setRoom((prev) => (prev ? { ...prev, messages: [] } : prev));
    try {
      const notice = await clearRoomChatInSupabase(room.id);
      setRoom((prev) => (prev ? { ...prev, messages: [notice] } : prev));
    } catch (err) {
      setRoom((prev) => (prev ? { ...prev, messages: previousMessages } : prev));
      throw err;
    }
  }, [room, user]);

  const sendGift = useCallback(
    async (giftId: string, targetUserId?: string) => {
      if (!room || !user) return;
      setError(null);
      const recipientId = targetUserId || room.hostId;
      const data = await sendRoomGiftInSupabase(
        room.id,
        user,
        giftId,
        recipientId
      );
      updateGiftSenderBalance(data.user, data.gift, data.luckyBonusCoins);
      setRoom(data.room);

      const targetName =
        data.room.seats.find((s) => s.userId === recipientId)?.displayName ||
        data.room.hostName;
      const tierLevel = getGiftEffectTier(data.gift.coinsCost);
      const flyEvent: RoomFlyingGiftEvent = {
        id: `fly_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        gift: data.gift,
        tierLevel,
        quantity: 1,
        comboCount: 1,
        senderId: data.user.id,
        senderName: data.user.displayName,
        senderAvatarUrl: data.user.avatarUrl,
        recipientIds: [recipientId],
        recipientNames: [targetName],
        luckyMultiplier: data.luckyMultiplier,
        luckyBonusCoins: data.luckyBonusCoins,
        isFullscreen: tierLevel === 3,
      };
      dispatchTieredGiftEffects(flyEvent);
      void roomChannelRef.current?.send({
        type: 'broadcast',
        event: 'room:gift-fly',
        payload: flyEvent,
      });

      if (data.gift.category !== 'lucky' && data.gift.coinsCost >= 5000) {
        const globalPayload: GlobalRoyalGiftAnnouncement = {
          id: `groyal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          senderId: data.user.id,
          senderName: data.user.displayName,
          giftName: data.gift.name,
          giftGlyph: data.gift.glyph,
          giftImageUrl: data.gift.imageUrl,
          recipientName: targetName,
          roomId: data.room.id,
          roomTitle: data.room.title,
          totalCoins: data.gift.coinsCost,
          timestamp: new Date().toISOString(),
        };
        showGlobalRoyalGift(globalPayload);
        void globalChannelRef.current?.send({
          type: 'broadcast',
          event: 'global:royal-gift',
          payload: globalPayload,
        });
      }

      const refreshed = await getRoomDetailsFromSupabase(room.id);
      setExtras(refreshed.extras);
    },
    [dispatchTieredGiftEffects, room, showGlobalRoyalGift, updateGiftSenderBalance, user]
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
      updateGiftSenderBalance(data.user, data.gift, data.luckyBonusCoins);
      setRoom(data.room);
      setExtras(data.extras);

      const tierLevel = getGiftEffectTier(data.gift.coinsCost);
      const flyEvent: RoomFlyingGiftEvent = {
        id: `fly_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        gift: data.gift,
        tierLevel,
        quantity: data.quantity,
        comboCount,
        senderId: data.user.id,
        senderName: data.user.displayName,
        senderAvatarUrl: data.user.avatarUrl,
        recipientIds: data.recipientIds,
        recipientNames: data.recipientNames,
        luckyMultiplier: data.luckyMultiplier,
        luckyBonusCoins: data.luckyBonusCoins,
        isFullscreen: tierLevel === 3,
      };

      dispatchTieredGiftEffects(flyEvent);

      void roomChannelRef.current?.send({
        type: 'broadcast',
        event: 'room:gift-fly',
        payload: flyEvent,
      });

      const totalBatchCoins =
        data.gift.coinsCost * data.quantity * Math.max(1, data.recipientIds.length);
      if (
        data.gift.category !== 'lucky' &&
        Math.max(data.gift.coinsCost, totalBatchCoins) >= 5000
      ) {
        const recipientLabel =
          data.recipientNames.length > 1
            ? `الجميع على المايك (${data.recipientNames.length})`
            : data.recipientNames[0] || data.room.hostName;
        const globalPayload: GlobalRoyalGiftAnnouncement = {
          id: `groyal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          senderId: data.user.id,
          senderName: data.user.displayName,
          giftName: data.quantity > 1 ? `${data.gift.name} ×${data.quantity}` : data.gift.name,
          giftGlyph: data.gift.glyph,
          giftImageUrl: data.gift.imageUrl,
          recipientName: recipientLabel,
          roomId: data.room.id,
          roomTitle: data.room.title,
          totalCoins: totalBatchCoins,
          timestamp: new Date().toISOString(),
        };
        showGlobalRoyalGift(globalPayload);
        void globalChannelRef.current?.send({
          type: 'broadcast',
          event: 'global:royal-gift',
          payload: globalPayload,
        });
      }
    },
    [dispatchTieredGiftEffects, room, showGlobalRoyalGift, updateGiftSenderBalance, user]
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
        expiresAt: Date.now() + 3000,
      };

      setSeatEmojis((prev) => ({ ...prev, [user.id]: event }));
      setTimeout(() => {
        setSeatEmojis((prev) => {
          if (prev[user.id]?.id !== event.id) return prev;
          const copy = { ...prev };
          delete copy[user.id];
          return copy;
        });
      }, 3000);

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
      backgroundImage?: string;
      description?: string;
      title?: string;
      requireMicPermission?: boolean;
      agencyLockEnabled?: boolean;
      agencyLockPassword?: string;
    }) => {
      if (!room || !user) return;
      const updatedRoom = await updateRoomSettingsInSupabase(room.id, user, patch);
      setRoom(updatedRoom);
      if (
        typeof patch.requireMicPermission === 'boolean' ||
        patch.agencyLockEnabled !== undefined ||
        patch.agencyLockPassword !== undefined
      ) {
        setExtras(await getRoomExtrasFromSupabase(room.id));
      }
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
        | { type: 'temporary_kick_room'; targetUserId: string; targetName?: string }
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
      agencyQuiz?: RoomLiveContest['agencyQuiz'];
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

  const submitContestQuizAnswer = useCallback(
    async (answerIndex: number) => {
      if (!room || !user) return;
      const next = await submitRoomQuizAnswerInSupabase(room.id, user, answerIndex);
      setExtras(next);
      broadcastContest(next.activeContest || null);
    },
    [broadcastContest, room, user]
  );

  const advanceContestQuizQuestion = useCallback(async () => {
    if (!room || !user) return;
    const next = await advanceRoomQuizQuestionInSupabase(room.id, user);
    setExtras(next);
    broadcastContest(next.activeContest || null);
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
        vipLevel: g.vipLevel,
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
        exitModalOpen,
        setExitModalOpen,
        mySeat,
        canManage,
        isOwnerOrAdmin,
        micActive,
        micDenied,
        manualSpeakPulse,
        micRequest,
        micApprovedRequest,
        approveMicRequest,
        denyMicRequest,
        presenceMembers,
        liveListenersCount,
        topGifters,
        supportAndPlayLeaderboard,
        totalVolumeCoins,
        giftBanner,
        wheelBanner,
        entryBanner,
        flyingGifts,
        tier1SideNotices,
        mediumCelebrationGift,
        fullscreenGift,
        globalRoyalGift,
        dismissGlobalRoyalGift,
        adminAnnouncement,
        dismissAdminAnnouncement,
        broadcastAdminAnnouncement,
        seatGiftReactions,
        seatHaloEffects,
        seatEmojis,
        musicState: extras.musicState || null,
        musicVolume,
        musicMutedLocally,
        roomAudioMuted,
        effectsMuted,
        setMusicVolume,
        setMusicMutedLocally,
        setRoomAudioMuted,
        setEffectsMuted,
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
