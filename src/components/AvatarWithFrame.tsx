import React, { useState } from 'react';
import { User } from 'lucide-react';
import { resolveAsset } from '../lib/assets';

const FRAME_CLASSES: Record<string, string> = {
  frame_obsidian: 'ring-2 ring-[#D4AF37]/50 shadow-[0_0_12px_rgba(212,175,55,0.25)]',
  frame_crescent: 'ring-2 ring-[#F3D37A] shadow-[0_0_18px_rgba(243,211,122,0.5)]',
  frame_sapphire: 'ring-[3px] ring-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.55)]',
  frame_imperial: 'ring-[3px] ring-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.75)]',
  frame_silver_7d: 'ring-[3px] ring-slate-200 shadow-[0_0_20px_rgba(226,232,240,0.68)]',
  frame_gold_15d: 'ring-[3px] ring-[#FCE9A6] shadow-[0_0_24px_rgba(243,211,122,0.85)]',
  frame_royal_30d: 'ring-[4px] ring-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.95)]',
  frame_car_luxury: 'ring-[3px] ring-emerald-400 shadow-[0_0_22px_rgba(16,185,129,0.75)]',
  frame_winged_falcon: 'ring-[3px] ring-amber-400 animate-falcon-aura',
  frame_diamond_crown: 'ring-[3px] ring-sky-400 animate-diamond-aura',
  frame_imperial_dragon: 'ring-[4px] ring-amber-300 animate-dragon-aura',
  frame_emerald_aura: 'ring-[3px] ring-emerald-400 animate-falcon-aura',
  frame_royal_phoenix: 'ring-[3px] ring-amber-400 animate-dragon-aura',
  frame_galaxy_sovereign: 'ring-[4px] ring-violet-400 animate-diamond-aura',
  frame_host_gift_7d: 'ring-[3px] ring-rose-400 animate-diamond-aura',
};

const FRAME_3D_BADGE: Record<string, { glyph: string; ringBg: string }> = {
  frame_car_luxury: {
    glyph: '🏎️',
    ringBg: 'conic-gradient(from 0deg, #10b981, #34d399, #fde047, #10b981)',
  },
  frame_winged_falcon: {
    glyph: '🦅',
    ringBg: 'conic-gradient(from 0deg, #f59e0b, #fef08a, #10b981, #f59e0b)',
  },
  frame_diamond_crown: {
    glyph: '👑',
    ringBg: 'conic-gradient(from 0deg, #38bdf8, #a855f7, #e0f2fe, #38bdf8)',
  },
  frame_imperial_dragon: {
    glyph: '🐉',
    ringBg: 'conic-gradient(from 0deg, #ef4444, #f59e0b, #fef08a, #ef4444)',
  },
  frame_emerald_aura: {
    glyph: '💚',
    ringBg: 'conic-gradient(from 0deg, #10b981, #34d399, #fef08a, #10b981)',
  },
  frame_royal_phoenix: {
    glyph: '🔥',
    ringBg: 'conic-gradient(from 0deg, #f97316, #fbbf24, #ef4444, #f97316)',
  },
  frame_galaxy_sovereign: {
    glyph: '🌌',
    ringBg: 'conic-gradient(from 0deg, #8b5cf6, #38bdf8, #fde047, #8b5cf6)',
  },
  frame_host_gift_7d: {
    glyph: '🎁',
    ringBg: 'conic-gradient(from 0deg, #f43f5e, #fbbf24, #ec4899, #f43f5e)',
  },
};

interface AvatarWithFrameProps {
  src?: string | null;
  alt: string;
  frameId?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isSpeaking?: boolean;
  onClick?: () => void;
}

const SIZE_MAP = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

export const AvatarWithFrame: React.FC<AvatarWithFrameProps> = ({
  src,
  alt,
  frameId = 'frame_obsidian',
  size = 'md',
  isSpeaking = false,
  onClick,
}) => {
  const [failed, setFailed] = useState(false);
  const activeFrameId = frameId || 'frame_obsidian';
  const frameClass = FRAME_CLASSES[activeFrameId] || FRAME_CLASSES.frame_obsidian;
  const frame3D = FRAME_3D_BADGE[activeFrameId];
  const resolved = resolveAsset(src);

  const badgeSize =
    size === 'xl'
      ? 'w-7 h-7 text-sm -top-1.5 -right-1.5'
      : size === 'lg'
      ? 'w-5 h-5 text-[11px] -top-1 -right-1'
      : size === 'md'
      ? 'w-4 h-4 text-[9px] -top-0.5 -right-0.5'
      : 'hidden';

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center shrink-0 ${
        onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''
      }`}
    >
      {isSpeaking && (
        <span className="absolute -inset-1.5 rounded-full border-2 border-emerald-400/85 animate-ping pointer-events-none" />
      )}

      {frame3D && (
        <span
          className="absolute -inset-[3px] rounded-full animate-frame-orbit pointer-events-none opacity-90"
          style={{ background: frame3D.ringBg }}
        />
      )}

      {!failed ? (
        <img
          src={resolved}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={`relative ${SIZE_MAP[size]} rounded-full object-cover bg-slate-900 ${
            frame3D ? 'ring-2 ring-white/90' : frameClass
          }`}
        />
      ) : (
        <div
          className={`relative ${SIZE_MAP[size]} rounded-full bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center text-[#F3D37A] ${frameClass}`}
        >
          <User className="w-1/2 h-1/2" />
        </div>
      )}

      {frame3D && size !== 'xs' && size !== 'sm' && (
        <span
          className={`absolute ${badgeSize} rounded-full bg-slate-950/90 border border-[#FCE9A6]/80 flex items-center justify-center shadow-md pointer-events-none z-10`}
        >
          {frame3D.glyph}
        </span>
      )}
    </div>
  );
};
