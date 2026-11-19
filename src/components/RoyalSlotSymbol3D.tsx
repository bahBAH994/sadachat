import React from 'react';
import { Fluent3DAsset } from './Fluent3DAsset';

interface RoyalSlotSymbol3DProps {
  symbol: string;
  compact?: boolean;
  winning?: boolean;
}

/**
 * Renders high-resolution 3D glossy Fluent PNG assets for slot symbols
 * and sculpted metallic 3D jewel emblems for Golden 777 / WILD / K / J.
 */
export const RoyalSlotSymbol3D: React.FC<RoyalSlotSymbol3DProps> = ({
  symbol,
  compact = false,
  winning = false,
}) => {
  const sizeClass = compact ? 'w-9 h-9 sm:w-11 sm:h-11' : 'w-12 h-12 sm:w-16 sm:h-16';
  const glow = winning
    ? 'drop-shadow-[0_0_18px_rgba(252,233,166,0.98)] scale-105'
    : 'drop-shadow-[0_6px_12px_rgba(0,0,0,0.78)]';

  if (symbol === '7️⃣') {
    return (
      <div
        className={`${sizeClass} ${glow} rounded-xl border-2 border-[#FEF08A] bg-gradient-to-br from-[#7F1D1D] via-[#B91C1C] to-[#450A0A] flex flex-col items-center justify-center relative overflow-hidden shadow-[inset_0_2px_6px_rgba(255,255,255,0.4),0_4px_14px_rgba(212,175,55,0.55)] select-none`}
        aria-label="777 الذهبي"
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent pointer-events-none"
        />
        <span
          dir="ltr"
          className={`${
            compact ? 'text-[13px] sm:text-[15px]' : 'text-lg sm:text-2xl'
          } font-black tracking-tighter leading-none bg-gradient-to-b from-[#FFFBEB] via-[#FDE047] to-[#D97706] bg-clip-text text-transparent drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]`}
        >
          777
        </span>
      </div>
    );
  }

  if (symbol === 'WILD') {
    return (
      <div
        className={`${sizeClass} ${glow} rounded-xl border-2 border-[#FCE9A6] bg-gradient-to-br from-[#16A34A] via-[#064E3B] to-[#022C22] flex items-center justify-center relative overflow-hidden shadow-[inset_0_2px_6px_rgba(255,255,255,0.35),0_4px_12px_rgba(0,0,0,0.75)] select-none`}
        aria-label="WILD"
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none"
        />
        <span
          dir="ltr"
          className={`${
            compact ? 'text-[10px]' : 'text-xs sm:text-sm'
          } font-black tracking-wider bg-gradient-to-b from-[#FEF9C3] via-[#FACC15] to-[#EA580C] bg-clip-text text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]`}
        >
          WILD
        </span>
      </div>
    );
  }

  if (symbol === 'K' || symbol === 'J') {
    const palette =
      symbol === 'K'
        ? 'from-[#FEF08A] via-[#22C55E] to-[#14532D] border-[#FDE047] text-[#FEF9C3]'
        : 'from-[#BAE6FD] via-[#0284C7] to-[#1E3A8A] border-[#7DD3FC] text-[#E0F2FE]';
    return (
      <div
        className={`${sizeClass} ${glow} rounded-xl border-2 bg-gradient-to-br ${palette} flex items-center justify-center relative overflow-hidden shadow-[inset_0_2px_6px_rgba(255,255,255,0.35),0_4px_12px_rgba(0,0,0,0.75)] select-none`}
        aria-label={symbol}
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none"
        />
        <span
          dir="ltr"
          className={`${
            compact ? 'text-xl' : 'text-2xl sm:text-3xl'
          } font-black leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]`}
        >
          {symbol}
        </span>
      </div>
    );
  }

  return (
    <Fluent3DAsset
      glyph={symbol}
      alt={symbol}
      priority
      sizeClass={sizeClass}
      fallbackTextClass={compact ? 'text-2xl' : 'text-3xl sm:text-4xl'}
      className={`transition-transform duration-200 ${glow}`}
    />
  );
};
