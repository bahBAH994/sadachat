import React, { useCallback, useState } from 'react';
import { User } from 'lucide-react';
import { resolveAsset } from '../lib/assets';
import { getVipTierConfig, parseVipTierKey } from '../lib/sadaCatalog';
import type { VipTierKey } from '../types';
import { TransparentAssetImage, TransparentAssetVideo } from './TransparentAssetImage';

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

const FRAME_3D_BADGE: Record<string, { glyph: string; ringBg: string; topGlyph?: string }> = {
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
    topGlyph: '🐉',
  },
  frame_emerald_aura: {
    glyph: '💚',
    ringBg: 'conic-gradient(from 0deg, #10b981, #34d399, #fef08a, #10b981)',
    topGlyph: '👑',
  },
  frame_royal_phoenix: {
    glyph: '🔥',
    ringBg: 'conic-gradient(from 0deg, #f97316, #fbbf24, #ef4444, #f97316)',
    topGlyph: '🔥',
  },
  frame_galaxy_sovereign: {
    glyph: '🌌',
    ringBg: 'conic-gradient(from 0deg, #8b5cf6, #38bdf8, #fde047, #8b5cf6)',
    topGlyph: '✦',
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
  frameUrl?: string | null;
  vipTier?: VipTierKey | string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  customSizeClass?: string;
  isSpeaking?: boolean;
  animateFrame?: boolean;
  onClick?: () => void;
}

const SIZE_MAP = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

const ORNAMENT_SIZE = {
  md: { crown: '-top-3 text-lg', wing: 'text-xl', dragon: 'text-2xl', tail: 'text-xl' },
  lg: { crown: '-top-5 text-2xl', wing: 'text-2xl', dragon: 'text-3xl', tail: 'text-2xl' },
  xl: { crown: '-top-7 text-3xl', wing: 'text-4xl', dragon: 'text-4xl', tail: 'text-3xl' },
};

export const AvatarWithFrame: React.FC<AvatarWithFrameProps> = ({
  src,
  alt,
  frameId = 'frame_obsidian',
  frameUrl,
  vipTier,
  size = 'md',
  customSizeClass,
  isSpeaking = false,
  animateFrame = true,
  onClick,
}) => {
  const [failed, setFailed] = useState(false);
  const [frameColor, setFrameColor] = useState('#FCE9A6');
  const handleFrameColor = useCallback((color: string) => setFrameColor(color), []);
  const activeFrameId = frameUrl ? 'frame_obsidian' : (frameId || 'frame_obsidian');
  const frameClass = (FRAME_CLASSES[activeFrameId] || FRAME_CLASSES.frame_obsidian)
    .split(' ')
    .filter((className) => animateFrame || !className.startsWith('animate-'))
    .join(' ');
  const frame3D = FRAME_3D_BADGE[activeFrameId];
  const hasCustomFrame = Boolean(frameUrl);
  const ornaments = ORNAMENT_SIZE[size === 'xl' ? 'xl' : size === 'lg' ? 'lg' : 'md'];
  const resolved = resolveAsset(src);

  const resolvedVip: VipTierKey = vipTier ? parseVipTierKey(vipTier) : 'none';
  const dimClass = customSizeClass || SIZE_MAP[size];

  const badgeSize =
    size === 'xl'
      ? 'w-7 h-7 text-sm -top-1.5 -right-1.5'
      : size === 'lg'
      ? 'w-5 h-5 text-[11px] -top-1 -right-1'
      : size === 'md'
      ? 'w-4 h-4 text-[9px] -top-0.5 -right-0.5'
      : 'hidden';

  const vipRingVisualClass = hasCustomFrame
    ? ''
    : (resolvedVip === 'svip' || resolvedVip === 'svip1' || resolvedVip === 'svip2' || resolvedVip === 'svip3')
      ? 'vip-frame-svip ring-2 ring-[#FEF08A]'
      : resolvedVip === 'vip3'
      ? 'vip-frame-gold'
      : resolvedVip === 'vip2'
      ? 'vip-frame-silver'
      : resolvedVip === 'vip1'
      ? 'vip-frame-bronze'
      : frame3D
      ? 'ring-2 ring-white/90'
      : frameClass;

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center shrink-0 ${
        animateFrame && activeFrameId !== 'frame_obsidian' && resolvedVip === 'none'
          ? 'animate-frame-pulse-glow'
          : ''
      } ${
        onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''
      }`}
    >
      {isSpeaking && (
        <span className="absolute -inset-1.5 rounded-full border-2 border-emerald-400/85 animate-ping pointer-events-none" />
      )}

      {/* VIP 1: Metallic Bronze Rim */}
      {!hasCustomFrame && resolvedVip === 'vip1' && (
        <span
          aria-hidden="true"
          className="absolute -inset-[2.5px] rounded-full pointer-events-none opacity-95"
          style={{
            background:
              'conic-gradient(from 135deg, #F6C48B, #8C5220, #CD7F32, #FFE4C4, #7C4418, #F6C48B)',
          }}
        />
      )}

      {/* VIP 2: Chrome Silver Frame with Animated Moving Light Sheen */}
      {!hasCustomFrame && resolvedVip === 'vip2' && (
        <span
          aria-hidden="true"
          className="absolute -inset-[3px] rounded-full overflow-hidden pointer-events-none"
          style={{
            background:
              'conic-gradient(from 0deg, #94A3B8, #F8FAFC, #BAE6FD, #64748B, #FFFFFF, #94A3B8)',
          }}
        >
          <span
            className={`absolute -inset-y-4 w-5 bg-gradient-to-r from-transparent via-white/95 to-transparent blur-[1px] ${
              animateFrame ? 'vip-frame-silver-sheen' : ''
            }`}
          />
        </span>
      )}

      {/* VIP 3: Royal Gold Frame with Crown & Glowing Wings */}
      {!hasCustomFrame && resolvedVip === 'vip3' && (
        <>
          <span
            aria-hidden="true"
            className="absolute -inset-[3px] rounded-full pointer-events-none"
            style={{
              background:
                'conic-gradient(from 45deg, #B45309, #FEF08A, #F59E0B, #FFFBEB, #D97706, #B45309)',
            }}
          />
          {size !== 'xs' && (
            <>
              <span
                aria-hidden="true"
                className={`vip-wing-glow absolute pointer-events-none z-10 select-none ${
                  size === 'xl'
                    ? '-right-3.5 text-lg'
                    : size === 'lg'
                    ? '-right-2.5 text-sm'
                    : size === 'sm'
                    ? '-right-1.5 text-[10px]'
                    : '-right-2 text-xs'
                }`}
                style={{ animation: animateFrame ? undefined : 'none' }}
              >
                🪽
              </span>
              <span
                aria-hidden="true"
                className={`vip-wing-glow absolute pointer-events-none z-10 select-none ${
                  size === 'xl'
                    ? '-left-3.5 text-lg'
                    : size === 'lg'
                    ? '-left-2.5 text-sm'
                    : size === 'sm'
                    ? '-left-1.5 text-[10px]'
                    : '-left-2 text-xs'
                }`}
                style={{ animation: animateFrame ? undefined : 'none' }}
              >
                <span className="inline-block scale-x-[-1]">🪽</span>
              </span>
              <span
                aria-hidden="true"
                className={`absolute left-1/2 -translate-x-1/2 pointer-events-none z-20 drop-shadow-[0_2px_6px_rgba(245,158,11,0.9)] ${
                  size === 'xl'
                    ? '-top-3.5 text-xl'
                    : size === 'lg'
                    ? '-top-2.5 text-base'
                    : size === 'sm'
                    ? '-top-2 text-[11px]'
                    : '-top-2.5 text-xs'
                }`}
              >
                👑
              </span>
            </>
          )}
        </>
      )}

      {/* SVIP: 360° Rotating Diamond & Fire Animated Frame */}
      {!hasCustomFrame && (resolvedVip === 'svip' || resolvedVip === 'svip1' || resolvedVip === 'svip2' || resolvedVip === 'svip3') && (
        <>
          <span
            aria-hidden="true"
            className={`absolute -inset-[3.5px] rounded-full pointer-events-none ${
              animateFrame ? 'animate-frame-orbit' : ''
            }`}
            style={{
              background:
                'conic-gradient(from 0deg, #38BDF8, #FEF08A, #F97316, #EF4444, #BAE6FD, #F59E0B, #38BDF8)',
            }}
          />
          <span
            aria-hidden="true"
            className="absolute -inset-[1.5px] rounded-full bg-[#0B0F1A]/40 pointer-events-none"
          />
          {size !== 'xs' && (
            <span
              aria-hidden="true"
              className={`absolute left-1/2 -translate-x-1/2 pointer-events-none z-20 drop-shadow-[0_2px_10px_rgba(56,189,248,0.95)] ${
                size === 'xl'
                  ? '-top-3.5 text-xl'
                  : size === 'lg'
                  ? '-top-2.5 text-base'
                  : size === 'sm'
                  ? '-top-2 text-[11px]'
                  : '-top-2.5 text-sm'
              }`}
            >
              💎
            </span>
          )}
        </>
      )}

      {/* Store 3D frames retain their ornaments outside the circular portrait. */}
      {!hasCustomFrame && frame3D && resolvedVip === 'none' && (
        <>
          <span
            aria-hidden="true"
            className={`absolute inset-0 scale-[1.35] rounded-full pointer-events-none opacity-95 ${
              !animateFrame
                ? ''
                : activeFrameId === 'frame_galaxy_sovereign'
                ? 'animate-frame-galaxy-ring'
                : activeFrameId === 'frame_imperial_dragon'
                ? 'animate-dragon-aura'
                : activeFrameId === 'frame_royal_phoenix'
                ? 'animate-frame-phoenix-ring'
                : 'animate-frame-orbit'
            }`}
            style={{ background: frame3D.ringBg }}
          />

          {activeFrameId === 'frame_emerald_aura' && (
            <>
              <span aria-hidden="true" className="absolute -inset-2 rounded-full border border-emerald-200/90 shadow-[0_0_22px_rgba(16,185,129,0.95)] pointer-events-none z-0" />
              {size !== 'xs' && size !== 'sm' && (
                <>
                  <span aria-hidden="true" className="absolute -left-4 top-1/2 -translate-y-1/2 -rotate-[38deg] text-xl leading-none drop-shadow-[0_2px_5px_rgba(212,175,55,0.95)] pointer-events-none z-20">🌿</span>
                  <span aria-hidden="true" className="absolute -right-4 top-1/2 -translate-y-1/2 rotate-[38deg] scale-x-[-1] text-xl leading-none drop-shadow-[0_2px_5px_rgba(212,175,55,0.95)] pointer-events-none z-20">🌿</span>
                  <span aria-hidden="true" className={`absolute left-1/2 -translate-x-1/2 z-30 leading-none frame-ornament-emerald ${ornaments.crown} pointer-events-none`}>👑</span>
                </>
              )}
            </>
          )}

          {activeFrameId === 'frame_royal_phoenix' && size !== 'xs' && size !== 'sm' && (
            <>
              <span aria-hidden="true" className={`absolute -left-7 top-1/2 -translate-y-1/2 -rotate-[28deg] leading-none frame-ornament-phoenix ${ornaments.wing} pointer-events-none z-20`}>🪽</span>
              <span aria-hidden="true" className={`absolute -right-7 top-1/2 -translate-y-1/2 rotate-[28deg] scale-x-[-1] leading-none frame-ornament-phoenix ${ornaments.wing} pointer-events-none z-20`}>🪽</span>
              <span aria-hidden="true" className={`absolute left-1/2 -translate-x-1/2 z-30 leading-none frame-ornament-phoenix ${ornaments.crown} pointer-events-none`}>🔥</span>
              <span aria-hidden="true" className={`absolute -left-2 top-1/4 text-sm ${animateFrame ? 'animate-frame-spark' : ''} pointer-events-none z-20`}>✦</span>
              <span aria-hidden="true" className={`absolute -right-2 bottom-1/4 text-xs ${animateFrame ? 'animate-frame-spark' : ''} pointer-events-none z-20`}>✧</span>
            </>
          )}

          {activeFrameId === 'frame_galaxy_sovereign' && size !== 'xs' && size !== 'sm' && (
            <>
              <span aria-hidden="true" className={`absolute -inset-[9px] rounded-full border-2 border-violet-300/90 shadow-[0_0_12px_rgba(168,85,247,0.8)] ${animateFrame ? 'animate-frame-galaxy-ring' : ''} pointer-events-none z-0`} />
              <span aria-hidden="true" className={`absolute -inset-[13px] rounded-full border border-amber-200/90 shadow-[0_0_14px_rgba(212,175,55,0.85)] ${animateFrame ? 'animate-frame-galaxy-ring-reverse' : ''} pointer-events-none z-0`} />
              <span aria-hidden="true" className={`absolute left-1/2 -translate-x-1/2 z-30 leading-none frame-ornament-galaxy ${ornaments.crown} pointer-events-none`}>👑</span>
              <span aria-hidden="true" className={`absolute -left-3 top-1/4 text-sm ${animateFrame ? 'animate-frame-spark' : ''} pointer-events-none z-20`}>✦</span>
              <span aria-hidden="true" className={`absolute -right-3 bottom-1/4 text-xs ${animateFrame ? 'animate-frame-spark' : ''} pointer-events-none z-20`}>✧</span>
              <span aria-hidden="true" className="absolute -right-2 top-0 text-[10px] pointer-events-none z-20">🪐</span>
            </>
          )}

          {activeFrameId === 'frame_imperial_dragon' && size !== 'xs' && size !== 'sm' && (
            <>
              <span aria-hidden="true" className={`absolute left-1/2 -translate-x-1/2 z-30 leading-none frame-ornament-dragon ${ornaments.crown} pointer-events-none`}>🐉</span>
              <span aria-hidden="true" className={`absolute left-1/2 -translate-x-1/2 -bottom-5 leading-none ${animateFrame ? 'animate-frame-dragon-tail' : ''} ${ornaments.tail} pointer-events-none z-20`}>〰️</span>
              <span aria-hidden="true" className="absolute -left-2 top-1/3 text-xs frame-ornament-dragon pointer-events-none z-20">✦</span>
              <span aria-hidden="true" className="absolute -right-2 bottom-1/3 text-xs frame-ornament-dragon pointer-events-none z-20">✦</span>
            </>
          )}
        </>
      )}

      {!failed ? (
        <img
          src={resolved}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          style={animateFrame ? undefined : { animation: 'none' }}
          className={`relative z-10 ${dimClass} ${hasCustomFrame ? "scale-[0.88]" : ""} rounded-full object-cover bg-slate-900 ${vipRingVisualClass}`}
        />
      ) : (
        <div
          className={`relative z-10 ${dimClass} ${hasCustomFrame ? "scale-[0.88]" : ""} rounded-full bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center text-[#F3D37A] ${vipRingVisualClass}`}
        >
          <User className="w-1/2 h-1/2" />
        </div>
      )}

            {frameUrl && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 h-full w-full scale-[1.54] flex items-center justify-center"
            style={{
              filter: `drop-shadow(0 0 4px ${frameColor}77)`,
            }}
          >
            {/\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(frameUrl) ? (
              <TransparentAssetVideo
                src={frameUrl}
                alt=""
                onDominantColor={handleFrameColor}
                className="h-full w-full object-contain"
              />
            ) : (
              <TransparentAssetImage
                src={frameUrl}
                alt=""
                onDominantColor={handleFrameColor}
                className="h-full w-full object-contain"
              />
            )}
          </div>
          </>
      )}

      {/* VIP Corner Emblem Badge for md/lg/xl */}
      {resolvedVip !== 'none' && size !== 'xs' && size !== 'sm' && (
        <span
          className={`absolute ${badgeSize} rounded-full bg-slate-950/95 border border-[#FCE9A6]/85 flex items-center justify-center shadow-md pointer-events-none z-20`}
        >
          {(resolvedVip === 'svip' || resolvedVip === 'svip1' || resolvedVip === 'svip2' || resolvedVip === 'svip3')
            ? '🔥'
            : resolvedVip === 'vip3'
            ? '✨'
            : resolvedVip === 'vip2'
            ? '🥈'
            : '🥉'}
        </span>
      )}

      {resolvedVip === 'none' && frame3D && size !== 'xs' && size !== 'sm' && (
        <span
          className={`absolute ${badgeSize} rounded-full bg-slate-950/90 border border-[#FCE9A6]/80 flex items-center justify-center shadow-md pointer-events-none z-10`}
        >
          {frame3D.glyph}
        </span>
      )}
    </div>
  );
};

export const VipTierBadge: React.FC<{
  vipTier?: VipTierKey | string | null;
  compact?: boolean;
  className?: string;
}> = ({ vipTier, compact = false, className = '' }) => {
  const key = parseVipTierKey(vipTier);
  if (key === 'none') return null;
  const cfg = getVipTierConfig(key);

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-[1px] text-[9px] font-black tracking-wide leading-tight shrink-0 ${cfg.badgeBgClass} ${cfg.badgeTextClass} ${className}`}
    >
      <span>{cfg.badgeGlyph}</span>
      <span>{compact ? cfg.shortLabel : cfg.label}</span>
    </span>
  );
};

export const VipUserName: React.FC<{
  name: string;
  vipTier?: VipTierKey | string | null;
  className?: string;
}> = ({ name, vipTier, className = '' }) => {
  const key = parseVipTierKey(vipTier);
  return (
    <span className={`${className} ${key === 'svip' ? 'svip-name-glow' : ''}`}>
      {name}
    </span>
  );
};
