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
} from '../types';

export const SUPER_ADMIN_EMAIL = 'bahaa.f36@gmail.com';
export const ADMIN_USDT_TRC20_ADDRESS = 'TFXPytN94bSAUzD893hjpSwp6DGWqGkGSa';
export const USDT_TO_COINS_RATE = 1000;
export const DIAMONDS_PER_USDT = 100;
export const COINS_PER_USDT_WITHDRAW = 1000;
export const MIN_WITHDRAW_USDT = 5;
export const PM_MESSAGE_COST = 50;
export const PM_REPLY_DIAMONDS = 38;
export const LUCKY_WHEEL_COST = 200;
export const INITIAL_APP_PRIZE_POOL_COINS = 250000;

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

export function formatShortNumericId(userId: string): string {
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
    id: 'royal_stage',
    name: 'الديوان الإمبراطوري',
    description: 'قصر عربي فاخر بإضاءة ذهبية دافئة',
    previewClass: 'bg-gradient-to-b from-[#161B33] via-[#2A1F0A] to-[#070913]',
  },
  {
    id: 'competition_crest',
    name: 'ساحة المسابقات الذهبية',
    description: 'إطلالة الساحة الملكية للكبار',
    previewClass: 'bg-gradient-to-b from-[#1F1235] via-[#2E1E0B] to-[#090B16]',
  },
  {
    id: 'emerald_palace',
    name: 'الزمرد الليلي',
    description: 'أجواء زمردية عميقة مع بريق ذهبي هادئ',
    previewClass: 'bg-gradient-to-b from-[#06221A] via-[#0B1922] to-[#050A0E]',
  },
  {
    id: 'crimson_throne',
    name: 'العرش الياقوتي',
    description: 'فخامة عنابية داكنة مع هالة ذهبية',
    previewClass: 'bg-gradient-to-b from-[#2A0B14] via-[#1B0C1C] to-[#09060A]',
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
  { id: 'laugh', label: 'ضحك', emoji: '😂' },
  { id: 'love', label: 'حب', emoji: '😍' },
  { id: 'clap', label: 'تصفيق', emoji: '👏' },
  { id: 'fire', label: 'نار', emoji: '🔥' },
  { id: 'shock', label: 'صدمة', emoji: '😱' },
  { id: 'crown', label: 'تاج', emoji: '👑' },
  { id: 'salute', label: 'تحية', emoji: '🫡' },
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
  { id: 'gift_01', name: 'وردة متوهجة', coinsCost: 500, tier: 'classic', glyph: '🌹' },
  { id: 'gift_02', name: 'قلب ماسي', coinsCost: 1500, tier: 'classic', glyph: '💖' },
  { id: 'gift_03', name: 'تاج ملكي', coinsCost: 5000, tier: 'royal', glyph: '👑' },
  { id: 'gift_04', name: 'صقر ذهبي', coinsCost: 12000, tier: 'royal', glyph: '🦅' },
  { id: 'gift_05', name: 'سيارة رياضية', coinsCost: 30000, tier: 'royal', glyph: '🏎️' },
  { id: 'gift_06', name: 'يخت ملكي', coinsCost: 60000, tier: 'imperial', glyph: '🛥️' },
  { id: 'gift_07', name: 'قصر الأحلام', coinsCost: 120000, tier: 'imperial', glyph: '🏰' },
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
  { id: 'gift_21', name: 'جوهرة الياقوت الأزرق', coinsCost: 95000, tier: 'imperial', glyph: '💠' },
  { id: 'gift_22', name: 'مروحية كبار الشخصيات', coinsCost: 105000, tier: 'imperial', glyph: '🚁' },
  { id: 'gift_23', name: 'وسام الصوت العذب', coinsCost: 6000, tier: 'classic', glyph: '🎙️' },
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
  { id: 'lucky_15', name: 'مفتاح متجر السلاطين', coinsCost: 5800, tier: 'royal', glyph: '🗝️' },
  { id: 'lucky_16', name: 'نيزك الكوينز المضاعف', coinsCost: 6500, tier: 'imperial', glyph: '☄️' },
  { id: 'lucky_17', name: 'طاووس الحظ الإمبراطوري', coinsCost: 7500, tier: 'imperial', glyph: '🦚' },
  { id: 'lucky_18', name: 'بركان الذهب المتوهج', coinsCost: 8500, tier: 'imperial', glyph: '🌋' },
  { id: 'lucky_19', name: 'كرة الحظ الإمبراطورية', coinsCost: 9200, tier: 'imperial', glyph: '🪩' },
  { id: 'lucky_20', name: 'صندوق الحظ الأعظم', coinsCost: 10000, tier: 'imperial', glyph: '👑' },
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
