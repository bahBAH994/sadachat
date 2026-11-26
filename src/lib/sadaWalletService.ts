import type {
  FemaleVoiceVerificationRequest,
  FrameItem,
  HostTaskProgress,
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
  getUserVipTierInfo,
  isFemaleVoiceLocked,
  MIN_WITHDRAW_USDT,
  STORE_3D_ITEMS,
  STORE_COIN_ITEMS,
  STORE_LUXURY_BACKGROUNDS,
  TEMP_ONLY_FRAME_IDS,
  setCustomVipIdsCache,
  type VipIdItem,
} from './sadaCatalog';
import {
  DEPOSIT_COLUMNS,
  FEMALE_VOICE_REQ_COLUMNS,
  getPlatformState,
  purgeExpiredRewardsOnUser,
  recordTransaction,
  rowToDeposit,
  rowToFemaleVoiceReq,
  rowToTransaction,
  rowToUser,
  rowToWithdrawal,
  savePlatformState,
  TRANSACTION_COLUMNS,
  USER_COLUMNS,
  WITHDRAWAL_COLUMNS,
} from './sadaMappers';
import { syncUserOnActiveRoomSeats } from './sadaAuth';
import { fetchUserVipTotals } from './sadaVipService';
import { getEconomySettingsFromSupabase } from './sadaEconomyService';
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
    economySettings,
  ] = await Promise.all([
    supabase.from('sada_users').select(USER_COLUMNS).eq('id', userId).maybeSingle(),
    supabase
      .from('sada_transactions')
      .select(TRANSACTION_COLUMNS)
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(30),
    supabase
      .from('sada_usdt_deposits')
      .select(DEPOSIT_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('sada_usdt_withdrawals')
      .select(WITHDRAWAL_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    getPlatformState(),
    getEconomySettingsFromSupabase(),
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
    diamondToCoinsRate: economySettings.diamondConversionRate,
    roomBackgroundPrice: economySettings.roomBackgroundPrice,
    agencyBackgroundPrice: economySettings.agencyBackgroundPrice,
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
    .select(USER_COLUMNS)
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
    .select(USER_COLUMNS)
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

  const economySettings = await getEconomySettingsFromSupabase();
  const gainedCoins = Math.round(amount * economySettings.diamondConversionRate);
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
    .select(USER_COLUMNS)
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
    .select(FEMALE_VOICE_REQ_COLUMNS)
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
  totalSpentCoins: number;
  user: User;
}> {
  const { totalRechargedCoins, totalSpentCoins } = await fetchUserVipTotals(user.id, true);
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

  user.totalRecharged = totalRechargedCoins;
  user.totalSpentCoins = totalSpentCoins;
  user.vipLevel = getUserVipTierInfo(user).key;

  return { totalRechargedCoins, totalSpentCoins, user };
}

export async function getStoreAndBagOverviewFromSupabase(userId: string) {
  const [walletData, state] = await Promise.all([
    getWalletOverviewFromSupabase(userId),
    getPlatformState(),
  ]);
  const { totalRechargedCoins, user } = await computeUserCumulativeRechargeCoins(
    walletData.user
  );

  const ownedBackgrounds = Array.isArray(state.settings.userOwnedBackgrounds?.[userId])
    ? state.settings.userOwnedBackgrounds![userId]
    : [];
  const rawTask: HostTaskProgress = state.settings.userHostTasks?.[userId] || {
    streakDays: 0,
    lastCheckInDate: null,
    claimedDay7: false,
    claimedDay15: false,
  };

  return {
    ...walletData,
    user,
    totalRechargedCoins,
    storeItems: [],
    coinStoreItems: [],
    luxuryBackgrounds: [],
    ownedBackgrounds,
    hostTasks: rawTask,
  };
}

export async function purchaseStoreCoinItemInSupabase(
  user: User,
  itemId: string
): Promise<User> {
  const item = STORE_COIN_ITEMS.find((s) => s.id === itemId);
  if (!item) throw new Error('العنصر غير موجود في متجر الكوينز.');

  const { data: userRow, error: userError } = await supabase
    .from('sada_users')
    .select(USER_COLUMNS)
    .eq('id', user.id)
    .maybeSingle();
  if (userError) throw new Error(userError.message);
  if (!userRow) throw new Error('تعذّر تحميل بيانات الحساب لإتمام الشراء.');
  const freshUser = rowToUser(userRow);
  const originalUser = {
    ...freshUser,
    unlockedFrames: [...freshUser.unlockedFrames],
  };
  const alreadyOwned = freshUser.unlockedFrames.includes(item.id);
  const price = Math.max(0, Number(item.priceCoins || 0));

  if (!alreadyOwned) {
    if (freshUser.coins < price) {
      throw new Error(
        `رصيد الكوينز غير كافٍ. تحتاج إلى ${price.toLocaleString('en-US')} كوينز لشراء "${item.name}".`
      );
    }
    freshUser.coins -= price;
    freshUser.unlockedFrames = [...freshUser.unlockedFrames, item.id];
  }

  freshUser.frameId = item.id;
  const patch: Record<string, unknown> = {
    coins: freshUser.coins,
    unlocked_frames: freshUser.unlockedFrames,
    frame_id: item.id,
  };

  if (item.entryId && item.entryName) {
    const expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
    freshUser.activeEntryId = item.entryId;
    freshUser.activeEntryName = item.entryName;
    freshUser.tempEntryExpiresAt = expiresAt;
    patch.active_entry_id = item.entryId;
    patch.active_entry_name = item.entryName;
    patch.temp_entry_expires_at = expiresAt;
  }

  const { error: updateError } = await supabase
    .from('sada_users')
    .update(patch)
    .eq('id', freshUser.id);
  if (updateError) throw new Error(updateError.message);
  if (!alreadyOwned) {
    try {
      await recordTransaction({
        userId: freshUser.id,
        type: 'store_purchase',
        amount: -price,
        currency: 'coins',
        description: `شراء وتفعيل ${item.name} من المتجر الملكي`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const { error: rollbackError } = await supabase
        .from('sada_users')
        .update({
          coins: originalUser.coins,
          unlocked_frames: originalUser.unlockedFrames,
          frame_id: originalUser.frameId,
          active_entry_id: originalUser.activeEntryId,
          active_entry_name: originalUser.activeEntryName,
          temp_entry_expires_at: originalUser.tempEntryExpiresAt,
        })
        .eq('id', freshUser.id)
        .eq('coins', freshUser.coins);
      if (rollbackError) {
        console.error('Unable to rollback store item purchase:', rollbackError);
      }
      throw error;
    }
  }
  await syncUserOnActiveRoomSeats(freshUser);
  return freshUser;
}

export async function purchaseRoomBackgroundInSupabase(
  user: User,
  bgId: string
): Promise<{ user: User; ownedBackgrounds: string[] }> {
  const bg = STORE_LUXURY_BACKGROUNDS.find((b) => b.id === bgId);
  if (!bg) throw new Error('خلفية الوكالة غير موجودة.');

  const [{ data: userRow }, state, economySettings] = await Promise.all([
    supabase.from('sada_users').select(USER_COLUMNS).eq('id', user.id).maybeSingle(),
    getPlatformState(),
    getEconomySettingsFromSupabase(),
  ]);
  const freshUser = userRow ? rowToUser(userRow) : { ...user };
  const map = { ...(state.settings.userOwnedBackgrounds || {}) };
  const owned = Array.isArray(map[freshUser.id]) ? [...map[freshUser.id]] : [];

  if (owned.includes(bg.id)) {
    throw new Error('أنت تمتلك هذه الخلفية الفخمة بالفعل في حقيبتك.');
  }

  const backgroundPrice = economySettings.agencyBackgroundPrice;
  if (freshUser.coins < backgroundPrice) {
    throw new Error(
      `رصيد الكوينز غير كافٍ. سعر الخلفية ${backgroundPrice.toLocaleString('en-US')} كوينز.`
    );
  }

  freshUser.coins -= backgroundPrice;
  owned.push(bg.id);
  map[freshUser.id] = owned;

  await Promise.all([
    supabase.from('sada_users').update({ coins: freshUser.coins }).eq('id', freshUser.id),
    savePlatformState({
      settings: {
        ...state.settings,
        userOwnedBackgrounds: map,
      },
    }),
    recordTransaction({
      userId: freshUser.id,
      type: 'store_purchase',
      amount: -backgroundPrice,
      currency: 'coins',
      description: `شراء خلفية الوكالة الفخمة: ${bg.name}`,
      timestamp: new Date().toISOString(),
    }),
  ]);

  return { user: freshUser, ownedBackgrounds: owned };
}

export async function purchaseVipIdInSupabase(
  user: User,
  vipId: VipIdItem
): Promise<{ user: User; customVipIds: Record<string, string> }> {
  const { error: purchaseError } = await supabase.rpc('sada_purchase_vip_id', {
    p_user_id: user.id,
    p_item_id: vipId.id,
  });
  if (purchaseError) {
    const isRpcMissing =
      purchaseError.code === 'PGRST202' ||
      /schema cache|could not find the function|function .* does not exist/i.test(
        purchaseError.message
      );
    if (isRpcMissing) {
      const [
        { data: catalogItem, error: catalogError },
        { data: userRow, error: userError },
        state,
      ] = await Promise.all([
        supabase
          .from('sada_vip_ids_catalog')
          .select('id, number, price_coins, owner_id')
          .eq('id', vipId.id)
          .maybeSingle(),
        supabase.from('sada_users').select(USER_COLUMNS).eq('id', user.id).maybeSingle(),
        getPlatformState({ forceRefresh: true }),
      ]);
      if (catalogError) throw new Error(catalogError.message);
      if (userError) throw new Error(userError.message);
      if (!catalogItem || !userRow) throw new Error('الرقم أو الحساب غير موجود.');
      if (catalogItem.owner_id && catalogItem.owner_id !== user.id) {
        throw new Error('هذا الرقم مملوك بالفعل لمستخدم آخر.');
      }

      const freshUser = rowToUser(userRow);
      const price = Number(catalogItem.price_coins);
      const customVipIds = { ...(state.settings.customVipIds || {}) };
      const currentOwner = Object.entries(customVipIds).find(
        ([, number]) => number === catalogItem.number
      );
      if (currentOwner && currentOwner[0] !== user.id) {
        throw new Error('هذا الرقم مملوك بالفعل لمستخدم آخر.');
      }
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error('سعر الرقم المميز غير صالح.');
      }
      if (freshUser.coins < price) {
        throw new Error('رصيد الكوينز غير كافٍ لشراء هذا الرقم.');
      }

      const { data: updatedRow, error: balanceError } = await supabase
        .from('sada_users')
        .update({ coins: freshUser.coins - price })
        .eq('id', user.id)
        .eq('coins', freshUser.coins)
        .select(USER_COLUMNS)
        .maybeSingle();
      if (balanceError) throw new Error(balanceError.message);
      if (!updatedRow) throw new Error('تغيّر رصيدك أثناء الشراء. حدّث الصفحة وحاول مجدداً.');

      const previousVipIds = { ...customVipIds };
      customVipIds[user.id] = String(catalogItem.number);
      try {
        await savePlatformState({
          settings: {
            ...state.settings,
            customVipIds,
          },
        });
        await recordTransaction({
          userId: user.id,
          type: 'store_purchase',
          amount: -price,
          currency: 'coins',
          description: `شراء رقم ID مميز: ${catalogItem.number}`,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        const { error: refundError } = await supabase
          .from('sada_users')
          .update({ coins: freshUser.coins })
          .eq('id', user.id)
          .eq('coins', freshUser.coins - price);
        if (refundError) {
          console.error('Unable to refund coins after VIP ID purchase failure:', refundError);
        }
        try {
          const currentState = await getPlatformState({ forceRefresh: true });
          if (currentState.settings.customVipIds?.[user.id] === String(catalogItem.number)) {
            await savePlatformState({
              settings: {
                ...currentState.settings,
                customVipIds: previousVipIds,
              },
            });
          }
        } catch (rollbackError) {
          console.error('Unable to restore custom VIP IDs after purchase failure:', rollbackError);
        }
        throw error;
      }

      setCustomVipIdsCache(customVipIds);
      return { user: rowToUser(updatedRow), customVipIds };
    }
    if (purchaseError.message.includes('مملوك')) {
      throw new Error('هذا الرقم مملوك بالفعل لمستخدم آخر.');
    }
    if (purchaseError.message.includes('رصيد')) {
      throw new Error('رصيد الكوينز غير كافٍ لشراء هذا الرقم.');
    }
    throw new Error(purchaseError.message);
  }

  const [{ data: userRow, error: userError }, state] = await Promise.all([
    supabase.from('sada_users').select(USER_COLUMNS).eq('id', user.id).maybeSingle(),
    getPlatformState({ forceRefresh: true }),
  ]);
  if (userError) throw new Error(userError.message);
  if (!userRow) throw new Error('تم الشراء، لكن تعذّر تحديث بيانات الحساب. أعد فتح المتجر للمزامنة.');

  const customVipIds = state.settings.customVipIds || {};
  setCustomVipIdsCache(customVipIds);
  return { user: rowToUser(userRow), customVipIds };
}

export async function activateSvipMembershipInSupabase(
  user: User,
  level: 1 | 2 | 3 | 4
): Promise<User> {
  const { error: activationError } = await supabase.rpc('sada_activate_svip', {
    p_user_id: user.id,
    p_level: level,
  });
  if (activationError) {
    if (activationError.message.includes('رصيد')) {
      throw new Error('رصيد الكوينز غير كافٍ لتفعيل هذا المستوى.');
    }
    throw new Error(activationError.message);
  }

  const { data: updatedRow, error: userError } = await supabase
    .from('sada_users')
    .select(USER_COLUMNS)
    .eq('id', user.id)
    .maybeSingle();
  if (userError) throw new Error(userError.message);
  if (!updatedRow) throw new Error('تم التفعيل، لكن تعذّر تحديث بيانات الحساب. أعد فتح الصفحة للمزامنة.');
  return rowToUser(updatedRow);
}

export async function applyRoomBackgroundToMyRoomInSupabase(
  user: User,
  bgId: string
): Promise<{ updatedRoomsCount: number }> {
  const isPaidBg = STORE_LUXURY_BACKGROUNDS.some((b) => b.id === bgId);
  if (isPaidBg && !user.is_admin) {
    const state = await getPlatformState();
    const owned = state.settings.userOwnedBackgrounds?.[user.id] || [];
    if (!owned.includes(bgId)) {
      throw new Error('يجب شراء هذه الخلفية من المتجر (5,000 كوينز) قبل تطبيقها.');
    }
  }

  const { data: rooms } = await supabase
    .from('sada_rooms')
    .select('id')
    .eq('host_id', user.id)
    .eq('is_active', true);

  if (!rooms || rooms.length === 0) {
    throw new Error('لا توجد غرفة صوتية نشطة خاصة بك حالياً — افتح غرفتك ثم طبّق الخلفية.');
  }

  await supabase
    .from('sada_rooms')
    .update({ background_url: bgId })
    .eq('host_id', user.id)
    .eq('is_active', true);

  return { updatedRoomsCount: rooms.length };
}

function getUtcDateKey(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86400 * 1000).toISOString().slice(0, 10);
}

export async function getHostTasksOverviewFromSupabase(userId: string): Promise<{
  progress: HostTaskProgress;
  checkedInToday: boolean;
}> {
  const state = await getPlatformState();
  const today = getUtcDateKey(0);
  const yesterday = getUtcDateKey(-1);
  const raw = state.settings.userHostTasks?.[userId] || {
    streakDays: 0,
    lastCheckInDate: null,
    claimedDay7: false,
    claimedDay15: false,
  };

  // If user missed yesterday and hasn't checked in today, streak resets
  const streakActive =
    raw.lastCheckInDate === today || raw.lastCheckInDate === yesterday;
  const progress: HostTaskProgress = streakActive
    ? raw
    : {
        streakDays: 0,
        lastCheckInDate: raw.lastCheckInDate,
        claimedDay7: false,
        claimedDay15: false,
      };

  return {
    progress,
    checkedInToday: progress.lastCheckInDate === today,
  };
}

export async function checkInDailyHostTaskInSupabase(user: User): Promise<{
  progress: HostTaskProgress;
  checkedInToday: boolean;
}> {
  const state = await getPlatformState();
  const today = getUtcDateKey(0);
  const yesterday = getUtcDateKey(-1);
  const map = { ...(state.settings.userHostTasks || {}) };
  const raw = map[user.id] || {
    streakDays: 0,
    lastCheckInDate: null,
    claimedDay7: false,
    claimedDay15: false,
  };

  if (raw.lastCheckInDate === today) {
    throw new Error('تم تسجيل دخولك اليوم بالفعل! عد غداً لمواصلة السلسلة.');
  }

  const continued = raw.lastCheckInDate === yesterday;
  const nextStreak = continued ? Math.min(30, (raw.streakDays || 0) + 1) : 1;
  const nextProgress: HostTaskProgress = {
    streakDays: nextStreak,
    lastCheckInDate: today,
    claimedDay7: continued ? Boolean(raw.claimedDay7) : false,
    claimedDay15: continued ? Boolean(raw.claimedDay15) : false,
  };

  map[user.id] = nextProgress;
  await savePlatformState({
    settings: {
      ...state.settings,
      userHostTasks: map,
    },
  });

  return { progress: nextProgress, checkedInToday: true };
}

export async function claimHostTaskMilestoneInSupabase(
  user: User,
  milestone: 7 | 15
): Promise<{ user: User; progress: HostTaskProgress; rewardMessage: string }> {
  const [{ data: userRow }, state] = await Promise.all([
    supabase.from('sada_users').select(USER_COLUMNS).eq('id', user.id).maybeSingle(),
    getPlatformState(),
  ]);
  const freshUser = userRow ? rowToUser(userRow) : { ...user };
  const map = { ...(state.settings.userHostTasks || {}) };
  const raw = map[freshUser.id] || {
    streakDays: 0,
    lastCheckInDate: null,
    claimedDay7: false,
    claimedDay15: false,
  };

  if ((raw.streakDays || 0) < milestone) {
    throw new Error(`تحتاج إلى إتمام ${milestone} يوماً متتالياً لاستلام هذه الجائزة.`);
  }

  if (milestone === 7 && raw.claimedDay7) {
    throw new Error('تم استلام جائزة الـ 7 أيام في هذه السلسلة مسبقاً.');
  }
  if (milestone === 15 && raw.claimedDay15) {
    throw new Error('تم استلام جائزة الـ 15 يوماً في هذه السلسلة مسبقاً.');
  }

  const sevenDaysExp = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
  const patch: Record<string, unknown> = {};
  let rewardMessage = '';

  if (milestone === 7) {
    const giftFrameId = 'frame_host_gift_7d';
    if (!TEMP_ONLY_FRAME_IDS.has(freshUser.frameId)) {
      freshUser.previousPermanentFrameId = freshUser.frameId;
      patch.previous_permanent_frame_id = freshUser.frameId;
    }
    if (!freshUser.unlockedFrames.includes(giftFrameId)) {
      freshUser.unlockedFrames = [...freshUser.unlockedFrames, giftFrameId];
    }
    freshUser.frameId = giftFrameId;
    freshUser.tempFrameId = giftFrameId;
    freshUser.tempFrameExpiresAt = sevenDaysExp;
    patch.unlocked_frames = freshUser.unlockedFrames;
    patch.frame_id = giftFrameId;
    patch.temp_frame_id = giftFrameId;
    patch.temp_frame_expires_at = sevenDaysExp;
    raw.claimedDay7 = true;
    rewardMessage = 'مبارك! حصلت على إطار مهام المضيف المجاني لمدة 7 أيام وتم تفعيله!';
  } else {
    freshUser.activeEntryId = 'entry_car_15d';
    freshUser.activeEntryName = 'دخولية مهام المضيف الملكية';
    freshUser.tempEntryExpiresAt = sevenDaysExp;
    patch.active_entry_id = 'entry_car_15d';
    patch.active_entry_name = 'دخولية مهام المضيف الملكية';
    patch.temp_entry_expires_at = sevenDaysExp;
    raw.claimedDay15 = true;
    rewardMessage = 'تهانينا! حصلت على دخولية مهام المضيف الملكية لمدة 7 أيام!';
  }

  map[freshUser.id] = raw;

  await Promise.all([
    supabase.from('sada_users').update(patch).eq('id', freshUser.id),
    savePlatformState({
      settings: {
        ...state.settings,
        userHostTasks: map,
      },
    }),
  ]);
  await syncUserOnActiveRoomSeats(freshUser);

  return { user: freshUser, progress: raw, rewardMessage };
}

export async function equipStoreOrBagItemInSupabase(
  user: User,
  itemId: string
): Promise<User> {
  const coinItem = STORE_COIN_ITEMS.find((c) => c.id === itemId);
  if (coinItem) {
    return purchaseStoreCoinItemInSupabase(user, itemId);
  }

  const storeItem = STORE_3D_ITEMS.find((s) => s.id === itemId);
  if (storeItem) {
    const { data: userRow, error: userError } = await supabase
      .from('sada_users')
      .select(USER_COLUMNS)
      .eq('id', user.id)
      .maybeSingle();
    if (userError) throw new Error(userError.message);
    if (!userRow) throw new Error('تعذّر تحميل بيانات الحساب.');
    const freshUser = userRow ? rowToUser(userRow) : { ...user };
    const { totalRechargedCoins } = await computeUserCumulativeRechargeCoins(freshUser);

    if (storeItem.purchaseMode === 'gift') {
      if (!freshUser.unlockedFrames.includes(storeItem.id)) {
        throw new Error(
          `يُفتح "${storeItem.name}" مجاناً عند المواظبة 7 أيام متتالية في مهام المضيف.`
        );
      }
    } else if (
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

    const { error: updateError } = await supabase
      .from('sada_users')
      .update(patch)
      .eq('id', freshUser.id);
    if (updateError) throw new Error(updateError.message);
    await syncUserOnActiveRoomSeats(freshUser);
    return freshUser;
  }

  const updated = await purchaseOrEquipFrameInSupabase(user, itemId);
  await syncUserOnActiveRoomSeats(updated);
  return updated;
}
