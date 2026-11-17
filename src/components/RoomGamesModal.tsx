import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Building2,
  Coins,
  Crown,
  Gem,
  Mic,
  MicOff,
  Plus,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { RoomSeat, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { resolveAsset } from '../lib/assets';
import { formatShortNumericId } from '../lib/sadaCatalog';
import { isAudioMuted, setAudioMuted } from '../lib/sadaAudio';
import {
  getHallOfFameFromSupabase,
  getRealJackpotPoolFromSupabase,
  type SlotGameId,
} from '../lib/sadaGamesService';
import { InRoomSlot5x3Player } from './InRoomSlot5x3Player';
import { GamesCenterPage } from '../pages/GamesCenterPage';
import { CompetitionsPage } from '../pages/CompetitionsPage';

type GameSelection =
  | { type: 'slot'; slotId: SlotGameId; title: string }
  | {
      type: 'category';
      category: 'dice' | 'roulette' | 'mystery' | 'competitions';
      title: string;
    };

interface ShelfGameItem {
  id: string;
  title: string;
  badge: 'Hot' | 'New';
  selection: GameSelection;
  tileBg: string;
  glyph: string;
  subGlyph: string;
  labelChip?: string;
}

const GAME_SHELVES: ShelfGameItem[][] = [
  [
    {
      id: 'jungle_hunt',
      title: 'مطاردة الأدغال',
      badge: 'Hot',
      selection: { type: 'slot', slotId: 'jungle_hunt', title: 'مطاردة الأدغال' },
      tileBg: 'from-[#15803D] via-[#064E3B] to-[#78350F]',
      glyph: '🦁',
      subGlyph: '🐘',
      labelChip: 'JACKPOT',
    },
    {
      id: 'crown_jewels',
      title: 'السلوت الملكي 3D',
      badge: 'Hot',
      selection: { type: 'slot', slotId: 'crown_jewels', title: 'السلوت الملكي 3D' },
      tileBg: 'from-[#6D28D9] via-[#1E1B4B] to-[#B45309]',
      glyph: '👑',
      subGlyph: '💎',
      labelChip: 'ROYAL',
    },
    {
      id: 'pharaoh_treasures',
      title: 'سلوت الهرم الملكي',
      badge: 'New',
      selection: { type: 'slot', slotId: 'pharaoh_treasures', title: 'سلوت الهرم الملكي' },
      tileBg: 'from-[#D97706] via-[#78350F] to-[#451A03]',
      glyph: '👁️',
      subGlyph: '🪲',
      labelChip: 'EGYPT',
    },
    {
      id: 'olympus_gates',
      title: 'بوابات الأوليمبوس',
      badge: 'New',
      selection: { type: 'slot', slotId: 'olympus_gates', title: 'بوابات الأوليمبوس' },
      tileBg: 'from-[#3B82F6] via-[#4C1D95] to-[#1E1B4B]',
      glyph: '⚡',
      subGlyph: '🏛️',
      labelChip: 'ZEUS',
    },
  ],
  [
    {
      id: 'roulette',
      title: 'الروليت الملكية',
      badge: 'New',
      selection: { type: 'category', category: 'roulette', title: 'الروليت الملكية' },
      tileBg: 'from-[#991B1B] via-[#450A0A] to-[#B45309]',
      glyph: '🎡',
      subGlyph: '🪙',
      labelChip: '37×',
    },
    {
      id: 'dice',
      title: 'النرد الذهبي 3D',
      badge: 'Hot',
      selection: { type: 'category', category: 'dice', title: 'النرد الذهبي 3D' },
      tileBg: 'from-[#0F766E] via-[#115E59] to-[#042F2E]',
      glyph: '🎲',
      subGlyph: '✨',
      labelChip: '3D',
    },
    {
      id: 'mystery',
      title: 'صناديق الحظ',
      badge: 'New',
      selection: { type: 'category', category: 'mystery', title: 'صناديق الحظ' },
      tileBg: 'from-[#0284C7] via-[#1D4ED8] to-[#312E81]',
      glyph: '🧰',
      subGlyph: '💎',
      labelChip: 'BOX',
    },
    {
      id: 'classic_fruits',
      title: 'سلوت الفواكه',
      badge: 'Hot',
      selection: { type: 'slot', slotId: 'classic_fruits', title: 'سلوت الفواكه' },
      tileBg: 'from-[#EC4899] via-[#9D174D] to-[#701A75]',
      glyph: '🍒',
      subGlyph: '7️⃣',
      labelChip: '777',
    },
  ],
  [
    {
      id: 'sea_pirates',
      title: 'قراصنة البحار',
      badge: 'Hot',
      selection: { type: 'slot', slotId: 'sea_pirates', title: 'قراصنة البحار' },
      tileBg: 'from-[#0369A1] via-[#0C4A6E] to-[#1E293B]',
      glyph: '🏴‍☠️',
      subGlyph: '💰',
      labelChip: 'LOOT',
    },
    {
      id: 'neon_galaxy',
      title: 'مجرة النيون',
      badge: 'New',
      selection: { type: 'slot', slotId: 'neon_galaxy', title: 'مجرة النيون' },
      tileBg: 'from-[#06B6D4] via-[#1E3A8A] to-[#581C87]',
      glyph: '🛸',
      subGlyph: '🪐',
      labelChip: 'NEON',
    },
    {
      id: 'desert_gold',
      title: 'ذهب الصحراء',
      badge: 'New',
      selection: { type: 'slot', slotId: 'desert_gold', title: 'ذهب الصحراء' },
      tileBg: 'from-[#B45309] via-[#78350F] to-[#065F46]',
      glyph: '🪔',
      subGlyph: '🐪',
      labelChip: 'GOLD',
    },
    {
      id: 'turbo_racing',
      title: 'سباق التوربو',
      badge: 'New',
      selection: { type: 'slot', slotId: 'turbo_racing', title: 'سباق التوربو' },
      tileBg: 'from-[#DC2626] via-[#7F1D1D] to-[#1E293B]',
      glyph: '🏎️',
      subGlyph: '🏁',
      labelChip: 'TURBO',
    },
  ],
];

interface RoomGamesModalProps {
  roomTitle: string;
  totalVolumeCoins: number;
  mySeat: RoomSeat | null;
  micActive: boolean;
  userCoins: number;
  initialSection?: 'games' | 'competitions';
  onToggleMute: () => void;
  onRecharge: () => void;
  onOpenAgency: () => void;
  onPlaySpent?: (coins: number) => void;
  onClose: () => void;
}

export const RoomGamesModal: React.FC<RoomGamesModalProps> = ({
  roomTitle,
  totalVolumeCoins,
  mySeat,
  micActive,
  userCoins,
  initialSection = 'games',
  onToggleMute,
  onRecharge,
  onOpenAgency,
  onPlaySpent,
  onClose,
}) => {
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<'center' | 'hall_of_fame' | 'agency_partner' | 'playing'>(
    initialSection === 'competitions' ? 'playing' : 'center'
  );
  const [selectedGame, setSelectedGame] = useState<GameSelection>(
    initialSection === 'competitions'
      ? { type: 'category', category: 'competitions', title: 'المسابقات الملكية' }
      : { type: 'slot', slotId: 'jungle_hunt', title: 'مطاردة الأدغال' }
  );

  const [jackpotPoolCoins, setJackpotPoolCoins] = useState<number>(0);
  const [hallOfFameUsers, setHallOfFameUsers] = useState<User[]>([]);
  const [loadingFame, setLoadingFame] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(() => isAudioMuted());

  const refreshJackpot = useCallback(() => {
    getRealJackpotPoolFromSupabase()
      .then((val) => setJackpotPoolCoins(val))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshJackpot();
  }, [refreshJackpot]);

  const handleOpenHallOfFame = () => {
    setViewMode('hall_of_fame');
    setLoadingFame(true);
    getHallOfFameFromSupabase()
      .then((list) => setHallOfFameUsers(list))
      .finally(() => setLoadingFame(false));
  };

  const handleLaunchGame = (selection: GameSelection) => {
    setSelectedGame(selection);
    setViewMode('playing');
  };

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
  };

  // ==================== STAGE 2: ACTIVE GAME (BOTTOM 52%, UPPER 48% COMPLETELY CLEAR) ====================
  if (viewMode === 'playing') {
    return (
      <div className="fixed inset-0 z-50 pointer-events-none flex items-end justify-center">
        <motion.div
          initial={{ opacity: 0, y: 70 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 70 }}
          transition={{ type: 'spring', stiffness: 360, damping: 32 }}
          className="pointer-events-auto w-full max-w-2xl h-[52vh] min-h-[375px] max-h-[56vh] rounded-t-[1.5rem] overflow-hidden shadow-[0_-12px_45px_rgba(0,0,0,0.85)]"
        >
          {selectedGame.type === 'slot' ? (
            <InRoomSlot5x3Player
              gameId={selectedGame.slotId}
              jackpotPoolCoins={jackpotPoolCoins}
              mySeat={mySeat}
              micActive={micActive}
              onToggleMute={onToggleMute}
              onRecharge={onRecharge}
              onBackToCenter={() => setViewMode('center')}
              onClose={onClose}
              onJackpotRefresh={refreshJackpot}
              onPlaySpent={onPlaySpent}
            />
          ) : (
            <div className="h-full w-full flex flex-col bg-gradient-to-b from-[#0C1D4F] via-[#091233] to-[#050816] border-t-2 border-[#D4AF37]/80">
              {/* Top Bar matching Stage 2 (Coins + (+) + Sound + X on left, Title + Mic + Back on right) */}
              <div
                dir="ltr"
                className="flex items-center justify-between gap-2 px-2.5 pt-2 pb-1.5 border-b border-[#D4AF37]/30 bg-black/35 shrink-0"
              >
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-7 h-7 rounded-full bg-black/60 border border-white/25 text-white flex items-center justify-center cursor-pointer"
                    aria-label="إغلاق"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleSound}
                    className={`w-7 h-7 rounded-full border flex items-center justify-center cursor-pointer ${
                      muted
                        ? 'bg-rose-950/75 border-rose-400/50 text-rose-200'
                        : 'bg-black/60 border-white/25 text-[#FCE9A6]'
                    }`}
                    aria-label="كتم الصوت"
                  >
                    {muted ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <div className="h-7 rounded-full bg-black/65 border border-[#D4AF37]/55 pl-2 pr-0.5 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-[#FACC15]" />
                    <span className="text-[11px] font-mono-num font-extrabold text-white">
                      {userCoins.toLocaleString('en-US')}
                    </span>
                    <button
                      type="button"
                      onClick={onRecharge}
                      className="w-5 h-5 rounded-full bg-gradient-to-b from-[#FDE047] to-[#D97706] text-[#070913] flex items-center justify-center cursor-pointer"
                      aria-label="شحن الكوينز"
                    >
                      <Plus className="w-3 h-3 stroke-[3]" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 min-w-0">
                  <span dir="rtl" className="text-xs sm:text-sm font-extrabold text-[#FCE9A6] truncate">
                    {selectedGame.title}
                  </span>
                  {mySeat && (
                    <button
                      type="button"
                      onClick={onToggleMute}
                      className={`w-7 h-7 rounded-full border flex items-center justify-center cursor-pointer ${
                        mySeat.isMuted
                          ? 'bg-rose-950/75 border-rose-400/55 text-rose-200'
                          : 'bg-emerald-950/75 border-emerald-400/60 text-emerald-200'
                      }`}
                    >
                      {mySeat.isMuted ? (
                        <MicOff className="w-3.5 h-3.5" />
                      ) : (
                        <Mic className={`w-3.5 h-3.5 ${micActive ? 'animate-pulse' : ''}`} />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewMode('center')}
                    className="w-7 h-7 rounded-full bg-gradient-to-b from-[#3B82F6] to-[#1D4ED8] border border-[#93C5FD]/60 text-white flex items-center justify-center cursor-pointer"
                    aria-label="الرجوع لمركز الألعاب"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar p-2.5">
                {selectedGame.category === 'competitions' ? (
                  <CompetitionsPage embedded />
                ) : (
                  <GamesCenterPage
                    key={selectedGame.category}
                    embedded
                    compactRoomMode
                    initialCategory={selectedGame.category}
                    onPlaySpent={onPlaySpent}
                  />
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ==================== STAGE 1: ROYAL BLUE-GOLD GAME CENTER DRAWER ====================
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 90 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 90 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        className="relative w-full max-w-2xl h-[78vh] max-h-[84vh] flex flex-col overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        {/* DECORATIVE ARCH COIN PILE & TREASURE CHEST HEADER */}
        <div className="relative -mb-5 z-20 flex items-end justify-center pointer-events-none px-4">
          <svg
            viewBox="0 0 360 72"
            className="w-full max-w-[360px] h-[54px] sm:h-[62px] drop-shadow-[0_4px_14px_rgba(250,204,21,0.45)]"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="coinGoldGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FEF9C3" />
                <stop offset="45%" stopColor="#FACC15" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
              <linearGradient id="chestBlueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#1E3A8A" />
              </linearGradient>
            </defs>
            {/* Mound of gold coins */}
            <ellipse cx="180" cy="68" rx="145" ry="30" fill="#B45309" opacity="0.85" />
            <ellipse cx="180" cy="64" rx="125" ry="26" fill="url(#coinGoldGrad)" />
            {/* Scattered sculpted gold coins */}
            <circle cx="95" cy="54" r="9" fill="url(#coinGoldGrad)" stroke="#78350F" strokeWidth="1.2" />
            <circle cx="118" cy="44" r="10" fill="url(#coinGoldGrad)" stroke="#78350F" strokeWidth="1.2" />
            <circle cx="155" cy="36" r="11" fill="url(#coinGoldGrad)" stroke="#78350F" strokeWidth="1.2" />
            <circle cx="195" cy="35" r="10" fill="url(#coinGoldGrad)" stroke="#78350F" strokeWidth="1.2" />
            <circle cx="228" cy="43" r="10" fill="url(#coinGoldGrad)" stroke="#78350F" strokeWidth="1.2" />
            <circle cx="262" cy="53" r="9" fill="url(#coinGoldGrad)" stroke="#78350F" strokeWidth="1.2" />
            {/* Left Blue/Gold Gamepad */}
            <g transform="translate(22, 24) rotate(-14)">
              <rect x="0" y="6" width="46" height="28" rx="14" fill="url(#chestBlueGrad)" stroke="#FDE047" strokeWidth="2.5" />
              <path d="M13 15 V25 M8 20 H18" stroke="#FACC15" strokeWidth="3" strokeLinecap="round" />
              <circle cx="32" cy="17" r="2.2" fill="#FDE047" />
              <circle cx="37" cy="22" r="2.2" fill="#86EFAC" />
            </g>
            {/* Right Treasure Chest */}
            <g transform="translate(282, 20) rotate(10)">
              <rect x="2" y="14" width="44" height="26" rx="4" fill="url(#chestBlueGrad)" stroke="#FDE047" strokeWidth="2" />
              <path d="M2 14 C6 2, 42 2, 46 14 Z" fill="#1D4ED8" stroke="#FDE047" strokeWidth="2" />
              <rect x="20" y="13" width="8" height="10" rx="2" fill="#FACC15" />
            </g>
          </svg>
        </div>

        {/* MAIN ROYAL BLUE & GOLD METALLIC SHEET */}
        <div className="relative flex-1 rounded-t-[1.75rem] border-t-[3px] border-x-[2px] border-[#FACC15]/80 bg-gradient-to-b from-[#1642B8] via-[#0B1E66] to-[#050C2E] shadow-[0_-10px_45px_rgba(37,99,235,0.45)] flex flex-col overflow-hidden">
          {/* Ornate Gold Metallic "GAME CENTER" Header Bar */}
          <div className="relative px-4 pt-3 pb-2.5 border-b border-[#FDE047]/35 bg-gradient-to-b from-[#1D4ED8] via-[#133399] to-[#0D216B] flex items-center justify-between shrink-0 shadow-[0_6px_18px_rgba(0,0,0,0.4)]">
            <div className="w-8" />
            <h2
              dir="ltr"
              className="text-xl sm:text-2xl font-black tracking-wider uppercase bg-gradient-to-b from-[#FFFBEB] via-[#FDE047] to-[#D97706] bg-clip-text text-transparent drop-shadow-[0_3px_6px_rgba(0,0,0,0.85)]"
            >
              GAME CENTER
            </h2>
            <button
              type="button"
              onClick={
                viewMode === 'center' ? onClose : () => setViewMode('center')
              }
              className="w-8 h-8 rounded-full bg-gradient-to-b from-[#60A5FA] to-[#1D4ED8] border-2 border-[#FEF08A] text-white flex items-center justify-center cursor-pointer hover:brightness-110 active:scale-95 shadow-md"
              aria-label={viewMode === 'center' ? 'إغلاق مركز الألعاب' : 'رجوع'}
              title={viewMode === 'center' ? 'إغلاق' : 'العودة للألعاب'}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Real Supabase Currency Bar (Coins + (+) Recharge | Diamonds | Live Mic) */}
          <div className="px-3.5 py-2 bg-[#071342]/80 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              {mySeat && (
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`h-7 rounded-full px-2.5 border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition ${
                    mySeat.isMuted
                      ? 'bg-rose-950/75 border-rose-400/50 text-rose-200'
                      : 'bg-emerald-950/75 border-emerald-400/55 text-emerald-200'
                  }`}
                >
                  {mySeat.isMuted ? (
                    <MicOff className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className={`w-3.5 h-3.5 ${micActive ? 'animate-pulse' : ''}`} />
                  )}
                  <span>{mySeat.isMuted ? 'مكتوم' : 'على المايك'}</span>
                </button>
              )}
              <span className="hidden xs:inline-flex items-center gap-1 text-[10px] font-bold text-blue-200/85 truncate max-w-[140px]">
                {roomTitle}
              </span>
            </div>

            {/* Real Supabase Coins + (+) + Diamonds */}
            <div dir="ltr" className="flex items-center gap-2">
              <div className="h-7 rounded-full bg-[#040B29] border border-cyan-400/45 px-2.5 flex items-center gap-1.5">
                <Gem className="w-3.5 h-3.5 text-cyan-300" />
                <span className="text-xs font-mono-num font-extrabold text-white">
                  {(user?.diamonds ?? 0).toLocaleString('en-US')}
                </span>
              </div>

              <div className="h-7 rounded-full bg-[#040B29] border border-[#FACC15]/60 pl-1 pr-2.5 flex items-center gap-1.5 shadow-inner">
                <button
                  type="button"
                  onClick={onRecharge}
                  className="w-5 h-5 rounded-full bg-gradient-to-b from-[#FDE047] to-[#D97706] text-[#070913] flex items-center justify-center cursor-pointer hover:brightness-110 active:scale-95"
                  aria-label="شحن الكوينز"
                  title="شحن الكوينز"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                </button>
                <span className="text-xs font-mono-num font-extrabold text-white">
                  {userCoins.toLocaleString('en-US')}
                </span>
                <Coins className="w-3.5 h-3.5 text-[#FACC15]" />
              </div>
            </div>
          </div>

          {/* BODY CONTENT */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-3 sm:p-4 space-y-4">
            {viewMode === 'hall_of_fame' && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-[#FACC15]/60 bg-gradient-to-r from-[#3B2606] via-[#1C163B] to-[#3B2606] p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-[#FDE047]" />
                    <div>
                      <h3 className="text-sm font-extrabold text-[#FEF08A]">قاعة الشهرة — صَدَى</h3>
                      <p className="text-[10px] text-amber-100/80">
                        الترتيب الحقيقي لأعلى اللاعبين تفاعلاً وخبرة من Supabase
                      </p>
                    </div>
                  </div>
                </div>

                {loadingFame ? (
                  <div className="py-10 text-center text-xs text-blue-200">
                    جاري تحميل قائمة الأبطال الحقيقية...
                  </div>
                ) : hallOfFameUsers.length === 0 ? (
                  <div className="py-10 text-center text-xs text-blue-200/80 rounded-2xl bg-[#040B29]/70 border border-white/10">
                    لا توجد بيانات مسجلة بعد.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {hallOfFameUsers.map((player, idx) => (
                      <div
                        key={player.id}
                        className="rounded-2xl bg-[#061138]/90 border border-[#FACC15]/25 px-3 py-2 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono-num font-black shrink-0 ${
                              idx === 0
                                ? 'bg-[#FACC15] text-[#070913]'
                                : idx === 1
                                ? 'bg-slate-200 text-slate-900'
                                : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-white/10 text-blue-200'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <img
                            src={resolveAsset(player.avatarUrl)}
                            alt={player.displayName}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-full object-cover border border-[#FACC15]/50 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-white truncate">
                              {player.displayName}
                            </p>
                            <span className="text-[10px] font-mono-num text-blue-200/80">
                              Lv.{player.level} · ID:{formatShortNumericId(player.id)}
                            </span>
                          </div>
                        </div>
                        <div className="text-left shrink-0">
                          <span className="text-xs font-mono-num font-extrabold text-[#FDE047] block">
                            {player.xp.toLocaleString('en-US')} XP
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {viewMode === 'agency_partner' && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-[#FACC15]/60 bg-gradient-to-br from-[#3D2807] via-[#181B3D] to-[#2B1D05] p-4 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-11 h-11 rounded-2xl bg-[#FACC15]/20 border border-[#FACC15]/60 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-[#FDE047]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-[#FEF08A]">شريك الوكالة</h3>
                      <p className="text-[11px] text-amber-100/85">
                        الوكالة الحالية: <strong className="text-white">{roomTitle}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-black/40 border border-[#FACC15]/30 p-3 text-center">
                      <span className="block text-[10px] text-blue-200">حجم اللعب والدعم بالوكالة</span>
                      <span className="text-sm font-mono-num font-black text-[#FDE047]">
                        {totalVolumeCoins.toLocaleString('en-US')}
                      </span>
                    </div>
                    <div className="rounded-xl bg-black/40 border border-emerald-400/30 p-3 text-center">
                      <span className="block text-[10px] text-emerald-200">مجمع الجاكبوت العام</span>
                      <span className="text-sm font-mono-num font-black text-emerald-300">
                        {jackpotPoolCoins.toLocaleString('en-US')}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onOpenAgency}
                    className="w-full min-h-[42px] rounded-xl bg-gradient-to-r from-[#FEF08A] via-[#FACC15] to-[#D97706] text-[#070913] text-xs font-black cursor-pointer hover:brightness-105 transition"
                  >
                    الانتقال إلى لوحة وكالتي ومركز المضيف
                  </button>
                </div>
              </div>
            )}

            {viewMode === 'center' && (
              <>
                {/* TWO PROMINENT ROYAL GOLD CARDS: قاعة الشهرة & شريك الوكالة */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleOpenHallOfFame}
                    className="relative h-16 sm:h-[72px] rounded-2xl border-2 border-[#FDE047]/80 bg-gradient-to-br from-[#FDE68A]/90 via-[#B45309]/95 to-[#78350F] overflow-hidden shadow-[0_6px_18px_rgba(250,204,21,0.3)] cursor-pointer group active:scale-[0.98] transition flex flex-col items-center justify-center px-2"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
                    <div className="relative flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-[#FEF08A] drop-shadow" />
                      <span className="text-xs sm:text-sm font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                        قاعة الشهرة
                      </span>
                    </div>
                    <span className="relative text-[9px] font-bold text-[#FEF9C3]/90 mt-0.5">
                      أبطال صَدَى الحقيقيون
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode('agency_partner')}
                    className="relative h-16 sm:h-[72px] rounded-2xl border-2 border-[#FDE047]/80 bg-gradient-to-br from-[#FDE047]/85 via-[#92400E]/95 to-[#451A03] overflow-hidden shadow-[0_6px_18px_rgba(250,204,21,0.3)] cursor-pointer group active:scale-[0.98] transition flex flex-col items-center justify-center px-2"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
                    <div className="relative flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-[#FEF08A] drop-shadow" />
                      <span className="text-xs sm:text-sm font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                        شريك الوكالة
                      </span>
                    </div>
                    <span className="relative text-[9px] font-bold text-[#FEF9C3]/90 mt-0.5 truncate max-w-full">
                      {roomTitle}
                    </span>
                  </button>
                </div>

                {/* 4-COLUMN ORGANIZED GLOSSY BLUE-GOLD GAME SHELVES */}
                <div className="space-y-3">
                  {GAME_SHELVES.map((row, rowIdx) => (
                    <div key={rowIdx}>
                      {/* 4 Icons Row */}
                      <div className="grid grid-cols-4 gap-2 px-1.5 relative z-10">
                        {row.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleLaunchGame(item.selection)}
                            className="flex flex-col items-center group cursor-pointer active:scale-95 transition"
                          >
                            {/* 3D Game Tile */}
                            <div
                              className={`relative w-full aspect-square rounded-2xl border-2 border-[#FDE047]/80 bg-gradient-to-br ${item.tileBg} shadow-[0_6px_14px_rgba(0,0,0,0.55),inset_0_2px_6px_rgba(255,255,255,0.3)] flex flex-col items-center justify-center overflow-hidden group-hover:brightness-110`}
                            >
                              {/* Top-Right Hot / New Pill */}
                              <span
                                className={`absolute top-0.5 right-0.5 px-1.5 py-[1px] rounded-full text-[8px] font-black uppercase tracking-tight shadow ${
                                  item.badge === 'Hot'
                                    ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white'
                                    : 'bg-gradient-to-r from-emerald-400 to-green-600 text-[#052E16]'
                                }`}
                              >
                                {item.badge}
                              </span>

                              {/* Gloss Top Sheen */}
                              <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />

                              {/* Layered 3D Emoji Artwork */}
                              <div className="relative flex items-center justify-center">
                                <span className="text-2xl sm:text-3xl drop-shadow-[0_4px_6px_rgba(0,0,0,0.75)]">
                                  {item.glyph}
                                </span>
                                <span className="absolute -bottom-1 -left-2.5 text-sm sm:text-base drop-shadow">
                                  {item.subGlyph}
                                </span>
                              </div>

                              {item.labelChip && (
                                <span
                                  dir="ltr"
                                  className="mt-0.5 rounded bg-black/55 border border-[#FDE047]/60 px-1.5 text-[7px] font-black tracking-wider text-[#FEF08A]"
                                >
                                  {item.labelChip}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Glossy 3D Blue Shelf Ledge directly below the 4 tiles */}
                      <div className="pointer-events-none -mt-1.5 mx-0.5 h-3 rounded-b-lg bg-gradient-to-b from-[#3B82F6]/90 via-[#1D4ED8] to-[#0F256E] border-t border-[#93C5FD]/65 shadow-[0_6px_12px_rgba(0,0,0,0.65)]" />

                      {/* 4 Game Titles directly under the shelf ledge */}
                      <div className="grid grid-cols-4 gap-2 px-1 mt-1">
                        {row.map((item) => (
                          <button
                            key={`${item.id}_label`}
                            type="button"
                            onClick={() => handleLaunchGame(item.selection)}
                            className="text-[10px] sm:text-[11px] font-bold text-white/95 text-center leading-tight line-clamp-1 cursor-pointer hover:text-[#FEF08A]"
                          >
                            {item.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Link to Live Competitions */}
                <button
                  type="button"
                  onClick={() =>
                    handleLaunchGame({
                      type: 'category',
                      category: 'competitions',
                      title: 'المسابقات الملكية',
                    })
                  }
                  className="w-full rounded-2xl border border-[#FACC15]/50 bg-[#071547]/90 hover:bg-[#0D216B] px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#FDE047]" />
                    <span className="text-xs font-extrabold text-white">
                      المسابقات والأسئلة التفاعلية
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-[#FDE047]">دخول ←</span>
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
