import React, { useRef, useState } from 'react';
import { playSlotLeverPull } from '../lib/sadaAudio';

interface SlotMachine3DLeverProps {
  disabled?: boolean;
  spinning?: boolean;
  compact?: boolean;
  onPull: () => void;
}

/**
 * Interactive tactile 3D metallic casino slot lever arm.
 * Supports tap/click and downward drag pull to spin the reels.
 */
export const SlotMachine3DLever: React.FC<SlotMachine3DLeverProps> = ({
  disabled = false,
  spinning = false,
  compact = false,
  onPull,
}) => {
  const [pulled, setPulled] = useState(false);
  const startYRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);

  const triggerPull = () => {
    if (disabled || spinning || triggeredRef.current) return;
    triggeredRef.current = true;
    setPulled(true);
    playSlotLeverPull();
    onPull();
    window.setTimeout(() => {
      setPulled(false);
      triggeredRef.current = false;
    }, 480);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || spinning) return;
    startYRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (startYRef.current === null || disabled || spinning) return;
    if (e.clientY - startYRef.current > 18) {
      startYRef.current = null;
      triggerPull();
    }
  };

  const handlePointerUp = () => {
    if (startYRef.current !== null) {
      startYRef.current = null;
      triggerPull();
    }
  };

  return (
    <button
      type="button"
      disabled={disabled || spinning}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        startYRef.current = null;
      }}
      aria-label="اسحب ذراع ماكينة السلوت"
      title="اسحب الذراع للتدوير"
      className={`group relative flex flex-col items-center justify-center shrink-0 select-none cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus:outline-none ${
        compact ? 'w-7 h-28' : 'w-10 sm:w-11 h-40 sm:h-48'
      }`}
    >
      {/* Metallic Wall Mount Bracket */}
      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-r-xl border-y-2 border-r-2 border-[#FEF08A]/80 bg-gradient-to-b from-[#FDE047] via-[#B45309] to-[#451A03] shadow-[0_4px_12px_rgba(0,0,0,0.85)] ${
          compact ? 'w-2.5 h-10' : 'w-3.5 h-14'
        }`}
      />

      {/* Articulated Arm + 3D Ruby-Gold Knob */}
      <div
        className="relative flex flex-col items-center transition-transform duration-300 ease-out origin-bottom"
        style={{
          transform: pulled
            ? compact
              ? 'translateY(34px) scaleY(0.58)'
              : 'translateY(52px) scaleY(0.58)'
            : 'translateY(0px) scaleY(1)',
        }}
      >
        {/* 3D Glossy Ruby & Gold Ball Top */}
        <div
          className={`relative rounded-full border-2 border-[#FEF08A] bg-gradient-to-br from-[#FDA4AF] via-[#E11D48] to-[#881337] shadow-[0_0_16px_rgba(244,63,94,0.65),inset_0_3px_6px_rgba(255,255,255,0.75),inset_0_-4px_6px_rgba(0,0,0,0.65)] group-hover:scale-110 transition-transform ${
            compact ? 'w-5 h-5' : 'w-7 h-7 sm:w-8 sm:h-8'
          }`}
        >
          <span
            aria-hidden="true"
            className="absolute top-0.5 left-1 w-2 h-1.5 rounded-full bg-white/75 blur-[0.5px]"
          />
        </div>

        {/* Chrome & Gold Shaft */}
        <div
          className={`rounded-b-full bg-gradient-to-r from-[#FFFBEB] via-[#D4AF37] to-[#78350F] border-x border-[#FEF9C3]/60 shadow-inner ${
            compact ? 'w-1.5 h-12' : 'w-2 h-20 sm:h-24'
          }`}
        />
      </div>
    </button>
  );
};

interface SlotMarqueePerimeterProps {
  spinning?: boolean;
  winning?: boolean;
  count?: number;
}

/**
 * Glowing chasing marquee bulbs along the top & bottom of the 3D gold slot bezel.
 */
export const SlotMarqueePerimeter: React.FC<SlotMarqueePerimeterProps> = ({
  spinning = false,
  winning = false,
  count = 14,
}) => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none flex items-center justify-between px-2.5 py-0.5"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <span
          key={idx}
          className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-colors ${
            winning
              ? 'bg-[#FEF08A] animate-marquee-bulb'
              : spinning
              ? idx % 2 === 0
                ? 'bg-amber-300 animate-marquee-bulb'
                : 'bg-emerald-300 animate-marquee-bulb'
              : 'bg-[#FDE047]/80 animate-marquee-bulb'
          }`}
          style={{
            animationDelay: `${(idx % 4) * (spinning ? 110 : 260)}ms`,
            animationDuration: spinning ? '0.45s' : winning ? '0.35s' : '1.4s',
          }}
        />
      ))}
    </div>
  );
};
