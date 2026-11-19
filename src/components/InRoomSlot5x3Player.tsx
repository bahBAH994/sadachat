import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Coins,
  Mic,
  MicOff,
  Minus,
  Plus,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Fluent3DAsset } from './Fluent3DAsset';
import { RoyalSlotSymbol3D } from './RoyalSlotSymbol3D';
import { SlotMachine3DLever, SlotMarqueePerimeter } from './SlotMachine3DLever';
import {
  fireGoldCoinConfetti,
  isAudioMuted,
  playCoinWinSound,
  playSlotReelStop,
  playSlotSpinTick,
  setAudioMuted,
} from '../lib/sadaAudio';
import {
  spinSlotMachineInSupabase,
  type SlotGameId,
  type SpinResultPayload,
} from '../lib/sadaGamesService';
import type { RoomSeat } from '../types';

const BET_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

interface SlotThemeConfig {
  id: SlotGameId;
  title: string;
  symbols: string[];
  bgGradient: string;
  cabinetFrame: string;
  reelBg: string;
  plaqueBorder: string;
  accentLeaf?: boolean;
}

const SLOT_THEMES: Record<SlotGameId, SlotThemeConfig> = {
  jungle_hunt: {
    id: 'jungle_hunt',
    title: 'مطاردة الأدغال',
    symbols: ['10', 'J', 'K', '🐊', '🐘', '🦍', '🦁', 'WILD'],
    bgGradient: 'from-[#0B2912] via-[#0F1E0E] to-[#1D1207]',
    cabinetFrame:
      'border-[#A16207] bg-gradient-to-b from-[#3E2410] via-[#241307] to-[#1A0D05] shadow-[inset_0_0_24px_rgba(0,0,0,0.85),0_0_28px_rgba(34,197,94,0.28)]',
    reelBg: 'bg-gradient-to-b from-[#140B06] via-[#27150A] to-[#100804]',
    plaqueBorder: 'border-emerald-400/80 bg-gradient-to-b from-[#2A190B] to-[#160D05]',
    accentLeaf: true,
  },
  crown_jewels: {
    id: 'crown_jewels',
    title: 'السلوت الملكي 3D',
    symbols: ['🪙', '⚜️', '🏆', '🦅', '💎', '👑'],
    bgGradient: 'from-[#16193B] via-[#0B1026] to-[#1E1408]',
    cabinetFrame:
      'border-[#D4AF37] bg-gradient-to-b from-[#241A08] via-[#121632] to-[#1B1206] shadow-[inset_0_0_24px_rgba(0,0,0,0.85),0_0_28px_rgba(212,175,55,0.32)]',
    reelBg: 'bg-gradient-to-b from-[#070B1A] via-[#11193B] to-[#060916]',
    plaqueBorder: 'border-[#FCE9A6]/80 bg-gradient-to-b from-[#2C1E06] to-[#140E05]',
  },
  pharaoh_treasures: {
    id: 'pharaoh_treasures',
    title: 'سلوت الهرم الملكي',
    symbols: ['🏺', '🐍', '⚱️', '☀️', '👁️', '🪲'],
    bgGradient: 'from-[#291B07] via-[#150E04] to-[#231606]',
    cabinetFrame:
      'border-[#F59E0B] bg-gradient-to-b from-[#3B2609] via-[#1E1305] to-[#140C03] shadow-[inset_0_0_24px_rgba(0,0,0,0.85),0_0_28px_rgba(245,158,11,0.3)]',
    reelBg: 'bg-gradient-to-b from-[#140C04] via-[#251708] to-[#0E0803]',
    plaqueBorder: 'border-amber-300/80 bg-gradient-to-b from-[#342207] to-[#191003]',
  },
  olympus_gates: {
    id: 'olympus_gates',
    title: 'بوابات الأوليمبوس',
    symbols: ['🏛️', '⏳', '💍', '🏆', '👑', '⚡'],
    bgGradient: 'from-[#221247] via-[#100D2B] to-[#261B07]',
    cabinetFrame:
      'border-violet-300/80 bg-gradient-to-b from-[#26164D] via-[#141033] to-[#241A07] shadow-[inset_0_0_24px_rgba(0,0,0,0.85),0_0_28px_rgba(167,139,250,0.32)]',
    reelBg: 'bg-gradient-to-b from-[#0B0920] via-[#191442] to-[#09071A]',
    plaqueBorder: 'border-[#FCE9A6]/80 bg-gradient-to-b from-[#2A1952] to-[#120D2B]',
  },
  classic_fruits: {
    id: 'classic_fruits',
    title: 'سلوت الفواكه',
    symbols: ['🍒', '🍋', '🍇', '🔔', '⭐', '7️⃣'],
    bgGradient: 'from-[#330A19] via-[#180713] to-[#241306]',
    cabinetFrame:
      'border-rose-400/80 bg-gradient-to-b from-[#3A0C1D] via-[#1B0814] to-[#261408] shadow-[inset_0_0_24px_rgba(0,0,0,0.85),0_0_26px_rgba(244,63,94,0.28)]',
    reelBg: 'bg-gradient-to-b from-[#13050F] via-[#23091B] to-[#0D040A]',
    plaqueBorder: 'border-amber-300/80 bg-gradient-to-b from-[#3E0D21] to-[#1A0712]',
  },
  sea_pirates: {
    id: 'sea_pirates',
    title: 'قراصنة البحار',
    symbols: ['⚓', '🧭', '🦜', '🏴‍☠️', '💣', '💰'],
    bgGradient: 'from-[#062430] via-[#071322] to-[#1E1407]',
    cabinetFrame:
      'border-teal-400/80 bg-gradient-to-b from-[#072B38] via-[#081726] to-[#241807] shadow-[inset_0_0_24px_rgba(0,0,0,0.85),0_0_26px_rgba(45,212,191,0.28)]',
    reelBg: 'bg-gradient-to-b from-[#04111A] via-[#072130] to-[#030D14]',
    plaqueBorder: 'border-[#FCE9A6]/75 bg-gradient-to-b from-[#082E3D] to-[#051822]',
  },
  neon_galaxy: {
    id: 'neon_galaxy',
    title: 'مجرة النيون',
    symbols: ['👾', '☄️', '🌌', '🪐', '🛸', '⚡'],
    bgGradient: 'from-[#071836] via-[#100726] to-[#062133]',
    cabinetFrame:
      'border-cyan-400/80 bg-gradient-to-b from-[#092045] via-[#13092D] to-[#061F30] shadow-[inset_0_0_24px_rgba(0,0,0,0.85),0_0_28px_rgba(34,211,238,0.3)]',
    reelBg: 'bg-gradient-to-b from-[#040B1F] via-[#0E163A] to-[#030816]',
    plaqueBorder: 'border-cyan-300/80 bg-gradient-to-b from-[#0A254E] to-[#08102B]',
  },
  desert_gold: {
    id: 'desert_gold',
    title: 'ذهب الصحراء',
    symbols: ['🌴', '🐪', '🗡️', '🏜️', '🪔', '🪙'],
    bgGradient: 'from-[#2A1806] via-[#150E06] to-[#0B2118]',
    cabinetFrame:
      'border-amber-400/80 bg-gradient-to-b from-[#361E07] via-[#1A1107] to-[#0E241B] shadow-[inset_0_0_24px_rgba(0,0,0,0.85),0_0_28px_rgba(245,158,11,0.3)]',
    reelBg: 'bg-gradient-to-b from-[#120B05] via-[#221509] to-[#0C0803]',
    plaqueBorder: 'border-[#FCE9A6]/80 bg-gradient-to-b from-[#331F07] to-[#170F05]',
  },
  turbo_racing: {
    id: 'turbo_racing',
    title: 'سباق التوربو',
    symbols: ['🛞', '⛽', '🏁', '🏆', '🔥', '🏎️'],
    bgGradient: 'from-[#30080A] via-[#0D111E] to-[#261206]',
    cabinetFrame:
      'border-orange-400/80 bg-gradient-to-b from-[#380B0D] via-[#111626] to-[#291306] shadow-[inset_0_0_24px_rgba(0,0,0,0.85),0_0_28px_rgba(249,115,22,0.28)]',
    reelBg: 'bg-gradient-to-b from-[#0A080C] via-[#1A121C] to-[#08070B]',
    plaqueBorder: 'border-orange-300/80 bg-gradient-to-b from-[#3B0E11] to-[#140A0E]',
  },
};

function buildInitialGrid(symbols: string[]): string[][] {
  return Array.from({ length: 3 }, (_, r) =>
    Array.from({ length: 5 }, (__, c) => symbols[(r * 2 + c + 1) % symbols.length])
  );
}

interface InRoomSlot5x3PlayerProps {
  gameId: SlotGameId;
  jackpotPoolCoins: number;
  mySeat: RoomSeat | null;
  micActive: boolean;
  onToggleMute: () => void;
  onRecharge: () => void;
  onBackToCenter: () => void;
  onClose: () => void;
  onJackpotRefresh?: () => void;
  onPlaySpent?: (coins: number) => void;
}

export const InRoomSlot5x3Player: React.FC<InRoomSlot5x3PlayerProps> = ({
  gameId,
  jackpotPoolCoins,
  mySeat,
  micActive,
  onToggleMute,
  onRecharge,
  onBackToCenter,
  onClose,
  onJackpotRefresh,
  onPlaySpent,
}) => {
  const { user, updateLocalUser } = useAuth();
  const theme = useMemo(() => SLOT_THEMES[gameId] || SLOT_THEMES.jungle_hunt, [gameId]);

  const [betIndex, setBetIndex] = useState<number>(1); // default 250
  const bet = BET_AMOUNTS[betIndex];

  const [grid, setGrid] = useState<string[][]>(() => buildInitialGrid(theme.symbols));
  const [spinningCols, setSpinningCols] = useState<boolean[]>([false, false, false, false, false]);
  const [lockedCols, setLockedCols] = useState<boolean[]>([false, false, false, false, false]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [muted, setMuted] = useState(() => isAudioMuted());

  const [winningCells, setWinningCells] = useState<Set<string>>(new Set());
  const [lightningMap, setLightningMap] = useState<Record<string, number>>({});
  const [lastWin, setLastWin] = useState<number>(0);
  const [lastResult, setLastResult] = useState<SpinResultPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const timersRef = useRef<number[]>([]);
  const intervalRef = useRef<number | null>(null);

  const clearAllTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    setGrid(buildInitialGrid(theme.symbols));
    setWinningCells(new Set());
    setLightningMap({});
    setLastWin(0);
    setLastResult(null);
    setErrorMsg(null);
    return () => clearAllTimers();
  }, [theme]);

  const userCoins = user?.coins ?? 0;
  const insufficientBalance = userCoins < bet || userCoins <= 0;

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
  };

  const stepBet = (delta: number) => {
    if (isSpinning) return;
    setErrorMsg(null);
    setBetIndex((prev) => Math.max(0, Math.min(BET_AMOUNTS.length - 1, prev + delta)));
  };

  const handleSpin = async () => {
    if (!user || isSpinning) return;
    if (user.coins < bet || user.coins <= 0) {
      setErrorMsg('رصيد الكوينز غير كافٍ — اضغط (+) للشحن.');
      return;
    }

    setErrorMsg(null);
    setWinningCells(new Set());
    setLightningMap({});
    setLastResult(null);
    setLastWin(0);
    setIsSpinning(true);

    const activeFlags = [true, true, true, true, true];
    setSpinningCols([...activeFlags]);
    setLockedCols([false, false, false, false, false]);

    let ticks = 0;
    intervalRef.current = window.setInterval(() => {
      ticks++;
      if (ticks % 2 === 0) playSlotSpinTick();
      setGrid((prev) =>
        Array.from({ length: 3 }, (_, rIdx) =>
          Array.from({ length: 5 }, (__, cIdx) =>
            activeFlags[cIdx]
              ? theme.symbols[Math.floor(Math.random() * theme.symbols.length)]
              : prev[rIdx]?.[cIdx] ?? theme.symbols[0]
          )
        )
      );
    }, turbo ? 45 : 65);

    try {
      const result = await spinSlotMachineInSupabase(user.id, theme.id, bet);
      onPlaySpent?.(bet);

      const strikes: Record<string, number> = {};
      for (const s of result.lightningStrikes || []) {
        strikes[`${s.row}-${s.col}`] = s.mult;
      }

      const baseStop = turbo ? 220 : 480;
      const stepStop = turbo ? 110 : 230;

      for (let c = 0; c < 5; c++) {
        const delay = baseStop + c * stepStop;
        const tid = window.setTimeout(() => {
          activeFlags[c] = false;
          setSpinningCols([...activeFlags]);
          playSlotReelStop(c);

          setLockedCols((prev) => prev.map((v, idx) => (idx === c ? true : v)));
          const resetTid = window.setTimeout(() => {
            setLockedCols((prev) => prev.map((v, idx) => (idx === c ? false : v)));
          }, 340);
          timersRef.current.push(resetTid);

          setGrid((prev) =>
            Array.from({ length: 3 }, (_, rIdx) =>
              Array.from({ length: 5 }, (__, colIdx) =>
                colIdx === c
                  ? result.grid[rIdx]?.[colIdx] ?? prev[rIdx]?.[colIdx] ?? theme.symbols[0]
                  : prev[rIdx]?.[colIdx] ?? theme.symbols[0]
              )
            )
          );

          if (c === 4) {
            if (intervalRef.current !== null) {
              window.clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setIsSpinning(false);
            setLastResult(result);
            setLastWin(result.payout);
            setLightningMap(strikes);
            updateLocalUser(result.user);
            onJackpotRefresh?.();

            const winKeys = new Set<string>(
              result.winningCells.map(([r, col]) => `${r}-${col}`)
            );
            setWinningCells(winKeys);

            if (result.payout > 0) {
              const isBig = result.jackpotHit || result.multiplier >= 10;
              playCoinWinSound(isBig);
              fireGoldCoinConfetti(isBig ? 'jackpot' : 'normal');
            }
          }
        }, delay);
        timersRef.current.push(tid);
      }
    } catch (err) {
      clearAllTimers();
      setIsSpinning(false);
      setSpinningCols([false, false, false, false, false]);
      setErrorMsg(err instanceof Error ? err.message : 'تعذّر تنفيذ الدورة.');
    }
  };

  return (
    <div
      className={`relative h-full w-full flex flex-col justify-between bg-gradient-to-b ${theme.bgGradient} border-t-2 border-[#D4AF37]/80 select-none overflow-hidden`}
    >
      {/* Subtle jungle/royal ambient header glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-20 opacity-45"
        style={{
          background:
            theme.accentLeaf
              ? 'radial-gradient(ellipse at top, rgba(34,197,94,0.35), transparent 70%)'
              : 'radial-gradient(ellipse at top, rgba(212,175,55,0.3), transparent 70%)',
        }}
      />

      {/* TOP BAR: Left Corner (X + Mute Sound + Coins + (+)) | Right Corner (Title + Mic + Back to Center) */}
      <div
        dir="ltr"
        className="relative z-20 flex items-center justify-between gap-2 px-2.5 pt-2 pb-1 shrink-0"
      >
        {/* Top-Left Corner Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 border border-white/25 text-white flex items-center justify-center cursor-pointer transition"
            aria-label="إغلاق اللعبة"
            title="إغلاق اللعبة"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={toggleSound}
            className={`w-7 h-7 rounded-full border flex items-center justify-center cursor-pointer transition ${
              muted
                ? 'bg-rose-950/75 border-rose-400/50 text-rose-200'
                : 'bg-black/60 border-white/25 text-[#FCE9A6]'
            }`}
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
            title={muted ? 'تشغيل مؤثرات الصوت' : 'كتم مؤثرات الصوت'}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Real Supabase Coins Pill + Golden (+) Recharge Button */}
          <div className="h-7 rounded-full bg-black/65 border border-[#D4AF37]/55 pl-2 pr-0.5 flex items-center gap-1.5 shadow-inner">
            <Coins className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
            <span className="text-[11px] font-mono-num font-extrabold text-white">
              {userCoins.toLocaleString('en-US')}
            </span>
            <button
              type="button"
              onClick={onRecharge}
              className="w-5 h-5 rounded-full bg-gradient-to-b from-[#FDE047] to-[#D97706] text-[#070913] flex items-center justify-center cursor-pointer hover:brightness-110 active:scale-95 transition shadow"
              aria-label="شحن الكوينز"
              title="شحن الكوينز"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
            </button>
          </div>
        </div>

        {/* Top-Right Title + Live Mic + Return to Game Center */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            dir="rtl"
            className="text-xs sm:text-sm font-extrabold text-[#FCE9A6] drop-shadow truncate max-w-[130px]"
          >
            {theme.title}
          </span>

          {mySeat && (
            <button
              type="button"
              onClick={onToggleMute}
              className={`w-7 h-7 rounded-full border flex items-center justify-center cursor-pointer transition ${
                mySeat.isMuted
                  ? 'bg-rose-950/75 border-rose-400/55 text-rose-200'
                  : 'bg-emerald-950/75 border-emerald-400/60 text-emerald-200'
              }`}
              title={mySeat.isMuted ? 'فتح المايك' : 'كتم المايك'}
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
            onClick={onBackToCenter}
            disabled={isSpinning}
            className="w-7 h-7 rounded-full bg-gradient-to-b from-[#3B82F6] to-[#1D4ED8] border border-[#93C5FD]/60 text-white flex items-center justify-center cursor-pointer hover:brightness-110 disabled:opacity-50 shadow"
            aria-label="الرجوع لمركز الألعاب"
            title="العودة لمركز الألعاب"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* CENTER STAGE: JACKPOT PLAQUE + 5x3 GOLD-FRAMED CYLINDRICAL REELS */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-2.5 sm:px-4">
        {/* Real Supabase JACKPOT Plaque */}
        <div className="relative -mb-2 z-20 flex flex-col items-center">
          <div
            className={`px-5 py-0.5 rounded-t-xl border-2 border-b-0 ${theme.plaqueBorder} shadow-[0_-4px_16px_rgba(250,204,21,0.28)] flex flex-col items-center`}
          >
            <span className="text-[10px] sm:text-[11px] font-black tracking-widest uppercase bg-gradient-to-b from-[#86EFAC] via-[#FDE047] to-[#D97706] bg-clip-text text-transparent drop-shadow">
              JACKPOT
            </span>
            <span className="text-sm sm:text-base font-mono-num font-black text-[#FCE9A6] leading-tight -mt-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              {jackpotPoolCoins.toLocaleString('en-US')}
            </span>
          </div>
        </div>

        {/* 5x3 Reel Cabinet with 3D Metallic Gold Frame, Chasing Perimeter Lights & Pullable 3D Lever */}
        <div dir="ltr" className="relative w-full max-w-md flex items-center justify-center gap-0.5">
          {/* Left Payline Badge "15" */}
          <div className="hidden xs:flex -mr-1.5 z-20 w-5 h-6 rounded-l-md bg-gradient-to-b from-[#FDE047] via-[#B45309] to-[#451A03] border border-[#FEF08A]/80 items-center justify-center text-[10px] font-mono-num font-extrabold text-[#FFFBEB] shadow">
            15
          </div>

          {/* 3D Brushed Metallic Gold Outer Cabinet Bezel */}
          <div className="relative flex-1 min-w-0 rounded-2xl p-[3px] bg-gradient-to-br from-[#FFFBEB] via-[#D4AF37] to-[#78350F] shadow-[0_14px_34px_rgba(0,0,0,0.85),0_0_32px_rgba(212,175,55,0.38)]">
            <div
              className={`relative w-full rounded-[14px] border-2 px-1.5 py-0.5 ${theme.cabinetFrame} overflow-hidden`}
            >
              {/* Top Chasing Perimeter Lights */}
              <SlotMarqueePerimeter
                spinning={isSpinning}
                winning={Boolean(lastResult && !isSpinning && lastResult.payout > 0)}
                count={14}
              />

              {/* Decorative golden corner bevel */}
              <div className="pointer-events-none absolute inset-0 rounded-[12px] border border-[#FDE047]/35" />

              {/* Jackpot / Big Win Light Burst Banner */}
              {lastResult && !isSpinning && (lastResult.jackpotHit || lastResult.multiplier >= 10) && (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
                  <div className="rounded-2xl border-2 border-[#FEF08A] bg-gradient-to-r from-[#451A03]/95 via-[#B45309]/95 to-[#451A03]/95 px-4 py-2 flex items-center gap-2 shadow-[0_0_35px_rgba(250,204,21,0.9)] animate-bounce">
                    <Fluent3DAsset glyph="👑" alt="Jackpot" priority sizeClass="w-8 h-8" />
                    <div className="text-center">
                      <span dir="ltr" className="block text-xs font-black tracking-widest text-[#FEF08A]">
                        JACKPOT! ×{lastResult.multiplier}
                      </span>
                      <span className="block text-xs font-mono-num font-extrabold text-white">
                        +{lastResult.payout.toLocaleString('en-US')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Cylindrical Top/Bottom Shadow Bevel */}
              <div
                className="pointer-events-none absolute inset-x-0 top-4 h-3.5 z-10"
                style={{
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.72), transparent)',
                }}
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-4 h-3.5 z-10"
                style={{
                  background: 'linear-gradient(to top, rgba(0,0,0,0.72), transparent)',
                }}
              />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-3.5 z-10"
              style={{
                background: 'linear-gradient(to top, rgba(0,0,0,0.72), transparent)',
              }}
            />

            <div className="grid grid-cols-5 gap-1">
              {[0, 1, 2, 3, 4].map((cIdx) => {
                const colSpinning = spinningCols[cIdx];
                const colLocked = lockedCols[cIdx];
                return (
                  <div
                    key={cIdx}
                    className={`relative rounded-xl border overflow-hidden transition-all ${
                      colSpinning
                        ? 'border-amber-300/70 shadow-[inset_0_0_12px_rgba(251,191,36,0.28)]'
                        : colLocked
                        ? 'border-[#FCE9A6] animate-reel-lock'
                        : 'border-[#D4AF37]/40'
                    } ${theme.reelBg}`}
                  >
                    {/* Cylindrical glossy specular streak */}
                    <div
                      className="pointer-events-none absolute inset-0 z-10 opacity-45"
                      style={{
                        background:
                          'linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.03) 50%, rgba(0,0,0,0.6) 100%)',
                      }}
                    />

                    <div className={`flex flex-col ${colSpinning ? 'animate-slot-cylinder' : ''}`}>
                      {[0, 1, 2].map((rIdx) => {
                        const key = `${rIdx}-${cIdx}`;
                        const sym =
                          grid[rIdx]?.[cIdx] ??
                          theme.symbols[(rIdx + cIdx) % theme.symbols.length];
                        const isWin = winningCells.has(key);
                        const strikeMult = lightningMap[key];

                        return (
                          <div
                            key={key}
                            className={`relative h-[46px] sm:h-[52px] flex items-center justify-center border-b last:border-b-0 border-white/10 transition-all ${
                              isWin
                                ? 'bg-gradient-to-b from-amber-400/40 via-[#FCE9A6]/35 to-emerald-500/35 shadow-[inset_0_0_14px_rgba(253,224,71,0.85)] ring-1 ring-inset ring-[#FEF08A] scale-[1.03]'
                                : ''
                            }`}
                          >
                            <div className={colSpinning ? 'blur-[1px] opacity-85 scale-90' : ''}>
                              <RoyalSlotSymbol3D symbol={sym} compact winning={isWin} />
                            </div>
                            {!colSpinning && strikeMult && (
                              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/85 border border-[#FCE9A6]/80 px-1 text-[8px] font-mono-num font-extrabold text-[#FCE9A6]">
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

            {/* Bottom Chasing Perimeter Lights */}
            <SlotMarqueePerimeter
              spinning={isSpinning}
              winning={Boolean(lastResult && !isSpinning && lastResult.payout > 0)}
              count={14}
            />
          </div>
          </div>

          {/* Right Payline Badge "15" */}
          <div className="hidden xs:flex -ml-1.5 z-20 w-5 h-6 rounded-r-md bg-gradient-to-b from-[#FDE047] via-[#B45309] to-[#451A03] border border-[#FEF08A]/80 items-center justify-center text-[10px] font-mono-num font-extrabold text-[#FFFBEB] shadow">
            15
          </div>

          {/* Interactive Pullable 3D Slot Lever */}
          <SlotMachine3DLever
            compact
            spinning={isSpinning}
            disabled={insufficientBalance}
            onPull={() => void handleSpin()}
          />
        </div>

        {/* Inline Status / Feedback Micro-Banner */}
        <div className="h-5 mt-1 flex items-center justify-center">
          {errorMsg ? (
            <button
              type="button"
              onClick={onRecharge}
              className="text-[10px] font-extrabold text-amber-200 bg-rose-950/80 border border-rose-400/50 rounded-full px-3 py-0.5 cursor-pointer"
            >
              {errorMsg}
            </button>
          ) : insufficientBalance && !isSpinning ? (
            <button
              type="button"
              onClick={onRecharge}
              className="text-[10px] font-extrabold text-[#FEF08A] bg-amber-950/80 border border-amber-400/50 rounded-full px-3 py-0.5 cursor-pointer"
            >
              رصيدك ({userCoins.toLocaleString('en-US')}) أقل من الرهان — اضغط للشحن (+)
            </button>
          ) : lastResult && !isSpinning && lastResult.payout > 0 ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-300 bg-emerald-950/75 border border-emerald-400/50 rounded-full px-3 py-0.5">
              <Sparkles className="w-3 h-3 text-[#FDE047]" />
              <span>
                {lastResult.jackpotHit ? 'جاكبوت ملكي!' : 'فوز رائع!'}{' '}
                +{lastResult.payout.toLocaleString('en-US')} (×{lastResult.multiplier})
              </span>
            </span>
          ) : null}
        </div>
      </div>

      {/* BOTTOM CONTROL DOCK: Turbo ⚡ | WIN Counter | - Bet + | Green SPIN */}
      <div
        dir="ltr"
        className="relative z-20 shrink-0 px-3 pt-1.5 pb-[max(env(safe-area-inset-bottom,0px),10px)] bg-gradient-to-t from-[#1A0D05] via-[#2B1709]/95 to-transparent border-t border-[#D4AF37]/30 flex items-center justify-between gap-2"
      >
        {/* 1. Turbo Toggle (⚡) */}
        <button
          type="button"
          onClick={() => setTurbo((t) => !t)}
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 flex items-center justify-center cursor-pointer transition active:scale-95 shrink-0 ${
            turbo
              ? 'bg-gradient-to-b from-[#FEF08A] via-[#F59E0B] to-[#B45309] border-[#FFFBEB] text-[#070913] shadow-[0_0_18px_rgba(250,204,21,0.8)]'
              : 'bg-gradient-to-b from-[#F59E0B]/85 to-[#92400E] border-[#FDE68A]/70 text-white'
          }`}
          aria-label="تفعيل السرعة الفائقة"
          title={turbo ? 'إيقاف السرعة المضاعفة' : 'تشغيل السرعة المضاعفة'}
        >
          <Zap className="w-5 h-5 fill-current" />
        </button>

        {/* 2. WIN Counter */}
        <div className="flex flex-col items-center justify-center min-w-[66px]">
          <span
            className={`text-sm sm:text-base font-mono-num font-black leading-none ${
              lastWin > 0
                ? 'text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.85)]'
                : 'text-[#FEF08A]'
            }`}
          >
            {lastWin.toLocaleString('en-US')}
          </span>
          <span className="text-[10px] font-black tracking-wider text-amber-400 mt-0.5">
            WIN
          </span>
        </div>

        {/* 3. Bet Steppers (- / Bet Pill / +) */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={isSpinning || betIndex === 0}
            onClick={() => stepBet(-1)}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-b from-[#FDE047] to-[#D97706] border border-[#FEF9C3]/80 text-[#070913] flex items-center justify-center cursor-pointer disabled:opacity-40 active:scale-95 shadow"
            aria-label="تقليل الرهان"
          >
            <Minus className="w-4 h-4 stroke-[3]" />
          </button>

          <div className="h-8 px-2.5 rounded-full bg-[#120904]/90 border border-[#D4AF37]/55 flex items-center gap-1 shadow-inner">
            <Coins className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
            <span className="text-xs font-mono-num font-extrabold text-white">
              {bet.toLocaleString('en-US')}
            </span>
          </div>

          <button
            type="button"
            disabled={isSpinning || betIndex === BET_AMOUNTS.length - 1}
            onClick={() => stepBet(1)}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-b from-[#FDE047] to-[#D97706] border border-[#FEF9C3]/80 text-[#070913] flex items-center justify-center cursor-pointer disabled:opacity-40 active:scale-95 shadow"
            aria-label="زيادة الرهان"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* 4. Large Circular Green SPIN Button (Strictly Disabled When Coins < Bet) */}
        <button
          type="button"
          disabled={isSpinning || insufficientBalance}
          onClick={() => void handleSpin()}
          className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-b from-[#84CC16] via-[#22C55E] to-[#15803D] border-[3px] border-[#ECFCCB] text-white font-black tracking-wide flex flex-col items-center justify-center shadow-[0_4px_20px_rgba(34,197,94,0.65),inset_0_2px_6px_rgba(255,255,255,0.45)] hover:brightness-110 active:scale-95 transition cursor-pointer disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed shrink-0"
          aria-label="تدوير"
        >
          <span className="text-xs sm:text-sm leading-none drop-shadow">
            {isSpinning ? '...' : 'SPIN'}
          </span>
        </button>
      </div>
    </div>
  );
};
