import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Coins,
  Crown,
  Dices,
  Disc3,
  Flame,
  Gamepad2,
  History,
  Info,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wallet,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getLadderStateFromSupabase,
  openMysteryBoxInSupabase,
  playLadderActionInSupabase,
  playStandardDiceInSupabase,
  spinRouletteInSupabase,
  spinSlotMachineInSupabase,
} from '../lib/sadaGamesService';
import type { User } from '../types';

type CenterCategory = 'slots' | 'dice' | 'roulette' | 'mystery';

type SlotGameId =
  | 'classic_fruits'
  | 'pharaoh_treasures'
  | 'neon_galaxy'
  | 'crown_jewels'
  | 'olympus_gates'
  | 'sea_pirates'
  | 'turbo_racing'
  | 'desert_gold';

type DiceGameId = 'double_dice' | 'prediction_dice' | 'ladder_dice' | 'speed_dice';

type RouletteBetType =
  | 'red'
  | 'black'
  | 'even'
  | 'odd'
  | 'dozen_1'
  | 'dozen_2'
  | 'dozen_3'
  | 'zero'
  | 'straight';

interface SlotMachineConfig {
  id: SlotGameId;
  title: string;
  subtitle: string;
  badge: string;
  cols: number;
  rows: number;
  maxMultiplier: string;
  symbols: string[];
  specialRuleTitle: string;
  specialRuleDesc: string;
  paytable: Array<{ combo: string; mult: string; note?: string }>;
  cardGradient: string;
  cabinetClass: string;
  headerGradient: string;
  reelCellBg: string;
  winCellGlow: string;
  accentText: string;
  spinButtonClass: string;
}

const SLOT_MACHINES: SlotMachineConfig[] = [
  {
    id: 'classic_fruits',
    title: 'سلوت الفواكه الكلاسيكي',
    subtitle: '5 خطوط ربح (أفقية وقطرية) + قاعدة الكرز الذهبي',
    badge: '3×3 كلاسيكي',
    cols: 3,
    rows: 3,
    maxMultiplier: '×30',
    symbols: ['🍒', '🍋', '🍇', '🔔', '⭐', '7️⃣'],
    specialRuleTitle: 'ثنائي الكرز الذهبي (×1.5)',
    specialRuleDesc:
      'بالإضافة إلى الـ 5 خطوط (3 صفوف + القطرين)، ظهور كرزتين 🍒 في الصف الأوسط يمنحك ربحاً فورياً ×1.5.',
    paytable: [
      { combo: '7️⃣ 7️⃣ 7️⃣', mult: '×30', note: 'الجاكبوت الكلاسيكي' },
      { combo: '⭐ ⭐ ⭐', mult: '×15' },
      { combo: '🔔 🔔 🔔', mult: '×10' },
      { combo: '🍇 🍇 🍇', mult: '×6' },
      { combo: '🍋 🍋 🍋', mult: '×4' },
      { combo: '🍒 🍒 🍒', mult: '×3', note: 'وثنائي الوسط ×1.5' },
    ],
    cardGradient: 'from-[#3A0C1B]/90 via-[#190A16]/95 to-[#2D1808]/90',
    cabinetClass:
      'border-rose-400/45 bg-gradient-to-b from-[#2B0A15]/92 via-[#150814]/96 to-[#211208]/92 shadow-[0_0_38px_rgba(244,63,94,0.22)]',
    headerGradient: 'from-rose-500/25 via-amber-500/15 to-transparent',
    reelCellBg: 'bg-[#120610]/90 border-rose-400/25',
    winCellGlow:
      'border-[#FCE9A6] bg-gradient-to-b from-rose-500/35 to-[#D4AF37]/30 shadow-[0_0_24px_rgba(244,63,94,0.55)] scale-[1.04]',
    accentText: 'text-rose-200',
    spinButtonClass:
      'bg-gradient-to-r from-rose-500 via-[#D4AF37] to-amber-400 text-[#070913] shadow-[0_0_24px_rgba(244,63,94,0.45)]',
  },
  {
    id: 'pharaoh_treasures',
    title: 'كنوز الفراعنة',
    subtitle: 'معبد النيل المقدس + جعران الحظ المتناثر في أي خانة',
    badge: '3×3 فرعوني',
    cols: 3,
    rows: 3,
    maxMultiplier: '×32',
    symbols: ['🏺', '🐍', '⚱️', '☀️', '👁️', '🪲'],
    specialRuleTitle: 'جعران الحظ المتناثر (Scatter 🪲)',
    specialRuleDesc:
      'لا يشترط الجعران 🪲 الاصطفاف! ظهوره مرتين في أي مكان باللوحة يربح ×2.5، و3 مرات ×12، و4+ يربح ×25.',
    paytable: [
      { combo: '👁️ 👁️ 👁️', mult: '×32', note: 'عين حورس الملكية' },
      { combo: '☀️ ☀️ ☀️', mult: '×18', note: 'قرص الشمس الذهبي' },
      { combo: '🪲 متناثر', mult: '×2.5 – ×25', note: 'في أي مكان باللوحة' },
      { combo: '⚱️ ⚱️ ⚱️', mult: '×9' },
      { combo: '🐍 🐍 🐍', mult: '×6' },
      { combo: '🏺 🏺 🏺', mult: '×3' },
    ],
    cardGradient: 'from-[#2D1F08]/95 via-[#140E05]/95 to-[#291B07]/95',
    cabinetClass:
      'border-[#F3D37A]/55 bg-gradient-to-b from-[#251A07]/95 via-[#120D05]/98 to-[#241706]/95 shadow-[0_0_40px_rgba(212,175,55,0.28)]',
    headerGradient: 'from-[#D4AF37]/30 via-amber-700/15 to-transparent',
    reelCellBg: 'bg-[#0F0A04]/90 border-[#D4AF37]/30',
    winCellGlow:
      'border-[#FCE9A6] bg-gradient-to-b from-[#D4AF37]/40 to-amber-700/35 shadow-[0_0_26px_rgba(252,233,166,0.65)] scale-[1.04]',
    accentText: 'text-[#FCE9A6]',
    spinButtonClass:
      'bg-gradient-to-r from-[#FCE9A6] via-[#D4AF37] to-amber-500 text-[#070913] shadow-[0_0_26px_rgba(212,175,55,0.5)]',
  },
  {
    id: 'neon_galaxy',
    title: 'مجرة النيون',
    subtitle: 'مصفوفة 5 بكرات كونية + رمز البرق Wild مضاعف ×2',
    badge: '5×3 نيون',
    cols: 5,
    rows: 3,
    maxMultiplier: '×100',
    symbols: ['👾', '☄️', '🌌', '🪐', '🛸', '⚡'],
    specialRuleTitle: 'البرق الكوني (Wild ⚡ ×2)',
    specialRuleDesc:
      'يستبدل رمز ⚡ أي رمز آخر على خطوط الدفع الـ 4 (من اليسار لليمين 3 أو 4 أو 5 رموز) ويضاعف الربح فوراً ×2!',
    paytable: [
      { combo: '🛸 ×5 (مع ⚡)', mult: '×100', note: 'انفجار المجرة الأعلى' },
      { combo: '🛸 ×3 / ×4 / ×5', mult: '×10 / ×25 / ×50' },
      { combo: '🪐 ×3 / ×4 / ×5', mult: '×6 / ×16 / ×36' },
      { combo: '🌌 ×3 / ×4 / ×5', mult: '×4 / ×11 / ×28' },
      { combo: '☄️ ×3 / ×4 / ×5', mult: '×3 / ×8 / ×20' },
      { combo: '⚡ بديل مضاعف', mult: '×2 إضافي', note: 'يُضاعف أي خط يدخل فيه' },
    ],
    cardGradient: 'from-[#061838]/95 via-[#13082C]/95 to-[#062235]/95',
    cabinetClass:
      'border-cyan-400/50 bg-gradient-to-b from-[#071330]/95 via-[#100726]/98 to-[#061B2E]/95 shadow-[0_0_42px_rgba(34,211,238,0.26)]',
    headerGradient: 'from-cyan-500/25 via-fuchsia-500/15 to-transparent',
    reelCellBg: 'bg-[#050B1F]/90 border-cyan-400/25',
    winCellGlow:
      'border-cyan-300 bg-gradient-to-b from-cyan-500/35 to-fuchsia-500/30 shadow-[0_0_24px_rgba(34,211,238,0.65)] scale-[1.04]',
    accentText: 'text-cyan-200',
    spinButtonClass:
      'bg-gradient-to-r from-cyan-400 via-sky-300 to-fuchsia-400 text-[#070913] shadow-[0_0_26px_rgba(34,211,238,0.48)]',
  },
  {
    id: 'crown_jewels',
    title: 'جواهر التاج',
    subtitle: 'خزنة الزمرد والياقوت (4×3) + ربح الأعمدة الملكية الكاملة',
    badge: '4×3 إمبراطوري',
    cols: 4,
    rows: 3,
    maxMultiplier: '×55',
    symbols: ['🔮', '⚜️', '💍', '🏆', '💎', '👑'],
    specialRuleTitle: 'الأعمدة الإمبراطورية + الرباعيات',
    specialRuleDesc:
      'تربح عند تطابق 3 أو 4 رموز متتالية في أي صف، وعند اكتمال أي عمود عمودي بالكامل تحصد مكافأة التاج (+×15 للتيجان)!',
    paytable: [
      { combo: '👑 👑 👑 👑', mult: '×55', note: 'تاج الإمبراطور الأعظم' },
      { combo: '💎 💎 💎 💎', mult: '×38', note: 'الألماسة الزرقاء النادرة' },
      { combo: '🏆 ×3 / ×4', mult: '×8 / ×26' },
      { combo: '💍 ×3 / ×4', mult: '×5 / ×18' },
      { combo: '⚜️ ×3 / ×4', mult: '×3.5 / ×12' },
      { combo: 'عمود عمودي كامل', mult: '×4 – ×15', note: 'أرباح مكدسة فورية' },
    ],
    cardGradient: 'from-[#0B173D]/95 via-[#140E2E]/95 to-[#221038]/95',
    cabinetClass:
      'border-indigo-300/50 bg-gradient-to-b from-[#0C183B]/95 via-[#120E2B]/98 to-[#221336]/95 shadow-[0_0_42px_rgba(129,140,248,0.28)]',
    headerGradient: 'from-indigo-500/25 via-[#D4AF37]/20 to-transparent',
    reelCellBg: 'bg-[#080E26]/90 border-indigo-300/25',
    winCellGlow:
      'border-[#FCE9A6] bg-gradient-to-b from-indigo-500/40 to-[#D4AF37]/35 shadow-[0_0_26px_rgba(165,180,252,0.65)] scale-[1.04]',
    accentText: 'text-indigo-200',
    spinButtonClass:
      'bg-gradient-to-r from-[#FCE9A6] via-indigo-300 to-[#D4AF37] text-[#070913] shadow-[0_0_26px_rgba(165,180,252,0.45)]',
  },
  {
    id: 'olympus_gates',
    title: 'بوابات الأوليمبوس',
    subtitle: 'ساحة زيوس 5×4 بنظام التجمّع الحر + صواعق المضاعفات العشوائية',
    badge: '5×4 أسطوري ⚡',
    cols: 5,
    rows: 4,
    maxMultiplier: '×500+',
    symbols: ['🏛️', '⏳', '💍', '🏆', '👑', '⚡'],
    specialRuleTitle: 'صواعق زيوس العشوائية (⚡ ×2 إلى ×25)',
    specialRuleDesc:
      'تربح عند تجمّع 5 رموز متشابهة أو أكثر في أي مكان باللوحة! وتُطلق كل صاعقة ⚡ مضاعفاً عشوائياً (×2 حتى ×25) يُجمع ويُضرب في كامل ربح الدورة.',
    paytable: [
      { combo: '⚡ صواعق زيوس', mult: '×2 – ×25 لكل صاعقة', note: 'تُجمع وتضاعف كامل الربح' },
      { combo: '👑 ×5 / ×7 / ×9+', mult: '×5 / ×16 / ×45' },
      { combo: '🏆 ×5 / ×7 / ×9+', mult: '×3.5 / ×11 / ×30' },
      { combo: '💍 ×5 / ×7 / ×9+', mult: '×2.5 / ×8 / ×22' },
      { combo: '⏳ ×5 / ×7 / ×9+', mult: '×2 / ×6 / ×16' },
      { combo: '🏛️ ×5 / ×7 / ×9+', mult: '×1.5 / ×4 / ×12' },
    ],
    cardGradient: 'from-[#2A1459]/95 via-[#131036]/95 to-[#33220B]/95',
    cabinetClass:
      'border-violet-300/55 bg-gradient-to-b from-[#23124A]/95 via-[#0E102E]/98 to-[#2B1F09]/95 shadow-[0_0_44px_rgba(167,139,250,0.34)]',
    headerGradient: 'from-violet-500/30 via-[#FCE9A6]/20 to-transparent',
    reelCellBg: 'bg-[#0C0A24]/90 border-violet-300/25',
    winCellGlow:
      'border-[#FCE9A6] bg-gradient-to-b from-violet-500/40 to-[#D4AF37]/40 shadow-[0_0_28px_rgba(252,233,166,0.72)] scale-[1.04]',
    accentText: 'text-violet-200',
    spinButtonClass:
      'bg-gradient-to-r from-violet-400 via-[#FCE9A6] to-[#D4AF37] text-[#070913] shadow-[0_0_28px_rgba(167,139,250,0.52)]',
  },
  {
    id: 'sea_pirates',
    title: 'قراصنة البحار',
    subtitle: 'أسطول الأعماق (5×3) + صندوق الكنز Wild وقصف المدافع المتفجر',
    badge: '5×3 بحري 🏴‍☠️',
    cols: 5,
    rows: 3,
    maxMultiplier: '×78',
    symbols: ['⚓', '🧭', '🦜', '🏴‍☠️', '💣', '💰'],
    specialRuleTitle: 'صندوق الكنز 💰 + قصف المدافع 💣',
    specialRuleDesc:
      'يستبدل صندوق الكنز 💰 أي رمز على 5 خطوط إبحار (الصفوف + V + Λ)، وظهور 3 قنابل مدفع 💣 في أي مكان يمنح غنيمة فورية (+×4 إلى ×18)!',
    paytable: [
      { combo: '💰 ×3 / ×4 / ×5', mult: '×10 / ×24 / ×60', note: 'صندوق الكنز Wild' },
      { combo: '🏴‍☠️ ×3 / ×4 / ×5', mult: '×6 / ×18 / ×42' },
      { combo: '🦜 ×3 / ×4 / ×5', mult: '×4 / ×11 / ×28' },
      { combo: '🧭 ×3 / ×4 / ×5', mult: '×3 / ×8 / ×20' },
      { combo: '⚓ ×3 / ×4 / ×5', mult: '×2 / ×5 / ×14' },
      { combo: '💣 ×3 / ×4 / ×5+ متناثر', mult: '+×4 / +×9 / +×18', note: 'قصف المدافع الذهبي' },
    ],
    cardGradient: 'from-[#062836]/95 via-[#071526]/95 to-[#241A0B]/95',
    cabinetClass:
      'border-teal-400/50 bg-gradient-to-b from-[#062430]/95 via-[#081322]/98 to-[#1D1508]/95 shadow-[0_0_40px_rgba(45,212,191,0.24)]',
    headerGradient: 'from-teal-500/25 via-amber-500/15 to-transparent',
    reelCellBg: 'bg-[#04131D]/90 border-teal-400/25',
    winCellGlow:
      'border-[#FCE9A6] bg-gradient-to-b from-teal-500/35 to-[#D4AF37]/35 shadow-[0_0_26px_rgba(45,212,191,0.58)] scale-[1.04]',
    accentText: 'text-teal-200',
    spinButtonClass:
      'bg-gradient-to-r from-teal-300 via-[#FCE9A6] to-[#D4AF37] text-[#070913] shadow-[0_0_24px_rgba(45,212,191,0.45)]',
  },
  {
    id: 'turbo_racing',
    title: 'سباق السيارات',
    subtitle: 'حلبة التوربو الليلية (4×3) + شعلات نايترو تضاعف سرعة الأرباح',
    badge: '4×3 توربو 🏎️',
    cols: 4,
    rows: 3,
    maxMultiplier: '×80+',
    symbols: ['🛞', '⛽', '🏁', '🏆', '🔥', '🏎️'],
    specialRuleTitle: 'شعلة النايترو 🔥 (+50% للرمز) + الجائزة الكبرى',
    specialRuleDesc:
      'كل شعلة نايترو 🔥 تظهر في صف رابح تزيد ربحه بنسبة +50% فورياً! وظهور 3 أو 4 سيارات 🏎️ في أي مكان يمنح مكافأة انطلاقة الجائزة الكبرى.',
    paytable: [
      { combo: '🏎️ 🏎️ 🏎️ 🏎️', mult: '×50', note: 'انطلاقة الجائزة الكبرى' },
      { combo: '🏆 ×3 / ×4', mult: '×8 / ×26' },
      { combo: '🏁 ×3 / ×4', mult: '×5 / ×16' },
      { combo: '⛽ ×3 / ×4', mult: '×3.5 / ×10' },
      { combo: '🛞 ×3 / ×4', mult: '×2.5 / ×7' },
      { combo: '🔥 نايترو + 🏎️ متناثر', mult: '+50% و +×14', note: 'مضاعفات توربو متراكمة' },
    ],
    cardGradient: 'from-[#36090B]/95 via-[#101320]/95 to-[#2D1506]/95',
    cabinetClass:
      'border-orange-400/50 bg-gradient-to-b from-[#2B0A0C]/95 via-[#0B0E1A]/98 to-[#261206]/95 shadow-[0_0_40px_rgba(249,115,22,0.26)]',
    headerGradient: 'from-orange-500/25 via-rose-500/15 to-transparent',
    reelCellBg: 'bg-[#11090B]/90 border-orange-400/25',
    winCellGlow:
      'border-orange-300 bg-gradient-to-b from-orange-500/35 to-[#D4AF37]/35 shadow-[0_0_26px_rgba(249,115,22,0.6)] scale-[1.04]',
    accentText: 'text-orange-200',
    spinButtonClass:
      'bg-gradient-to-r from-orange-400 via-amber-300 to-rose-400 text-[#070913] shadow-[0_0_24px_rgba(249,115,22,0.48)]',
  },
  {
    id: 'desert_gold',
    title: 'ذهب الصحراء',
    subtitle: 'واحة الرمال العربية (3×3) + مضاعفة المصباح السحري الأوسط ×2',
    badge: '3×3 صحراوي 🏜️',
    cols: 3,
    rows: 3,
    maxMultiplier: '×64',
    symbols: ['🌴', '🐪', '🗡️', '🏜️', '🪔', '🪙'],
    specialRuleTitle: 'مصباح الواحة 🪔 (×2) + كنز الدنانير 🪙',
    specialRuleDesc:
      '5 خطوط ربح عربية، وإذا استقر المصباح السحري 🪔 في الخانة الوسطى عند أي فوز يتضاعف ربح الدورة بالكامل ×2! و3+ دنانير 🪙 تربح من أي مكان.',
    paytable: [
      { combo: '🪙 🪙 🪙', mult: '×32', note: 'ومبعثر 3+ يربح ×3.5–×12' },
      { combo: '🪔 🪔 🪔', mult: '×24', note: 'في المنتصف يضاعف الربح ×2' },
      { combo: '🏜️ 🏜️ 🏜️', mult: '×16' },
      { combo: '🗡️ 🗡️ 🗡️', mult: '×9' },
      { combo: '🐪 🐪 🐪', mult: '×5' },
      { combo: '🌴 🌴 🌴', mult: '×3' },
    ],
    cardGradient: 'from-[#2E1B07]/95 via-[#181007]/95 to-[#0B231B]/95',
    cabinetClass:
      'border-amber-400/55 bg-gradient-to-b from-[#291807]/95 via-[#140E07]/98 to-[#0B1F18]/95 shadow-[0_0_40px_rgba(245,158,11,0.28)]',
    headerGradient: 'from-amber-500/25 via-emerald-600/15 to-transparent',
    reelCellBg: 'bg-[#120B05]/90 border-amber-400/30',
    winCellGlow:
      'border-[#FCE9A6] bg-gradient-to-b from-amber-500/40 to-emerald-600/30 shadow-[0_0_26px_rgba(251,191,36,0.65)] scale-[1.04]',
    accentText: 'text-amber-200',
    spinButtonClass:
      'bg-gradient-to-r from-[#FCE9A6] via-amber-400 to-emerald-300 text-[#070913] shadow-[0_0_24px_rgba(245,158,11,0.48)]',
  },
];

const BET_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

const ROULETTE_WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16,
  33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const ROULETTE_REDS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const LADDER_TIERS = [
  { step: 1, mult: 1.4, label: 'بداية الصعود' },
  { step: 2, mult: 2.2, label: 'البرج الفضي' },
  { step: 3, mult: 3.6, label: 'بوابة الذهب' },
  { step: 4, mult: 6.5, label: 'عقد الياقوت' },
  { step: 5, mult: 12.0, label: 'القمة الملكية' },
];

interface LightningStrike {
  row: number;
  col: number;
  mult: number;
}

interface SpinResultPayload {
  gameId: SlotGameId;
  bet: number;
  grid: string[][];
  cols: number;
  rows: number;
  multiplier: number;
  payout: number;
  netDelta: number;
  xpGain: number;
  winningCells: Array<[number, number]>;
  rulesTriggered: string[];
  lightningStrikes?: LightningStrike[];
  jackpotHit: boolean;
  user: User;
}

interface DicePlayResponse {
  gameId: 'double_dice' | 'prediction_dice' | 'speed_dice';
  bet: number;
  dice: number[];
  won: boolean;
  multiplier: number;
  payout: number;
  xpGain: number;
  label: string;
  user: User;
}

interface LadderSession {
  bet: number;
  step: number;
  currentMultiplier: number;
}

interface LadderActionResponse {
  status: 'climbed' | 'summit' | 'fell' | 'cashed_out';
  payout: number;
  multiplier: number;
  step: number;
  die: number;
  session: LadderSession | null;
  message: string;
  user: User;
}

interface RouletteSpinResponse {
  winningNumber: number;
  winningColor: 'red' | 'black' | 'green';
  wheelIndex: number;
  won: boolean;
  multiplier: number;
  payout: number;
  bet: number;
  xpGain: number;
  user: User;
}

interface MysteryBoxItem {
  index: number;
  multiplier: number;
  coins: number;
  label: string;
  glyph: string;
  isChosen: boolean;
}

interface MysteryBoxResponse {
  chosenIndex: number;
  boxes: MysteryBoxItem[];
  won: boolean;
  multiplier: number;
  payout: number;
  bet: number;
  xpGain: number;
  user: User;
}

interface SpinHistoryItem {
  id: string;
  gameTitle: string;
  bet: number;
  payout: number;
  multiplier: number;
  timestamp: string;
}

function makeInitialGrid(machine: SlotMachineConfig): string[][] {
  return Array.from({ length: machine.rows }, (_, r) =>
    Array.from(
      { length: machine.cols },
      (_, c) => machine.symbols[(r * 2 + c) % machine.symbols.length]
    )
  );
}

const PIP_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const RoyalDieFace: React.FC<{ value: number; rolling?: boolean; accent?: string }> = ({
  value,
  rolling,
  accent = 'border-[#F3D37A]/65',
}) => {
  const pips = PIP_POSITIONS[value] || PIP_POSITIONS[1];
  return (
    <div
      className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 ${accent} bg-gradient-to-br from-[#1B223C] via-[#0B0F20] to-[#060913] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.55),inset_0_0_14px_rgba(212,175,55,0.2)] grid grid-cols-3 grid-rows-3 gap-1.5 place-items-center transition-transform duration-200 ${
        rolling ? 'animate-spin scale-95 opacity-90' : 'scale-100'
      }`}
    >
      {Array.from({ length: 9 }).map((_, idx) => (
        <span
          key={idx}
          className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full transition-all ${
            pips.includes(idx)
              ? 'bg-gradient-to-br from-[#FCE9A6] to-[#D4AF37] shadow-[0_0_8px_rgba(252,233,166,0.9)]'
              : 'bg-transparent'
          }`}
        />
      ))}
    </div>
  );
};

export const GamesCenterPage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const [category, setCategory] = useState<CenterCategory>('slots');

  // Common wallet & session states
  const [bet, setBet] = useState<number>(250);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionTotalWon, setSessionTotalWon] = useState(0);
  const [history, setHistory] = useState<SpinHistoryItem[]>([]);

  // --- SLOTS STATE ---
  const [selectedId, setSelectedId] = useState<SlotGameId>('classic_fruits');
  const activeMachine = useMemo(
    () => SLOT_MACHINES.find((m) => m.id === selectedId) || SLOT_MACHINES[0],
    [selectedId]
  );
  const [grid, setGrid] = useState<string[][]>(() => makeInitialGrid(SLOT_MACHINES[0]));
  const [spinningCols, setSpinningCols] = useState<boolean[]>([false, false, false]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningCellSet, setWinningCellSet] = useState<Set<string>>(new Set());
  const [lightningMap, setLightningMap] = useState<Record<string, number>>({});
  const [lastResult, setLastResult] = useState<SpinResultPayload | null>(null);
  const [showRules, setShowRules] = useState(true);

  const timersRef = useRef<number[]>([]);
  const intervalRef = useRef<number | null>(null);

  // --- DICE STATE ---
  const [diceGame, setDiceGame] = useState<DiceGameId>('double_dice');
  const [doublePick, setDoublePick] = useState<'high' | 'low' | 'seven' | 'doubles'>('high');
  const [predPick, setPredPick] = useState<string>('even');
  const [speedPick, setSpeedPick] = useState<'under_10' | 'over_11' | 'lucky_16' | 'triple'>(
    'over_11'
  );
  const [diceValues, setDiceValues] = useState<number[]>([5, 6]);
  const [isDiceRolling, setIsDiceRolling] = useState(false);
  const [diceResult, setDiceResult] = useState<DicePlayResponse | null>(null);

  // Ladder dice state
  const [ladderSession, setLadderSession] = useState<LadderSession | null>(null);
  const [ladderDie, setLadderDie] = useState<number>(4);
  const [ladderMessage, setLadderMessage] = useState<string | null>(null);
  const [ladderOutcome, setLadderOutcome] = useState<'climbed' | 'summit' | 'fell' | 'cashed_out' | null>(null);

  // --- ROULETTE STATE ---
  const [rouletteBetType, setRouletteBetType] = useState<RouletteBetType>('red');
  const [rouletteStraightNum, setRouletteStraightNum] = useState<number>(7);
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [isRouletteSpinning, setIsRouletteSpinning] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<RouletteSpinResponse | null>(null);

  // --- MYSTERY BOXES STATE ---
  const [isOpeningBox, setIsOpeningBox] = useState(false);
  const [mysteryResult, setMysteryResult] = useState<MysteryBoxResponse | null>(null);

  const clearSpinTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearSpinTimers();
  }, []);

  useEffect(() => {
    if (!user) return;
    getLadderStateFromSupabase(user.id)
      .then((session) => setLadderSession(session))
      .catch(() => {});
  }, [user]);

  const pushHistory = (gameTitle: string, wager: number, payout: number, multiplier: number) => {
    if (payout > 0) setSessionTotalWon((prev) => prev + payout);
    setHistory((prev) => [
      {
        id: `${Date.now()}_${Math.random()}`,
        gameTitle,
        bet: wager,
        payout,
        multiplier,
        timestamp: new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      },
      ...prev.slice(0, 11),
    ]);
  };

  // --- HANDLERS: SLOTS ---
  const handleSelectMachine = (machine: SlotMachineConfig) => {
    if (isSpinning) return;
    clearSpinTimers();
    setSelectedId(machine.id);
    setGrid(makeInitialGrid(machine));
    setSpinningCols(Array(machine.cols).fill(false));
    setWinningCellSet(new Set());
    setLightningMap({});
    setLastResult(null);
    setErrorMsg(null);
  };

  const handleSpin = async () => {
    if (!user || isSpinning) return;
    if (user.coins < bet) {
      setErrorMsg('رصيد الكوينز غير كافٍ لهذه الدورة. يمكنك شحن محفظتك أو اختيار رهان أقل.');
      return;
    }

    setErrorMsg(null);
    setWinningCellSet(new Set());
    setLightningMap({});
    setLastResult(null);
    setIsSpinning(true);

    const machine = activeMachine;
    const activeFlags = Array(machine.cols).fill(true);
    setSpinningCols([...activeFlags]);

    intervalRef.current = window.setInterval(() => {
      setGrid((prev) =>
        Array.from({ length: machine.rows }, (_, rIdx) =>
          Array.from({ length: machine.cols }, (__, cIdx) =>
            activeFlags[cIdx]
              ? machine.symbols[Math.floor(Math.random() * machine.symbols.length)]
              : prev[rIdx]?.[cIdx] ?? machine.symbols[0]
          )
        )
      );
    }, 65);

    try {
      const result = await spinSlotMachineInSupabase(user.id, machine.id, bet);

      const strikesMap: Record<string, number> = {};
      for (const st of result.lightningStrikes || []) {
        strikesMap[`${st.row}-${st.col}`] = st.mult;
      }

      for (let c = 0; c < machine.cols; c++) {
        const stopDelay = 500 + c * 220;
        const tId = window.setTimeout(() => {
          activeFlags[c] = false;
          setSpinningCols([...activeFlags]);
          setGrid((prev) =>
            Array.from({ length: machine.rows }, (_, rIdx) =>
              Array.from({ length: machine.cols }, (__, colIdx) =>
                colIdx === c
                  ? result.grid[rIdx]?.[colIdx] ?? prev[rIdx]?.[colIdx] ?? machine.symbols[0]
                  : prev[rIdx]?.[colIdx] ?? machine.symbols[0]
              )
            )
          );

          if (c === machine.cols - 1) {
            if (intervalRef.current !== null) {
              window.clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setIsSpinning(false);
            setLastResult(result);
            setLightningMap(strikesMap);
            updateLocalUser(result.user);

            const winKeys = new Set<string>(
              result.winningCells.map(([r, col]) => `${r}-${col}`)
            );
            setWinningCellSet(winKeys);
            pushHistory(machine.title, result.bet, result.payout, result.multiplier);
          }
        }, stopDelay);
        timersRef.current.push(tId);
      }
    } catch (err) {
      clearSpinTimers();
      setIsSpinning(false);
      setSpinningCols(Array(machine.cols).fill(false));
      setErrorMsg(err instanceof Error ? err.message : 'تعذّر تنفيذ دورة السلوت.');
    }
  };

  // --- HANDLERS: DICE ---
  const handleSelectDiceGame = (id: DiceGameId) => {
    if (isDiceRolling) return;
    setDiceGame(id);
    setDiceResult(null);
    setLadderMessage(null);
    setErrorMsg(null);
    if (id === 'double_dice') setDiceValues([5, 4]);
    else if (id === 'prediction_dice') setDiceValues([6]);
    else if (id === 'speed_dice') setDiceValues([4, 5, 6]);
  };

  const handlePlayStandardDice = async () => {
    if (!user || isDiceRolling || diceGame === 'ladder_dice') return;
    if (user.coins < bet) {
      setErrorMsg('رصيد الكوينز غير كافٍ لهذه الجولة.');
      return;
    }

    setErrorMsg(null);
    setDiceResult(null);
    setIsDiceRolling(true);

    const pick =
      diceGame === 'double_dice'
        ? doublePick
        : diceGame === 'prediction_dice'
        ? predPick
        : speedPick;

    const count = diceGame === 'double_dice' ? 2 : diceGame === 'prediction_dice' ? 1 : 3;
    const rollInterval = window.setInterval(() => {
      setDiceValues(Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6)));
    }, 80);

    try {
      const res = await playStandardDiceInSupabase(user.id, diceGame, bet, pick);

      const t = window.setTimeout(() => {
        window.clearInterval(rollInterval);
        setIsDiceRolling(false);
        setDiceValues(res.dice);
        setDiceResult(res);
        updateLocalUser(res.user);
        const titleMap: Record<string, string> = {
          double_dice: 'نرد الحظ المزدوج',
          prediction_dice: 'نرد التوقعات',
          speed_dice: 'نرد السرعة',
        };
        pushHistory(titleMap[diceGame] || 'ألعاب النرد', res.bet, res.payout, res.multiplier);
      }, 650);
      timersRef.current.push(t);
    } catch (err) {
      window.clearInterval(rollInterval);
      setIsDiceRolling(false);
      setErrorMsg(err instanceof Error ? err.message : 'تعذّر تنفيذ جولة النرد.');
    }
  };

  const handleLadderAction = async (action: 'roll' | 'cashout') => {
    if (!user || isDiceRolling) return;
    if (action === 'roll' && !ladderSession && user.coins < bet) {
      setErrorMsg('رصيد الكوينز غير كافٍ لبدء تحدي نرد السلم.');
      return;
    }

    setErrorMsg(null);
    setIsDiceRolling(true);
    try {
      const res = await playLadderActionInSupabase(user.id, action, bet);
      const delay = action === 'roll' ? 520 : 120;
      const t = window.setTimeout(() => {
        setIsDiceRolling(false);
        setLadderDie(res.die);
        setLadderSession(res.session);
        setLadderMessage(res.message);
        setLadderOutcome(res.status);
        updateLocalUser(res.user);

        if (res.status === 'cashed_out' || res.status === 'summit') {
          pushHistory('نرد السلم التفاعلي', bet, res.payout, res.multiplier);
        } else if (res.status === 'fell') {
          pushHistory('نرد السلم التفاعلي', bet, 0, 0);
        }
      }, delay);
      timersRef.current.push(t);
    } catch (err) {
      setIsDiceRolling(false);
      setErrorMsg(err instanceof Error ? err.message : 'تعذّر تنفيذ خطوة السلم.');
    }
  };

  // --- HANDLERS: ROULETTE ---
  const handleSpinRoulette = async () => {
    if (!user || isRouletteSpinning) return;
    if (user.coins < bet) {
      setErrorMsg('رصيد الكوينز غير كافٍ لدورة الروليت.');
      return;
    }

    setErrorMsg(null);
    setRouletteResult(null);
    setIsRouletteSpinning(true);

    try {
      const res = await spinRouletteInSupabase(
        user.id,
        bet,
        rouletteBetType,
        rouletteBetType === 'straight' ? rouletteStraightNum : undefined
      );

      const sliceAngle = 360 / 37;
      // Align pocket center with top pointer (0deg) while always rotating forward >= 5 turns
      const targetAngleMod = ((360 - res.wheelIndex * sliceAngle) % 360 + 360) % 360;
      setWheelRotation((prev) => {
        const currentMod = ((prev % 360) + 360) % 360;
        let delta = targetAngleMod - currentMod;
        if (delta <= 0) delta += 360;
        return prev + 360 * 5 + delta;
      });

      const t = window.setTimeout(() => {
        setIsRouletteSpinning(false);
        setRouletteResult(res);
        updateLocalUser(res.user);
        pushHistory(
          `الروليت الملكية (#${res.winningNumber})`,
          res.bet,
          res.payout,
          res.multiplier
        );
      }, 3300);
      timersRef.current.push(t);
    } catch (err) {
      setIsRouletteSpinning(false);
      setErrorMsg(err instanceof Error ? err.message : 'تعذّر تدوير عجلة الروليت.');
    }
  };

  // --- HANDLERS: MYSTERY BOXES ---
  const handleOpenMysteryBox = async (boxIndex: number) => {
    if (!user || isOpeningBox || mysteryResult) return;
    if (user.coins < bet) {
      setErrorMsg('رصيد الكوينز غير كافٍ لفتح صندوق الحظ.');
      return;
    }

    setErrorMsg(null);
    setIsOpeningBox(true);
    try {
      const res = await openMysteryBoxInSupabase(user.id, bet, boxIndex);
      setMysteryResult(res);
      updateLocalUser(res.user);
      pushHistory('صناديق الحظ الملكية', res.bet, res.payout, res.multiplier);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذّر فتح الصندوق.');
    } finally {
      setIsOpeningBox(false);
    }
  };

  const anyBusy = isSpinning || isDiceRolling || isRouletteSpinning || isOpeningBox;

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-28 space-y-6">
      {/* Header + Live Wallet Sync Strip */}
      <section className="royal-glass rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-[#D4AF37]/30">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FCE9A6]/25 to-[#D4AF37]/10 border border-[#D4AF37]/45 flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.28)]">
              <Gamepad2 className="w-5 h-5 text-[#FCE9A6]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text">
                مركز الألعاب الملكي — صَدَى
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">
                14 لعبة حصرية (8 ماكينات سلوت + 4 ألعاب نرد + الروليت الملكية + صناديق الحظ) مرتبطة برصيدك فوراً
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/35 px-4 py-2.5 flex items-center gap-2.5">
            <Coins className="w-4 h-4 text-[#D4AF37]" />
            <div>
              <span className="block text-[10px] text-slate-400">رصيد المحفظة</span>
              <span className="text-sm sm:text-base font-extrabold font-mono-num text-[#FCE9A6]">
                {user.coins.toLocaleString('en-US')}
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-[#070913]/85 border border-emerald-400/30 px-4 py-2.5 flex items-center gap-2.5">
            <Trophy className="w-4 h-4 text-emerald-300" />
            <div>
              <span className="block text-[10px] text-slate-400">أرباح الجلسة</span>
              <span className="text-sm sm:text-base font-extrabold font-mono-num text-emerald-300">
                +{sessionTotalWon.toLocaleString('en-US')}
              </span>
            </div>
          </div>

          <Link
            to="/wallet"
            className="min-h-[44px] rounded-2xl bg-white/5 hover:bg-[#D4AF37]/15 border border-[#D4AF37]/30 px-4 py-2 text-xs font-bold text-[#FCE9A6] flex items-center gap-1.5 transition"
          >
            <Wallet className="w-4 h-4" />
            <span>شحن المحفظة</span>
          </Link>
        </div>
      </section>

      {/* Main Category Switcher */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(
          [
            {
              id: 'slots',
              title: 'ماكينات السلوت',
              sub: '8 ألعاب ومضاعفات أسطورية',
              icon: Crown,
            },
            {
              id: 'dice',
              title: 'ألعاب النرد الملكية',
              sub: '4 تحديات نرد ومغامرة السلم',
              icon: Dices,
            },
            {
              id: 'roulette',
              title: 'الروليت الملكية',
              sub: 'عجلة ذهبية 37 خانة حتى ×32',
              icon: Disc3,
            },
            {
              id: 'mystery',
              title: 'صناديق الحظ',
              sub: '9 صناديق مغلقة بجوائز فورية',
              icon: Box,
            },
          ] as const
        ).map((tabItem) => {
          const Icon = tabItem.icon;
          const active = category === tabItem.id;
          return (
            <button
              key={tabItem.id}
              type="button"
              disabled={anyBusy}
              onClick={() => {
                setCategory(tabItem.id);
                setErrorMsg(null);
              }}
              className={`rounded-3xl p-4 border text-right transition-all cursor-pointer flex items-center gap-3 disabled:opacity-60 ${
                active
                  ? 'bg-gradient-to-br from-[#D4AF37]/25 via-[#141A33] to-[#0B0F20] border-[#FCE9A6] shadow-[0_0_26px_rgba(212,175,55,0.3)]'
                  : 'royal-glass border-[#D4AF37]/20 hover:border-[#D4AF37]/50'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                  active
                    ? 'bg-[#D4AF37] text-[#070913] border-[#FCE9A6]'
                    : 'bg-[#070913]/80 text-[#F3D37A] border-[#D4AF37]/30'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                  {tabItem.title}
                </h2>
                <p className="text-[11px] text-slate-300 truncate">{tabItem.sub}</p>
              </div>
            </button>
          );
        })}
      </section>

      {errorMsg && (
        <div className="rounded-2xl border border-rose-500/45 bg-rose-950/60 px-4 py-3 text-xs sm:text-sm text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* ===================== CATEGORY 1: 8 SLOT MACHINES ===================== */}
      {category === 'slots' && (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {SLOT_MACHINES.map((machine) => {
              const isSelected = machine.id === activeMachine.id;
              return (
                <button
                  key={machine.id}
                  type="button"
                  disabled={isSpinning}
                  onClick={() => handleSelectMachine(machine)}
                  className={`text-right rounded-3xl p-4 border bg-gradient-to-br transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 disabled:cursor-wait ${
                    machine.cardGradient
                  } ${
                    isSelected
                      ? 'border-[#FCE9A6] ring-1 ring-[#D4AF37]/60 shadow-[0_0_28px_rgba(212,175,55,0.3)] -translate-y-0.5'
                      : 'border-white/15 hover:border-[#D4AF37]/50 opacity-85 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold font-mono-num text-[#FCE9A6]">
                        {machine.badge} · أقصى ربح {machine.maxMultiplier}
                      </span>
                      <h2 className="text-base font-extrabold text-white">{machine.title}</h2>
                    </div>
                    <span className="text-2xl leading-none select-none">
                      {machine.symbols[machine.symbols.length - 1]}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <div className="flex items-center gap-1 text-base leading-none">
                      {machine.symbols.slice(0, 4).map((s, idx) => (
                        <span key={idx}>{s}</span>
                      ))}
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        isSelected ? 'text-[#FCE9A6]' : 'text-slate-300'
                      }`}
                    >
                      {isSelected ? 'قيد اللعب ✦' : 'اختر اللعبة'}
                    </span>
                  </div>
                </button>
              );
            })}
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div
              className={`lg:col-span-8 rounded-[2rem] border p-5 sm:p-7 space-y-5 relative overflow-hidden transition-all duration-300 ${activeMachine.cabinetClass}`}
            >
              <div
                className={`rounded-2xl bg-gradient-to-r ${activeMachine.headerGradient} border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Crown className={`w-5 h-5 ${activeMachine.accentText}`} />
                    <h2 className="text-lg sm:text-xl font-extrabold text-white">
                      {activeMachine.title}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">{activeMachine.subtitle}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-xl bg-[#070913]/80 border border-[#D4AF37]/35 px-3 py-1.5 text-xs font-extrabold font-mono-num text-[#FCE9A6]">
                    الجائزة الكبرى {activeMachine.maxMultiplier}
                  </span>
                </div>
              </div>

              <div
                dir="ltr"
                className="rounded-3xl bg-[#050711]/90 border border-[#D4AF37]/30 p-3 sm:p-5 shadow-inner relative"
              >
                <div
                  className="grid gap-2 sm:gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${activeMachine.cols}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from({ length: activeMachine.rows }).map((_, rIdx) =>
                    Array.from({ length: activeMachine.cols }).map((__, cIdx) => {
                      const key = `${rIdx}-${cIdx}`;
                      const sym =
                        grid[rIdx]?.[cIdx] ??
                        activeMachine.symbols[(rIdx + cIdx) % activeMachine.symbols.length];
                      const colSpinning = Boolean(spinningCols[cIdx]);
                      const isWinCell = winningCellSet.has(key);
                      const strikeMult = lightningMap[key];

                      return (
                        <div
                          key={key}
                          className={`relative aspect-square sm:aspect-[5/4] rounded-2xl border flex items-center justify-center overflow-hidden transition-all duration-200 select-none ${
                            isWinCell ? activeMachine.winCellGlow : activeMachine.reelCellBg
                          }`}
                        >
                          {rIdx === 1 && !colSpinning && !isWinCell && (
                            <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-white/5" />
                          )}

                          <span
                            className={`${
                              activeMachine.rows >= 4 ? 'text-2xl sm:text-4xl' : 'text-3xl sm:text-5xl'
                            } transition-transform duration-150 ${
                              colSpinning
                                ? 'animate-bounce blur-[0.8px] opacity-85 scale-95'
                                : isWinCell
                                ? 'scale-115 drop-shadow-[0_0_16px_rgba(252,233,166,0.9)]'
                                : 'scale-100'
                            }`}
                          >
                            {sym}
                          </span>

                          {!colSpinning && strikeMult && (
                            <span className="absolute bottom-1 right-1 rounded-lg bg-[#070913]/90 border border-[#FCE9A6]/80 px-1.5 py-0.5 text-[10px] sm:text-xs font-extrabold font-mono-num text-[#FCE9A6] shadow-[0_0_12px_rgba(252,233,166,0.75)]">
                              ×{strikeMult}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {lastResult && !isSpinning && (
                <div
                  className={`rounded-2xl border p-4 transition-all ${
                    lastResult.payout > 0
                      ? 'border-[#FCE9A6]/70 bg-gradient-to-r from-[#D4AF37]/25 via-emerald-950/50 to-[#D4AF37]/20 shadow-[0_0_28px_rgba(212,175,55,0.3)]'
                      : 'border-white/10 bg-[#070913]/75'
                  }`}
                >
                  {lastResult.payout > 0 ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-[#FCE9A6]">
                          <Sparkles className="w-5 h-5 text-[#F3D37A]" />
                          <span>
                            {lastResult.jackpotHit
                              ? 'فوز أسطوري فائق! 🎉'
                              : 'مبروك! تمت إضافة الأرباح إلى محفظتك فوراً'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200">
                          {lastResult.rulesTriggered.join(' · ')}
                        </p>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="text-xl sm:text-2xl font-extrabold font-mono-num text-emerald-300">
                          +{lastResult.payout.toLocaleString('en-US')} كوينز
                        </div>
                        <div className="text-[11px] font-mono-num text-[#FCE9A6]">
                          مضاعف ×{lastResult.multiplier} · +{lastResult.xpGain} XP
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>لم يتطابق خط ربح هذه المرة — حظاً أوفر في الدورة القادمة!</span>
                      <span className="font-mono-num text-[#F3D37A]">+{lastResult.xpGain} XP</span>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-3xl bg-[#070913]/85 border border-[#D4AF37]/25 p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-[#D4AF37]" />
                    <span>قيمة الرهان للدورة (كوينز):</span>
                  </span>
                  <span className="text-xs font-mono-num text-[#FCE9A6]">
                    الرهان المحدد: {bet.toLocaleString('en-US')} كوينز
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {BET_AMOUNTS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      disabled={isSpinning}
                      onClick={() => setBet(val)}
                      className={`min-h-[42px] rounded-xl text-xs font-extrabold font-mono-num border transition cursor-pointer disabled:opacity-50 ${
                        bet === val
                          ? 'bg-[#D4AF37] text-[#070913] border-[#FCE9A6] shadow-[0_0_16px_rgba(212,175,55,0.4)]'
                          : 'bg-white/5 border-white/15 text-slate-200 hover:border-[#D4AF37]/50'
                      }`}
                    >
                      {val.toLocaleString('en-US')}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={isSpinning || user.coins < bet}
                  onClick={handleSpin}
                  className={`w-full min-h-[54px] rounded-2xl text-base font-extrabold flex items-center justify-center gap-2.5 cursor-pointer transition active:scale-[0.99] disabled:opacity-45 disabled:cursor-not-allowed ${activeMachine.spinButtonClass}`}
                >
                  <RotateCw className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`} />
                  <span>
                    {isSpinning
                      ? 'البكرات تدور...'
                      : user.coins < bet
                      ? 'رصيد المحفظة غير كافٍ'
                      : `تدوير البكرات الآن (${bet.toLocaleString('en-US')} كوينز)`}
                  </span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-4">
              <section className="royal-glass rounded-3xl p-5 space-y-4 border border-[#D4AF37]/25">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#FCE9A6]">
                    <Zap className="w-4 h-4 text-[#D4AF37]" />
                    <h3 className="text-sm font-extrabold">قواعد ومضاعفات {activeMachine.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRules((v) => !v)}
                    className="text-xs text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>{showRules ? 'إخفاء' : 'عرض'}</span>
                  </button>
                </div>

                {showRules && (
                  <>
                    <div className="rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/30 p-3.5 space-y-1">
                      <p className="text-xs font-extrabold text-[#FCE9A6]">
                        {activeMachine.specialRuleTitle}
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {activeMachine.specialRuleDesc}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {activeMachine.paytable.map((row, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl bg-[#070913]/75 border border-white/10 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-white block">{row.combo}</span>
                            {row.note && (
                              <span className="text-[11px] text-slate-400">{row.note}</span>
                            )}
                          </div>
                          <span className="font-extrabold font-mono-num text-[#FCE9A6] shrink-0">
                            {row.mult}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            </div>
          </section>
        </>
      )}

      {/* ===================== CATEGORY 2: 4 ROYAL DICE GAMES ===================== */}
      {category === 'dice' && (
        <section className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {(
              [
                {
                  id: 'double_dice',
                  title: 'نرد الحظ المزدوج',
                  desc: 'نردان ذهبيان: عالي / منخفض / السبعة الذهبية / تطابق',
                  badge: 'حتى ×4.8',
                },
                {
                  id: 'prediction_dice',
                  title: 'نرد التوقعات',
                  desc: 'توقع زوجي/فردي أو الرقم الدقيق من 1 إلى 6',
                  badge: 'حتى ×5.2',
                },
                {
                  id: 'ladder_dice',
                  title: 'نرد السلم التفاعلي',
                  desc: 'اصعد 5 درجات مضاعفة مع خيار سحب الأرباح بأي لحظة',
                  badge: 'حتى ×12.0',
                },
                {
                  id: 'speed_dice',
                  title: 'نرد السرعة الخاطف',
                  desc: '3 نردات سريعة: مجموع 16+ أو الثلاثية المتطابقة',
                  badge: 'حتى ×12.0',
                },
              ] as const
            ).map((d) => {
              const selected = diceGame === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={isDiceRolling}
                  onClick={() => handleSelectDiceGame(d.id)}
                  className={`rounded-3xl p-4 border text-right transition-all cursor-pointer space-y-2 ${
                    selected
                      ? 'bg-gradient-to-br from-[#2B1F09]/95 via-[#13172E] to-[#0B0F20] border-[#FCE9A6] shadow-[0_0_26px_rgba(212,175,55,0.28)]'
                      : 'royal-glass border-[#D4AF37]/20 hover:border-[#D4AF37]/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold font-mono-num text-[#FCE9A6]">
                      {d.badge}
                    </span>
                    <Dices className="w-5 h-5 text-[#D4AF37]" />
                  </div>
                  <h3 className="text-base font-extrabold text-white">{d.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{d.desc}</p>
                </button>
              );
            })}
          </div>

          <div className="royal-glass rounded-[2rem] border border-[#D4AF37]/35 p-5 sm:p-7 space-y-6">
            {diceGame !== 'ladder_dice' ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-extrabold text-[#FCE9A6]">
                      {diceGame === 'double_dice'
                        ? 'نرد الحظ المزدوج (نردان)'
                        : diceGame === 'prediction_dice'
                        ? 'نرد التوقعات الدقيق'
                        : 'نرد السرعة الخاطف (3 نردات)'}
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      اختر توقعك وقيمة الرهان ثم أطلق النرد الملكي لربح فوري إلى محفظتك
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#070913]/85 border border-[#D4AF37]/30 px-3.5 py-2 text-xs font-mono-num text-[#F3D37A]">
                    المجموع الحالي: {diceValues.reduce((a, b) => a + b, 0)}
                  </div>
                </div>

                {/* Dice Stage */}
                <div className="rounded-3xl bg-[#060812]/90 border border-[#D4AF37]/25 py-8 px-4 flex flex-wrap items-center justify-center gap-5 sm:gap-8">
                  {diceValues.map((val, idx) => (
                    <RoyalDieFace key={idx} value={val} rolling={isDiceRolling} />
                  ))}
                </div>

                {/* Prediction Buttons per Game */}
                {diceGame === 'double_dice' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {(
                      [
                        { id: 'high', label: 'عالي (8 – 12)', mult: '×1.95' },
                        { id: 'low', label: 'منخفض (2 – 6)', mult: '×1.95' },
                        { id: 'seven', label: 'السبعة الذهبية (7)', mult: '×4.2' },
                        { id: 'doubles', label: 'تطابق النردين', mult: '×4.8' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isDiceRolling}
                        onClick={() => setDoublePick(opt.id)}
                        className={`rounded-2xl p-3 border text-center cursor-pointer transition ${
                          doublePick === opt.id
                            ? 'bg-[#D4AF37]/20 border-[#FCE9A6] text-[#FCE9A6] shadow-[0_0_18px_rgba(212,175,55,0.28)]'
                            : 'bg-[#070913]/75 border-white/15 text-slate-200 hover:border-[#D4AF37]/45'
                        }`}
                      >
                        <span className="block text-xs font-extrabold">{opt.label}</span>
                        <span className="block text-xs font-mono-num text-[#F3D37A] mt-0.5">
                          {opt.mult}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {diceGame === 'prediction_dice' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { id: 'even', label: 'رقم زوجي (2 / 4 / 6)', mult: '×1.92' },
                        { id: 'odd', label: 'رقم فردي (1 / 3 / 5)', mult: '×1.92' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={isDiceRolling}
                          onClick={() => setPredPick(opt.id)}
                          className={`rounded-2xl p-3 border text-center cursor-pointer transition ${
                            predPick === opt.id
                              ? 'bg-[#D4AF37]/20 border-[#FCE9A6] text-[#FCE9A6]'
                              : 'bg-[#070913]/75 border-white/15 text-slate-200 hover:border-[#D4AF37]/45'
                          }`}
                        >
                          <span className="block text-xs font-extrabold">{opt.label}</span>
                          <span className="block text-xs font-mono-num text-[#F3D37A] mt-0.5">
                            {opt.mult}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {[1, 2, 3, 4, 5, 6].map((num) => {
                        const key = `exact_${num}`;
                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={isDiceRolling}
                            onClick={() => setPredPick(key)}
                            className={`rounded-xl py-2.5 px-2 border text-xs font-extrabold font-mono-num cursor-pointer transition ${
                              predPick === key
                                ? 'bg-[#D4AF37] text-[#070913] border-[#FCE9A6]'
                                : 'bg-[#070913]/75 border-white/15 text-white hover:border-[#D4AF37]/45'
                            }`}
                          >
                            رقم {num} (×5.2)
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {diceGame === 'speed_dice' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {(
                      [
                        { id: 'under_10', label: 'مجموع 3 – 10', mult: '×1.9' },
                        { id: 'over_11', label: 'مجموع 11 – 18', mult: '×1.9' },
                        { id: 'lucky_16', label: 'قمة السرعة 16+', mult: '×4.5' },
                        { id: 'triple', label: 'ثلاثية متطابقة', mult: '×12' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isDiceRolling}
                        onClick={() => setSpeedPick(opt.id)}
                        className={`rounded-2xl p-3 border text-center cursor-pointer transition ${
                          speedPick === opt.id
                            ? 'bg-[#D4AF37]/20 border-[#FCE9A6] text-[#FCE9A6]'
                            : 'bg-[#070913]/75 border-white/15 text-slate-200 hover:border-[#D4AF37]/45'
                        }`}
                      >
                        <span className="block text-xs font-extrabold">{opt.label}</span>
                        <span className="block text-xs font-mono-num text-[#F3D37A] mt-0.5">
                          {opt.mult}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {diceResult && !isDiceRolling && (
                  <div
                    className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      diceResult.won
                        ? 'border-[#FCE9A6]/70 bg-gradient-to-r from-[#D4AF37]/25 via-emerald-950/50 to-[#D4AF37]/20'
                        : 'border-white/10 bg-[#070913]/80'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-extrabold text-[#FCE9A6]">{diceResult.label}</p>
                      <p className="text-xs text-slate-300 font-mono-num">
                        +{diceResult.xpGain} XP مضافة لحسابك
                      </p>
                    </div>
                    <div className="text-left font-mono-num">
                      {diceResult.won ? (
                        <span className="text-xl font-extrabold text-emerald-300">
                          +{diceResult.payout.toLocaleString('en-US')} كوينز (×{diceResult.multiplier})
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-slate-400">
                          -{diceResult.bet.toLocaleString('en-US')} كوينز
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {BET_AMOUNTS.map((val) => (
                      <button
                        key={val}
                        type="button"
                        disabled={isDiceRolling}
                        onClick={() => setBet(val)}
                        className={`min-h-[42px] rounded-xl text-xs font-extrabold font-mono-num border cursor-pointer transition ${
                          bet === val
                            ? 'bg-[#D4AF37] text-[#070913] border-[#FCE9A6]'
                            : 'bg-white/5 border-white/15 text-slate-200 hover:border-[#D4AF37]/45'
                        }`}
                      >
                        {val.toLocaleString('en-US')}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={isDiceRolling || user.coins < bet}
                    onClick={handlePlayStandardDice}
                    className="gold-btn w-full min-h-[54px] rounded-2xl text-base font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45"
                  >
                    <Dices className={`w-5 h-5 ${isDiceRolling ? 'animate-spin' : ''}`} />
                    <span>
                      {isDiceRolling
                        ? 'جارٍ رمي النرد...'
                        : `إطلاق النرد (${bet.toLocaleString('en-US')} كوينز)`}
                    </span>
                  </button>
                </div>
              </>
            ) : (
              /* LADDER DICE INTERACTIVE 5-RUNG TOWER */
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-extrabold text-[#FCE9A6]">
                      نرد السلم التفاعلي (5 درجات حتى ×12.0)
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      اصعد درجات السلم الذهبي، الرقم 6 يمنحك قفزة مزدوجة، ويمكنك تأمين أرباحك في أي درجة!
                    </p>
                  </div>
                  {ladderSession && (
                    <div className="rounded-xl bg-emerald-950/70 border border-emerald-400/45 px-4 py-2 text-xs font-mono-num text-emerald-200">
                      ربحك المؤمّن الآن:{' '}
                      {Math.round(ladderSession.bet * ladderSession.currentMultiplier).toLocaleString(
                        'en-US'
                      )}{' '}
                      كوينز (×{ladderSession.currentMultiplier})
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                  <div className="lg:col-span-7 space-y-2.5">
                    {[...LADDER_TIERS].reverse().map((tier) => {
                      const reached = (ladderSession?.step || 0) >= tier.step;
                      const current = (ladderSession?.step || 0) === tier.step;
                      return (
                        <div
                          key={tier.step}
                          className={`rounded-2xl px-4 py-3 border flex items-center justify-between transition-all ${
                            current
                              ? 'border-[#FCE9A6] bg-gradient-to-r from-[#D4AF37]/30 to-[#141A33] shadow-[0_0_24px_rgba(212,175,55,0.35)]'
                              : reached
                              ? 'border-emerald-400/45 bg-emerald-950/35 text-emerald-200'
                              : 'border-white/10 bg-[#070913]/80 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold font-mono-num ${
                                current
                                  ? 'bg-[#D4AF37] text-[#070913]'
                                  : reached
                                  ? 'bg-emerald-400/25 text-emerald-200'
                                  : 'bg-white/10 text-slate-300'
                              }`}
                            >
                              {tier.step}
                            </span>
                            <span className="text-sm font-bold">{tier.label}</span>
                          </div>
                          <span className="text-base font-extrabold font-mono-num text-[#FCE9A6]">
                            ×{tier.mult}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="lg:col-span-5 rounded-3xl bg-[#060812]/90 border border-[#D4AF37]/25 p-5 flex flex-col items-center justify-center gap-4">
                    <RoyalDieFace value={ladderDie} rolling={isDiceRolling} />
                    {ladderMessage && (
                      <div
                        className={`w-full rounded-2xl border p-3 text-center text-xs font-bold ${
                          ladderOutcome === 'fell'
                            ? 'border-rose-500/45 bg-rose-950/50 text-rose-200'
                            : 'border-[#D4AF37]/45 bg-[#D4AF37]/15 text-[#FCE9A6]'
                        }`}
                      >
                        {ladderMessage}
                      </div>
                    )}

                    {!ladderSession && (
                      <div className="w-full grid grid-cols-3 gap-2">
                        {BET_AMOUNTS.map((val) => (
                          <button
                            key={val}
                            type="button"
                            disabled={isDiceRolling}
                            onClick={() => setBet(val)}
                            className={`rounded-xl py-2 text-xs font-extrabold font-mono-num border cursor-pointer ${
                              bet === val
                                ? 'bg-[#D4AF37] text-[#070913] border-[#FCE9A6]'
                                : 'bg-white/5 border-white/15 text-slate-200'
                            }`}
                          >
                            {val.toLocaleString('en-US')}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="w-full space-y-2.5">
                      <button
                        type="button"
                        disabled={isDiceRolling || (!ladderSession && user.coins < bet)}
                        onClick={() => handleLadderAction('roll')}
                        className="gold-btn w-full min-h-[48px] rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45"
                      >
                        <Dices className={`w-4 h-4 ${isDiceRolling ? 'animate-spin' : ''}`} />
                        <span>
                          {ladderSession
                            ? `إلقاء النرد للصعود (الدرجة ${(ladderSession.step || 0) + 1})`
                            : `بدء تحدي السلم (${bet.toLocaleString('en-US')} كوينز)`}
                        </span>
                      </button>

                      {ladderSession && ladderSession.step > 0 && (
                        <button
                          type="button"
                          disabled={isDiceRolling}
                          onClick={() => handleLadderAction('cashout')}
                          className="w-full min-h-[46px] rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer transition"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>
                            تأمين وسحب +
                            {Math.round(
                              ladderSession.bet * ladderSession.currentMultiplier
                            ).toLocaleString('en-US')}{' '}
                            كوينز
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===================== CATEGORY 3: ROYAL ROULETTE ===================== */}
      {category === 'roulette' && (
        <section className="royal-glass rounded-[2rem] border border-[#D4AF37]/35 p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Wheel Showcase */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center gap-4">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
              {/* Top Pointer */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-[#FCE9A6] drop-shadow-[0_0_10px_rgba(252,233,166,0.95)]" />

              {/* Outer Golden Rim */}
              <div className="w-full h-full rounded-full p-2.5 bg-gradient-to-br from-[#FCE9A6] via-[#D4AF37] to-[#7A5912] shadow-[0_0_45px_rgba(212,175,55,0.35)]">
                <div
                  className="w-full h-full rounded-full relative overflow-hidden bg-[#080B18]"
                  style={{
                    transform: `rotate(${wheelRotation}deg)`,
                    transition: 'transform 3200ms cubic-bezier(0.12, 0.85, 0.2, 1)',
                  }}
                >
                  <svg viewBox="0 0 200 200" className="w-full h-full">
                    {ROULETTE_WHEEL_ORDER.map((num, idx) => {
                      const sliceDeg = 360 / 37;
                      const startAngle = (idx * sliceDeg - sliceDeg / 2 - 90) * (Math.PI / 180);
                      const endAngle = ((idx + 1) * sliceDeg - sliceDeg / 2 - 90) * (Math.PI / 180);
                      const x1 = 100 + 98 * Math.cos(startAngle);
                      const y1 = 100 + 98 * Math.sin(startAngle);
                      const x2 = 100 + 98 * Math.cos(endAngle);
                      const y2 = 100 + 98 * Math.sin(endAngle);
                      const fill =
                        num === 0 ? '#047857' : ROULETTE_REDS.has(num) ? '#991B1B' : '#0B0F20';
                      const textAngle = idx * sliceDeg;
                      return (
                        <g key={num}>
                          <path
                            d={`M 100 100 L ${x1} ${y1} A 98 98 0 0 1 ${x2} ${y2} Z`}
                            fill={fill}
                            stroke="#D4AF37"
                            strokeWidth="0.6"
                          />
                          <text
                            x="100"
                            y="17"
                            fill="#FCE9A6"
                            fontSize="5.4"
                            fontWeight="bold"
                            textAnchor="middle"
                            transform={`rotate(${textAngle} 100 100)`}
                          >
                            {num}
                          </text>
                        </g>
                      );
                    })}
                    <circle
                      cx="100"
                      cy="100"
                      r="56"
                      fill="#070913"
                      stroke="#D4AF37"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="100"
                      cy="100"
                      r="20"
                      fill="#D4AF37"
                      stroke="#FCE9A6"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
              </div>

              {/* Center Fixed Outcome Display */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-[#070913]/95 border-2 border-[#FCE9A6] flex flex-col items-center justify-center shadow-[0_0_24px_rgba(212,175,55,0.6)]">
                  {rouletteResult && !isRouletteSpinning ? (
                    <>
                      <span className="text-[10px] text-slate-400">الرقم</span>
                      <span
                        className={`text-xl font-extrabold font-mono-num ${
                          rouletteResult.winningColor === 'red'
                            ? 'text-rose-400'
                            : rouletteResult.winningColor === 'green'
                            ? 'text-emerald-400'
                            : 'text-[#FCE9A6]'
                        }`}
                      >
                        {rouletteResult.winningNumber}
                      </span>
                    </>
                  ) : (
                    <Crown className="w-7 h-7 text-[#FCE9A6]" />
                  )}
                </div>
              </div>
            </div>

            {rouletteResult && !isRouletteSpinning && (
              <div
                className={`w-full rounded-2xl border p-3.5 text-center ${
                  rouletteResult.won
                    ? 'border-[#FCE9A6]/70 bg-gradient-to-r from-[#D4AF37]/25 via-emerald-950/50 to-[#D4AF37]/20'
                    : 'border-white/10 bg-[#070913]/80'
                }`}
              >
                {rouletteResult.won ? (
                  <p className="text-sm font-extrabold text-emerald-300 font-mono-num">
                    فوز الروليت الملكية! +{rouletteResult.payout.toLocaleString('en-US')} كوينز (×
                    {rouletteResult.multiplier})
                  </p>
                ) : (
                  <p className="text-xs text-slate-300">
                    توقفت الكرة عند #{rouletteResult.winningNumber} — حاول في الدورة القادمة!
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Betting Controls */}
          <div className="lg:col-span-7 space-y-4">
            <div>
              <h2 className="text-xl font-extrabold text-[#FCE9A6]">لوحة رهانات الروليت الملكية</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                اختر اللون أو الفئة أو الرقم الدقيق لتدوير العجلة الذهبية بمضاعفات تصل إلى ×32
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(
                [
                  { id: 'red', label: 'أحمر', mult: '×2', cls: 'bg-rose-950/75 border-rose-400/40' },
                  { id: 'black', label: 'أسود', mult: '×2', cls: 'bg-[#080B18] border-slate-500/40' },
                  { id: 'even', label: 'زوجي', mult: '×2', cls: 'bg-[#0B0F20] border-[#D4AF37]/25' },
                  { id: 'odd', label: 'فردي', mult: '×2', cls: 'bg-[#0B0F20] border-[#D4AF37]/25' },
                  { id: 'dozen_1', label: '1 – 12', mult: '×3', cls: 'bg-[#0B0F20] border-[#D4AF37]/25' },
                  { id: 'dozen_2', label: '13 – 24', mult: '×3', cls: 'bg-[#0B0F20] border-[#D4AF37]/25' },
                  { id: 'dozen_3', label: '25 – 36', mult: '×3', cls: 'bg-[#0B0F20] border-[#D4AF37]/25' },
                  { id: 'zero', label: 'صفر 0', mult: '×28', cls: 'bg-emerald-950/75 border-emerald-400/45' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isRouletteSpinning}
                  onClick={() => setRouletteBetType(opt.id)}
                  className={`rounded-2xl p-3 border text-center cursor-pointer transition ${
                    opt.cls
                  } ${
                    rouletteBetType === opt.id
                      ? 'ring-2 ring-[#FCE9A6] border-[#FCE9A6] shadow-[0_0_20px_rgba(212,175,55,0.35)]'
                      : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  <span className="block text-xs font-extrabold text-white">{opt.label}</span>
                  <span className="block text-xs font-mono-num text-[#FCE9A6] mt-0.5">
                    {opt.mult}
                  </span>
                </button>
              ))}
            </div>

            {/* Optional Exact Straight Number Picker */}
            <div className="rounded-2xl bg-[#070913]/80 border border-[#D4AF37]/25 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  disabled={isRouletteSpinning}
                  onClick={() => setRouletteBetType('straight')}
                  className={`font-extrabold cursor-pointer ${
                    rouletteBetType === 'straight' ? 'text-[#FCE9A6]' : 'text-slate-300'
                  }`}
                >
                  الرهان على رقم مباشر واحد (×32): {rouletteBetType === 'straight' ? 'مفعّل ✓' : 'اضغط للتفعيل'}
                </button>
                <span className="font-mono-num text-[#F3D37A]">الرقم #{rouletteStraightNum}</span>
              </div>
              <div className="grid grid-cols-9 sm:grid-cols-12 gap-1.5" dir="ltr">
                {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => {
                  const isRed = ROULETTE_REDS.has(n);
                  const isPicked = rouletteBetType === 'straight' && rouletteStraightNum === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={isRouletteSpinning}
                      onClick={() => {
                        setRouletteBetType('straight');
                        setRouletteStraightNum(n);
                      }}
                      className={`h-8 rounded-lg text-[11px] font-extrabold font-mono-num border cursor-pointer transition ${
                        isRed ? 'bg-rose-900/75 border-rose-400/35' : 'bg-[#0B0F20] border-white/15'
                      } ${isPicked ? 'ring-2 ring-[#FCE9A6] text-[#FCE9A6] scale-105' : 'text-white'}`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {BET_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  disabled={isRouletteSpinning}
                  onClick={() => setBet(val)}
                  className={`min-h-[42px] rounded-xl text-xs font-extrabold font-mono-num border cursor-pointer transition ${
                    bet === val
                      ? 'bg-[#D4AF37] text-[#070913] border-[#FCE9A6]'
                      : 'bg-white/5 border-white/15 text-slate-200 hover:border-[#D4AF37]/45'
                  }`}
                >
                  {val.toLocaleString('en-US')}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={isRouletteSpinning || user.coins < bet}
              onClick={handleSpinRoulette}
              className="gold-btn w-full min-h-[54px] rounded-2xl text-base font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45"
            >
              <Disc3 className={`w-5 h-5 ${isRouletteSpinning ? 'animate-spin' : ''}`} />
              <span>
                {isRouletteSpinning
                  ? 'العجلة الذهبية تدور...'
                  : `تدوير الروليت الملكية (${bet.toLocaleString('en-US')} كوينز)`}
              </span>
            </button>
          </div>
        </section>
      )}

      {/* ===================== CATEGORY 4: 9 MYSTERY BOXES ===================== */}
      {category === 'mystery' && (
        <section className="royal-glass rounded-[2rem] border border-[#D4AF37]/35 p-5 sm:p-7 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-[#FCE9A6]">
                صناديق الحظ الملكية (9 صناديق مغلقة)
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                حدد قيمة الرهان ثم اضغط على أي صندوق مغلق للكشف عن الكنز الفوري ومضاعفات حتى ×12.0!
              </p>
            </div>
            {mysteryResult && (
              <button
                type="button"
                onClick={() => setMysteryResult(null)}
                className="gold-btn min-h-[42px] rounded-xl px-5 py-2 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RotateCw className="w-4 h-4" />
                <span>صناديق جديدة</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {BET_AMOUNTS.map((val) => (
              <button
                key={val}
                type="button"
                disabled={isOpeningBox || Boolean(mysteryResult)}
                onClick={() => setBet(val)}
                className={`min-h-[42px] rounded-xl text-xs font-extrabold font-mono-num border cursor-pointer transition disabled:opacity-60 ${
                  bet === val
                    ? 'bg-[#D4AF37] text-[#070913] border-[#FCE9A6]'
                    : 'bg-white/5 border-white/15 text-slate-200 hover:border-[#D4AF37]/45'
                }`}
              >
                {val.toLocaleString('en-US')}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-2xl mx-auto">
            {Array.from({ length: 9 }, (_, idx) => {
              const revealed = mysteryResult?.boxes.find((b) => b.index === idx);
              const isChosen = revealed?.isChosen;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isOpeningBox || Boolean(mysteryResult) || user.coins < bet}
                  onClick={() => handleOpenMysteryBox(idx)}
                  className={`aspect-square rounded-3xl border p-3 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer disabled:cursor-default ${
                    revealed
                      ? isChosen
                        ? revealed.multiplier > 0
                          ? 'border-[#FCE9A6] bg-gradient-to-br from-[#D4AF37]/35 via-emerald-950/60 to-[#0B0F20] shadow-[0_0_28px_rgba(212,175,55,0.45)] scale-[1.03]'
                          : 'border-rose-400/50 bg-rose-950/50'
                        : 'border-white/15 bg-[#070913]/65 opacity-60'
                      : 'border-[#D4AF37]/40 bg-gradient-to-br from-[#1B2242] via-[#0B0F20] to-[#1D1609] hover:border-[#FCE9A6] hover:-translate-y-1 shadow-[0_0_20px_rgba(212,175,55,0.18)]'
                  }`}
                >
                  {revealed ? (
                    <>
                      <span className="text-3xl sm:text-4xl">{revealed.glyph}</span>
                      <span className="text-[11px] sm:text-xs font-extrabold text-white text-center">
                        {revealed.label}
                      </span>
                      <span
                        className={`text-xs font-extrabold font-mono-num ${
                          revealed.multiplier > 0 ? 'text-[#FCE9A6]' : 'text-slate-400'
                        }`}
                      >
                        {revealed.multiplier > 0
                          ? `+${revealed.coins.toLocaleString('en-US')} (×${revealed.multiplier})`
                          : '0 كوينز'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl sm:text-5xl">🎁</span>
                      <span className="text-xs font-extrabold text-[#FCE9A6]">
                        صندوق #{idx + 1}
                      </span>
                      <span className="text-[10px] text-slate-400">اضغط للفتح</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {mysteryResult && (
            <div
              className={`rounded-2xl border p-4 text-center ${
                mysteryResult.won
                  ? 'border-[#FCE9A6]/70 bg-gradient-to-r from-[#D4AF37]/25 via-emerald-950/50 to-[#D4AF37]/20'
                  : 'border-white/10 bg-[#070913]/80'
              }`}
            >
              {mysteryResult.won ? (
                <p className="text-base font-extrabold text-emerald-300 font-mono-num">
                  كنز مذهل! ربحت +{mysteryResult.payout.toLocaleString('en-US')} كوينز (×
                  {mysteryResult.multiplier}) · +{mysteryResult.xpGain} XP
                </p>
              ) : (
                <p className="text-xs sm:text-sm text-slate-300">
                  الصندوق المختار كان فارغاً — اضغط «صناديق جديدة» لتجربة حظك مرة أخرى!
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Unified Live History Strip across All 14 Games */}
      <section className="royal-glass rounded-3xl p-5 space-y-3 border border-[#D4AF37]/20">
        <div className="flex items-center gap-2 text-[#F3D37A]">
          <History className="w-4 h-4" />
          <h3 className="text-sm font-extrabold">سجل الدورات والألعاب الفوري</h3>
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">
            ابدأ اللعب في السلوت أو النرد أو الروليت أو صناديق الحظ لتظهر نتائجك هنا فوراً.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-[#070913]/75 border border-white/10 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold text-white truncate">{item.gameTitle}</p>
                  <p className="text-[11px] text-slate-400 font-mono-num">
                    رهان {item.bet.toLocaleString('en-US')} · {item.timestamp}
                  </p>
                </div>
                <div className="text-left shrink-0 font-mono-num">
                  {item.payout > 0 ? (
                    <span className="font-extrabold text-emerald-300">
                      +{item.payout.toLocaleString('en-US')} (×{item.multiplier})
                    </span>
                  ) : (
                    <span className="text-slate-400">-{item.bet.toLocaleString('en-US')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
