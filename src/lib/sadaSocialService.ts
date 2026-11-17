import type {
  Agency,
  AgencyHostSummary,
  Competition,
  CulturalQuizResult,
  CulturalQuizRound,
  HostJoinApplication,
  PrivateConversation,
  PrivateConversationPeer,
  PrivateMessage,
  ReferralWheelResult,
  Transaction,
  User,
} from '../types';
import {
  computeGiftLevelStats,
  computeLevelFromXp,
  CULTURAL_QUESTIONS,
  formatShortNumericId,
  genId,
  GIFT_CATALOG,
  isFemaleVoiceLocked,
  makeConversationId,
  REFERRAL_WHEEL_SEGMENTS,
  rollLuckyGiftMultiplier,
} from './sadaCatalog';
import {
  applyHostEarningsAndAgencyCommission,
  getPlatformState,
  recordTransaction,
  rowToAgency,
  rowToCompetition,
  rowToPrivateMessage,
  rowToQuestion,
  rowToTransaction,
  rowToUser,
  savePlatformState,
} from './sadaMappers';
import { supabase } from './supabase';

// ======================== COMPETITIONS & CULTURAL QUIZ ========================

export async function getCompetitionsFromSupabase(): Promise<Competition[]> {
  const { data } = await supabase.from('sada_competitions').select('*');
  return (data || []).map(rowToCompetition);
}

export async function joinCompetitionInSupabase(
  user: User,
  compId: string,
  performanceTitle: string
): Promise<Competition> {
  if (!performanceTitle || performanceTitle.trim().length < 3) {
    throw new Error('يرجى كتابة عنوان الفقرة الصوتية أو المشاركة.');
  }
  const { data: compRow } = await supabase
    .from('sada_competitions')
    .select('*')
    .eq('id', compId)
    .maybeSingle();
  if (!compRow) throw new Error('المسابقة غير موجودة.');
  const comp = rowToCompetition(compRow);
  if (comp.status === 'ended') throw new Error('انتهت هذه المسابقة بالفعل.');
  if (comp.contestants.some((c) => c.userId === user.id)) {
    throw new Error('أنت مسجل بالفعل في هذه المسابقة.');
  }

  const nextContestants = [
    ...comp.contestants,
    {
      id: genId('cont'),
      userId: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      level: user.level,
      performanceTitle: performanceTitle.trim().slice(0, 60),
      votes: 1,
      giftScore: 0,
    },
  ];
  await supabase
    .from('sada_competitions')
    .update({ contestants: nextContestants })
    .eq('id', comp.id);
  return { ...comp, contestants: nextContestants };
}

export async function voteCompetitionInSupabase(
  user: User,
  compId: string,
  contestantId: string,
  boost: boolean
): Promise<{ competition: Competition; user: User }> {
  const [{ data: compRow }, { data: userRow }, state] = await Promise.all([
    supabase.from('sada_competitions').select('*').eq('id', compId).maybeSingle(),
    supabase.from('sada_users').select('*').eq('id', user.id).maybeSingle(),
    getPlatformState(),
  ]);

  if (!compRow) throw new Error('المسابقة غير موجودة.');
  const comp = rowToCompetition(compRow);
  if (comp.status === 'ended') throw new Error('المسابقة منتهية.');

  const freshUser = userRow ? rowToUser(userRow) : { ...user };
  const contestant = comp.contestants.find((c) => c.id === contestantId);
  if (!contestant) throw new Error('المتسابق غير موجود.');

  const now = new Date().toISOString();
  const nextVoted = { ...state.votedKeys };

  if (boost) {
    const cost = 100;
    if (freshUser.coins < cost) {
      throw new Error('تحتاج إلى 100 كوينز للتصويت الملكي المضاعف (+10 أصوات).');
    }
    freshUser.coins -= cost;
    freshUser.xp += 40;
    freshUser.level = computeLevelFromXp(freshUser.xp);
    contestant.votes += 10;
    contestant.giftScore += cost;

    await recordTransaction({
      userId: freshUser.id,
      type: 'vote',
      amount: -cost,
      currency: 'coins',
      description: `دعم ملكي (+10 أصوات) للمتسابق ${contestant.displayName}`,
      timestamp: now,
    });
  } else {
    const voteKey = `${comp.id}_${freshUser.id}`;
    if (nextVoted[voteKey]) {
      throw new Error(
        'استخدمت صوتك المجاني في هذه المسابقة. يمكنك استخدام التصويت الملكي بالكوينز!'
      );
    }
    nextVoted[voteKey] = true;
    contestant.votes += 1;
    freshUser.xp += 15;
    freshUser.level = computeLevelFromXp(freshUser.xp);
    await savePlatformState({ votedKeys: nextVoted });
  }

  await Promise.all([
    supabase
      .from('sada_competitions')
      .update({ contestants: comp.contestants })
      .eq('id', comp.id),
    supabase
      .from('sada_users')
      .update({ coins: freshUser.coins, xp: freshUser.xp, level: freshUser.level })
      .eq('id', freshUser.id),
  ]);

  return { competition: comp, user: freshUser };
}

export async function startCulturalQuizInSupabase(
  user: User
): Promise<CulturalQuizRound> {
  const [{ data: qRows }, state] = await Promise.all([
    supabase.from('sada_cultural_questions').select('*'),
    getPlatformState(),
  ]);

  const bank =
    qRows && qRows.length > 0 ? qRows.map(rowToQuestion) : CULTURAL_QUESTIONS;
  const q = bank[Math.floor(Math.random() * bank.length)];
  const roundId = genId('quiz');
  const expiresAt = Date.now() + 8000;

  const nextSessions = { ...state.quizSessions };
  nextSessions[roundId] = {
    roundId,
    userId: user.id,
    questionId: q.id,
    correctIndex: q.correctIndex,
    xpReward: q.xpReward,
    coinsReward: q.coinsReward,
    expiresAt,
    answered: false,
  };

  const keys = Object.keys(nextSessions);
  if (keys.length > 150) {
    for (const oldKey of keys.slice(0, keys.length - 80)) {
      delete nextSessions[oldKey];
    }
  }

  await savePlatformState({ quizSessions: nextSessions });

  return {
    roundId,
    category: q.category,
    question: q.question,
    options: q.options,
    xpReward: q.xpReward,
    coinsReward: q.coinsReward,
    timeLimitSeconds: 8,
    expiresAt,
  };
}

export async function answerCulturalQuizInSupabase(
  user: User,
  roundId: string,
  selectedIndex?: number
): Promise<CulturalQuizResult> {
  const [state, { data: userRow }] = await Promise.all([
    getPlatformState(),
    supabase.from('sada_users').select('*').eq('id', user.id).maybeSingle(),
  ]);

  const freshUser = userRow ? rowToUser(userRow) : { ...user };
  const session = state.quizSessions[roundId];
  if (!session || session.userId !== freshUser.id) {
    throw new Error('جولة المسابقة غير موجودة.');
  }
  if (session.answered) {
    throw new Error('تمت الإجابة على هذا السؤال مسبقاً.');
  }

  session.answered = true;
  await savePlatformState({ quizSessions: state.quizSessions });

  const timedOut =
    Date.now() > session.expiresAt + 400 || typeof selectedIndex !== 'number';
  if (timedOut) {
    return {
      isCorrect: false,
      timedOut: true,
      correctIndex: session.correctIndex,
      xpGained: 0,
      coinsGained: 0,
      user: freshUser,
    };
  }

  const isCorrect = selectedIndex === session.correctIndex;
  const xpGained = isCorrect ? session.xpReward : 20;
  const coinsGained = isCorrect ? session.coinsReward : 0;

  freshUser.xp += xpGained;
  freshUser.level = computeLevelFromXp(freshUser.xp);
  if (coinsGained > 0) {
    freshUser.coins += coinsGained;
    await recordTransaction({
      userId: freshUser.id,
      type: 'quiz_reward',
      amount: coinsGained,
      currency: 'coins',
      description: `جائزة بطولة ثقافية حية (+${xpGained} XP)`,
      timestamp: new Date().toISOString(),
    });
  }

  await supabase
    .from('sada_users')
    .update({ coins: freshUser.coins, xp: freshUser.xp, level: freshUser.level })
    .eq('id', freshUser.id);

  return {
    isCorrect,
    timedOut: false,
    correctIndex: session.correctIndex,
    xpGained,
    coinsGained,
    user: freshUser,
  };
}

export async function getReferralWheelOverviewFromSupabase(user: User) {
  const [{ data: userRow }, state] = await Promise.all([
    supabase.from('sada_users').select('*').eq('id', user.id).maybeSingle(),
    getPlatformState(),
  ]);
  const freshUser = userRow ? rowToUser(userRow) : { ...user };

  if (!freshUser.referralCode) {
    freshUser.referralCode = `REF-${freshUser.id.slice(0, 6).toUpperCase()}`;
    await supabase
      .from('sada_users')
      .update({ referral_code: freshUser.referralCode })
      .eq('id', freshUser.id);
  }

  return {
    referralCode: freshUser.referralCode,
    referralCount: freshUser.referralCount || 0,
    referralSpins: freshUser.referralSpins || 0,
    appPrizePoolCoins: state.appPrizePoolCoins,
    segments: REFERRAL_WHEEL_SEGMENTS,
  };
}

export async function spinReferralWheelInSupabase(
  user: User
): Promise<ReferralWheelResult> {
  const [{ data: userRow }, state] = await Promise.all([
    supabase.from('sada_users').select('*').eq('id', user.id).maybeSingle(),
    getPlatformState(),
  ]);
  const freshUser = userRow ? rowToUser(userRow) : { ...user };

  if ((freshUser.referralSpins || 0) < 1) {
    throw new Error(
      'لا تملك لفات مجانية حالياً. ادعُ صديقاً بكود الدعوة الخاص بك للحصول على لفة مجانية!'
    );
  }

  const eligible = REFERRAL_WHEEL_SEGMENTS.filter(
    (s) => s.coinsAmount <= state.appPrizePoolCoins
  );
  const pool = eligible.length > 0 ? eligible : [REFERRAL_WHEEL_SEGMENTS[0]];
  const totalWeight = pool.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosen = pool[0];
  for (const seg of pool) {
    roll -= seg.weight;
    if (roll <= 0) {
      chosen = seg;
      break;
    }
  }

  const segmentIndex = REFERRAL_WHEEL_SEGMENTS.findIndex((s) => s.id === chosen.id);
  freshUser.referralSpins = Math.max(0, (freshUser.referralSpins || 0) - 1);

  let nextPool = state.appPrizePoolCoins;
  if (chosen.coinsAmount > 0) {
    nextPool = Math.max(0, state.appPrizePoolCoins - chosen.coinsAmount);
    freshUser.coins += chosen.coinsAmount;
    freshUser.xp += Math.min(500, Math.round(chosen.coinsAmount / 20));
    freshUser.level = computeLevelFromXp(freshUser.xp);

    await recordTransaction({
      userId: freshUser.id,
      type: 'referral_wheel',
      amount: chosen.coinsAmount,
      currency: 'coins',
      description: `جائزة دولاب حظ الدعوات: ${chosen.label}`,
      timestamp: new Date().toISOString(),
    });
  }

  await Promise.all([
    savePlatformState({ appPrizePoolCoins: nextPool }),
    supabase
      .from('sada_users')
      .update({
        referral_spins: freshUser.referralSpins,
        coins: freshUser.coins,
        xp: freshUser.xp,
        level: freshUser.level,
      })
      .eq('id', freshUser.id),
  ]);

  return {
    segmentIndex,
    segment: chosen,
    user: freshUser,
    appPrizePoolCoins: nextPool,
  };
}

// ======================== FOLLOW & DISCOVERY SYSTEM ========================

export interface FollowRelationStatus {
  iFollowThem: boolean;
  theyFollowMe: boolean;
  isMutual: boolean;
}

export function getFollowStatus(
  userFollows: Record<string, string[]> | undefined,
  userA: string,
  userB: string
): FollowRelationStatus {
  const map = userFollows || {};
  const listA = Array.isArray(map[userA]) ? map[userA] : [];
  const listB = Array.isArray(map[userB]) ? map[userB] : [];
  const iFollowThem = listA.includes(userB);
  const theyFollowMe = listB.includes(userA);
  return {
    iFollowThem,
    theyFollowMe,
    isMutual: iFollowThem && theyFollowMe,
  };
}

export async function toggleFollowUserInSupabase(
  currentUserId: string,
  targetUserId: string
): Promise<FollowRelationStatus & { userFollows: Record<string, string[]> }> {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    throw new Error('لا يمكن متابعة هذا الحساب.');
  }
  const state = await getPlatformState();
  const currentFollows = { ...(state.settings.userFollows || {}) };
  const myList = Array.isArray(currentFollows[currentUserId])
    ? [...currentFollows[currentUserId]]
    : [];

  const idx = myList.indexOf(targetUserId);
  if (idx >= 0) {
    myList.splice(idx, 1);
  } else {
    myList.push(targetUserId);
  }

  currentFollows[currentUserId] = myList;
  await savePlatformState({
    settings: {
      ...state.settings,
      userFollows: currentFollows,
    },
  });

  const relation = getFollowStatus(currentFollows, currentUserId, targetUserId);
  return { ...relation, userFollows: currentFollows };
}

export async function recordProfileVisitInSupabase(
  targetUserId: string,
  visitorUserId: string
): Promise<void> {
  if (!targetUserId || !visitorUserId || targetUserId === visitorUserId) return;
  const state = await getPlatformState();
  const currentVisitors = { ...(state.settings.userVisitors || {}) };
  const list = Array.isArray(currentVisitors[targetUserId])
    ? [...currentVisitors[targetUserId]]
    : [];
  if (list.includes(visitorUserId)) return;
  list.push(visitorUserId);
  currentVisitors[targetUserId] = list;
  await savePlatformState({
    settings: {
      ...state.settings,
      userVisitors: currentVisitors,
    },
  });
}

export async function toggleFollowAgencyInSupabase(
  userId: string,
  roomId: string
): Promise<{ following: boolean; followedAgencyRoomIds: string[] }> {
  if (!userId || !roomId) {
    throw new Error('بيانات الوكالة غير مكتملة.');
  }
  const state = await getPlatformState();
  const map = { ...(state.settings.userFollowedAgencies || {}) };
  const list = Array.isArray(map[userId]) ? [...map[userId]] : [];
  const idx = list.indexOf(roomId);
  let following = false;
  if (idx >= 0) {
    list.splice(idx, 1);
    following = false;
  } else {
    list.push(roomId);
    following = true;
  }
  map[userId] = list;
  await savePlatformState({
    settings: {
      ...state.settings,
      userFollowedAgencies: map,
    },
  });
  return { following, followedAgencyRoomIds: list };
}

export async function getProfileSocialListFromSupabase(
  userId: string,
  kind: 'friends' | 'followers' | 'following' | 'visitors'
): Promise<User[]> {
  const state = await getPlatformState();
  const userFollows = state.settings.userFollows || {};
  const userVisitors = state.settings.userVisitors || {};
  const userMeta = state.settings.userMeta || {};

  let targetIds: string[] = [];
  const myFollowing = Array.isArray(userFollows[userId])
    ? userFollows[userId].filter((id) => id !== userId)
    : [];

  if (kind === 'following') {
    targetIds = myFollowing;
  } else if (kind === 'followers') {
    for (const [uid, list] of Object.entries(userFollows)) {
      if (uid !== userId && Array.isArray(list) && list.includes(userId)) {
        targetIds.push(uid);
      }
    }
  } else if (kind === 'friends') {
    targetIds = myFollowing.filter(
      (fid) => Array.isArray(userFollows[fid]) && userFollows[fid].includes(userId)
    );
  } else if (kind === 'visitors') {
    targetIds = Array.isArray(userVisitors[userId])
      ? [...userVisitors[userId]].filter((id) => id !== userId).reverse()
      : [];
  }

  const uniqueIds = Array.from(new Set(targetIds));
  if (uniqueIds.length === 0) return [];

  const { data: rows } = await supabase
    .from('sada_users')
    .select('*')
    .in('id', uniqueIds);

  const map = new Map(
    (rows || []).map((r) => {
      const u = rowToUser(r);
      const meta = userMeta[u.id];
      if (meta) {
        u.age = meta.age;
        u.country = meta.country;
      }
      return [u.id, u];
    })
  );

  return uniqueIds
    .map((id) => map.get(id))
    .filter((u): u is User => Boolean(u));
}

export async function getUserGiftLevelsFromSupabase(userId: string) {
  const [state, { data: txRows }] = await Promise.all([
    getPlatformState(),
    supabase
      .from('sada_transactions')
      .select('type, amount, currency')
      .eq('user_id', userId)
      .in('type', ['gift_sent', 'gift_received']),
  ]);

  const ratio = state.settings.giftDiamondsRatio || 0.75;
  let txSentCoins = 0;
  let txReceivedCoins = 0;
  for (const t of txRows || []) {
    if (t.type === 'gift_sent' && t.currency === 'coins') {
      txSentCoins += Math.abs(Number(t.amount || 0));
    } else if (t.type === 'gift_received' && t.currency === 'diamonds') {
      txReceivedCoins += Math.round(Math.max(0, Number(t.amount || 0)) / ratio);
    }
  }

  const storedStats = state.settings.userGiftStats?.[userId] || {
    sentCoins: 0,
    receivedCoins: 0,
  };

  return computeGiftLevelStats(
    Math.max(storedStats.sentCoins || 0, txSentCoins),
    Math.max(storedStats.receivedCoins || 0, txReceivedCoins)
  );
}

export async function getDiscoveryDirectoryFromSupabase(currentUserId: string): Promise<{
  users: User[];
  userFollows: Record<string, string[]>;
  userMeta: Record<string, { age?: number; country?: string }>;
  seatedUserIds: string[];
}> {
  const [{ data: usersRows }, { data: activeRooms }, state] = await Promise.all([
    supabase
      .from('sada_users')
      .select('*')
      .eq('is_banned', false)
      .order('last_seen', { ascending: false }),
    supabase.from('sada_rooms').select('seats').eq('is_active', true),
    getPlatformState(),
  ]);

  const userMeta = state.settings.userMeta || {};
  const seatedSet = new Set<string>();
  for (const r of activeRooms || []) {
    const seats = Array.isArray(r.seats) ? (r.seats as Array<{ userId?: string | null }>) : [];
    for (const s of seats) {
      if (s?.userId) seatedSet.add(String(s.userId));
    }
  }

  const users = (usersRows || [])
    .map(rowToUser)
    .filter((u) => u.id !== currentUserId)
    .map((u) => {
      const meta = userMeta[u.id];
      return {
        ...u,
        age: meta?.age,
        country: meta?.country,
      };
    });

  return {
    users,
    userFollows: state.settings.userFollows || {},
    userMeta,
    seatedUserIds: Array.from(seatedSet),
  };
}

// ======================== PRIVATE MESSAGES & DIAMONDS ========================

function isUserFemaleOrHost(u: User, hostedUserIds: Set<string>): boolean {
  if (isFemaleVoiceLocked(u)) return false;
  if (u.gender === 'female' || Boolean(u.isHost)) return true;
  return hostedUserIds.has(u.id);
}

export async function getPmOverviewFromSupabase(user: User) {
  const [{ data: allUsers }, { data: myMsgs }, { data: rooms }, state] =
    await Promise.all([
      supabase.from('sada_users').select('*'),
      supabase
        .from('sada_private_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: true }),
      supabase.from('sada_rooms').select('host_id'),
      getPlatformState(),
    ]);

  const hostedUserIds = new Set((rooms || []).map((r) => String(r.host_id)));
  const userMeta = state.settings.userMeta || {};
  const userFollows = state.settings.userFollows || {};

  const usersList = (allUsers || []).map(rowToUser).map((u) => ({
    ...u,
    age: userMeta[u.id]?.age,
    country: userMeta[u.id]?.country,
  }));
  const usersMap = new Map(usersList.map((u) => [u.id, u]));

  const convMap = new Map<string, PrivateMessage[]>();
  for (const row of myMsgs || []) {
    const pm = rowToPrivateMessage(row);
    const list = convMap.get(pm.conversationId) || [];
    list.push(pm);
    convMap.set(pm.conversationId, list);
  }

  const conversations: PrivateConversation[] = Array.from(convMap.entries())
    .map(([convId, msgs]) => {
      const sample = msgs[0];
      const peerId = sample.senderId === user.id ? sample.recipientId : sample.senderId;
      const peerUser = usersMap.get(peerId);
      if (!peerUser) return null;
      const pendingDiamondsForMe = msgs
        .filter((m) => m.recipientId === user.id && !m.diamondsClaimed && m.diamondsPotential > 0)
        .reduce((sum, m) => sum + m.diamondsPotential, 0);
      return {
        id: convId,
        peer: {
          id: peerUser.id,
          displayName: peerUser.displayName,
          avatarUrl: peerUser.avatarUrl,
          frameId: peerUser.frameId,
          level: peerUser.level,
          gender: peerUser.gender || 'male',
          age: peerUser.age,
          country: peerUser.country,
          femaleVerified: Boolean(peerUser.femaleVerified),
          femaleVerifiedBadge: peerUser.femaleVerifiedBadge || null,
          isHost: isUserFemaleOrHost(peerUser, hostedUserIds),
          is_admin: peerUser.is_admin,
          bio: peerUser.bio,
          lastSeen: peerUser.lastSeen,
        },
        messages: msgs,
        pendingDiamondsForMe,
        lastMessage: msgs[msgs.length - 1] || null,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => {
      const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return tb - ta;
    });

  const oppositeGender = (user.gender || 'male') === 'male' ? 'female' : 'male';
  const recipients: PrivateConversationPeer[] = usersList
    .filter((u) => u.id !== user.id && !u.is_banned)
    .sort((a, b) => {
      const aOpp = (a.gender || 'male') === oppositeGender ? 1 : 0;
      const bOpp = (b.gender || 'male') === oppositeGender ? 1 : 0;
      if (aOpp !== bOpp) return bOpp - aOpp;
      return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    })
    .map((u) => ({
      id: u.id,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      frameId: u.frameId,
      level: u.level,
      gender: u.gender || 'male',
      age: u.age,
      country: u.country,
      femaleVerified: Boolean(u.femaleVerified),
      femaleVerifiedBadge: u.femaleVerifiedBadge || null,
      isHost: isUserFemaleOrHost(u, hostedUserIds),
      is_admin: u.is_admin,
      bio: u.bio,
      lastSeen: u.lastSeen,
    }));

  const pendingDiamondsTotal = conversations.reduce(
    (sum, c) => sum + c.pendingDiamondsForMe,
    0
  );

  return {
    conversations,
    recipients,
    userFollows,
    gifts: GIFT_CATALOG,
    pmMessageCost: state.settings.pmMessageCost,
    pmReplyDiamonds: state.settings.pmReplyDiamonds,
    pendingDiamondsTotal,
    canReceivePaidPm: isUserFemaleOrHost(user, hostedUserIds),
  };
}

export async function sendPrivateMessageInSupabase(
  sender: User,
  payload: { recipientId: string; text?: string; giftId?: string }
): Promise<{
  user: User;
  message: PrivateMessage;
  unlockedReplyDiamonds: number;
  giftDiamondsAwarded: number;
  immediatePmDiamondsAwarded: number;
  isMutualFollow: boolean;
  luckyMultiplier: number | null;
  luckyBonusCoins: number;
}> {
  const [{ data: senderRow }, { data: recRow }, { data: rooms }, state] =
    await Promise.all([
      supabase.from('sada_users').select('*').eq('id', sender.id).maybeSingle(),
      supabase.from('sada_users').select('*').eq('id', payload.recipientId).maybeSingle(),
      supabase.from('sada_rooms').select('host_id'),
      getPlatformState(),
    ]);

  const freshSender = senderRow ? rowToUser(senderRow) : { ...sender };
  if (!recRow || payload.recipientId === freshSender.id) {
    throw new Error('المستلم غير موجود.');
  }
  const recipient = rowToUser(recRow);

  const followStatus = getFollowStatus(
    state.settings.userFollows || {},
    freshSender.id,
    recipient.id
  );
  const isMutualFollow = followStatus.isMutual;

  if (isFemaleVoiceLocked(recipient) && (payload.giftId || !isMutualFollow)) {
    throw new Error(
      'حساب هذه العضوة بانتظار التوثيق الصوتي من الإدارة — استقبال الألماس والرسائل المدفوعة مقفل مؤقتاً (يمكنكما المراسلة مجاناً بعد المتابعة المتبادلة).'
    );
  }

  const cleanText = (payload.text || '').trim().slice(0, 400);
  if (!cleanText && !payload.giftId) {
    throw new Error('يرجى كتابة رسالة أو اختيار هدية لإرسالها.');
  }

  const hostedIds = new Set((rooms || []).map((r) => String(r.host_id)));
  const convId = makeConversationId(freshSender.id, recipient.id);
  const now = new Date().toISOString();
  const senderEligibleForDiamonds =
    !isFemaleVoiceLocked(freshSender) && isUserFemaleOrHost(freshSender, hostedIds);

  const { data: convMsgsRaw } = await supabase
    .from('sada_private_messages')
    .select('*')
    .eq('conversation_id', convId);

  const convMsgs = (convMsgsRaw || []).map(rowToPrivateMessage);
  const unclaimedIncoming = convMsgs.filter(
    (m) =>
      m.senderId === recipient.id &&
      m.recipientId === freshSender.id &&
      !m.diamondsClaimed &&
      m.diamondsPotential > 0
  );

  let unlockedReplyDiamonds = 0;
  if (senderEligibleForDiamonds && unclaimedIncoming.length > 0 && !payload.giftId) {
    for (const inc of unclaimedIncoming) {
      unlockedReplyDiamonds += inc.diamondsPotential;
      await supabase
        .from('sada_private_messages')
        .update({
          diamonds_claimed: true,
          diamonds_awarded: inc.diamondsPotential,
          replied_at: now,
        })
        .eq('id', inc.id);
    }
    freshSender.diamonds += unlockedReplyDiamonds;
    freshSender.xp += Math.round(unlockedReplyDiamonds * 0.4);
    freshSender.level = computeLevelFromXp(freshSender.xp);

    await recordTransaction({
      userId: freshSender.id,
      type: 'pm_reply_diamond',
      amount: unlockedReplyDiamonds,
      currency: 'diamonds',
      description: `مكافأة ألماس تلقائية للرد على رسالة خاصة من ${recipient.displayName}`,
      timestamp: now,
    });
    await applyHostEarningsAndAgencyCommission(freshSender, unlockedReplyDiamonds, now);
  }

  const selectedGift = payload.giftId
    ? GIFT_CATALOG.find((g) => g.id === payload.giftId)
    : undefined;
  if (payload.giftId && !selectedGift) {
    throw new Error('الهدية المختارة غير متوفرة.');
  }

  if (selectedGift) {
    if (freshSender.coins < selectedGift.coinsCost) {
      throw new Error('رصيد الكوينز غير كافٍ لإرسال هذه الهدية الخاصة.');
    }
    freshSender.coins -= selectedGift.coinsCost;
    freshSender.xp += selectedGift.xpGain;
    freshSender.level = computeLevelFromXp(freshSender.xp);

    let luckyMultiplier: number | null = null;
    let luckyBonusCoins = 0;
    if (selectedGift.category === 'lucky') {
      luckyMultiplier = rollLuckyGiftMultiplier(state.settings.luckyGiftMultipliers);
      luckyBonusCoins = Math.round(selectedGift.coinsCost * luckyMultiplier);
      freshSender.coins += luckyBonusCoins;
    }

    const giftDiamondsAwarded = Math.max(
      1,
      Math.round(selectedGift.coinsCost * (state.settings.giftDiamondsRatio || 0.75))
    );
    recipient.diamonds += giftDiamondsAwarded;

    const pmGift: PrivateMessage = {
      id: genId('pm'),
      conversationId: convId,
      senderId: freshSender.id,
      recipientId: recipient.id,
      text:
        cleanText ||
        `أرسل لك ${selectedGift.glyph} ${selectedGift.name}${
          luckyMultiplier ? ` (مضاعف حظ ×${luckyMultiplier})` : ''
        }`,
      coinsPaid: selectedGift.coinsCost,
      diamondsPotential: giftDiamondsAwarded,
      diamondsClaimed: true,
      diamondsAwarded: giftDiamondsAwarded,
      giftId: selectedGift.id,
      giftName: selectedGift.name,
      giftGlyph: selectedGift.glyph,
      createdAt: now,
      repliedAt: now,
    };

    await Promise.all([
      supabase
        .from('sada_users')
        .update({
          coins: freshSender.coins,
          diamonds: freshSender.diamonds,
          xp: freshSender.xp,
          level: freshSender.level,
        })
        .eq('id', freshSender.id),
      supabase
        .from('sada_users')
        .update({ diamonds: recipient.diamonds })
        .eq('id', recipient.id),
      supabase.from('sada_private_messages').insert({
        id: pmGift.id,
        conversation_id: pmGift.conversationId,
        sender_id: pmGift.senderId,
        recipient_id: pmGift.recipientId,
        text: pmGift.text,
        coins_paid: pmGift.coinsPaid,
        diamonds_potential: pmGift.diamondsPotential,
        diamonds_claimed: true,
        diamonds_awarded: pmGift.diamondsAwarded,
        gift_id: pmGift.giftId || null,
        gift_name: pmGift.giftName || null,
        gift_glyph: pmGift.giftGlyph || null,
        created_at: now,
        replied_at: now,
      }),
      recordTransaction({
        userId: freshSender.id,
        type: 'gift_sent',
        amount: -selectedGift.coinsCost,
        currency: 'coins',
        description: `هدية خاصة (${selectedGift.name}) إلى ${recipient.displayName}`,
        timestamp: now,
      }),
      recordTransaction({
        userId: recipient.id,
        type: 'gift_received',
        amount: giftDiamondsAwarded,
        currency: 'diamonds',
        description: `استلام هدية خاصة (${selectedGift.name}) من ${freshSender.displayName}`,
        timestamp: now,
      }),
    ]);

    if (luckyBonusCoins > 0 && luckyMultiplier) {
      await recordTransaction({
        userId: freshSender.id,
        type: 'lucky_gift_bonus',
        amount: luckyBonusCoins,
        currency: 'coins',
        description: `مضاعف هدية الحظ الخاصة (${selectedGift.name} ×${luckyMultiplier})`,
        timestamp: now,
      });
    }

    await applyHostEarningsAndAgencyCommission(recipient, giftDiamondsAwarded, now);

    // Record dual send/receive gift coin totals
    const nextStats = { ...(state.settings.userGiftStats || {}) };
    const sCur = nextStats[freshSender.id] || { sentCoins: 0, receivedCoins: 0 };
    nextStats[freshSender.id] = {
      sentCoins: (sCur.sentCoins || 0) + selectedGift.coinsCost,
      receivedCoins: sCur.receivedCoins || 0,
    };
    const rCur = nextStats[recipient.id] || { sentCoins: 0, receivedCoins: 0 };
    nextStats[recipient.id] = {
      sentCoins: rCur.sentCoins || 0,
      receivedCoins: (rCur.receivedCoins || 0) + selectedGift.coinsCost,
    };
    await savePlatformState({
      settings: {
        ...state.settings,
        userGiftStats: nextStats,
      },
    });

    return {
      user: freshSender,
      message: pmGift,
      unlockedReplyDiamonds,
      giftDiamondsAwarded,
      immediatePmDiamondsAwarded: 0,
      isMutualFollow,
      luckyMultiplier,
      luckyBonusCoins,
    };
  }

  // Mutual follow => completely FREE (0 coins); Before mutual follow => paid coins!
  const pmCost = Math.max(0, Number(state.settings.pmMessageCost ?? 50));
  const shouldChargeCoins = !isMutualFollow && pmCost > 0;

  if (shouldChargeCoins && freshSender.coins < pmCost) {
    throw new Error(
      `تحتاج إلى ${pmCost} كوينز لإرسال رسالة خاصة (أو متابعة الطرفين لبعضهما للمراسلة مجاناً).`
    );
  }

  const ratio = state.settings.giftDiamondsRatio || 0.75;
  const immediatePmDiamondsAwarded = shouldChargeCoins
    ? Math.max(1, Math.round(pmCost * ratio))
    : 0;

  if (shouldChargeCoins) {
    freshSender.coins -= pmCost;
    freshSender.xp += 35;
    freshSender.level = computeLevelFromXp(freshSender.xp);
    recipient.diamonds += immediatePmDiamondsAwarded;

    await Promise.all([
      recordTransaction({
        userId: freshSender.id,
        type: 'pm_sent',
        amount: -pmCost,
        currency: 'coins',
        description: `رسالة خاصة مدفوعة إلى ${recipient.displayName}`,
        timestamp: now,
      }),
      recordTransaction({
        userId: recipient.id,
        type: 'pm_reply_diamond',
        amount: immediatePmDiamondsAwarded,
        currency: 'diamonds',
        description: `أرباح رسالة خاصة من ${freshSender.displayName}`,
        timestamp: now,
      }),
      supabase
        .from('sada_users')
        .update({ diamonds: recipient.diamonds })
        .eq('id', recipient.id),
    ]);

    await applyHostEarningsAndAgencyCommission(
      recipient,
      immediatePmDiamondsAwarded,
      now
    );
  }

  const pm: PrivateMessage = {
    id: genId('pm'),
    conversationId: convId,
    senderId: freshSender.id,
    recipientId: recipient.id,
    text: cleanText,
    coinsPaid: shouldChargeCoins ? pmCost : 0,
    diamondsPotential: immediatePmDiamondsAwarded,
    diamondsClaimed: true,
    diamondsAwarded: immediatePmDiamondsAwarded,
    createdAt: now,
    repliedAt: shouldChargeCoins ? now : null,
  };

  await Promise.all([
    supabase
      .from('sada_users')
      .update({
        coins: freshSender.coins,
        diamonds: freshSender.diamonds,
        xp: freshSender.xp,
        level: freshSender.level,
      })
      .eq('id', freshSender.id),
    supabase.from('sada_private_messages').insert({
      id: pm.id,
      conversation_id: pm.conversationId,
      sender_id: pm.senderId,
      recipient_id: pm.recipientId,
      text: pm.text,
      coins_paid: pm.coinsPaid,
      diamonds_potential: pm.diamondsPotential,
      diamonds_claimed: pm.diamondsClaimed,
      diamonds_awarded: pm.diamondsAwarded,
      created_at: now,
      replied_at: pm.repliedAt,
    }),
  ]);

  return {
    user: freshSender,
    message: pm,
    unlockedReplyDiamonds,
    giftDiamondsAwarded: 0,
    immediatePmDiamondsAwarded,
    isMutualFollow,
    luckyMultiplier: null,
    luckyBonusCoins: 0,
  };
}

// ======================== AGENCY & HOST SYSTEM ========================

export async function getAgencyOverviewFromSupabase(user: User): Promise<{
  user: User;
  myAgency: {
    agency: Agency;
    hosts: AgencyHostSummary[];
    weeklyAgencyTotalDiamonds: number;
    pendingApplications: HostJoinApplication[];
    commissionTransactions: Transaction[];
  } | null;
  joinedAgency: Agency | null;
  myApplications: HostJoinApplication[];
  publicAgencies: Array<{
    id: string;
    name: string;
    description: string;
    code: string;
    numericId: string;
    ownerName: string;
    ownerAvatar: string;
    commissionRate: number;
    totalHostDiamonds?: number;
    hostCount: number;
  }>;
}> {
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: userRow },
    { data: agencyRows },
    { data: allUsers },
    { data: txRows },
    { data: weeklyTxRows },
    state,
  ] = await Promise.all([
    supabase.from('sada_users').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('sada_agencies').select('*'),
    supabase.from('sada_users').select('*'),
    supabase
      .from('sada_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'agency_commission')
      .order('timestamp', { ascending: false })
      .limit(25),
    supabase
      .from('sada_transactions')
      .select('user_id, amount, currency, type, timestamp')
      .eq('currency', 'diamonds')
      .in('type', ['gift_received', 'pm_reply_diamond'])
      .gte('timestamp', sevenDaysAgoIso),
    getPlatformState(),
  ]);

  const freshUser = userRow ? rowToUser(userRow) : { ...user };
  const agencies = (agencyRows || []).map(rowToAgency);
  const users = (allUsers || []).map(rowToUser);

  const weeklyDiamondsByUser = new Map<string, number>();
  for (const row of weeklyTxRows || []) {
    const uid = String(row.user_id);
    const amt = Math.max(0, Number(row.amount || 0));
    weeklyDiamondsByUser.set(uid, (weeklyDiamondsByUser.get(uid) || 0) + amt);
  }

  const myOwnedAgency = agencies.find((a) => a.ownerId === freshUser.id) || null;
  const myJoinedAgency =
    !myOwnedAgency && freshUser.agencyId
      ? agencies.find((a) => a.id === freshUser.agencyId) || null
      : null;

  const mapHosts = (agencyId: string): AgencyHostSummary[] => {
    const ownerId = agencies.find((a) => a.id === agencyId)?.ownerId;
    return users
      .filter((u) => u.agencyId === agencyId && u.id !== ownerId)
      .map((u) => ({
        id: u.id,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        frameId: u.frameId,
        level: u.level,
        gender: u.gender || 'male',
        diamonds: u.diamonds,
        hostDiamondsEarned: u.hostDiamondsEarned || 0,
        weeklyDiamonds: weeklyDiamondsByUser.get(u.id) || 0,
        hostBadge: u.hostBadge || 'مضيف رسمي ✦',
        lastSeen: u.lastSeen,
      }))
      .sort((a, b) => b.weeklyDiamonds - a.weeklyDiamonds || b.hostDiamondsEarned - a.hostDiamondsEarned);
  };

  const allApps = state.settings.hostJoinApplications || [];
  const myOwnedHosts = myOwnedAgency ? mapHosts(myOwnedAgency.id) : [];
  const weeklyAgencyTotalDiamonds = myOwnedAgency
    ? myOwnedHosts.reduce((sum, h) => sum + h.weeklyDiamonds, 0) +
      (weeklyDiamondsByUser.get(myOwnedAgency.ownerId) || 0)
    : 0;

  const publicAgencies = agencies.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    code: a.code,
    numericId: formatShortNumericId(a.id).slice(0, 6),
    ownerName: a.ownerName,
    ownerAvatar: a.ownerAvatar,
    commissionRate: a.commissionRate,
    totalHostDiamonds: a.totalHostDiamonds,
    hostCount: a.hostIds.length,
  }));

  return {
    user: freshUser,
    myAgency: myOwnedAgency
      ? {
          agency: myOwnedAgency,
          hosts: myOwnedHosts,
          weeklyAgencyTotalDiamonds,
          pendingApplications: allApps.filter(
            (app) => app.agencyId === myOwnedAgency.id && app.status === 'pending'
          ),
          commissionTransactions: (txRows || []).map(rowToTransaction),
        }
      : null,
    joinedAgency: myJoinedAgency,
    myApplications: allApps
      .filter((app) => app.userId === freshUser.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    publicAgencies,
  };
}

export async function lookupAgencyByIdOrCodeInSupabase(
  agencyInput: string
): Promise<Agency | null> {
  const clean = (agencyInput || '').trim();
  if (!clean) return null;
  const upper = clean.toUpperCase();

  const { data: rows } = await supabase.from('sada_agencies').select('*');
  const agencies = (rows || []).map(rowToAgency);

  return (
    agencies.find(
      (a) =>
        a.id.toLowerCase() === clean.toLowerCase() ||
        a.code.toUpperCase() === upper ||
        formatShortNumericId(a.id) === clean ||
        formatShortNumericId(a.id).slice(0, 6) === clean
    ) || null
  );
}

export async function submitHostJoinApplicationInSupabase(
  user: User,
  payload: { agencyInput: string; bio: string }
): Promise<HostJoinApplication> {
  const cleanBio = (payload.bio || '').trim();
  if (cleanBio.length < 5) {
    throw new Error('يرجى كتابة نبذة مختصرة عن المضيف (5 أحرف على الأقل).');
  }

  const agency = await lookupAgencyByIdOrCodeInSupabase(payload.agencyInput);
  if (!agency) {
    throw new Error('لم يتم العثور على وكالة بهذا الرقم أو الكود.');
  }
  if (agency.ownerId === user.id) {
    throw new Error('أنت مالك هذه الوكالة بالفعل.');
  }
  if (user.agencyId === agency.id) {
    throw new Error('أنت مضيف معتمد في هذه الوكالة بالفعل.');
  }

  const state = await getPlatformState();
  const apps = [...(state.settings.hostJoinApplications || [])];
  const existingPending = apps.find(
    (a) => a.userId === user.id && a.agencyId === agency.id && a.status === 'pending'
  );
  if (existingPending) {
    throw new Error('لديك طلب انضمام معلّق لهذه الوكالة بانتظار موافقة الإدارة بالفعل.');
  }

  const app: HostJoinApplication = {
    id: genId('hostapp'),
    userId: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    frameId: user.frameId,
    agencyId: agency.id,
    agencyName: agency.name,
    agencyOwnerId: agency.ownerId,
    bio: cleanBio.slice(0, 320),
    status: 'pending',
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };

  apps.unshift(app);
  await savePlatformState({
    settings: {
      ...state.settings,
      hostJoinApplications: apps,
    },
  });

  return app;
}

export async function applyAsAgencyInSupabase(
  user: User,
  payload: { name: string; description?: string; commissionRate?: number }
): Promise<{ user: User; agency: Agency }> {
  const [{ data: existingOwned }, { data: allAgencies }, state] = await Promise.all([
    supabase.from('sada_agencies').select('id').eq('owner_id', user.id).maybeSingle(),
    supabase.from('sada_agencies').select('id, code, host_ids'),
    getPlatformState(),
  ]);

  if (existingOwned) {
    throw new Error('لديك وكالة معتمدة بالفعل.');
  }

  const cleanName = (payload.name || '').trim();
  if (cleanName.length < 3) {
    throw new Error('يرجى إدخال اسم الوكالة (3 أحرف على الأقل).');
  }

  const rateNum = Number(payload.commissionRate);
  const minRate = state.settings.minAgencyCommissionRate || 0.05;
  const maxRate = state.settings.maxAgencyCommissionRate || 0.35;
  const cleanRate =
    Number.isFinite(rateNum) && rateNum >= minRate && rateNum <= maxRate
      ? rateNum
      : state.settings.defaultAgencyCommissionRate || 0.15;

  const existingCodes = new Set((allAgencies || []).map((a) => String(a.code)));
  let code = '';
  do {
    code = `SADA-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (existingCodes.has(code));

  const now = new Date().toISOString();
  const agency: Agency = {
    id: genId('agency'),
    name: cleanName.slice(0, 48),
    description:
      (payload.description || '').trim().slice(0, 160) ||
      'وكالة ملكية معتمدة لإدارة المضيفين وتنمية المواهب الصوتية في صَدَى.',
    code,
    ownerId: user.id,
    ownerName: user.displayName,
    ownerAvatar: user.avatarUrl,
    commissionRate: cleanRate,
    totalCommissionDiamonds: 0,
    totalHostDiamonds: 0,
    hostIds: [],
    status: 'approved',
    createdAt: now,
  };

  if (user.agencyId) {
    const prev = (allAgencies || []).find((a) => String(a.id) === user.agencyId);
    if (prev && Array.isArray(prev.host_ids)) {
      await supabase
        .from('sada_agencies')
        .update({
          host_ids: (prev.host_ids as string[]).filter((id) => id !== user.id),
        })
        .eq('id', prev.id);
    }
  }

  const nextUser: User = {
    ...user,
    isAgent: true,
    isHost: true,
    agencyId: agency.id,
    hostBadge: 'وكيل معتمد ✦',
    hostAgencyName: agency.name,
  };

  await Promise.all([
    supabase.from('sada_agencies').insert({
      id: agency.id,
      name: agency.name,
      description: agency.description,
      code: agency.code,
      owner_id: agency.ownerId,
      owner_name: agency.ownerName,
      owner_avatar: agency.ownerAvatar,
      commission_rate: agency.commissionRate,
      total_commission_diamonds: 0,
      total_host_diamonds: 0,
      host_ids: [],
      status: 'approved',
      created_at: now,
    }),
    supabase
      .from('sada_users')
      .update({
        is_agent: true,
        is_host: true,
        agency_id: agency.id,
        host_badge: nextUser.hostBadge,
        host_agency_name: agency.name,
      })
      .eq('id', user.id),
  ]);

  return { user: nextUser, agency };
}

export async function joinAgencyByCodeInSupabase(
  user: User,
  code: string
): Promise<{ user: User; agency: Agency }> {
  const cleanCode = (code || '').trim().toUpperCase();
  if (!cleanCode) throw new Error('يرجى إدخال كود الوكالة الصحيح.');

  const { data: agencyRow } = await supabase
    .from('sada_agencies')
    .select('*')
    .ilike('code', cleanCode)
    .maybeSingle();

  if (!agencyRow) throw new Error('كود الوكالة غير صحيح أو غير موجود.');
  const agency = rowToAgency(agencyRow);
  if (agency.ownerId === user.id) {
    throw new Error('أنت مالك هذه الوكالة بالفعل.');
  }

  if (user.agencyId && user.agencyId !== agency.id) {
    const { data: prev } = await supabase
      .from('sada_agencies')
      .select('id, host_ids')
      .eq('id', user.agencyId)
      .maybeSingle();
    if (prev && Array.isArray(prev.host_ids)) {
      await supabase
        .from('sada_agencies')
        .update({
          host_ids: (prev.host_ids as string[]).filter((id) => id !== user.id),
        })
        .eq('id', prev.id);
    }
  }

  const nextHostIds = agency.hostIds.includes(user.id)
    ? agency.hostIds
    : [...agency.hostIds, user.id];

  const nextUser: User = {
    ...user,
    isHost: true,
    agencyId: agency.id,
    hostBadge: 'مضيف رسمي ✦',
    hostAgencyName: agency.name,
  };

  await Promise.all([
    supabase
      .from('sada_agencies')
      .update({ host_ids: nextHostIds })
      .eq('id', agency.id),
    supabase
      .from('sada_users')
      .update({
        is_host: true,
        agency_id: agency.id,
        host_badge: nextUser.hostBadge,
        host_agency_name: agency.name,
      })
      .eq('id', user.id),
  ]);

  return { user: nextUser, agency: { ...agency, hostIds: nextHostIds } };
}

export async function leaveAgencyInSupabase(user: User): Promise<User> {
  if (user.isAgent) {
    throw new Error('لا يمكن لمالك الوكالة مغادرة وكالته.');
  }

  if (user.agencyId) {
    const { data: agencyRow } = await supabase
      .from('sada_agencies')
      .select('id, host_ids')
      .eq('id', user.agencyId)
      .maybeSingle();
    if (agencyRow && Array.isArray(agencyRow.host_ids)) {
      await supabase
        .from('sada_agencies')
        .update({
          host_ids: (agencyRow.host_ids as string[]).filter((id) => id !== user.id),
        })
        .eq('id', agencyRow.id);
    }
  }

  const nextUser: User = {
    ...user,
    agencyId: null,
    hostBadge: null,
    hostAgencyName: null,
  };

  await supabase
    .from('sada_users')
    .update({
      agency_id: null,
      host_badge: null,
      host_agency_name: null,
    })
    .eq('id', user.id);

  return nextUser;
}
