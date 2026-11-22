import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Box,
  Coins,
  Crown,
  Dices,
  Disc3,
  Flame,
  Gamepad2,
  Hand,
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
import { Fluent3DAsset } from '../components/Fluent3DAsset';
import { Royal3DDieCube } from '../components/Royal3DDice';
import { RoyalSlotSymbol3D } from '../components/RoyalSlotSymbol3D';
import { SlotMachine3DLever, SlotMarqueePerimeter } from '../components/SlotMachine3DLever';
import {
  fireGoldCoinConfetti,
  playCoinWinSound,
  playDiceLandSound,
  playDiceTumbleSound,
  playSlotReelStop,
  playSlotSpinTick,
} from '../lib/sadaAudio';
import {
  getLadderStateFromSupabase,
  openMysteryBoxInSupabase,
  playLadderActionInSupabase,
  playRpsInSupabase,
  playStandardDiceInSupabase,
  placeRoomGameBetInSupabase,
  refreshGameUserFromSupabase,
  spinRouletteInSupabase,
  spinSlotMachineInSupabase,
  type RoomGameKind,
  type RoomGameBetSelection,
  type RoomGameRoundBet,
  type RoomGameRoundState,
  type RpsMove,
  type RpsPlayResponse,
  type SlotGameId,
} from '../lib/sadaGamesService';
import type { User } from '../types';

type CenterCategory = 'slots' | 'dice' | 'roulette' | 'mystery' | 'rps';

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
    id: 'jungle_hunt',
    title: 'مطاردة الأدغال',
    subtitle: '15 خط ربح ذهبي (5×3) + تبديل WILD المضاعف في أعماق الغابة',
    badge: '5×3 أدغال 🔥',
    cols: 5,
    rows: 3,
    maxMultiplier: '×100',
    symbols: ['10', 'J', 'K', '🐊', '🐘', '🦍', '🦁', 'WILD'],
    specialRuleTitle: 'برية الأدغال (WILD ×1.5)',
    specialRuleDesc:
      '15 خط دفع متقاطع على لوحة 5×3! يستبدل رمز WILD أي رمز على الخط الفائز ويضاعف قيمته ×1.5 فوراً.',
    paytable: [
      { combo: 'WILD ×5', mult: '×100', note: 'الجاكبوت الأعظم للأدغال' },
      { combo: '🦁 ×3 / ×4 / ×5', mult: '×10 / ×28 / ×75', note: 'أسد الأدغال الملكي' },
      { combo: '🦍 ×3 / ×4 / ×5', mult: '×6 / ×18 / ×45' },
      { combo: '🐘 ×3 / ×4 / ×5', mult: '×4 / ×12 / ×32' },
      { combo: '🐊 ×3 / ×4 / ×5', mult: '×3 / ×8 / ×22' },
      { combo: 'K / J / 10 ×5', mult: '×8 – ×15' },
    ],
    cardGradient: 'from-[#0B2E16]/95 via-[#071A0E]/95 to-[#2D1D06]/95',
    cabinetClass:
      'border-emerald-400/55 bg-gradient-to-b from-[#0C2613]/96 via-[#08170D]/98 to-[#241807]/96 shadow-[0_0_44px_rgba(34,197,94,0.28)]',
    headerGradient: 'from-emerald-500/25 via-[#D4AF37]/20 to-transparent',
    reelCellBg: 'bg-[#07140B]/92 border-emerald-400/25',
    winCellGlow:
      'border-[#FCE9A6] bg-gradient-to-b from-emerald-500/40 to-[#D4AF37]/35 shadow-[0_0_26px_rgba(74,222,128,0.6)] scale-[1.04]',
    accentText: 'text-emerald-200',
    spinButtonClass:
      'bg-gradient-to-r from-lime-400 via-emerald-400 to-green-500 text-[#070913] shadow-[0_0_26px_rgba(34,197,94,0.5)]',
  },
  {
    id: 'classic_fruits',
    title: 'سلوت الفواكه الكلاسيكي',
    subtitle: '15 خط ربح (5×3) + مكافأة ثلاثي الكرز الذهبي',
    badge: '5×3 كلاسيكي',
    cols: 5,
    rows: 3,
    maxMultiplier: '×85',
    symbols: ['🍒', '🍋', '🍇', '🔔', '⭐', '7️⃣'],
    specialRuleTitle: 'ثلاثي الكرز الذهبي (+×2)',
    specialRuleDesc:
      '15 خط ربح أفقي ومتعرج على 5 بكرات، وظهور 3+ كرز 🍒 في الصف الأوسط يضيف مكافأة +×2 فورية.',
    paytable: [
      { combo: '7️⃣ ×3 / ×4 / ×5', mult: '×14 / ×35 / ×85', note: 'الجاكبوت الكلاسيكي' },
      { combo: '⭐ ×3 / ×4 / ×5', mult: '×8 / ×22 / ×50' },
      { combo: '🔔 ×3 / ×4 / ×5', mult: '×5 / ×14 / ×32' },
      { combo: '🍇 ×3 / ×4 / ×5', mult: '×3 / ×8 / ×20' },
      { combo: '🍋 ×3 / ×4 / ×5', mult: '×2 / ×5 / ×14' },
      { combo: '🍒 ×3 / ×4 / ×5', mult: '×1.5 / ×3.5 / ×9' },
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
    title: 'سلوت الهرم الملكي',
    subtitle: 'معبد النيل المقدس 5×3 + جعران الحظ المتناثر',
    badge: '5×3 فرعوني',
    cols: 5,
    rows: 3,
    maxMultiplier: '×75',
    symbols: ['🏺', '🐍', '⚱️', '☀️', '👁️', '🪲'],
    specialRuleTitle: 'جعران الحظ المتناثر (Scatter 🪲)',
    specialRuleDesc:
      '15 خط ربح فرعوني على 5×3، وظهور 3+ جعارين 🪲 في أي مكان يمنح مكافأة فورية +×6 إلى +×18.',
    paytable: [
      { combo: '👁️ ×3 / ×4 / ×5', mult: '×12 / ×30 / ×75', note: 'عين حورس الملكية' },
      { combo: '🪲 متناثر 3 / 4+', mult: '+×6 / +×18', note: 'في أي مكان باللوحة' },
      { combo: '☀️ ×3 / ×4 / ×5', mult: '×7 / ×18 / ×42', note: 'قرص الشمس الذهبي' },
      { combo: '⚱️ ×3 / ×4 / ×5', mult: '×4 / ×11 / ×25' },
      { combo: '🐍 ×3 / ×4 / ×5', mult: '×2.5 / ×7 / ×16' },
      { combo: '🏺 ×3 / ×4 / ×5', mult: '×1.5 / ×4 / ×10' },
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
    title: 'السلوت الملكي 3D',
    subtitle: 'ماكينة القصر بـ 5 بكرات أسطوانية 3D ورموز ملكية لامعة (تاج، ألماسة، صقر، سبيكة ذهب)',
    badge: '5×3 ملكي 3D',
    cols: 5,
    rows: 3,
    maxMultiplier: '×90',
    symbols: ['🪙', '⚜️', '🏆', '🦅', '💎', '👑'],
    specialRuleTitle: 'الرموز الملكية + 15 خط دفع إمبراطوري',
    specialRuleDesc:
      '15 خط ربح لاصطفاف التاج المرصع والألماسة الزرقاء والصقر الذهبي وسبيكة الذهب عبر 5 بكرات أسطوانية فاخرة!',
    paytable: [
      { combo: '👑 ×3 / ×4 / ×5', mult: '×15 / ×38 / ×90', note: 'التاج المرصع الأعظم' },
      { combo: '💎 ×3 / ×4 / ×5', mult: '×9 / ×24 / ×55', note: 'الألماسة الزرقاء النادرة' },
      { combo: '🦅 ×3 / ×4 / ×5', mult: '×6 / ×16 / ×38', note: 'الصقر الذهبي الملكي' },
      { combo: '🏆 ×3 / ×4 / ×5', mult: '×4 / ×11 / ×26', note: 'كأس القصر' },
      { combo: '⚜️ ×3 / ×4 / ×5', mult: '×2.5 / ×7 / ×18' },
      { combo: '🪙 ×3 / ×4 / ×5', mult: '×1.5 / ×4 / ×12', note: 'سبيكة الذهب 999.9' },
    ],
    cardGradient: 'from-[#2A1D08]/95 via-[#131937]/95 to-[#231036]/95',
    cabinetClass:
      'border-[#FCE9A6]/65 bg-gradient-to-b from-[#1E1508]/96 via-[#0C1229]/98 to-[#1B1206]/96 shadow-[0_0_46px_rgba(212,175,55,0.34)]',
    headerGradient: 'from-[#D4AF37]/30 via-indigo-500/20 to-transparent',
    reelCellBg: 'bg-[#090D1F]/92 border-[#D4AF37]/30',
    winCellGlow:
      'border-[#FCE9A6] bg-gradient-to-b from-[#D4AF37]/45 to-amber-700/35 shadow-[0_0_28px_rgba(252,233,166,0.75)] scale-[1.04]',
    accentText: 'text-[#FCE9A6]',
    spinButtonClass:
      'bg-gradient-to-r from-[#FCE9A6] via-[#D4AF37] to-[#B58922] text-[#070913] shadow-[0_0_28px_rgba(212,175,55,0.55)]',
  },
  {
    id: 'olympus_gates',
    title: 'بوابات الأوليمبوس',
    subtitle: 'ساحة زيوس 5×3 بنظام التجمّع الحر + صواعق المضاعفات العشوائية',
    badge: '5×3 أسطوري ⚡',
    cols: 5,
    rows: 3,
    maxMultiplier: '×500+',
    symbols: ['🏛️', '⏳', '💍', '🏆', '👑', '⚡'],
    specialRuleTitle: 'صواعق زيوس العشوائية (⚡ ×2 إلى ×25)',
    specialRuleDesc:
      'تربح عند تجمّع 4 رموز متشابهة أو أكثر في أي مكان باللوحة! وتُطلق كل صاعقة ⚡ مضاعفاً عشوائياً (×2 حتى ×25) يُجمع ويُضرب في كامل ربح الدورة.',
    paytable: [
      { combo: '⚡ صواعق زيوس', mult: '×2 – ×25 لكل صاعقة', note: 'تُجمع وتضاعف كامل الربح' },
      { combo: '👑 ×4 / ×6 / ×8+', mult: '×5 / ×16 / ×45' },
      { combo: '🏆 ×4 / ×6 / ×8+', mult: '×3.5 / ×11 / ×30' },
      { combo: '💍 ×4 / ×6 / ×8+', mult: '×2.5 / ×8 / ×22' },
      { combo: '⏳ ×4 / ×6 / ×8+', mult: '×2 / ×6 / ×16' },
      { combo: '🏛️ ×4 / ×6 / ×8+', mult: '×1.5 / ×4 / ×12' },
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
    title: 'سباق التوربو',
    subtitle: 'حلبة التوربو الليلية (5×3) + شعلات نايترو تضاعف سرعة الأرباح',
    badge: '5×3 توربو 🏎️',
    cols: 5,
    rows: 3,
    maxMultiplier: '×95',
    symbols: ['🛞', '⛽', '🏁', '🏆', '🔥', '🏎️'],
    specialRuleTitle: 'شعلة النايترو 🔥 (×1.5) + انطلاقة التوربو',
    specialRuleDesc:
      '15 خط سباق! أي شعلة نايترو 🔥 في الخط الفائز تزيد الربح ×1.5، وظهور 3+ سيارات 🏎️ في أي مكان يمنح دفعة +×8.',
    paytable: [
      { combo: '🏎️ ×3 / ×4 / ×5', mult: '×12 / ×32 / ×80', note: 'انطلاقة الجائزة الكبرى' },
      { combo: '🏆 ×3 / ×4 / ×5', mult: '×7 / ×18 / ×44' },
      { combo: '🏁 ×3 / ×4 / ×5', mult: '×4 / ×11 / ×28' },
      { combo: '⛽ ×3 / ×4 / ×5', mult: '×2.5 / ×7 / ×18' },
      { combo: '🛞 ×3 / ×4 / ×5', mult: '×1.5 / ×4.5 / ×12' },
      { combo: '🔥 نايترو + 🏎️ متناثر', mult: '×1.5 و +×8' },
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
    subtitle: 'واحة الرمال العربية (5×3) + مضاعفة المصباح السحري ×2',
    badge: '5×3 صحراوي 🏜️',
    cols: 5,
    rows: 3,
    maxMultiplier: '×80',
    symbols: ['🌴', '🐪', '🗡️', '🏜️', '🪔', '🪙'],
    specialRuleTitle: 'مصباح الواحة 🪔 (×2)',
    specialRuleDesc:
      '15 خط ربح عربي على 5×3، وإذا ظهر المصباح السحري 🪔 في الخانة الوسطى عند أي فوز يتضاعف ربح الدورة بالكامل ×2!',
    paytable: [
      { combo: '🪙 ×3 / ×4 / ×5', mult: '×12 / ×30 / ×80', note: 'دنانير الذهب الملكية' },
      { combo: '🪔 ×3 / ×4 / ×5', mult: '×9 / ×24 / ×58', note: 'في المنتصف يضاعف الربح ×2' },
      { combo: '🏜️ ×3 / ×4 / ×5', mult: '×6 / ×16 / ×36' },
      { combo: '🗡️ ×3 / ×4 / ×5', mult: '×4 / ×10 / ×24' },
      { combo: '🐪 ×3 / ×4 / ×5', mult: '×2.5 / ×6 / ×15' },
      { combo: '🌴 ×3 / ×4 / ×5', mult: '×1.5 / ×4 / ×10' },
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

interface GamesCenterPageProps {
  embedded?: boolean;
  compactRoomMode?: boolean;
  initialCategory?: CenterCategory;
  roomId?: string;
  onPlaySpent?: (coins: number) => void;
}

function getRoomBetLabel(bet: RoomGameRoundBet): string {
  const { selection } = bet;
  if (typeof selection.betType === 'string') {
    const rouletteLabels: Record<string, string> = {
      red: 'أحمر',
      black: 'أسود',
      even: 'زوجي',
      odd: 'فردي',
      dozen_1: '1–12',
      dozen_2: '13–24',
      dozen_3: '25–36',
      zero: 'صفر',
      straight: `رقم #${selection.targetNumber ?? '?'}`,
    };
    return rouletteLabels[selection.betType] || 'رهان روليت';
  }

  const diceLabels: Record<string, string> = {
    high: 'عالي',
    low: 'منخفض',
    seven: 'السبعة',
    doubles: 'تطابق',
    even: 'زوجي',
    odd: 'فردي',
    under_10: 'مجموع 3–10',
    over_11: 'مجموع 11–18',
    lucky_16: 'مجموع 16+',
    triple: 'ثلاثية',
  };
  const pick = typeof selection.pick === 'string' ? selection.pick : '';
  if (pick.startsWith('exact_')) return `رقم ${pick.slice(6)}`;
  return diceLabels[pick] || 'رهان نرد';
}

const DEFAULT_SLOT_MACHINE =
  SLOT_MACHINES.find((m) => m.id === 'crown_jewels') || SLOT_MACHINES[0];

export const GamesCenterPage: React.FC<GamesCenterPageProps> = ({
  embedded = false,
  compactRoomMode = false,
  initialCategory = 'slots',
  roomId,
  onPlaySpent,
}) => {
  const { user, updateLocalUser } = useAuth();
  const [category, setCategory] = useState<CenterCategory>(initialCategory);

  // Common wallet & session states
  const [bet, setBet] = useState<number>(250);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionTotalWon, setSessionTotalWon] = useState(0);
  const [history, setHistory] = useState<SpinHistoryItem[]>([]);

  // --- SLOTS STATE ---
  const [selectedId, setSelectedId] = useState<SlotGameId>(DEFAULT_SLOT_MACHINE.id);
  const activeMachine = useMemo(
    () => SLOT_MACHINES.find((m) => m.id === selectedId) || DEFAULT_SLOT_MACHINE,
    [selectedId]
  );
  const [grid, setGrid] = useState<string[][]>(() => makeInitialGrid(DEFAULT_SLOT_MACHINE));
  const [spinningCols, setSpinningCols] = useState<boolean[]>(() =>
    Array(DEFAULT_SLOT_MACHINE.cols).fill(false)
  );
  const [lockedColFlash, setLockedColFlash] = useState<boolean[]>(() =>
    Array(DEFAULT_SLOT_MACHINE.cols).fill(false)
  );
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
  const [wheelAngle, setWheelAngle] = useState<number>(0);
  const [isRouletteSpinning, setIsRouletteSpinning] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<RouletteSpinResponse | null>(null);
  const [roomGameRound, setRoomGameRound] = useState<RoomGameRoundState | null>(null);
  const [roomClockNow, setRoomClockNow] = useState(Date.now());
  const [roomClockOffset, setRoomClockOffset] = useState(0);
  const [isPlacingRoomBet, setIsPlacingRoomBet] = useState(false);
  const handledRoomRoundRef = useRef<string | null>(null);
  const roomRoundIntervalRef = useRef<number | null>(null);

  // --- MYSTERY BOXES STATE ---
  const [isOpeningBox, setIsOpeningBox] = useState(false);
  const [mysteryResult, setMysteryResult] = useState<MysteryBoxResponse | null>(null);

  // --- ROCK PAPER SCISSORS 3D STATE ---
  const [rpsChoice, setRpsChoice] = useState<RpsMove>('rock');
  const [isRpsPlaying, setIsRpsPlaying] = useState(false);
  const [rpsResult, setRpsResult] = useState<RpsPlayResponse | null>(null);

  const clearSpinTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (roomRoundIntervalRef.current !== null) {
      window.clearInterval(roomRoundIntervalRef.current);
      roomRoundIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearSpinTimers();
  }, []);

  const roomRoundGameKind: RoomGameKind | null =
    category === 'roulette'
      ? 'roulette'
      : category === 'dice' && diceGame !== 'ladder_dice'
      ? 'dice'
      : null;
  const roomRoundUserId = user?.id;
  const roomRoundEnabled = Boolean(
    compactRoomMode && roomId && roomRoundUserId && roomRoundGameKind
  );
  const roomBetSeconds = roomGameRound
    ? Math.max(
        0,
        Math.ceil(
          (Date.parse(roomGameRound.bettingEndsAt) - (roomClockNow + roomClockOffset)) / 1000
        )
      )
    : 0;
  const roomRevealSeconds = roomGameRound
    ? Math.max(
        0,
        Math.ceil(
          (Date.parse(roomGameRound.roundEndsAt) - (roomClockNow + roomClockOffset)) / 1000
        )
      )
    : 0;
  const currentRoomBet =
    roomGameRound?.bets.find((roundBet) => roundBet.userId === user?.id) ?? null;
  const roomBettingClosed = Boolean(
    roomRoundEnabled &&
      (!roomGameRound || roomGameRound.phase !== 'betting' || roomBetSeconds <= 0)
  );
  const roomBetControlsDisabled = Boolean(
    roomRoundEnabled && (roomBettingClosed || currentRoomBet || isPlacingRoomBet)
  );

  useEffect(() => {
    if (!roomRoundEnabled || !roomId || !roomRoundUserId || !roomRoundGameKind) {
      setRoomGameRound(null);
      setRoomClockOffset(0);
      return;
    }

    const cycleMs = 20_000;
    const bettingMs = 15_000;
    const syncRound = () => {
      const now = Date.now();
      const cycleIndex = Math.floor(now / cycleMs);
      const elapsed = now - cycleIndex * cycleMs;
      const betting = elapsed < bettingMs;
      const startedAt = cycleIndex * cycleMs;
      const bettingEndsAt = startedAt + bettingMs;
      const roundEndsAt = startedAt + cycleMs;
      const roundNumber = cycleIndex + 1;
      const roundId = `${roomId}_${roomRoundGameKind}_${roundNumber}`;
      const wheelIndex = Math.abs(roundNumber * 17 + 11) % 37;
      const number = ROULETTE_WHEEL_ORDER[wheelIndex];
      const result =
        roomRoundGameKind === 'roulette'
          ? {
              number,
              color:
                number === 0
                  ? ('green' as const)
                  : ROULETTE_REDS.has(number)
                  ? ('red' as const)
                  : ('black' as const),
              wheelIndex,
            }
          : null;

      setRoomClockNow(now);
      setRoomClockOffset(0);
      setRoomGameRound((previous) => {
        if (previous?.roundId === roundId) return previous;
        if (previous?.roundNumber === roundNumber) {
          return {
            ...previous,
            startedAt: new Date(startedAt).toISOString(),
            bettingEndsAt: new Date(bettingEndsAt).toISOString(),
            roundEndsAt: new Date(roundEndsAt).toISOString(),
            serverNow: new Date(now).toISOString(),
            phase: betting ? 'betting' : 'revealing',
            result: betting ? null : previous.result ?? result,
          };
        }

        return {
          roundId,
          roundNumber,
          startedAt: new Date(startedAt).toISOString(),
          bettingEndsAt: new Date(bettingEndsAt).toISOString(),
          roundEndsAt: new Date(roundEndsAt).toISOString(),
          serverNow: new Date(now).toISOString(),
          phase: betting ? 'betting' : 'revealing',
          result: betting ? null : result,
          bets: [],
        };
      });
    };

    syncRound();
    const syncId = window.setInterval(syncRound, 100);
    const clockId = window.setInterval(() => setRoomClockNow(Date.now()), 100);
    return () => {
      window.clearInterval(syncId);
      window.clearInterval(clockId);
    };
  }, [roomId, roomRoundEnabled, roomRoundGameKind, roomRoundUserId]);

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
    setLockedColFlash(Array(machine.cols).fill(false));
    setWinningCellSet(new Set());
    setLightningMap({});
    setLastResult(null);
    setErrorMsg(null);
  };

  const handleSpin = async () => {
    if (!user || isSpinning) return;
    if (user.coins < bet || user.coins <= 0) {
      setErrorMsg('رصيد الكوينز غير كافٍ للعب. اشحن محفظتك أو اختر رهاناً أقل.');
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
    setLockedColFlash(Array(machine.cols).fill(false));

    let tickCounter = 0;
    intervalRef.current = window.setInterval(() => {
      tickCounter++;
      if (tickCounter % 2 === 0) playSlotSpinTick();
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
      onPlaySpent?.(bet);

      const strikesMap: Record<string, number> = {};
      for (const st of result.lightningStrikes || []) {
        strikesMap[`${st.row}-${st.col}`] = st.mult;
      }

      for (let c = 0; c < machine.cols; c++) {
        const stopDelay = 520 + c * 260;
        const tId = window.setTimeout(() => {
          activeFlags[c] = false;
          setSpinningCols([...activeFlags]);
          playSlotReelStop(c);

          setLockedColFlash((prev) => prev.map((v, idx) => (idx === c ? true : v)));
          const flashResetId = window.setTimeout(() => {
            setLockedColFlash((prev) => prev.map((v, idx) => (idx === c ? false : v)));
          }, 420);
          timersRef.current.push(flashResetId);

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

            if (result.payout > 0) {
              const isBig = result.jackpotHit || result.multiplier >= 10;
              playCoinWinSound(isBig);
              fireGoldCoinConfetti(isBig ? 'jackpot' : 'normal');
            }
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
    if (user.coins < bet || user.coins <= 0) {
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
    playDiceTumbleSound();
    const rollInterval = window.setInterval(() => {
      playDiceTumbleSound();
      setDiceValues(Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6)));
    }, 115);

    try {
      const res = await playStandardDiceInSupabase(user.id, diceGame, bet, pick);
      onPlaySpent?.(bet);

      const t = window.setTimeout(() => {
        window.clearInterval(rollInterval);
        setIsDiceRolling(false);
        setDiceValues(res.dice);
        setDiceResult(res);
        updateLocalUser(res.user);
        playDiceLandSound();
        if (res.won) {
          const isBig = res.multiplier >= 4;
          playCoinWinSound(isBig);
          fireGoldCoinConfetti(isBig ? 'jackpot' : 'normal');
        }
        const titleMap: Record<string, string> = {
          double_dice: 'نرد الحظ المزدوج',
          prediction_dice: 'نرد التوقعات',
          speed_dice: 'نرد السرعة',
        };
        pushHistory(titleMap[diceGame] || 'ألعاب النرد', res.bet, res.payout, res.multiplier);
      }, 720);
      timersRef.current.push(t);
    } catch (err) {
      window.clearInterval(rollInterval);
      setIsDiceRolling(false);
      setErrorMsg(err instanceof Error ? err.message : 'تعذّر تنفيذ جولة النرد.');
    }
  };

  const handlePlaceRoomBet = async () => {
    if (
      !user ||
      !roomId ||
      !roomRoundGameKind ||
      !roomGameRound ||
      roomBetControlsDisabled ||
      user.coins < bet
    ) {
      return;
    }

    let selection: RoomGameBetSelection;
    if (roomRoundGameKind === 'roulette') {
      selection = {
        betType: rouletteBetType,
        ...(rouletteBetType === 'straight' ? { targetNumber: rouletteStraightNum } : {}),
      };
    } else if (diceGame === 'double_dice') {
      selection = { gameId: 'double_dice', pick: doublePick };
    } else if (diceGame === 'prediction_dice') {
      selection = { gameId: 'prediction_dice', pick: predPick };
    } else if (diceGame === 'speed_dice') {
      selection = { gameId: 'speed_dice', pick: speedPick };
    } else {
      return;
    }

    setErrorMsg(null);
    setIsPlacingRoomBet(true);
    try {
      const nextRound = await placeRoomGameBetInSupabase(
        roomId,
        roomRoundGameKind,
        roomGameRound.roundNumber,
        user.id,
        bet,
        selection
      );
      setRoomGameRound(nextRound);
      onPlaySpent?.(bet);
      const settleDelay = Math.max(
        0,
        Date.parse(nextRound.bettingEndsAt) - (Date.now() + roomClockOffset) + 100
      );
      window.setTimeout(() => {
        void refreshGameUserFromSupabase(user.id)
          .then(updateLocalUser)
          .catch((error: unknown) => {
            setErrorMsg(
              error instanceof Error
                ? `تعذّر إتمام تسوية الجولة: ${error.message}`
                : 'تعذّر إتمام تسوية الجولة.'
            );
          });
      }, settleDelay);
      try {
        updateLocalUser(await refreshGameUserFromSupabase(user.id));
      } catch (error) {
        setErrorMsg(
          error instanceof Error
            ? `تم تسجيل الرهان، لكن تعذّر تحديث رصيدك: ${error.message}`
            : 'تم تسجيل الرهان، لكن تعذّر تحديث رصيدك.'
        );
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'تعذّر تسجيل رهان الجولة.');
    } finally {
      setIsPlacingRoomBet(false);
    }
  };

  useEffect(() => {
    if (
      !roomRoundEnabled ||
      !roomGameRound ||
      roomGameRound.phase !== 'revealing' ||
      !roomGameRound.result ||
      handledRoomRoundRef.current === roomGameRound.roundId ||
      !user
    ) {
      return;
    }

    const settledRound = roomGameRound;
    const ownBet = settledRound.bets.find((roundBet) => roundBet.userId === user.id) ?? null;
    handledRoomRoundRef.current = settledRound.roundId;
    void refreshGameUserFromSupabase(user.id)
      .then(updateLocalUser)
      .catch((error: unknown) => {
        setErrorMsg(
          error instanceof Error ? `تعذّر تحديث رصيد الجولة: ${error.message}` : 'تعذّر تحديث رصيد الجولة.'
        );
      });

    if ('number' in settledRound.result) {
      const outcome = settledRound.result;
      setRouletteResult(null);
      setIsRouletteSpinning(true);
      const sliceAngle = 360 / 37;
      const targetSectorAngle = ((360 - outcome.wheelIndex * sliceAngle) % 360 + 360) % 360;
      setWheelAngle((previous) => previous + 1800 + targetSectorAngle);
      const timeoutId = window.setTimeout(() => {
        setIsRouletteSpinning(false);
        setRouletteResult({
          winningNumber: outcome.number,
          winningColor: outcome.color,
          wheelIndex: outcome.wheelIndex,
          won: ownBet?.isWinner ?? false,
          multiplier: ownBet?.multiplier ?? 0,
          payout: ownBet?.payout ?? 0,
          bet: ownBet?.amount ?? 0,
          xpGain: 0,
          user,
        });
        if (ownBet?.isWinner) {
          playCoinWinSound(ownBet.multiplier >= 10);
          fireGoldCoinConfetti(ownBet.multiplier >= 10 ? 'jackpot' : 'normal');
        }
        if (ownBet) {
          pushHistory(
            `الروليت الملكية (#${outcome.number})`,
            ownBet.amount,
            ownBet.payout,
            ownBet.multiplier
          );
        }
      }, 4000);
      timersRef.current.push(timeoutId);
      return;
    }

    const diceCount =
      diceGame === 'double_dice' ? 2 : diceGame === 'prediction_dice' ? 1 : 3;
    const finalDice = settledRound.result.dice.slice(0, diceCount);
    setDiceResult(null);
    setIsDiceRolling(true);
    playDiceTumbleSound();
    roomRoundIntervalRef.current = window.setInterval(() => {
      playDiceTumbleSound();
      setDiceValues(Array.from({ length: diceCount }, () => 1 + Math.floor(Math.random() * 6)));
    }, 115);
    const timeoutId = window.setTimeout(() => {
      if (roomRoundIntervalRef.current !== null) {
        window.clearInterval(roomRoundIntervalRef.current);
        roomRoundIntervalRef.current = null;
      }
      setIsDiceRolling(false);
      setDiceValues(finalDice);
      playDiceLandSound();
      if (ownBet?.isWinner) {
        playCoinWinSound(ownBet.multiplier >= 4);
        fireGoldCoinConfetti(ownBet.multiplier >= 4 ? 'jackpot' : 'normal');
      }
      if (ownBet) {
        const titles: Record<string, string> = {
          double_dice: 'نرد الحظ المزدوج',
          prediction_dice: 'نرد التوقعات',
          speed_dice: 'نرد السرعة',
        };
        pushHistory(titles[diceGame] || 'ألعاب النرد', ownBet.amount, ownBet.payout, ownBet.multiplier);
      }
    }, 4000);
    timersRef.current.push(timeoutId);
  }, [roomGameRound, roomRoundEnabled, diceGame, user, updateLocalUser, pushHistory]);

  const handleLadderAction = async (action: 'roll' | 'cashout') => {
    if (!user || isDiceRolling) return;
    if (action === 'roll' && !ladderSession && (user.coins < bet || user.coins <= 0)) {
      setErrorMsg('رصيد الكوينز غير كافٍ لبدء تحدي نرد السلم.');
      return;
    }

    setErrorMsg(null);
    setIsDiceRolling(true);
    if (action === 'roll') playDiceTumbleSound();
    try {
      const res = await playLadderActionInSupabase(user.id, action, bet);
      if (action === 'roll' && !ladderSession) {
        onPlaySpent?.(bet);
      }
      const delay = action === 'roll' ? 600 : 120;
      const t = window.setTimeout(() => {
        setIsDiceRolling(false);
        setLadderDie(res.die);
        setLadderSession(res.session);
        setLadderMessage(res.message);
        setLadderOutcome(res.status);
        updateLocalUser(res.user);
        if (action === 'roll') playDiceLandSound();

        if (res.status === 'cashed_out' || res.status === 'summit') {
          playCoinWinSound(res.status === 'summit');
          fireGoldCoinConfetti(res.status === 'summit' ? 'jackpot' : 'normal');
          pushHistory('نرد السلم التفاعلي', bet, res.payout, res.multiplier);
        } else if (res.status === 'climbed') {
          playCoinWinSound(false);
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
    if (user.coins < bet || user.coins <= 0) {
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
      onPlaySpent?.(bet);

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
        if (res.won) {
          playCoinWinSound(res.multiplier >= 10);
          fireGoldCoinConfetti(res.multiplier >= 10 ? 'jackpot' : 'normal');
        }
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
    if (user.coins < bet || user.coins <= 0) {
      setErrorMsg('رصيد الكوينز غير كافٍ لفتح صندوق الحظ.');
      return;
    }

    setErrorMsg(null);
    setIsOpeningBox(true);
    try {
      const res = await openMysteryBoxInSupabase(user.id, bet, boxIndex);
      onPlaySpent?.(bet);
      setMysteryResult(res);
      updateLocalUser(res.user);
      if (res.won) {
        playCoinWinSound(res.multiplier >= 5);
        fireGoldCoinConfetti(res.multiplier >= 5 ? 'jackpot' : 'normal');
      }
      pushHistory('صناديق الحظ الملكية', res.bet, res.payout, res.multiplier);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذّر فتح الصندوق.');
    } finally {
      setIsOpeningBox(false);
    }
  };

  // --- HANDLERS: ROCK PAPER SCISSORS 3D ---
  const handlePlayRps = async (chosenMove?: RpsMove) => {
    const move = chosenMove || rpsChoice;
    if (!user || isRpsPlaying) return;
    if (user.coins < bet || user.coins <= 0) {
      setErrorMsg('رصيد الكوينز غير كافٍ للعب حجر ورقة مقص 3D.');
      return;
    }

    setRpsChoice(move);
    setErrorMsg(null);
    setRpsResult(null);
    setIsRpsPlaying(true);
    playDiceTumbleSound();

    try {
      const res = await playRpsInSupabase(user.id, bet, move);
      onPlaySpent?.(bet);

      const t = window.setTimeout(() => {
        setIsRpsPlaying(false);
        setRpsResult(res);
        updateLocalUser(res.user);
        playDiceLandSound();
        if (res.outcome === 'win') {
          playCoinWinSound(false);
          fireGoldCoinConfetti('normal');
        }
        pushHistory('حجر ورقة مقص 3D', res.bet, res.payout, res.multiplier);
      }, 650);
      timersRef.current.push(t);
    } catch (err) {
      setIsRpsPlaying(false);
      setErrorMsg(err instanceof Error ? err.message : 'تعذّر تنفيذ جولة حجر ورقة مقص.');
    }
  };

  const anyBusy = isSpinning || isDiceRolling || isRouletteSpinning || isOpeningBox || isRpsPlaying;

  if (!user) return null;

  return (
    <div
      className={
        compactRoomMode
          ? category === 'roulette'
            ? 'flex h-full min-h-0 flex-col'
            : 'space-y-2.5'
          : embedded
          ? 'space-y-4 sm:space-y-5'
          : 'w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 space-y-6'
      }
    >
      {/* Header + Live Wallet Sync Strip (Hidden in compact room mode) */}
      {!compactRoomMode && (
        embedded ? (
          <section className="rounded-2xl bg-[#070913]/75 border border-[#D4AF37]/25 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-[#FCE9A6]" />
              <span className="text-xs sm:text-sm font-extrabold text-[#FCE9A6]">
                14 لعبة حصرية مرتبطة بمحفظتك مباشرة
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-[#0B0F20]/90 border border-[#D4AF37]/30 px-3 py-1.5 flex items-center gap-1.5 text-xs">
                <Coins className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="font-mono-num font-extrabold text-[#FCE9A6]">
                  {user.coins.toLocaleString('en-US')}
                </span>
              </div>
              <div className="rounded-xl bg-[#0B0F20]/90 border border-emerald-400/30 px-3 py-1.5 flex items-center gap-1.5 text-xs">
                <Trophy className="w-3.5 h-3.5 text-emerald-300" />
                <span className="font-mono-num font-extrabold text-emerald-300">
                  +{sessionTotalWon.toLocaleString('en-US')}
                </span>
              </div>
            </div>
          </section>
        ) : (
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
                    ماكينات السلوت الثلاثية الأبعاد + طاولة النرد 3D + الروليت الملكية وصناديق الحظ
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
        )
      )}

      {/* Main Category Switcher (Hidden in compact room mode) */}
      {!compactRoomMode && (
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {(
            [
              {
                id: 'slots',
                title: 'السلوت الملكي 3D',
                sub: '9 ماكينات ثلاثية الأبعاد',
                icon: Crown,
              },
              {
                id: 'dice',
                title: 'طاولة النرد 3D',
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
              {
                id: 'rps',
                title: 'حجر ورقة مقص 3D',
                sub: 'مواجهة سريعة بمضاعف ×1.95',
                icon: Hand,
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
      )}

      {roomRoundEnabled && (
        <section className="shrink-0 rounded-2xl border border-[#D4AF37]/40 bg-[#0d111e] px-3 py-2.5 text-right shadow-[0_0_22px_rgba(212,175,55,0.12)]">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-[#FCE9A6]">
                {roomGameRound?.phase === 'betting' && roomBetSeconds > 0
                  ? `وقت الرهان المتبقي: ${roomBetSeconds}ث`
                  : roomGameRound
                  ? `أُغلق الرهان — النتيجة خلال: ${roomRevealSeconds}ث`
                  : ''}
              </p>
              <p className="text-[10px] text-slate-400">
                {roomGameRound?.phase === 'betting' && roomBetSeconds > 0
                  ? 'اختر توقعك وقيمة الرهان قبل انتهاء الوقت'
                  : 'الرهانات مغلقة ويجري عرض النتيجة للجميع'}
              </p>
            </div>
            <span className="shrink-0 rounded-lg border border-[#D4AF37]/30 bg-[#14161f] px-2 py-1 text-[10px] font-bold text-[#FCE9A6]">
              {roomGameRound ? `الجولة ${roomGameRound.roundNumber}` : '—'}
            </span>
          </div>

          {roomGameRound?.result && (
            <p className="mt-1 text-[11px] font-extrabold text-emerald-300">
              {'number' in roomGameRound.result
                ? `النتيجة المشتركة: #${roomGameRound.result.number} — ${
                    roomGameRound.result.color === 'red'
                      ? 'أحمر'
                      : roomGameRound.result.color === 'black'
                      ? 'أسود'
                      : 'أخضر'
                  }`
                : `النتيجة المشتركة: ${roomGameRound.result.dice.join(' - ')} (المجموع ${roomGameRound.result.sum})`}
            </p>
          )}

          <div className="mt-1.5 max-h-20 space-y-1 overflow-y-auto no-scrollbar">
            {roomGameRound?.bets.length ? (
              roomGameRound.bets.map((roundBet) => (
                <div
                  key={roundBet.userId}
                  className="flex items-center justify-between gap-2 text-[10px]"
                >
                  <span className="min-w-0 truncate text-slate-200">
                    {roundBet.displayName}
                    <span className="mx-1 text-slate-500">·</span>
                    {getRoomBetLabel(roundBet)}
                    <span className="mx-1 text-slate-500">·</span>
                    {roundBet.amount.toLocaleString('en-US')} كوين
                  </span>
                  <span
                    className={`shrink-0 font-bold ${
                      roomGameRound.phase === 'revealing'
                        ? roundBet.isWinner
                          ? 'text-emerald-300'
                          : 'text-slate-500'
                        : 'text-[#FCE9A6]'
                    }`}
                  >
                    {roomGameRound.phase === 'revealing'
                      ? roundBet.isWinner
                        ? `فاز +${roundBet.payout.toLocaleString('en-US')}`
                        : 'لم يفز'
                      : 'يراهن'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-slate-500">لم تُسجّل رهانات في هذه الجولة بعد.</p>
            )}
          </div>
        </section>
      )}

      {/* Insufficient Coins Strict Guard Banner */}
      {user.coins < 100 && (
        <div className="rounded-2xl border border-amber-400/50 bg-amber-950/55 px-3.5 py-2 flex items-center justify-between gap-2 text-[11px] sm:text-xs text-[#FCE9A6]">
          <span>رصيدك الحالي ({user.coins.toLocaleString('en-US')} كوينز) لا يكفي للعب — يلزم 100 كوينز على الأقل.</span>
          <Link
            to="/wallet"
            className="shrink-0 rounded-xl bg-[#D4AF37] text-[#070913] px-2.5 py-1 font-extrabold"
          >
            شحن الآن
          </Link>
        </div>
      )}

      {errorMsg && category !== 'roulette' && (
        <div className="rounded-2xl border border-rose-500/45 bg-rose-950/60 px-3.5 py-2 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* ===================== CATEGORY 1: ROYAL 3D SLOTS ===================== */}
      {category === 'slots' && (
        <>
          {compactRoomMode ? (
            <div className="flex items-center gap-1.5 overflow-x-auto touch-pan-x no-scrollbar pb-0.5">
              {SLOT_MACHINES.map((machine) => {
                const isSelected = machine.id === activeMachine.id;
                return (
                  <button
                    key={machine.id}
                    type="button"
                    disabled={isSpinning}
                    onClick={() => handleSelectMachine(machine)}
                    className={`shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-[#D4AF37]/25 border-[#FCE9A6] text-[#FCE9A6]'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:border-[#D4AF37]/40'
                    }`}
                  >
                    <span>
                      <RoyalSlotSymbol3D symbol={machine.symbols[machine.symbols.length - 1]} compact />
                    </span>
                    <span>{machine.title}</span>
                  </button>
                );
              })}
            </div>
          ) : (
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
                      <RoyalSlotSymbol3D symbol={machine.symbols[machine.symbols.length - 1]} compact />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <div className="flex items-center gap-1 leading-none">
                        {machine.symbols.slice(0, 4).map((s, idx) => (
                          <RoyalSlotSymbol3D key={idx} symbol={s} compact />
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
          )}

          <section className={compactRoomMode ? 'space-y-2' : 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start'}>
            <div
              className={`${compactRoomMode ? 'rounded-2xl border-2 p-2.5 space-y-2' : 'lg:col-span-8 rounded-[2rem] border-2 p-5 sm:p-7 space-y-5'} relative overflow-hidden transition-all duration-300 ${activeMachine.cabinetClass}`}
            >
              {/* Royal Gold Casino Marquee Header (Compact or Full) */}
              {!compactRoomMode ? (
                <div
                  className={`rounded-2xl bg-gradient-to-r ${activeMachine.headerGradient} border border-[#FCE9A6]/25 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
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
                    <span className="rounded-xl bg-[#070913]/85 border border-[#D4AF37]/45 px-3 py-1.5 text-xs font-extrabold font-mono-num text-[#FCE9A6]">
                      الجائزة الكبرى {activeMachine.maxMultiplier}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-[#FCE9A6]" />
                    <span className="text-xs font-extrabold text-[#FCE9A6]">{activeMachine.title}</span>
                  </div>
                  <span className="text-[10px] font-mono-num text-amber-200/85 bg-[#070913]/80 border border-[#D4AF37]/35 rounded-lg px-2 py-0.5">
                    أقصى ربح {activeMachine.maxMultiplier}
                  </span>
                </div>
              )}

              {/* 3D Metallic Gold Cylindrical Reel Drum Cabinet + Chasing Lights + Interactive Lever */}
              <div dir="ltr" className="flex items-center gap-1 sm:gap-1.5">
                <div className="flex-1 min-w-0 rounded-2xl sm:rounded-3xl p-[3px] bg-gradient-to-br from-[#FFFBEB] via-[#D4AF37] to-[#6D4C0B] shadow-[0_16px_38px_rgba(0,0,0,0.85),0_0_32px_rgba(212,175,55,0.34)]">
                  <div
                    className={`rounded-[14px] sm:rounded-[20px] bg-gradient-to-b from-[#04060E] via-[#0B1024] to-[#04060E] border-2 border-[#D4AF37]/55 ${
                      compactRoomMode ? 'p-1.5 sm:p-2' : 'p-3 sm:p-4'
                    } shadow-[inset_0_12px_28px_rgba(0,0,0,0.85)] relative overflow-hidden`}
                  >
                    <SlotMarqueePerimeter
                      spinning={isSpinning}
                      winning={Boolean(lastResult && !isSpinning && lastResult.payout > 0)}
                      count={compactRoomMode ? 12 : 18}
                    />

                    {/* Jackpot Celebration Overlay */}
                    {lastResult && !isSpinning && (lastResult.jackpotHit || lastResult.multiplier >= 10) && (
                      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                        <div className="rounded-2xl border-2 border-[#FEF08A] bg-gradient-to-r from-[#451A03]/95 via-[#B45309]/95 to-[#451A03]/95 px-5 py-2.5 flex items-center gap-2.5 shadow-[0_0_40px_rgba(250,204,21,0.92)] animate-bounce">
                          <Fluent3DAsset glyph="👑" alt="Jackpot" priority sizeClass="w-9 h-9" />
                          <div className="text-center">
                            <span dir="ltr" className="block text-sm font-black tracking-widest text-[#FEF08A]">
                              JACKPOT! ×{lastResult.multiplier}
                            </span>
                            <span className="block text-xs font-mono-num font-extrabold text-white">
                              +{lastResult.payout.toLocaleString('en-US')}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cylindrical Metallic Top & Bottom Gloss Bevel */}
                    <div
                      className="pointer-events-none absolute inset-x-0 top-5 h-5 z-10"
                      style={{
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.82), transparent)',
                      }}
                    />
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-5 h-5 z-10"
                      style={{
                        background: 'linear-gradient(to top, rgba(0,0,0,0.82), transparent)',
                      }}
                    />

                    <div
                      className="grid gap-1.5 sm:gap-2.5 my-1"
                      style={{
                        gridTemplateColumns: `repeat(${activeMachine.cols}, minmax(0, 1fr))`,
                      }}
                    >
                  {Array.from({ length: activeMachine.cols }).map((_, cIdx) => {
                    const colSpinning = Boolean(spinningCols[cIdx]);
                    const colLocked = Boolean(lockedColFlash[cIdx]);
                    return (
                      <div
                        key={cIdx}
                        className={`relative rounded-xl sm:rounded-2xl border overflow-hidden transition-all duration-200 ${
                          colSpinning
                            ? 'border-amber-300/60 bg-gradient-to-b from-[#070B19] via-[#172042] to-[#070B19] shadow-[inset_0_0_18px_rgba(251,191,36,0.2)]'
                            : colLocked
                            ? 'border-[#FCE9A6] bg-gradient-to-b from-[#131934] via-[#1B2449] to-[#0C1022] animate-reel-lock'
                            : 'border-[#D4AF37]/30 bg-gradient-to-b from-[#080B18] via-[#121836] to-[#080B18]'
                        }`}
                      >
                        {/* Curved Cylindrical Drum Highlight Streak */}
                        <div
                          className="pointer-events-none absolute inset-0 z-10 opacity-45"
                          style={{
                            background:
                              'linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(255,255,255,0.09) 24%, rgba(255,255,255,0.03) 50%, rgba(0,0,0,0.6) 100%)',
                          }}
                        />

                        {/* Column Rows */}
                        <div className={`flex flex-col ${colSpinning ? 'animate-slot-cylinder' : ''}`}>
                          {Array.from({ length: activeMachine.rows }).map((__, rIdx) => {
                            const key = `${rIdx}-${cIdx}`;
                            const sym =
                              grid[rIdx]?.[cIdx] ??
                              activeMachine.symbols[(rIdx + cIdx) % activeMachine.symbols.length];
                            const isWinCell = winningCellSet.has(key);
                            const strikeMult = lightningMap[key];

                            return (
                              <div
                                key={key}
                                className={`relative ${
                                  compactRoomMode
                                    ? 'h-11 sm:h-12'
                                    : activeMachine.rows >= 4
                                    ? 'h-16 sm:h-20'
                                    : 'h-20 sm:h-24'
                                } flex items-center justify-center border-b last:border-b-0 border-white/5 transition-all ${
                                  isWinCell
                                    ? 'bg-gradient-to-r from-[#D4AF37]/30 via-amber-400/35 to-[#D4AF37]/30 shadow-[inset_0_0_16px_rgba(252,233,166,0.65)] scale-[1.03]'
                                    : ''
                                }`}
                              >
                                <div className={colSpinning ? 'blur-[1px] opacity-85 scale-90' : ''}>
                                  <RoyalSlotSymbol3D
                                    symbol={sym}
                                    compact={compactRoomMode || activeMachine.rows >= 4}
                                    winning={isWinCell}
                                  />
                                </div>
                                {!colSpinning && strikeMult && (
                                  <span className="absolute bottom-0.5 right-0.5 rounded-md bg-[#070913]/90 border border-[#FCE9A6]/80 px-1 py-[1px] text-[9px] font-extrabold font-mono-num text-[#FCE9A6]">
                                    ×{strikeMult}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                    </div>
                    <SlotMarqueePerimeter
                      spinning={isSpinning}
                      winning={Boolean(lastResult && !isSpinning && lastResult.payout > 0)}
                      count={compactRoomMode ? 12 : 18}
                    />
                  </div>
                </div>

                {/* Interactive Pullable 3D Slot Lever */}
                <SlotMachine3DLever
                  compact={compactRoomMode}
                  spinning={isSpinning}
                  disabled={user.coins < bet || user.coins <= 0}
                  onPull={() => void handleSpin()}
                />
              </div>

              {lastResult && !isSpinning && (
                <div
                  className={`rounded-xl sm:rounded-2xl border ${
                    compactRoomMode ? 'px-3 py-1.5' : 'p-4'
                  } transition-all ${
                    lastResult.payout > 0
                      ? 'border-[#FCE9A6]/80 bg-gradient-to-r from-[#D4AF37]/30 via-emerald-950/60 to-[#D4AF37]/25 shadow-[0_0_24px_rgba(212,175,55,0.35)]'
                      : 'border-white/10 bg-[#070913]/80'
                  }`}
                >
                  {lastResult.payout > 0 ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-[#FCE9A6]">
                        <Sparkles className="w-4 h-4 text-[#F3D37A] shrink-0" />
                        <span>
                          {lastResult.jackpotHit
                            ? 'جاكبوت ملكي فائق! 🎉'
                            : 'فوز ملكي! أُضيف لمحفظتك'}
                        </span>
                      </div>
                      <div className="text-left font-mono-num shrink-0">
                        <span className="text-sm sm:text-xl font-extrabold text-emerald-300">
                          +{lastResult.payout.toLocaleString('en-US')}
                        </span>
                        <span className="text-[10px] text-[#FCE9A6] mr-1.5">
                          (×{lastResult.multiplier})
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-300">
                      <span>لم يتطابق خط ربح — جرب الدورة التالية!</span>
                      <span className="font-mono-num text-[#F3D37A]">+{lastResult.xpGain} XP</span>
                    </div>
                  )}
                </div>
              )}

              {/* Bet Chips + Spin CTA */}
              <div
                className={`rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/25 ${
                  compactRoomMode ? 'p-2 space-y-2' : 'p-4 space-y-3.5'
                }`}
              >
                {!compactRoomMode && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-[#D4AF37]" />
                      <span>قيمة الرهان للدورة (كوينز):</span>
                    </span>
                    <span className="text-xs font-mono-num text-[#FCE9A6]">
                      الرهان المحدد: {bet.toLocaleString('en-US')} كوينز
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                  {BET_AMOUNTS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      disabled={isSpinning}
                      onClick={() => setBet(val)}
                      className={`${
                        compactRoomMode ? 'min-h-[30px] text-[10px]' : 'min-h-[40px] text-xs'
                      } rounded-xl font-extrabold font-mono-num border transition cursor-pointer disabled:opacity-50 ${
                        bet === val
                          ? 'bg-[#D4AF37] text-[#070913] border-[#FCE9A6] shadow-[0_0_14px_rgba(212,175,55,0.4)]'
                          : 'bg-white/5 border-white/15 text-slate-200 hover:border-[#D4AF37]/50'
                      }`}
                    >
                      {val >= 1000 ? `${val / 1000}K` : val}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={isSpinning || user.coins < bet || user.coins <= 0}
                  onClick={handleSpin}
                  className={`w-full ${
                    compactRoomMode ? 'min-h-[40px] text-xs sm:text-sm' : 'min-h-[52px] text-base'
                  } rounded-xl sm:rounded-2xl font-extrabold flex items-center justify-center gap-2 cursor-pointer transition active:scale-[0.99] disabled:opacity-45 disabled:cursor-not-allowed ${activeMachine.spinButtonClass}`}
                >
                  <RotateCw className={`${compactRoomMode ? 'w-4 h-4' : 'w-5 h-5'} ${isSpinning ? 'animate-spin' : ''}`} />
                  <span>
                    {isSpinning
                      ? 'البكرات 3D تدور...'
                      : user.coins < bet || user.coins <= 0
                      ? 'رصيدك غير كافٍ للعب'
                      : `تدوير السلوت (${bet.toLocaleString('en-US')} كوينز)`}
                  </span>
                </button>
              </div>
            </div>

            {!compactRoomMode && (
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
            )}
          </section>
        </>
      )}

      {/* ===================== CATEGORY 2: 3D ROYAL DICE GAMES ===================== */}
      {category === 'dice' && (
        <section className={compactRoomMode ? 'space-y-2' : 'space-y-5'}>
          {compactRoomMode ? (
            <div className="flex items-center gap-1.5 overflow-x-auto touch-pan-x no-scrollbar">
              {(
                [
                  { id: 'double_dice', title: 'نرد مزدوج', badge: '×4.8' },
                  { id: 'prediction_dice', title: 'نرد التوقعات', badge: '×5.2' },
                  { id: 'speed_dice', title: 'نرد السرعة', badge: '×12' },
                  { id: 'ladder_dice', title: 'نرد السلم', badge: '×12' },
                ] as const
              ).map((d) => {
                const selected = diceGame === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    disabled={isDiceRolling || roomBetControlsDisabled}
                    onClick={() => handleSelectDiceGame(d.id)}
                    className={`shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                      selected
                        ? 'bg-[#D4AF37]/25 border-[#FCE9A6] text-[#FCE9A6]'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    <Dices className="w-3 h-3" />
                    <span>{d.title}</span>
                    <span className="text-[9px] font-mono-num opacity-80">{d.badge}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {(
                [
                  {
                    id: 'double_dice',
                    title: 'نرد الحظ المزدوج',
                    desc: 'نردان ثلاثيا الأبعاد: عالي / منخفض / السبعة الذهبية / تطابق',
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
                    desc: '3 نردات 3D سريعة: مجموع 16+ أو الثلاثية المتطابقة',
                    badge: 'حتى ×12.0',
                  },
                ] as const
              ).map((d) => {
                const selected = diceGame === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    disabled={isDiceRolling || roomBetControlsDisabled}
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
                      <Fluent3DAsset glyph="🎲" alt={d.title} priority sizeClass="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-extrabold text-white">{d.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{d.desc}</p>
                  </button>
                );
              })}
            </div>
          )}

          <div
            className={`royal-glass ${
              compactRoomMode ? 'rounded-2xl p-2.5 space-y-2' : 'rounded-[2rem] p-5 sm:p-7 space-y-5'
            } border border-[#D4AF37]/35`}
          >
            {diceGame !== 'ladder_dice' ? (
              <>
                {!compactRoomMode && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-extrabold text-[#FCE9A6]">
                        {diceGame === 'double_dice'
                          ? 'نرد الحظ المزدوج 3D (نردان)'
                          : diceGame === 'prediction_dice'
                          ? 'نرد التوقعات الدقيق 3D'
                          : 'نرد السرعة الخاطف 3D (3 نردات)'}
                      </h2>
                      <p className="text-xs text-slate-300 mt-0.5">
                        طاولة المخمل الفاخرة — اختر توقعك وقيمة الرهان ثم أطلق النرد ثلاثي الأبعاد
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#070913]/85 border border-[#D4AF37]/30 px-3.5 py-2 text-xs font-mono-num text-[#F3D37A]">
                      المجموع الحالي: {diceValues.reduce((a, b) => a + b, 0)}
                    </div>
                  </div>
                )}

                {/* Luxury Emerald Velvet 3D Dice Stage */}
                <div
                  className={`velvet-table-surface rounded-2xl sm:rounded-3xl border-[4px] border-[#4A2511] ${
                    compactRoomMode ? 'py-4 px-3 gap-4' : 'py-9 px-4 gap-6 sm:gap-10'
                  } flex flex-wrap items-center justify-center relative overflow-hidden`}
                >
                  {/* Subtle Gold Table Ring Accent */}
                  <div className="pointer-events-none absolute inset-2 rounded-2xl border border-[#FCE9A6]/25" />
                  <span className="absolute top-2 left-3 rounded-lg bg-black/50 border border-[#D4AF37]/40 px-2 py-0.5 text-[10px] font-mono-num text-[#FCE9A6]">
                    المجموع: {diceValues.reduce((a, b) => a + b, 0)}
                  </span>

                  {diceValues.map((val, idx) => (
                    <Royal3DDieCube
                      key={idx}
                      value={val}
                      rolling={isDiceRolling}
                      compact={compactRoomMode}
                    />
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
                        disabled={isDiceRolling || roomBetControlsDisabled}
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
                          disabled={isDiceRolling || roomBetControlsDisabled}
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
                            disabled={isDiceRolling || roomBetControlsDisabled}
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
                        disabled={isDiceRolling || roomBetControlsDisabled}
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

                <div className="space-y-2 pt-0.5">
                  <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                    {BET_AMOUNTS.map((val) => (
                      <button
                        key={val}
                        type="button"
                        disabled={isDiceRolling || roomBetControlsDisabled}
                        onClick={() => setBet(val)}
                        className={`${
                          compactRoomMode ? 'min-h-[30px] text-[10px]' : 'min-h-[40px] text-xs'
                        } rounded-xl font-extrabold font-mono-num border cursor-pointer transition ${
                          bet === val
                            ? 'bg-[#D4AF37] text-[#070913] border-[#FCE9A6]'
                            : 'bg-white/5 border-white/15 text-slate-200 hover:border-[#D4AF37]/45'
                        }`}
                      >
                        {val >= 1000 ? `${val / 1000}K` : val}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={
                      isDiceRolling ||
                      roomBetControlsDisabled ||
                      user.coins < bet ||
                      user.coins <= 0
                    }
                    onClick={roomRoundEnabled ? handlePlaceRoomBet : handlePlayStandardDice}
                    className={`gold-btn w-full ${
                      compactRoomMode ? 'min-h-[40px] text-xs sm:text-sm' : 'min-h-[52px] text-base'
                    } rounded-xl sm:rounded-2xl font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed`}
                  >
                    <Dices className={`${compactRoomMode ? 'w-4 h-4' : 'w-5 h-5'} ${isDiceRolling ? 'animate-spin' : ''}`} />
                    <span>
                      {isPlacingRoomBet
                        ? 'جارٍ تسجيل الرهان...'
                        : isDiceRolling
                        ? 'النرد 3D يتدحرج...'
                        : roomRoundEnabled && currentRoomBet
                        ? 'تم تسجيل رهانك — انتظر النتيجة'
                        : roomRoundEnabled && roomBettingClosed
                        ? 'انتظر بداية الجولة التالية'
                        : user.coins < bet || user.coins <= 0
                        ? 'رصيدك غير كافٍ للعب'
                        : roomRoundEnabled
                        ? `تسجيل الرهان (${bet.toLocaleString('en-US')} كوينز)`
                        : `رمي النرد 3D (${bet.toLocaleString('en-US')} كوينز)`}
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

                  <div className="lg:col-span-5 velvet-table-surface rounded-3xl border-[4px] border-[#4A2511] p-5 flex flex-col items-center justify-center gap-4">
                    <Royal3DDieCube value={ladderDie} rolling={isDiceRolling} compact={compactRoomMode} />
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
        <section className="royal-glass flex max-h-[82vh] min-h-0 flex-1 flex-col justify-between gap-2 overflow-y-auto rounded-[2rem] border border-[#D4AF37]/35 p-3">
          {/* Wheel Showcase */}
          <div className="flex min-h-0 flex-col items-center justify-center gap-2">
            <div className="relative h-44 w-44 shrink-0 flex items-center justify-center">
              {/* Sculpted 3D Metallic Pointer with Ruby Jewel */}
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none drop-shadow-[0_6px_12px_rgba(0,0,0,0.85)]"
                aria-hidden="true"
              >
                <svg width={40} height={44} viewBox="0 0 44 50" className="w-10 h-11">
                  <defs>
                    <linearGradient id="roulPtrGold" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#FFFBEB" />
                      <stop offset="45%" stopColor="#FACC15" />
                      <stop offset="100%" stopColor="#92400E" />
                    </linearGradient>
                    <radialGradient id="roulPtrGem" cx="35%" cy="35%" r="65%">
                      <stop offset="0%" stopColor="#FECDD3" />
                      <stop offset="45%" stopColor="#E11D48" />
                      <stop offset="100%" stopColor="#881337" />
                    </radialGradient>
                  </defs>
                  <path
                    d="M22 48 L6 16 C4 9, 11 2, 22 2 C33 2, 40 9, 38 16 Z"
                    fill="url(#roulPtrGold)"
                    stroke="#FEF9C3"
                    strokeWidth="2"
                  />
                  <circle cx="22" cy="14" r="6" fill="url(#roulPtrGem)" stroke="#FEF08A" strokeWidth="1.5" />
                </svg>
              </div>

              {/* Outer Brushed Gold & Platinum 3D Metallic Rim */}
              <div className="w-full h-full rounded-full p-2.5 bg-gradient-to-br from-[#FFF7CC] via-[#D4AF37] to-[#6D4C0B] shadow-[0_22px_50px_rgba(0,0,0,0.85),0_0_45px_rgba(212,175,55,0.45),inset_0_3px_6px_rgba(255,255,255,0.65)]">
                <div className="w-full h-full rounded-full p-1 bg-gradient-to-b from-[#CBD5E1] via-[#64748B] to-[#1E293B] shadow-[inset_0_4px_10px_rgba(0,0,0,0.85)]">
                  <div
                    className="w-full h-full rounded-full relative overflow-hidden bg-[#080B18]"
                    style={{
                      transform: `rotate(${wheelAngle}deg)`,
                      transition: isRouletteSpinning
                        ? 'transform 4s cubic-bezier(0.15, 0.85, 0.25, 1)'
                        : 'none',
                    }}
                  >
                  <svg width={200} height={200} viewBox="0 0 200 200" className="w-full h-full">
                    {ROULETTE_WHEEL_ORDER.map((num, idx) => {
                      const sliceDeg = 360 / 37;
                      const startAngle = (idx * sliceDeg - sliceDeg / 2 - 90) * (Math.PI / 180);
                      const endAngle = ((idx + 1) * sliceDeg - sliceDeg / 2 - 90) * (Math.PI / 180);
                      const x1 = 100 + 98 * Math.cos(startAngle);
                      const y1 = 100 + 98 * Math.sin(startAngle);
                      const x2 = 100 + 98 * Math.cos(endAngle);
                      const y2 = 100 + 98 * Math.sin(endAngle);
                      const fill =
                        num === 0 ? '#059669' : ROULETTE_REDS.has(num) ? '#EF4444' : '#171923';
                      const textAngle = idx * sliceDeg;
                      return (
                        <g key={num}>
                          <path
                            d={`M 100 100 L ${x1} ${y1} A 98 98 0 0 1 ${x2} ${y2} Z`}
                            fill={fill}
                            stroke="#D4AF37"
                            strokeWidth="1.3"
                          />
                          <text
                            x="100"
                            y="17"
                            fill="#FFFFFF"
                            fontSize="7"
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
              </div>

              {/* Center Fixed Outcome Display */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-[#070913]/95 border-2 border-[#FCE9A6] flex flex-col items-center justify-center shadow-[0_0_24px_rgba(212,175,55,0.6)]">
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
                className={`w-full rounded-xl border p-2 text-center ${
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
          <div className="w-full min-h-0 space-y-2">
            <div className="mt-3">
              <h2 className="text-sm font-extrabold text-[#FCE9A6] mb-4">لوحة رهانات الروليت الملكية</h2>
              <p className="text-[10px] text-slate-300 mt-0.5">
                اختر اللون أو الفئة أو الرقم الدقيق لتدوير العجلة الذهبية بمضاعفات تصل إلى ×32
              </p>
            </div>

            <div className="grid grid-cols-4 gap-1">
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
                  disabled={isRouletteSpinning || roomBetControlsDisabled}
                  onClick={() => setRouletteBetType(opt.id)}
                  className={`rounded-xl p-1.5 border text-center cursor-pointer transition ${
                    opt.cls
                  } ${
                    rouletteBetType === opt.id
                      ? 'ring-2 ring-[#FCE9A6] border-[#FCE9A6] shadow-[0_0_20px_rgba(212,175,55,0.35)]'
                      : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  <span className="block text-[10px] font-extrabold text-white">{opt.label}</span>
                  <span className="block text-[10px] font-mono-num text-[#FCE9A6]">
                    {opt.mult}
                  </span>
                </button>
              ))}
            </div>

            {/* Optional Exact Straight Number Picker */}
            <div className="rounded-xl bg-[#070913]/80 border border-[#D4AF37]/25 p-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  disabled={isRouletteSpinning || roomBetControlsDisabled}
                  onClick={() => setRouletteBetType('straight')}
                  className={`text-[10px] font-extrabold cursor-pointer ${
                    rouletteBetType === 'straight' ? 'text-[#FCE9A6]' : 'text-slate-300'
                  }`}
                >
                  الرهان على رقم مباشر واحد (×32): {rouletteBetType === 'straight' ? 'مفعّل ✓' : 'اضغط للتفعيل'}
                </button>
                <span className="font-mono-num text-[#F3D37A]">الرقم #{rouletteStraightNum}</span>
              </div>
              <div className="grid grid-cols-12 gap-1" dir="ltr">
                {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => {
                  const isRed = ROULETTE_REDS.has(n);
                  const isPicked = rouletteBetType === 'straight' && rouletteStraightNum === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={isRouletteSpinning || roomBetControlsDisabled}
                      onClick={() => {
                        setRouletteBetType('straight');
                        setRouletteStraightNum(n);
                      }}
                      className={`h-6 rounded-md text-[9px] font-extrabold font-mono-num border cursor-pointer transition ${
                        isRed ? 'bg-rose-900/75 border-rose-400/35' : 'bg-[#0B0F20] border-white/15'
                      } ${isPicked ? 'ring-2 ring-[#FCE9A6] text-[#FCE9A6] scale-105' : 'text-white'}`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative z-30 rounded-xl border border-[#D4AF37]/35 bg-[#14161f]/95 p-2 space-y-1.5">
              <div className="grid grid-cols-6 gap-1">
              {BET_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  disabled={isRouletteSpinning || roomBetControlsDisabled}
                  onClick={() => setBet(val)}
                  className={`min-h-[32px] rounded-lg text-[10px] font-extrabold font-mono-num border cursor-pointer transition ${
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
              disabled={
                isRouletteSpinning ||
                roomBetControlsDisabled ||
                user.coins < bet ||
                user.coins <= 0
              }
              onClick={roomRoundEnabled ? handlePlaceRoomBet : handleSpinRoulette}
              className="gold-btn w-full min-h-[42px] rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45"
            >
              <Disc3 className={`w-5 h-5 ${isRouletteSpinning ? 'animate-spin' : ''}`} />
              <span>
                {isPlacingRoomBet
                  ? 'جارٍ تسجيل الرهان...'
                  : isRouletteSpinning
                  ? 'العجلة الذهبية تدور...'
                  : roomRoundEnabled && currentRoomBet
                  ? 'تم تسجيل رهانك — انتظر النتيجة'
                  : roomRoundEnabled && roomBettingClosed
                  ? 'انتظر بداية الجولة التالية'
                  : roomRoundEnabled
                  ? `تسجيل الرهان (${bet.toLocaleString('en-US')} كوينز)`
                  : `تدوير الروليت الملكية (${bet.toLocaleString('en-US')} كوينز)`}
              </span>
              </button>
            </div>
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
                      <Fluent3DAsset
                        glyph={revealed.glyph}
                        alt={revealed.label}
                        priority
                        sizeClass="w-12 h-12 sm:w-14 sm:h-14"
                        fallbackTextClass="text-3xl sm:text-4xl"
                      />
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
                      <Fluent3DAsset
                        glyph="🎁"
                        alt={`صندوق #${idx + 1}`}
                        priority
                        sizeClass="w-12 h-12 sm:w-14 sm:h-14"
                        fallbackTextClass="text-3xl sm:text-5xl"
                        className="drop-shadow-[0_6px_12px_rgba(212,175,55,0.4)]"
                      />
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

          <div className="sticky bottom-0 z-30 rounded-2xl border border-[#D4AF37]/35 bg-[#070913]/95 backdrop-blur-md p-2.5 grid grid-cols-3 sm:grid-cols-6 gap-2">
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

      {/* ===================== CATEGORY 5: ROCK PAPER SCISSORS 3D ===================== */}
      {category === 'rps' && (
        <section
          className={`royal-glass ${
            compactRoomMode ? 'rounded-2xl p-3 space-y-2.5' : 'rounded-[2rem] p-5 sm:p-7 space-y-5'
          } border border-[#D4AF37]/35`}
        >
          {!compactRoomMode && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-extrabold text-[#FCE9A6]">
                  تحدي حجر ورقة مقص 3D الملكي
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  اختر حركتك الثلاثية الأبعاد وتحدَّ البوت الملكي لمضاعفة رهانك ×1.95 أو استرداده عند التعادل!
                </p>
              </div>
              <span className="rounded-xl bg-[#070913]/85 border border-[#D4AF37]/35 px-3.5 py-2 text-xs font-mono-num font-extrabold text-[#FCE9A6] shrink-0">
                مضاعف الفوز ×1.95
              </span>
            </div>
          )}

          {/* 3D Clash Arena Stage */}
          <div
            className={`velvet-table-surface rounded-2xl sm:rounded-3xl border-[4px] border-[#4A2511] ${
              compactRoomMode ? 'py-3 px-3' : 'py-6 sm:py-8 px-4'
            } grid grid-cols-3 items-center gap-2 text-center relative overflow-hidden`}
          >
            <div className="pointer-events-none absolute inset-2 rounded-2xl border border-[#FCE9A6]/20" />

            {/* Player Side */}
            <div className="relative flex flex-col items-center gap-1.5 perspective-dice">
              <span className="text-[10px] font-bold text-emerald-200 bg-black/50 px-2 py-0.5 rounded-full border border-emerald-400/35">
                اختيارك
              </span>
              <motion.div
                animate={
                  isRpsPlaying
                    ? {
                        y: [0, -16, 0, -16, 0],
                        rotateY: [0, 180, 360],
                        rotateZ: [0, -14, 8, -14, 0],
                        scale: [1, 1.12, 0.96, 1.12, 1],
                      }
                    : { y: 0, rotateY: 0, rotateZ: 0, scale: 1 }
                }
                transition={{ duration: 0.65, ease: 'easeInOut' }}
                className="p-2 rounded-2xl bg-black/35 border border-[#FCE9A6]/35 shadow-[0_0_20px_rgba(251,191,36,0.25)] preserve-3d"
              >
                <Fluent3DAsset
                  glyph={rpsChoice === 'rock' ? '✊' : rpsChoice === 'paper' ? '✋' : '✌️'}
                  alt="اختيارك"
                  priority
                  sizeClass={compactRoomMode ? 'w-12 h-12' : 'w-16 h-16 sm:w-20 sm:h-20'}
                  fallbackTextClass="text-4xl"
                />
              </motion.div>
            </div>

            {/* VS Badge */}
            <div className="relative flex flex-col items-center justify-center gap-1">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[#FEF08A] via-[#D4AF37] to-[#78350F] border-2 border-[#FFFBEB] flex items-center justify-center shadow-[0_0_24px_rgba(251,191,36,0.6)]">
                <span dir="ltr" className="text-xs sm:text-base font-black text-[#070913]">
                  VS
                </span>
              </div>
              {rpsResult && !isRpsPlaying && (
                <span
                  className={`text-[10px] sm:text-xs font-extrabold px-2 py-0.5 rounded-full ${
                    rpsResult.outcome === 'win'
                      ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50'
                      : rpsResult.outcome === 'draw'
                      ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50'
                      : 'bg-rose-500/25 text-rose-200 border border-rose-400/50'
                  }`}
                >
                  {rpsResult.outcome === 'win'
                    ? 'فوز ملكي!'
                    : rpsResult.outcome === 'draw'
                    ? 'تعادل'
                    : 'حاول مجدداً'}
                </span>
              )}
            </div>

            {/* Bot Side */}
            <div className="relative flex flex-col items-center gap-1.5 perspective-dice">
              <span className="text-[10px] font-bold text-amber-200 bg-black/50 px-2 py-0.5 rounded-full border border-[#D4AF37]/35">
                المنافس
              </span>
              <motion.div
                animate={
                  isRpsPlaying
                    ? {
                        y: [0, -16, 0, -16, 0],
                        rotateY: [0, -180, -360],
                        rotateZ: [0, 14, -8, 14, 0],
                        scale: [1, 1.12, 0.96, 1.12, 1],
                      }
                    : { y: 0, rotateY: 0, rotateZ: 0, scale: 1 }
                }
                transition={{ duration: 0.65, ease: 'easeInOut' }}
                className="p-2 rounded-2xl bg-black/35 border border-white/20 shadow-[0_0_20px_rgba(0,0,0,0.45)] preserve-3d"
              >
                <Fluent3DAsset
                  glyph={
                    isRpsPlaying
                      ? '✊'
                      : !rpsResult
                      ? '🔮'
                      : rpsResult.botMove === 'rock'
                      ? '✊'
                      : rpsResult.botMove === 'paper'
                      ? '✋'
                      : '✌️'
                  }
                  alt="المنافس"
                  priority
                  sizeClass={compactRoomMode ? 'w-12 h-12' : 'w-16 h-16 sm:w-20 sm:h-20'}
                  fallbackTextClass="text-4xl"
                />
              </motion.div>
            </div>
          </div>

          {/* 3 Move Selector Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            {(
              [
                { id: 'rock', label: 'حجر 3D', glyph: '✊' },
                { id: 'paper', label: 'ورقة 3D', glyph: '✋' },
                { id: 'scissors', label: 'مقص 3D', glyph: '✌️' },
              ] as const
            ).map((opt) => {
              const active = rpsChoice === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isRpsPlaying}
                  onClick={() => setRpsChoice(opt.id)}
                  className={`rounded-2xl ${
                    compactRoomMode ? 'p-2' : 'p-3.5'
                  } border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition active:scale-95 ${
                    active
                      ? 'bg-gradient-to-b from-[#3A280B] to-[#171107] border-[#FCE9A6] shadow-[0_0_20px_rgba(251,191,36,0.4)] scale-[1.02]'
                      : 'bg-[#070913]/80 border-white/15 hover:border-[#D4AF37]/50'
                  }`}
                >
                  <Fluent3DAsset
                    glyph={opt.glyph}
                    alt={opt.label}
                    priority
                    sizeClass={compactRoomMode ? 'w-9 h-9' : 'w-12 h-12'}
                    fallbackTextClass="text-3xl"
                  />
                  <span className="text-xs font-extrabold text-white">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {rpsResult && !isRpsPlaying && (
            <div
              className={`rounded-2xl border p-3.5 flex items-center justify-between gap-2 text-xs sm:text-sm ${
                rpsResult.outcome === 'win'
                  ? 'border-[#FCE9A6]/75 bg-gradient-to-r from-[#D4AF37]/25 via-emerald-950/55 to-[#D4AF37]/20 text-emerald-200'
                  : rpsResult.outcome === 'draw'
                  ? 'border-amber-400/50 bg-amber-950/40 text-[#FCE9A6]'
                  : 'border-white/10 bg-[#070913]/80 text-slate-300'
              }`}
            >
              <span className="font-extrabold">
                {rpsResult.outcome === 'win'
                  ? `فوز رائع! ربحت +${rpsResult.payout.toLocaleString('en-US')} كوينز (×1.95)`
                  : rpsResult.outcome === 'draw'
                  ? `تعادل! تم استرداد رهانك (${rpsResult.payout.toLocaleString('en-US')} كوينز)`
                  : `فاز المنافس هذه الجولة — خسرت ${rpsResult.bet.toLocaleString('en-US')} كوينز`}
              </span>
              <span className="font-mono-num text-[#FCE9A6] shrink-0">+{rpsResult.xpGain} XP</span>
            </div>
          )}

          {/* Bet Chips + Play CTA */}
          <div className="space-y-2">
            <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
              {BET_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  disabled={isRpsPlaying}
                  onClick={() => setBet(val)}
                  className={`${
                    compactRoomMode ? 'min-h-[30px] text-[10px]' : 'min-h-[40px] text-xs'
                  } rounded-xl font-extrabold font-mono-num border cursor-pointer transition ${
                    bet === val
                      ? 'bg-[#D4AF37] text-[#070913] border-[#FCE9A6]'
                      : 'bg-white/5 border-white/15 text-slate-200 hover:border-[#D4AF37]/45'
                  }`}
                >
                  {val >= 1000 ? `${val / 1000}K` : val}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={isRpsPlaying || user.coins < bet || user.coins <= 0}
              onClick={() => void handlePlayRps()}
              className={`gold-btn w-full ${
                compactRoomMode ? 'min-h-[40px] text-xs sm:text-sm' : 'min-h-[52px] text-base'
              } rounded-xl sm:rounded-2xl font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45`}
            >
              <Hand className={compactRoomMode ? 'w-4 h-4' : 'w-5 h-5'} />
              <span>
                {isRpsPlaying
                  ? 'المواجهة جارية...'
                  : user.coins < bet || user.coins <= 0
                  ? 'رصيدك غير كافٍ للعب'
                  : `تحدي حجر ورقة مقص 3D (${bet.toLocaleString('en-US')} كوينز)`}
              </span>
            </button>
          </div>
        </section>
      )}

      {/* Unified Live History Strip across Games (Hidden in compact room mode) */}
      {!compactRoomMode && (
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
      )}
    </div>
  );
};
