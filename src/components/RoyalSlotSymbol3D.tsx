import React from 'react';

interface RoyalSlotSymbol3DProps {
  symbol: string;
  compact?: boolean;
  winning?: boolean;
}

/**
 * Renders luxury sculpted 3D SVG artwork for flagship royal & jungle slot symbols
 * (Studded Crown, Blue Diamond, Golden Falcon, Gold Bullion, WILD, Lion, Gorilla, Elephant, Crocodile, K/J/10, Eye of Horus, Scarab)
 * and crisp glow badges for secondary symbols.
 */
export const RoyalSlotSymbol3D: React.FC<RoyalSlotSymbol3DProps> = ({
  symbol,
  compact = false,
  winning = false,
}) => {
  const sizeClass = compact ? 'w-9 h-9 sm:w-11 sm:h-11' : 'w-12 h-12 sm:w-16 sm:h-16';
  const glow = winning
    ? 'drop-shadow-[0_0_16px_rgba(252,233,166,0.95)]'
    : 'drop-shadow-[0_5px_10px_rgba(0,0,0,0.7)]';

  if (symbol === 'WILD') {
    return (
      <svg viewBox="0 0 64 64" className={`${sizeClass} ${glow}`} aria-label="WILD">
        <defs>
          <linearGradient id="wildBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#15803D" />
            <stop offset="50%" stopColor="#052E16" />
            <stop offset="100%" stopColor="#14532D" />
          </linearGradient>
          <linearGradient id="wildText" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#DC2626" />
          </linearGradient>
        </defs>
        <rect x="4" y="10" width="56" height="44" rx="10" fill="url(#wildBg)" stroke="#FBBF24" strokeWidth="2.5" />
        <path d="M8 14 C18 8, 28 18, 36 10" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" />
        <path d="M36 52 C46 44, 52 54, 58 42" fill="none" stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round" />
        <text
          x="32"
          y="39"
          textAnchor="middle"
          fontSize="16"
          fontWeight="900"
          fill="url(#wildText)"
          stroke="#451A03"
          strokeWidth="0.9"
          letterSpacing="0.5"
        >
          WILD
        </text>
      </svg>
    );
  }

  if (symbol === 'K' || symbol === 'J' || symbol === '10') {
    const palette =
      symbol === 'K'
        ? { top: '#A3E635', bot: '#15803D', stroke: '#FEF08A' }
        : symbol === 'J'
        ? { top: '#38BDF8', bot: '#1D4ED8', stroke: '#BAE6FD' }
        : { top: '#C084FC', bot: '#6D28D9', stroke: '#E9D5FF' };
    return (
      <svg viewBox="0 0 64 64" className={`${sizeClass} ${glow}`} aria-label={symbol}>
        <defs>
          <linearGradient id={`card_${symbol}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.top} />
            <stop offset="100%" stopColor={palette.bot} />
          </linearGradient>
        </defs>
        <text
          x="32"
          y="46"
          textAnchor="middle"
          fontSize={symbol === '10' ? '32' : '40'}
          fontWeight="900"
          fill={`url(#card_${symbol})`}
          stroke={palette.stroke}
          strokeWidth="2.2"
        >
          {symbol}
        </text>
      </svg>
    );
  }

  if (symbol === '🦁') {
    return (
      <svg viewBox="0 0 64 64" className={`${sizeClass} ${glow}`} aria-label="أسد الأدغال">
        <defs>
          <radialGradient id="lionMane" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="70%" stopColor="#92400E" />
            <stop offset="100%" stopColor="#451A03" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="26" fill="url(#lionMane)" stroke="#FDE047" strokeWidth="1.8" />
        <circle cx="32" cy="34" r="16" fill="#FBBF24" stroke="#78350F" strokeWidth="1.2" />
        <circle cx="22" cy="21" r="4" fill="#B45309" />
        <circle cx="42" cy="21" r="4" fill="#B45309" />
        <circle cx="26" cy="31" r="2.3" fill="#0F172A" />
        <circle cx="38" cy="31" r="2.3" fill="#0F172A" />
        <polygon points="29,37 35,37 32,41" fill="#78350F" />
        <path d="M27 44 Q32 47 37 44" fill="none" stroke="#451A03" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (symbol === '🦍') {
    return (
      <svg viewBox="0 0 64 64" className={`${sizeClass} ${glow}`} aria-label="غوريلا الأدغال">
        <circle cx="32" cy="32" r="24" fill="#334155" stroke="#94A3B8" strokeWidth="1.8" />
        <ellipse cx="32" cy="36" rx="15" ry="13" fill="#D97706" />
        <circle cx="26" cy="29" r="2.5" fill="#FEF08A" />
        <circle cx="38" cy="29" r="2.5" fill="#FEF08A" />
        <circle cx="26" cy="29" r="1.2" fill="#0F172A" />
        <circle cx="38" cy="29" r="1.2" fill="#0F172A" />
        <path d="M24 41 H40" stroke="#FEF9C3" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (symbol === '🐘') {
    return (
      <svg viewBox="0 0 64 64" className={`${sizeClass} ${glow}`} aria-label="فيل الأدغال">
        <ellipse cx="16" cy="32" rx="10" ry="15" fill="#64748B" stroke="#CBD5E1" strokeWidth="1.4" />
        <ellipse cx="48" cy="32" rx="10" ry="15" fill="#64748B" stroke="#CBD5E1" strokeWidth="1.4" />
        <circle cx="32" cy="30" r="15" fill="#94A3B8" stroke="#E2E8F0" strokeWidth="1.5" />
        <path d="M29 36 C28 48, 35 54, 41 50" fill="none" stroke="#94A3B8" strokeWidth="6" strokeLinecap="round" />
        <path d="M22 39 Q17 47 23 48" fill="none" stroke="#FFFBEB" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M42 39 Q47 47 41 48" fill="none" stroke="#FFFBEB" strokeWidth="2.8" strokeLinecap="round" />
        <circle cx="26" cy="27" r="2" fill="#0F172A" />
        <circle cx="38" cy="27" r="2" fill="#0F172A" />
      </svg>
    );
  }

  if (symbol === '🐊') {
    return (
      <svg viewBox="0 0 64 64" className={`${sizeClass} ${glow}`} aria-label="تمساح الأدغال">
        <rect x="8" y="20" width="48" height="24" rx="12" fill="#15803D" stroke="#86EFAC" strokeWidth="1.6" />
        <circle cx="22" cy="24" r="4" fill="#FDE047" />
        <circle cx="22" cy="24" r="1.8" fill="#0F172A" />
        <path d="M26 35 H52" stroke="#FEF9C3" strokeWidth="2.5" strokeDasharray="3 3" />
      </svg>
    );
  }

  if (symbol === '👑') {
    return (
      <svg viewBox="0 0 64 64" className={`${sizeClass} ${glow}`} aria-label="تاج مرصع">
        <defs>
          <linearGradient id="crownGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFF7CC" />
            <stop offset="45%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#92400E" />
          </linearGradient>
          <linearGradient id="crownBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
        </defs>
        <path
          d="M10 44 L7 20 L21 31 L32 14 L43 31 L57 20 L54 44 Z"
          fill="url(#crownGold)"
          stroke="#FEF08A"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <rect
          x="10"
          y="44"
          width="44"
          height="9"
          rx="3"
          fill="url(#crownBand)"
          stroke="#FEF3C7"
          strokeWidth="1.3"
        />
        <circle cx="7" cy="18" r="3" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1" />
        <circle cx="32" cy="12" r="3.6" fill="#38BDF8" stroke="#E0F2FE" strokeWidth="1.2" />
        <circle cx="57" cy="18" r="3" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1" />
        <circle cx="21" cy="48.5" r="2.2" fill="#EF4444" stroke="#FECACA" strokeWidth="0.8" />
        <circle cx="32" cy="48.5" r="2.6" fill="#38BDF8" stroke="#BAE6FD" strokeWidth="0.9" />
        <circle cx="43" cy="48.5" r="2.2" fill="#10B981" stroke="#A7F3D0" strokeWidth="0.8" />
        <polygon points="32,27 36,34 32,40 28,34" fill="#38BDF8" stroke="#E0F2FE" strokeWidth="0.9" />
      </svg>
    );
  }

  if (symbol === '💎') {
    return (
      <svg viewBox="0 0 64 64" className={`${sizeClass} ${glow}`} aria-label="ألماسة زرقاء">
        <defs>
          <linearGradient id="sapphireTop" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E0F2FE" />
            <stop offset="50%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <linearGradient id="sapphireBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7DD3FC" />
            <stop offset="50%" stopColor="#0EA5E9" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </linearGradient>
        </defs>
        <polygon
          points="18,12 46,12 58,26 32,54 6,26"
          fill="url(#sapphireBody)"
          stroke="#BAE6FD"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <polygon points="18,12 46,12 40,26 24,26" fill="url(#sapphireTop)" opacity="0.95" />
        <polygon points="6,26 24,26 32,54" fill="#0369A1" opacity="0.7" />
        <polygon points="58,26 40,26 32,54" fill="#1D4ED8" opacity="0.72" />
        <polygon points="24,26 40,26 32,54" fill="#38BDF8" opacity="0.85" />
        <line x1="6" y1="26" x2="58" y2="26" stroke="#E0F2FE" strokeWidth="1.1" />
        <circle cx="23" cy="18" r="2" fill="#FFFFFF" opacity="0.9" />
      </svg>
    );
  }

  if (symbol === '🦅') {
    return (
      <svg viewBox="0 0 64 64" className={`${sizeClass} ${glow}`} aria-label="صقر ذهبي">
        <defs>
          <linearGradient id="falconWing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="55%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>
        </defs>
        <path
          d="M32 30 C22 14, 10 12, 5 16 C11 21, 13 25, 9 28 C16 29, 20 32, 24 36 Z"
          fill="url(#falconWing)"
          stroke="#FEF3C7"
          strokeWidth="1.2"
        />
        <path
          d="M32 30 C42 14, 54 12, 59 16 C53 21, 51 25, 55 28 C48 29, 44 32, 40 36 Z"
          fill="url(#falconWing)"
          stroke="#FEF3C7"
          strokeWidth="1.2"
        />
        <path
          d="M27 25 L37 25 L39 40 L32 54 L25 40 Z"
          fill="url(#falconWing)"
          stroke="#FDE68A"
          strokeWidth="1.3"
        />
        <circle cx="32" cy="19" r="6.5" fill="#FDE047" stroke="#FEF9C3" strokeWidth="1.2" />
        <polygon points="32,16 39,19 32,22" fill="#F59E0B" />
        <circle cx="33.5" cy="17.8" r="1.2" fill="#0F172A" />
      </svg>
    );
  }

  if (symbol === '🪙') {
    return (
      <svg viewBox="0 0 64 64" className={`${sizeClass} ${glow}`} aria-label="سبيكة ذهب">
        <defs>
          <linearGradient id="bullionFace" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFBEB" />
            <stop offset="40%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id="bullionSide" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>
        </defs>
        <polygon points="10,49 16,35 48,35 54,49" fill="url(#bullionSide)" stroke="#FDE68A" strokeWidth="1.2" />
        <polygon points="16,35 20,27 44,27 48,35" fill="url(#bullionFace)" stroke="#FEF9C3" strokeWidth="1.2" />
        <polygon points="15,36 20,20 44,20 49,36" fill="url(#bullionFace)" stroke="#FEF9C3" strokeWidth="1.5" />
        <polygon points="20,20 24,14 40,14 44,20" fill="#FEF9C3" opacity="0.9" />
        <text x="32" y="31" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#78350F">
          999.9
        </text>
        <circle cx="21" cy="23" r="1.8" fill="#FFFFFF" opacity="0.85" />
      </svg>
    );
  }

  if (symbol === '🏆') {
    return (
      <svg viewBox="0 0 64 64" className={`${sizeClass} ${glow}`} aria-label="كأس الملك">
        <defs>
          <linearGradient id="trophyGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FEF9C3" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>
        </defs>
        <path
          d="M19 14 H45 V26 C45 36, 38 41, 32 41 C26 41, 19 36, 19 26 Z"
          fill="url(#trophyGold)"
          stroke="#FEF08A"
          strokeWidth="1.5"
        />
        <path d="M19 17 H11 C10 26, 14 31, 19 31" fill="none" stroke="#FBBF24" strokeWidth="3" />
        <path d="M45 17 H53 C54 26, 50 31, 45 31" fill="none" stroke="#FBBF24" strokeWidth="3" />
        <rect x="29" y="41" width="6" height="9" fill="#D97706" />
        <rect x="21" y="49" width="22" height="6" rx="2" fill="url(#trophyGold)" stroke="#FEF08A" strokeWidth="1.2" />
      </svg>
    );
  }

  return (
    <span
      className={`${
        compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-5xl'
      } leading-none select-none ${glow}`}
    >
      {symbol}
    </span>
  );
};
