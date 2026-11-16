import type {
  FrameItem,
  GiftItem,
  LuckyGiftMultiplierSetting,
  LuckyWheelSegment,
  PlatformSettings,
  RechargeRewardTierSetting,
  ReferralWheelSegment,
  RoomSeat,
  User,
} from '../types';

export const SUPER_ADMIN_EMAIL = 'bahaa.f36@gmail.com';
export const ADMIN_USDT_TRC20_ADDRESS = 'TFXPytN94bSAUzD893hjpSwp6DGWqGkGSa';
export const USDT_TO_COINS_RATE = 1000;
export const DIAMONDS_PER_USDT = 100;
export const COINS_PER_USDT_WITHDRAW = 1000;
export const MIN_WITHDRAW_USDT = 5;
export const PM_MESSAGE_COST = 150;
export const PM_REPLY_DIAMONDS = 115;
export const LUCKY_WHEEL_COST = 200;
export const INITIAL_APP_PRIZE_POOL_COINS = 250000;

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

export function computeLevelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 120)) + 1);
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

export function makeEmptySeats(count: number, host?: User): RoomSeat[] {
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
