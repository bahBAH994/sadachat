import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Coins,
  Gamepad2,
  Headphones,
  Mic,
  MicOff,
  Radio,
  Trophy,
  X,
} from 'lucide-react';
import type { RoomSeat } from '../types';
import { GamesCenterPage } from '../pages/GamesCenterPage';
import { CompetitionsPage } from '../pages/CompetitionsPage';

type OverlaySection = 'games' | 'competitions';

interface RoomGamesModalProps {
  roomTitle: string;
  mySeat: RoomSeat | null;
  micActive: boolean;
  userCoins: number;
  initialSection?: OverlaySection;
  onToggleMute: () => void;
  onClose: () => void;
}

export const RoomGamesModal: React.FC<RoomGamesModalProps> = ({
  roomTitle,
  mySeat,
  micActive,
  userCoins,
  initialSection = 'games',
  onToggleMute,
  onClose,
}) => {
  const [section, setSection] = useState<OverlaySection>(initialSection);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 48, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 48, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="royal-glass w-full sm:max-w-5xl h-[90vh] sm:h-[86vh] rounded-t-[2rem] sm:rounded-3xl border border-[#D4AF37]/50 shadow-[0_0_55px_rgba(212,175,55,0.28)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Bottom-Sheet Drag Handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <span className="w-12 h-1.5 rounded-full bg-[#D4AF37]/45" />
        </div>

        {/* Floating Modal / Sheet Sticky Header */}
        <div className="px-4 sm:px-6 pt-2 sm:pt-4 pb-3 border-b border-[#D4AF37]/25 bg-[#070913]/85 shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-[#FCE9A6]/25 to-[#D4AF37]/10 border border-[#D4AF37]/45 flex items-center justify-center shrink-0">
                <Gamepad2 className="w-5 h-5 text-[#FCE9A6]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-lg font-extrabold gold-gradient-text truncate">
                  ساحة الألعاب والمسابقات داخل الغرفة
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-300 flex items-center gap-1.5 truncate">
                  <Radio className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">
                    متصل بالغرفة: {roomTitle} — الصوت والمايك مستمران
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Live Mic Control / Listening Indicator */}
              {mySeat ? (
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`min-h-[38px] rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer border transition ${
                    mySeat.isMuted
                      ? 'bg-rose-950/60 border-rose-500/45 text-rose-200 hover:bg-rose-900/60'
                      : 'bg-emerald-950/60 border-emerald-400/50 text-emerald-200 hover:bg-emerald-900/60'
                  }`}
                  title={mySeat.isMuted ? 'إلغاء كتم المايك' : 'كتم المايك'}
                >
                  {mySeat.isMuted ? (
                    <>
                      <MicOff className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">المايك مكتوم</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 animate-pulse" />
                      <span className="hidden md:inline">
                        {micActive ? 'على المايك · حي' : 'على المايك'}
                      </span>
                    </>
                  )}
                </button>
              ) : (
                <span className="hidden sm:flex min-h-[38px] items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-slate-300">
                  <Headphones className="w-3.5 h-3.5 text-[#F3D37A]" />
                  <span>مستمع مباشر</span>
                </span>
              )}

              {/* Live Coins Pill */}
              <div className="hidden sm:flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#0B0F20]/90 border border-[#D4AF37]/35 px-3 py-1.5 text-xs">
                <Coins className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="font-mono-num font-extrabold text-[#FCE9A6]">
                  {userCoins.toLocaleString('en-US')}
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white cursor-pointer transition"
                aria-label="إغلاق نافذة الألعاب"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Section Switcher: Games (Slots/Dice/Roulette/Mystery) vs Competitions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSection('games')}
              className={`min-h-[42px] rounded-2xl px-3 py-2 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer transition border ${
                section === 'games'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913] border-[#FCE9A6] shadow-[0_0_20px_rgba(212,175,55,0.3)]'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:border-[#D4AF37]/35'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              <span>الألعاب (السلوت والنرد والروليت)</span>
            </button>
            <button
              type="button"
              onClick={() => setSection('competitions')}
              className={`min-h-[42px] rounded-2xl px-3 py-2 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer transition border ${
                section === 'competitions'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913] border-[#FCE9A6] shadow-[0_0_20px_rgba(212,175,55,0.3)]'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:border-[#D4AF37]/35'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>المسابقات ودولاب الدعوات</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-3.5 sm:p-5 bg-[#050711]/55">
          {section === 'games' ? (
            <GamesCenterPage embedded />
          ) : (
            <CompetitionsPage embedded />
          )}
        </div>
      </motion.div>
    </div>
  );
};
