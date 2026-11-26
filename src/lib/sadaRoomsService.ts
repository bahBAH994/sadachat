import type {
  GiftItem,
  LuckyWheelResult,
  LuckyWheelSegment,
  Room,
  RoomEntryEvent,
  RoomExtrasConfig,
  RoomLiveContest,
  RoomMessage,
  RoomModLogActionType,
  RoomModLogEntry,
  RoomMusicState,
  User,
} from '../types';
import {
  computeLevelFromXp,
  findGiftById,
  genId,
  getCachedGiftCatalog,
  getUserVipTierInfo,
  getVipTierLabel,
  isFemaleVoiceLocked,
  makeEmptySeats,
  rollLuckyGiftMultiplier,
  STORE_LUXURY_BACKGROUNDS,
} from './sadaCatalog';
import {
  applyHostEarningsAndAgencyCommission,
  getPlatformState,
  purgeExpiredRewardsOnUser,
  recordTransaction,
  ROOM_COLUMNS,
  ROOM_MESSAGE_COLUMNS,
  rowToRoom,
  rowToRoomMessage,
  rowToUser,
  savePlatformState,
  USER_COLUMNS,
} from './sadaMappers';
import { enrichUserWithVipTotals, invalidateUserVipCache } from './sadaVipService';
import { supabase } from './supabase';

export function createEmptyRoomExtras(): RoomExtrasConfig {
  return {
    deputyIds: [],
    moderatorIds: [],
    requireMicPermission: false,
    agencyLockEnabled: false,
    agencyLockPassword: '',
    kickedUserIds: [],
    kickedUserNames: {},
    temporaryKickExpiresAt: {},
    mutedUserIds: [],
    gifters: {},
    players: {},
    modLogs: [],
    playVolumeCoins: 0,
    musicState: null,
    activeContest: null,
  };
}

export async function getRoomExtrasFromSupabase(
  roomId: string,
  options?: { forceRefresh?: boolean }
): Promise<RoomExtrasConfig> {
  const state = await getPlatformState(options);
  const raw = state.settings.roomConfigs?.[roomId];
  const base = createEmptyRoomExtras();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    requireMicPermission: raw.requireMicPermission === true,
    agencyLockEnabled: raw.agencyLockEnabled === true,
    agencyLockPassword:
      typeof raw.agencyLockPassword === 'string' ? raw.agencyLockPassword : '',
    deputyIds: Array.isArray(raw.deputyIds) ? raw.deputyIds : [],
    moderatorIds: Array.isArray(raw.moderatorIds) ? raw.moderatorIds : [],
    kickedUserIds: Array.isArray(raw.kickedUserIds) ? raw.kickedUserIds : [],
    kickedUserNames:
      raw.kickedUserNames && typeof raw.kickedUserNames === 'object' ? raw.kickedUserNames : {},
    temporaryKickExpiresAt:
      raw.temporaryKickExpiresAt && typeof raw.temporaryKickExpiresAt === 'object'
        ? raw.temporaryKickExpiresAt
        : {},
    mutedUserIds: Array.isArray(raw.mutedUserIds) ? raw.mutedUserIds : [],
    gifters: raw.gifters && typeof raw.gifters === 'object' ? raw.gifters : {},
    players: raw.players && typeof raw.players === 'object' ? raw.players : {},
    modLogs: Array.isArray(raw.modLogs) ? raw.modLogs : [],
    playVolumeCoins: Number(raw.playVolumeCoins || 0),
    musicState: raw.musicState || null,
    activeContest: raw.activeContest || null,
  };
}

function resolveActorRoleLabel(
  hostId: string,
  extras: RoomExtrasConfig,
  actor: Pick<User, 'id' | 'is_admin'>
): string {
  if (actor.id === hostId) return 'الوكيل';
  if (actor.is_admin) return 'إدارة المنصة';
  if (extras.deputyIds.includes(actor.id)) return 'نائب الوكيل';
  if (extras.moderatorIds.includes(actor.id)) return 'مشرف';
  return 'عضو';
}

function prependModLog(
  cur: RoomExtrasConfig,
  entry: {
    actorId: string;
    actorName: string;
    actorRole: string;
    actionType: RoomModLogActionType;
    targetUserId?: string;
    targetName?: string;
    details: string;
  }
): RoomModLogEntry[] {
  const existing = Array.isArray(cur.modLogs) ? cur.modLogs : [];
  const nextEntry: RoomModLogEntry = {
    id: genId('modlog'),
    actorId: entry.actorId,
    actorName: entry.actorName,
    actorRole: entry.actorRole,
    actionType: entry.actionType,
    targetUserId: entry.targetUserId,
    targetName: entry.targetName,
    details: entry.details,
    timestamp: new Date().toISOString(),
  };
  return [nextEntry, ...existing].slice(0, 120);
}

async function saveRoomExtrasConfig(
  roomId: string,
  updater: (current: RoomExtrasConfig) => RoomExtrasConfig,
  giftStatIncrement?: {
    senderId: string;
    senderCoinsDelta: number;
    recipientIds: string[];
    recipientCoinsEach: number;
  }
): Promise<RoomExtrasConfig> {
  const state = await getPlatformState();
  const configs = { ...(state.settings.roomConfigs || {}) };
  const current = configs[roomId]
    ? { ...createEmptyRoomExtras(), ...configs[roomId] }
    : createEmptyRoomExtras();
  const next = updater(current);
  configs[roomId] = next;

  const nextGiftStats = { ...(state.settings.userGiftStats || {}) };
  if (giftStatIncrement) {
    const sCur = nextGiftStats[giftStatIncrement.senderId] || {
      sentCoins: 0,
      receivedCoins: 0,
    };
    nextGiftStats[giftStatIncrement.senderId] = {
      sentCoins: (sCur.sentCoins || 0) + Math.max(0, giftStatIncrement.senderCoinsDelta),
      receivedCoins: sCur.receivedCoins || 0,
    };
    for (const rid of giftStatIncrement.recipientIds) {
      const rCur = nextGiftStats[rid] || { sentCoins: 0, receivedCoins: 0 };
      nextGiftStats[rid] = {
        sentCoins: rCur.sentCoins || 0,
        receivedCoins:
          (rCur.receivedCoins || 0) + Math.max(0, giftStatIncrement.recipientCoinsEach),
      };
    }
  }

  await savePlatformState({
    settings: {
      ...state.settings,
      roomConfigs: configs,
      userGiftStats: nextGiftStats,
    },
  });
  return next;
}

export function canManageRoom(
  room: Pick<Room, 'hostId'>,
  extras: RoomExtrasConfig,
  user: Pick<User, 'id' | 'is_admin'> | null
): boolean {
  if (!user) return false;
  return (
    user.is_admin ||
    user.id === room.hostId ||
    extras.deputyIds.includes(user.id) ||
    extras.moderatorIds.includes(user.id)
  );
}

async function hasAgencyRoomControlRole(
  roomHostId: string,
  userId: string,
  deputyIds: string[]
): Promise<boolean> {
  if (userId === roomHostId || deputyIds.includes(userId)) return true;

  const { data: hostUser, error: hostError } = await supabase
    .from('sada_users')
    .select('agency_id')
    .eq('id', roomHostId)
    .maybeSingle();
  if (hostError) throw new Error(`تعذّر التحقق من وكالة الغرفة: ${hostError.message}`);
  if (!hostUser?.agency_id) return false;

  const { data: agency, error: agencyError } = await supabase
    .from('sada_agencies')
    .select('owner_id, host_ids')
    .eq('id', hostUser.agency_id)
    .maybeSingle();
  if (agencyError) throw new Error(`تعذّر التحقق من صلاحيات الوكالة: ${agencyError.message}`);

  return Boolean(
    agency &&
      (String(agency.owner_id) === userId ||
        (Array.isArray(agency.host_ids) &&
          agency.host_ids.some((hostId: unknown) => String(hostId) === userId)))
  );
}

async function authorizeRoomControlAction(
  roomId: string,
  user: User,
  denialMessage: string
): Promise<{ host_id: string; title?: string }> {
  const { data: room, error: roomError } = await supabase
    .from('sada_rooms')
    .select('host_id, title')
    .eq('id', roomId)
    .maybeSingle();
  if (roomError) throw new Error(`تعذّر التحقق من الغرفة: ${roomError.message}`);
  if (!room) throw new Error('الغرفة غير موجودة.');

  const state = await getPlatformState({ forceRefresh: true });
  const deputyIds = state.settings.roomConfigs?.[roomId]?.deputyIds || [];
  const allowed = await hasAgencyRoomControlRole(String(room.host_id), user.id, deputyIds);
  if (!allowed) throw new Error(denialMessage);
  return room;
}

export async function listActiveRooms(): Promise<Room[]> {
  const [{ data: roomRows, error }, { data: msgRows }] = await Promise.all([
    supabase
      .from('sada_rooms')
      .select(ROOM_COLUMNS)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('sada_room_messages')
      .select(ROOM_MESSAGE_COLUMNS)
      .order('timestamp', { ascending: false })
      .limit(40),
  ]);

  if (error) {
    throw new Error('تعذّر تحميل الغرف الصوتية من Supabase.');
  }

  const msgsByRoom = new Map<string, RoomMessage[]>();
  for (const m of (msgRows || []).slice().reverse()) {
    const rid = String(m.room_id);
    const list = msgsByRoom.get(rid) || [];
    list.push(rowToRoomMessage(m));
    msgsByRoom.set(rid, list);
  }

  return (roomRows || []).map((r) => {
    const { password: _pwd, ...sanitized } = rowToRoom(
      r,
      (msgsByRoom.get(String(r.id)) || []).slice(-50)
    );
    return sanitized;
  });
}

export async function getUserActiveRoomsInSupabase(
  user: User
): Promise<{ personalRoom: Room | null; agencyRoom: Room | null }> {
  const { data: userRow, error: userError } = await supabase
    .from('sada_users')
    .select('agency_id')
    .eq('id', user.id)
    .maybeSingle();
  if (userError) {
    throw new Error(`تعذّر التحقق من وكالة المستخدم: ${userError.message}`);
  }

  const agencyId = userRow?.agency_id ? String(userRow.agency_id) : '';
  let agency: { id: string; owner_id: string } | null = null;
  if (agencyId) {
    const { data, error } = await supabase
      .from('sada_agencies')
      .select('id, owner_id')
      .eq('id', agencyId)
      .eq('status', 'approved')
      .maybeSingle();
    if (error) {
      throw new Error(`تعذّر التحقق من وكالة المستخدم: ${error.message}`);
    }
    agency = data;
  }

  if (!agency) {
    const { data, error } = await supabase
      .from('sada_agencies')
      .select('id, owner_id, host_ids')
      .eq('status', 'approved');
    if (error) {
      throw new Error(`تعذّر التحقق من وكالة المستخدم: ${error.message}`);
    }
    const membership = (data || []).find(
      (row) =>
        String(row.owner_id) === user.id ||
        (Array.isArray(row.host_ids) &&
          row.host_ids.some((hostId) => String(hostId) === user.id))
    );
    if (membership) {
      agency = { id: String(membership.id), owner_id: String(membership.owner_id) };
    }
  }

  const agencyOwnerId = agency?.owner_id ? String(agency.owner_id) : '';
  const hostIds = Array.from(new Set([user.id, agencyOwnerId].filter(Boolean)));
  const { data: roomRows, error: roomError } = await supabase
    .from('sada_rooms')
    .select(ROOM_COLUMNS)
    .in('host_id', hostIds)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (roomError) {
    throw new Error(`تعذّر البحث عن الغرف النشطة: ${roomError.message}`);
  }

  const activeRooms = (roomRows || []).map((row) => {
    const { password: _password, ...room } = rowToRoom(row);
    return room;
  });
  const agencyRoom = agencyOwnerId
    ? activeRooms.find(
        (room) => room.agencyId === agencyId && room.isAgency === true
      ) ||
      activeRooms.find((room) => room.hostId === agencyOwnerId && room.isAgency === true) ||
      null
    : null;
  const personalRoom =
    activeRooms.find((room) => room.hostId === user.id && !room.isAgency) || null;

  return { personalRoom, agencyRoom };
}

export async function createRoomInSupabase(
  user: User,
  payload: {
    title: string;
    category?: Room['category'];
    description?: string;
    maxSeats?: number;
    isPrivate?: boolean;
    password?: string;
    isAgency?: boolean;
    agencyId?: string;
  }
): Promise<Room> {
  const cleanTitle = (payload.title || '').trim();
  if (cleanTitle.length < 3) {
    throw new Error('يرجى كتابة عنوان الغرفة (3 أحرف على الأقل).');
  }
  const cleanPin = payload.isPrivate ? (payload.password || '').trim() : '';
  if (payload.isPrivate && cleanPin.length < 3) {
    throw new Error('يرجى إدخال رمز سري للغرفة الخاصة (3 أرقام على الأقل).');
  }
  const isAgency = payload.isAgency === true;
  const agencyId = isAgency ? payload.agencyId?.trim() : undefined;
  if (!isAgency) {
    const { data: existingPersonalRooms, error: existingError } = await supabase
      .from('sada_rooms')
      .select('id, is_active')
      .eq('host_id', user.id)
      .eq('is_agency', false)
      .order('created_at', { ascending: false })
      .limit(1);
    if (existingError) {
      throw new Error(`تعذّر التحقق من الغرفة الشخصية الحالية: ${existingError.message}`);
    }
    if (existingPersonalRooms?.length) {
      throw new Error('لديك غرفة شخصية منشأة بالفعل ولا يجوز إنشاء غرفة مكررة.');
    }
  }
  if (isAgency && !agencyId) {
    throw new Error('معرّف الوكالة مطلوب لإنشاء غرفة وكالة.');
  }

  const allowedCounts = [6, 12, 18, 24];
  const requestedSeats = Number(payload.maxSeats || 12);
  const seatsCount = allowedCounts.includes(requestedSeats) ? requestedSeats : 12;
  const now = new Date().toISOString();
  const roomId = genId('room');
  const seats = makeEmptySeats(seatsCount, user);

  const row = {
    id: roomId,
    title: cleanTitle.slice(0, 60),
    category: payload.category || 'حوار',
    description:
      (payload.description || '').trim().slice(0, 240) ||
      'أهلاً بكم في غرفتي الصوتية، نتمنى لكم وقتاً ممتعاً.',
    host_id: user.id,
    host_name: user.displayName,
    host_avatar: user.avatarUrl,
    owner_id: isAgency ? agencyId || null : user.id,
    avatar_url: user.avatarUrl,
    cover_url: user.avatarUrl,
    background_url: 'dragon_dark',
    cover_image: 'dragon_dark',
    is_private: Boolean(payload.isPrivate),
    is_agency: isAgency,
    agency_id: agencyId || null,
    password: cleanPin || null,
    max_seats: seatsCount,
    seats,
    listeners_count: 0,
    is_active: true,
    total_gifts_coins: 0,
    created_at: now,
  };

  const welcomeMsg: RoomMessage = {
    id: genId('msg'),
    userId: user.id,
    displayName: user.displayName,
    level: user.level,
    isAdmin: user.is_admin,
    vipTier: getVipTierLabel(user.level, user.is_admin),
    hostBadge: user.hostBadge || null,
    femaleVerifiedBadge: user.femaleVerifiedBadge || null,
    text: `تم افتتاح الغرفة الصوتية "${row.title}"، أهلاً بالجميع!`,
    type: 'system',
    timestamp: now,
  };

  const { error } = await supabase.from('sada_rooms').insert(row);
  if (error) {
    throw new Error(`تعذّر إنشاء الغرفة الصوتية في Supabase: ${error.message}`);
  }

  const { error: welcomeError } = await supabase.from('sada_room_messages').insert({
    id: welcomeMsg.id,
    room_id: roomId,
    user_id: welcomeMsg.userId,
    display_name: welcomeMsg.displayName,
    level: welcomeMsg.level,
    is_admin: welcomeMsg.isAdmin,
    vip_tier: welcomeMsg.vipTier || null,
    host_badge: welcomeMsg.hostBadge || null,
    female_verified_badge: welcomeMsg.femaleVerifiedBadge || null,
    text: welcomeMsg.text,
    type: welcomeMsg.type,
    timestamp: welcomeMsg.timestamp,
  });
  if (welcomeError) {
    const { error: rollbackError } = await supabase
      .from('sada_rooms')
      .delete()
      .not('id', 'is', null)
      .eq('id', roomId);
    if (rollbackError) {
      throw new Error(
        `تعذّر حفظ رسالة الترحيب (${welcomeError.message}) أو التراجع عن إنشاء الغرفة (${rollbackError.message}).`
      );
    }
    throw new Error(`تعذّر حفظ رسالة ترحيب الغرفة: ${welcomeError.message}`);
  }

  const { password: _pwd, ...sanitized } = rowToRoom(row, [welcomeMsg]);
  return sanitized;
}

export async function verifyRoomPasswordInSupabase(
  roomId: string,
  password: string
): Promise<boolean> {
  const { data } = await supabase
    .from('sada_rooms')
    .select('password')
    .eq('id', roomId)
    .maybeSingle();

  if (!data) throw new Error('الغرفة غير موجودة.');
  if (data.password && String(data.password) !== String(password || '')) {
    throw new Error('الرمز السري للغرفة غير صحيح.');
  }
  return true;
}

export async function getRoomDetailsFromSupabase(roomId: string): Promise<{
  room: Room;
  gifts: GiftItem[];
  wheelSegments: LuckyWheelSegment[];
  wheelCost: number;
  extras: RoomExtrasConfig;
}> {
  const [{ data: roomRow, error }, { data: msgRows }, state] = await Promise.all([
    supabase.from('sada_rooms').select(ROOM_COLUMNS).eq('id', roomId).maybeSingle(),
    supabase
      .from('sada_room_messages')
      .select(ROOM_MESSAGE_COLUMNS)
      .eq('room_id', roomId)
      .order('timestamp', { ascending: false })
      .limit(40),
    getPlatformState(),
  ]);

  if (error || !roomRow || !roomRow.is_active) {
    throw new Error('الغرفة الصوتية غير متاحة أو تم إغلاقها.');
  }

  const messages = (msgRows || []).slice().reverse().map(rowToRoomMessage);
  const { password: _pwd, ...sanitized } = rowToRoom(roomRow, messages);
  const rawExtras = state.settings.roomConfigs?.[roomId];
  const extras: RoomExtrasConfig = {
    ...createEmptyRoomExtras(),
    ...(rawExtras || {}),
    deputyIds: Array.isArray(rawExtras?.deputyIds) ? rawExtras!.deputyIds : [],
    moderatorIds: Array.isArray(rawExtras?.moderatorIds) ? rawExtras!.moderatorIds : [],
    kickedUserIds: Array.isArray(rawExtras?.kickedUserIds) ? rawExtras!.kickedUserIds : [],
    kickedUserNames:
      rawExtras?.kickedUserNames && typeof rawExtras.kickedUserNames === 'object'
        ? rawExtras.kickedUserNames
        : {},
    temporaryKickExpiresAt:
      rawExtras?.temporaryKickExpiresAt &&
      typeof rawExtras.temporaryKickExpiresAt === 'object'
        ? rawExtras.temporaryKickExpiresAt
        : {},
    mutedUserIds: Array.isArray(rawExtras?.mutedUserIds) ? rawExtras!.mutedUserIds : [],
    gifters: rawExtras?.gifters && typeof rawExtras.gifters === 'object' ? rawExtras.gifters : {},
    players: rawExtras?.players && typeof rawExtras.players === 'object' ? rawExtras.players : {},
    modLogs: Array.isArray(rawExtras?.modLogs) ? rawExtras!.modLogs : [],
    playVolumeCoins: Number(rawExtras?.playVolumeCoins || 0),
    musicState: rawExtras?.musicState || null,
    activeContest: rawExtras?.activeContest || null,
  };

  return {
    room: sanitized,
    gifts: getCachedGiftCatalog(),
    wheelSegments: state.settings.roomWheelSegments,
    wheelCost: state.settings.roomWheelCost,
    extras,
  };
}

export async function canClearRoomChatFromData(
  room: Pick<Room, 'hostId'>,
  user: Pick<User, 'id'>,
  extras: Pick<RoomExtrasConfig, 'deputyIds'>
): Promise<boolean> {
  return hasAgencyRoomControlRole(room.hostId, user.id, extras.deputyIds);
}

export async function isRoomOrAgencyOwnerFromData(
  room: Pick<Room, 'hostId'>,
  user: Pick<User, 'id'>
): Promise<boolean> {
  if (room.hostId === user.id) return true;
  const { data: hostUser, error: hostError } = await supabase
    .from('sada_users')
    .select('agency_id')
    .eq('id', room.hostId)
    .maybeSingle();
  if (hostError) throw new Error(`تعذّر التحقق من وكالة الغرفة: ${hostError.message}`);
  if (!hostUser?.agency_id) return false;
  const { data: agency, error: agencyError } = await supabase
    .from('sada_agencies')
    .select('owner_id, host_ids')
    .eq('id', String(hostUser.agency_id))
    .maybeSingle();
  if (agencyError) throw new Error(`تعذّر التحقق من مالك الوكالة: ${agencyError.message}`);
  return Boolean(agency && String(agency.owner_id) === user.id);
}

export async function isRoomAgencyOwnerOrHostFromData(
  roomHostId: string,
  userId: string
): Promise<boolean> {
  if (roomHostId === userId) return true;
  const { data: hostUser, error: hostError } = await supabase
    .from('sada_users')
    .select('agency_id')
    .eq('id', roomHostId)
    .maybeSingle();
  if (hostError) throw new Error(`تعذّر التحقق من وكالة الغرفة: ${hostError.message}`);
  if (!hostUser?.agency_id) return false;
  const { data: agency, error: agencyError } = await supabase
    .from('sada_agencies')
    .select('owner_id, host_ids')
    .eq('id', String(hostUser.agency_id))
    .maybeSingle();
  if (agencyError) throw new Error(`تعذّر التحقق من صلاحيات الوكالة: ${agencyError.message}`);
  return Boolean(
    agency &&
      (String(agency.owner_id) === userId ||
        (Array.isArray(agency.host_ids) &&
          agency.host_ids.some((hostId: unknown) => String(hostId) === userId)))
  );
}

export async function canManageRoomMicRequestsFromData(
  room: Pick<Room, 'hostId'>,
  user: Pick<User, 'id'>,
  extras: Pick<RoomExtrasConfig, 'deputyIds'>
): Promise<boolean> {
  return hasAgencyRoomControlRole(room.hostId, user.id, extras.deputyIds);
}

export async function clearRoomChatInSupabase(roomId: string): Promise<RoomMessage> {
  const { data, error } = await supabase.rpc('sada_clear_room_chat', {
    p_room_id: roomId,
  });
  if (error) {
    throw new Error(`تعذّر مسح دردشة الغرفة: ${error.message}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('لم تُرجع قاعدة البيانات إشعار مسح الدردشة.');
  }
  return rowToRoomMessage(data as Record<string, unknown>);
}

export async function joinRoomInSupabase(
  roomId: string,
  user: User
): Promise<{ room: Room; entryEvent: RoomEntryEvent | null; extras: RoomExtrasConfig }> {
  await purgeExpiredRewardsOnUser(user);

  const [{ data: roomRow }, extras] = await Promise.all([
    supabase.from('sada_rooms').select('id, is_active, host_id, listeners_count').eq('id', roomId).maybeSingle(),
    getRoomExtrasFromSupabase(roomId, { forceRefresh: true }),
  ]);

  if (!roomRow || !roomRow.is_active) throw new Error('الغرفة غير موجودة أو تم إغلاقها.');

  if (
    !user.is_admin &&
    String(roomRow.host_id) !== user.id &&
    extras.kickedUserIds.includes(user.id)
  ) {
    throw new Error('تم حظرك من دخول هذه الغرفة بقرار من الوكيل.');
  }

  if (!user.is_admin && String(roomRow.host_id) !== user.id) {
    const expiresAt = extras.temporaryKickExpiresAt?.[user.id];
    if (expiresAt) {
      const expiry = new Date(expiresAt).getTime();
      if (Number.isFinite(expiry) && expiry > Date.now()) {
        throw new Error('تم طردك من هذه الوكالة لمدة 3 أيام');
      }
    }
  }

  const nextListeners = Number(roomRow.listeners_count || 0) + 1;
  await supabase
    .from('sada_rooms')
    .update({ listeners_count: nextListeners })
    .eq('id', roomId);

  const nowJoinIso = new Date().toISOString();
  const vipUser = await enrichUserWithVipTotals(user).catch(() => user);
  const vipInfo = getUserVipTierInfo(vipUser);
  const resolvedVipTag =
    vipInfo.key !== 'none'
      ? vipInfo.key
      : getVipTierLabel(vipUser.level, vipUser.is_admin);

  const hasValidStoreEntry = Boolean(
    vipUser.activeEntryId &&
      vipUser.tempEntryExpiresAt &&
      Date.now() < new Date(vipUser.tempEntryExpiresAt).getTime()
  );

  // If user is VIP1/2/3/SVIP, emit styled VIP entry bar in chat; otherwise keep standard join notice
  if (vipInfo.key === 'none') {
    const joinText = `دخل الغرفة ${vipUser.displayName}`;
    const { data: existingJoin } = await supabase
      .from('sada_room_messages')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', vipUser.id)
      .eq('text', joinText)
      .eq('type', 'system')
      .limit(1)
      .maybeSingle();
    if (!existingJoin) {
      const joinNoticeMsg: RoomMessage = {
        id: genId('msg'),
        userId: vipUser.id,
        displayName: vipUser.displayName,
        level: vipUser.level,
        isAdmin: vipUser.is_admin,
        vipTier: resolvedVipTag,
        hostBadge: vipUser.hostBadge || null,
        femaleVerifiedBadge: vipUser.femaleVerifiedBadge || null,
        text: joinText,
        type: 'system',
        timestamp: nowJoinIso,
      };
      await supabase.from('sada_room_messages').insert({
        id: joinNoticeMsg.id,
        room_id: roomId,
        user_id: joinNoticeMsg.userId,
        display_name: joinNoticeMsg.displayName,
        level: joinNoticeMsg.level,
        is_admin: joinNoticeMsg.isAdmin,
        vip_tier: joinNoticeMsg.vipTier || null,
        host_badge: joinNoticeMsg.hostBadge || null,
        female_verified_badge: joinNoticeMsg.femaleVerifiedBadge || null,
        text: joinNoticeMsg.text,
        type: joinNoticeMsg.type,
        timestamp: joinNoticeMsg.timestamp,
      });
    }
  } else {
    const vipChatText =
      vipInfo.key === 'svip'
        ? `👑 تشرف الغرفة بحضور الإمبراطور ${vipUser.displayName}!`
        : vipInfo.key === 'vip3'
        ? `👑✨ انضم الملك VIP 3 ${vipUser.displayName} بهالة ذهبية متوهجة إلى الغرفة!`
        : vipInfo.key === 'vip2'
        ? `🥈✨ دخل النجم الفضي VIP 2 ${vipUser.displayName} وسط ترحيب النجوم!`
        : `🥉✨ انضم VIP 1 ${vipUser.displayName} إلى الغرفة`;

    const vipEntryMsg: RoomMessage = {
      id: genId('msg'),
      userId: vipUser.id,
      displayName: vipUser.displayName,
      level: vipUser.level,
      isAdmin: vipUser.is_admin,
      vipTier: vipInfo.key,
      hostBadge: vipUser.hostBadge || null,
      femaleVerifiedBadge: vipUser.femaleVerifiedBadge || null,
      text: vipChatText,
      type: 'entry',
      timestamp: nowJoinIso,
    };
    await supabase.from('sada_room_messages').insert({
      id: vipEntryMsg.id,
      room_id: roomId,
      user_id: vipEntryMsg.userId,
      display_name: vipEntryMsg.displayName,
      level: vipEntryMsg.level,
      is_admin: vipEntryMsg.isAdmin,
      vip_tier: vipEntryMsg.vipTier || null,
      host_badge: vipEntryMsg.hostBadge || null,
      female_verified_badge: vipEntryMsg.femaleVerifiedBadge || null,
      text: vipEntryMsg.text,
      type: vipEntryMsg.type,
      timestamp: vipEntryMsg.timestamp,
    });
  }

  let entryEvent: RoomEntryEvent | null = null;
  if (vipInfo.key === 'svip' || vipInfo.key === 'vip3' || vipInfo.key === 'vip2') {
    entryEvent = {
      userId: vipUser.id,
      displayName: vipUser.displayName,
      avatarUrl: vipUser.avatarUrl,
      frameId: vipUser.frameId,
      level: vipUser.level,
      vipLevel: vipInfo.key,
      entryId: hasValidStoreEntry ? vipUser.activeEntryId : null,
      entryName:
        vipInfo.key === 'svip'
          ? `👑 تشرف الغرفة بحضور الإمبراطور ${vipUser.displayName}!`
          : vipInfo.key === 'vip3'
          ? `دخولية VIP 3 الذهبية الملكية`
          : `دخولية VIP 2 الفضية السماوية`,
      timestamp: nowJoinIso,
    };
  } else if (hasValidStoreEntry && vipUser.activeEntryId) {
    entryEvent = {
      userId: vipUser.id,
      displayName: vipUser.displayName,
      avatarUrl: vipUser.avatarUrl,
      frameId: vipUser.frameId,
      level: vipUser.level,
      vipLevel: vipInfo.key,
      entryId: vipUser.activeEntryId,
      entryName: vipUser.activeEntryName || 'دخولية ملكية',
      timestamp: nowJoinIso,
    };

    const entryChatMsg: RoomMessage = {
      id: genId('msg'),
      userId: vipUser.id,
      displayName: vipUser.displayName,
      level: vipUser.level,
      isAdmin: vipUser.is_admin,
      vipTier: resolvedVipTag,
      hostBadge: vipUser.hostBadge || null,
      femaleVerifiedBadge: vipUser.femaleVerifiedBadge || null,
      text:
        vipUser.activeEntryId === 'entry_legendary_30d'
          ? `🐉👑 الدخولية الأسطورية الملكية: شرّف ${vipUser.displayName} الوكالة بحضوره الإمبراطوري!`
          : `🚘✨ موكب السيارة الذهبية: وصل ${vipUser.displayName} إلى الوكالة!`,
      type: 'entry',
      timestamp: nowJoinIso,
    };

    await supabase.from('sada_room_messages').insert({
      id: entryChatMsg.id,
      room_id: roomId,
      user_id: entryChatMsg.userId,
      display_name: entryChatMsg.displayName,
      level: entryChatMsg.level,
      is_admin: entryChatMsg.isAdmin,
      vip_tier: entryChatMsg.vipTier || null,
      host_badge: entryChatMsg.hostBadge || null,
      female_verified_badge: entryChatMsg.femaleVerifiedBadge || null,
      text: entryChatMsg.text,
      type: entryChatMsg.type,
      timestamp: entryChatMsg.timestamp,
    });
  }

  const updated = await getRoomDetailsFromSupabase(roomId);
  return { room: updated.room, entryEvent, extras: updated.extras };
}

export async function leaveRoomInSupabase(
  roomId: string,
  userId: string,
  remainingListenersCount?: number
): Promise<void> {
  const { data: roomRow, error: roomError } = await supabase
    .from('sada_rooms')
    .select('listeners_count, seats')
    .eq('id', roomId)
    .maybeSingle();

  if (roomError) {
    throw new Error(`تعذّر تحميل حالة الغرفة عند المغادرة: ${roomError.message}`);
  }
  if (!roomRow) return;

  const seats = Array.isArray(roomRow.seats) ? (roomRow.seats as Room['seats']) : [];
  const updatedSeats = seats.map((s) =>
    s.userId === userId
      ? {
          ...s,
          userId: null,
          displayName: null,
          avatarUrl: null,
          frameId: null,
          level: null,
          isSpeaking: false,
          isMuted: false,
          femaleVerifiedBadge: null,
        }
      : s
  );

  const { error: updateError } = await supabase
    .from('sada_rooms')
    .update({
      listeners_count:
        typeof remainingListenersCount === 'number' &&
        Number.isFinite(remainingListenersCount)
          ? Math.max(0, Math.floor(remainingListenersCount))
          : Math.max(0, Number(roomRow.listeners_count || 1) - 1),
      seats: updatedSeats,
    })
    .eq('id', roomId);
  if (updateError) {
    throw new Error(`تعذّر تحديث المايك وعدّاد المتواجدين عند المغادرة: ${updateError.message}`);
  }
}

export async function updateRoomSeatInSupabase(
  roomId: string,
  user: User,
  action:
    | { type: 'take'; seatIndex: number }
    | { type: 'leave' }
    | { type: 'mute'; isMuted: boolean }
    | { type: 'lock'; seatIndex: number; isLocked: boolean }
    | { type: 'speaking'; isSpeaking: boolean }
): Promise<Room['seats']> {
  const { data: roomRow } = await supabase
    .from('sada_rooms')
    .select('host_id, seats')
    .eq('id', roomId)
    .maybeSingle();

  if (!roomRow) throw new Error('الغرفة غير موجودة.');
  const seats = (Array.isArray(roomRow.seats) ? roomRow.seats : []) as Room['seats'];

  let nextSeats = seats.map((s) => ({ ...s }));

  if (action.type === 'take') {
    const extras = await getRoomExtrasFromSupabase(roomId, { forceRefresh: true });
    if (extras.mutedUserIds.includes(user.id)) {
      throw new Error('تم كتمك في هذه الغرفة ولا يمكنك فتح المايك حتى يفك الوكيل كتمك.');
    }
    const target = nextSeats.find((s) => s.seatIndex === action.seatIndex);
    if (!target || target.isLocked || target.userId) return nextSeats;
    const vipKey = getUserVipTierInfo(user).key;
    nextSeats = nextSeats.map((s) =>
      s.userId === user.id
        ? {
            ...s,
            userId: null,
            displayName: null,
            avatarUrl: null,
            frameId: null,
            level: null,
            vipLevel: null,
            isSpeaking: false,
            isMuted: false,
            femaleVerifiedBadge: null,
          }
        : s.seatIndex === action.seatIndex
        ? {
            ...s,
            userId: user.id,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            frameId: user.frameId,
            level: user.level,
            vipLevel: vipKey,
            isMuted: false,
            isSpeaking: false,
            femaleVerifiedBadge: user.femaleVerifiedBadge || null,
          }
        : s
    );
  } else if (action.type === 'leave') {
    nextSeats = nextSeats.map((s) =>
      s.userId === user.id
        ? {
            ...s,
            userId: null,
            displayName: null,
            avatarUrl: null,
            frameId: null,
            level: null,
            isSpeaking: false,
            isMuted: false,
            femaleVerifiedBadge: null,
          }
        : s
    );
  } else if (action.type === 'mute') {
    const extras = await getRoomExtrasFromSupabase(roomId, { forceRefresh: true });
    if (!action.isMuted && extras.mutedUserIds.includes(user.id)) {
      throw new Error('لا يمكنك فك الكتم عن نفسك؛ اطلب من الوكيل فك كتمك.');
    }
    nextSeats = nextSeats.map((s) =>
      s.userId === user.id
        ? {
            ...s,
            isMuted: action.isMuted,
            isSpeaking: action.isMuted ? false : s.isSpeaking,
          }
        : s
    );
  } else if (action.type === 'lock') {
    const extras = await getRoomExtrasFromSupabase(roomId);
    const isManager =
      String(roomRow.host_id) === user.id ||
      user.is_admin ||
      extras.deputyIds.includes(user.id) ||
      extras.moderatorIds.includes(user.id);
    if (!isManager) return nextSeats;
    const prevSeat = nextSeats.find((s) => s.seatIndex === action.seatIndex);
    const displacedName = prevSeat?.displayName || undefined;
    const displacedUserId = prevSeat?.userId || undefined;
    nextSeats = nextSeats.map((s) => {
      if (s.seatIndex !== action.seatIndex) return s;
      if (action.isLocked) {
        return {
          ...s,
          isLocked: true,
          userId: null,
          displayName: null,
          avatarUrl: null,
          frameId: null,
          level: null,
          isSpeaking: false,
          femaleVerifiedBadge: null,
        };
      }
      return { ...s, isLocked: false };
    });
    await saveRoomExtrasConfig(roomId, (cur) => ({
      ...cur,
      modLogs: prependModLog(cur, {
        actorId: user.id,
        actorName: user.displayName,
        actorRole: resolveActorRoleLabel(String(roomRow.host_id), cur, user),
        actionType: action.isLocked ? 'lock_seat' : 'unlock_seat',
        targetUserId: displacedUserId,
        targetName: displacedName,
        details: action.isLocked
          ? `قفل المايك رقم ${action.seatIndex + 1}${displacedName ? ` (إنزال ${displacedName})` : ''}`
          : `فتح المايك رقم ${action.seatIndex + 1}`,
      }),
    }));
  } else if (action.type === 'speaking') {
    nextSeats = nextSeats.map((s) =>
      s.userId === user.id && !s.isMuted ? { ...s, isSpeaking: action.isSpeaking } : s
    );
  }

  const { error: seatUpdateError } = await supabase
    .from('sada_rooms')
    .update({ seats: nextSeats })
    .eq('id', roomId);
  if (seatUpdateError) throw new Error(`تعذّر تحديث مقاعد الغرفة: ${seatUpdateError.message}`);
  return nextSeats;
}

export async function sendRoomChatInSupabase(
  roomId: string,
  user: User,
  text: string
): Promise<RoomMessage> {
  const cleanText = text.trim().slice(0, 300);
  if (!cleanText) throw new Error('الرسالة فارغة.');

  const vipInfo = getUserVipTierInfo(user);
  const resolvedVipTag =
    vipInfo.key !== 'none' ? vipInfo.key : getVipTierLabel(user.level, user.is_admin);

  const chatMsg: RoomMessage = {
    id: genId('msg'),
    userId: user.id,
    displayName: user.displayName,
    level: user.level,
    isAdmin: user.is_admin,
    vipTier: resolvedVipTag,
    vipLevel: vipInfo.key,
    avatarUrl: user.avatarUrl,
    frameId: user.frameId,
    hostBadge: user.hostBadge || null,
    femaleVerifiedBadge: user.femaleVerifiedBadge || null,
    text: cleanText,
    type: 'chat',
    timestamp: new Date().toISOString(),
  };

  const { error } = await supabase.from('sada_room_messages').insert({
    id: chatMsg.id,
    room_id: roomId,
    user_id: chatMsg.userId,
    display_name: chatMsg.displayName,
    level: chatMsg.level,
    is_admin: chatMsg.isAdmin,
    vip_tier: chatMsg.vipTier || null,
    host_badge: chatMsg.hostBadge || null,
    female_verified_badge: chatMsg.femaleVerifiedBadge || null,
    text: chatMsg.text,
    type: chatMsg.type,
    timestamp: chatMsg.timestamp,
  });

  if (error) {
    throw new Error('تعذّر إرسال الرسالة إلى الغرفة.');
  }

  return chatMsg;
}

export async function sendRoomGiftInSupabase(
  roomId: string,
  sender: User,
  giftId: string,
  targetUserId?: string
): Promise<{
  user: User;
  room: Room;
  gift: GiftItem;
  luckyMultiplier: number | null;
  luckyBonusCoins: number;
}> {
  const gift = findGiftById(giftId);
  if (!gift) throw new Error('الهدية غير متوفرة.');

  const { data: senderFreshRow } = await supabase
    .from('sada_users')
    .select(USER_COLUMNS)
    .eq('id', sender.id)
    .maybeSingle();
  const freshSender = senderFreshRow ? rowToUser(senderFreshRow) : { ...sender };

  if (freshSender.coins < gift.coinsCost) {
    throw new Error('رصيد الكوينز غير كافٍ لإرسال هذه الهدية.');
  }

  const { data: roomRow } = await supabase
    .from('sada_rooms')
    .select(ROOM_COLUMNS)
    .eq('id', roomId)
    .maybeSingle();
  if (!roomRow) throw new Error('الغرفة غير موجودة.');

  const recipientLookupId = targetUserId || String(roomRow.host_id);
  const { data: recRow } = await supabase
    .from('sada_users')
    .select(USER_COLUMNS)
    .eq('id', recipientLookupId)
    .maybeSingle();
  if (!recRow) throw new Error('المستلم غير موجود.');

  const recipient = rowToUser(recRow);
  if (isFemaleVoiceLocked(recipient)) {
    throw new Error(
      'رصيد الألماس لدى هذا الحساب النسائي مقفل حالياً بانتظار اعتماد التوثيق الصوتي من الإدارة.'
    );
  }

  const state = await getPlatformState();
  const now = new Date().toISOString();

  freshSender.coins -= gift.coinsCost;
  freshSender.xp += gift.xpGain;
  freshSender.level = computeLevelFromXp(freshSender.xp);

  let luckyMultiplier: number | null = null;
  let luckyBonusCoins = 0;
  if (gift.category === 'lucky') {
    luckyMultiplier = rollLuckyGiftMultiplier();
    luckyBonusCoins = Math.round(gift.coinsCost * luckyMultiplier);
    freshSender.coins += luckyBonusCoins;
  }

  const dynamicDiamonds = Math.max(
    1,
    Math.round(gift.coinsCost * (state.settings.giftDiamondsRatio || 0.75))
  );
  recipient.diamonds += dynamicDiamonds;

  const seats = (Array.isArray(roomRow.seats) ? roomRow.seats : []) as Room['seats'];
  const nextSeats = seats.map((s) =>
    s.userId === recipient.id
      ? { ...s, receivedDiamonds: (s.receivedDiamonds || 0) + dynamicDiamonds }
      : s
  );
  const nextTotalGifts = Number(roomRow.total_gifts_coins || 0) + gift.coinsCost;

  const senderVipInfo = getUserVipTierInfo(freshSender);
  const senderVipTag =
    senderVipInfo.key !== 'none'
      ? senderVipInfo.key
      : getVipTierLabel(freshSender.level, freshSender.is_admin);

  const giftMessage: RoomMessage = {
    id: genId('msg'),
    userId: freshSender.id,
    displayName: freshSender.displayName,
    level: freshSender.level,
    isAdmin: freshSender.is_admin,
    vipTier: senderVipTag,
    vipLevel: senderVipInfo.key,
    femaleVerifiedBadge: freshSender.femaleVerifiedBadge || null,
    text:
      gift.category === 'lucky' && luckyMultiplier
        ? `🎰 أهدى ${freshSender.displayName} ${gift.glyph} ${gift.name} إلى ${recipient.displayName} وفاز بمضاعف الحظ ×${luckyMultiplier} (+${luckyBonusCoins.toLocaleString('en-US')} كوينز)!`
        : `أهدى ${freshSender.displayName} ${gift.glyph} ${gift.name} إلى ${recipient.displayName}`,
    type: 'gift',
    timestamp: now,
  };

  await Promise.all([
    supabase
      .from('sada_users')
      .update({
        coins: freshSender.coins,
        xp: freshSender.xp,
        level: freshSender.level,
      })
      .eq('id', freshSender.id),
    recipient.id !== freshSender.id
      ? supabase
          .from('sada_users')
          .update({ diamonds: recipient.diamonds })
          .eq('id', recipient.id)
      : supabase
          .from('sada_users')
          .update({ diamonds: recipient.diamonds })
          .eq('id', freshSender.id),
    supabase
      .from('sada_rooms')
      .update({
        seats: nextSeats,
        total_gifts_coins: nextTotalGifts,
      })
      .eq('id', roomId),
    supabase.from('sada_room_messages').insert({
      id: giftMessage.id,
      room_id: roomId,
      user_id: giftMessage.userId,
      display_name: giftMessage.displayName,
      level: giftMessage.level,
      is_admin: giftMessage.isAdmin,
      vip_tier: giftMessage.vipTier || null,
      host_badge: null,
      female_verified_badge: giftMessage.femaleVerifiedBadge || null,
      text: giftMessage.text,
      type: giftMessage.type,
      timestamp: giftMessage.timestamp,
    }),
    recordTransaction({
      userId: freshSender.id,
      type: 'gift_sent',
      amount: -gift.coinsCost,
      currency: 'coins',
      description: `إرسال ${gift.name} إلى ${recipient.displayName}`,
      timestamp: now,
    }),
    recordTransaction({
      userId: recipient.id,
      type: 'gift_received',
      amount: dynamicDiamonds,
      currency: 'diamonds',
      description: `استلام ${gift.name} من ${freshSender.displayName}`,
      timestamp: now,
    }),
  ]);

  if (luckyBonusCoins > 0 && luckyMultiplier) {
    await recordTransaction({
      userId: freshSender.id,
      type: 'lucky_gift_bonus',
      amount: luckyBonusCoins,
      currency: 'coins',
      description: `مضاعف هدية الحظ (${gift.name} ×${luckyMultiplier})`,
      timestamp: now,
    });
  }

  await applyHostEarningsAndAgencyCommission(recipient, dynamicDiamonds, now);

  await saveRoomExtrasConfig(
    roomId,
    (cur) => {
      const prevGifter = cur.gifters[freshSender.id];
      const nextGifters = {
        ...cur.gifters,
        [freshSender.id]: {
          userId: freshSender.id,
          displayName: freshSender.displayName,
          avatarUrl: freshSender.avatarUrl,
          frameId: freshSender.frameId,
          vipLevel: senderVipInfo.key,
          totalCoins: (prevGifter?.totalCoins || 0) + gift.coinsCost,
        },
      };
      return {
        ...cur,
        gifters: nextGifters,
        playVolumeCoins: (cur.playVolumeCoins || 0) + gift.coinsCost,
      };
    },
    {
      senderId: freshSender.id,
      senderCoinsDelta: gift.coinsCost,
      recipientIds: [recipient.id],
      recipientCoinsEach: gift.coinsCost,
    }
  );

  if (recipient.id === freshSender.id) {
    freshSender.diamonds = recipient.diamonds;
  }

  invalidateUserVipCache(freshSender.id);
  const enrichedSender = await enrichUserWithVipTotals(freshSender, true).catch(() => freshSender);

  const updated = await getRoomDetailsFromSupabase(roomId);
  return {
    user: enrichedSender,
    room: updated.room,
    gift,
    luckyMultiplier,
    luckyBonusCoins,
  };
}

export async function sendRoomGiftBatchInSupabase(
  roomId: string,
  sender: User,
  giftId: string,
  targetUserIds: string[],
  quantity = 1,
  comboCount = 1
): Promise<{
  user: User;
  room: Room;
  extras: RoomExtrasConfig;
  gift: GiftItem;
  quantity: number;
  recipientIds: string[];
  recipientNames: string[];
  luckyMultiplier: number | null;
  luckyBonusCoins: number;
}> {
  const gift = findGiftById(giftId);
  if (!gift) throw new Error('الهدية غير متوفرة.');

  const safeQty = Math.max(1, Math.min(100, Math.round(quantity)));

  const [{ data: senderFreshRow }, { data: roomRow }, state] = await Promise.all([
    supabase.from('sada_users').select(USER_COLUMNS).eq('id', sender.id).maybeSingle(),
    supabase.from('sada_rooms').select(ROOM_COLUMNS).eq('id', roomId).maybeSingle(),
    getPlatformState(),
  ]);

  if (!roomRow) throw new Error('الغرفة غير موجودة.');
  const freshSender = senderFreshRow ? rowToUser(senderFreshRow) : { ...sender };

  const uniqueTargets = Array.from(
    new Set(
      (targetUserIds.length > 0 ? targetUserIds : [String(roomRow.host_id)]).filter(Boolean)
    )
  );

  const totalCost = gift.coinsCost * safeQty * uniqueTargets.length;
  if (freshSender.coins < totalCost) {
    throw new Error(
      `رصيد الكوينز غير كافٍ. تحتاج إلى ${totalCost.toLocaleString('en-US')} كوينز.`
    );
  }

  const { data: recRows } = await supabase
    .from('sada_users')
    .select(USER_COLUMNS)
    .in('id', uniqueTargets);

  const recipients = (recRows || []).map(rowToUser);
  if (recipients.length === 0) throw new Error('المستلم غير موجود.');

  for (const r of recipients) {
    if (isFemaleVoiceLocked(r)) {
      throw new Error(
        `رصيد الألماس لدى "${r.displayName}" مقفل حالياً بانتظار التوثيق الصوتي.`
      );
    }
  }

  const now = new Date().toISOString();
  freshSender.coins -= totalCost;
  freshSender.xp += gift.xpGain * safeQty * recipients.length;
  freshSender.level = computeLevelFromXp(freshSender.xp);

  let luckyMultiplier: number | null = null;
  let luckyBonusCoins = 0;
  if (gift.category === 'lucky') {
    luckyMultiplier = rollLuckyGiftMultiplier();
    luckyBonusCoins = Math.round(totalCost * luckyMultiplier);
    freshSender.coins += luckyBonusCoins;
  }

  const diamondsPerRecipient = Math.max(
    1,
    Math.round(gift.coinsCost * (state.settings.giftDiamondsRatio || 0.75)) * safeQty
  );

  const recipientIdSet = new Set(recipients.map((r) => r.id));
  const seats = (Array.isArray(roomRow.seats) ? roomRow.seats : []) as Room['seats'];
  const nextSeats = seats.map((s) =>
    s.userId && recipientIdSet.has(s.userId)
      ? { ...s, receivedDiamonds: (s.receivedDiamonds || 0) + diamondsPerRecipient }
      : s
  );
  const nextTotalGifts = Number(roomRow.total_gifts_coins || 0) + totalCost;

  const targetSummary =
    recipients.length > 1
      ? `الجميع على المايك (${recipients.length})`
      : recipients[0].displayName;
  const qtyBadge = safeQty > 1 ? ` ×${safeQty}` : '';
  const comboBadge = comboCount > 1 ? ` 🔥 Combo x${comboCount}` : '';

  const batchSenderVipInfo = getUserVipTierInfo(freshSender);
  const batchSenderVipTag =
    batchSenderVipInfo.key !== 'none'
      ? batchSenderVipInfo.key
      : getVipTierLabel(freshSender.level, freshSender.is_admin);

  const giftMessage: RoomMessage = {
    id: genId('msg'),
    userId: freshSender.id,
    displayName: freshSender.displayName,
    level: freshSender.level,
    isAdmin: freshSender.is_admin,
    vipTier: batchSenderVipTag,
    vipLevel: batchSenderVipInfo.key,
    femaleVerifiedBadge: freshSender.femaleVerifiedBadge || null,
    text:
      gift.category === 'lucky' && luckyMultiplier
        ? `🎰 أهدى ${freshSender.displayName} ${gift.glyph} ${gift.name}${qtyBadge} إلى ${targetSummary} وفاز بمضاعف ×${luckyMultiplier} (+${luckyBonusCoins.toLocaleString('en-US')} كوينز)${comboBadge}`
        : `أهدى ${freshSender.displayName} ${gift.glyph} ${gift.name}${qtyBadge} إلى ${targetSummary}${comboBadge}`,
    type: 'gift',
    timestamp: now,
  };

  // Update sender coins/xp/level
  const dbOps: Array<Promise<unknown>> = [
    Promise.resolve(
      supabase
        .from('sada_users')
        .update({
          coins: freshSender.coins,
          xp: freshSender.xp,
          level: freshSender.level,
        })
        .eq('id', freshSender.id)
    ),
    Promise.resolve(
      supabase
        .from('sada_rooms')
        .update({
          seats: nextSeats,
          total_gifts_coins: nextTotalGifts,
        })
        .eq('id', roomId)
    ),
    Promise.resolve(
      supabase.from('sada_room_messages').insert({
        id: giftMessage.id,
        room_id: roomId,
        user_id: giftMessage.userId,
        display_name: giftMessage.displayName,
        level: giftMessage.level,
        is_admin: giftMessage.isAdmin,
        vip_tier: giftMessage.vipTier || null,
        host_badge: null,
        female_verified_badge: giftMessage.femaleVerifiedBadge || null,
        text: giftMessage.text,
        type: giftMessage.type,
        timestamp: giftMessage.timestamp,
      })
    ),
    recordTransaction({
      userId: freshSender.id,
      type: 'gift_sent',
      amount: -totalCost,
      currency: 'coins',
      description: `إرسال ${gift.name}${qtyBadge} إلى ${targetSummary}`,
      timestamp: now,
    }),
  ];

  for (const r of recipients) {
    r.diamonds += diamondsPerRecipient;
    if (r.id === freshSender.id) {
      freshSender.diamonds = r.diamonds;
    }
    dbOps.push(
      Promise.resolve(
        supabase.from('sada_users').update({ diamonds: r.diamonds }).eq('id', r.id)
      ),
      recordTransaction({
        userId: r.id,
        type: 'gift_received',
        amount: diamondsPerRecipient,
        currency: 'diamonds',
        description: `استلام ${gift.name}${qtyBadge} من ${freshSender.displayName}`,
        timestamp: now,
      })
    );
  }

  if (luckyBonusCoins > 0 && luckyMultiplier) {
    dbOps.push(
      recordTransaction({
        userId: freshSender.id,
        type: 'lucky_gift_bonus',
        amount: luckyBonusCoins,
        currency: 'coins',
        description: `مضاعف هدية الحظ (${gift.name}${qtyBadge} ×${luckyMultiplier})`,
        timestamp: now,
      })
    );
  }

  await Promise.all(dbOps);

  for (const r of recipients) {
    await applyHostEarningsAndAgencyCommission(r, diamondsPerRecipient, now);
  }

  await saveRoomExtrasConfig(
    roomId,
    (cur) => {
      const prevGifter = cur.gifters[freshSender.id];
      const nextGifters = {
        ...cur.gifters,
        [freshSender.id]: {
          userId: freshSender.id,
          displayName: freshSender.displayName,
          avatarUrl: freshSender.avatarUrl,
          frameId: freshSender.frameId,
          vipLevel: batchSenderVipInfo.key,
          totalCoins: (prevGifter?.totalCoins || 0) + totalCost,
        },
      };
      return {
        ...cur,
        gifters: nextGifters,
        playVolumeCoins: (cur.playVolumeCoins || 0) + totalCost,
      };
    },
    {
      senderId: freshSender.id,
      senderCoinsDelta: totalCost,
      recipientIds: recipients.map((r) => r.id),
      recipientCoinsEach: gift.coinsCost * safeQty,
    }
  );

  invalidateUserVipCache(freshSender.id);
  const enrichedSender = await enrichUserWithVipTotals(freshSender, true).catch(() => freshSender);

  const updated = await getRoomDetailsFromSupabase(roomId);
  return {
    user: enrichedSender,
    room: updated.room,
    extras: updated.extras,
    gift,
    quantity: safeQty,
    recipientIds: recipients.map((r) => r.id),
    recipientNames: recipients.map((r) => r.displayName),
    luckyMultiplier,
    luckyBonusCoins,
  };
}

export async function spinRoomLuckyWheelInSupabase(
  roomId: string,
  user: User
): Promise<LuckyWheelResult> {
  const [{ data: senderRow }, { data: roomRow }, state] = await Promise.all([
    supabase.from('sada_users').select(USER_COLUMNS).eq('id', user.id).maybeSingle(),
    supabase.from('sada_rooms').select(ROOM_COLUMNS).eq('id', roomId).maybeSingle(),
    getPlatformState(),
  ]);

  if (!roomRow) throw new Error('الغرفة غير موجودة.');
  const freshUser = senderRow ? rowToUser(senderRow) : { ...user };
  const wheelCost = state.settings.roomWheelCost;

  if (freshUser.coins < wheelCost) {
    throw new Error(
      `رصيد الكوينز غير كافٍ. تحتاج إلى ${wheelCost} كوينز لتدوير دولاب الحظ.`
    );
  }

  const nowDate = new Date();
  const now = nowDate.toISOString();
  freshUser.coins -= wheelCost;

  const segments = state.settings.roomWheelSegments;
  const weights = segments.map((s) => Math.max(1, s.weight || 10));
  const totalW = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalW;
  let segmentIndex = 0;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      segmentIndex = i;
      break;
    }
  }
  const segment = segments[segmentIndex];

  const seats = (Array.isArray(roomRow.seats) ? roomRow.seats : []) as Room['seats'];
  const nextSeats = seats.map((s) => ({ ...s }));

  if (segment.rewardType === 'coins' && segment.coinsAmount) {
    freshUser.coins += segment.coinsAmount;
    await recordTransaction({
      userId: freshUser.id,
      type: 'prize',
      amount: segment.coinsAmount,
      currency: 'coins',
      description: `جائزة دولاب الحظ في ${String(roomRow.title)}: ${segment.label}`,
      timestamp: now,
    });
  } else if (segment.rewardType === 'frame' && segment.frameId) {
    if (!freshUser.unlockedFrames.includes(segment.frameId)) {
      freshUser.unlockedFrames.push(segment.frameId);
    }
    freshUser.frameId = segment.frameId;
    freshUser.tempFrameExpiresAt = new Date(
      nowDate.getTime() + 24 * 60 * 60 * 1000
    ).toISOString();
    const seated = nextSeats.find((s) => s.userId === freshUser.id);
    if (seated) seated.frameId = segment.frameId;
  }

  if (segment.xpAmount) {
    freshUser.xp += segment.xpAmount;
    freshUser.level = computeLevelFromXp(freshUser.xp);
    const seated = nextSeats.find((s) => s.userId === freshUser.id);
    if (seated) seated.level = freshUser.level;
  }

  const wheelMessage: RoomMessage = {
    id: genId('msg'),
    userId: freshUser.id,
    displayName: freshUser.displayName,
    level: freshUser.level,
    isAdmin: freshUser.is_admin,
    text: `🎉 مبروك لـ ${freshUser.displayName} الفوز بـ ${segment.label} من عجلة الحظ!`,
    type: 'wheel',
    timestamp: now,
  };

  await Promise.all([
    supabase
      .from('sada_users')
      .update({
        coins: freshUser.coins,
        xp: freshUser.xp,
        level: freshUser.level,
        frame_id: freshUser.frameId,
        unlocked_frames: freshUser.unlockedFrames,
        temp_frame_expires_at: freshUser.tempFrameExpiresAt || null,
      })
      .eq('id', freshUser.id),
    supabase.from('sada_rooms').update({ seats: nextSeats }).eq('id', roomId),
    supabase.from('sada_room_messages').insert({
      id: wheelMessage.id,
      room_id: roomId,
      user_id: wheelMessage.userId,
      display_name: wheelMessage.displayName,
      level: wheelMessage.level,
      is_admin: wheelMessage.isAdmin,
      vip_tier: null,
      host_badge: null,
      female_verified_badge: null,
      text: wheelMessage.text,
      type: wheelMessage.type,
      timestamp: wheelMessage.timestamp,
    }),
  ]);

  const updated = await getRoomDetailsFromSupabase(roomId);
  return {
    segmentIndex,
    segment,
    user: freshUser,
    room: updated.room,
    message: wheelMessage,
  };
}

export async function updateRoomSettingsInSupabase(
  roomId: string,
  actor: User,
  patch: {
    maxSeats?: number;
    hostAvatar?: string;
    coverImage?: string;
    backgroundImage?: string;
    description?: string;
    title?: string;
    requireMicPermission?: boolean;
    agencyLockEnabled?: boolean;
    agencyLockPassword?: string;
  }
): Promise<Room> {
  const [{ data: roomRow }, extras] = await Promise.all([
    supabase.from('sada_rooms').select(ROOM_COLUMNS).eq('id', roomId).maybeSingle(),
    getRoomExtrasFromSupabase(roomId),
  ]);
  if (!roomRow) throw new Error('الغرفة غير موجودة.');

  const hasStandardSettings =
    patch.maxSeats !== undefined ||
    patch.hostAvatar !== undefined ||
    patch.coverImage !== undefined ||
    patch.backgroundImage !== undefined ||
    patch.description !== undefined ||
    patch.title !== undefined ||
    patch.requireMicPermission !== undefined;
  const isAllowed =
    actor.is_admin ||
    String(roomRow.host_id) === actor.id ||
    extras.deputyIds.includes(actor.id) ||
    extras.moderatorIds.includes(actor.id);
  if (hasStandardSettings && !isAllowed) {
    throw new Error('هذه الصلاحية مخصصة للوكيل ونائب الوكيل والمشرفين فقط.');
  }
  const hasAgencyLockSettings =
    patch.agencyLockEnabled !== undefined || patch.agencyLockPassword !== undefined;
  if (
    hasAgencyLockSettings &&
    !(await isRoomAgencyOwnerOrHostFromData(String(roomRow.host_id), actor.id))
  ) {
    throw new Error('قفل الوكالة مخصص للوكيل والمضيفين فقط.');
  }
  const nextAgencyLockPassword =
    typeof patch.agencyLockPassword === 'string' && patch.agencyLockPassword.length > 0
      ? patch.agencyLockPassword
      : extras.agencyLockPassword || '';
  const nextAgencyLockEnabled =
    typeof patch.agencyLockEnabled === 'boolean'
      ? patch.agencyLockEnabled
      : extras.agencyLockEnabled === true;
  if (
    hasAgencyLockSettings &&
    typeof patch.agencyLockPassword === 'string' &&
    patch.agencyLockPassword.length > 0 &&
    !/^[\p{L}\p{N}]{4}$/u.test(patch.agencyLockPassword)
  ) {
    throw new Error('يجب أن يتكون الرمز السري من أربعة أرقام أو أحرف.');
  }
  if (
    hasAgencyLockSettings &&
    nextAgencyLockEnabled &&
    !/^[\p{L}\p{N}]{4}$/u.test(nextAgencyLockPassword)
  ) {
    throw new Error('أدخل رمزاً سرياً من أربعة أرقام أو أحرف لتفعيل القفل.');
  }

  const updates: Record<string, unknown> = {};
  if (typeof patch.title === 'string' && patch.title.trim().length >= 3) {
    updates.title = patch.title.trim().slice(0, 60);
  }
  if (typeof patch.description === 'string') {
    updates.description = patch.description.trim().slice(0, 260);
  }
  if (typeof patch.hostAvatar === 'string' && patch.hostAvatar.trim()) {
    updates.host_avatar = patch.hostAvatar;
  }
  if (typeof patch.coverImage === 'string' && patch.coverImage.trim()) {
    updates.cover_url = patch.coverImage;
  }
  if (typeof patch.backgroundImage === 'string' && patch.backgroundImage.trim()) {
    const isLuxuryStoreBg = STORE_LUXURY_BACKGROUNDS.some(
      (b) => b.id === patch.backgroundImage
    );
    if (isLuxuryStoreBg && !actor.is_admin) {
      const platState = await getPlatformState();
      const actorOwned = platState.settings.userOwnedBackgrounds?.[actor.id] || [];
      const hostOwned =
        platState.settings.userOwnedBackgrounds?.[String(roomRow.host_id)] || [];
      if (
        !actorOwned.includes(patch.backgroundImage) &&
        !hostOwned.includes(patch.backgroundImage)
      ) {
        throw new Error('هذه الخلفية الفخمة متاحة بعد شرائها من المتجر بـ 5,000 كوينز.');
      }
    }
    updates.background_url = patch.backgroundImage;
  }

  if (typeof patch.maxSeats === 'number') {
    const allowed = [6, 12, 18, 24];
    const requestedCount = patch.maxSeats;
    const targetCount = allowed.includes(patch.maxSeats)
      ? patch.maxSeats
      : allowed.reduce((closest, count) =>
          Math.abs(count - requestedCount) < Math.abs(closest - requestedCount)
            ? count
            : closest
        );
    const currentSeats = Array.isArray(roomRow.seats)
      ? (roomRow.seats as Room['seats'])
      : [];
    const nextSeats: Room['seats'] = [];
    for (let i = 0; i < targetCount; i++) {
      const existing = currentSeats.find((s) => s.seatIndex === i);
      if (existing) {
        nextSeats.push({ ...existing, seatIndex: i });
      } else {
        nextSeats.push({
          seatIndex: i,
          userId: null,
          displayName: null,
          avatarUrl: null,
          frameId: null,
          level: null,
          isMuted: false,
          isLocked: false,
          isSpeaking: false,
          receivedDiamonds: 0,
        });
      }
    }
    updates.max_seats = targetCount;
    updates.seats = nextSeats;
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('sada_rooms').update(updates).eq('id', roomId);
    if (error) throw new Error('تعذّر حفظ إعدادات الوكالة.');
  }
  if (typeof patch.requireMicPermission === 'boolean') {
    await saveRoomExtrasConfig(roomId, (current) => ({
      ...current,
      requireMicPermission: patch.requireMicPermission,
    }));
  }
  if (hasAgencyLockSettings) {
    await saveRoomExtrasConfig(roomId, (current) => {
      return {
        ...current,
        agencyLockEnabled: nextAgencyLockEnabled,
        agencyLockPassword: nextAgencyLockPassword,
      };
    });
  }

  const updated = await getRoomDetailsFromSupabase(roomId);
  return updated.room;
}

export async function adminControlRoomInSupabase(
  roomId: string,
  actor: User,
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
): Promise<{ seats: Room['seats']; extras: RoomExtrasConfig }> {
  const [{ data: roomRow }, currentExtras] = await Promise.all([
    supabase.from('sada_rooms').select(ROOM_COLUMNS).eq('id', roomId).maybeSingle(),
    getRoomExtrasFromSupabase(roomId, { forceRefresh: true }),
  ]);
  if (!roomRow) throw new Error('الغرفة غير موجودة.');

  const isOwnerOrAdmin = actor.is_admin || String(roomRow.host_id) === actor.id;
  const { data: hostUser, error: hostUserError } = await supabase
    .from('sada_users')
    .select('agency_id')
    .eq('id', String(roomRow.host_id))
    .maybeSingle();
  if (hostUserError) throw new Error(`تعذّر التحقق من وكالة الغرفة: ${hostUserError.message}`);
  const { data: agency, error: agencyError } = hostUser?.agency_id
    ? await supabase
        .from('sada_agencies')
        .select('owner_id, host_ids')
        .eq('id', String(hostUser.agency_id))
        .maybeSingle()
    : { data: null, error: null };
  if (agencyError) throw new Error(`تعذّر التحقق من مالك الوكالة: ${agencyError.message}`);
  const isAgencyOwner = agency
    ? String(agency.owner_id) === actor.id
    : String(roomRow.host_id) === actor.id;
  const isManager =
    isOwnerOrAdmin ||
    isAgencyOwner ||
    (Array.isArray(agency?.host_ids) &&
      agency.host_ids.some((hostId: unknown) => String(hostId) === actor.id)) ||
    currentExtras.deputyIds.includes(actor.id) ||
    currentExtras.moderatorIds.includes(actor.id);
  if (!isManager) {
    throw new Error('ليست لديك صلاحية إدارة المقاعد.');
  }

  const currentSeats = (Array.isArray(roomRow.seats) ? roomRow.seats : []) as Room['seats'];
  const actorRole = resolveActorRoleLabel(String(roomRow.host_id), currentExtras, actor);
  let nextSeats = currentSeats.map((s) => ({ ...s }));
  let nextExtras = { ...currentExtras };
  let systemNotice = '';

  const resolveTargetName = (uid: string, explicit?: string) =>
    explicit ||
    currentSeats.find((s) => s.userId === uid)?.displayName ||
    currentExtras.kickedUserNames?.[uid] ||
    `عضو (${uid.slice(-4)})`;

  if (action.type === 'mute_all') {
    nextSeats = nextSeats.map((s) =>
      s.userId && s.userId !== actor.id
        ? { ...s, isMuted: true, isSpeaking: false }
        : s
    );
    nextExtras = await saveRoomExtrasConfig(roomId, (cur) => ({
      ...cur,
      modLogs: prependModLog(cur, {
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole,
        actionType: 'mute_all',
        details: 'كتم المايكروفون عن جميع المتحدثين',
      }),
    }));
    systemNotice = `🔇 قام ${actor.displayName} بكتم المايكروفون عن جميع المتحدثين.`;
  } else if (action.type === 'clear_all') {
    nextSeats = nextSeats.map((s) => ({
      ...s,
      userId: null,
      displayName: null,
      avatarUrl: null,
      frameId: null,
      level: null,
      isMuted: false,
      isSpeaking: false,
      femaleVerifiedBadge: null,
    }));
    nextExtras = await saveRoomExtrasConfig(roomId, (cur) => ({
      ...cur,
      modLogs: prependModLog(cur, {
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole,
        actionType: 'clear_all',
        details: 'إنزال جميع المتحدثين من المايكات',
      }),
    }));
    systemNotice = `🎙️ قام ${actor.displayName} بإنزال جميع المتحدثين من المايكات.`;
  } else if (action.type === 'mute_user') {
    const targetName = resolveTargetName(action.targetUserId);
    nextSeats = nextSeats.map((s) =>
      s.userId === action.targetUserId
        ? { ...s, isMuted: action.isMuted, isSpeaking: action.isMuted ? false : s.isSpeaking }
        : s
    );
    nextExtras = await saveRoomExtrasConfig(roomId, (cur) => ({
      ...cur,
      mutedUserIds: action.isMuted
        ? Array.from(new Set([...cur.mutedUserIds, action.targetUserId]))
        : cur.mutedUserIds.filter((id) => id !== action.targetUserId),
      modLogs: prependModLog(cur, {
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole,
        actionType: 'mute_user',
        targetUserId: action.targetUserId,
        targetName,
        details: action.isMuted ? `كتم مايك ${targetName}` : `فك كتم مايك ${targetName}`,
      }),
    }));
  } else if (action.type === 'kick_seat') {
    const targetName = resolveTargetName(action.targetUserId);
    nextSeats = nextSeats.map((s) =>
      s.userId === action.targetUserId
        ? {
            ...s,
            userId: null,
            displayName: null,
            avatarUrl: null,
            frameId: null,
            level: null,
            isMuted: false,
            isSpeaking: false,
            femaleVerifiedBadge: null,
          }
        : s
    );
    nextExtras = await saveRoomExtrasConfig(roomId, (cur) => ({
      ...cur,
      modLogs: prependModLog(cur, {
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole,
        actionType: 'kick_seat',
        targetUserId: action.targetUserId,
        targetName,
        details: `إنزال ${targetName} من المايك`,
      }),
    }));
  } else if (action.type === 'temporary_kick_room' || action.type === 'kick_room') {
    if (action.type === 'kick_room' && !isAgencyOwner) {
      throw new Error('الحظر الدائم مخصص لمالك الوكالة فقط.');
    }
    if (action.targetUserId === String(roomRow.host_id)) {
      throw new Error('لا يمكن طرد مالك الوكالة.');
    }
    if (
      action.targetUserId === String(agency?.owner_id || '') ||
      action.targetUserId === String(roomRow.host_id)
    ) {
      throw new Error('لا يمكن حظر مالك الوكالة.');
    }
    const targetName = resolveTargetName(action.targetUserId, action.targetName);
    nextSeats = nextSeats.map((s) =>
      s.userId === action.targetUserId
        ? {
            ...s,
            userId: null,
            displayName: null,
            avatarUrl: null,
            frameId: null,
            level: null,
            isMuted: false,
            isSpeaking: false,
            femaleVerifiedBadge: null,
          }
        : s
    );
    nextExtras = await saveRoomExtrasConfig(roomId, (cur) => {
      const isTemporary = action.type === 'temporary_kick_room';
      const temporaryKickExpiresAt = { ...(cur.temporaryKickExpiresAt || {}) };
      if (isTemporary) {
        temporaryKickExpiresAt[action.targetUserId] = new Date(
          Date.now() + 72 * 60 * 60 * 1000
        ).toISOString();
      } else {
        delete temporaryKickExpiresAt[action.targetUserId];
      }
      return {
        ...cur,
        kickedUserIds: isTemporary
          ? cur.kickedUserIds.filter((id) => id !== action.targetUserId)
          : Array.from(new Set([...cur.kickedUserIds, action.targetUserId])),
        temporaryKickExpiresAt,
        kickedUserNames: {
          ...(cur.kickedUserNames || {}),
          [action.targetUserId]: targetName,
        },
        deputyIds: isTemporary
          ? cur.deputyIds
          : cur.deputyIds.filter((id) => id !== action.targetUserId),
        moderatorIds: isTemporary
          ? cur.moderatorIds
          : cur.moderatorIds.filter((id) => id !== action.targetUserId),
        modLogs: prependModLog(cur, {
          actorId: actor.id,
          actorName: actor.displayName,
          actorRole,
          actionType: 'kick_room',
          targetUserId: action.targetUserId,
          targetName,
          details: isTemporary
            ? `طرد ${targetName} لمدة 3 أيام`
            : `حظر ${targetName} من الوكالة نهائياً`,
        }),
      };
    });
    systemNotice = `⛔ تم ${action.type === 'temporary_kick_room' ? 'طرد' : 'حظر'} ${targetName} بواسطة ${actor.displayName}.`;
  } else if (action.type === 'unban_room') {
    if (!isAgencyOwner) throw new Error('فك الحظر مخصص لمالك الوكالة فقط.');
    const targetName = resolveTargetName(action.targetUserId);
    nextExtras = await saveRoomExtrasConfig(roomId, (cur) => ({
      ...cur,
      kickedUserIds: cur.kickedUserIds.filter((id) => id !== action.targetUserId),
      temporaryKickExpiresAt: Object.keys(cur.temporaryKickExpiresAt || {}).reduce<
        Record<string, string>
      >((result, id) => {
        if (id !== action.targetUserId) {
          result[id] = cur.temporaryKickExpiresAt![id];
        }
        return result;
      }, {}),
      modLogs: prependModLog(cur, {
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole,
        actionType: 'unban_room',
        targetUserId: action.targetUserId,
        targetName,
        details: `فك الطرد عن ${targetName}`,
      }),
    }));
  } else if (action.type === 'toggle_deputy') {
    if (!isOwnerOrAdmin) throw new Error('تعيين نائب الوكيل مخصص لمالك الوكالة فقط.');
    nextExtras = await saveRoomExtrasConfig(roomId, (cur) => {
      const exists = cur.deputyIds.includes(action.targetUserId);
      return {
        ...cur,
        deputyIds: exists
          ? cur.deputyIds.filter((id) => id !== action.targetUserId)
          : [...cur.deputyIds, action.targetUserId],
      };
    });
    const isNow = nextExtras.deputyIds.includes(action.targetUserId);
    systemNotice = isNow
      ? `👑 تم تعيين ${action.targetName || 'العضو'} نائباً للوكيل.`
      : `تم سحب صلاحية نائب الوكيل من ${action.targetName || 'العضو'}.`;
  } else if (action.type === 'toggle_moderator') {
    if (!isOwnerOrAdmin && !currentExtras.deputyIds.includes(actor.id)) {
      throw new Error('تعيين المشرفين مخصص للوكيل أو نائبه فقط.');
    }
    nextExtras = await saveRoomExtrasConfig(roomId, (cur) => {
      const exists = cur.moderatorIds.includes(action.targetUserId);
      return {
        ...cur,
        moderatorIds: exists
          ? cur.moderatorIds.filter((id) => id !== action.targetUserId)
          : [...cur.moderatorIds, action.targetUserId],
      };
    });
    const isNow = nextExtras.moderatorIds.includes(action.targetUserId);
    systemNotice = isNow
      ? `🛡️ تم ترقية ${action.targetName || 'العضو'} كمشرف في الوكالة.`
      : `تم سحب صلاحية الإشراف من ${action.targetName || 'العضو'}.`;
  }

  const { error: adminSeatUpdateError } = await supabase
    .from('sada_rooms')
    .update({ seats: nextSeats })
    .eq('id', roomId);
  if (adminSeatUpdateError) {
    throw new Error(`تعذّر تحديث مقاعد الغرفة: ${adminSeatUpdateError.message}`);
  }

  if (systemNotice) {
    await supabase.from('sada_room_messages').insert({
      id: genId('msg'),
      room_id: roomId,
      user_id: actor.id,
      display_name: actor.displayName,
      level: actor.level,
      is_admin: actor.is_admin,
      vip_tier: null,
      host_badge: null,
      female_verified_badge: null,
      text: systemNotice,
      type: 'system',
      timestamp: new Date().toISOString(),
    });
  }

  return { seats: nextSeats, extras: nextExtras };
}

export async function updateRoomMusicInSupabase(
  roomId: string,
  musicState: RoomMusicState | null
): Promise<RoomExtrasConfig> {
  return saveRoomExtrasConfig(roomId, (cur) => ({
    ...cur,
    musicState,
  }));
}

export async function incrementRoomPlayVolumeInSupabase(
  roomId: string,
  coinsAmount: number,
  playerUser?: Pick<User, 'id' | 'displayName' | 'avatarUrl' | 'frameId'> | null
): Promise<RoomExtrasConfig> {
  const safeAdd = Math.max(0, Math.round(coinsAmount));
  if (safeAdd <= 0) return getRoomExtrasFromSupabase(roomId);
  return saveRoomExtrasConfig(roomId, (cur) => {
    const nextPlayers = { ...(cur.players || {}) };
    if (playerUser?.id) {
      const prev = nextPlayers[playerUser.id];
      nextPlayers[playerUser.id] = {
        userId: playerUser.id,
        displayName: playerUser.displayName,
        avatarUrl: playerUser.avatarUrl,
        frameId: playerUser.frameId,
        playCoins: (prev?.playCoins || 0) + safeAdd,
      };
    }
    return {
      ...cur,
      players: nextPlayers,
      playVolumeCoins: (cur.playVolumeCoins || 0) + safeAdd,
    };
  });
}

export async function startRoomContestInSupabase(
  roomId: string,
  actor: User,
  payload: {
    title: string;
    mode: RoomLiveContest['mode'];
    prizeLabel: string;
    agencyQuiz?: RoomLiveContest['agencyQuiz'];
  }
): Promise<RoomExtrasConfig> {
  const controlRoom = await authorizeRoomControlAction(
    roomId,
    actor,
    'إطلاق المسابقات مخصص لمدير الغرفة أو نائبه أو مضيفيها.'
  );
  if (
    payload.agencyQuiz &&
    !(await isRoomOrAgencyOwnerFromData({ hostId: controlRoom.host_id }, { id: actor.id }))
  ) {
    throw new Error('إطلاق المسابقة الثقافية مخصص لصاحب الغرفة أو الوكالة فقط.');
  }

  const cleanTitle = (payload.title || '').trim().slice(0, 80);
  if (cleanTitle.length < 3) {
    throw new Error('يرجى كتابة عنوان واضح للمسابقة (3 أحرف على الأقل).');
  }

  const cleanPrize = (payload.prizeLabel || '').trim().slice(0, 60) || 'لقب الفائز الملكي 🏆';
  const now = new Date().toISOString();
  let agencyQuiz: RoomLiveContest['agencyQuiz'] = null;
  if (payload.agencyQuiz) {
    const questions = payload.agencyQuiz.questions;
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('أضف سؤالاً واحداً على الأقل للمسابقة الثقافية.');
    }
    if (
      questions.some(
        (question) =>
          !question.question.trim() ||
          question.options.length !== 4 ||
          question.options.some((option) => !option.trim()) ||
          question.correctIndex < 0 ||
          question.correctIndex > 3
      )
    ) {
      throw new Error('تأكد من كتابة السؤال والخيارات الأربعة وتحديد الإجابة الصحيحة.');
    }
    agencyQuiz = {
      questions: questions.map((question) => ({ ...question, seconds: 8 })),
      currentIndex: 0,
      questionStartedAt: now,
      answers: {},
    };
  }

  const contest: RoomLiveContest = {
    id: genId('contest'),
    title: cleanTitle,
    mode: payload.mode,
    prizeLabel: cleanPrize,
    hostId: actor.id,
    hostName: actor.displayName,
    status: 'active',
    entries: [],
    voterIds: [],
    winnerUserId: null,
    winnerName: null,
    createdAt: now,
    endedAt: null,
    agencyQuiz,
  };

  const nextExtras = await saveRoomExtrasConfig(roomId, (cur) => ({
    ...cur,
    activeContest: contest,
  }));

  const { error: messageError } = await supabase.from('sada_room_messages').insert({
    id: genId('msg'),
    room_id: roomId,
    user_id: actor.id,
    display_name: actor.displayName,
    level: actor.level,
    is_admin: actor.is_admin,
    vip_tier: null,
    host_badge: null,
    female_verified_badge: null,
    text: `🏆 أطلق ${actor.displayName} مسابقة مباشرة: "${cleanTitle}" · الجائزة: ${cleanPrize}`,
    type: 'system',
    timestamp: now,
  });
  if (messageError) throw new Error(`تعذّر نشر إعلان المسابقة: ${messageError.message}`);

  return nextExtras;
}

export async function joinRoomContestInSupabase(
  roomId: string,
  user: User,
  note?: string
): Promise<RoomExtrasConfig> {
  const cleanNote = (note || '').trim().slice(0, 100);
  return saveRoomExtrasConfig(roomId, (cur) => {
    const contest = cur.activeContest;
    if (!contest || contest.status !== 'active') {
      throw new Error('لا توجد مسابقة نشطة حالياً داخل الوكالة.');
    }
    if (contest.entries.some((e) => e.userId === user.id)) {
      return cur;
    }
    const nextContest: RoomLiveContest = {
      ...contest,
      entries: [
        ...contest.entries,
        {
          userId: user.id,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          frameId: user.frameId,
          votes: 0,
          note: cleanNote || undefined,
          joinedAt: new Date().toISOString(),
        },
      ],
    };
    return { ...cur, activeContest: nextContest };
  });
}

export async function submitRoomQuizAnswerInSupabase(
  roomId: string,
  user: User,
  answerIndex: number
): Promise<RoomExtrasConfig> {
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
    throw new Error('الإجابة المختارة غير صالحة.');
  }
  return saveRoomExtrasConfig(roomId, (cur) => {
    const contest = cur.activeContest;
    const quiz = contest?.agencyQuiz;
    const question = quiz?.questions[quiz.currentIndex];
    if (!contest || contest.status !== 'active' || !quiz || !question) {
      throw new Error('لا توجد جولة ثقافية نشطة حالياً.');
    }
    if (quiz.answers?.[user.id] !== undefined) {
      throw new Error('تم تسجيل إجابتك لهذه الجولة مسبقاً.');
    }
    const startedAt = Date.parse(quiz.questionStartedAt || contest.createdAt);
    if (Date.now() >= startedAt + question.seconds * 1000) {
      throw new Error('انتهى وقت الإجابة عن هذا السؤال.');
    }
    return {
      ...cur,
      activeContest: {
        ...contest,
        agencyQuiz: {
          ...quiz,
          answers: { ...(quiz.answers || {}), [user.id]: answerIndex },
        },
      },
    };
  });
}

export async function advanceRoomQuizQuestionInSupabase(
  roomId: string,
  actor: User
): Promise<RoomExtrasConfig> {
  const controlRoom = await authorizeRoomControlAction(
    roomId,
    actor,
    'إدارة المسابقة الثقافية مخصصة لوكيل الغرفة فقط.'
  );
  if (!(await isRoomOrAgencyOwnerFromData({ hostId: controlRoom.host_id }, { id: actor.id }))) {
    throw new Error('إدارة المسابقة الثقافية مخصصة لوكيل الغرفة فقط.');
  }

  let resultMessage = '';
  const now = new Date().toISOString();
  const nextExtras = await saveRoomExtrasConfig(roomId, (cur) => {
    const contest = cur.activeContest;
    const quiz = contest?.agencyQuiz;
    const question = quiz?.questions[quiz.currentIndex];
    if (!contest || contest.status !== 'active' || !quiz || !question) {
      throw new Error('لا توجد جولة ثقافية نشطة حالياً.');
    }
    const startedAt = Date.parse(quiz.questionStartedAt || contest.createdAt);
    if (Date.now() < startedAt + question.seconds * 1000) {
      throw new Error('لم ينته وقت السؤال بعد.');
    }

    const answers = quiz.answers || {};
    const answerCount = Object.values(answers).filter(
      (answer) => answer === question.correctIndex
    ).length;
    const totalAnswers = Object.keys(answers).length;
    resultMessage =
      `✅ نتيجة السؤال ${quiz.currentIndex + 1}: الإجابة الصحيحة «${question.options[question.correctIndex]}»` +
      ` · إجابات صحيحة ${answerCount}/${totalAnswers}`;

    const nextIndex = quiz.currentIndex + 1;
    if (nextIndex >= quiz.questions.length) {
      return {
        ...cur,
        activeContest: {
          ...contest,
          status: 'ended',
          endedAt: now,
          winnerName: 'انتهت المسابقة الثقافية',
          agencyQuiz: { ...quiz, answers: {} },
        },
      };
    }
    return {
      ...cur,
      activeContest: {
        ...contest,
        agencyQuiz: {
          ...quiz,
          currentIndex: nextIndex,
          questionStartedAt: now,
          answers: {},
        },
      },
    };
  });

  const { error } = await supabase.from('sada_room_messages').insert({
    id: genId('msg'),
    room_id: roomId,
    user_id: actor.id,
    display_name: actor.displayName,
    level: actor.level,
    is_admin: actor.is_admin,
    vip_tier: null,
    host_badge: null,
    female_verified_badge: null,
    text: resultMessage,
    type: 'system',
    timestamp: now,
  });
  if (error) throw new Error(`تعذّر نشر نتيجة السؤال في دردشة الغرفة: ${error.message}`);
  return nextExtras;
}

export async function voteRoomContestInSupabase(
  roomId: string,
  voter: User,
  contestantUserId: string
): Promise<RoomExtrasConfig> {
  return saveRoomExtrasConfig(roomId, (cur) => {
    const contest = cur.activeContest;
    if (!contest || contest.status !== 'active') {
      throw new Error('التصويت متاح فقط أثناء المسابقة النشطة.');
    }
    if (contest.voterIds.includes(voter.id)) {
      throw new Error('لقد قمت بالتصويت مسبقاً في هذه المسابقة.');
    }
    if (!contest.entries.some((e) => e.userId === contestantUserId)) {
      throw new Error('المتسابق غير مسجل في هذه المسابقة.');
    }
    const nextContest: RoomLiveContest = {
      ...contest,
      voterIds: [...contest.voterIds, voter.id],
      entries: contest.entries.map((e) =>
        e.userId === contestantUserId ? { ...e, votes: (e.votes || 0) + 1 } : e
      ),
    };
    return { ...cur, activeContest: nextContest };
  });
}

export async function finishRoomContestInSupabase(
  roomId: string,
  actor: User,
  winnerUserId?: string
): Promise<RoomExtrasConfig> {
  const controlRoom = await authorizeRoomControlAction(
    roomId,
    actor,
    'إنهاء المسابقة مخصص لمدير الغرفة أو نائبه أو مضيفيها.'
  );
  const isQuizOwner = await isRoomOrAgencyOwnerFromData(
    { hostId: controlRoom.host_id },
    { id: actor.id }
  );

  let chosenWinnerName: string | null = null;
  let contestTitle = '';

  const nextExtras = await saveRoomExtrasConfig(roomId, (cur) => {
    const contest = cur.activeContest;
    if (!contest) return cur;
    if (contest.agencyQuiz && !isQuizOwner) {
      throw new Error('إدارة المسابقة الثقافية مخصصة لوكيل الغرفة فقط.');
    }
    contestTitle = contest.title;

    const sortedEntries = [...contest.entries].sort((a, b) => (b.votes || 0) - (a.votes || 0));
    const winner =
      (winnerUserId ? contest.entries.find((e) => e.userId === winnerUserId) : null) ||
      sortedEntries[0] ||
      null;
    chosenWinnerName = winner?.displayName || null;

    const nextContest: RoomLiveContest = {
      ...contest,
      status: 'ended',
      winnerUserId: winner?.userId || null,
      winnerName: winner?.displayName || null,
      endedAt: new Date().toISOString(),
    };
    return { ...cur, activeContest: nextContest };
  });

  if (contestTitle) {
    const { error } = await supabase.from('sada_room_messages').insert({
      id: genId('msg'),
      room_id: roomId,
      user_id: actor.id,
      display_name: actor.displayName,
      level: actor.level,
      is_admin: actor.is_admin,
      vip_tier: null,
      host_badge: null,
      female_verified_badge: null,
      text: chosenWinnerName
        ? `🎉 انتهت مسابقة "${contestTitle}" — الفائز المعلن: 🏆 ${chosenWinnerName}!`
        : `🏁 أطلق ${actor.displayName} ختام مسابقة "${contestTitle}".`,
      type: 'system',
      timestamp: new Date().toISOString(),
    });
    if (error) throw new Error(`تعذّر نشر نتيجة المسابقة في دردشة الغرفة: ${error.message}`);
  }

  return nextExtras;
}

export async function clearRoomContestInSupabase(
  roomId: string,
  actor: User
): Promise<RoomExtrasConfig> {
  const controlRoom = await authorizeRoomControlAction(
    roomId,
    actor,
    'إغلاق المسابقة مخصص لمدير الغرفة أو نائبه أو مضيفيها.'
  );
  const isQuizOwner = await isRoomOrAgencyOwnerFromData(
    { hostId: controlRoom.host_id },
    { id: actor.id }
  );

  return saveRoomExtrasConfig(roomId, (cur) => {
    if (cur.activeContest?.agencyQuiz && !isQuizOwner) {
      throw new Error('إدارة المسابقة الثقافية مخصصة لوكيل الغرفة فقط.');
    }
    return { ...cur, activeContest: null };
  });
}
