import type {
  Agency,
  Competition,
  DeviceLock,
  FemaleVoiceVerificationRequest,
  PlatformSettings,
  PrivateMessage,
  Room,
  RoomMessage,
  SecurityLog,
  Transaction,
  UsdtDepositRequest,
  UsdtWithdrawalRequest,
  User,
} from '../types';
import {
  createDefaultPlatformSettings,
  INITIAL_APP_PRIZE_POOL_COINS,
  setCustomVipIdsCache,
  setCustomGiftsCatalog,
  setUserVipOverridesCache,
  SUPER_ADMIN_EMAIL,
  TEMP_ONLY_FRAME_IDS,
  type CulturalQuestionItem,
  type QuizSessionRecord,
} from './sadaCatalog';
import { safeGetItem, safeSetItem } from './safeStorage';
import { supabase } from './supabase';

export const USER_COLUMNS =
  'id, email, display_name, bio, avatar_url, gender, female_voice_status, female_verified, female_verified_badge, female_voice_note, is_host, is_agent, agency_id, host_badge, host_agency_name, host_diamonds_earned, referral_code, referred_by, referral_count, referral_spins, frame_id, unlocked_frames, previous_permanent_frame_id, temp_frame_id, temp_frame_expires_at, active_entry_id, active_entry_name, temp_entry_expires_at, svip_level, svip_expires_at, coins, diamonds, level, xp, is_admin, is_banned, device_uuid, created_at, last_seen';

export const ROOM_COLUMNS =
  'id, title, category, description, host_id, host_name, host_avatar, cover_url, avatar_url, background_url, cover_image, is_private, is_agency, password, max_seats, seats, listeners_count, is_active, total_gifts_coins, created_at';

export const ROOM_MESSAGE_COLUMNS =
  'id, room_id, user_id, display_name, level, is_admin, vip_tier, host_badge, female_verified_badge, text, type, timestamp';

export const PRIVATE_MESSAGE_COLUMNS =
  'id, conversation_id, sender_id, recipient_id, text, coins_paid, diamonds_potential, diamonds_claimed, diamonds_awarded, is_read, gift_id, gift_name, gift_glyph, created_at, replied_at';

export const TRANSACTION_COLUMNS =
  'id, user_id, type, amount, currency, description, timestamp';

export const AGENCY_COLUMNS =
  'id, name, description, code, owner_id, owner_name, owner_avatar, commission_rate, total_commission_diamonds, total_host_diamonds, host_ids, status, created_at';

export const COMPETITION_COLUMNS =
  'id, title, subtitle, category, prize_coins, prize_diamonds, banner_image, status, ends_at, winner_id, contestants';

export const QUESTION_COLUMNS =
  'id, category, question, options, correct_index, xp_reward, coins_reward';

export const DEPOSIT_COLUMNS =
  'id, user_id, user_email, user_display_name, amount_usdt, coins_credited, tx_id, proof_image, wallet_address, network, reward_tier_label, status, admin_note, created_at, reviewed_at';

export const WITHDRAWAL_COLUMNS =
  'id, user_id, user_email, user_display_name, user_role_label, source_currency, source_amount, amount_usdt, trc20_address, network, status, admin_note, created_at, reviewed_at';

export const FEMALE_VOICE_REQ_COLUMNS =
  'id, user_id, display_name, email, audio_data_url, duration_seconds, phrase, status, created_at, reviewed_at, admin_note';

export const DEVICE_LOCK_COLUMNS =
  'device_uuid, bound_user_id, bound_email, is_blocked, blocked_reason, created_at, last_attempt_at';

export const SECURITY_LOG_COLUMNS =
  'id, type, email, device_uuid, details, timestamp';

export const PLATFORM_STATE_COLUMNS =
  'id, app_prize_pool_coins, settings, quiz_sessions, voted_keys, ladder_sessions';

export interface PlatformStateDoc {
  appPrizePoolCoins: number;
  settings: PlatformSettings;
  quizSessions: Record<string, QuizSessionRecord>;
  votedKeys: Record<string, boolean>;
  ladderSessions: Record<string, { bet: number; step: number; currentMultiplier: number }>;
}

export function rowToUser(r: Record<string, unknown>): User {
  const email = String(r.email || '').toLowerCase();
  const isSuperAdmin = email === SUPER_ADMIN_EMAIL;
  const rawSvipLevel = Number(r.svip_level);
  const svipLevel = ([1, 2, 3, 4] as const).find((level) => level === rawSvipLevel) || null;
  return {
    id: String(r.id),
    email: String(r.email),
    displayName: String(r.display_name || 'عضو صَدَى'),
    bio: String(r.bio || ''),
    avatarUrl: String(r.avatar_url || 'host_male'),
    gender: r.gender === 'female' ? 'female' : 'male',
    femaleVoiceStatus:
      (r.female_voice_status as User['femaleVoiceStatus']) ||
      (r.gender === 'female' ? 'unverified' : 'none'),
    femaleVerified: Boolean(r.female_verified),
    femaleVerifiedBadge: (r.female_verified_badge as string | null) || null,
    femaleVoiceNote: (r.female_voice_note as string | null) || null,
    isHost: Boolean(r.is_host),
    isAgent: Boolean(r.is_agent),
    agencyId: (r.agency_id as string | null) || null,
    hostBadge: (r.host_badge as string | null) || null,
    hostAgencyName: (r.host_agency_name as string | null) || null,
    hostDiamondsEarned: Number(r.host_diamonds_earned || 0),
    referralCode: (r.referral_code as string | undefined) || undefined,
    referredBy: (r.referred_by as string | null) || null,
    referralCount: Number(r.referral_count || 0),
    referralSpins: Number(r.referral_spins || 0),
    frameId: String(r.frame_id || 'frame_obsidian'),
    unlockedFrames: Array.isArray(r.unlocked_frames)
      ? (r.unlocked_frames as string[])
      : ['frame_obsidian'],
    previousPermanentFrameId: (r.previous_permanent_frame_id as string | null) || null,
    tempFrameId: (r.temp_frame_id as string | null) || null,
    tempFrameExpiresAt: (r.temp_frame_expires_at as string | null) || null,
    activeEntryId: (r.active_entry_id as User['activeEntryId']) || null,
    activeEntryName: (r.active_entry_name as string | null) || null,
    tempEntryExpiresAt: (r.temp_entry_expires_at as string | null) || null,
    svipLevel,
    svipExpiresAt: (r.svip_expires_at as string | null) || null,
    coins: Number(r.coins || 0),
    diamonds: Number(r.diamonds || 0),
    level: Number(r.level || 1),
    xp: Number(r.xp || 0),
    role: isSuperAdmin
      ? 'admin'
      : typeof r.role === 'string' && r.role.trim()
      ? r.role.trim().toLowerCase()
      : 'user',
    is_admin: isSuperAdmin || String(r.role || '').trim().toLowerCase() === 'admin' || Boolean(r.is_admin),
    is_banned: isSuperAdmin ? false : Boolean(r.is_banned),
    device_uuid: String(r.device_uuid || ''),
    createdAt: String(r.created_at || new Date().toISOString()),
    lastSeen: String(r.last_seen || new Date().toISOString()),
  };
}

export function userToRow(u: User, passwordHash?: string) {
  const row: Record<string, unknown> = {
    id: u.id,
    email: u.email.toLowerCase(),
    display_name: u.displayName,
    bio: u.bio,
    avatar_url: u.avatarUrl,
    gender: u.gender || 'male',
    female_voice_status: u.femaleVoiceStatus || 'none',
    female_verified: Boolean(u.femaleVerified),
    female_verified_badge: u.femaleVerifiedBadge || null,
    female_voice_note: u.femaleVoiceNote || null,
    is_host: Boolean(u.isHost),
    is_agent: Boolean(u.isAgent),
    agency_id: u.agencyId || null,
    host_badge: u.hostBadge || null,
    host_agency_name: u.hostAgencyName || null,
    host_diamonds_earned: u.hostDiamondsEarned || 0,
    referral_code: u.referralCode || null,
    referred_by: u.referredBy || null,
    referral_count: u.referralCount || 0,
    referral_spins: u.referralSpins || 0,
    frame_id: u.frameId,
    unlocked_frames: u.unlockedFrames || ['frame_obsidian'],
    previous_permanent_frame_id: u.previousPermanentFrameId || null,
    temp_frame_id: u.tempFrameId || null,
    temp_frame_expires_at: u.tempFrameExpiresAt || null,
    active_entry_id: u.activeEntryId || null,
    active_entry_name: u.activeEntryName || null,
    temp_entry_expires_at: u.tempEntryExpiresAt || null,
    svip_level: u.svipLevel || null,
    svip_expires_at: u.svipExpiresAt || null,
    coins: u.coins,
    diamonds: u.diamonds,
    level: u.level,
    xp: u.xp,
    is_admin: u.email.toLowerCase() === SUPER_ADMIN_EMAIL || Boolean(u.is_admin),
    is_banned: Boolean(u.is_banned),
    device_uuid: u.device_uuid,
    created_at: u.createdAt,
    last_seen: u.lastSeen,
  };
  if (passwordHash !== undefined) {
    row.password_hash = passwordHash;
  }
  return row;
}

export function rowToRoomMessage(m: Record<string, unknown>): RoomMessage {
  const rawVipTier = (m.vip_tier as string | undefined) || undefined;
  const cleanVip = rawVipTier?.trim().toLowerCase();
  const parsedVipLevel =
    cleanVip === 'svip' || cleanVip === 'vip3' || cleanVip === 'vip2' || cleanVip === 'vip1'
      ? cleanVip
      : undefined;
  return {
    id: String(m.id),
    userId: String(m.user_id),
    displayName: String(m.display_name),
    level: Number(m.level || 1),
    isAdmin: Boolean(m.is_admin),
    vipTier: rawVipTier,
    vipLevel: parsedVipLevel,
    hostBadge: (m.host_badge as string | null) || null,
    femaleVerifiedBadge: (m.female_verified_badge as string | null) || null,
    text: String(m.text),
    type: (m.type as RoomMessage['type']) || 'chat',
    timestamp: String(m.timestamp),
  };
}

export function rowToRoom(
  r: Record<string, unknown>,
  messages: RoomMessage[] = []
): Room & { password?: string } {
  const pwd = r.password ? String(r.password) : undefined;
  const isAgency =
    typeof r.isAgency === 'boolean'
      ? r.isAgency
      : typeof r.is_agency === 'boolean'
      ? r.is_agency
      : undefined;
  return {
    id: String(r.id),
    isAgency,
    is_agency: isAgency,
    title: String(r.title),
    category: (r.category as Room['category']) || 'حوار',
    description: String(r.description || ''),
    hostId: String(r.host_id),
    hostName: String(r.host_name),
    hostAvatar: String(r.host_avatar),
    coverImage: String(r.cover_url || r.avatar_url || r.host_avatar || 'royal_stage'),
    backgroundImage: String(r.background_url || r.cover_image || 'dragon_dark'),
    isPrivate: Boolean(r.is_private),
    hasPassword: Boolean(pwd && pwd.length > 0),
    password: pwd,
    maxSeats: Number(r.max_seats || 8),
    seats: Array.isArray(r.seats) ? (r.seats as Room['seats']) : [],
    listenersCount: Number(r.listeners_count || 0),
    isActive: Boolean(r.is_active),
    totalGiftsCoins: Number(r.total_gifts_coins || 0),
    messages,
    createdAt: String(r.created_at),
  };
}

export function rowToPrivateMessage(pm: Record<string, unknown>): PrivateMessage {
  return {
    id: String(pm.id),
    conversationId: String(pm.conversation_id),
    senderId: String(pm.sender_id),
    recipientId: String(pm.recipient_id),
    text: String(pm.text),
    coinsPaid: Number(pm.coins_paid || 0),
    diamondsPotential: Number(pm.diamonds_potential || 0),
    diamondsClaimed: Boolean(pm.diamonds_claimed),
    diamondsAwarded: Number(pm.diamonds_awarded || 0),
    isRead: Boolean(pm.is_read),
    giftId: (pm.gift_id as string | undefined) || undefined,
    giftName: (pm.gift_name as string | undefined) || undefined,
    giftGlyph: (pm.gift_glyph as string | undefined) || undefined,
    createdAt: String(pm.created_at),
    repliedAt: (pm.replied_at as string | null) || null,
  };
}

export function rowToTransaction(t: Record<string, unknown>): Transaction {
  return {
    id: String(t.id),
    userId: String(t.user_id),
    type: t.type as Transaction['type'],
    amount: Number(t.amount || 0),
    currency: t.currency === 'diamonds' ? 'diamonds' : 'coins',
    description: String(t.description),
    timestamp: String(t.timestamp),
  };
}

export function rowToAgency(a: Record<string, unknown>): Agency {
  return {
    id: String(a.id),
    name: String(a.name),
    description: String(a.description || ''),
    code: String(a.code),
    ownerId: String(a.owner_id),
    ownerName: String(a.owner_name),
    ownerAvatar: String(a.owner_avatar),
    commissionRate: Number(a.commission_rate || 0.15),
    totalCommissionDiamonds: Number(a.total_commission_diamonds || 0),
    totalHostDiamonds: Number(a.total_host_diamonds || 0),
    hostIds: Array.isArray(a.host_ids) ? (a.host_ids as string[]) : [],
    status: (a.status as Agency['status']) || 'approved',
    createdAt: String(a.created_at),
  };
}

export function rowToCompetition(c: Record<string, unknown>): Competition {
  return {
    id: String(c.id),
    title: String(c.title),
    subtitle: String(c.subtitle || ''),
    category: String(c.category || 'تحدي الأصوات'),
    prizeCoins: Number(c.prize_coins || 0),
    prizeDiamonds: Number(c.prize_diamonds || 0),
    bannerImage: String(c.banner_image || 'competition_crest'),
    status: (c.status as Competition['status']) || 'live',
    endsAt: String(c.ends_at),
    winnerId: (c.winner_id as string | null) || null,
    contestants: Array.isArray(c.contestants) ? (c.contestants as Competition['contestants']) : [],
  };
}

export function rowToQuestion(q: Record<string, unknown>): CulturalQuestionItem {
  return {
    id: String(q.id),
    category: String(q.category),
    question: String(q.question),
    options: Array.isArray(q.options)
      ? (q.options as [string, string, string, string])
      : ['', '', '', ''],
    correctIndex: Number(q.correct_index || 0),
    xpReward: Number(q.xp_reward || 120),
    coinsReward: Number(q.coins_reward || 350),
  };
}

export function rowToDeposit(d: Record<string, unknown>): UsdtDepositRequest {
  return {
    id: String(d.id),
    userId: String(d.user_id),
    userEmail: String(d.user_email),
    userDisplayName: String(d.user_display_name),
    amountUsdt: Number(d.amount_usdt || 0),
    coinsCredited: Number(d.coins_credited || 0),
    txId: String(d.tx_id),
    proofImage: String(d.proof_image),
    walletAddress: String(d.wallet_address),
    network: 'TRC20',
    rewardTierLabel: (d.reward_tier_label as string | null) || null,
    status: (d.status as UsdtDepositRequest['status']) || 'pending',
    adminNote: (d.admin_note as string | null) || null,
    createdAt: String(d.created_at),
    reviewedAt: (d.reviewed_at as string | null) || null,
  };
}

export function rowToWithdrawal(w: Record<string, unknown>): UsdtWithdrawalRequest {
  return {
    id: String(w.id),
    userId: String(w.user_id),
    userEmail: String(w.user_email),
    userDisplayName: String(w.user_display_name),
    userRoleLabel: String(w.user_role_label),
    sourceCurrency: w.source_currency === 'coins' ? 'coins' : 'diamonds',
    sourceAmount: Number(w.source_amount || 0),
    amountUsdt: Number(w.amount_usdt || 0),
    trc20Address: String(w.trc20_address),
    network: 'TRC20',
    status: (w.status as UsdtWithdrawalRequest['status']) || 'pending',
    adminNote: (w.admin_note as string | null) || null,
    createdAt: String(w.created_at),
    reviewedAt: (w.reviewed_at as string | null) || null,
  };
}

export function rowToFemaleVoiceReq(
  f: Record<string, unknown>
): FemaleVoiceVerificationRequest {
  return {
    id: String(f.id),
    userId: String(f.user_id),
    displayName: String(f.display_name),
    email: String(f.email),
    audioDataUrl: String(f.audio_data_url),
    durationSeconds: Number(f.duration_seconds || 5),
    phrase: String(f.phrase || 'أهلاً بكم في تطبيق صَدَى'),
    status: (f.status as FemaleVoiceVerificationRequest['status']) || 'pending',
    createdAt: String(f.created_at),
    reviewedAt: (f.reviewed_at as string | null) || null,
    adminNote: (f.admin_note as string | null) || null,
  };
}

export function rowToDeviceLock(d: Record<string, unknown>): DeviceLock {
  return {
    device_uuid: String(d.device_uuid),
    boundUserId: String(d.bound_user_id),
    boundEmail: String(d.bound_email),
    isBlocked: Boolean(d.is_blocked),
    blockedReason: (d.blocked_reason as string | null) || null,
    createdAt: String(d.created_at),
    lastAttemptAt: String(d.last_attempt_at),
  };
}

export function rowToSecurityLog(l: Record<string, unknown>): SecurityLog {
  return {
    id: String(l.id),
    type: l.type as SecurityLog['type'],
    email: String(l.email),
    device_uuid: String(l.device_uuid),
    details: String(l.details),
    timestamp: String(l.timestamp),
  };
}

const PLATFORM_STATE_CACHE_KEY = 'sada_platform_state_cache_v1';
const PLATFORM_STATE_TTL_MS = 15_000;

let cachedPlatformState: PlatformStateDoc | null = null;
let cachedPlatformStateAt = 0;
let platformStateInFlight: Promise<PlatformStateDoc> | null = null;

function normalizePlatformState(
  appPrizePoolCoinsInput: unknown,
  rawSettingsInput: unknown,
  quizSessionsInput: unknown,
  votedKeysInput: unknown,
  ladderSessionsInput: unknown
): PlatformStateDoc {
  const defs = createDefaultPlatformSettings();
  const rawSettings =
    rawSettingsInput && typeof rawSettingsInput === 'object'
      ? (rawSettingsInput as Partial<PlatformSettings>)
      : {};

  return {
    appPrizePoolCoins: Number(appPrizePoolCoinsInput ?? INITIAL_APP_PRIZE_POOL_COINS),
    settings: {
      ...defs,
      ...rawSettings,
      gameRates: {
        ...defs.gameRates!,
        ...(rawSettings.gameRates || {}),
      },
      userFollows:
        rawSettings.userFollows && typeof rawSettings.userFollows === 'object'
          ? rawSettings.userFollows
          : {},
      userVisitors:
        rawSettings.userVisitors && typeof rawSettings.userVisitors === 'object'
          ? rawSettings.userVisitors
          : {},
      userMeta:
        rawSettings.userMeta && typeof rawSettings.userMeta === 'object'
          ? rawSettings.userMeta
          : {},
      userFollowedAgencies:
        rawSettings.userFollowedAgencies && typeof rawSettings.userFollowedAgencies === 'object'
          ? rawSettings.userFollowedAgencies
          : {},
      userOwnedBackgrounds:
        rawSettings.userOwnedBackgrounds && typeof rawSettings.userOwnedBackgrounds === 'object'
          ? rawSettings.userOwnedBackgrounds
          : {},
      userHostTasks:
        rawSettings.userHostTasks && typeof rawSettings.userHostTasks === 'object'
          ? rawSettings.userHostTasks
          : {},
      userGiftStats:
        rawSettings.userGiftStats && typeof rawSettings.userGiftStats === 'object'
          ? rawSettings.userGiftStats
          : {},
      hostJoinApplications: Array.isArray(rawSettings.hostJoinApplications)
        ? rawSettings.hostJoinApplications
        : [],
      pinnedRoomIds: Array.isArray(rawSettings.pinnedRoomIds)
        ? rawSettings.pinnedRoomIds
        : [],
      customGifts: Array.isArray(rawSettings.customGifts) ? rawSettings.customGifts : [],
      userVipOverrides:
        rawSettings.userVipOverrides && typeof rawSettings.userVipOverrides === 'object'
          ? rawSettings.userVipOverrides
          : {},
      latestAdminAnnouncement: rawSettings.latestAdminAnnouncement ?? null,
      globalZeroResetV1Applied: Boolean(rawSettings.globalZeroResetV1Applied),
      grandCompetition: {
        ...defs.grandCompetition!,
        ...(rawSettings.grandCompetition || {}),
      },
    },
    quizSessions: (quizSessionsInput as Record<string, QuizSessionRecord>) || {},
    votedKeys: (votedKeysInput as Record<string, boolean>) || {},
    ladderSessions: (ladderSessionsInput as PlatformStateDoc['ladderSessions']) || {},
  };
}

function syncSettingsSideCaches(settings: PlatformSettings) {
  setCustomVipIdsCache(settings.customVipIds || {});
  setCustomGiftsCatalog(settings.customGifts || []);
  setUserVipOverridesCache(settings.userVipOverrides || {});
}

function persistPlatformStateCache(doc: PlatformStateDoc) {
  cachedPlatformState = doc;
  cachedPlatformStateAt = Date.now();
  syncSettingsSideCaches(doc.settings);
  try {
    safeSetItem(
      PLATFORM_STATE_CACHE_KEY,
      JSON.stringify({
        appPrizePoolCoins: doc.appPrizePoolCoins,
        settings: doc.settings,
        cachedAt: cachedPlatformStateAt,
      })
    );
  } catch {
    // Ignore storage errors
  }
}

export function getCachedPlatformSettingsSync(): PlatformSettings {
  if (cachedPlatformState?.settings) return cachedPlatformState.settings;
  try {
    const raw = safeGetItem(PLATFORM_STATE_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { settings?: Partial<PlatformSettings> };
      if (parsed?.settings) {
        const normalized = normalizePlatformState(
          INITIAL_APP_PRIZE_POOL_COINS,
          parsed.settings,
          {},
          {},
          {}
        ).settings;
        syncSettingsSideCaches(normalized);
        return normalized;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return createDefaultPlatformSettings();
}

export async function getPlatformState(options?: {
  forceRefresh?: boolean;
}): Promise<PlatformStateDoc> {
  const now = Date.now();
  if (
    !options?.forceRefresh &&
    cachedPlatformState &&
    now - cachedPlatformStateAt < PLATFORM_STATE_TTL_MS
  ) {
    return cachedPlatformState;
  }

  if (!options?.forceRefresh && platformStateInFlight) {
    return platformStateInFlight;
  }

  platformStateInFlight = (async () => {
    try {
      const { data } = await supabase
        .from('sada_platform_state')
        .select(PLATFORM_STATE_COLUMNS)
        .eq('id', 'global')
        .maybeSingle();

      const normalized = normalizePlatformState(
        data?.app_prize_pool_coins,
        data?.settings,
        data?.quiz_sessions,
        data?.voted_keys,
        data?.ladder_sessions
      );
      persistPlatformStateCache(normalized);
      return normalized;
    } finally {
      platformStateInFlight = null;
    }
  })();

  return platformStateInFlight;
}

let zeroResetInFlight: Promise<void> | null = null;

export async function ensureGlobalZeroResetInSupabase(): Promise<void> {
  if (zeroResetInFlight) return zeroResetInFlight;

  zeroResetInFlight = (async () => {
    try {
      const state = await getPlatformState();
      if (state.settings.globalZeroResetV1Applied) return;

      // Zero all user & Super Admin balances/XP/levels/referrals
      await supabase
        .from('sada_users')
        .update({
          coins: 0,
          diamonds: 0,
          xp: 0,
          level: 1,
          host_diamonds_earned: 0,
          referral_count: 0,
          referral_spins: 0,
        })
        .neq('id', '');

      // Clear old transaction history so support/gift levels start at 0
      await supabase.from('sada_transactions').delete().neq('id', '');

      // Zero room gift totals and seat receivedDiamonds
      const { data: roomRows } = await supabase
        .from('sada_rooms')
        .select('id, seats');
      for (const r of roomRows || []) {
        const seats = Array.isArray(r.seats)
          ? (r.seats as Array<Record<string, unknown>>).map((s) => ({
              ...s,
              receivedDiamonds: 0,
            }))
          : [];
        await supabase
          .from('sada_rooms')
          .update({ total_gifts_coins: 0, seats })
          .eq('id', r.id);
      }

      // Reset roomConfigs gifters/players/playVolumeCoins
      const cleanedRoomConfigs: NonNullable<PlatformSettings['roomConfigs']> = {};
      for (const [rid, cfg] of Object.entries(state.settings.roomConfigs || {})) {
        cleanedRoomConfigs[rid] = {
          ...cfg,
          gifters: {},
          players: {},
          playVolumeCoins: 0,
        };
      }

      await savePlatformState({
        settings: {
          ...state.settings,
          userFollows: {},
          userVisitors: {},
          userGiftStats: {},
          userHostTasks: {},
          roomConfigs: cleanedRoomConfigs,
          globalZeroResetV1Applied: true,
        },
      });
    } catch {
      // ignore transient error; will retry on next session load if flag not persisted
    } finally {
      zeroResetInFlight = null;
    }
  })();

  return zeroResetInFlight;
}

export async function savePlatformState(patch: Partial<PlatformStateDoc>): Promise<PlatformStateDoc> {
  const current = await getPlatformState({ forceRefresh: true });
  const next: PlatformStateDoc = {
    appPrizePoolCoins: patch.appPrizePoolCoins ?? current.appPrizePoolCoins,
    settings: patch.settings ?? current.settings,
    quizSessions: patch.quizSessions ?? current.quizSessions,
    votedKeys: patch.votedKeys ?? current.votedKeys,
    ladderSessions: patch.ladderSessions ?? current.ladderSessions,
  };
  const { error } = await supabase.from('sada_platform_state').upsert(
    {
      id: 'global',
      app_prize_pool_coins: next.appPrizePoolCoins,
      settings: next.settings,
      quiz_sessions: next.quizSessions,
      voted_keys: next.votedKeys,
      ladder_sessions: next.ladderSessions,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
  persistPlatformStateCache(next);
  return next;
}

export async function purgeExpiredRewardsOnUser(user: User): Promise<boolean> {
  let changed = false;
  const nowMs = Date.now();

  if (user.tempFrameExpiresAt && nowMs >= new Date(user.tempFrameExpiresAt).getTime()) {
    const expiredFrameId = user.tempFrameId || user.frameId;
    user.unlockedFrames = user.unlockedFrames.filter((fid) => !TEMP_ONLY_FRAME_IDS.has(fid));
    if (expiredFrameId && TEMP_ONLY_FRAME_IDS.has(user.frameId)) {
      const fallback =
        user.previousPermanentFrameId &&
        !TEMP_ONLY_FRAME_IDS.has(user.previousPermanentFrameId) &&
        user.unlockedFrames.includes(user.previousPermanentFrameId)
          ? user.previousPermanentFrameId
          : 'frame_obsidian';
      user.frameId = fallback;
    } else if (!user.unlockedFrames.includes(user.frameId)) {
      user.frameId = 'frame_obsidian';
    }
    user.tempFrameExpiresAt = null;
    user.tempFrameId = null;
    changed = true;
  }

  if (user.tempEntryExpiresAt && nowMs >= new Date(user.tempEntryExpiresAt).getTime()) {
    user.activeEntryId = null;
    user.activeEntryName = null;
    user.tempEntryExpiresAt = null;
    changed = true;
  }

  if (changed) {
    await supabase
      .from('sada_users')
      .update({
        frame_id: user.frameId,
        unlocked_frames: user.unlockedFrames,
        temp_frame_id: user.tempFrameId,
        temp_frame_expires_at: user.tempFrameExpiresAt,
        active_entry_id: user.activeEntryId,
        active_entry_name: user.activeEntryName,
        temp_entry_expires_at: user.tempEntryExpiresAt,
      })
      .eq('id', user.id);
  }
  return changed;
}

export async function recordTransaction(tx: Omit<Transaction, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) {
  const row = {
    id: tx.id || `tx_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-3)}`,
    user_id: tx.userId,
    type: tx.type,
    amount: tx.amount,
    currency: tx.currency,
    description: tx.description,
    timestamp: tx.timestamp || new Date().toISOString(),
  };
  const { error } = await supabase.from('sada_transactions').insert(row);
  if (error) throw new Error(error.message);
  return row;
}

export async function applyHostEarningsAndAgencyCommission(
  hostUser: User,
  diamondsEarned: number,
  now: string
): Promise<number> {
  if (diamondsEarned <= 0) return 0;
  const nextHostDiamonds = (hostUser.hostDiamondsEarned || 0) + diamondsEarned;
  const { error: hostUpdateError } = await supabase
    .from('sada_users')
    .update({ host_diamonds_earned: nextHostDiamonds })
    .eq('id', hostUser.id);
  if (hostUpdateError) {
    throw new Error(`تعذّر تحديث رصيد ألماس المضيف: ${hostUpdateError.message}`);
  }
  hostUser.hostDiamondsEarned = nextHostDiamonds;

  await recordTransaction({
    userId: hostUser.id,
    type: 'host_earning',
    amount: diamondsEarned,
    currency: 'diamonds',
    description: 'ألماس مكتسب من هدايا ورسائل صَدَى',
    timestamp: now,
  });

  if (!hostUser.agencyId) return 0;

  const { data: agencyRow, error: agencyLoadError } = await supabase
    .from('sada_agencies')
    .select('id, owner_id, status, total_host_diamonds')
    .eq('id', hostUser.agencyId)
    .maybeSingle();

  if (agencyLoadError) {
    throw new Error(`تعذّر تحميل وكالة المضيف: ${agencyLoadError.message}`);
  }
  if (!agencyRow || agencyRow.status === 'suspended') return 0;
  const ownerId = String(agencyRow.owner_id);
  if (ownerId === hostUser.id) return 0;

  const { error: agencyUpdateError } = await supabase
    .from('sada_agencies')
    .update({
      total_host_diamonds: Number(agencyRow.total_host_diamonds || 0) + diamondsEarned,
    })
    .eq('id', agencyRow.id);
  if (agencyUpdateError) {
    throw new Error(`تعذّر تحديث إجمالي ألماس الوكالة: ${agencyUpdateError.message}`);
  }

  return 0;
}
