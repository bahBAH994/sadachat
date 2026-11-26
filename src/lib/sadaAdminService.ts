import type {
  Agency,
  AgencyRequest,
  Competition,
  CulturalQuestionAdminItem,
  DeviceLock,
  FemaleVoiceVerificationRequest,
  GiftItem,
  GlobalAdminAnnouncement,
  HostJoinApplication,
  PlatformSettings,
  Room,
  SecurityLog,
  ShamCashRequest,
  UsdtDepositRequest,
  UsdtWithdrawalRequest,
  User,
  VipTierKey,
} from '../types';
import {
  genId,
  getGiftEffectTier,
  getRechargeRewardTier,
  getUserVipTierInfo,
  makeConversationId,
  setCustomVipIdsCache,
  STORE_3D_ITEMS,
  SUPER_ADMIN_EMAIL,
  TEMP_ONLY_FRAME_IDS,
} from './sadaCatalog';
import {
  AGENCY_COLUMNS,
  COMPETITION_COLUMNS,
  DEPOSIT_COLUMNS,
  DEVICE_LOCK_COLUMNS,
  FEMALE_VOICE_REQ_COLUMNS,
  getPlatformState,
  QUESTION_COLUMNS,
  recordTransaction,
  ROOM_COLUMNS,
  rowToAgency,
  rowToCompetition,
  rowToDeposit,
  rowToDeviceLock,
  rowToFemaleVoiceReq,
  rowToQuestion,
  rowToRoom,
  rowToSecurityLog,
  rowToUser,
  rowToWithdrawal,
  savePlatformState,
  SECURITY_LOG_COLUMNS,
  USER_COLUMNS,
  WITHDRAWAL_COLUMNS,
} from './sadaMappers';
import { fetchUsersVipTotalsBatch, invalidateUserVipCache } from './sadaVipService';
import { createRoomInSupabase } from './sadaRoomsService';
import { getAgencyRequestsInSupabase } from './sadaAgencyRequestService';
import { supabase } from './supabase';

export interface AdminOverviewPayload {
  users: User[];
  deviceLocks: DeviceLock[];
  securityLogs: SecurityLog[];
  rooms: Room[];
  competitions: Competition[];
  agencies: Agency[];
  agencyRequests: AgencyRequest[];
  culturalQuestions: CulturalQuestionAdminItem[];
  settings: PlatformSettings;
  usdtDeposits: UsdtDepositRequest[];
  usdtWithdrawals: UsdtWithdrawalRequest[];
  femaleVoiceRequests: FemaleVoiceVerificationRequest[];
  hostJoinApplications: HostJoinApplication[];
  monthlyTransactions: Array<{
    id: string;
    user_id: string;
    type: string;
    amount: number;
    currency: string;
    description: string;
    timestamp: string;
  }>;
  stats: {
    totalUsers: number;
    activeRooms: number;
    totalCoins: number;
    blockedAttempts: number;
    appPrizePoolCoins: number;
    pendingUsdtCount: number;
    pendingFemaleVoiceCount: number;
  };
}

export async function resetApplicationDataInSupabase(): Promise<void> {
  const { data, error } = await supabase.rpc(
    'sada_admin_reset_all_except_super_admin'
  );
  if (error) {
    throw new Error(`تعذّر تصفير بيانات التطبيق في Supabase: ${error.message}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('لم تُرجع قاعدة البيانات تأكيداً لعملية التصفير.');
  }
  if ((data as Record<string, unknown>).status !== 'reset') {
    throw new Error('لم تؤكد قاعدة البيانات اكتمال عملية التصفير.');
  }
}

export async function getAdminOverviewFromSupabase(): Promise<AdminOverviewPayload> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [
    usersRes,
    locksRes,
    logsRes,
    roomsRes,
    compsRes,
    agenciesRes,
    questionsRes,
    depositsRes,
    withdrawalsRes,
    femaleRes,
    usersCountRes,
    monthlyTransactionsRes,
    state,
    agencyRequests,
  ] = await Promise.all([
    supabase.from('sada_users').select(USER_COLUMNS).order('created_at', { ascending: false }),
    supabase.from('sada_device_locks').select(DEVICE_LOCK_COLUMNS).order('last_attempt_at', { ascending: false }),
    supabase.from('sada_security_logs').select(SECURITY_LOG_COLUMNS).order('timestamp', { ascending: false }).limit(80),
    supabase.from('sada_rooms').select(ROOM_COLUMNS).order('created_at', { ascending: false }),
    supabase.from('sada_competitions').select(COMPETITION_COLUMNS).order('ends_at', { ascending: false }),
    supabase.from('sada_agencies').select(AGENCY_COLUMNS).order('created_at', { ascending: false }),
    supabase.from('sada_cultural_questions').select(QUESTION_COLUMNS),
    supabase.from('sada_usdt_deposits').select(DEPOSIT_COLUMNS).order('created_at', { ascending: false }),
    supabase.from('sada_usdt_withdrawals').select(WITHDRAWAL_COLUMNS).order('created_at', { ascending: false }),
    supabase
      .from('sada_female_voice_requests')
      .select(FEMALE_VOICE_REQ_COLUMNS)
      .order('created_at', { ascending: false }),
    supabase.from('sada_users').select('id', { count: 'exact', head: true }),
    supabase
      .from('sada_transactions')
      .select('id, user_id, type, amount, currency, description, timestamp')
      .gte('timestamp', monthStart.toISOString())
      .in('type', ['host_earning', 'host_payroll', 'agency_payroll', 'usdt_deposit', 'topup', 'sham_cash_deposit']),
    getPlatformState({ forceRefresh: true }),
    getAgencyRequestsInSupabase(),
  ]);

  const failedQuery = [
    usersRes,
    locksRes,
    logsRes,
    roomsRes,
    compsRes,
    agenciesRes,
    questionsRes,
    depositsRes,
    withdrawalsRes,
    femaleRes,
    usersCountRes,
    monthlyTransactionsRes,
  ].find((result) => result.error);
  if (failedQuery?.error) {
    throw new Error(`تعذّر تحميل بيانات لوحة الإدارة: ${failedQuery.error.message}`);
  }

  const rawUsers = (usersRes.data || []).map(rowToUser);
  const vipTotals = await fetchUsersVipTotalsBatch(rawUsers.map((u) => u.id)).catch(
    (): Record<string, { totalRechargedCoins: number; totalSpentCoins: number }> => ({})
  );
  const users = rawUsers.map((u) => {
    const t = vipTotals[u.id];
    const enriched: User = {
      ...u,
      totalRecharged: t?.totalRechargedCoins || 0,
      totalSpentCoins: t?.totalSpentCoins || 0,
    };
    enriched.vipLevel = getUserVipTierInfo(enriched).key;
    return enriched;
  });
  const deviceLocks = (locksRes.data || []).map(rowToDeviceLock);
  const securityLogs = (logsRes.data || []).map(rowToSecurityLog);
  const rooms = (roomsRes.data || []).map((r) => rowToRoom(r, []));
  const competitions = (compsRes.data || []).map(rowToCompetition);
  const agencies = (agenciesRes.data || []).map(rowToAgency);
  const culturalQuestions = (questionsRes.data || []).map(rowToQuestion);
  const usdtDeposits = (depositsRes.data || []).map(rowToDeposit);
  const usdtWithdrawals = (withdrawalsRes.data || []).map(rowToWithdrawal);
  const femaleVoiceRequests = (femaleRes.data || []).map(rowToFemaleVoiceReq);
  const hostJoinApplications = state.settings.hostJoinApplications || [];

  const activeRooms = rooms.filter((r) => r.isActive).length;
  const totalCoins = users.reduce((sum, u) => sum + (u.coins || 0), 0);
  const blockedAttempts = securityLogs.filter(
    (l) => l.type === 'MULTI_ACCOUNT_BLOCKED' || l.type === 'DEVICE_BLOCKED'
  ).length;
  const pendingUsdtCount =
    usdtDeposits.filter((d) => d.status === 'pending').length +
    usdtWithdrawals.filter((w) => w.status === 'pending').length;
  const pendingFemaleVoiceCount = femaleVoiceRequests.filter(
    (f) => f.status === 'pending'
  ).length;

  return {
    users,
    deviceLocks,
    securityLogs,
    rooms,
    competitions,
    agencies,
    agencyRequests,
    culturalQuestions,
    settings: state.settings,
    usdtDeposits,
    usdtWithdrawals,
    femaleVoiceRequests,
    hostJoinApplications,
    monthlyTransactions: monthlyTransactionsRes.data || [],
    stats: {
      totalUsers: Number(usersCountRes.count ?? users.length),
      activeRooms,
      totalCoins,
      blockedAttempts,
      appPrizePoolCoins: state.appPrizePoolCoins,
      pendingUsdtCount,
      pendingFemaleVoiceCount,
    },
  };
}

export async function updateAdminUserInSupabase(
  targetId: string,
  payload: {
    coinsDelta?: number;
    is_banned?: boolean;
    is_admin?: boolean;
    vipLevel?: VipTierKey;
  }
): Promise<User> {
  const { data: row, error } = await supabase
    .from('sada_users')
    .select(USER_COLUMNS)
    .eq('id', targetId)
    .maybeSingle();
  if (error || !row) throw new Error('العضو غير موجود.');

  const target = rowToUser(row);
  const isSuper = target.email.toLowerCase() === SUPER_ADMIN_EMAIL;
  const updatePatch: Record<string, unknown> = {};

  if (typeof payload.coinsDelta === 'number' && payload.coinsDelta !== 0) {
    const nextCoins = Math.max(0, target.coins + Math.floor(payload.coinsDelta));
    updatePatch.coins = nextCoins;
    await recordTransaction({
      userId: target.id,
      type: 'admin_grant',
      amount: Math.floor(payload.coinsDelta),
      currency: 'coins',
      description:
        payload.coinsDelta > 0
          ? 'شحن رصيد إداري من لوحة الإدارة العليا'
          : 'خصم رصيد إداري من لوحة الإدارة العليا',
    });
  }

  if (typeof payload.is_banned === 'boolean') {
    if (isSuper && payload.is_banned) {
      throw new Error('لا يمكن حظر المدير العام للنظام.');
    }
    updatePatch.is_banned = payload.is_banned;
    if (payload.is_banned) {
      await supabase.from('sada_security_logs').insert({
        id: genId('sec'),
        type: 'USER_BANNED',
        email: target.email,
        device_uuid: target.device_uuid,
        details: `تم تعليق الحساب (${target.email}) بواسطة الإدارة العليا.`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  if (typeof payload.is_admin === 'boolean') {
    updatePatch.is_admin = isSuper ? true : payload.is_admin;
  }

  if (payload.vipLevel !== undefined) {
    const state = await getPlatformState({ forceRefresh: true });
    const nextOverrides: Record<string, VipTierKey> = {
      ...(state.settings.userVipOverrides || {}),
      [targetId]: payload.vipLevel,
    };
    await savePlatformState({
      settings: {
        ...state.settings,
        userVipOverrides: nextOverrides,
      },
    });
    invalidateUserVipCache(targetId);
  }

  let finalUser = target;
  if (Object.keys(updatePatch).length > 0) {
    const { data: updated, error: upErr } = await supabase
      .from('sada_users')
      .update(updatePatch)
      .eq('id', targetId)
      .select(USER_COLUMNS)
      .single();
    if (upErr || !updated) throw new Error('تعذّر تحديث بيانات العضو.');
    finalUser = rowToUser(updated);
  }

  finalUser.vipLevel = getUserVipTierInfo(finalUser).key;

  if (payload.vipLevel !== undefined) {
    try {
      const { syncUserOnActiveRoomSeats } = await import('./sadaAuth');
      await syncUserOnActiveRoomSeats(finalUser);
    } catch {
      // ignore non-critical active room seat sync error
    }
  }

  return finalUser;
}

export async function setAdminUserVipIdInSupabase(
  targetId: string,
  requestedNumber: string
): Promise<void> {
  const cleanNumber = requestedNumber.trim();
  if (cleanNumber && !/^\d{1,12}$/.test(cleanNumber)) {
    throw new Error('يجب أن يتكون رقم ID المميز من أرقام فقط.');
  }

  const [{ data: target, error: targetError }, state] = await Promise.all([
    supabase.from('sada_users').select('id').eq('id', targetId).maybeSingle(),
    getPlatformState({ forceRefresh: true }),
  ]);
  if (targetError) throw new Error(`تعذّر تحميل الحساب: ${targetError.message}`);
  if (!target) throw new Error('العضو غير موجود.');

  const customVipIds = { ...(state.settings.customVipIds || {}) };
  if (cleanNumber) {
    const owner = Object.entries(customVipIds).find(
      ([userId, number]) => userId !== targetId && number === cleanNumber
    );
    if (owner) throw new Error('رقم ID هذا مفعّل لمستخدم آخر بالفعل.');
  }

  const { data: previousCatalogItem, error: previousLoadError } = await supabase
    .from('sada_vip_ids_catalog')
    .select('id')
    .eq('owner_id', targetId)
    .maybeSingle();
  if (previousLoadError) throw new Error(previousLoadError.message);

  let nextCatalogItemId: string | null = null;
  if (cleanNumber) {
    const { data: nextCatalogItem, error: catalogError } = await supabase
      .from('sada_vip_ids_catalog')
      .select('id, owner_id')
      .eq('number', cleanNumber)
      .maybeSingle();
    if (catalogError) throw new Error(catalogError.message);
    if (nextCatalogItem?.owner_id && nextCatalogItem.owner_id !== targetId) {
      throw new Error('رقم ID هذا مملوك لمستخدم آخر بالفعل.');
    }
    nextCatalogItemId = nextCatalogItem?.id || null;
  }

  if (previousCatalogItem && previousCatalogItem.id !== nextCatalogItemId) {
    const { error } = await supabase
      .from('sada_vip_ids_catalog')
      .update({ owner_id: null })
      .eq('id', previousCatalogItem.id);
    if (error) throw new Error(`تعذّر إلغاء الرقم السابق: ${error.message}`);
  }

  if (nextCatalogItemId) {
    const { error } = await supabase
      .from('sada_vip_ids_catalog')
      .update({ owner_id: targetId })
      .eq('id', nextCatalogItemId);
    if (error) {
      if (previousCatalogItem && previousCatalogItem.id !== nextCatalogItemId) {
        await supabase
          .from('sada_vip_ids_catalog')
          .update({ owner_id: targetId })
          .eq('id', previousCatalogItem.id);
      }
      throw new Error(`تعذّر تفعيل الرقم المميز: ${error.message}`);
    }
  }

  if (cleanNumber) customVipIds[targetId] = cleanNumber;
  else delete customVipIds[targetId];

  try {
    const saved = await savePlatformState({
      settings: { ...state.settings, customVipIds },
    });
    setCustomVipIdsCache(saved.settings.customVipIds);
  } catch (error) {
    if (nextCatalogItemId) {
      await supabase
        .from('sada_vip_ids_catalog')
        .update({ owner_id: null })
        .eq('id', nextCatalogItemId);
    }
    if (previousCatalogItem) {
      await supabase
        .from('sada_vip_ids_catalog')
        .update({ owner_id: targetId })
        .eq('id', previousCatalogItem.id);
    }
    throw error;
  }
}

export async function reviewShamCashRequestInSupabase(
  requestId: string,
  decision: 'approved' | 'rejected',
  coinsAmount: number,
  currency: 'USD' | 'SYP'
): Promise<void> {
  const state = await getPlatformState({ forceRefresh: true });
  const requests = state.settings.shamCashRequests || [];
  const index = requests.findIndex((item) => item.id === requestId);
  if (index < 0) throw new Error('طلب شام كاش غير موجود.');

  const request = requests[index] as ShamCashRequest;
  if (request.status !== 'pending') throw new Error('تمت مراجعة هذا الطلب مسبقاً.');
  const amount = Math.floor(coinsAmount);
  if (decision === 'approved' && (!Number.isFinite(amount) || amount <= 0)) {
    throw new Error('أدخل كمية كوينز صحيحة للاعتماد.');
  }

  let nextBalance: number | null = null;
  let previousBalance: number | null = null;
  let transactionId: string | null = null;
  if (decision === 'approved') {
    const { data: userRow, error: userError } = await supabase
      .from('sada_users')
      .select('id, coins')
      .eq('id', String(request.userId || ''))
      .maybeSingle();
    if (userError) throw new Error(`تعذّر تحميل رصيد صاحب الطلب: ${userError.message}`);
    if (!userRow) throw new Error('صاحب طلب شام كاش غير موجود.');

    previousBalance = Number(userRow.coins || 0);
    const delta = request.type === 'deposit' ? amount : -amount;
    nextBalance = previousBalance + delta;
    if (nextBalance < 0) throw new Error('رصيد المستخدم لا يكفي لاعتماد طلب السحب.');

    const { data: updated, error: balanceError } = await supabase
      .from('sada_users')
      .update({ coins: nextBalance })
      .eq('id', String(request.userId))
      .eq('coins', previousBalance)
      .select('id')
      .maybeSingle();
    if (balanceError) throw new Error(`تعذّر تحديث رصيد المستخدم: ${balanceError.message}`);
    if (!updated) throw new Error('تغيّر رصيد المستخدم أثناء المراجعة. أعد المحاولة.');

    transactionId = genId('shamtx');
    try {
      await recordTransaction({
        id: transactionId,
        userId: String(request.userId),
        type: request.type === 'deposit' ? 'sham_cash_deposit' : 'sham_cash_withdrawal',
        amount: delta,
        currency: 'coins',
        description: `اعتماد شام كاش ${Number(request.amount || 0)} ${currency}`,
      });
    } catch (error) {
      const { error: rollbackError } = await supabase
        .from('sada_users')
        .update({ coins: previousBalance })
        .eq('id', String(request.userId))
        .eq('coins', nextBalance);
      if (rollbackError) {
        throw new Error(
          `تعذّر تسجيل الحركة (${error instanceof Error ? error.message : 'خطأ غير معروف'}) أو التراجع عن تحديث الرصيد (${rollbackError.message}).`
        );
      }
      throw error;
    }
  }

  const nextRequests = [...requests];
  nextRequests[index] = {
    ...request,
    status: decision,
    reviewedAt: new Date().toISOString(),
    ...(decision === 'approved'
      ? {
          coinsCredited: request.type === 'deposit' ? amount : 0,
          coinsDebited: request.type === 'withdrawal' ? amount : 0,
        }
      : {}),
  };
  try {
    await savePlatformState({
      settings: { ...state.settings, shamCashRequests: nextRequests },
    });
  } catch (error) {
    if (transactionId && previousBalance !== null && nextBalance !== null) {
      const [{ error: balanceRollbackError }, { error: transactionRollbackError }] =
        await Promise.all([
          supabase
            .from('sada_users')
            .update({ coins: previousBalance })
            .eq('id', String(request.userId))
            .eq('coins', nextBalance),
          supabase.from('sada_transactions').delete().eq('id', transactionId),
        ]);
      if (balanceRollbackError || transactionRollbackError) {
        throw new Error(
          `تعذّر حفظ نتيجة المراجعة (${error instanceof Error ? error.message : 'خطأ غير معروف'}) أو إلغاء آثار العملية (${balanceRollbackError?.message || transactionRollbackError?.message}).`
        );
      }
    }
    throw error;
  }
}

export async function unlockDeviceInSupabase(uuid: string): Promise<void> {
  const { data: existing } = await supabase
    .from('sada_device_locks')
    .select(DEVICE_LOCK_COLUMNS)
    .eq('device_uuid', uuid)
    .maybeSingle();

  await supabase.from('sada_device_locks').delete().eq('device_uuid', uuid);

  await supabase.from('sada_security_logs').insert({
    id: genId('sec'),
    type: 'DEVICE_UNLOCKED',
    email: String(existing?.bound_email || 'system'),
    device_uuid: uuid,
    details: `تم فك ارتباط الجهاز ${uuid} بواسطة الإدارة العليا.`,
    timestamp: new Date().toISOString(),
  });
}

export async function blockDeviceInSupabase(
  uuid: string,
  isBlocked: boolean,
  reason = 'قرار من الإدارة العليا'
): Promise<void> {
  const { data: existing } = await supabase
    .from('sada_device_locks')
    .select(DEVICE_LOCK_COLUMNS)
    .eq('device_uuid', uuid)
    .maybeSingle();

  await supabase
    .from('sada_device_locks')
    .update({
      is_blocked: isBlocked,
      blocked_reason: isBlocked ? reason : null,
      last_attempt_at: new Date().toISOString(),
    })
    .eq('device_uuid', uuid);

  await supabase.from('sada_security_logs').insert({
    id: genId('sec'),
    type: isBlocked ? 'DEVICE_BLOCKED' : 'DEVICE_UNLOCKED',
    email: String(existing?.bound_email || 'system'),
    device_uuid: uuid,
    details: isBlocked
      ? `تم حظر الجهاز ${uuid}: ${reason}`
      : `تم إلغاء حظر الجهاز ${uuid}`,
    timestamp: new Date().toISOString(),
  });
}

export async function closeRoomInSupabase(roomId: string): Promise<void> {
  const { error } = await supabase
    .from('sada_rooms')
    .update({ is_active: false })
    .eq('id', roomId);
  if (error) throw new Error('تعذّر إغلاق الغرفة.');
  try {
    const state = await getPlatformState({ forceRefresh: true });
    if ((state.settings.pinnedRoomIds || []).includes(roomId)) {
      await savePlatformState({
        settings: {
          ...state.settings,
          pinnedRoomIds: (state.settings.pinnedRoomIds || []).filter((id) => id !== roomId),
        },
      });
    }
  } catch {
    // ignore cleanup error
  }
}

export async function togglePinRoomInSupabase(roomId: string): Promise<string[]> {
  const state = await getPlatformState({ forceRefresh: true });
  const current = Array.isArray(state.settings.pinnedRoomIds)
    ? state.settings.pinnedRoomIds
    : [];
  const isPinned = current.includes(roomId);
  const nextPinned = isPinned
    ? current.filter((id) => id !== roomId)
    : [roomId, ...current];
  await savePlatformState({
    settings: {
      ...state.settings,
      pinnedRoomIds: nextPinned,
    },
  });
  return nextPinned;
}

export async function createCustomGiftInSupabase(payload: {
  name: string;
  coinsCost: number;
  glyph?: string;
  imageUrl?: string;
  category?: 'fixed' | 'lucky';
}): Promise<GiftItem[]> {
  const cleanName = payload.name.trim();
  if (cleanName.length < 2) {
    throw new Error('يرجى إدخال اسم واضح للهدية (حرفان على الأقل).');
  }
  const cleanCost = Math.max(1, Math.floor(Number(payload.coinsCost) || 0));
  const cleanImage = (payload.imageUrl || '').trim();
  const cleanGlyph = (payload.glyph || '').trim() || '🎁';
  if (!cleanImage && !cleanGlyph) {
    throw new Error('يرجى إدخال رابط صورة 3D أو رفع صورة للهدية.');
  }

  const tier: GiftItem['tier'] =
    cleanCost >= 50000 || getGiftEffectTier(cleanCost) === 3 && cleanCost >= 10000
      ? 'imperial'
      : cleanCost >= 1000
      ? 'royal'
      : 'classic';

  const state = await getPlatformState({ forceRefresh: true });
  const ratio = state.settings.giftDiamondsRatio || 0.75;
  const newGift: GiftItem = {
    id: genId('cgift'),
    name: cleanName.slice(0, 40),
    coinsCost: cleanCost,
    diamondsValue: Math.max(1, Math.round(cleanCost * ratio)),
    xpGain: Math.max(5, Math.round(cleanCost * 0.45)),
    tier,
    category: payload.category === 'lucky' ? 'lucky' : 'fixed',
    glyph: cleanGlyph,
    ...(cleanImage ? { imageUrl: cleanImage } : {}),
  };

  const nextCustomGifts = [newGift, ...(state.settings.customGifts || [])];
  const saved = await savePlatformState({
    settings: {
      ...state.settings,
      customGifts: nextCustomGifts,
    },
  });
  return saved.settings.customGifts || nextCustomGifts;
}

export async function deleteCustomGiftInSupabase(giftId: string): Promise<GiftItem[]> {
  const state = await getPlatformState({ forceRefresh: true });
  const nextCustomGifts = (state.settings.customGifts || []).filter((g) => g.id !== giftId);
  const saved = await savePlatformState({
    settings: {
      ...state.settings,
      customGifts: nextCustomGifts,
    },
  });
  return saved.settings.customGifts || nextCustomGifts;
}

export async function sendGlobalAdminAnnouncementInSupabase(payload: {
  title?: string;
  message: string;
  senderName: string;
}): Promise<GlobalAdminAnnouncement> {
  const cleanMessage = payload.message.trim();
  if (cleanMessage.length < 2) {
    throw new Error('يرجى كتابة نص رسالة الإعلان العام.');
  }
  const announcement: GlobalAdminAnnouncement = {
    id: genId('ann'),
    title: (payload.title || 'إعلان إداري هام').trim().slice(0, 48),
    message: cleanMessage.slice(0, 260),
    senderName: payload.senderName || 'الإدارة العليا',
    timestamp: new Date().toISOString(),
  };

  const state = await getPlatformState({ forceRefresh: true });
  await savePlatformState({
    settings: {
      ...state.settings,
      latestAdminAnnouncement: announcement,
    },
  });

  return announcement;
}

export async function createCompetitionInSupabase(payload: {
  title: string;
  subtitle?: string;
  prizeCoins: number;
  prizeDiamonds: number;
}): Promise<Competition> {
  if (!payload.title.trim()) throw new Error('يرجى إدخال عنوان المسابقة.');
  const row = {
    id: genId('comp'),
    title: payload.title.trim(),
    subtitle: (payload.subtitle || 'بطولة ملكية رسمية على منصة صَدَى').trim(),
    category: 'تحدي الأصوات',
    prize_coins: Math.max(0, Math.floor(payload.prizeCoins || 0)),
    prize_diamonds: Math.max(0, Math.floor(payload.prizeDiamonds || 0)),
    banner_image: 'competition_crest',
    status: 'live',
    ends_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    winner_id: null,
    contestants: [],
  };
  const { data, error } = await supabase
    .from('sada_competitions')
    .insert(row)
    .select(COMPETITION_COLUMNS)
    .single();
  if (error || !data) throw new Error('تعذّر إطلاق المسابقة الجديدة.');
  return rowToCompetition(data);
}

export async function finishCompetitionInSupabase(compId: string): Promise<void> {
  const { data: compRow, error } = await supabase
    .from('sada_competitions')
    .select(COMPETITION_COLUMNS)
    .eq('id', compId)
    .maybeSingle();
  if (error || !compRow) throw new Error('المسابقة غير موجودة.');

  const comp = rowToCompetition(compRow);
  const sorted = [...comp.contestants].sort(
    (a, b) => b.votes + b.giftScore - (a.votes + a.giftScore)
  );
  const winner = sorted[0] || null;

  await supabase
    .from('sada_competitions')
    .update({
      status: 'ended',
      winner_id: winner ? winner.userId : null,
    })
    .eq('id', compId);

  if (winner) {
    const { data: winUser } = await supabase
      .from('sada_users')
      .select('id, coins, diamonds')
      .eq('id', winner.userId)
      .maybeSingle();
    if (winUser) {
      await supabase
        .from('sada_users')
        .update({
          coins: Number(winUser.coins || 0) + comp.prizeCoins,
          diamonds: Number(winUser.diamonds || 0) + comp.prizeDiamonds,
        })
        .eq('id', winner.userId);
      if (comp.prizeCoins > 0) {
        await recordTransaction({
          userId: winner.userId,
          type: 'prize',
          amount: comp.prizeCoins,
          currency: 'coins',
          description: `جائزة الفوز بالمركز الأول في ${comp.title}`,
        });
      }
      if (comp.prizeDiamonds > 0) {
        await recordTransaction({
          userId: winner.userId,
          type: 'prize',
          amount: comp.prizeDiamonds,
          currency: 'diamonds',
          description: `ألماس الفوز بالمركز الأول في ${comp.title}`,
        });
      }
    }
  }
}

export async function updatePrizePoolInSupabase(
  amountInput: number,
  mode: 'add' | 'set'
): Promise<number> {
  const amount = Math.max(0, Math.floor(Number(amountInput) || 0));
  const state = await getPlatformState();
  const nextPool =
    mode === 'set' ? amount : Math.max(0, state.appPrizePoolCoins + amount);
  await savePlatformState({ appPrizePoolCoins: nextPool });
  return nextPool;
}

export async function approveUsdtDepositInSupabase(depositId: string): Promise<void> {
  const [{ data: depRow, error: depositError }, state] = await Promise.all([
    supabase.from('sada_usdt_deposits').select(DEPOSIT_COLUMNS).eq('id', depositId).maybeSingle(),
    getPlatformState(),
  ]);
  if (depositError) throw new Error(`تعذّر تحميل طلب الإيداع: ${depositError.message}`);
  if (!depRow) throw new Error('طلب الإيداع غير موجود.');
  if (depRow.status !== 'pending') throw new Error('تمت مراجعة هذا الطلب مسبقاً.');

  const dep = rowToDeposit(depRow);
  const { data: userRow, error: userError } = await supabase
    .from('sada_users')
    .select(USER_COLUMNS)
    .eq('id', dep.userId)
    .maybeSingle();
  if (userError) throw new Error(`تعذّر تحميل صاحب الطلب: ${userError.message}`);
  if (!userRow) throw new Error('صاحب الطلب غير موجود.');

  const u = rowToUser(userRow);
  const now = new Date().toISOString();
  const restorePendingStatus = async () => {
    const { error } = await supabase
      .from('sada_usdt_deposits')
      .update({ status: 'pending', reviewed_at: null })
      .eq('id', depositId)
      .eq('status', 'approved');
    if (error) throw new Error(`تعذّر إعادة الطلب إلى الانتظار: ${error.message}`);
  };
  const { data: approvedDeposit, error: approvalError } = await supabase
    .from('sada_usdt_deposits')
    .update({ status: 'approved', reviewed_at: now })
    .eq('id', depositId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (approvalError) throw new Error(`تعذّر اعتماد طلب الإيداع: ${approvalError.message}`);
  if (!approvedDeposit) throw new Error('تمت مراجعة هذا الطلب مسبقاً.');

  const tier = getRechargeRewardTier(dep.amountUsdt, state.settings.rechargeRewardTiers);
  const nextUnlocked = [...u.unlockedFrames];
  let nextFrameId = u.frameId;
  let nextPrevPermanent = u.previousPermanentFrameId || null;
  let nextTempFrameId = u.tempFrameId || null;
  let nextTempFrameExpiresAt = u.tempFrameExpiresAt || null;
  let nextEntryId = u.activeEntryId || null;
  let nextEntryName = u.activeEntryName || null;
  let nextTempEntryExpiresAt = u.tempEntryExpiresAt || null;

  if (tier) {
    const expiresAt = new Date(Date.now() + tier.days * 86400 * 1000).toISOString();
    if (!TEMP_ONLY_FRAME_IDS.has(u.frameId)) {
      nextPrevPermanent = u.frameId;
    }
    if (!nextUnlocked.includes(tier.frameId)) {
      nextUnlocked.push(tier.frameId);
    }
    nextFrameId = tier.frameId;
    nextTempFrameId = tier.frameId;
    nextTempFrameExpiresAt = expiresAt;
    if (tier.entryId && tier.entryName) {
      nextEntryId = tier.entryId;
      nextEntryName = tier.entryName;
      nextTempEntryExpiresAt = expiresAt;
    }
  }

  // Unlock 3D Store items reached by cumulative recharge
  const [
    { data: approvedDeps, error: approvedDepsError },
    { data: rechargeTxs, error: rechargeTxsError },
  ] = await Promise.all([
    supabase
      .from('sada_usdt_deposits')
      .select('coins_credited')
      .eq('user_id', u.id)
      .eq('status', 'approved'),
    supabase
      .from('sada_transactions')
      .select('type, amount, description')
      .eq('user_id', u.id)
      .in('type', ['topup', 'admin_grant']),
  ]);
  if (approvedDepsError || rechargeTxsError) {
    await restorePendingStatus();
    throw new Error(
      `تعذّر حساب إجمالي الشحن: ${approvedDepsError?.message || rechargeTxsError?.message}`
    );
  }
  const totalFromDeps = (approvedDeps || []).reduce(
    (sum, d) => sum + Math.max(0, Number(d.coins_credited || 0)),
    0
  );
  const totalFromTxs = (rechargeTxs || []).reduce((sum, t) => {
    const amt = Number(t.amount || 0);
    if (amt <= 0) return sum;
    if (t.type === 'admin_grant' && String(t.description || '').includes('ترحيبي')) return sum;
    return sum + amt;
  }, 0);
  const cumulativeCoins = totalFromDeps + totalFromTxs;
  for (const item of STORE_3D_ITEMS) {
    if (cumulativeCoins >= item.minRechargeCoins && !nextUnlocked.includes(item.id)) {
      nextUnlocked.push(item.id);
    }
  }

  const nextCoins = u.coins + dep.coinsCredited;
  const { data: updatedUser, error: updateUserError } = await supabase
    .from('sada_users')
    .update({
      coins: nextCoins,
      unlocked_frames: nextUnlocked,
      frame_id: nextFrameId,
      previous_permanent_frame_id: nextPrevPermanent,
      temp_frame_id: nextTempFrameId,
      temp_frame_expires_at: nextTempFrameExpiresAt,
      active_entry_id: nextEntryId,
      active_entry_name: nextEntryName,
      temp_entry_expires_at: nextTempEntryExpiresAt,
    })
    .eq('id', u.id)
    .eq('coins', u.coins)
    .select('id')
    .maybeSingle();
  if (updateUserError || !updatedUser) {
    await restorePendingStatus();
    throw new Error(
      updateUserError
        ? `تعذّر تحديث رصيد صاحب الطلب: ${updateUserError.message}`
        : 'تغيّر رصيد صاحب الطلب أثناء المراجعة. أعد المحاولة.'
    );
  }

  try {
    await recordTransaction({
      userId: u.id,
      type: 'usdt_deposit',
      amount: dep.coinsCredited,
      currency: 'coins',
      description: tier
        ? `تأكيد شحن ${dep.amountUsdt} USDT TRC20 + ${tier.label}`
        : `تأكيد شحن ${dep.amountUsdt} USDT TRC20`,
      timestamp: now,
    });
  } catch (transactionError) {
    const { data: rolledBackUser, error: balanceRollbackError } = await supabase
      .from('sada_users')
      .update({
        coins: u.coins,
        unlocked_frames: u.unlockedFrames,
        frame_id: u.frameId,
        previous_permanent_frame_id: u.previousPermanentFrameId,
        temp_frame_id: u.tempFrameId,
        temp_frame_expires_at: u.tempFrameExpiresAt,
        active_entry_id: u.activeEntryId,
        active_entry_name: u.activeEntryName,
        temp_entry_expires_at: u.tempEntryExpiresAt,
      })
      .eq('id', u.id)
      .eq('coins', nextCoins)
      .select('id')
      .maybeSingle();
    if (balanceRollbackError || !rolledBackUser) {
      throw new Error(
        `تعذّر تسجيل حركة الشحن (${transactionError instanceof Error ? transactionError.message : 'خطأ غير معروف'}) أو التراجع عن الرصيد (${balanceRollbackError?.message || 'تغيّر الرصيد قبل التراجع'}). بقي الطلب معتمداً لمنع تكرار الإضافة.`
      );
    }
    await restorePendingStatus();
    throw transactionError;
  }

  // Sync updated frame onto active room seats
  if (nextFrameId !== u.frameId) {
    const { data: activeRooms } = await supabase
      .from('sada_rooms')
      .select('id, seats')
      .eq('is_active', true);
    for (const r of activeRooms || []) {
      const seats = Array.isArray(r.seats) ? (r.seats as Room['seats']) : [];
      let dirty = false;
      const updatedSeats = seats.map((s) => {
        if (s.userId === u.id) {
          dirty = true;
          return { ...s, frameId: nextFrameId };
        }
        return s;
      });
      if (dirty) {
        await supabase.from('sada_rooms').update({ seats: updatedSeats }).eq('id', r.id);
      }
    }
  }
}

export async function rejectUsdtDepositInSupabase(
  depositId: string,
  reason = 'لم يتم التحقق من الحوالة على شبكة TRC20'
): Promise<void> {
  const { data: depRow, error: loadError } = await supabase
    .from('sada_usdt_deposits')
    .select('status')
    .eq('id', depositId)
    .maybeSingle();
  if (loadError) throw new Error(`تعذّر تحميل طلب الإيداع: ${loadError.message}`);
  if (!depRow) throw new Error('طلب الإيداع غير موجود.');
  if (depRow.status !== 'pending') throw new Error('تمت مراجعة هذا الطلب مسبقاً.');

  const { data: updated, error } = await supabase
    .from('sada_usdt_deposits')
    .update({
      status: 'rejected',
      admin_note: reason,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', depositId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (error) throw new Error(`تعذّر رفض طلب الإيداع: ${error.message}`);
  if (!updated) throw new Error('تمت مراجعة هذا الطلب مسبقاً.');
}

export async function approveUsdtWithdrawalInSupabase(wdId: string): Promise<void> {
  const { data: wdRow, error: loadError } = await supabase
    .from('sada_usdt_withdrawals')
    .select('status')
    .eq('id', wdId)
    .maybeSingle();
  if (loadError) throw new Error(`تعذّر تحميل طلب السحب: ${loadError.message}`);
  if (!wdRow) throw new Error('طلب السحب غير موجود.');
  if (wdRow.status !== 'pending') throw new Error('تمت مراجعة هذا الطلب مسبقاً.');

  const { data: updated, error } = await supabase
    .from('sada_usdt_withdrawals')
    .update({
      status: 'approved',
      admin_note: 'تم تحويل USDT عبر شبكة TRC20 بنجاح',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', wdId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (error) throw new Error(`تعذّر تأكيد طلب السحب: ${error.message}`);
  if (!updated) throw new Error('تمت مراجعة هذا الطلب مسبقاً.');
}

export async function rejectUsdtWithdrawalInSupabase(
  wdId: string,
  reason = 'بيانات محفظة TRC20 غير مكتملة'
): Promise<void> {
  const { data: wdRow, error: loadError } = await supabase
    .from('sada_usdt_withdrawals')
    .select(WITHDRAWAL_COLUMNS)
    .eq('id', wdId)
    .maybeSingle();
  if (loadError) throw new Error(`تعذّر تحميل طلب السحب: ${loadError.message}`);
  if (!wdRow) throw new Error('طلب السحب غير موجود.');
  if (wdRow.status !== 'pending') throw new Error('تمت مراجعة هذا الطلب مسبقاً.');

  const wd = rowToWithdrawal(wdRow);
  const now = new Date().toISOString();
  const { data: uRow, error: userError } = await supabase
    .from('sada_users')
    .select('coins, diamonds')
    .eq('id', wd.userId)
    .maybeSingle();
  if (userError) throw new Error(`تعذّر تحميل رصيد صاحب الطلب: ${userError.message}`);
  if (!uRow) throw new Error('صاحب طلب السحب غير موجود.');

  const isDiamonds = wd.sourceCurrency === 'diamonds';
  const previousBalance = Number(isDiamonds ? uRow.diamonds || 0 : uRow.coins || 0);
  const nextBalance = previousBalance + wd.sourceAmount;
  const balanceColumn = isDiamonds ? 'diamonds' : 'coins';
  const { data: updatedUser, error: balanceError } = await supabase
    .from('sada_users')
    .update({ [balanceColumn]: nextBalance })
    .eq('id', wd.userId)
    .eq(balanceColumn, previousBalance)
    .select('id')
    .maybeSingle();
  if (balanceError) throw new Error(`تعذّر إرجاع الرصيد: ${balanceError.message}`);
  if (!updatedUser) throw new Error('تغيّر رصيد صاحب الطلب أثناء المراجعة. أعد المحاولة.');

  const { data: updatedWithdrawal, error: statusError } = await supabase
    .from('sada_usdt_withdrawals')
    .update({ status: 'rejected', admin_note: reason, reviewed_at: now })
    .eq('id', wdId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (statusError || !updatedWithdrawal) {
    const { data: rolledBackUser, error: rollbackError } = await supabase
      .from('sada_users')
      .update({ [balanceColumn]: previousBalance })
      .eq('id', wd.userId)
      .eq(balanceColumn, nextBalance)
      .select('id')
      .maybeSingle();
    if (rollbackError || !rolledBackUser) {
      throw new Error(
        `تعذّر تحديث حالة الطلب (${statusError?.message || 'تمت مراجعته مسبقاً'}) أو التراجع عن الرصيد (${rollbackError?.message || 'تغيّر الرصيد قبل التراجع'}).`
      );
    }
    if (statusError) throw new Error(`تعذّر رفض طلب السحب: ${statusError.message}`);
    throw new Error('تمت مراجعة هذا الطلب مسبقاً.');
  }

  try {
    await recordTransaction({
      userId: wd.userId,
      type: 'usdt_withdrawal_refund',
      amount: wd.sourceAmount,
      currency: wd.sourceCurrency,
      description: `استرداد رصيد بعد رفض طلب سحب ${wd.amountUsdt} USDT`,
      timestamp: now,
    });
  } catch (transactionError) {
    const { data: rolledBackUser, error: rollbackError } = await supabase
      .from('sada_users')
      .update({ [balanceColumn]: previousBalance })
      .eq('id', wd.userId)
      .eq(balanceColumn, nextBalance)
      .select('id')
      .maybeSingle();
    if (rollbackError || !rolledBackUser) {
      throw new Error(
        `تعذّر تسجيل حركة الاسترداد (${transactionError instanceof Error ? transactionError.message : 'خطأ غير معروف'}) أو التراجع عن الرصيد (${rollbackError?.message || 'تغيّر الرصيد قبل التراجع'}). بقي الطلب مرفوضاً لمنع تكرار الاسترداد.`
      );
    }
    const { error: pendingError } = await supabase
      .from('sada_usdt_withdrawals')
      .update({ status: 'pending', admin_note: null, reviewed_at: null })
      .eq('id', wdId)
      .eq('status', 'rejected');
    if (pendingError) {
      throw new Error(
        `تعذّر تسجيل حركة الاسترداد أو إعادة الطلب إلى الانتظار: ${pendingError.message}`
      );
    }
    throw transactionError;
  }
}

export async function approveFemaleVoiceInSupabase(requestId: string): Promise<void> {
  const { data: reqRow } = await supabase
    .from('sada_female_voice_requests')
    .select(FEMALE_VOICE_REQ_COLUMNS)
    .eq('id', requestId)
    .maybeSingle();
  if (!reqRow) throw new Error('طلب التوثيق غير موجود.');

  const now = new Date().toISOString();
  const badge = 'موثّقة 🌸';

  await Promise.all([
    supabase
      .from('sada_female_voice_requests')
      .update({
        status: 'approved',
        reviewed_at: now,
        admin_note: 'تم اعتماد البصمة الصوتية ومنح شارة التوثيق الوردية الذهبية',
      })
      .eq('id', requestId),
    supabase
      .from('sada_users')
      .update({
        female_voice_status: 'verified',
        female_verified: true,
        female_verified_badge: badge,
        female_voice_note: null,
      })
      .eq('id', reqRow.user_id),
  ]);

  const { data: activeRooms } = await supabase
    .from('sada_rooms')
    .select('id, seats')
    .eq('is_active', true);
  for (const r of activeRooms || []) {
    const seats = Array.isArray(r.seats) ? (r.seats as Room['seats']) : [];
    let dirty = false;
    const nextSeats = seats.map((s) => {
      if (s.userId === reqRow.user_id) {
        dirty = true;
        return { ...s, femaleVerifiedBadge: badge };
      }
      return s;
    });
    if (dirty) {
      await supabase.from('sada_rooms').update({ seats: nextSeats }).eq('id', r.id);
    }
  }
}

export async function rejectFemaleVoiceInSupabase(
  requestId: string,
  reason = 'الصوت غير واضح أو لم يطابق العبارة المطلوبة — يرجى إعادة تسجيل بصمة صوتية جديدة.'
): Promise<void> {
  const { data: reqRow } = await supabase
    .from('sada_female_voice_requests')
    .select(FEMALE_VOICE_REQ_COLUMNS)
    .eq('id', requestId)
    .maybeSingle();
  if (!reqRow) throw new Error('طلب التوثيق غير موجود.');

  const now = new Date().toISOString();
  await Promise.all([
    supabase
      .from('sada_female_voice_requests')
      .update({
        status: 'rejected',
        reviewed_at: now,
        admin_note: reason,
      })
      .eq('id', requestId),
    supabase
      .from('sada_users')
      .update({
        female_voice_status: 'rejected',
        female_verified: false,
        female_verified_badge: null,
        female_voice_note: reason,
      })
      .eq('id', reqRow.user_id),
  ]);
}

export async function updateAgencyInSupabase(
  agencyId: string,
  payload: { status?: 'approved' | 'pending' | 'suspended'; commissionRate?: number }
): Promise<void> {
  const { data: agRow } = await supabase
    .from('sada_agencies')
    .select(AGENCY_COLUMNS)
    .eq('id', agencyId)
    .maybeSingle();
  if (!agRow) throw new Error('الوكالة غير موجودة.');

  const patch: Record<string, unknown> = {};
  if (payload.status) patch.status = payload.status;
  if (typeof payload.commissionRate === 'number') {
    patch.commission_rate = Math.max(0, Math.min(0.5, payload.commissionRate));
  }
  await supabase.from('sada_agencies').update(patch).eq('id', agencyId);
}

export async function reviewAgencyApplicationInSupabase(
  agencyId: string,
  decision: 'approved' | 'rejected',
  admin: User
): Promise<void> {
  const { data: agencyRow, error: agencyError } = await supabase
    .from('sada_agencies')
    .select(AGENCY_COLUMNS)
    .eq('id', agencyId)
    .maybeSingle();

  if (agencyError) throw new Error(`تعذّر تحميل طلب الوكالة: ${agencyError.message}`);
  if (!agencyRow) throw new Error('طلب الوكالة غير موجود.');
  if (agencyRow.status !== 'pending') throw new Error('تمت مراجعة طلب الوكالة مسبقاً.');

  const { data: agencyOwner, error: agencyOwnerError } = await supabase
    .from('sada_users')
    .select(USER_COLUMNS)
    .eq('id', String(agencyRow.owner_id))
    .maybeSingle();
  if (agencyOwnerError) {
    throw new Error(`تعذّر تحميل حساب صاحب الطلب: ${agencyOwnerError.message}`);
  }
  if (!agencyOwner) throw new Error('تعذّر العثور على حساب صاحب الطلب.');

  if (decision === 'rejected') {
    const { data: rejectedAgency, error: rejectError } = await supabase
      .from('sada_agencies')
      .update({ status: 'rejected' })
      .eq('id', agencyId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (rejectError) throw new Error(`تعذّر رفض طلب الوكالة: ${rejectError.message}`);
    if (!rejectedAgency) throw new Error('تمت مراجعة طلب الوكالة مسبقاً.');

    const { error: notificationError } = await supabase.from('sada_private_messages').insert({
      id: genId('pm'),
      conversation_id: makeConversationId(admin.id, String(agencyOwner.id)),
      sender_id: admin.id,
      recipient_id: String(agencyOwner.id),
      text: `نأسف لإبلاغك برفض طلب تأسيس وكالة "${String(agencyRow.name)}". يمكنك التواصل مع الإدارة العليا لمزيد من التفاصيل.`,
      coins_paid: 0,
      diamonds_potential: 0,
      diamonds_claimed: false,
      diamonds_awarded: 0,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    if (notificationError) {
      throw new Error(`تم رفض الطلب، لكن تعذّر إرسال إشعار للمستخدم: ${notificationError.message}`);
    }
    return;
  }

  const owner = rowToUser(agencyOwner);
  const approvedOwner: User = {
    ...owner,
    isAgent: true,
    isHost: true,
    agencyId: String(agencyRow.id),
    hostBadge: 'وكيل معتمد ✦',
    hostAgencyName: String(agencyRow.name),
  };
  const { error: ownerUpdateError } = await supabase
    .from('sada_users')
    .update({
      is_agent: true,
      is_host: true,
      agency_id: String(agencyRow.id),
      host_badge: approvedOwner.hostBadge,
      host_agency_name: approvedOwner.hostAgencyName,
    })
    .eq('id', approvedOwner.id);
  if (ownerUpdateError) {
    throw new Error(`تعذّر ترقية صاحب الوكالة: ${ownerUpdateError.message}`);
  }

  let room: Room | null = null;
  let previousAgencyHostIds: string[] | null = null;
  let previousAgencyId: string | null = null;
  try {
    room = await createRoomInSupabase(approvedOwner, {
      title: `وكالة ${String(agencyRow.name)}`,
      description: String(agencyRow.description || ''),
      maxSeats: 12,
      isAgency: true,
      agencyId: String(agencyRow.id),
    });
    if (owner.agencyId && owner.agencyId !== String(agencyRow.id)) {
      const { data: previousAgency, error: previousAgencyError } = await supabase
        .from('sada_agencies')
        .select('id, host_ids')
        .eq('id', owner.agencyId)
        .maybeSingle();
      if (previousAgencyError) {
        throw new Error(`تعذّر تحميل الوكالة السابقة: ${previousAgencyError.message}`);
      }
      if (previousAgency && Array.isArray(previousAgency.host_ids)) {
        previousAgencyId = String(previousAgency.id);
        previousAgencyHostIds = previousAgency.host_ids.map(String);
        const { error: hostIdsError } = await supabase
          .from('sada_agencies')
          .update({
            host_ids: previousAgencyHostIds.filter((hostId) => hostId !== owner.id),
          })
          .eq('id', previousAgencyId);
        if (hostIdsError) {
          throw new Error(`تعذّر تحديث الوكالة السابقة: ${hostIdsError.message}`);
        }
      }
    }
    const { data: approvedAgency, error: approveError } = await supabase
      .from('sada_agencies')
      .update({ status: 'approved' })
      .eq('id', agencyId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (approveError) throw new Error(`تعذّر اعتماد سجل الوكالة: ${approveError.message}`);
    if (!approvedAgency) throw new Error('تمت مراجعة طلب الوكالة مسبقاً.');
  } catch (error) {
    const [
      { error: roomCleanupError },
      { error: ownerRestoreError },
      { error: previousAgencyRestoreError },
    ] = await Promise.all([
      room
        ? supabase.from('sada_rooms').delete().eq('id', room.id)
        : Promise.resolve({ error: null }),
      supabase
        .from('sada_users')
        .update({
          is_agent: Boolean(owner.isAgent),
          is_host: Boolean(owner.isHost),
          agency_id: owner.agencyId || null,
          host_badge: owner.hostBadge || null,
          host_agency_name: owner.hostAgencyName || null,
        })
        .eq('id', owner.id),
      previousAgencyId && previousAgencyHostIds
        ? supabase
            .from('sada_agencies')
            .update({ host_ids: previousAgencyHostIds })
            .eq('id', previousAgencyId)
        : Promise.resolve({ error: null }),
    ]);
    if (roomCleanupError || ownerRestoreError || previousAgencyRestoreError) {
      throw new Error(
        `تعذّر إكمال اعتماد الوكالة (${error instanceof Error ? error.message : 'خطأ غير معروف'}) أو التراجع عن التغييرات (${roomCleanupError?.message || ownerRestoreError?.message || previousAgencyRestoreError?.message}).`
      );
    }
    throw error;
  }
}

export async function payoutAgencyCommissionInSupabase(
  agencyId: string,
  explicitDiamonds?: number,
  note?: string
): Promise<{ paidDiamonds: number; agencyName: string }> {
  const { data: agRow } = await supabase
    .from('sada_agencies')
    .select(AGENCY_COLUMNS)
    .eq('id', agencyId)
    .maybeSingle();
  if (!agRow) throw new Error('الوكالة غير موجودة.');

  const agency = rowToAgency(agRow);
  const suggestedPending = Math.max(
    0,
    Math.round(agency.totalHostDiamonds * agency.commissionRate) - agency.totalCommissionDiamonds
  );
  const amount =
    typeof explicitDiamonds === 'number' && Number.isFinite(explicitDiamonds)
      ? Math.floor(explicitDiamonds)
      : suggestedPending;

  if (amount <= 0) {
    throw new Error('يرجى إدخال مبلغ عمولة صحيح أكبر من 0 لصرفه للوكيل.');
  }

  const { data: ownerRow } = await supabase
    .from('sada_users')
    .select('id, diamonds, display_name')
    .eq('id', agency.ownerId)
    .maybeSingle();
  if (!ownerRow) throw new Error('حساب مالك الوكالة غير موجود.');

  const nextOwnerDiamonds = Number(ownerRow.diamonds || 0) + amount;
  const nextTotalComm = agency.totalCommissionDiamonds + amount;
  const now = new Date().toISOString();
  const pct = Math.round(agency.commissionRate * 100);

  await Promise.all([
    supabase
      .from('sada_users')
      .update({ diamonds: nextOwnerDiamonds })
      .eq('id', agency.ownerId),
    supabase
      .from('sada_agencies')
      .update({ total_commission_diamonds: nextTotalComm })
      .eq('id', agency.id),
    recordTransaction({
      userId: agency.ownerId,
      type: 'agency_commission',
      amount,
      currency: 'diamonds',
      description:
        (note && note.trim()) ||
        `صرف عمولة وكالة (${pct}%) من الإدارة العليا لوكالة ${agency.name}`,
      timestamp: now,
    }),
  ]);

  return { paidDiamonds: amount, agencyName: agency.name };
}

export async function payHostMonthlyPayrollInSupabase(
  userId: string,
  month: string
): Promise<{ amountUsdt: number; earnedDiamonds: number; rechargeCapUsdt: number }> {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('شهر كشف الرواتب غير صالح.');
  const monthStart = new Date(`${month}-01T00:00:00.000Z`);
  if (!Number.isFinite(monthStart.getTime())) throw new Error('شهر كشف الرواتب غير صالح.');

  const [state, { data: userRow, error: userError }, { data: transactions, error: txError }] =
    await Promise.all([
      getPlatformState({ forceRefresh: true }),
      supabase.from('sada_users').select('id, is_host, is_agent').eq('id', userId).maybeSingle(),
      supabase
        .from('sada_transactions')
        .select('id, type, amount, currency')
        .eq('user_id', userId)
        .gte('timestamp', monthStart.toISOString())
        .lt('timestamp', new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)).toISOString())
        .in('type', ['host_earning', 'usdt_deposit', 'topup', 'sham_cash_deposit']),
    ]);
  if (userError) throw new Error(`تعذّر تحميل المضيف: ${userError.message}`);
  if (txError) throw new Error(`تعذّر تحميل كشف معاملات الشهر: ${txError.message}`);
  if (!userRow || (!userRow.is_host && !userRow.is_agent)) {
    throw new Error('هذا المستخدم ليس مضيفاً أو وكيلاً معتمداً.');
  }

  const monthTransactions = transactions || [];
  const earnedDiamonds = monthTransactions
    .filter((tx) => tx.type === 'host_earning' && tx.currency === 'diamonds')
    .reduce((sum, tx) => sum + Math.max(0, Number(tx.amount || 0)), 0);
  const chargedCoins = monthTransactions
    .filter((tx) => ['usdt_deposit', 'topup', 'sham_cash_deposit'].includes(tx.type))
    .reduce((sum, tx) => sum + Math.max(0, Number(tx.amount || 0)), 0);
  const target = Math.max(1, Number(state.settings.hostMonthlyTargetDiamonds || 100000));
  const diamondsPerUsdt = Math.max(1, Number(state.settings.hostDiamondsPerUsdt || 1000));
  const capRate = Math.max(0, Math.min(1, Number(state.settings.hostRechargePayoutCapRate ?? 0.5)));
  const coinsPerUsdt = Math.max(1, Number(state.settings.usdtToCoinsRate || 1000));
  const rechargeCapUsdt = Math.floor((chargedCoins / coinsPerUsdt) * capRate);
  const amountUsdt =
    earnedDiamonds >= target
      ? Math.min(Math.floor(earnedDiamonds / diamondsPerUsdt), rechargeCapUsdt)
      : 0;
  if (amountUsdt <= 0) {
    throw new Error(
      earnedDiamonds < target
        ? `لم يحقق المضيف التارغت الشهري (${target.toLocaleString('en-US')} ألماسة).`
        : 'قيمة الشحن المسجلة لا تسمح بصرف راتب هذا الشهر.'
    );
  }

  const transactionId = `host_payroll_${month}_${userId}`;
  const { data: existing, error: existingError } = await supabase
    .from('sada_transactions')
    .select('id')
    .eq('id', transactionId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) throw new Error('تم تسجيل صرف راتب هذا المضيف لهذا الشهر مسبقاً.');

  await recordTransaction({
    id: transactionId,
    userId,
    type: 'host_payroll',
    amount: amountUsdt,
    currency: 'usdt',
    description: `تأكيد صرف راتب ${month}: ${earnedDiamonds} ألماسة، ${amountUsdt} USDT`,
  });
  return { amountUsdt, earnedDiamonds, rechargeCapUsdt };
}

export async function payAgencyMonthlyCommissionInSupabase(
  agencyId: string,
  month: string
): Promise<{ paidDiamonds: number; agencyName: string }> {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('شهر كشف العمولات غير صالح.');
  const monthStart = new Date(`${month}-01T00:00:00.000Z`);
  const [{ data: agencyRow, error: agencyError }, state] = await Promise.all([
    supabase.from('sada_agencies').select(AGENCY_COLUMNS).eq('id', agencyId).maybeSingle(),
    getPlatformState({ forceRefresh: true }),
  ]);
  if (agencyError) throw new Error(agencyError.message);
  if (!agencyRow) throw new Error('الوكالة غير موجودة.');
  const agency = rowToAgency(agencyRow);
  const { data: hosts, error: hostsError } = await supabase
    .from('sada_users')
    .select('id')
    .eq('agency_id', agency.id)
    .eq('is_host', true);
  if (hostsError) throw new Error(hostsError.message);
  const hostIds = (hosts || []).map((host) => String(host.id));
  if (hostIds.length === 0) throw new Error('لا يوجد مضيفون معتمدون في الوكالة.');

  const [{ data: earnings, error: earningsError }, { data: ownerRow, error: ownerError }] =
    await Promise.all([
      supabase
        .from('sada_transactions')
        .select('amount')
        .in('user_id', hostIds)
        .eq('type', 'host_earning')
        .eq('currency', 'diamonds')
        .gte('timestamp', monthStart.toISOString())
        .lt('timestamp', new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)).toISOString()),
      supabase.from('sada_users').select('id, diamonds').eq('id', agency.ownerId).maybeSingle(),
    ]);
  if (earningsError) throw new Error(earningsError.message);
  if (ownerError) throw new Error(ownerError.message);
  if (!ownerRow) throw new Error('حساب مالك الوكالة غير موجود.');

  const monthlyDiamonds = (earnings || []).reduce(
    (sum, tx) => sum + Math.max(0, Number(tx.amount || 0)),
    0
  );
  const rate = Math.max(
    0,
    Math.min(0.5, Number(state.settings.agencyPayrollCommissionRate ?? 0.1))
  );
  const paidDiamonds = Math.floor(monthlyDiamonds * rate);
  if (paidDiamonds <= 0) throw new Error('لا توجد عمولة مستحقة للصرف لهذا الشهر.');

  const transactionId = `agency_payroll_${month}_${agency.id}`;
  const { data: existing, error: existingError } = await supabase
    .from('sada_transactions')
    .select('id')
    .eq('id', transactionId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) throw new Error('تم صرف عمولة هذه الوكالة لهذا الشهر مسبقاً.');

  const previousBalance = Number(ownerRow.diamonds || 0);
  const { data: updatedOwner, error: balanceError } = await supabase
    .from('sada_users')
    .update({ diamonds: previousBalance + paidDiamonds })
    .eq('id', agency.ownerId)
    .eq('diamonds', previousBalance)
    .select('id')
    .maybeSingle();
  if (balanceError) throw new Error(`تعذّر إضافة العمولة إلى محفظة الوكيل: ${balanceError.message}`);
  if (!updatedOwner) throw new Error('تغيّر رصيد الوكيل أثناء الصرف. أعد المحاولة.');

  try {
    await recordTransaction({
      id: transactionId,
      userId: agency.ownerId,
      type: 'agency_payroll',
      amount: paidDiamonds,
      currency: 'diamonds',
      description: `عمولة وكالة ${agency.name} عن ${month}`,
    });
  } catch (error) {
    const { error: rollbackError } = await supabase
      .from('sada_users')
      .update({ diamonds: previousBalance })
      .eq('id', agency.ownerId)
      .eq('diamonds', previousBalance + paidDiamonds);
    if (rollbackError) {
      throw new Error(
        `تعذّر تسجيل عمولة الوكالة (${error instanceof Error ? error.message : 'خطأ غير معروف'}) أو التراجع عن الرصيد (${rollbackError.message}).`
      );
    }
    throw error;
  }
  return { paidDiamonds, agencyName: agency.name };
}

export async function updateHostApprovalInSupabase(
  targetId: string,
  payload: { isHost?: boolean; isAgent?: boolean; agencyId?: string | null }
): Promise<void> {
  const { data: uRow } = await supabase
    .from('sada_users')
    .select(USER_COLUMNS)
    .eq('id', targetId)
    .maybeSingle();
  if (!uRow) throw new Error('العضو غير موجود.');
  const target = rowToUser(uRow);

  const patch: Record<string, unknown> = {};
  if (typeof payload.isHost === 'boolean') {
    patch.is_host = payload.isHost;
    patch.host_badge = payload.isHost ? 'مضيف معتمد' : null;
  }
  if (typeof payload.isAgent === 'boolean') {
    patch.is_agent = payload.isAgent;
  }

  if (payload.agencyId !== undefined) {
    const prevAgId = target.agencyId;
    if (prevAgId && prevAgId !== payload.agencyId) {
      const { data: prevAg } = await supabase
        .from('sada_agencies')
        .select('id, host_ids')
        .eq('id', prevAgId)
        .maybeSingle();
      if (prevAg) {
        const list = Array.isArray(prevAg.host_ids)
          ? (prevAg.host_ids as string[]).filter((id) => id !== targetId)
          : [];
        await supabase.from('sada_agencies').update({ host_ids: list }).eq('id', prevAgId);
      }
    }

    if (payload.agencyId) {
      const { data: nextAg } = await supabase
        .from('sada_agencies')
        .select(AGENCY_COLUMNS)
        .eq('id', payload.agencyId)
        .maybeSingle();
      if (nextAg) {
        const list = Array.isArray(nextAg.host_ids) ? [...(nextAg.host_ids as string[])] : [];
        if (!list.includes(targetId)) list.push(targetId);
        await supabase.from('sada_agencies').update({ host_ids: list }).eq('id', nextAg.id);
        patch.agency_id = nextAg.id;
        patch.host_agency_name = String(nextAg.name);
        patch.is_host = true;
        patch.host_badge = patch.host_badge || 'مضيف معتمد';
      }
    } else {
      patch.agency_id = null;
      patch.host_agency_name = null;
    }
  }

  await supabase.from('sada_users').update(patch).eq('id', targetId);
}

export async function reviewHostJoinApplicationInSupabase(
  appId: string,
  decision: 'approved' | 'rejected'
): Promise<void> {
  const state = await getPlatformState();
  const apps = [...(state.settings.hostJoinApplications || [])];
  const idx = apps.findIndex((a) => a.id === appId);
  if (idx < 0) throw new Error('طلب الانضمام غير موجود.');
  const app = apps[idx];
  if (app.status !== 'pending') {
    throw new Error('تمت مراجعة هذا الطلب مسبقاً.');
  }

  const now = new Date().toISOString();
  apps[idx] = {
    ...app,
    status: decision,
    reviewedAt: now,
  };

  if (decision === 'approved') {
    await updateHostApprovalInSupabase(app.userId, {
      isHost: true,
      agencyId: app.agencyId,
    });
  }

  await savePlatformState({
    settings: {
      ...state.settings,
      hostJoinApplications: apps,
    },
  });
}

export function buildQuestionsCsvText(questions: CulturalQuestionAdminItem[]): string {
  const esc = (val: unknown) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = [
    'category',
    'question',
    'option1',
    'option2',
    'option3',
    'option4',
    'correctIndex',
    'xpReward',
    'coinsReward',
  ].join(',');

  const lines = questions.map((q) =>
    [
      esc(q.category),
      esc(q.question),
      esc(q.options[0]),
      esc(q.options[1]),
      esc(q.options[2]),
      esc(q.options[3]),
      q.correctIndex + 1,
      q.xpReward,
      q.coinsReward,
    ].join(',')
  );

  return `\uFEFF${[header, ...lines].join('\n')}`;
}

function parseCsvLine(line: string): string[] {
  const res: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      res.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  res.push(cur.trim());
  return res;
}

export async function importQuestionsInSupabase(payload: {
  rows?: Array<{
    category?: string;
    question?: string;
    option1?: string;
    option2?: string;
    option3?: string;
    option4?: string;
    correctIndex?: string | number;
    xpReward?: string | number;
    coinsReward?: string | number;
  }>;
  csvText?: string;
  mode: 'append' | 'replace';
}): Promise<{ importedCount: number; totalCount: number }> {
  let rawRows = payload.rows || [];

  if (payload.csvText && payload.csvText.trim()) {
    const lines = payload.csvText
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      const firstLower = lines[0].toLowerCase();
      const hasHeader =
        firstLower.includes('question') ||
        firstLower.includes('category') ||
        firstLower.includes('السؤال');
      const dataLines = hasHeader ? lines.slice(1) : lines;
      rawRows = dataLines.map((line) => {
        const cols = parseCsvLine(line);
        return {
          category: cols[0] || 'ثقافة عامة',
          question: cols[1] || '',
          option1: cols[2] || '',
          option2: cols[3] || '',
          option3: cols[4] || '',
          option4: cols[5] || '',
          correctIndex: cols[6] ?? 1,
          xpReward: cols[7] ?? 120,
          coinsReward: cols[8] ?? 350,
        };
      });
    }
  }

  const valid = rawRows
    .filter((r) => String(r.question || '').trim() && String(r.option1 || '').trim())
    .map((r) => {
      const rawIdx = Number(r.correctIndex ?? 1);
      const zeroIdx = rawIdx >= 1 && rawIdx <= 4 ? rawIdx - 1 : Math.max(0, Math.min(3, rawIdx));
      return {
        id: genId('cq'),
        category: String(r.category || 'ثقافة عامة').trim(),
        question: String(r.question || '').trim(),
        options: [
          String(r.option1 || '').trim(),
          String(r.option2 || '').trim(),
          String(r.option3 || '').trim(),
          String(r.option4 || '').trim(),
        ],
        correct_index: zeroIdx,
        xp_reward: Math.max(20, Math.floor(Number(r.xpReward) || 120)),
        coins_reward: Math.max(50, Math.floor(Number(r.coinsReward) || 350)),
      };
    });

  if (valid.length === 0) {
    throw new Error('لم يتم العثور على أسئلة صالحة للاستيراد.');
  }

  if (payload.mode === 'replace') {
    await supabase.from('sada_cultural_questions').delete().neq('id', '');
  }

  const { error } = await supabase.from('sada_cultural_questions').insert(valid);
  if (error) throw new Error('تعذّر حفظ الأسئلة المستوردة في قاعدة البيانات.');

  const { count } = await supabase
    .from('sada_cultural_questions')
    .select('id', { count: 'exact', head: true });

  return {
    importedCount: valid.length,
    totalCount: count ?? valid.length,
  };
}

export async function deleteQuestionInSupabase(
  qId: string
): Promise<CulturalQuestionAdminItem[]> {
  await supabase.from('sada_cultural_questions').delete().eq('id', qId);
  const { data } = await supabase.from('sada_cultural_questions').select(QUESTION_COLUMNS);
  return (data || []).map(rowToQuestion);
}

export async function savePlatformSettingsInSupabase(
  nextSettings: PlatformSettings
): Promise<PlatformSettings> {
  const saved = await savePlatformState({ settings: nextSettings });
  return saved.settings;
}
