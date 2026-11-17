import type {
  FemaleVoiceVerificationRequest,
  FrameItem,
  Transaction,
  UsdtDepositRequest,
  UsdtWithdrawalRequest,
  User,
} from '../types';
import {
  ADMIN_USDT_TRC20_ADDRESS,
  FRAME_CATALOG,
  genId,
  getRechargeRewardTier,
  isFemaleVoiceLocked,
  MIN_WITHDRAW_USDT,
  STORE_3D_ITEMS,
} from './sadaCatalog';
import {
  getPlatformState,
  purgeExpiredRewardsOnUser,
  recordTransaction,
  rowToDeposit,
  rowToFemaleVoiceReq,
  rowToTransaction,
  rowToUser,
  rowToWithdrawal,
} from './sadaMappers';
import { syncUserOnActiveRoomSeats } from './sadaAuth';
import { supabase } from './supabase';

export async function checkWithdrawalEligibility(user: User): Promise<{
  eligible: boolean;
  roleLabel: string;
}> {
  if (user.is_admin) return { eligible: true, roleLabel: 'إدارة' };
  if (user.isAgent) return { eligible: true, roleLabel: 'وكيل' };
  if (user.isHost) return { eligible: true, roleLabel: 'مضيف' };

  const [{ data: hostedRooms }, { data: wonComps }, { data: prizeTxs }] =
    await Promise.all([
      supabase.from('sada_rooms').select('id').eq('host_id', user.id).limit(1),
      supabase.from('sada_competitions').select('id').eq('winner_id', user.id).limit(1),
      supabase
        .from('sada_transactions')
        .select('id')
        .eq('user_id', user.id)
        .in('type', ['prize', 'quiz_reward', 'referral_wheel'])
        .limit(1),
    ]);

  if ((hostedRooms || []).length > 0) {
    return { eligible: true, roleLabel: 'مضيف' };
  }
  if ((wonComps || []).length > 0 || (prizeTxs || []).length > 0) {
    return { eligible: true, roleLabel: 'فائز' };
  }
  return { eligible: false, roleLabel: 'عضو' };
}

export async function getWalletOverviewFromSupabase(userId: string) {
  const [
    { data: userRow },
    { data: txRows },
    { data: depRows },
    { data: wdRows },
    state,
  ] = await Promise.all([
    supabase.from('sada_users').select('*').eq('id', userId).maybeSingle(),
    supabase
      .from('sada_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(30),
    supabase
      .from('sada_usdt_deposits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('sada_usdt_withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    getPlatformState(),
  ]);

  if (!userRow) throw new Error('المستخدم غير موجود.');
  const user = rowToUser(userRow);
  await purgeExpiredRewardsOnUser(user);

  const eligibility = await checkWithdrawalEligibility(user);

  return {
    user,
    transactions: (txRows || []).map(rowToTransaction) as Transaction[],
    frames: FRAME_CATALOG.filter(
      (f) => !f.isTemporary || user.unlockedFrames.includes(f.id)
    ) as FrameItem[],
    adminTrc20Address: ADMIN_USDT_TRC20_ADDRESS,
    usdtToCoinsRate: state.settings.usdtToCoinsRate,
    diamondToCoinsRate: state.settings.diamondToCoinsRate,
    rewardTiers: state.settings.rechargeRewardTiers,
    usdtDeposits: (depRows || []).map(rowToDeposit) as UsdtDepositRequest[],
    usdtWithdrawals: (wdRows || []).map(rowToWithdrawal) as UsdtWithdrawalRequest[],
    withdrawalEligibility: {
      eligible: eligibility.eligible,
      roleLabel: eligibility.roleLabel,
      minUsdt: MIN_WITHDRAW_USDT,
      diamondsPerUsdt: state.settings.diamondsPerUsdt,
      coinsPerUsdt: state.settings.coinsPerUsdtWithdraw,
    },
  };
}

export async function submitUsdtDepositInSupabase(
  user: User,
  payload: { amountUsdt: number; txId: string; proofImage: string }
): Promise<{ deposit: UsdtDepositRequest; user: User }> {
  const cleanAmount = Number(payload.amountUsdt);
  if (!Number.isFinite(cleanAmount) || cleanAmount < 10) {
    throw new Error('الحد الأدنى للشحن عبر USDT (TRC20) هو 10 دولار.');
  }
  const cleanTxId = (payload.txId || '').trim();
  if (cleanTxId.length < 8) {
    throw new Error('يرجى إدخال كود الحوالة (TxID) الصحيح (8 أحرف على الأقل).');
  }

  const { data: existingTx } = await supabase
    .from('sada_usdt_deposits')
    .select('id, status')
    .ilike('tx_id', cleanTxId)
    .neq('status', 'rejected')
    .limit(1);

  if ((existingTx || []).length > 0) {
    throw new Error('كود الحوالة (TxID) هذا مسجل مسبقاً في طلب آخر.');
  }

  const cleanProof = (payload.proofImage || '').trim();
  if (!cleanProof || (!cleanProof.startsWith('data:image/') && !cleanProof.startsWith('http'))) {
    throw new Error('يرجى إرفاق صورة إثبات التحويل واضحة.');
  }

  const state = await getPlatformState();
  const tier = getRechargeRewardTier(cleanAmount, state.settings.rechargeRewardTiers);
  const baseCoins = Math.round(cleanAmount * state.settings.usdtToCoinsRate);
  const bonusCoins = tier ? Math.round(baseCoins * tier.bonusRate) : 0;
  const coinsCredited = baseCoins + bonusCoins;
  const now = new Date().toISOString();

  const deposit: UsdtDepositRequest = {
    id: genId('dep'),
    userId: user.id,
    userEmail: user.email,
    userDisplayName: user.displayName,
    amountUsdt: Math.round(cleanAmount * 100) / 100,
    coinsCredited,
    txId: cleanTxId.slice(0, 128),
    proofImage: cleanProof,
    walletAddress: ADMIN_USDT_TRC20_ADDRESS,
    network: 'TRC20',
    rewardTierLabel: tier ? tier.label : null,
    status: 'pending',
    adminNote: null,
    createdAt: now,
    reviewedAt: null,
  };

  const { error } = await supabase.from('sada_usdt_deposits').insert({
    id: deposit.id,
    user_id: deposit.userId,
    user_email: deposit.userEmail,
    user_display_name: deposit.userDisplayName,
    amount_usdt: deposit.amountUsdt,
    coins_credited: deposit.coinsCredited,
    tx_id: deposit.txId,
    proof_image: deposit.proofImage,
    wallet_address: deposit.walletAddress,
    network: 'TRC20',
    reward_tier_label: deposit.rewardTierLabel,
    status: 'pending',
    admin_note: null,
    created_at: now,
    reviewed_at: null,
  });

  if (error) {
    throw new Error('تعذّر تسجيل طلب الإيداع في Supabase.');
  }

  return { deposit, user };
}

export async function submitUsdtWithdrawalInSupabase(
  user: User,
  payload: {
    sourceCurrency: 'diamonds' | 'coins';
    sourceAmount: number;
    trc20Address: string;
  }
): Promise<{ withdrawal: UsdtWithdrawalRequest; user: User }> {
  const { data: userRow } = await supabase
    .from('sada_users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  const freshUser = userRow ? rowToUser(userRow) : { ...user };

  const eligibility = await checkWithdrawalEligibility(freshUser);
  if (!eligibility.eligible) {
    throw new Error(
      'سحب الأرباح إلى USDT متاح حصراً للفائزين بالمسابقات والوكلاء والمضيفين المعتمدين.'
    );
  }

  const currency = payload.sourceCurrency === 'coins' ? 'coins' : 'diamonds';
  if (currency === 'diamonds' && isFemaleVoiceLocked(freshUser)) {
    throw new Error('رصيد الألماس مقفل لحين إتمام التوثيق الصوتي واعتماد الإدارة.');
  }

  const cleanSourceAmount = Math.floor(Number(payload.sourceAmount) || 0);
  const cleanAddress = (payload.trc20Address || '').trim();
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(cleanAddress)) {
    throw new Error(
      'عنوان محفظة USDT (TRC20) غير صالح. يجب أن يبدأ بحرف T ويتكوّن من 34 رمزاً.'
    );
  }

  const state = await getPlatformState();
  const rate =
    currency === 'diamonds'
      ? state.settings.diamondsPerUsdt
      : state.settings.coinsPerUsdtWithdraw;
  const minSourceAmount = MIN_WITHDRAW_USDT * rate;

  if (cleanSourceAmount < minSourceAmount) {
    throw new Error(
      `الحد الأدنى للسحب هو ${MIN_WITHDRAW_USDT} USDT (${minSourceAmount.toLocaleString(
        'en-US'
      )} ${currency === 'diamonds' ? 'ألماسة' : 'كوينز'}).`
    );
  }

  if (freshUser[currency] < cleanSourceAmount) {
    throw new Error(
      currency === 'diamonds'
        ? 'رصيد الألماس غير كافٍ لإتمام طلب السحب.'
        : 'رصيد الكوينز غير كافٍ لإتمام طلب السحب.'
    );
  }

  const amountUsdt = Math.round((cleanSourceAmount / rate) * 100) / 100;
  const now = new Date().toISOString();
  freshUser[currency] -= cleanSourceAmount;

  const withdrawal: UsdtWithdrawalRequest = {
    id: genId('wd'),
    userId: freshUser.id,
    userEmail: freshUser.email,
    userDisplayName: freshUser.displayName,
    userRoleLabel: eligibility.roleLabel,
    sourceCurrency: currency,
    sourceAmount: cleanSourceAmount,
    amountUsdt,
    trc20Address: cleanAddress,
    network: 'TRC20',
    status: 'pending',
    adminNote: null,
    createdAt: now,
    reviewedAt: null,
  };

  await Promise.all([
    supabase
      .from('sada_users')
      .update({ [currency]: freshUser[currency] })
      .eq('id', freshUser.id),
    supabase.from('sada_usdt_withdrawals').insert({
      id: withdrawal.id,
      user_id: withdrawal.userId,
      user_email: withdrawal.userEmail,
      user_display_name: withdrawal.userDisplayName,
      user_role_label: withdrawal.userRoleLabel,
      source_currency: withdrawal.sourceCurrency,
      source_amount: withdrawal.sourceAmount,
      amount_usdt: withdrawal.amountUsdt,
      trc20_address: withdrawal.trc20Address,
      network: 'TRC20',
      status: 'pending',
      admin_note: null,
      created_at: now,
      reviewed_at: null,
    }),
    recordTransaction({
      userId: freshUser.id,
      type: 'usdt_withdrawal',
      amount: -cleanSourceAmount,
      currency,
      description: `طلب سحب ${amountUsdt} USDT (TRC20) إلى ${cleanAddress.slice(0, 8)}…${cleanAddress.slice(-6)}`,
      timestamp: now,
    }),
  ]);

  return { withdrawal, user: freshUser };
}

export async function convertDiamondsToCoinsInSupabase(
  user: User,
  diamonds: number
): Promise<User> {
  const { data: userRow } = await supabase
    .from('sada_users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  const freshUser = userRow ? rowToUser(userRow) : { ...user };

  if (isFemaleVoiceLocked(freshUser)) {
    throw new Error('رصيد الألماس مقفل لحين إتمام التوثيق الصوتي واعتماد الإدارة.');
  }
  const amount = Math.floor(Number(diamonds) || 0);
  if (amount < 10) {
    throw new Error('الحد الأدنى للتحويل هو 10 ألماسات.');
  }
  if (freshUser.diamonds < amount) {
    throw new Error('رصيد الألماس غير كافٍ.');
  }

  const state = await getPlatformState();
  const gainedCoins = Math.round(amount * (state.settings.diamondToCoinsRate || 2));
  const now = new Date().toISOString();

  freshUser.diamonds -= amount;
  freshUser.coins += gainedCoins;

  await Promise.all([
    supabase
      .from('sada_users')
      .update({ diamonds: freshUser.diamonds, coins: freshUser.coins })
      .eq('id', freshUser.id),
    recordTransaction({
      userId: freshUser.id,
      type: 'convert',
      amount: gainedCoins,
      currency: 'coins',
      description: `تحويل ${amount} ألماسة إلى ${gainedCoins} كوينز`,
      timestamp: now,
    }),
  ]);

  return freshUser;
}

export async function purchaseOrEquipFrameInSupabase(
  user: User,
  frameId: string
): Promise<User> {
  const frame = FRAME_CATALOG.find((f) => f.id === frameId);
  if (!frame) throw new Error('الإطار غير موجود.');

  const { data: userRow } = await supabase
    .from('sada_users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  const freshUser = userRow ? rowToUser(userRow) : { ...user };

  if (freshUser.unlockedFrames.includes(frame.id)) {
    freshUser.frameId = frame.id;
    await supabase
      .from('sada_users')
      .update({ frame_id: frame.id })
      .eq('id', freshUser.id);
    return freshUser;
  }

  if (freshUser.coins < frame.priceCoins) {
    throw new Error('رصيد الكوينز غير كافٍ لاقتناء هذا الإطار.');
  }

  freshUser.coins -= frame.priceCoins;
  freshUser.unlockedFrames = [...freshUser.unlockedFrames, frame.id];
  freshUser.frameId = frame.id;

  await Promise.all([
    supabase
      .from('sada_users')
      .update({
        coins: freshUser.coins,
        unlocked_frames: freshUser.unlockedFrames,
        frame_id: frame.id,
      })
      .eq('id', freshUser.id),
    recordTransaction({
      userId: freshUser.id,
      type: 'store_purchase',
      amount: -frame.priceCoins,
      currency: 'coins',
      description: `اقتناء وتفعيل ${frame.name}`,
      timestamp: new Date().toISOString(),
    }),
  ]);

  return freshUser;
}

export async function getFemaleVoiceStatusFromSupabase(user: User): Promise<{
  status: User['femaleVoiceStatus'];
  latestRequest: FemaleVoiceVerificationRequest | null;
}> {
  const { data } = await supabase
    .from('sada_female_voice_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    status: user.femaleVoiceStatus || (user.gender === 'female' ? 'unverified' : 'none'),
    latestRequest: data ? rowToFemaleVoiceReq(data) : null,
  };
}

export async function submitFemaleVoiceVerificationInSupabase(
  user: User,
  payload: {
    audioDataUrl: string;
    durationSeconds?: number;
    phrase?: string;
  }
): Promise<{ request: FemaleVoiceVerificationRequest; user: User }> {
  if (user.gender !== 'female') {
    throw new Error('التوثيق الصوتي مخصص للحسابات النسائية فقط.');
  }
  if (user.femaleVoiceStatus === 'verified') {
    throw new Error('حسابكِ موثّق صوتياً بالفعل.');
  }

  const cleanAudio = (payload.audioDataUrl || '').trim();
  if (!cleanAudio.startsWith('data:audio/') || cleanAudio.length < 120) {
    throw new Error('يرجى تسجيل مقطع صوتي صالح لمدة 5 ثوانٍ قبل إرسال الطلب.');
  }
  if (cleanAudio.length > 4_000_000) {
    throw new Error('حجم المقطع الصوتي كبير جداً. يرجى تسجيل 5 ثوانٍ فقط.');
  }

  const now = new Date().toISOString();
  const reqDoc: FemaleVoiceVerificationRequest = {
    id: genId('fvr'),
    userId: user.id,
    displayName: user.displayName,
    email: user.email,
    audioDataUrl: cleanAudio,
    durationSeconds: Math.max(1, Math.min(10, Math.round(Number(payload.durationSeconds) || 5))),
    phrase: (payload.phrase || '').trim() || 'أهلاً بكم في تطبيق صَدَى',
    status: 'pending',
    createdAt: now,
    reviewedAt: null,
    adminNote: null,
  };

  const nextUser: User = {
    ...user,
    femaleVoiceStatus: 'pending',
    femaleVerified: false,
    femaleVoiceNote: null,
  };

  await Promise.all([
    supabase.from('sada_female_voice_requests').insert({
      id: reqDoc.id,
      user_id: reqDoc.userId,
      display_name: reqDoc.displayName,
      email: reqDoc.email,
      audio_data_url: reqDoc.audioDataUrl,
      duration_seconds: reqDoc.durationSeconds,
      phrase: reqDoc.phrase,
      status: 'pending',
      created_at: now,
      reviewed_at: null,
      admin_note: null,
    }),
    supabase
      .from('sada_users')
      .update({
        female_voice_status: 'pending',
        female_verified: false,
        female_voice_note: null,
      })
      .eq('id', user.id),
  ]);

  return { request: reqDoc, user: nextUser };
}

export async function computeUserCumulativeRechargeCoins(user: User): Promise<{
  totalRechargedCoins: number;
  user: User;
}> {
  const [{ data: approvedDeps }, { data: rechargeTxs }] = await Promise.all([
    supabase
      .from('sada_usdt_deposits')
      .select('coins_credited')
      .eq('user_id', user.id)
      .eq('status', 'approved'),
    supabase
      .from('sada_transactions')
      .select('type, amount, description')
      .eq('user_id', user.id)
      .in('type', ['topup', 'admin_grant']),
  ]);

  const fromDeposits = (approvedDeps || []).reduce(
    (sum, d) => sum + Math.max(0, Number(d.coins_credited || 0)),
    0
  );
  const fromTxs = (rechargeTxs || []).reduce((sum, t) => {
    const amt = Number(t.amount || 0);
    if (amt <= 0) return sum;
    if (t.type === 'admin_grant' && String(t.description || '').includes('ترحيبي')) {
      return sum;
    }
    return sum + amt;
  }, 0);

  const totalRechargedCoins = fromDeposits + fromTxs;
  const reachedIds = STORE_3D_ITEMS.filter(
    (item) => totalRechargedCoins >= item.minRechargeCoins
  ).map((item) => item.id);

  const missing = reachedIds.filter((id) => !user.unlockedFrames.includes(id));
  if (missing.length > 0) {
    const nextUnlocked = [...user.unlockedFrames, ...missing];
    user.unlockedFrames = nextUnlocked;
    await supabase
      .from('sada_users')
      .update({ unlocked_frames: nextUnlocked })
      .eq('id', user.id);
  }

  return { totalRechargedCoins, user };
}

export async function getStoreAndBagOverviewFromSupabase(userId: string) {
  const walletData = await getWalletOverviewFromSupabase(userId);
  const { totalRechargedCoins, user } = await computeUserCumulativeRechargeCoins(
    walletData.user
  );

  return {
    ...walletData,
    user,
    totalRechargedCoins,
    storeItems: STORE_3D_ITEMS,
  };
}

export async function equipStoreOrBagItemInSupabase(
  user: User,
  itemId: string
): Promise<User> {
  const storeItem = STORE_3D_ITEMS.find((s) => s.id === itemId);
  if (storeItem) {
    const { data: userRow } = await supabase
      .from('sada_users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    const freshUser = userRow ? rowToUser(userRow) : { ...user };
    const { totalRechargedCoins } = await computeUserCumulativeRechargeCoins(freshUser);

    if (
      !freshUser.unlockedFrames.includes(storeItem.id) &&
      totalRechargedCoins < storeItem.minRechargeCoins
    ) {
      throw new Error(
        `يُفتح "${storeItem.name}" تلقائياً عند بلوغ إجمالي شحن ${storeItem.minRechargeCoins.toLocaleString(
          'en-US'
        )} كوينز.`
      );
    }

    if (!freshUser.unlockedFrames.includes(storeItem.id)) {
      freshUser.unlockedFrames = [...freshUser.unlockedFrames, storeItem.id];
    }
    freshUser.frameId = storeItem.id;
    const patch: Record<string, unknown> = {
      frame_id: storeItem.id,
      unlocked_frames: freshUser.unlockedFrames,
    };

    if (storeItem.entryId && storeItem.entryName) {
      const expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
      freshUser.activeEntryId = storeItem.entryId;
      freshUser.activeEntryName = storeItem.entryName;
      freshUser.tempEntryExpiresAt = expiresAt;
      patch.active_entry_id = storeItem.entryId;
      patch.active_entry_name = storeItem.entryName;
      patch.temp_entry_expires_at = expiresAt;
    }

    await supabase.from('sada_users').update(patch).eq('id', freshUser.id);
    await syncUserOnActiveRoomSeats(freshUser);
    return freshUser;
  }

  const updated = await purchaseOrEquipFrameInSupabase(user, itemId);
  await syncUserOnActiveRoomSeats(updated);
  return updated;
}
