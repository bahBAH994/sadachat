import type {
  GiftItem,
  LuckyWheelResult,
  LuckyWheelSegment,
  Room,
  RoomEntryEvent,
  RoomMessage,
  User,
} from '../types';
import {
  computeLevelFromXp,
  genId,
  getVipTierLabel,
  GIFT_CATALOG,
  isFemaleVoiceLocked,
  makeEmptySeats,
  rollLuckyGiftMultiplier,
} from './sadaCatalog';
import {
  applyHostEarningsAndAgencyCommission,
  getPlatformState,
  purgeExpiredRewardsOnUser,
  recordTransaction,
  rowToRoom,
  rowToRoomMessage,
  rowToUser,
} from './sadaMappers';
import { supabase } from './supabase';

export async function listActiveRooms(): Promise<Room[]> {
  const [{ data: roomRows, error }, { data: msgRows }] = await Promise.all([
    supabase
      .from('sada_rooms')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('sada_room_messages')
      .select('*')
      .order('timestamp', { ascending: true })
      .limit(200),
  ]);

  if (error) {
    throw new Error('تعذّر تحميل الغرف الصوتية من Supabase.');
  }

  const msgsByRoom = new Map<string, RoomMessage[]>();
  for (const m of msgRows || []) {
    const rid = String(m.room_id);
    const list = msgsByRoom.get(rid) || [];
    list.push(rowToRoomMessage(m));
    msgsByRoom.set(rid, list);
  }

  return (roomRows || []).map((r) => {
    const { password: _pwd, ...sanitized } = rowToRoom(
      r,
      (msgsByRoom.get(String(r.id)) || []).slice(-80)
    );
    return sanitized;
  });
}

export async function createRoomInSupabase(
  user: User,
  payload: {
    title: string;
    category?: Room['category'];
    description?: string;
    maxSeats?: 6 | 8;
    isPrivate?: boolean;
    password?: string;
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

  const seatsCount = payload.maxSeats === 6 ? 6 : 8;
  const now = new Date().toISOString();
  const roomId = genId('room');
  const seats = makeEmptySeats(seatsCount, user);

  const row = {
    id: roomId,
    title: cleanTitle.slice(0, 60),
    category: payload.category || 'حوار',
    description:
      (payload.description || '').trim().slice(0, 180) ||
      'مجلس صوتي فاخر للحوار والتعارف في صَدَى.',
    host_id: user.id,
    host_name: user.displayName,
    host_avatar: user.avatarUrl,
    cover_image: payload.category === 'مسابقات' ? 'competition_crest' : 'royal_stage',
    is_private: Boolean(payload.isPrivate),
    password: cleanPin || null,
    max_seats: seatsCount,
    seats,
    listeners_count: 1,
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
    text: `تم افتتاح المجلس الصوتي "${row.title}"، أهلاً بالجميع!`,
    type: 'system',
    timestamp: now,
  };

  const { error } = await supabase.from('sada_rooms').insert(row);
  if (error) {
    throw new Error('تعذّر إنشاء الغرفة الصوتية في Supabase.');
  }

  await supabase.from('sada_room_messages').insert({
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
}> {
  const [{ data: roomRow, error }, { data: msgRows }, state] = await Promise.all([
    supabase.from('sada_rooms').select('*').eq('id', roomId).maybeSingle(),
    supabase
      .from('sada_room_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('timestamp', { ascending: true })
      .limit(80),
    getPlatformState(),
  ]);

  if (error || !roomRow || !roomRow.is_active) {
    throw new Error('الغرفة الصوتية غير متاحة أو تم إغلاقها.');
  }

  const messages = (msgRows || []).map(rowToRoomMessage);
  const { password: _pwd, ...sanitized } = rowToRoom(roomRow, messages);

  return {
    room: sanitized,
    gifts: GIFT_CATALOG,
    wheelSegments: state.settings.roomWheelSegments,
    wheelCost: state.settings.roomWheelCost,
  };
}

export async function joinRoomInSupabase(
  roomId: string,
  user: User
): Promise<{ room: Room; entryEvent: RoomEntryEvent | null }> {
  await purgeExpiredRewardsOnUser(user);

  const { data: roomRow } = await supabase
    .from('sada_rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();

  if (!roomRow) throw new Error('الغرفة غير موجودة.');

  const nextListeners = Number(roomRow.listeners_count || 0) + 1;
  await supabase
    .from('sada_rooms')
    .update({ listeners_count: nextListeners })
    .eq('id', roomId);

  let entryEvent: RoomEntryEvent | null = null;
  if (
    user.activeEntryId &&
    user.tempEntryExpiresAt &&
    Date.now() < new Date(user.tempEntryExpiresAt).getTime()
  ) {
    const nowIso = new Date().toISOString();
    entryEvent = {
      userId: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      frameId: user.frameId,
      level: user.level,
      entryId: user.activeEntryId,
      entryName: user.activeEntryName || 'دخولية ملكية',
      timestamp: nowIso,
    };

    const entryChatMsg: RoomMessage = {
      id: genId('msg'),
      userId: user.id,
      displayName: user.displayName,
      level: user.level,
      isAdmin: user.is_admin,
      vipTier: getVipTierLabel(user.level, user.is_admin),
      hostBadge: user.hostBadge || null,
      femaleVerifiedBadge: user.femaleVerifiedBadge || null,
      text:
        user.activeEntryId === 'entry_legendary_30d'
          ? `🐉👑 الدخولية الأسطورية الملكية: شرّف ${user.displayName} المجلس بحضوره الإمبراطوري!`
          : `🚘✨ موكب السيارة الذهبية: وصل ${user.displayName} إلى المجلس!`,
      type: 'entry',
      timestamp: nowIso,
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
  return { room: updated.room, entryEvent };
}

export async function leaveRoomInSupabase(roomId: string, userId: string): Promise<void> {
  const { data: roomRow } = await supabase
    .from('sada_rooms')
    .select('listeners_count, seats')
    .eq('id', roomId)
    .maybeSingle();

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

  await supabase
    .from('sada_rooms')
    .update({
      listeners_count: Math.max(0, Number(roomRow.listeners_count || 1) - 1),
      seats: updatedSeats,
    })
    .eq('id', roomId);
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
    const target = nextSeats.find((s) => s.seatIndex === action.seatIndex);
    if (!target || target.isLocked || target.userId) return nextSeats;
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
        : s.seatIndex === action.seatIndex
        ? {
            ...s,
            userId: user.id,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            frameId: user.frameId,
            level: user.level,
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
    if (String(roomRow.host_id) !== user.id && !user.is_admin) return nextSeats;
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
  } else if (action.type === 'speaking') {
    nextSeats = nextSeats.map((s) =>
      s.userId === user.id && !s.isMuted ? { ...s, isSpeaking: action.isSpeaking } : s
    );
  }

  await supabase.from('sada_rooms').update({ seats: nextSeats }).eq('id', roomId);
  return nextSeats;
}

export async function sendRoomChatInSupabase(
  roomId: string,
  user: User,
  text: string
): Promise<RoomMessage> {
  const cleanText = text.trim().slice(0, 300);
  if (!cleanText) throw new Error('الرسالة فارغة.');

  const chatMsg: RoomMessage = {
    id: genId('msg'),
    userId: user.id,
    displayName: user.displayName,
    level: user.level,
    isAdmin: user.is_admin,
    vipTier: getVipTierLabel(user.level, user.is_admin),
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
  const gift = GIFT_CATALOG.find((g) => g.id === giftId);
  if (!gift) throw new Error('الهدية غير متوفرة.');

  const { data: senderFreshRow } = await supabase
    .from('sada_users')
    .select('*')
    .eq('id', sender.id)
    .maybeSingle();
  const freshSender = senderFreshRow ? rowToUser(senderFreshRow) : { ...sender };

  if (freshSender.coins < gift.coinsCost) {
    throw new Error('رصيد الكوينز غير كافٍ لإرسال هذه الهدية.');
  }

  const { data: roomRow } = await supabase
    .from('sada_rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();
  if (!roomRow) throw new Error('الغرفة غير موجودة.');

  const recipientLookupId = targetUserId || String(roomRow.host_id);
  const { data: recRow } = await supabase
    .from('sada_users')
    .select('*')
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
    luckyMultiplier = rollLuckyGiftMultiplier(state.settings.luckyGiftMultipliers);
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

  const giftMessage: RoomMessage = {
    id: genId('msg'),
    userId: freshSender.id,
    displayName: freshSender.displayName,
    level: freshSender.level,
    isAdmin: freshSender.is_admin,
    vipTier: getVipTierLabel(freshSender.level, freshSender.is_admin),
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

  if (recipient.id === freshSender.id) {
    freshSender.diamonds = recipient.diamonds;
  }

  const updated = await getRoomDetailsFromSupabase(roomId);
  return {
    user: freshSender,
    room: updated.room,
    gift,
    luckyMultiplier,
    luckyBonusCoins,
  };
}

export async function spinRoomLuckyWheelInSupabase(
  roomId: string,
  user: User
): Promise<LuckyWheelResult> {
  const [{ data: senderRow }, { data: roomRow }, state] = await Promise.all([
    supabase.from('sada_users').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('sada_rooms').select('*').eq('id', roomId).maybeSingle(),
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
    text: `🎰 فاز ${freshUser.displayName} في دولاب الحظ بـ ${segment.glyph} ${segment.label}!`,
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
