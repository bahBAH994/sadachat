import type {
  FrameItem,
  GiftItem,
  LuckyGiftMultiplierSetting,
  LuckyWheelSegment,
  PlatformSettings,
  RechargeRewardTierSetting,
  ReferralWheelSegment,
  RoomSeat,
  Store3DItem,
  StoreBackgroundItem,
  User,
  VipTierKey,
} from '../types';
import { safeGetItem, safeSetItem } from './safeStorage';

export const SUPER_ADMIN_EMAIL = 'bahaa.f36@gmail.com';
export const SUPER_ADMIN_EMAILS = [SUPER_ADMIN_EMAIL];

export function isSuperAdminUser(
  user: Pick<User, 'email' | 'role'> | null | undefined
): boolean {
  if (!user) return false;
  const email = String(user.email || '').trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.includes(email);
}

export const ADMIN_USDT_TRC20_ADDRESS = 'TFXPytN94bSAUzD893hjpSwp6DGWqGkGSa';
export const USDT_TO_COINS_RATE = 1000;
export const DIAMONDS_PER_USDT = 100;
export const COINS_PER_USDT_WITHDRAW = 1000;
export const MIN_WITHDRAW_USDT = 5;
export const PM_MESSAGE_COST = 150;
export const PM_REPLY_DIAMONDS = 38;
export const LUCKY_WHEEL_COST = 200;
export const INITIAL_APP_PRIZE_POOL_COINS = 0;

export const ARAB_COUNTRIES: Array<{ code: string; label: string; flag: string }> = [
  { code: 'SA', label: 'السعودية', flag: '🇸🇦' },
  { code: 'EG', label: 'مصر', flag: '🇪🇬' },
  { code: 'AE', label: 'الإمارات', flag: '🇦🇪' },
  { code: 'SY', label: 'سوريا', flag: '🇸🇾' },
  { code: 'IQ', label: 'العراق', flag: '🇮🇶' },
  { code: 'JO', label: 'الأردن', flag: '🇯🇴' },
  { code: 'KW', label: 'الكويت', flag: '🇰🇼' },
  { code: 'MA', label: 'المغرب', flag: '🇲🇦' },
  { code: 'LB', label: 'لبنان', flag: '🇱🇧' },
  { code: 'DZ', label: 'الجزائر', flag: '🇩🇿' },
];

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

export function genId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}_${rand}`;
}

export interface VipIdItem {
  id: string;
  number: string;
  title: string;
  badge: string;
  priceCoins: number;
  highlightClass: string;
}

export const VIP_IDS_CATALOG: VipIdItem[] = [
  { id: 'vip_id_100', number: '100', title: 'المئة الملكية', badge: '👑', priceCoins: 70000, highlightClass: 'from-amber-400 to-yellow-600' },
  { id: 'vip_id_111', number: '111', title: 'ثلاثية النور', badge: '✨', priceCoins: 65000, highlightClass: 'from-amber-300 to-amber-500' },
  { id: 'vip_id_222', number: '222', title: 'ثلاثية التاج', badge: '👑', priceCoins: 65000, highlightClass: 'from-rose-400 to-amber-400' },
  { id: 'vip_id_333', number: '333', title: 'ثلاثية الألماس', badge: '💎', priceCoins: 65000, highlightClass: 'from-sky-400 to-indigo-500' },
  { id: 'vip_id_444', number: '444', title: 'ثلاثية الفخامة', badge: '🏆', priceCoins: 65000, highlightClass: 'from-yellow-400 to-orange-500' },
  { id: 'vip_id_555', number: '555', title: 'ثلاثية الصقر', badge: '🦅', priceCoins: 65000, highlightClass: 'from-yellow-400 to-orange-500' },
  { id: 'vip_id_666', number: '666', title: 'ثلاثية المجد', badge: '⚜️', priceCoins: 65000, highlightClass: 'from-purple-400 to-pink-500' },
  { id: 'vip_id_777', number: '777', title: 'السلطان الملكي', badge: '👑', priceCoins: 85000, highlightClass: 'from-amber-400 to-yellow-600' },
  { id: 'vip_id_888', number: '888', title: 'ثلاثية الحظ', badge: '🍀', priceCoins: 65000, highlightClass: 'from-emerald-400 to-teal-500' },
  { id: 'vip_id_999', number: '999', title: 'التسعمئة الإمبراطورية', badge: '💠', priceCoins: 85000, highlightClass: 'from-sky-400 to-indigo-500' },
  { id: 'vip_id_1000', number: '1000', title: 'الأسطورة الذهبية', badge: '🏆', priceCoins: 35000, highlightClass: 'from-amber-300 to-amber-500' },
  { id: 'vip_id_1001', number: '1001', title: 'مرآة الألف', badge: '🪞', priceCoins: 28000, highlightClass: 'from-sky-400 to-indigo-500' },
  { id: 'vip_id_1111', number: '1111', title: 'الرباعية الملكية', badge: '👑', priceCoins: 40000, highlightClass: 'from-amber-400 to-yellow-600' },
  { id: 'vip_id_1221', number: '1221', title: 'انعكاس الصقر', badge: '🦅', priceCoins: 28000, highlightClass: 'from-yellow-400 to-orange-500' },
  { id: 'vip_id_2000', number: '2000', title: 'بداية الألفين', badge: '✨', priceCoins: 25000, highlightClass: 'from-emerald-400 to-teal-500' },
  { id: 'vip_id_2026', number: '2026', title: 'عام التميز', badge: '🌟', priceCoins: 35000, highlightClass: 'from-amber-300 to-amber-500' },
  { id: 'vip_id_2222', number: '2222', title: 'الرباعية الفضية', badge: '💠', priceCoins: 35000, highlightClass: 'from-sky-400 to-indigo-500' },
  { id: 'vip_id_3333', number: '3333', title: 'الرباعية المتلألئة', badge: '💎', priceCoins: 35000, highlightClass: 'from-sky-400 to-indigo-500' },
  { id: 'vip_id_4444', number: '4444', title: 'الرباعية الإمبراطورية', badge: '🏆', priceCoins: 45000, highlightClass: 'from-yellow-400 to-orange-500' },
  { id: 'vip_id_5555', number: '5555', title: 'الصقر الإمبراطوري', badge: '🦅', priceCoins: 30000, highlightClass: 'from-yellow-400 to-orange-500' },
  { id: 'vip_id_6666', number: '6666', title: 'الرباعية الأنيقة', badge: '⚜️', priceCoins: 35000, highlightClass: 'from-purple-400 to-pink-500' },
  { id: 'vip_id_7000', number: '7000', title: 'الفارس الإمبراطوري', badge: '🗡️', priceCoins: 12000, highlightClass: 'from-purple-400 to-pink-500' },
  { id: 'vip_id_7777', number: '7777', title: 'الرباعية السلطانية', badge: '👑', priceCoins: 45000, highlightClass: 'from-amber-400 to-yellow-600' },
  { id: 'vip_id_8888', number: '8888', title: 'الجوهرة المزدوجة', badge: '💠', priceCoins: 40000, highlightClass: 'from-rose-400 to-amber-400' },
  { id: 'vip_id_9000', number: '9000', title: 'قمة التسعة', badge: '🌟', priceCoins: 25000, highlightClass: 'from-amber-300 to-amber-500' },
  { id: 'vip_id_9090', number: '9090', title: 'توازن التسعة', badge: '✨', priceCoins: 28000, highlightClass: 'from-emerald-400 to-teal-500' },
  { id: 'vip_id_9999', number: '9999', title: 'التاج الماسي', badge: '💎', priceCoins: 45000, highlightClass: 'from-sky-400 to-indigo-500' },
  { id: 'vip_id_10101', number: '10101', title: 'خماسي المرآة', badge: '🪞', priceCoins: 18000, highlightClass: 'from-sky-400 to-indigo-500' },
  { id: 'vip_id_11111', number: '11111', title: 'الخماسي الملكي', badge: '👑', priceCoins: 25000, highlightClass: 'from-amber-400 to-yellow-600' },
  { id: 'vip_id_12345', number: '12345', title: 'التسلسل الفاخر', badge: '✨', priceCoins: 15000, highlightClass: 'from-emerald-400 to-teal-500' },
  { id: 'vip_id_20000', number: '20000', title: 'عشرون ألفاً', badge: '🏅', priceCoins: 12000, highlightClass: 'from-amber-300 to-amber-500' },
  { id: 'vip_id_22222', number: '22222', title: 'خماسي التاج', badge: '👑', priceCoins: 22000, highlightClass: 'from-rose-400 to-amber-400' },
  { id: 'vip_id_33333', number: '33333', title: 'خماسي الجوهرة', badge: '💎', priceCoins: 22000, highlightClass: 'from-sky-400 to-indigo-500' },
  { id: 'vip_id_44444', number: '44444', title: 'خماسي الفخامة', badge: '🏆', priceCoins: 22000, highlightClass: 'from-yellow-400 to-orange-500' },
  { id: 'vip_id_55555', number: '55555', title: 'الخماسي الإمبراطوري', badge: '🦅', priceCoins: 25000, highlightClass: 'from-yellow-400 to-orange-500' },
  { id: 'vip_id_66666', number: '66666', title: 'خماسي المجد', badge: '⚜️', priceCoins: 22000, highlightClass: 'from-purple-400 to-pink-500' },
  { id: 'vip_id_77777', number: '77777', title: 'خماسي السلطان', badge: '👑', priceCoins: 25000, highlightClass: 'from-amber-400 to-yellow-600' },
  { id: 'vip_id_88888', number: '88888', title: 'خماسي الحظ', badge: '💠', priceCoins: 25000, highlightClass: 'from-rose-400 to-amber-400' },
  { id: 'vip_id_90000', number: '90000', title: 'الرقم الملكي الأخير', badge: '🌟', priceCoins: 18000, highlightClass: 'from-amber-300 to-amber-500' },
  { id: 'vip_id_99999', number: '99999', title: 'الخماسي الأسطوري', badge: '🐉', priceCoins: 30000, highlightClass: 'from-purple-400 to-pink-500' },
];

export const SVIP_MEMBERSHIP_LEVELS = [
  { level: 1 as const, label: 'SVIP 1 البرونزي', priceCoins: 10_000, color: 'from-amber-700 to-amber-400', glyph: '🥉' },
  { level: 2 as const, label: 'SVIP 2 الفضي', priceCoins: 25_000, color: 'from-slate-400 to-slate-100', glyph: '🥈' },
  { level: 3 as const, label: 'SVIP 3 الذهبي', priceCoins: 60_000, color: 'from-yellow-700 to-yellow-300', glyph: '🥇' },
  { level: 4 as const, label: 'SVIP 4 الإمبراطوري', priceCoins: 150_000, color: 'from-amber-500 via-yellow-200 to-amber-600', glyph: '👑' },
];

let cachedCustomVipIds: Record<string, string> = {};

export function setCustomVipIdsCache(map: Record<string, string> | undefined | null): void {
  cachedCustomVipIds = map && typeof map === 'object' ? { ...map } : {};
}

export function getCustomVipIdsCache(): Record<string, string> {
  return cachedCustomVipIds;
}

export function getUserCustomVipId(userId: string): string | null {
  return cachedCustomVipIds[userId] || null;
}

export function formatShortNumericId(userId: string): string {
  if (userId && cachedCustomVipIds[userId]) {
    return cachedCustomVipIds[userId];
  }
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 33) ^ userId.charCodeAt(i);
  }
  const positive = Math.abs(hash) % 900000000;
  return String(100000000 + positive);
}

export function formatCompactMetric(value: number, upperCaseK = false): string {
  const num = Math.max(0, Number(value || 0));
  if (num === 0) return '0';
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}${upperCaseK ? 'K' : 'k'}`;
  }
  return String(Math.round(num));
}

export const STORE_LUXURY_BACKGROUNDS: StoreBackgroundItem[] = [
  {
    id: 'bg_royal_majlis',
    name: 'مجلس السلاطين الذهبي',
    subtitle: 'خلفية فخمة بتيجان وأقواس ذهبية وإضاءة قصور ملكية متوهجة',
    priceCoins: 5000,
    badgeGlyph: '👑',
    previewClass: 'bg-gradient-to-b from-[#1D1407] via-[#3A2508] to-[#0B0703]',
  },
  {
    id: 'bg_sapphire_crystal',
    name: 'قاعة الياقوت الكريستالية',
    subtitle: 'ألواح كريستال زرقاء متلألئة مع انعكاسات ألماسية ساطعة',
    priceCoins: 5000,
    badgeGlyph: '💠',
    previewClass: 'bg-gradient-to-b from-[#07142B] via-[#0F2A54] to-[#040814]',
  },
  {
    id: 'bg_emerald_palace',
    name: 'بلاط الزمرد الإمبراطوري',
    subtitle: 'ثريات زمردية فاخرة محفورة بالذهب الخالص للسهرات الراقية',
    priceCoins: 5000,
    badgeGlyph: '💚',
    previewClass: 'bg-gradient-to-b from-[#052319] via-[#0B3C2B] to-[#030D09]',
  },
  {
    id: 'bg_ruby_throne',
    name: 'عرش الياقوت الأحمر',
    subtitle: 'ستائر مخملية عنابية مرصعة بشهب ذهبية فارهة',
    priceCoins: 5000,
    badgeGlyph: '♦️',
    previewClass: 'bg-gradient-to-b from-[#2E0713] via-[#4C0D20] to-[#0C0307]',
  },
  {
    id: 'bg_celestial_gold',
    name: 'سماء المجرة الذهبية',
    subtitle: 'سديم كوني ملكي تتطاير فيه نجوم الذهب والألماس',
    priceCoins: 5000,
    badgeGlyph: '🌌',
    previewClass: 'bg-gradient-to-b from-[#140B2D] via-[#27144D] to-[#070412]',
  },
];

export const ROOM_BACKGROUNDS: Array<{
  id: string;
  name: string;
  description: string;
  previewClass: string;
  priceCoins?: number;
}> = [
  {
    id: 'dragon_dark',
    name: 'التنين الذهبي الداكن',
    description: 'الخلفية الملكية الافتراضية بتوهج التنين الذهبي',
    previewClass: 'bg-gradient-to-b from-[#17120A] via-[#2A1C08] to-[#080604]',
  },
  {
    id: 'competition_crest',
    name: 'ساحة المسابقات الذهبية',
    description: 'إطلالة الساحة الملكية للكبار',
    previewClass: 'bg-gradient-to-b from-[#1F1235] via-[#2E1E0B] to-[#090B16]',
  },
  ...STORE_LUXURY_BACKGROUNDS.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.subtitle,
    previewClass: b.previewClass,
    priceCoins: b.priceCoins,
  })),
];

export const ROOM_REACTION_EMOJIS: Array<{
  id: string;
  label: string;
  emoji: string;
  isDice?: boolean;
}> = [
  { id: 'heartbeat', label: 'قلب نابض', emoji: '💓' },
  { id: 'laugh', label: 'ضحك', emoji: '😂' },
  { id: 'clap', label: 'تصفيق', emoji: '👏' },
  { id: 'love', label: 'عيون قلوب', emoji: '😍' },
  { id: 'fire', label: 'نار', emoji: '🔥' },
  { id: 'star', label: 'نجمة', emoji: '⭐' },
  { id: 'crown', label: 'تاج', emoji: '👑' },
  { id: 'kiss', label: 'بوسة', emoji: '😘' },
  { id: 'dice', label: 'نرد عشوائي', emoji: '🎲', isDice: true },
];

export const GIFT_LEVEL_STEP_COINS = 500_000;

export function computeLevelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 120)) + 1);
}

export function computeGiftLevelStats(sentCoins: number, receivedCoins: number) {
  const safeSent = Math.max(0, Math.round(sentCoins || 0));
  const safeRec = Math.max(0, Math.round(receivedCoins || 0));

  const sendLevel = Math.floor(safeSent / GIFT_LEVEL_STEP_COINS) + 1;
  const sendInTier = safeSent % GIFT_LEVEL_STEP_COINS;
  const sendProgressPct = Math.min(
    100,
    Math.round((sendInTier / GIFT_LEVEL_STEP_COINS) * 100)
  );
  const sendRemainingCoins = GIFT_LEVEL_STEP_COINS - sendInTier;

  const receiveLevel = Math.floor(safeRec / GIFT_LEVEL_STEP_COINS) + 1;
  const recInTier = safeRec % GIFT_LEVEL_STEP_COINS;
  const receiveProgressPct = Math.min(
    100,
    Math.round((recInTier / GIFT_LEVEL_STEP_COINS) * 100)
  );
  const receiveRemainingCoins = GIFT_LEVEL_STEP_COINS - recInTier;

  return {
    sentCoins: safeSent,
    receivedCoins: safeRec,
    sendLevel,
    sendProgressPct,
    sendRemainingCoins,
    receiveLevel,
    receiveProgressPct,
    receiveRemainingCoins,
  };
}

export interface VipTierConfig {
  key: VipTierKey;
  rank: number;
  minScore: number;
  label: string;
  shortLabel: string;
  arabicTitle: string;
  badgeGlyph: string;
  badgeBgClass: string;
  badgeTextClass: string;
  progressBarClass: string;
}

export interface VipTierInfo extends VipTierConfig {
  score: number;
  nextTier: VipTierConfig | null;
  progressPct: number;
  coinsToNext: number;
}

export const VIP_TIER_CONFIGS: VipTierConfig[] = [
  {
    key: 'none',
    rank: 0,
    minScore: 0,
    label: 'عضو عادي',
    shortLabel: 'عضو',
    arabicTitle: 'عضوية صَدَى',
    badgeGlyph: '✦',
    badgeBgClass: 'bg-slate-700/70 border-slate-500/40',
    badgeTextClass: 'text-slate-200',
    progressBarClass: 'from-slate-400 to-slate-500',
  },
  {
    key: 'vip1',
    rank: 1,
    minScore: 100_000,
    label: 'VIP 1 البرونزي',
    shortLabel: 'VIP 1',
    arabicTitle: 'الإطار البرونزي المعدني',
    badgeGlyph: '🥉',
    badgeBgClass: 'bg-gradient-to-r from-[#8C5220] via-[#CD7F32] to-[#7C4418] border-[#F6C48B]/70',
    badgeTextClass: 'text-[#FFF2DE]',
    progressBarClass: 'from-[#A16227] via-[#D98B44] to-[#F3BE86]',
  },
  {
    key: 'vip2',
    rank: 2,
    minScore: 300_000,
    label: 'VIP 2 الفضي',
    shortLabel: 'VIP 2',
    arabicTitle: 'الإطار الفضي الكرومي',
    badgeGlyph: '🥈',
    badgeBgClass: 'bg-gradient-to-r from-[#475569] via-[#CBD5E1] to-[#64748B] border-white/80',
    badgeTextClass: 'text-[#0F172A]',
    progressBarClass: 'from-slate-300 via-sky-200 to-slate-400',
  },
  {
    key: 'vip3',
    rank: 3,
    minScore: 800_000,
    label: 'VIP 3 الملكي',
    shortLabel: 'VIP 3',
    arabicTitle: 'الإطار الذهبي الملكي',
    badgeGlyph: '👑',
    badgeBgClass: 'bg-gradient-to-r from-[#B45309] via-[#FDE047] to-[#D97706] border-[#FEF08A]',
    badgeTextClass: 'text-[#1F1202]',
    progressBarClass: 'from-amber-500 via-yellow-300 to-amber-400',
  },
  {
    key: 'svip',
    rank: 4,
    minScore: 2_000_000,
    label: 'SVIP الإمبراطوري',
    shortLabel: 'SVIP',
    arabicTitle: 'الإمبراطور الألماسي',
    badgeGlyph: '💎',
    badgeBgClass:
      'bg-gradient-to-r from-[#7C2D12] via-[#F59E0B] to-[#38BDF8] border-[#FEF08A] shadow-[0_0_16px_rgba(251,191,36,0.65)]',
    badgeTextClass: 'text-white',
    progressBarClass: 'from-rose-500 via-amber-300 to-sky-400',
  },
];

export function getVipTierConfig(key?: VipTierKey | null): VipTierConfig {
  return VIP_TIER_CONFIGS.find((c) => c.key === key) || VIP_TIER_CONFIGS[0];
}

export function getUserVipScore(
  user?: Partial<Pick<User, 'coins' | 'totalRecharged' | 'totalSpentCoins'>> | null
): number {
  if (!user) return 0;
  return Math.max(0, Math.round(Number(user.totalRecharged || 0)));
}

export function getVipTierFromScore(score: number): VipTierInfo {
  const safeScore = Math.max(0, Math.round(Number(score || 0)));
  let current = VIP_TIER_CONFIGS[0];
  let currentIdx = 0;

  for (let i = VIP_TIER_CONFIGS.length - 1; i >= 0; i--) {
    if (safeScore >= VIP_TIER_CONFIGS[i].minScore) {
      current = VIP_TIER_CONFIGS[i];
      currentIdx = i;
      break;
    }
  }

  const nextTier =
    currentIdx < VIP_TIER_CONFIGS.length - 1 ? VIP_TIER_CONFIGS[currentIdx + 1] : null;

  if (!nextTier) {
    return {
      ...current,
      score: safeScore,
      nextTier: null,
      progressPct: 100,
      coinsToNext: 0,
    };
  }

  const span = Math.max(1, nextTier.minScore - current.minScore);
  const gained = Math.max(0, safeScore - current.minScore);
  const progressPct = Math.min(100, Math.max(0, Math.round((gained / span) * 100)));
  const coinsToNext = Math.max(0, nextTier.minScore - safeScore);

  return {
    ...current,
    score: safeScore,
    nextTier,
    progressPct,
    coinsToNext,
  };
}

let cachedUserVipOverrides: Record<string, VipTierKey> = {};

export function setUserVipOverridesCache(map: Record<string, VipTierKey> | undefined | null): void {
  cachedUserVipOverrides = map && typeof map === 'object' ? { ...map } : {};
}

export function getUserVipOverridesCache(): Record<string, VipTierKey> {
  return cachedUserVipOverrides;
}

type VipTierUser = Partial<
  Pick<
    User,
    'id' | 'coins' | 'totalRecharged' | 'totalSpentCoins' | 'vipLevel' | 'svipLevel' | 'svipExpiresAt'
  >
>;

export function getUserVipTierInfo(
  user?: VipTierUser | null
): VipTierInfo {
  if (!user) return getVipTierFromScore(0);

  if (user.id && Object.prototype.hasOwnProperty.call(cachedUserVipOverrides, user.id)) {
    const overrideKey = cachedUserVipOverrides[user.id];
    if (overrideKey === 'none') {
      const nextTier = VIP_TIER_CONFIGS[1];
      return {
        ...VIP_TIER_CONFIGS[0],
        score: getUserVipScore(user),
        nextTier,
        progressPct: 0,
        coinsToNext: nextTier.minScore,
      };
    }
    const overrideCfg = getVipTierConfig(overrideKey);
    const nextTier =
      overrideCfg.rank < VIP_TIER_CONFIGS.length - 1
        ? VIP_TIER_CONFIGS[overrideCfg.rank + 1]
        : null;
    const score = Math.max(getUserVipScore(user), overrideCfg.minScore);
    return {
      ...overrideCfg,
      score,
      nextTier,
      progressPct: overrideKey === 'svip' ? 100 : 50,
      coinsToNext: nextTier ? Math.max(0, nextTier.minScore - score) : 0,
    };
  }

  const svipExpiry = user.svipExpiresAt ? new Date(user.svipExpiresAt).getTime() : 0;
  if (user.svipLevel && Number.isFinite(svipExpiry) && svipExpiry > Date.now()) {
    const svipConfig = getVipTierConfig('svip');
    return {
      ...svipConfig,
      score: Math.max(getUserVipScore(user), svipConfig.minScore),
      nextTier: null,
      progressPct: 100,
      coinsToNext: 0,
    };
  }

  const fromScore = getVipTierFromScore(getUserVipScore(user));
  if (user.vipLevel && user.vipLevel !== 'none') {
    const explicitCfg = getVipTierConfig(user.vipLevel);
    if (explicitCfg.rank > fromScore.rank) {
      return {
        ...explicitCfg,
        score: Math.max(fromScore.score, explicitCfg.minScore),
        nextTier:
          explicitCfg.rank < VIP_TIER_CONFIGS.length - 1
            ? VIP_TIER_CONFIGS[explicitCfg.rank + 1]
            : null,
        progressPct: explicitCfg.key === 'svip' ? 100 : fromScore.progressPct,
        coinsToNext:
          explicitCfg.key === 'svip'
            ? 0
            : Math.max(
                0,
                (VIP_TIER_CONFIGS[explicitCfg.rank + 1]?.minScore || 0) -
                  Math.max(fromScore.score, explicitCfg.minScore)
              ),
      };
    }
  }
  return fromScore;
}

export function parseVipTierKey(
  vipTierOrKey?: string | null,
  fallbackUser?: VipTierUser | null
): VipTierKey {
  if (vipTierOrKey) {
    const clean = vipTierOrKey.trim().toLowerCase();
    if (clean === 'svip' || clean.includes('svip') || clean.includes('إمبراطوري')) return 'svip';
    if (clean === 'vip3' || clean.includes('vip 3') || clean.includes('vip3')) return 'vip3';
    if (clean === 'vip2' || clean.includes('vip 2') || clean.includes('vip2')) return 'vip2';
    if (clean === 'vip1' || clean.includes('vip 1') || clean.includes('vip1')) return 'vip1';
  }
  if (fallbackUser) {
    return getUserVipTierInfo(fallbackUser).key;
  }
  return 'none';
}

export function getVipTierLabel(level: number, isAdmin = false): string {
  if (isAdmin) return 'VIP الإدارة العليا';
  if (level >= 25) return 'VIP إمبراطوري';
  if (level >= 15) return 'VIP ماسي';
  if (level >= 8) return 'VIP ذهبي';
  if (level >= 3) return 'VIP فضي';
  return 'VIP برونزي';
}

export function isFemaleVoiceLocked(
  user: Pick<User, 'gender' | 'is_admin' | 'femaleVoiceStatus'>
): boolean {
  return (
    user.gender === 'female' &&
    !user.is_admin &&
    user.femaleVoiceStatus !== 'verified'
  );
}

export function makeConversationId(userA: string, userB: string): string {
  return [userA, userB].sort().join('__');
}

const FIXED_GIFT_RAW: Array<{
  id: string;
  name: string;
  coinsCost: number;
  tier: 'classic' | 'royal' | 'imperial';
  glyph: string;
}> = [
  { id: 'gift_l1', name: 'وردة سريعة', coinsCost: 10, tier: 'classic', glyph: '🌹' },
  { id: 'gift_l2', name: 'فنجان ترحيب', coinsCost: 25, tier: 'classic', glyph: '☕' },
  { id: 'gift_l3', name: 'قلب دافئ', coinsCost: 50, tier: 'classic', glyph: '❤️' },
  { id: 'gift_l4', name: 'نجمة تقدير', coinsCost: 80, tier: 'classic', glyph: '⭐' },
  { id: 'gift_m1', name: 'إكليل المودة', coinsCost: 250, tier: 'classic', glyph: '🌺' },
  { id: 'gift_01', name: 'باقة ورد حمراء', coinsCost: 500, tier: 'classic', glyph: '💐' },
  { id: 'gift_m2', name: 'قنديل السهرة', coinsCost: 800, tier: 'classic', glyph: '🏮' },
  { id: 'gift_02', name: 'قلب ماسي', coinsCost: 1500, tier: 'royal', glyph: '💖' },
  { id: 'gift_03', name: 'تاج ملكي ذهبي', coinsCost: 5000, tier: 'royal', glyph: '👑' },
  { id: 'gift_04', name: 'صقر ذهبي', coinsCost: 12000, tier: 'royal', glyph: '🦅' },
  { id: 'gift_05', name: 'سيارة رياضية فاخرة', coinsCost: 30000, tier: 'royal', glyph: '🏎️' },
  { id: 'gift_06', name: 'يخت ملكي', coinsCost: 60000, tier: 'imperial', glyph: '🛥️' },
  { id: 'gift_07', name: 'قلعة الأحلام الملكية', coinsCost: 120000, tier: 'imperial', glyph: '🏰' },
  { id: 'gift_08', name: 'عود الطرب الشرقي', coinsCost: 15000, tier: 'classic', glyph: '🪕' },
  { id: 'gift_09', name: 'خنجر الفخر المذهّب', coinsCost: 18000, tier: 'classic', glyph: '🗡️' },
  { id: 'gift_10', name: 'ساعة القصر الليلية', coinsCost: 21000, tier: 'classic', glyph: '⌚' },
  { id: 'gift_11', name: 'بوابة الأندلس المضيئة', coinsCost: 25000, tier: 'royal', glyph: '🕌' },
  { id: 'gift_12', name: 'كأس النخبة الماسي', coinsCost: 35000, tier: 'royal', glyph: '🏆' },
  { id: 'gift_13', name: 'فنجان القهوة العربية', coinsCost: 2000, tier: 'classic', glyph: '☕' },
  { id: 'gift_14', name: 'مهر الأصالة العربي', coinsCost: 40000, tier: 'royal', glyph: '🐎' },
  { id: 'gift_15', name: 'مبخرة العود الفاخرة', coinsCost: 3500, tier: 'classic', glyph: '🪔' },
  { id: 'gift_16', name: 'عقد اللؤلؤ الخليجي', coinsCost: 52000, tier: 'royal', glyph: '🦪' },
  { id: 'gift_17', name: 'سيف العز الدمشقي', coinsCost: 65000, tier: 'royal', glyph: '⚔️' },
  { id: 'gift_18', name: 'قنديل السمر الذهبي', coinsCost: 8000, tier: 'classic', glyph: '🏮' },
  { id: 'gift_19', name: 'شعار المجد الذهبي', coinsCost: 76000, tier: 'royal', glyph: '⚜️' },
  { id: 'gift_20', name: 'سيارة القصر الفارهة', coinsCost: 85000, tier: 'royal', glyph: '🚘' },
  { id: 'gift_21', name: 'ألماسة زرقاء ملكية', coinsCost: 95000, tier: 'imperial', glyph: '💎' },
  { id: 'gift_22', name: 'مروحية كبار الشخصيات', coinsCost: 105000, tier: 'imperial', glyph: '🚁' },
  { id: 'gift_23', name: 'وسام الصوت العذب', coinsCost: 6000, tier: 'classic', glyph: '🎙️' },
  { id: 'gift_24', name: 'صاروخ صَدَى الأسطوري', coinsCost: 128000, tier: 'imperial', glyph: '🚀' },
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
  { id: 'lucky_15', name: 'مفتاح متجر السلاطين', coinsCost: 5800, tier: 'royal', glyph: '🗝️' },
  { id: 'lucky_16', name: 'نيزك الكوينز المضاعف', coinsCost: 6500, tier: 'imperial', glyph: '☄️' },
  { id: 'lucky_17', name: 'طاووس الحظ الإمبراطوري', coinsCost: 7500, tier: 'imperial', glyph: '🦚' },
  { id: 'lucky_18', name: 'بركان الذهب المتوهج', coinsCost: 8500, tier: 'imperial', glyph: '🌋' },
  { id: 'lucky_19', name: 'كرة الحظ الإمبراطورية', coinsCost: 9200, tier: 'imperial', glyph: '🪩' },
  { id: 'lucky_20', name: 'صندوق الحظ الأعظم', coinsCost: 10000, tier: 'imperial', glyph: '👑' },
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
  _multipliers?: LuckyGiftMultiplierSetting[]
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

const GIFT_CATALOG_STORAGE_KEY = 'sada_gift_catalog_v3';
const CUSTOM_GIFTS_STORAGE_KEY = 'sada_custom_gifts_v1';
let customGiftsCatalog: GiftItem[] = [];
let customGiftsLoadedFromStorage = false;
let cachedGiftCatalog: GiftItem[] | null = null;
let cachedGiftMap: Map<string, GiftItem> | null = null;

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

function hydrateCustomGiftsFromStorage(): GiftItem[] {
  if (customGiftsLoadedFromStorage) return customGiftsCatalog;
  customGiftsLoadedFromStorage = true;
  try {
    const raw = safeGetItem(CUSTOM_GIFTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GiftItem[];
      if (Array.isArray(parsed)) {
        customGiftsCatalog = parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return customGiftsCatalog;
}

export function setCustomGiftsCatalog(gifts: GiftItem[] | undefined | null): void {
  const safe = Array.isArray(gifts) ? gifts.filter((g) => Boolean(g?.id && g?.name)) : [];
  customGiftsCatalog = safe;
  customGiftsLoadedFromStorage = true;
  cachedGiftCatalog = null;
  cachedGiftMap = null;
  try {
    safeSetItem(CUSTOM_GIFTS_STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // ignore storage quota errors
  }
}

export function getCachedGiftCatalog(): GiftItem[] {
  if (cachedGiftCatalog) return cachedGiftCatalog;

  const customList = hydrateCustomGiftsFromStorage();
  if (customList.length === 0) {
    try {
      safeSetItem(GIFT_CATALOG_STORAGE_KEY, JSON.stringify(GIFT_CATALOG));
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }

  const customIds = new Set(customList.map((g) => g.id));
  cachedGiftCatalog = [...customList, ...GIFT_CATALOG.filter((g) => !customIds.has(g.id))];
  return cachedGiftCatalog;
}

export function findGiftById(giftId: string): GiftItem | undefined {
  if (!cachedGiftMap) {
    cachedGiftMap = new Map(getCachedGiftCatalog().map((g) => [g.id, g]));
  }
  return cachedGiftMap.get(giftId);
}

export type GiftEffectTier = 1 | 2 | 3;

export function getGiftEffectTier(coinsCost: number): GiftEffectTier {
  const safeCost = Math.max(0, Number(coinsCost || 0));
  if (safeCost < 100) return 1;
  if (safeCost < 1000) return 2;
  return 3;
}

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
    ringClass: 'ring-[3px] ring-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.75)]',
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
  {
    id: 'frame_car_luxury',
    name: 'السيارة الفارهة 3D',
    description: 'إطار ثلاثي الأبعاد متحرك + دخولية موكب السيارة عند شحن 1,000 كوينز.',
    priceCoins: 0,
    minLevel: 1,
    ringClass: 'ring-[3px] ring-emerald-400 shadow-[0_0_26px_rgba(16,185,129,0.75)]',
  },
  {
    id: 'frame_winged_falcon',
    name: 'الصقر المجنح 3D',
    description: 'هالة الصقر الذهبي المتحركة عند شحن 5,000 كوينز.',
    priceCoins: 0,
    minLevel: 1,
    ringClass: 'ring-[3px] ring-amber-400 animate-falcon-aura',
  },
  {
    id: 'frame_diamond_crown',
    name: 'التاج الألماسي 3D',
    description: 'تاج ألماسي دوّار ثلاثي الأبعاد + دخولية ملكية عند شحن 20,000 كوينز.',
    priceCoins: 0,
    minLevel: 1,
    ringClass: 'ring-[3px] ring-sky-400 animate-diamond-aura',
  },
  {
    id: 'frame_imperial_dragon',
    name: 'التنين الإمبراطوري 3D',
    description: 'أقوى إطار ودخولية ثلاثية الأبعاد متحركة عند شحن 50,000 كوينز.',
    priceCoins: 0,
    minLevel: 1,
    ringClass: 'ring-[4px] ring-amber-300 animate-dragon-aura',
  },
  {
    id: 'frame_emerald_aura',
    name: 'هالة الزمرد الملكية 3D',
    description: 'إطار زمردي متحرك ثلاثي الأبعاد يُشترى مباشرة بالكوينز.',
    priceCoins: 2500,
    minLevel: 1,
    ringClass: 'ring-[3px] ring-emerald-400 animate-falcon-aura',
  },
  {
    id: 'frame_royal_phoenix',
    name: 'طائر العنقاء الذهبي 3D',
    description: 'إطار لهب العنقاء المضيء ثلاثي الأبعاد يسطع على مقاعد البث.',
    priceCoins: 6000,
    minLevel: 1,
    ringClass: 'ring-[3px] ring-amber-400 animate-dragon-aura',
  },
  {
    id: 'frame_galaxy_sovereign',
    name: 'سيد المجرة الإمبراطوري 3D',
    description: 'إطار مجرة ثلاثي الأبعاد + دخولية السيارة الفارهة عند الشراء.',
    priceCoins: 12000,
    minLevel: 1,
    ringClass: 'ring-[4px] ring-violet-400 animate-diamond-aura',
  },
  {
    id: 'frame_host_gift_7d',
    name: 'إطار مهام المضيف (7 أيام)',
    description: 'هدية مجانية عند المواظبة 7 أيام متتالية في مهام المضيف.',
    priceCoins: 0,
    minLevel: 1,
    ringClass: 'ring-[3px] ring-rose-400 animate-diamond-aura',
    isTemporary: true,
  },
];

export const STORE_COIN_ITEMS: Store3DItem[] = [
  {
    id: 'frame_emerald_aura',
    name: 'هالة الزمرد الملكية 3D',
    subtitle: 'إطار زمردي دوّار ثلاثي الأبعاد يبرز هويتك داخل جميع الغرف',
    kind: 'frame',
    minRechargeCoins: 0,
    priceCoins: 2500,
    purchaseMode: 'coins',
    badgeGlyph: '💚',
    previewGradient: 'from-emerald-950 via-teal-900 to-slate-950',
    ringClass: 'ring-[3px] ring-emerald-400 animate-falcon-aura',
  },
  {
    id: 'frame_royal_phoenix',
    name: 'طائر العنقاء الذهبي 3D',
    subtitle: 'أجنحة العنقاء المتوهجة بلهب ذهبي متحرك على المايك والملف الشخصي',
    kind: 'frame',
    minRechargeCoins: 0,
    priceCoins: 6000,
    purchaseMode: 'coins',
    badgeGlyph: '🔥',
    previewGradient: 'from-orange-950 via-amber-900 to-slate-950',
    ringClass: 'ring-[3px] ring-amber-400 animate-dragon-aura',
  },
  {
    id: 'frame_galaxy_sovereign',
    name: 'سيد المجرة الإمبراطوري 3D',
    subtitle: 'إطار مجرة ثلاثي الأبعاد فائق البريق + دخولية السيارة الذهبية في الغرف',
    kind: 'frame_and_entry',
    minRechargeCoins: 0,
    priceCoins: 12000,
    purchaseMode: 'coins',
    badgeGlyph: '🌌',
    entryId: 'entry_car_15d',
    entryName: 'دخولية السيارة الفارهة 3D',
    previewGradient: 'from-violet-950 via-indigo-900 to-slate-950',
    ringClass: 'ring-[4px] ring-violet-400 animate-diamond-aura',
  },
];

export const STORE_3D_ITEMS: Store3DItem[] = [
  {
    id: 'frame_car_luxury',
    name: 'السيارة الفارهة 3D',
    subtitle: 'إطار ثلاثي الأبعاد متحرك + دخولية موكب السيارة الفارهة داخل الوكالة',
    kind: 'frame_and_entry',
    minRechargeCoins: 1000,
    purchaseMode: 'recharge',
    giftHint: 'مكافأة شحن تراكمي 1,000 كوينز',
    badgeGlyph: '🏎️',
    entryId: 'entry_car_15d',
    entryName: 'دخولية السيارة الفارهة 3D',
    previewGradient: 'from-emerald-950 via-teal-900 to-slate-950',
    ringClass: 'ring-[3px] ring-emerald-400 shadow-[0_0_26px_rgba(16,185,129,0.75)]',
  },
  {
    id: 'frame_winged_falcon',
    name: 'الصقر المجنح 3D',
    subtitle: 'هالة الصقر الذهبي المجنح بتوهج ملكي متواصل على مقاعد البث',
    kind: 'frame',
    minRechargeCoins: 5000,
    purchaseMode: 'recharge',
    giftHint: 'مكافأة شحن تراكمي 5,000 كوينز',
    badgeGlyph: '🦅',
    previewGradient: 'from-amber-950 via-stone-900 to-slate-950',
    ringClass: 'ring-[3px] ring-amber-400 animate-falcon-aura',
  },
  {
    id: 'frame_diamond_crown',
    name: 'التاج الألماسي 3D',
    subtitle: 'إطار التاج الألماسي الدوّار + دخولية ملكية متوهجة عند دخول الغرف',
    kind: 'frame_and_entry',
    minRechargeCoins: 20000,
    purchaseMode: 'recharge',
    giftHint: 'مكافأة شحن تراكمي 20,000 كوينز',
    badgeGlyph: '👑',
    entryId: 'entry_legendary_30d',
    entryName: 'دخولية التاج الألماسي 3D',
    previewGradient: 'from-indigo-950 via-sky-950 to-slate-950',
    ringClass: 'ring-[3px] ring-sky-400 animate-diamond-aura',
  },
  {
    id: 'frame_imperial_dragon',
    name: 'التنين الإمبراطوري 3D',
    subtitle: 'أيقونة الفخامة العليا: تنين ناري متحرك ثلاثي الأبعاد + دخولية إمبراطورية',
    kind: 'frame_and_entry',
    minRechargeCoins: 50000,
    purchaseMode: 'recharge',
    giftHint: 'مكافأة شحن تراكمي 50,000 كوينز',
    badgeGlyph: '🐉',
    entryId: 'entry_legendary_30d',
    entryName: 'دخولية التنين الإمبراطوري 3D',
    previewGradient: 'from-rose-950 via-amber-950 to-slate-950',
    ringClass: 'ring-[4px] ring-amber-300 animate-dragon-aura',
  },
  {
    id: 'frame_host_gift_7d',
    name: 'إطار مهام المضيف (7 أيام)',
    subtitle: 'إطار هدية مجاني يُفتح عند تسجيل الدخول 7 أيام متتالية في مهام المضيف',
    kind: 'frame',
    minRechargeCoins: 0,
    purchaseMode: 'gift',
    giftHint: 'مكافأة 7 أيام متتالية في مهام المضيف',
    badgeGlyph: '🎁',
    previewGradient: 'from-rose-950 via-pink-900 to-slate-950',
    ringClass: 'ring-[3px] ring-rose-400 animate-diamond-aura',
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

export const TEMP_ONLY_FRAME_IDS = new Set([
  'frame_silver_7d',
  'frame_gold_15d',
  'frame_royal_30d',
  'frame_host_gift_7d',
]);

export const REFERRAL_WHEEL_SEGMENTS: ReferralWheelSegment[] = [
  {
    id: 'ref_1',
    label: 'حظ أوفر في المحاولة القادمة',
    shortLabel: 'حظ أوفر',
    coinsAmount: 0,
    glyph: '🍀',
    weight: 26,
  },
  {
    id: 'ref_2',
    label: '250 كوينز ذهبية',
    shortLabel: '250 كوينز',
    coinsAmount: 250,
    glyph: '🪙',
    weight: 24,
  },
  {
    id: 'ref_3',
    label: '750 كوينز ملكية',
    shortLabel: '750 كوينز',
    coinsAmount: 750,
    glyph: '💰',
    weight: 18,
  },
  {
    id: 'ref_4',
    label: '2,000 كوينز فاخرة',
    shortLabel: '2,000 كوينز',
    coinsAmount: 2000,
    glyph: '✨',
    weight: 13,
  },
  {
    id: 'ref_5',
    label: '5,000 كوينز ذهبية',
    shortLabel: '5,000 كوينز',
    coinsAmount: 5000,
    glyph: '🎁',
    weight: 9,
  },
  {
    id: 'ref_6',
    label: '12,000 كوينز ماسية',
    shortLabel: '12,000 كوينز',
    coinsAmount: 12000,
    glyph: '🏆',
    weight: 5,
  },
  {
    id: 'ref_7',
    label: '25,000 كوينز إمبراطورية',
    shortLabel: '25,000 كوينز',
    coinsAmount: 25000,
    glyph: '👑',
    weight: 3,
  },
  {
    id: 'ref_8',
    label: 'الجائزة الكبرى · 50,000 كوينز',
    shortLabel: '50,000 كوينز',
    coinsAmount: 50000,
    glyph: '💎',
    weight: 2,
  },
];

export const LUCKY_WHEEL_SEGMENTS: LuckyWheelSegment[] = [
  {
    id: 'seg_1',
    label: '200 كوينز ذهبية',
    shortLabel: '200 كوينز',
    rewardType: 'coins',
    coinsAmount: 200,
    xpAmount: 20,
    glyph: '🪙',
  },
  {
    id: 'seg_2',
    label: 'إطار الهلال الذهبي المؤقت (24 ساعة)',
    shortLabel: 'إطار الهلال',
    rewardType: 'frame',
    frameId: 'frame_crescent',
    xpAmount: 60,
    glyph: '🌙',
  },
  {
    id: 'seg_3',
    label: '500 كوينز مضاعفة',
    shortLabel: '500 كوينز',
    rewardType: 'coins',
    coinsAmount: 500,
    xpAmount: 45,
    glyph: '💰',
  },
  {
    id: 'seg_4',
    label: '150 نقطة خبرة XP',
    shortLabel: '150 XP',
    rewardType: 'xp',
    xpAmount: 150,
    glyph: '⭐',
  },
  {
    id: 'seg_5',
    label: '1,000 كوينز ملكية',
    shortLabel: '1,000 كوينز',
    rewardType: 'coins',
    coinsAmount: 1000,
    xpAmount: 90,
    glyph: '👑',
  },
  {
    id: 'seg_6',
    label: 'إطار القصر الإمبراطوري المؤقت (24 ساعة)',
    shortLabel: 'إطار السلطان',
    rewardType: 'frame',
    frameId: 'frame_imperial',
    xpAmount: 120,
    glyph: '✨',
  },
  {
    id: 'seg_7',
    label: '300 نقطة خبرة XP',
    shortLabel: '300 XP',
    rewardType: 'xp',
    xpAmount: 300,
    glyph: '🔥',
  },
  {
    id: 'seg_8',
    label: 'الجائزة الكبرى · 2,500 كوينز',
    shortLabel: '2,500 كوينز',
    rewardType: 'coins',
    coinsAmount: 2500,
    xpAmount: 220,
    glyph: '💎',
  },
];

export const CULTURAL_QUESTIONS: CulturalQuestionItem[] = [];

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
    grandCompetition: {
      monthlyClosingPrizes: 'تُحدَّد جوائز الختام الشهري وفق إعلان الإدارة.',
      participationTerms: 'تُعلن شروط التأهل والمشاركة من إدارة المسابقة قبل بدء الدورة.',
      schedule: 'تُعلن مواعيد المسابقة وتحديثاتها عبر التطبيق.',
      totalSubscriptionsCoins: 0,
      prizePoolCoins: 0,
      platformCommissionCoins: 0,
      totalParticipationWeight: 0,
    },
    gameRates: {
      slotsWinRate: 26,
      doubleDiceWinRate: 38,
      predictionDiceWinRate: 36,
      ladderDiceWinRate: 44,
      speedDiceWinRate: 38,
      rouletteWinRate: 40,
      mysteryBoxWinRate: 36,
    },
  };
}

export function makeEmptySeats(count: number, host?: User): RoomSeat[] {
  const safeCount = Math.min(30, Math.max(5, count));
  const seats: RoomSeat[] = [];
  for (let i = 0; i < safeCount; i++) {
    if (i === 0 && host) {
      seats.push({
        seatIndex: 0,
        userId: host.id,
        displayName: host.displayName,
        avatarUrl: host.avatarUrl,
        frameId: host.frameId,
        level: host.level,
        vipLevel: getUserVipTierInfo(host).key,
        isMuted: false,
        isLocked: false,
        isSpeaking: false,
        receivedDiamonds: 0,
        femaleVerifiedBadge: host.femaleVerifiedBadge || null,
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

export interface GrandCompetitionConfig {
  title: string;
  subtitle: string;
  dateText: string;
  adminRoomTitle: string;
  prizes: Array<{ rank: string; reward: string; glyph: string; value: string }>;
  terms: string[];
  description: string;
}

export const DEFAULT_GRAND_COMPETITION: GrandCompetitionConfig = {
  title: 'مسابقة صَدَى الكبرى السنوية 2026',
  subtitle: 'أضخم حدث تنافسي للمسابقات الصوتية والثقافية وأعظم جوائز الكوينز الذهبية',
  dateText: 'تنطلق الجمعة القادمة الساعة 9:00 مساءً بتوقيت مكة المكرمة في روم الإدارة العامة',
  adminRoomTitle: 'ديوان الإدارة العامة',
  prizes: [
    { rank: 'المركز الأول', reward: '500,000 كوينز + درع صَدَى الذهبي + إطار التنين الإمبراطوري 3D', glyph: '🥇', value: '500,000 كوينز' },
    { rank: 'المركز الثاني', reward: '250,000 كوينز + تاج ملكي ذهبي + دخولية موكب السيارة', glyph: '🥈', value: '250,000 كوينز' },
    { rank: 'المركز الثالث', reward: '100,000 كوينز + وسام الصدارة + هالة الزمرد', glyph: '🥉', value: '100,000 كوينز' },
    { rank: 'المراكز 4 - 10', reward: '25,000 كوينز لكل فائز + دخولية خاصة لمدة 15 يوماً', glyph: '👑', value: '25,000 كوينز' },
  ],
  terms: [
    'المشاركة متاحة لجميع أعضاء منصة صَدَى الموثقين دون استثناء.',
    'تقام الجولات الحية بالكامل داخل روم الإدارة العامة بإشراف طاقم الإدارة العليا.',
    'تشمل المسابقة 3 مراحل: مناظرات صوتية، أسئلة ذكاء وسرعة مع مؤقت 8 ثوانٍ، وتصويت الجمهور الحي.',
    'تُسلَّم جميع الجوائز والأوسمة فوراً في نهاية الحفل الختامي داخل الغرفة.',
  ],
  description: 'حدث سنوي إمبراطوري يجمع نخبة المضيفين والوكلاء والجمهور للتنافس على أرفع ألقاب منصة صَدَى والجوائز الكبرى الموثقة.',
};
