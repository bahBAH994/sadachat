import type {
  Agency,
  Competition,
  CulturalQuestionAdminItem,
  DeviceLock,
  FemaleVoiceVerificationRequest,
  HostJoinApplication,
  PlatformSettings,
  Room,
  SecurityLog,
  UsdtDepositRequest,
  UsdtWithdrawalRequest,
  User,
} from '../types';
import {
  genId,
  getRechargeRewardTier,
  STORE_3D_ITEMS,
  SUPER_ADMIN_EMAIL,
  TEMP_ONLY_FRAME_IDS,
} from './sadaCatalog';
import {
  getPlatformState,
  recordTransaction,
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
} from './sadaMappers';
import { supabase } from './supabase';

export interface AdminOverviewPayload {
  users: User[];
  deviceLocks: DeviceLock[];
  securityLogs: SecurityLog[];
  rooms: Room[];
  competitions: Competition[];
  agencies: Agency[];
  culturalQuestions: CulturalQuestionAdminItem[];
  settings: PlatformSettings;
  usdtDeposits: UsdtDepositRequest[];
  usdtWithdrawals: UsdtWithdrawalRequest[];
  femaleVoiceRequests: FemaleVoiceVerificationRequest[];
  hostJoinApplications: HostJoinApplication[];
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

export async function getAdminOverviewFromSupabase(): Promise<AdminOverviewPayload> {
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
    state,
  ] = await Promise.all([
    supabase.from('sada_users').select('*').order('created_at', { ascending: false }),
    supabase.from('sada_device_locks').select('*').order('last_attempt_at', { ascending: false }),
    supabase.from('sada_security_logs').select('*').order('timestamp', { ascending: false }).limit(80),
    supabase.from('sada_rooms').select('*').order('created_at', { ascending: false }),
    supabase.from('sada_competitions').select('*').order('ends_at', { ascending: false }),
    supabase.from('sada_agencies').select('*').order('created_at', { ascending: false }),
    supabase.from('sada_cultural_questions').select('*'),
    supabase.from('sada_usdt_deposits').select('*').order('created_at', { ascending: false }),
    supabase.from('sada_usdt_withdrawals').select('*').order('created_at', { ascending: false }),
    supabase
      .from('sada_female_voice_requests')
      .select('*')
      .order('created_at', { ascending: false }),
    getPlatformState(),
  ]);

  const users = (usersRes.data || []).map(rowToUser);
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
    culturalQuestions,
    settings: state.settings,
    usdtDeposits,
    usdtWithdrawals,
    femaleVoiceRequests,
    hostJoinApplications,
    stats: {
      totalUsers: users.length,
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
  payload: { coinsDelta?: number; is_banned?: boolean; is_admin?: boolean }
): Promise<User> {
  const { data: row, error } = await supabase
    .from('sada_users')
    .select('*')
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
      description: 'تعديل رصيد إداري من لوحة الإدارة العليا',
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

  const { data: updated, error: upErr } = await supabase
    .from('sada_users')
    .update(updatePatch)
    .eq('id', targetId)
    .select('*')
    .single();
  if (upErr || !updated) throw new Error('تعذّر تحديث بيانات العضو.');
  return rowToUser(updated);
}

export async function unlockDeviceInSupabase(uuid: string): Promise<void> {
  const { data: existing } = await supabase
    .from('sada_device_locks')
    .select('*')
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
    .select('*')
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
    .select('*')
    .single();
  if (error || !data) throw new Error('تعذّر إطلاق المسابقة الجديدة.');
  return rowToCompetition(data);
}

export async function finishCompetitionInSupabase(compId: string): Promise<void> {
  const { data: compRow, error } = await supabase
    .from('sada_competitions')
    .select('*')
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
  const [{ data: depRow }, state] = await Promise.all([
    supabase.from('sada_usdt_deposits').select('*').eq('id', depositId).maybeSingle(),
    getPlatformState(),
  ]);
  if (!depRow) throw new Error('طلب الإيداع غير موجود.');
  if (depRow.status !== 'pending') throw new Error('تمت مراجعة هذا الطلب مسبقاً.');

  const dep = rowToDeposit(depRow);
  const { data: userRow } = await supabase
    .from('sada_users')
    .select('*')
    .eq('id', dep.userId)
    .maybeSingle();
  if (!userRow) throw new Error('صاحب الطلب غير موجود.');

  const u = rowToUser(userRow);
  const now = new Date().toISOString();

  await supabase
    .from('sada_usdt_deposits')
    .update({ status: 'approved', reviewed_at: now })
    .eq('id', depositId);

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
  const [{ data: approvedDeps }, { data: rechargeTxs }] = await Promise.all([
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
  await supabase
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
    .eq('id', u.id);

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
  const { data: depRow } = await supabase
    .from('sada_usdt_deposits')
    .select('status')
    .eq('id', depositId)
    .maybeSingle();
  if (!depRow) throw new Error('طلب الإيداع غير موجود.');
  if (depRow.status !== 'pending') throw new Error('تمت مراجعة هذا الطلب مسبقاً.');

  await supabase
    .from('sada_usdt_deposits')
    .update({
      status: 'rejected',
      admin_note: reason,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', depositId);
}

export async function approveUsdtWithdrawalInSupabase(wdId: string): Promise<void> {
  const { data: wdRow } = await supabase
    .from('sada_usdt_withdrawals')
    .select('status')
    .eq('id', wdId)
    .maybeSingle();
  if (!wdRow) throw new Error('طلب السحب غير موجود.');
  if (wdRow.status !== 'pending') throw new Error('تمت مراجعة هذا الطلب مسبقاً.');

  await supabase
    .from('sada_usdt_withdrawals')
    .update({
      status: 'approved',
      admin_note: 'تم تحويل USDT عبر شبكة TRC20 بنجاح',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', wdId);
}

export async function rejectUsdtWithdrawalInSupabase(
  wdId: string,
  reason = 'بيانات محفظة TRC20 غير مكتملة'
): Promise<void> {
  const { data: wdRow } = await supabase
    .from('sada_usdt_withdrawals')
    .select('*')
    .eq('id', wdId)
    .maybeSingle();
  if (!wdRow) throw new Error('طلب السحب غير موجود.');
  if (wdRow.status !== 'pending') throw new Error('تمت مراجعة هذا الطلب مسبقاً.');

  const wd = rowToWithdrawal(wdRow);
  const now = new Date().toISOString();

  await supabase
    .from('sada_usdt_withdrawals')
    .update({
      status: 'rejected',
      admin_note: reason,
      reviewed_at: now,
    })
    .eq('id', wdId);

  const { data: uRow } = await supabase
    .from('sada_users')
    .select('coins, diamonds')
    .eq('id', wd.userId)
    .maybeSingle();
  if (uRow) {
    const patch =
      wd.sourceCurrency === 'diamonds'
        ? { diamonds: Number(uRow.diamonds || 0) + wd.sourceAmount }
        : { coins: Number(uRow.coins || 0) + wd.sourceAmount };
    await supabase.from('sada_users').update(patch).eq('id', wd.userId);
    await recordTransaction({
      userId: wd.userId,
      type: 'usdt_withdrawal_refund',
      amount: wd.sourceAmount,
      currency: wd.sourceCurrency,
      description: `استرداد رصيد بعد رفض طلب سحب ${wd.amountUsdt} USDT`,
      timestamp: now,
    });
  }
}

export async function approveFemaleVoiceInSupabase(requestId: string): Promise<void> {
  const { data: reqRow } = await supabase
    .from('sada_female_voice_requests')
    .select('*')
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
    .select('*')
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
    .select('*')
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

export async function payoutAgencyCommissionInSupabase(
  agencyId: string,
  explicitDiamonds?: number,
  note?: string
): Promise<{ paidDiamonds: number; agencyName: string }> {
  const { data: agRow } = await supabase
    .from('sada_agencies')
    .select('*')
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

export async function updateHostApprovalInSupabase(
  targetId: string,
  payload: { isHost?: boolean; isAgent?: boolean; agencyId?: string | null }
): Promise<void> {
  const { data: uRow } = await supabase
    .from('sada_users')
    .select('*')
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
        .select('*')
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
  const { data } = await supabase.from('sada_cultural_questions').select('*');
  return (data || []).map(rowToQuestion);
}

export async function savePlatformSettingsInSupabase(
  nextSettings: PlatformSettings
): Promise<PlatformSettings> {
  const saved = await savePlatformState({ settings: nextSettings });
  return saved.settings;
}
