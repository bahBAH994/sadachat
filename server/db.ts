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
  RoomSeat,
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
  { multiplier: 1, weight: 32 },
  { multiplier: 1.5, weight: 26 },
  { multiplier: 2, weight: 22 },
  { multiplier: 3, weight: 12 },
  { multiplier: 5, weight: 6 },
  { multiplier: 10, weight: 2 },
];

export function rollLuckyGiftMultiplier(
  multipliers: LuckyGiftMultiplierSetting[] = LUCKY_GIFT_MULTIPLIERS
): number {
  const valid = multipliers.filter((m) => m.weight > 0 && m.multiplier >= 0);
  const source = valid.length > 0 ? valid : LUCKY_GIFT_MULTIPLIERS;
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

export const INITIAL_APP_PRIZE_POOL_COINS = 250000;

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

export const CULTURAL_QUESTIONS: CulturalQuestionItem[] = [
  {
    id: 'cq_1',
    category: 'الأدب والشعر العربي',
    question: 'من الشاعر العربي الذي لُقّب بـ "شاعر النيل"؟',
    options: ['أحمد شوقي', 'حافظ إبراهيم', 'المتنبي', 'أبو تمام'],
    correctIndex: 1,
    xpReward: 140,
    coinsReward: 250,
  },
  {
    id: 'cq_2',
    category: 'التاريخ والحضارة',
    question: 'في أي مدينة أُسّست جامعة القرويين، أقدم جامعة مستمرة في العالم؟',
    options: ['قرطبة', 'القاهرة', 'فاس', 'بغداد'],
    correctIndex: 2,
    xpReward: 140,
    coinsReward: 250,
  },
  {
    id: 'cq_3',
    category: 'اللغة والبلاغة',
    question: 'ما اسم المعجم اللغوي الشهير الذي ألّفه ابن منظور؟',
    options: ['لسان العرب', 'تاج العروس', 'الصحاح', 'المحيط'],
    correctIndex: 0,
    xpReward: 130,
    coinsReward: 220,
  },
  {
    id: 'cq_4',
    category: 'العلوم الإسلامية والعربية',
    question: 'من العالم العربي الذي يُعد مؤسس علم البصريات الحديث ومؤلف كتاب "المناظر"؟',
    options: ['جابر بن حيان', 'الخوارزمي', 'الحسن بن الهيثم', 'ابن سينا'],
    correctIndex: 2,
    xpReward: 150,
    coinsReward: 300,
  },
  {
    id: 'cq_5',
    category: 'الشعر الجاهلي',
    question: 'كم عدد المعلقات السبع المشهورة في الشعر الجاهلي على الأشهر؟',
    options: ['خمس معلقات', 'سبع معلقات', 'تسع معلقات', 'إحدى عشرة معلقة'],
    correctIndex: 1,
    xpReward: 120,
    coinsReward: 200,
  },
  {
    id: 'cq_6',
    category: 'الجغرافيا العربية',
    question: 'ما المضيق البحري الذي يربط بين البحر الأحمر وخليج عدن؟',
    options: ['مضيق هرمز', 'مضيق جبل طارق', 'مضيق باب المندب', 'قناة السويس'],
    correctIndex: 2,
    xpReward: 130,
    coinsReward: 220,
  },
  {
    id: 'cq_7',
    category: 'الأدب والتراث',
    question: 'من مؤلف كتاب "مقدمة ابن خلدون" الذي أسّس علم الاجتماع؟',
    options: ['عبد الرحمن بن خلدون', 'أبو حامد الغزالي', 'ابن رشد', 'المسعودي'],
    correctIndex: 0,
    xpReward: 120,
    coinsReward: 200,
  },
  {
    id: 'cq_8',
    category: 'الفنون والموسيقى',
    question: 'ما المقام الموسيقي العربي المشهور بطابعه الروحاني والدافئ في الموشحات؟',
    options: ['مقام الحجاز', 'مقام الجاز', 'مقام البلوز', 'مقام السوبرانو'],
    correctIndex: 0,
    xpReward: 140,
    coinsReward: 250,
  },
  {
    id: 'cq_9',
    category: 'التاريخ والأندلس',
    question: 'ما القصر الأندلسي الشهير في غرناطة الذي يُعد تحفة العمارة الإسلامية؟',
    options: ['قصر الحمراء', 'قصر الشوق', 'قصر المصمك', 'قصر العظم'],
    correctIndex: 0,
    xpReward: 130,
    coinsReward: 220,
  },
  {
    id: 'cq_10',
    category: 'العلوم والرياضيات',
    question: 'من العالم المسلم الذي استمدت منه كلمة "الخوارزمية" في علوم الحاسوب؟',
    options: ['البيروني', 'محمد بن موسى الخوارزمي', 'عمر الخيام', 'الكندي'],
    correctIndex: 1,
    xpReward: 150,
    coinsReward: 300,
  },
  {
    id: 'cq_11',
    category: 'الشعر الفصيح',
    question: 'قائل البيت الشهير: "على قدر أهل العزم تأتي العزائم" هو:',
    options: ['أبو الطيب المتنبي', 'البحتري', 'امرؤ القيس', 'نزار قباني'],
    correctIndex: 0,
    xpReward: 140,
    coinsReward: 250,
  },
  {
    id: 'cq_12',
    category: 'التراث العربي',
    question: 'بماذا تُعرف مدينة البتراء الأثرية في الأردن؟',
    options: ['المدينة البيضاء', 'المدينة الوردية', 'مدينة النخيل', 'مدينة اللؤلؤ'],
    correctIndex: 1,
    xpReward: 130,
    coinsReward: 220,
  },
];

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

function makeEmptySeats(count: number, host?: StoredUser): RoomSeat[] {
  const seats: RoomSeat[] = [];
  for (let i = 0; i < count; i++) {
    if (i === 0 && host) {
      seats.push({
        seatIndex: 0,
        userId: host.id,
        displayName: host.displayName,
        avatarUrl: host.avatarUrl,
        frameId: host.frameId,
        level: host.level,
        isMuted: false,
        isLocked: false,
        isSpeaking: false,
        receivedDiamonds: 420,
      });
    } else {
      seats.push({
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
  return seats;
}

function createInitialDb(): SadaDatabase {
  const now = new Date().toISOString();

  const hostTariq: StoredUser = {
    id: 'user_host_tariq',
    email: 'tariq@sada.vip',
    passwordHash: hashPassword('SadaHost2026!'),
    displayName: 'طارق المنصور',
    bio: 'مقدّم أمسيات الشعر الفصيح والحوارات الثقافية في صَدَى.',
    avatarUrl: 'host_male',
    gender: 'male',
    isHost: true,
    isAgent: true,
    agencyId: 'agency_royal_divan',
    hostBadge: 'وكيل معتمد ✦',
    hostAgencyName: 'وكالة الديوان الملكي',
    hostDiamondsEarned: 4250,
    referralCode: 'REF-TARIQ1',
    referredBy: null,
    referralCount: 3,
    referralSpins: 2,
    frameId: 'frame_imperial',
    unlockedFrames: ['frame_obsidian', 'frame_crescent', 'frame_imperial'],
    coins: 8400,
    diamonds: 4250,
    level: 14,
    xp: 6800,
    is_admin: false,
    is_banned: false,
    device_uuid: 'seed-device-tariq-01',
    createdAt: now,
    lastSeen: now,
  };

  const hostLayan: StoredUser = {
    id: 'user_host_layan',
    email: 'layan@sada.vip',
    passwordHash: hashPassword('SadaHost2026!'),
    displayName: 'ليان العتيبي',
    bio: 'صوت المساء والطرب الأصيل — بطلة موسم صَدَى الذهبي.',
    avatarUrl: 'host_female',
    gender: 'female',
    femaleVoiceStatus: 'verified',
    femaleVerified: true,
    femaleVerifiedBadge: 'موثّقة ✦',
    isHost: true,
    isAgent: false,
    agencyId: 'agency_royal_divan',
    hostBadge: 'مضيف رسمي ✦',
    hostAgencyName: 'وكالة الديوان الملكي',
    hostDiamondsEarned: 6180,
    referralCode: 'REF-LAYAN2',
    referredBy: null,
    referralCount: 5,
    referralSpins: 3,
    frameId: 'frame_crescent',
    unlockedFrames: ['frame_obsidian', 'frame_crescent'],
    coins: 5200,
    diamonds: 6180,
    level: 11,
    xp: 5100,
    is_admin: false,
    is_banned: false,
    device_uuid: 'seed-device-layan-02',
    createdAt: now,
    lastSeen: now,
  };

  const hostFaisal: StoredUser = {
    id: 'user_host_faisal',
    email: 'faisal@sada.vip',
    passwordHash: hashPassword('SadaHost2026!'),
    displayName: 'فيصل الهاشمي',
    bio: 'حكم مسابقات الإلقاء والتحديات الصوتية المباشرة.',
    avatarUrl: 'host_male',
    gender: 'male',
    isHost: true,
    isAgent: false,
    agencyId: 'agency_royal_divan',
    hostBadge: 'مضيف رسمي ✦',
    hostAgencyName: 'وكالة الديوان الملكي',
    hostDiamondsEarned: 2100,
    referralCode: 'REF-FAISAL',
    referredBy: null,
    referralCount: 1,
    referralSpins: 1,
    frameId: 'frame_sapphire',
    unlockedFrames: ['frame_obsidian', 'frame_sapphire'],
    coins: 3900,
    diamonds: 2100,
    level: 8,
    xp: 3400,
    is_admin: false,
    is_banned: false,
    device_uuid: 'seed-device-faisal-03',
    createdAt: now,
    lastSeen: now,
  };

  const seatsRoom1 = makeEmptySeats(8, hostTariq);
  seatsRoom1[1] = {
    seatIndex: 1,
    userId: hostLayan.id,
    displayName: hostLayan.displayName,
    avatarUrl: hostLayan.avatarUrl,
    frameId: hostLayan.frameId,
    level: hostLayan.level,
    isMuted: false,
    isLocked: false,
    isSpeaking: true,
    receivedDiamonds: 890,
  };

  const seatsRoom2 = makeEmptySeats(6, hostLayan);
  const seatsRoom3 = makeEmptySeats(8, hostFaisal);
  const seatsRoom4 = makeEmptySeats(6, hostTariq);

  const rooms: StoredRoom[] = [
    {
      id: 'room_royal_majlis',
      title: 'مجلس القصر الملكي · ليلة السمر الذهبية',
      category: 'حوار',
      description: 'نقاشات راقية وتعارف بين نخبة أعضاء صَدَى مع بث صوتي فائق النقاء.',
      hostId: hostTariq.id,
      hostName: hostTariq.displayName,
      hostAvatar: hostTariq.avatarUrl,
      coverImage: 'royal_stage',
      isPrivate: false,
      maxSeats: 8,
      seats: seatsRoom1,
      listenersCount: 48,
      isActive: true,
      totalGiftsCoins: 14500,
      createdAt: now,
      messages: [
        {
          id: 'msg_seed_1',
          userId: hostTariq.id,
          displayName: hostTariq.displayName,
          level: hostTariq.level,
          isAdmin: false,
          text: 'أهلاً بكم في مجلس القصر الملكي، المايك متاح للمشاركين المبدعين.',
          type: 'chat',
          timestamp: now,
        },
        {
          id: 'msg_seed_2',
          userId: hostLayan.id,
          displayName: hostLayan.displayName,
          level: hostLayan.level,
          isAdmin: false,
          text: 'مساء النور والذهب على جميع الحضور في صَدَى.',
          type: 'chat',
          timestamp: now,
        },
      ],
    },
    {
      id: 'room_golden_voice',
      title: 'بطولة الصوت الذهبي · التصفيات المباشرة',
      category: 'مسابقات',
      description: 'منافسة مباشرة أمام لجنة التحكيم والجمهور لاختيار أجمل أداء صوتي.',
      hostId: hostLayan.id,
      hostName: hostLayan.displayName,
      hostAvatar: hostLayan.avatarUrl,
      coverImage: 'competition_crest',
      isPrivate: false,
      maxSeats: 6,
      seats: seatsRoom2,
      listenersCount: 92,
      isActive: true,
      totalGiftsCoins: 32800,
      createdAt: now,
      messages: [
        {
          id: 'msg_seed_3',
          userId: hostLayan.id,
          displayName: hostLayan.displayName,
          level: hostLayan.level,
          isAdmin: false,
          text: 'التصويت مفتوح الآن في ساحة المسابقات، صوّتوا لمتسابقكم المفضل!',
          type: 'chat',
          timestamp: now,
        },
      ],
    },
    {
      id: 'room_poetry_night',
      title: 'أمسية الشعر الفصيح والبيان العربي',
      category: 'شعر وأدب',
      description: 'قراءات شعرية ونبطية ومساجلات أدبية هادئة على أضواء المساء.',
      hostId: hostFaisal.id,
      hostName: hostFaisal.displayName,
      hostAvatar: hostFaisal.avatarUrl,
      coverImage: 'royal_stage',
      isPrivate: false,
      maxSeats: 8,
      seats: seatsRoom3,
      listenersCount: 31,
      isActive: true,
      totalGiftsCoins: 6400,
      createdAt: now,
      messages: [
        {
          id: 'msg_seed_4',
          userId: hostFaisal.id,
          displayName: hostFaisal.displayName,
          level: hostFaisal.level,
          isAdmin: false,
          text: 'مرحبًا بعشاق القوافي، من يفتتح الأمسية بأبيات من اختياره؟',
          type: 'chat',
          timestamp: now,
        },
      ],
    },
    {
      id: 'room_tarab_evening',
      title: 'ديوانية الطرب الأصيل والعود الشرقي',
      category: 'طرب',
      description: 'جلسات عزف وغناء حي بأجواء مخملية أصيلة.',
      hostId: hostTariq.id,
      hostName: hostTariq.displayName,
      hostAvatar: hostTariq.avatarUrl,
      coverImage: 'competition_crest',
      isPrivate: false,
      maxSeats: 6,
      seats: seatsRoom4,
      listenersCount: 64,
      isActive: true,
      totalGiftsCoins: 19200,
      createdAt: now,
      messages: [],
    },
  ];

  const competitions: Competition[] = [
    {
      id: 'comp_golden_voice_2026',
      title: 'بطولة الصوت الذهبي الكبرى',
      subtitle: 'المنافسة الرسمية لاختيار أفخم خامة صوتية وإلقاء عربي في صَدَى',
      category: 'الغناء والإلقاء',
      status: 'live',
      prizeCoins: 50000,
      prizeDiamonds: 25000,
      bannerImage: 'competition_crest',
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(),
      winnerId: null,
      contestants: [
        {
          id: 'cont_1',
          userId: hostLayan.id,
          displayName: hostLayan.displayName,
          avatarUrl: hostLayan.avatarUrl,
          level: hostLayan.level,
          performanceTitle: 'موشّح ليالي الأندلس',
          votes: 342,
          giftScore: 12400,
        },
        {
          id: 'cont_2',
          userId: hostTariq.id,
          displayName: hostTariq.displayName,
          avatarUrl: hostTariq.avatarUrl,
          level: hostTariq.level,
          performanceTitle: 'قصيدة المعلّقة الذهبية',
          votes: 298,
          giftScore: 9800,
        },
        {
          id: 'cont_3',
          userId: hostFaisal.id,
          displayName: hostFaisal.displayName,
          avatarUrl: hostFaisal.avatarUrl,
          level: hostFaisal.level,
          performanceTitle: 'مقام الحجاز المرتجل',
          votes: 215,
          giftScore: 6300,
        },
      ],
    },
    {
      id: 'comp_emir_bayan',
      title: 'تحدي أمير البيان والشعر',
      subtitle: 'مساجلة شعرية مباشرة أمام الجمهور لتتويج شاعر الموسم',
      category: 'الشعر والأدب',
      status: 'live',
      prizeCoins: 30000,
      prizeDiamonds: 15000,
      bannerImage: 'royal_stage',
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
      winnerId: null,
      contestants: [
        {
          id: 'cont_4',
          userId: hostFaisal.id,
          displayName: hostFaisal.displayName,
          avatarUrl: hostFaisal.avatarUrl,
          level: hostFaisal.level,
          performanceTitle: 'قافية الفجر الملكي',
          votes: 184,
          giftScore: 4100,
        },
        {
          id: 'cont_5',
          userId: hostLayan.id,
          displayName: hostLayan.displayName,
          avatarUrl: hostLayan.avatarUrl,
          level: hostLayan.level,
          performanceTitle: 'أرجوزة النجوم',
          votes: 162,
          giftScore: 3900,
        },
      ],
    },
  ];

  return {
    users: [hostTariq, hostLayan, hostFaisal],
    deviceLocks: {
      [hostTariq.device_uuid]: {
        device_uuid: hostTariq.device_uuid,
        boundUserId: hostTariq.id,
        boundEmail: hostTariq.email,
        isBlocked: false,
        blockedReason: null,
        createdAt: now,
        lastAttemptAt: now,
      },
      [hostLayan.device_uuid]: {
        device_uuid: hostLayan.device_uuid,
        boundUserId: hostLayan.id,
        boundEmail: hostLayan.email,
        isBlocked: false,
        blockedReason: null,
        createdAt: now,
        lastAttemptAt: now,
      },
      [hostFaisal.device_uuid]: {
        device_uuid: hostFaisal.device_uuid,
        boundUserId: hostFaisal.id,
        boundEmail: hostFaisal.email,
        isBlocked: false,
        blockedReason: null,
        createdAt: now,
        lastAttemptAt: now,
      },
    },
    securityLogs: [],
    rooms,
    competitions,
    transactions: [],
    privateMessages: [],
    agencies: [
      {
        id: 'agency_royal_divan',
        name: 'وكالة الديوان الملكي',
        description: 'الوكالة الرسمية الأولى في صَدَى لرعاية الأصوات الراقية والمضيفين المعتمدين.',
        code: 'SADA-1000',
        ownerId: hostTariq.id,
        ownerName: hostTariq.displayName,
        ownerAvatar: hostTariq.avatarUrl,
        commissionRate: 0.15,
        totalCommissionDiamonds: 1242,
        totalHostDiamonds: 8280,
        hostIds: [hostLayan.id, hostFaisal.id],
        status: 'approved',
        createdAt: now,
      },
    ],
    appPrizePoolCoins: INITIAL_APP_PRIZE_POOL_COINS,
    quizSessions: {},
    culturalQuestions: CULTURAL_QUESTIONS.map((q) => ({ ...q })),
    settings: createDefaultPlatformSettings(),
    usdtDeposits: [],
    usdtWithdrawals: [],
    sessions: {},
    votedKeys: {},
    femaleVoiceRequests: [],
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
      if (!Array.isArray(dbCache.culturalQuestions) || dbCache.culturalQuestions.length === 0) {
        dbCache.culturalQuestions = CULTURAL_QUESTIONS.map((q) => ({ ...q }));
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
    defaultQuestions: CULTURAL_QUESTIONS,
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
    defaultQuestions: CULTURAL_QUESTIONS,
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
