import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  Agency,
  Competition,
  DeviceLock,
  FemaleVoiceVerificationRequest,
  FrameItem,
  GiftItem,
  LuckyGiftMultiplierSetting,
  PlatformSettings,
  PrivateMessage,
  RechargeRewardTierSetting,
  Room,
  SecurityLog,
  Transaction,
  UsdtDepositRequest,
  UsdtWithdrawalRequest,
  User,
} from '../src/types';
import {
  getSupabaseSyncStatus,
  loadDatabaseFromSupabase,
  pushDatabaseToSupabase,
  queueSupabaseSync,
} from './supabase';

export const ADMIN_USDT_TRC20_ADDRESS = 'TFXPytN94bSAUzD893hjpSwp6DGWqGkGSa';
export const USDT_TO_COINS_RATE = 1000;
export const DIAMONDS_PER_USDT = 100;
export const COINS_PER_USDT_WITHDRAW = 1000;
export const MIN_WITHDRAW_USDT = 5;

export const SUPER_ADMIN_EMAIL = 'bahaa.f36@gmail.com';

export interface StoredUser extends User {
  passwordHash: string;
}

export interface StoredRoom extends Room {
  password?: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
}

export interface CulturalQuestionItem {
  id: string;
  category: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  xpReward: number;
  coinsReward: number;
}

export interface QuizSessionRecord {
  roundId: string;
  userId: string;
  questionId: string;
  correctIndex: number;
  xpReward: number;
  coinsReward: number;
  expiresAt: number;
  answered: boolean;
}

export interface SadaDatabase {
  users: StoredUser[];
  deviceLocks: Record<string, DeviceLock>;
  securityLogs: SecurityLog[];
  rooms: StoredRoom[];
  competitions: Competition[];
  transactions: Transaction[];
  privateMessages: PrivateMessage[];
  agencies: Agency[];
  appPrizePoolCoins: number;
  quizSessions: Record<string, QuizSessionRecord>;
  culturalQuestions: CulturalQuestionItem[];
  settings: PlatformSettings;
  usdtDeposits: UsdtDepositRequest[];
  usdtWithdrawals: UsdtWithdrawalRequest[];
  femaleVoiceRequests: FemaleVoiceVerificationRequest[];
  sessions: Record<string, SessionRecord>;
  votedKeys: Record<string, boolean>;
  ladderSessions?: Record<string, { bet: number; step: number; currentMultiplier: number }>;
}

export const PM_MESSAGE_COST = 150;
export const PM_REPLY_DIAMONDS = 115;

export function isFemaleVoiceLocked(
  user: Pick<User, 'gender' | 'is_admin' | 'femaleVoiceStatus'>
): boolean {
  return (
    user.gender === 'female' &&
    !user.is_admin &&
    user.femaleVoiceStatus !== 'verified'
  );
}

export function isFemaleOrHost(user: User, db: SadaDatabase): boolean {
  if (isFemaleVoiceLocked(user)) return false;
  if (user.gender === 'female' || Boolean(user.isHost)) return true;
  return db.rooms.some((r) => r.hostId === user.id);
}

export function makeConversationId(userA: string, userB: string): string {
  return [userA, userB].sort().join('__');
}

export function getVipTierLabel(level: number, isAdmin = false): string {
  if (isAdmin) return 'VIP الإدارة العليا';
  if (level >= 25) return 'VIP إمبراطوري';
  if (level >= 15) return 'VIP ماسي';
  if (level >= 8) return 'VIP ذهبي';
  if (level >= 3) return 'VIP فضي';
  return 'VIP برونزي';
}

const FIXED_GIFT_RAW: Array<{
  id: string;
  name: string;
  coinsCost: number;
  tier: 'classic' | 'royal' | 'imperial';
  glyph: string;
}> = [
  { id: 'gift_01', name: 'وردة الديوان الملكية', coinsCost: 2000, tier: 'classic', glyph: '🌹' },
  { id: 'gift_02', name: 'فنجان القهوة العربية', coinsCost: 3000, tier: 'classic', glyph: '☕' },
  { id: 'gift_03', name: 'مبخرة العود الفاخرة', coinsCost: 4500, tier: 'classic', glyph: '🪔' },
  { id: 'gift_04', name: 'وسام الصوت العذب', coinsCost: 6000, tier: 'classic', glyph: '🎙️' },
  { id: 'gift_05', name: 'قنديل السمر الذهبي', coinsCost: 8000, tier: 'classic', glyph: '🏮' },
  { id: 'gift_06', name: 'مسبحة الكهرمان الملكي', coinsCost: 10000, tier: 'classic', glyph: '📿' },
  { id: 'gift_07', name: 'باقة الياسمين الدمشقي', coinsCost: 12500, tier: 'classic', glyph: '💐' },
  { id: 'gift_08', name: 'عود الطرب الشرقي', coinsCost: 15000, tier: 'classic', glyph: '🪕' },
  { id: 'gift_09', name: 'خنجر الفخر المذهّب', coinsCost: 18000, tier: 'classic', glyph: '🗡️' },
  { id: 'gift_10', name: 'ساعة القصر الليلية', coinsCost: 21000, tier: 'classic', glyph: '⌚' },
  { id: 'gift_11', name: 'بوابة الأندلس المضيئة', coinsCost: 25000, tier: 'royal', glyph: '🕌' },
  { id: 'gift_12', name: 'كأس النخبة الماسي', coinsCost: 30000, tier: 'royal', glyph: '🏆' },
  { id: 'gift_13', name: 'تاج الأمراء المرصّع', coinsCost: 35000, tier: 'royal', glyph: '👑' },
  { id: 'gift_14', name: 'مهر الأصالة العربي', coinsCost: 40000, tier: 'royal', glyph: '🐎' },
  { id: 'gift_15', name: 'صقر الصحراء الذهبي', coinsCost: 45000, tier: 'royal', glyph: '🦅' },
  { id: 'gift_16', name: 'عقد اللؤلؤ الخليجي', coinsCost: 52000, tier: 'royal', glyph: '🦪' },
  { id: 'gift_17', name: 'سيف العز الدمشقي', coinsCost: 60000, tier: 'royal', glyph: '⚔️' },
  { id: 'gift_18', name: 'يخت الخليج الملكي', coinsCost: 68000, tier: 'royal', glyph: '🛥️' },
  { id: 'gift_19', name: 'شعار المجد الذهبي', coinsCost: 76000, tier: 'royal', glyph: '⚜️' },
  { id: 'gift_20', name: 'سيارة القصر الفارهة', coinsCost: 85000, tier: 'royal', glyph: '🚘' },
  { id: 'gift_21', name: 'جوهرة الياقوت الأزرق', coinsCost: 95000, tier: 'imperial', glyph: '💠' },
  { id: 'gift_22', name: 'مروحية كبار الشخصيات', coinsCost: 105000, tier: 'imperial', glyph: '🚁' },
  { id: 'gift_23', name: 'قصر الرمال الذهبي', coinsCost: 115000, tier: 'imperial', glyph: '🏰' },
  { id: 'gift_24', name: 'طائرة صَدَى الخاصة', coinsCost: 128000, tier: 'imperial', glyph: '✈️' },
  { id: 'gift_25', name: 'نجم الثريا الساطع', coinsCost: 140000, tier: 'imperial', glyph: '🌟' },
  { id: 'gift_26', name: 'هلال السلاطين الماسي', coinsCost: 155000, tier: 'imperial', glyph: '🌙' },
  { id: 'gift_27', name: 'عرش البيان الملكي', coinsCost: 170000, tier: 'imperial', glyph: '🪑' },
  { id: 'gift_28', name: 'تنين الذهب الأسطوري', coinsCost: 180000, tier: 'imperial', glyph: '🐉' },
  { id: 'gift_29', name: 'موكب الصدارة الإمبراطوري', coinsCost: 190000, tier: 'imperial', glyph: '🎖️' },
  { id: 'gift_30', name: 'تاج إمبراطورية صَدَى الأعظم', coinsCost: 200000, tier: 'imperial', glyph: '💎' },
];

const LUCKY_GIFT_RAW: Array<{
  id: string;
  name: string;
  coinsCost: number;
  tier: 'classic' | 'royal' | 'imperial';
  glyph: string;
}> = [
  { id: 'lucky_01', name: 'تعويذة الحظ السعيد', coinsCost: 100, tier: 'classic', glyph: '🍀' },
  { id: 'lucky_02', name: 'شرارة النجم الذهبي', coinsCost: 200, tier: 'classic', glyph: '✨' },
  { id: 'lucky_03', name: 'نرد القصر المضيء', coinsCost: 350, tier: 'classic', glyph: '🎲' },
  { id: 'lucky_04', name: 'سهم الفرح الملكي', coinsCost: 500, tier: 'classic', glyph: '💘' },
  { id: 'lucky_05', name: 'تميمة البرق الفاخرة', coinsCost: 750, tier: 'classic', glyph: '⚡' },
  { id: 'lucky_06', name: 'جوهرة السعد الأولى', coinsCost: 1000, tier: 'classic', glyph: '🔮' },
  { id: 'lucky_07', name: 'فراشة الأمل الذهبية', coinsCost: 1250, tier: 'classic', glyph: '🦋' },
  { id: 'lucky_08', name: 'بطاقة الحظ الماسية', coinsCost: 1500, tier: 'classic', glyph: '🃏' },
  { id: 'lucky_09', name: 'هدية المفرقعات الملكية', coinsCost: 2000, tier: 'royal', glyph: '🎆' },
  { id: 'lucky_10', name: 'مغناطيس الذهب الفوري', coinsCost: 2500, tier: 'royal', glyph: '🧲' },
  { id: 'lucky_11', name: 'كبسولة الثروة السريعة', coinsCost: 3000, tier: 'royal', glyph: '🎰' },
  { id: 'lucky_12', name: 'زهرة القمر المتلألئة', coinsCost: 3500, tier: 'royal', glyph: '🌺' },
  { id: 'lucky_13', name: 'بوصلة الكنز العربي', coinsCost: 4200, tier: 'royal', glyph: '🧭' },
  { id: 'lucky_14', name: 'صندوق المفاجآت الملكي', coinsCost: 5000, tier: 'royal', glyph: '🎁' },
  { id: 'lucky_15', name: 'مفتاح خزنة السلاطين', coinsCost: 5800, tier: 'royal', glyph: '🗝️' },
  { id: 'lucky_16', name: 'نيزك الكوينز المضاعف', coinsCost: 6500, tier: 'imperial', glyph: '☄️' },
  { id: 'lucky_17', name: 'طاووس الحظ الإمبراطوري', coinsCost: 7500, tier: 'imperial', glyph: '🦚' },
  { id: 'lucky_18', name: 'بركان الذهب المتوهج', coinsCost: 8500, tier: 'imperial', glyph: '🌋' },
  { id: 'lucky_19', name: 'كرة الحظ الإمبراطورية', coinsCost: 9200, tier: 'imperial', glyph: '🪩' },
  { id: 'lucky_20', name: 'خزنة الحظ العظمى', coinsCost: 10000, tier: 'imperial', glyph: '👑' },
];

export const LUCKY_GIFT_MULTIPLIERS: LuckyGiftMultiplierSetting[] = [
  { multiplier: 0, weight: 34 },
  { multiplier: 0.2, weight: 34 },
  { multiplier: 0.5, weight: 11 },
  { multiplier: 1, weight: 11 },
  { multiplier: 1.5, weight: 4 },
  { multiplier: 2, weight: 4 },
  { multiplier: 3, weight: 1.8 },
  { multiplier: 10, weight: 0.2 },
];

export function rollLuckyGiftMultiplier(
  _multipliers: LuckyGiftMultiplierSetting[] = LUCKY_GIFT_MULTIPLIERS
): number {
  const source = LUCKY_GIFT_MULTIPLIERS;
  const total = source.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of source) {
    roll -= item.weight;
    if (roll <= 0) return item.multiplier;
  }
  return source[0].multiplier;
}

export const GIFT_CATALOG: GiftItem[] = [
  ...FIXED_GIFT_RAW.map((g) => ({
    ...g,
    category: 'fixed' as const,
    diamondsValue: Math.round(g.coinsCost * 0.75),
    xpGain: Math.round(g.coinsCost * 0.4),
  })),
  ...LUCKY_GIFT_RAW.map((g) => ({
    ...g,
    category: 'lucky' as const,
    diamondsValue: Math.round(g.coinsCost * 0.7),
    xpGain: Math.round(g.coinsCost * 0.5),
  })),
];

export const FRAME_CATALOG: FrameItem[] = [
  {
    id: 'frame_obsidian',
    name: 'إطار المخمل الليلي',
    description: 'الإطار الافتراضي للأعضاء الجدد بحواف ذهبية ناعمة.',
    priceCoins: 0,
    minLevel: 1,
    ringClass: 'ring-2 ring-[#D4AF37]/40 shadow-[0_0_12px_rgba(212,175,55,0.2)]',
  },
  {
    id: 'frame_crescent',
    name: 'هالة الهلال الذهبي',
    description: 'توهج ذهبي مصقول يبرز حضورك على مقاعد البث.',
    priceCoins: 600,
    minLevel: 1,
    ringClass: 'ring-2 ring-[#F3D37A] shadow-[0_0_20px_rgba(243,211,122,0.5)]',
  },
  {
    id: 'frame_sapphire',
    name: 'تاج الياقوت الأزرق',
    description: 'محيط ملكي أزرق عميق مطعّم بخيوط الذهب الخالص.',
    priceCoins: 1500,
    minLevel: 3,
    ringClass: 'ring-[3px] ring-sky-400 shadow-[0_0_24px_rgba(56,189,248,0.55)]',
  },
  {
    id: 'frame_imperial',
    name: 'ختم القصر الإمبراطوري',
    description: 'أرقى إطار في صَدَى لكبار الشخصيات والمنافسين.',
    priceCoins: 3500,
    minLevel: 5,
    ringClass:
      'ring-[3px] ring-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.75)]',
  },
  {
    id: 'frame_silver_7d',
    name: 'الإطار الفضي الملكي',
    description: 'مكافأة الشحن من 10$ — هالة فضية مصقولة لمدة 7 أيام.',
    priceCoins: 0,
    minLevel: 1,
    ringClass: 'ring-[3px] ring-slate-200 shadow-[0_0_22px_rgba(226,232,240,0.68)]',
    isTemporary: true,
  },
  {
    id: 'frame_gold_15d',
    name: 'الإطار الذهبي المتوهج',
    description: 'مكافأة الشحن من 50$ — بريق ذهبي + دخولية سيارة لمدة 15 يوماً.',
    priceCoins: 0,
    minLevel: 1,
    ringClass: 'ring-[3px] ring-[#FCE9A6] shadow-[0_0_28px_rgba(243,211,122,0.85)]',
    isTemporary: true,
  },
  {
    id: 'frame_royal_30d',
    name: 'الإطار الملكي الأسطوري',
    description: 'مكافأة الشحن من 100$ فأكثر — تاج إمبراطوري + دخولية أسطورية لمدة 30 يوماً.',
    priceCoins: 0,
    minLevel: 1,
    ringClass: 'ring-[4px] ring-amber-300 shadow-[0_0_36px_rgba(251,191,36,0.95)]',
    isTemporary: true,
  },
];

export const RECHARGE_REWARD_TIERS: RechargeRewardTierSetting[] = [
  {
    id: 'tier_silver_10',
    minUsdt: 10,
    days: 7,
    frameId: 'frame_silver_7d',
    frameName: 'إطار فضي',
    entryId: null,
    entryName: null,
    bonusRate: 0.05,
    label: 'إطار فضي (7 أيام)',
  },
  {
    id: 'tier_gold_50',
    minUsdt: 50,
    days: 15,
    frameId: 'frame_gold_15d',
    frameName: 'إطار ذهبي',
    entryId: 'entry_car_15d',
    entryName: 'دخولية سيارة',
    bonusRate: 0.1,
    label: 'إطار ذهبي + دخولية سيارة (15 يوماً)',
  },
  {
    id: 'tier_royal_100',
    minUsdt: 100,
    days: 30,
    frameId: 'frame_royal_30d',
    frameName: 'إطار ملكي',
    entryId: 'entry_legendary_30d',
    entryName: 'دخولية أسطورية',
    bonusRate: 0.15,
    label: 'إطار ملكي + دخولية أسطورية (30 يوماً)',
  },
];

export function getRechargeRewardTier(
  amountUsdt: number,
  tiers: RechargeRewardTierSetting[] = RECHARGE_REWARD_TIERS
) {
  const sorted = [...tiers].sort((a, b) => b.minUsdt - a.minUsdt);
  for (const tier of sorted) {
    if (amountUsdt >= tier.minUsdt) return tier;
  }
  return null;
}

const TEMP_ONLY_FRAME_IDS = new Set([
  'frame_silver_7d',
  'frame_gold_15d',
  'frame_royal_30d',
]);

export function purgeExpiredVisualRewards(user: StoredUser, db?: SadaDatabase): boolean {
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

    if (db) {
      for (const room of db.rooms) {
        for (const seat of room.seats) {
          if (seat.userId === user.id) {
            seat.frameId = user.frameId;
          }
        }
      }
    }
  }

  if (user.tempEntryExpiresAt && nowMs >= new Date(user.tempEntryExpiresAt).getTime()) {
    user.activeEntryId = null;
    user.activeEntryName = null;
    user.tempEntryExpiresAt = null;
    changed = true;
  }

  return changed;
}

export function isUserEligibleForWithdrawal(
  user: StoredUser,
  db: SadaDatabase
): { eligible: boolean; roleLabel: string } {
  if (user.is_admin) return { eligible: true, roleLabel: 'إدارة' };
  if (user.isAgent) return { eligible: true, roleLabel: 'وكيل' };
  if (user.isHost || db.rooms.some((r) => r.hostId === user.id)) {
    return { eligible: true, roleLabel: 'مضيف' };
  }
  const isWinner =
    db.competitions.some((c) => c.winnerId === user.id) ||
    db.transactions.some(
      (t) =>
        t.userId === user.id &&
        (t.type === 'prize' || t.type === 'quiz_reward' || t.type === 'referral_wheel')
    );
  if (isWinner) return { eligible: true, roleLabel: 'فائز' };
  return { eligible: false, roleLabel: 'عضو' };
}

export const LUCKY_WHEEL_COST = 200;

export const INITIAL_APP_PRIZE_POOL_COINS = 0;

export const REFERRAL_WHEEL_SEGMENTS = [
  {
    id: 'ref_1',
    label: 'حظ أوفر في المحاولة القادمة',
    shortLabel: 'حظ أوفر',
    coinsAmount: 0,
    glyph: '🍀',
    weight: 24,
  },
  {
    id: 'ref_2',
    label: '500 كوينز ذهبية',
    shortLabel: '500 كوينز',
    coinsAmount: 500,
    glyph: '🪙',
    weight: 26,
  },
  {
    id: 'ref_3',
    label: '1,500 كوينز ملكية',
    shortLabel: '1,500 كوينز',
    coinsAmount: 1500,
    glyph: '💰',
    weight: 18,
  },
  {
    id: 'ref_4',
    label: '5,000 كوينز فاخرة',
    shortLabel: '5,000 كوينز',
    coinsAmount: 5000,
    glyph: '✨',
    weight: 14,
  },
  {
    id: 'ref_5',
    label: '15,000 كوينز ذهبية',
    shortLabel: '15,000 كوينز',
    coinsAmount: 15000,
    glyph: '🏆',
    weight: 9,
  },
  {
    id: 'ref_6',
    label: '35,000 كوينز ماسية',
    shortLabel: '35,000 كوينز',
    coinsAmount: 35000,
    glyph: '👑',
    weight: 5,
  },
  {
    id: 'ref_7',
    label: '60,000 كوينز إمبراطورية',
    shortLabel: '60,000 كوينز',
    coinsAmount: 60000,
    glyph: '💎',
    weight: 3,
  },
  {
    id: 'ref_8',
    label: 'الجائزة الكبرى · 100,000 كوينز',
    shortLabel: '100,000 كوينز',
    coinsAmount: 100000,
    glyph: '🌟',
    weight: 1,
  },
];

export const CULTURAL_QUESTIONS: CulturalQuestionItem[] = [];

export const LUCKY_WHEEL_SEGMENTS = [
  {
    id: 'seg_1',
    label: '200 كوينز ذهبية',
    shortLabel: '200 كوينز',
    rewardType: 'coins' as const,
    coinsAmount: 200,
    xpAmount: 20,
    glyph: '🪙',
  },
  {
    id: 'seg_2',
    label: 'إطار الهلال الذهبي المؤقت (24 ساعة)',
    shortLabel: 'إطار الهلال',
    rewardType: 'frame' as const,
    frameId: 'frame_crescent',
    xpAmount: 60,
    glyph: '🌙',
  },
  {
    id: 'seg_3',
    label: '500 كوينز مضاعفة',
    shortLabel: '500 كوينز',
    rewardType: 'coins' as const,
    coinsAmount: 500,
    xpAmount: 45,
    glyph: '💰',
  },
  {
    id: 'seg_4',
    label: '150 نقطة خبرة XP',
    shortLabel: '150 XP',
    rewardType: 'xp' as const,
    xpAmount: 150,
    glyph: '⭐',
  },
  {
    id: 'seg_5',
    label: '1,000 كوينز ملكية',
    shortLabel: '1,000 كوينز',
    rewardType: 'coins' as const,
    coinsAmount: 1000,
    xpAmount: 90,
    glyph: '👑',
  },
  {
    id: 'seg_6',
    label: 'إطار القصر الإمبراطوري المؤقت (24 ساعة)',
    shortLabel: 'إطار السلطان',
    rewardType: 'frame' as const,
    frameId: 'frame_imperial',
    xpAmount: 120,
    glyph: '✨',
  },
  {
    id: 'seg_7',
    label: '300 نقطة خبرة XP',
    shortLabel: '300 XP',
    rewardType: 'xp' as const,
    xpAmount: 300,
    glyph: '🔥',
  },
  {
    id: 'seg_8',
    label: 'الجائزة الكبرى · 2,500 كوينز',
    shortLabel: '2,500 كوينز',
    rewardType: 'coins' as const,
    coinsAmount: 2500,
    xpAmount: 220,
    glyph: '💎',
  },
];

export function createDefaultPlatformSettings(): PlatformSettings {
  const defaultWeights = [20, 14, 16, 16, 10, 8, 11, 5];
  return {
    usdtToCoinsRate: USDT_TO_COINS_RATE,
    coinsPerUsdtWithdraw: COINS_PER_USDT_WITHDRAW,
    diamondsPerUsdt: DIAMONDS_PER_USDT,
    diamondToCoinsRate: 2,
    defaultAgencyCommissionRate: 0.15,
    minAgencyCommissionRate: 0.05,
    maxAgencyCommissionRate: 0.35,
    pmMessageCost: PM_MESSAGE_COST,
    pmReplyDiamonds: PM_REPLY_DIAMONDS,
    giftDiamondsRatio: 0.75,
    roomWheelCost: LUCKY_WHEEL_COST,
    roomWheelSegments: LUCKY_WHEEL_SEGMENTS.map((seg, i) => ({
      ...seg,
      weight: defaultWeights[i] ?? 10,
    })),
    luckyGiftMultipliers: LUCKY_GIFT_MULTIPLIERS.map((m) => ({ ...m })),
    rechargeRewardTiers: RECHARGE_REWARD_TIERS.map((t) => ({ ...t })),
    gameRates: {
      slotsWinRate: 38,
      doubleDiceWinRate: 42,
      predictionDiceWinRate: 40,
      ladderDiceWinRate: 58,
      speedDiceWinRate: 44,
      rouletteWinRate: 45,
      mysteryBoxWinRate: 42,
    },
  };
}

export const TOPUP_PACKS = [
  { id: 'pack_1', label: 'باقة الديوان', coins: 1000, bonus: 100, priceLabel: '9.99 $' },
  { id: 'pack_2', label: 'باقة المجلس الملكي', coins: 3500, bonus: 500, priceLabel: '29.99 $' },
  { id: 'pack_3', label: 'باقة القصر الذهبي', coins: 8500, bonus: 1500, priceLabel: '69.99 $' },
  { id: 'pack_4', label: 'خزنة السلطان', coins: 22000, bonus: 5000, priceLabel: '149.99 $' },
];

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'sada-store.json');

export function hashPassword(password: string): string {
  const salt = 'sada_royal_salt_v1';
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

function createInitialDb(): SadaDatabase {
  return {
    users: [],
    deviceLocks: {},
    securityLogs: [],
    rooms: [],
    competitions: [],
    transactions: [],
    privateMessages: [],
    agencies: [],
    appPrizePoolCoins: INITIAL_APP_PRIZE_POOL_COINS,
    quizSessions: {},
    culturalQuestions: [],
    settings: createDefaultPlatformSettings(),
    usdtDeposits: [],
    usdtWithdrawals: [],
    sessions: {},
    votedKeys: {},
    femaleVoiceRequests: [],
    ladderSessions: {},
  };
}
let dbCache: SadaDatabase | null = null;

export function getDb(): SadaDatabase {
  if (dbCache) return dbCache;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      dbCache = JSON.parse(raw) as SadaDatabase;
      if (!Array.isArray(dbCache.privateMessages)) {
        dbCache.privateMessages = [];
      }
      if (!Array.isArray(dbCache.agencies)) {
        dbCache.agencies = [];
      }
      if (typeof dbCache.appPrizePoolCoins !== 'number') {
        dbCache.appPrizePoolCoins = INITIAL_APP_PRIZE_POOL_COINS;
      }
      if (!dbCache.quizSessions || typeof dbCache.quizSessions !== 'object') {
        dbCache.quizSessions = {};
      }
      if (!Array.isArray(dbCache.culturalQuestions)) {
        dbCache.culturalQuestions = [];
      }
      if (!dbCache.settings || typeof dbCache.settings !== 'object') {
        dbCache.settings = createDefaultPlatformSettings();
      } else {
        const defs = createDefaultPlatformSettings();
        dbCache.settings = {
          ...defs,
          ...dbCache.settings,
          gameRates: {
            ...defs.gameRates!,
            ...(dbCache.settings.gameRates || {}),
          },
        };
      }
      if (!dbCache.ladderSessions || typeof dbCache.ladderSessions !== 'object') {
        dbCache.ladderSessions = {};
      }
      if (!Array.isArray(dbCache.usdtDeposits)) {
        dbCache.usdtDeposits = [];
      }
      if (!Array.isArray(dbCache.usdtWithdrawals)) {
        dbCache.usdtWithdrawals = [];
      }
      if (!Array.isArray(dbCache.femaleVoiceRequests)) {
        dbCache.femaleVoiceRequests = [];
      }
      return dbCache;
    } catch {
      dbCache = createInitialDb();
      saveDb();
      return dbCache;
    }
  }
  dbCache = createInitialDb();
  saveDb();
  return dbCache;
}

export function saveDb(): void {
  if (!dbCache) return;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(dbCache, null, 2), 'utf-8');
  queueSupabaseSync(dbCache, GIFT_CATALOG);
}

export async function initDatabase(): Promise<SadaDatabase> {
  const localDb = getDb();
  const remoteDb = await loadDatabaseFromSupabase({
    defaultSettings: createDefaultPlatformSettings(),
    defaultQuestions: [],
    initialPoolCoins: INITIAL_APP_PRIZE_POOL_COINS,
  });
  if (remoteDb) {
    dbCache = remoteDb;
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(dbCache, null, 2), 'utf-8');
    return dbCache;
  }
  const status = getSupabaseSyncStatus();
  if (status.configured && !status.schemaMissing) {
    await pushDatabaseToSupabase(localDb, GIFT_CATALOG);
  }
  return localDb;
}

export async function syncNowWithSupabase() {
  const remoteDb = await loadDatabaseFromSupabase({
    defaultSettings: createDefaultPlatformSettings(),
    defaultQuestions: [],
    initialPoolCoins: INITIAL_APP_PRIZE_POOL_COINS,
  });
  if (remoteDb) {
    dbCache = remoteDb;
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(dbCache, null, 2), 'utf-8');
  } else {
    await pushDatabaseToSupabase(getDb(), GIFT_CATALOG);
  }
  return getSupabaseSyncStatus();
}

export function sanitizeUser(u: StoredUser): User {
  const { passwordHash: _ignored, ...rest } = u;
  return rest;
}

export function sanitizeRoom(r: StoredRoom): Room {
  const { password, ...rest } = r;
  return {
    ...rest,
    hasPassword: Boolean(password && password.length > 0),
  };
}

export function computeLevelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 120)) + 1);
}
