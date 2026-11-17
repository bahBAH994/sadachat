import React from 'react';
import { resolveAsset } from '../lib/assets';

interface DragonStageBackdropProps {
  coverImage?: string | null;
}

export const DragonStageBackdrop: React.FC<DragonStageBackdropProps> = ({
  coverImage = 'dragon_dark',
}) => {
  const key = coverImage || 'dragon_dark';
  const isCustomUrl =
    key.startsWith('data:') || key.startsWith('http://') || key.startsWith('https://');
  const isAssetKey = key === 'royal_stage' || key === 'competition_crest';

  if (isCustomUrl || isAssetKey) {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 bg-[#080706]">
        <img
          src={isCustomUrl ? key : resolveAsset(key)}
          alt="خلفية الوكالة"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#090807]/85 via-[#0C0A07]/60 to-[#060504]/92" />
      </div>
    );
  }

  if (key === 'emerald_palace') {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-[#061812] via-[#0B251D] to-[#050B09]">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 62%, rgba(212,175,55,0.22), transparent 55%), radial-gradient(circle at 20% 25%, rgba(16,185,129,0.18), transparent 45%)',
          }}
        />
      </div>
    );
  }

  if (key === 'crimson_throne') {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-[#1A080E] via-[#280D16] to-[#090407]">
        <div
          className="absolute inset-0 opacity-65"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 62%, rgba(245,158,11,0.25), transparent 55%), radial-gradient(circle at 75% 30%, rgba(225,29,72,0.18), transparent 45%)',
          }}
        />
      </div>
    );
  }

  // Default: 'dragon_dark' — Luxury Golden Dragon Dark Stage matching screenshot
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#0A0805]">
      {/* Deep charcoal-to-molten-amber gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 52% 62%, rgba(196, 132, 32, 0.34) 0%, rgba(92, 56, 12, 0.24) 36%, rgba(14, 11, 7, 0.96) 76%), linear-gradient(180deg, #0D0B08 0%, #171108 48%, #090705 100%)',
        }}
      />

      {/* Golden Dragon Silhouette & Glowing Molten Scales Crest */}
      <svg
        viewBox="0 0 600 900"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full opacity-55 mix-blend-screen"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="dragonGlow" cx="52%" cy="60%" r="48%">
            <stop offset="0%" stopColor="#FDE047" stopOpacity="0.65" />
            <stop offset="45%" stopColor="#D97706" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="goldHorn" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>
        </defs>

        <circle cx="310" cy="540" r="280" fill="url(#dragonGlow)" />

        {/* Stylized Royal Dragon Head & Crown Spines */}
        <g transform="translate(80, 290)" opacity="0.88">
          {/* Spines & Horns */}
          <path
            d="M190 95 L140 20 L185 75 L165 10 L215 65 L230 0 L248 65 L295 25 L268 85 L345 62 L292 122 Z"
            fill="url(#goldHorn)"
          />
          {/* Dragon Snout & Jaw */}
          <path
            d="M155 170 C190 115, 295 105, 360 155 C395 182, 412 225, 390 250 C340 245, 300 225, 270 245 C235 268, 220 325, 245 385 L150 385 C135 315, 130 220, 155 170 Z"
            fill="url(#goldHorn)"
            opacity="0.72"
          />
          {/* Lower Jaw & Fangs */}
          <path
            d="M240 255 C285 245, 355 262, 372 292 C335 305, 285 292, 248 310 Z"
            fill="#92400E"
            opacity="0.78"
          />
          {/* Glowing Golden Dragon Eye */}
          <ellipse cx="268" cy="182" rx="18" ry="8" fill="#FEF08A" />
          <ellipse cx="271" cy="182" rx="5" ry="7" fill="#451A03" />

          {/* Dragon Neck Scales & Wing Arc */}
          <path
            d="M50 315 C95 215, 145 190, 175 210 C150 280, 160 365, 200 440 L35 440 Z"
            fill="url(#goldHorn)"
            opacity="0.45"
          />
        </g>

        {/* Subtle Floating Golden Embers */}
        <circle cx="110" cy="480" r="2.2" fill="#FEF08A" opacity="0.7" />
        <circle cx="475" cy="430" r="2.6" fill="#FDE047" opacity="0.65" />
        <circle cx="420" cy="610" r="1.8" fill="#FBBF24" opacity="0.7" />
        <circle cx="165" cy="680" r="2.4" fill="#FEF08A" opacity="0.55" />
        <circle cx="515" cy="560" r="2" fill="#F59E0B" opacity="0.65" />
        <circle cx="240" cy="410" r="1.6" fill="#FEF08A" opacity="0.6" />
      </svg>

      {/* Top Scrim for ultra-clear mic grid & chat legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/20 to-black/75" />
    </div>
  );
};
