import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Agency,
  Competition,
  DeviceLock,
  FemaleVoiceVerificationRequest,
  GiftItem,
  PlatformSettings,
  PrivateMessage,
  RoomMessage,
  SecurityLog,
  Transaction,
  UsdtDepositRequest,
  UsdtWithdrawalRequest,
} from '../src/types';
import type {
  CulturalQuestionItem,
  QuizSessionRecord,
  SadaDatabase,
  SessionRecord,
  StoredRoom,
  StoredUser,
} from './db';

let supabaseInstance: SupabaseClient | null = null;
let supabaseReady = false;
let supabaseSchemaMissing = false;
let lastSyncError: string | null = null;
let lastSyncAt: string | null = null;

export function getSupabaseConfig() {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  ).trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();
  return { url, key };
}

export function getSupabaseServerClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;
  supabaseInstance = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseInstance;
}

export function getSupabaseSyncStatus() {
  const { url } = getSupabaseConfig();
  return {
    configured: Boolean(url),
    url,
    connected: supabaseReady,
    schemaMissing: supabaseSchemaMissing,
    lastSyncAt,
    lastSyncError,
  };
}

function userToRow(u: StoredUser) {
  return {
    id: u.id,
    email: u.email,
    password_hash: u.passwordHash,
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
    coins: u.coins,
    diamonds: u.diamonds,
    level: u.level,
    xp: u.xp,
    is_admin: Boolean(u.is_admin),
    is_banned: Boolean(u.is_banned),
    device_uuid: u.device_uuid,
    created_at: u.createdAt,
    last_seen: u.lastSeen,
  };
}

function rowToUser(r: Record<string, unknown>): StoredUser {
  return {
    id: String(r.id),
    email: String(r.email),
    passwordHash: String(r.password_hash),
    displayName: String(r.display_name),
    bio: String(r.bio || ''),
    avatarUrl: String(r.avatar_url || 'host_male'),
    gender: (r.gender === 'female' ? 'female' : 'male'),
    femaleVoiceStatus: (r.female_voice_status as StoredUser['femaleVoiceStatus']) || 'none',
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
    activeEntryId: (r.active_entry_id as StoredUser['activeEntryId']) || null,
    activeEntryName: (r.active_entry_name as string | null) || null,
    tempEntryExpiresAt: (r.temp_entry_expires_at as string | null) || null,
    coins: Number(r.coins || 0),
    diamonds: Number(r.diamonds || 0),
    level: Number(r.level || 1),
    xp: Number(r.xp || 0),
    is_admin: Boolean(r.is_admin),
    is_banned: Boolean(r.is_banned),
    device_uuid: String(r.device_uuid || ''),
    createdAt: String(r.created_at),
    lastSeen: String(r.last_seen),
  };
}

function isMissingTableErr(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === 'PGRST205' ||
    err.code === '42P01' ||
    (err.message || '').includes('schema cache') ||
    (err.message || '').includes('does not exist')
  );
}

async function upsertInBatches(
  sb: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict = 'id'
) {
  if (rows.length === 0) return;
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await sb.from(table).upsert(chunk as never, { onConflict });
    if (error) throw error;
  }
}

export async function pushDatabaseToSupabase(
  db: SadaDatabase,
  giftCatalog: GiftItem[]
): Promise<boolean> {
  const sb = getSupabaseServerClient();
  if (!sb) return false;

  try {
    await upsertInBatches(
      sb,
      'sada_users',
      db.users.map(userToRow)
    );

    const sessionRows = Object.values(db.sessions).map((s) => ({
      token: s.token,
      user_id: s.userId,
      created_at: s.createdAt,
    }));
    await upsertInBatches(sb, 'sada_sessions', sessionRows, 'token');

    // Prune stale sessions in Supabase that no longer exist in active db.sessions
    const { data: existingSessions } = await sb.from('sada_sessions').select('token');
    if (existingSessions && existingSessions.length > 0) {
      const activeSet = new Set(Object.keys(db.sessions));
      const stale = existingSessions
        .map((r) => String(r.token))
        .filter((t) => !activeSet.has(t));
      if (stale.length > 0) {
        await sb.from('sada_sessions').delete().in('token', stale);
      }
    }

    await upsertInBatches(
      sb,
      'sada_device_locks',
      Object.values(db.deviceLocks).map((d) => ({
        device_uuid: d.device_uuid,
        bound_user_id: d.boundUserId,
        bound_email: d.boundEmail,
        is_blocked: Boolean(d.isBlocked),
        blocked_reason: d.blockedReason || null,
        created_at: d.createdAt,
        last_attempt_at: d.lastAttemptAt,
      })),
      'device_uuid'
    );

    await upsertInBatches(
      sb,
      'sada_security_logs',
      db.securityLogs.slice(0, 150).map((l) => ({
        id: l.id,
        type: l.type,
        email: l.email,
        device_uuid: l.device_uuid,
        details: l.details,
        timestamp: l.timestamp,
      }))
    );

    await upsertInBatches(
      sb,
      'sada_rooms',
      db.rooms.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        description: r.description,
        host_id: r.hostId,
        host_name: r.hostName,
        host_avatar: r.hostAvatar,
        cover_url: r.coverImage,
        background_url: r.backgroundImage,
        cover_image: r.backgroundImage,
        is_private: Boolean(r.isPrivate),
        password: r.password || null,
        max_seats: r.maxSeats,
        seats: r.seats,
        listeners_count: r.listenersCount,
        is_active: Boolean(r.isActive),
        total_gifts_coins: r.totalGiftsCoins,
        created_at: r.createdAt,
      }))
    );

    const roomMsgRows = db.rooms.flatMap((r) =>
      r.messages.map((m) => ({
        id: m.id,
        room_id: r.id,
        user_id: m.userId,
        display_name: m.displayName,
        level: m.level,
        is_admin: Boolean(m.isAdmin),
        vip_tier: m.vipTier || null,
        host_badge: m.hostBadge || null,
        female_verified_badge: m.femaleVerifiedBadge || null,
        text: m.text,
        type: m.type,
        timestamp: m.timestamp,
      }))
    );
    await upsertInBatches(sb, 'sada_room_messages', roomMsgRows);

    await upsertInBatches(
      sb,
      'sada_private_messages',
      db.privateMessages.map((pm) => ({
        id: pm.id,
        conversation_id: pm.conversationId,
        sender_id: pm.senderId,
        recipient_id: pm.recipientId,
        text: pm.text,
        coins_paid: pm.coinsPaid,
        diamonds_potential: pm.diamondsPotential,
        diamonds_claimed: Boolean(pm.diamondsClaimed),
        diamonds_awarded: pm.diamondsAwarded,
        gift_id: pm.giftId || null,
        gift_name: pm.giftName || null,
        gift_glyph: pm.giftGlyph || null,
        created_at: pm.createdAt,
        replied_at: pm.repliedAt || null,
      }))
    );

    await upsertInBatches(
      sb,
      'sada_gifts',
      giftCatalog.map((g) => ({
        id: g.id,
        name: g.name,
        coins_cost: g.coinsCost,
        diamonds_value: g.diamondsValue,
        xp_gain: g.xpGain,
        tier: g.tier,
        category: g.category || 'fixed',
        glyph: g.glyph,
      }))
    );

    await upsertInBatches(
      sb,
      'sada_transactions',
      db.transactions.slice(0, 300).map((t) => ({
        id: t.id,
        user_id: t.userId,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        description: t.description,
        timestamp: t.timestamp,
      }))
    );

    await upsertInBatches(
      sb,
      'sada_agencies',
      db.agencies.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        code: a.code,
        owner_id: a.ownerId,
        owner_name: a.ownerName,
        owner_avatar: a.ownerAvatar,
        commission_rate: a.commissionRate,
        total_commission_diamonds: a.totalCommissionDiamonds,
        total_host_diamonds: a.totalHostDiamonds,
        host_ids: a.hostIds,
        status: a.status || 'approved',
        created_at: a.createdAt,
      }))
    );

    await upsertInBatches(
      sb,
      'sada_competitions',
      db.competitions.map((c) => ({
        id: c.id,
        title: c.title,
        subtitle: c.subtitle,
        category: c.category || 'تحدي الأصوات',
        prize_coins: c.prizeCoins,
        prize_diamonds: c.prizeDiamonds,
        banner_image: c.bannerImage || 'competition_crest',
        status: c.status,
        ends_at: c.endsAt,
        winner_id: c.winnerId || null,
        contestants: c.contestants,
      }))
    );

    await upsertInBatches(
      sb,
      'sada_cultural_questions',
      db.culturalQuestions.map((q) => ({
        id: q.id,
        category: q.category,
        question: q.question,
        options: q.options,
        correct_index: q.correctIndex,
        xp_reward: q.xpReward,
        coins_reward: q.coinsReward,
      }))
    );

    // Prune deleted questions if admin replaced question bank
    const { data: existingQs } = await sb.from('sada_cultural_questions').select('id');
    if (existingQs && existingQs.length > 0) {
      const qIds = new Set(db.culturalQuestions.map((q) => q.id));
      const deletedQs = existingQs.map((r) => String(r.id)).filter((id) => !qIds.has(id));
      if (deletedQs.length > 0) {
        await sb.from('sada_cultural_questions').delete().in('id', deletedQs);
      }
    }

    await upsertInBatches(
      sb,
      'sada_usdt_deposits',
      db.usdtDeposits.map((d) => ({
        id: d.id,
        user_id: d.userId,
        user_email: d.userEmail,
        user_display_name: d.userDisplayName,
        amount_usdt: d.amountUsdt,
        coins_credited: d.coinsCredited,
        tx_id: d.txId,
        proof_image: d.proofImage,
        wallet_address: d.walletAddress,
        network: d.network,
        reward_tier_label: d.rewardTierLabel || null,
        status: d.status,
        admin_note: d.adminNote || null,
        created_at: d.createdAt,
        reviewed_at: d.reviewedAt || null,
      }))
    );

    await upsertInBatches(
      sb,
      'sada_usdt_withdrawals',
      db.usdtWithdrawals.map((w) => ({
        id: w.id,
        user_id: w.userId,
        user_email: w.userEmail,
        user_display_name: w.userDisplayName,
        user_role_label: w.userRoleLabel,
        source_currency: w.sourceCurrency,
        source_amount: w.sourceAmount,
        amount_usdt: w.amountUsdt,
        trc20_address: w.trc20Address,
        network: w.network,
        status: w.status,
        admin_note: w.adminNote || null,
        created_at: w.createdAt,
        reviewed_at: w.reviewedAt || null,
      }))
    );

    await upsertInBatches(
      sb,
      'sada_female_voice_requests',
      (db.femaleVoiceRequests || []).map((fvr) => ({
        id: fvr.id,
        user_id: fvr.userId,
        display_name: fvr.displayName,
        email: fvr.email,
        audio_data_url: fvr.audioDataUrl,
        duration_seconds: fvr.durationSeconds,
        phrase: fvr.phrase,
        status: fvr.status,
        created_at: fvr.createdAt,
        reviewed_at: fvr.reviewedAt || null,
        admin_note: fvr.adminNote || null,
      }))
    );

    const { error: stateErr } = await sb.from('sada_platform_state').upsert(
      {
        id: 'global',
        app_prize_pool_coins: db.appPrizePoolCoins,
        settings: db.settings,
        quiz_sessions: db.quizSessions,
        voted_keys: db.votedKeys,
        ladder_sessions: db.ladderSessions || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (stateErr) throw stateErr;

    supabaseReady = true;
    supabaseSchemaMissing = false;
    lastSyncError = null;
    lastSyncAt = new Date().toISOString();
    return true;
  } catch (err) {
    const typedErr = err as { code?: string; message?: string };
    if (isMissingTableErr(typedErr)) {
      supabaseReady = false;
      supabaseSchemaMissing = true;
      lastSyncError = 'بانتظار تنفيذ كود SQL الجداول في Supabase SQL Editor.';
    } else {
      lastSyncError = typedErr?.message || String(err);
    }
    return false;
  }
}

export async function loadDatabaseFromSupabase(
  defaults: {
    defaultSettings: PlatformSettings;
    defaultQuestions: CulturalQuestionItem[];
    initialPoolCoins: number;
  }
): Promise<SadaDatabase | null> {
  const sb = getSupabaseServerClient();
  if (!sb) return null;

  try {
    const { data: userRows, error: userErr } = await sb.from('sada_users').select('*');
    if (userErr) {
      if (isMissingTableErr(userErr)) {
        supabaseReady = false;
        supabaseSchemaMissing = true;
        lastSyncError = 'بانتظار تنفيذ كود SQL الجداول في Supabase SQL Editor.';
      } else {
        lastSyncError = userErr.message;
      }
      return null;
    }

    supabaseReady = true;
    supabaseSchemaMissing = false;
    lastSyncError = null;

    // Schema exists, but database is fresh (0 users) -> caller will seed Supabase
    if (!userRows || userRows.length === 0) {
      return null;
    }

    const [
      sessionsRes,
      locksRes,
      logsRes,
      roomsRes,
      roomMsgsRes,
      pmRes,
      txRes,
      agenciesRes,
      compRes,
      qRes,
      depRes,
      wdRes,
      fvrRes,
      stateRes,
    ] = await Promise.all([
      sb.from('sada_sessions').select('*'),
      sb.from('sada_device_locks').select('*'),
      sb.from('sada_security_logs').select('*').order('timestamp', { ascending: false }).limit(150),
      sb.from('sada_rooms').select('*').order('created_at', { ascending: false }),
      sb.from('sada_room_messages').select('*').order('timestamp', { ascending: true }),
      sb.from('sada_private_messages').select('*').order('created_at', { ascending: true }),
      sb.from('sada_transactions').select('*').order('timestamp', { ascending: false }).limit(300),
      sb.from('sada_agencies').select('*'),
      sb.from('sada_competitions').select('*'),
      sb.from('sada_cultural_questions').select('*'),
      sb.from('sada_usdt_deposits').select('*').order('created_at', { ascending: false }),
      sb.from('sada_usdt_withdrawals').select('*').order('created_at', { ascending: false }),
      sb.from('sada_female_voice_requests').select('*').order('created_at', { ascending: false }),
      sb.from('sada_platform_state').select('*').eq('id', 'global').maybeSingle(),
    ]);

    const sessions: Record<string, SessionRecord> = {};
    for (const s of sessionsRes.data || []) {
      sessions[String(s.token)] = {
        token: String(s.token),
        userId: String(s.user_id),
        createdAt: String(s.created_at),
      };
    }

    const deviceLocks: Record<string, DeviceLock> = {};
    for (const d of locksRes.data || []) {
      deviceLocks[String(d.device_uuid)] = {
        device_uuid: String(d.device_uuid),
        boundUserId: String(d.bound_user_id),
        boundEmail: String(d.bound_email),
        isBlocked: Boolean(d.is_blocked),
        blockedReason: (d.blocked_reason as string | null) || null,
        createdAt: String(d.created_at),
        lastAttemptAt: String(d.last_attempt_at),
      };
    }

    const securityLogs: SecurityLog[] = (logsRes.data || []).map((l) => ({
      id: String(l.id),
      type: l.type as SecurityLog['type'],
      email: String(l.email),
      device_uuid: String(l.device_uuid),
      details: String(l.details),
      timestamp: String(l.timestamp),
    }));

    const msgsByRoom = new Map<string, RoomMessage[]>();
    for (const m of roomMsgsRes.data || []) {
      const rid = String(m.room_id);
      const list = msgsByRoom.get(rid) || [];
      list.push({
        id: String(m.id),
        userId: String(m.user_id),
        displayName: String(m.display_name),
        level: Number(m.level || 1),
        isAdmin: Boolean(m.is_admin),
        vipTier: (m.vip_tier as string | undefined) || undefined,
        hostBadge: (m.host_badge as string | null) || null,
        femaleVerifiedBadge: (m.female_verified_badge as string | null) || null,
        text: String(m.text),
        type: (m.type as RoomMessage['type']) || 'chat',
        timestamp: String(m.timestamp),
      });
      msgsByRoom.set(rid, list);
    }

    const rooms: StoredRoom[] = (roomsRes.data || []).map((r) => ({
      id: String(r.id),
      title: String(r.title),
      category: (r.category as StoredRoom['category']) || 'حوار',
      description: String(r.description || ''),
      hostId: String(r.host_id),
      hostName: String(r.host_name),
      hostAvatar: String(r.host_avatar),
      coverImage: String(r.cover_url || r.avatar_url || r.host_avatar || 'royal_stage'),
      backgroundImage: String(r.background_url || r.cover_image || 'dragon_dark'),
      isPrivate: Boolean(r.is_private),
      password: r.password ? String(r.password) : undefined,
      maxSeats: Number(r.max_seats || 8),
      seats: Array.isArray(r.seats) ? r.seats : [],
      listenersCount: Number(r.listeners_count || 0),
      isActive: Boolean(r.is_active),
      totalGiftsCoins: Number(r.total_gifts_coins || 0),
      createdAt: String(r.created_at),
      messages: msgsByRoom.get(String(r.id)) || [],
    }));

    const privateMessages: PrivateMessage[] = (pmRes.data || []).map((pm) => ({
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
    }));

    const transactions: Transaction[] = (txRes.data || []).map((t) => ({
      id: String(t.id),
      userId: String(t.user_id),
      type: t.type as Transaction['type'],
      amount: Number(t.amount || 0),
      currency: (t.currency === 'diamonds' ? 'diamonds' : 'coins'),
      description: String(t.description),
      timestamp: String(t.timestamp),
    }));

    const agencies: Agency[] = (agenciesRes.data || []).map((a) => ({
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
    }));

    const competitions: Competition[] = (compRes.data || []).map((c) => ({
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
      contestants: Array.isArray(c.contestants) ? c.contestants : [],
    }));

    const culturalQuestions: CulturalQuestionItem[] =
      (qRes.data || []).length > 0
        ? (qRes.data || []).map((q) => ({
            id: String(q.id),
            category: String(q.category),
            question: String(q.question),
            options: Array.isArray(q.options)
              ? (q.options as [string, string, string, string])
              : ['', '', '', ''],
            correctIndex: Number(q.correct_index || 0),
            xpReward: Number(q.xp_reward || 120),
            coinsReward: Number(q.coins_reward || 350),
          }))
        : defaults.defaultQuestions.map((q) => ({ ...q }));

    const usdtDeposits: UsdtDepositRequest[] = (depRes.data || []).map((d) => ({
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
    }));

    const usdtWithdrawals: UsdtWithdrawalRequest[] = (wdRes.data || []).map((w) => ({
      id: String(w.id),
      userId: String(w.user_id),
      userEmail: String(w.user_email),
      userDisplayName: String(w.user_display_name),
      userRoleLabel: String(w.user_role_label),
      sourceCurrency: (w.source_currency === 'coins' ? 'coins' : 'diamonds'),
      sourceAmount: Number(w.source_amount || 0),
      amountUsdt: Number(w.amount_usdt || 0),
      trc20Address: String(w.trc20_address),
      network: 'TRC20',
      status: (w.status as UsdtWithdrawalRequest['status']) || 'pending',
      adminNote: (w.admin_note as string | null) || null,
      createdAt: String(w.created_at),
      reviewedAt: (w.reviewed_at as string | null) || null,
    }));

    const femaleVoiceRequests: FemaleVoiceVerificationRequest[] = (fvrRes.data || []).map((f) => ({
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
    }));

    const stateRow = stateRes.data;
    const rawSettings =
      stateRow?.settings && typeof stateRow.settings === 'object'
        ? (stateRow.settings as Partial<PlatformSettings>)
        : {};
    const mergedSettings: PlatformSettings = {
      ...defaults.defaultSettings,
      ...rawSettings,
      gameRates: {
        ...defaults.defaultSettings.gameRates!,
        ...(rawSettings.gameRates || {}),
      },
    };

    lastSyncAt = new Date().toISOString();

    return {
      users: userRows.map(rowToUser),
      deviceLocks,
      securityLogs,
      rooms,
      competitions,
      transactions,
      privateMessages,
      agencies,
      appPrizePoolCoins: Number(stateRow?.app_prize_pool_coins ?? defaults.initialPoolCoins),
      quizSessions:
        (stateRow?.quiz_sessions as Record<string, QuizSessionRecord>) || {},
      culturalQuestions,
      settings: mergedSettings,
      usdtDeposits,
      usdtWithdrawals,
      femaleVoiceRequests,
      sessions,
      votedKeys: (stateRow?.voted_keys as Record<string, boolean>) || {},
      ladderSessions:
        (stateRow?.ladder_sessions as SadaDatabase['ladderSessions']) || {},
    };
  } catch (err) {
    lastSyncError = err instanceof Error ? err.message : String(err);
    return null;
  }
}

let syncChain: Promise<void> = Promise.resolve();

export function queueSupabaseSync(db: SadaDatabase, giftCatalog: GiftItem[]) {
  const sb = getSupabaseServerClient();
  if (!sb) return;

  // Clone lightweight snapshot safely via JSON so concurrent mutations do not corrupt mid-flight upserts
  const snapshot = JSON.parse(JSON.stringify(db)) as SadaDatabase;
  syncChain = syncChain
    .then(async () => {
      await pushDatabaseToSupabase(snapshot, giftCatalog);
    })
    .catch(() => {});
}
