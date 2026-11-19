import React from 'react';

const FACE_PIP_MAP: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Target Euler angles (deg) to orient a 3D cube cleanly toward the camera
const VALUE_ROTATION_MAP: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: -90, y: 0 },
  6: { x: 0, y: 180 },
};

interface DieFaceGridProps {
  faceValue: number;
  compact?: boolean;
}

const DieFaceGrid: React.FC<DieFaceGridProps> = ({ faceValue, compact }) => {
  const pips = FACE_PIP_MAP[faceValue] || FACE_PIP_MAP[1];
  const isOneOrSix = faceValue === 1 || faceValue === 6;

  return (
    <div
      className={`relative w-full h-full rounded-2xl border-2 border-[#FCE9A6]/85 bg-gradient-to-br from-[#2B355C] via-[#121833] to-[#060914] overflow-hidden ${
        compact ? 'p-1.5 gap-0.5' : 'p-2.5 sm:p-3 gap-1.5'
      } grid grid-cols-3 grid-rows-3 place-items-center shadow-[inset_0_3px_10px_rgba(255,255,255,0.24),inset_0_-6px_12px_rgba(0,0,0,0.85),0_4px_12px_rgba(0,0,0,0.65)]`}
    >
      {/* Top-left 3D Glossy Specular Highlight */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-2 -left-2 w-3/4 h-1/2 rounded-full bg-gradient-to-br from-white/25 via-white/5 to-transparent blur-[1px]"
      />
      {Array.from({ length: 9 }).map((_, idx) => {
        const active = pips.includes(idx);
        return (
          <span
            key={idx}
            className={`relative ${
              compact ? 'w-2 h-2' : 'w-3 h-3 sm:w-3.5 sm:h-3.5'
            } rounded-full transition-all ${
              active
                ? isOneOrSix
                  ? 'bg-gradient-to-br from-[#FEF9C3] via-[#F59E0B] to-[#991B1B] ring-1 ring-[#FEF08A]/70 shadow-[0_0_10px_rgba(251,191,36,0.95),inset_0_1.5px_2px_rgba(255,255,255,0.85),inset_0_-1.5px_2px_rgba(0,0,0,0.65)]'
                  : 'bg-gradient-to-br from-[#FFFFFF] via-[#FDE68A] to-[#B45309] ring-1 ring-[#FEF3C7]/60 shadow-[0_0_8px_rgba(252,233,166,0.85),inset_0_1.5px_2px_rgba(255,255,255,0.9),inset_0_-1px_2px_rgba(0,0,0,0.5)]'
                : 'bg-transparent'
            }`}
          />
        );
      })}
    </div>
  );
};

interface Royal3DDieFaceBadgeProps {
  value: number;
  sizeClass?: string;
}

/**
 * Compact sculpted 3D die face badge (1-6) for live mic dice reactions.
 */
export const Royal3DDieFaceBadge: React.FC<Royal3DDieFaceBadgeProps> = ({
  value,
  sizeClass = 'w-12 h-12 sm:w-14 sm:h-14',
}) => {
  const safeVal = Math.max(1, Math.min(6, Math.round(value || 1)));
  return (
    <div
      className={`relative ${sizeClass} drop-shadow-[0_10px_18px_rgba(0,0,0,0.75)] select-none`}
      aria-label={`نرد ${safeVal}`}
    >
      <div className="w-full h-full rounded-2xl p-[2px] bg-gradient-to-br from-[#FEF08A] via-[#D4AF37] to-[#78350F] shadow-[0_0_20px_rgba(251,191,36,0.65)]">
        <DieFaceGrid faceValue={safeVal} compact />
      </div>
    </div>
  );
};

interface Royal3DDieCubeProps {
  value: number;
  rolling?: boolean;
  compact?: boolean;
}

/**
 * True CSS 3D 6-sided Die Cube with all 6 faces rendered in 3D space.
 * Smoothly tumbles across X/Y/Z axes while rolling, then lands flat on the exact rolled number.
 */
export const Royal3DDieCube: React.FC<Royal3DDieCubeProps> = ({
  value,
  rolling = false,
  compact = false,
}) => {
  const sizePx = compact ? 58 : 80;
  const halfPx = sizePx / 2;
  const target = VALUE_ROTATION_MAP[value] || VALUE_ROTATION_MAP[1];

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Ground Contact Shadow on Velvet */}
      <div
        className={`absolute -bottom-2.5 rounded-full bg-black/65 blur-md transition-all duration-300 ${
          rolling ? 'w-12 h-3 opacity-55 scale-90' : 'w-16 h-4 opacity-85 scale-100'
        }`}
      />

      <div
        className="perspective-dice select-none"
        style={{ width: sizePx, height: sizePx }}
      >
        <div
          className={`w-full h-full relative preserve-3d ${
            rolling ? 'animate-dice-tumble' : 'transition-transform duration-500 ease-out'
          }`}
          style={
            rolling
              ? undefined
              : {
                  transform: `rotateX(${target.x}deg) rotateY(${target.y}deg)`,
                }
          }
        >
          {/* Face 1: Front */}
          <div
            className="absolute inset-0 backface-hidden"
            style={{ transform: `rotateY(0deg) translateZ(${halfPx}px)` }}
          >
            <DieFaceGrid faceValue={1} compact={compact} />
          </div>
          {/* Face 6: Back */}
          <div
            className="absolute inset-0 backface-hidden"
            style={{ transform: `rotateY(180deg) translateZ(${halfPx}px)` }}
          >
            <DieFaceGrid faceValue={6} compact={compact} />
          </div>
          {/* Face 3: Right */}
          <div
            className="absolute inset-0 backface-hidden"
            style={{ transform: `rotateY(90deg) translateZ(${halfPx}px)` }}
          >
            <DieFaceGrid faceValue={3} compact={compact} />
          </div>
          {/* Face 4: Left */}
          <div
            className="absolute inset-0 backface-hidden"
            style={{ transform: `rotateY(-90deg) translateZ(${halfPx}px)` }}
          >
            <DieFaceGrid faceValue={4} compact={compact} />
          </div>
          {/* Face 5: Top */}
          <div
            className="absolute inset-0 backface-hidden"
            style={{ transform: `rotateX(90deg) translateZ(${halfPx}px)` }}
          >
            <DieFaceGrid faceValue={5} compact={compact} />
          </div>
          {/* Face 2: Bottom */}
          <div
            className="absolute inset-0 backface-hidden"
            style={{ transform: `rotateX(-90deg) translateZ(${halfPx}px)` }}
          >
            <DieFaceGrid faceValue={2} compact={compact} />
          </div>
        </div>
      </div>
    </div>
  );
};
