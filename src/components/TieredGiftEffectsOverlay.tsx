import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import type {
  RoomFlyingGiftEvent,
  Tier1SideNotice,
} from '../context/ActiveRoomContext';
import { Fluent3DAsset } from './Fluent3DAsset';

interface TieredGiftEffectsOverlayProps {
  tier1SideNotices: Tier1SideNotice[];
  mediumCelebrationGift: RoomFlyingGiftEvent | null;
  hostName: string;
}

const GOLDEN_LIGHT_PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x: ((i * 37) % 100) - 50, // relative offset vw/px
  yStart: 36 + (i % 5) * 18,
  yEnd: -90 - (i % 6) * 22,
  size: 5 + (i % 4) * 3,
  delay: (i % 7) * 0.14,
  duration: 1.8 + (i % 4) * 0.35,
  leftPct: 12 + ((i * 29) % 76),
  topPct: 24 + ((i * 19) % 52),
}));

export const TieredGiftEffectsOverlay: React.FC<TieredGiftEffectsOverlayProps> = ({
  tier1SideNotices,
  mediumCelebrationGift,
  hostName,
}) => {
  return (
    <>
      {/* TIER 1 (<100 coins): Elegant Side Combo Banners */}
      <div className="fixed right-2.5 sm:right-5 top-[132px] z-[42] flex flex-col gap-2 pointer-events-none max-w-[275px] sm:max-w-[310px]">
        <AnimatePresence>
          {tier1SideNotices.map((notice) => (
            <motion.div
              key={notice.id}
              layout
              initial={{ x: 96, opacity: 0, scale: 0.9 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 84, opacity: 0, scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 360, damping: 26 }}
              className="relative flex items-center gap-2.5 rounded-2xl border border-[#F3D37A]/65 bg-gradient-to-r from-[#241908]/95 via-[#130E07]/95 to-[#1E160A]/92 pl-3 pr-2.5 py-2 shadow-[0_10px_28px_rgba(0,0,0,0.65),0_0_18px_rgba(212,175,55,0.28)] backdrop-blur-md"
            >
              <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-amber-400/25 blur-sm"
                />
                <Fluent3DAsset
                  glyph={notice.gift.glyph}
                  imageUrl={notice.gift.imageUrl}
                  alt={notice.gift.name}
                  priority
                  sizeClass="w-9 h-9"
                  fallbackTextClass="text-2xl"
                  className="drop-shadow-[0_6px_10px_rgba(0,0,0,0.75)]"
                />
              </div>

              <div className="min-w-0 flex-1 text-right">
                <p className="text-[11px] font-extrabold text-white truncate leading-tight">
                  <span className="text-[#FCE9A6]">{notice.senderName}</span>{' '}
                  <span className="text-slate-300 font-semibold">أهدى</span>{' '}
                  <span className="text-amber-200">{notice.recipientName}</span>
                </p>
                <p className="text-[10px] font-bold text-amber-100/90 truncate mt-0.5">
                  {notice.gift.name}
                  {notice.quantity > 1 ? ` ×${notice.quantity}` : ''}
                </p>
              </div>

              <motion.div
                key={`${notice.id}_${notice.comboCount}`}
                initial={{ scale: 1.55 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                className="shrink-0 rounded-xl bg-gradient-to-br from-[#FEF08A] via-[#D4AF37] to-[#B45309] px-2 py-1 text-[11px] font-mono-num font-black text-[#070913] shadow-[0_0_14px_rgba(251,191,36,0.65)]"
              >
                Combo x{notice.comboCount}
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* TIER 2 (100-999 coins): 3s Center-Screen Large Glowing Celebratory Card + Golden Particles */}
      <div className="fixed inset-0 z-[48] pointer-events-none flex items-center justify-center px-4 overflow-hidden">
        <AnimatePresence>
          {mediumCelebrationGift && (
            <motion.div
              key={mediumCelebrationGift.id}
              initial={{ opacity: 0, scale: 0.72, y: 24 }}
              animate={{
                opacity: [0, 1, 1, 1, 0],
                scale: [0.72, 1.04, 1, 1.01, 0.94],
                y: [24, 0, 0, -2, -10],
              }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 3, times: [0, 0.12, 0.78, 0.9, 1], ease: 'easeOut' }}
              className="relative w-full max-w-sm flex items-center justify-center"
            >
              {/* Floating Golden Light Particles */}
              <div className="absolute -inset-16 pointer-events-none">
                {GOLDEN_LIGHT_PARTICLES.map((pt) => (
                  <motion.span
                    key={pt.id}
                    initial={{ opacity: 0, y: pt.yStart, scale: 0.4 }}
                    animate={{
                      opacity: [0, 0.95, 0.85, 0],
                      y: [pt.yStart, pt.yEnd],
                      x: [0, pt.x * 0.45],
                      scale: [0.4, 1.25, 0.5],
                    }}
                    transition={{
                      duration: pt.duration,
                      delay: pt.delay,
                      ease: 'easeOut',
                    }}
                    style={{
                      left: `${pt.leftPct}%`,
                      top: `${pt.topPct}%`,
                      width: pt.size,
                      height: pt.size,
                    }}
                    className="absolute rounded-full bg-gradient-to-tr from-amber-400 via-yellow-200 to-white shadow-[0_0_14px_rgba(253,224,71,0.95)]"
                  />
                ))}
              </div>

              {/* Glowing Celebratory Card */}
              <div className="relative w-full rounded-3xl border-2 border-[#FCE9A6]/85 bg-gradient-to-b from-[#342107]/95 via-[#171007]/96 to-[#261806]/95 p-5 text-center shadow-[0_0_55px_rgba(245,158,11,0.6),inset_0_1px_0_rgba(255,248,220,0.3)] backdrop-blur-md">
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-amber-400/15 via-transparent to-yellow-200/15 pointer-events-none"
                />

                <div className="relative flex flex-col items-center">
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-extrabold text-[#FCE9A6] mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>هدية مميزة متوهجة</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  </div>

                  {/* Large 3D Gift Showcase */}
                  <div className="relative my-1 w-28 h-28 flex items-center justify-center">
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-400/45 via-yellow-200/25 to-orange-500/35 blur-xl animate-pulse"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-2 rounded-full border border-[#FCE9A6]/65 shadow-[0_0_24px_rgba(251,191,36,0.75)]"
                    />
                    <motion.div
                      animate={{ y: [0, -6, 0], scale: [0.96, 1.07, 0.96] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <Fluent3DAsset
                        glyph={mediumCelebrationGift.gift.glyph}
                        imageUrl={mediumCelebrationGift.gift.imageUrl}
                        alt={mediumCelebrationGift.gift.name}
                        priority
                        sizeClass="w-24 h-24"
                        fallbackTextClass="text-6xl"
                        className="drop-shadow-[0_12px_22px_rgba(0,0,0,0.8)]"
                      />
                    </motion.div>
                  </div>

                  <h4 className="mt-1 text-base font-black gold-gradient-text">
                    {mediumCelebrationGift.gift.name}
                    {mediumCelebrationGift.quantity > 1
                      ? ` ×${mediumCelebrationGift.quantity}`
                      : ''}
                  </h4>

                  <p className="mt-1 text-xs sm:text-sm font-bold text-white leading-snug">
                    من <span className="text-[#FCE9A6]">{mediumCelebrationGift.senderName}</span>{' '}
                    إلى{' '}
                    <span className="text-amber-300">
                      {mediumCelebrationGift.recipientNames.length > 1
                        ? `الجميع (${mediumCelebrationGift.recipientNames.length})`
                        : mediumCelebrationGift.recipientNames[0] || hostName}
                    </span>
                  </p>

                  {mediumCelebrationGift.comboCount > 1 && (
                    <span className="mt-2 inline-flex items-center rounded-full bg-gradient-to-r from-[#FEF08A] to-[#D4AF37] px-3 py-0.5 text-[11px] font-mono-num font-black text-[#070913] shadow">
                      Combo x{mediumCelebrationGift.comboCount}
                    </span>
                  )}

                  {mediumCelebrationGift.luckyMultiplier ? (
                    <p className="mt-1.5 text-[11px] font-mono-num font-extrabold text-emerald-300">
                      مضاعف الحظ ×{mediumCelebrationGift.luckyMultiplier} · +
                      {mediumCelebrationGift.luckyBonusCoins?.toLocaleString('en-US') || 0} كوينز
                    </p>
                  ) : null}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};
