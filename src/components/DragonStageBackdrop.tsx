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
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#090807]/85 via-[#0C0A07]/60 to-[#060504]/92" />
      </div>
    );
  }

  // 1. Store 5,000 Coins: مجلس السلاطين الذهبي (bg_royal_majlis)
  if (key === 'bg_royal_majlis') {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#0E0903]">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 35%, rgba(245,158,11,0.34), transparent 58%), radial-gradient(circle at 50% 82%, rgba(180,83,9,0.28), transparent 60%), linear-gradient(180deg, #1E1304 0%, #2C1B05 45%, #090602 100%)',
          }}
        />
        <svg viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full opacity-55" aria-hidden="true">
          <defs>
            <linearGradient id="majlisGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="50%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#78350F" />
            </linearGradient>
          </defs>
          {/* Moorish Imperial Arch */}
          <path
            d="M40 900 L40 310 C40 160, 180 95, 300 50 C420 95, 560 160, 560 310 L560 900"
            fill="none"
            stroke="url(#majlisGold)"
            strokeWidth="3"
            opacity="0.55"
          />
          <path
            d="M85 900 L85 330 C85 200, 200 135, 300 95 C400 135, 515 200, 515 330 L515 900"
            fill="none"
            stroke="url(#majlisGold)"
            strokeWidth="1.5"
            opacity="0.4"
          />
          {/* Sultan Crown Crest */}
          <path
            d="M225 225 L245 165 L280 200 L300 145 L320 200 L355 165 L375 225 Z"
            fill="url(#majlisGold)"
            opacity="0.55"
          />
          <circle cx="300" cy="480" r="210" fill="none" stroke="#FDE047" strokeOpacity="0.14" strokeWidth="1.5" />
          <circle cx="300" cy="480" r="145" fill="none" stroke="#FDE047" strokeOpacity="0.18" strokeWidth="1" />
        </svg>
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-black/75" />
      </div>
    );
  }

  // 2. Store 5,000 Coins: قاعة الياقوت الكريستالية (bg_sapphire_crystal)
  if (key === 'bg_sapphire_crystal') {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#040915]">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 40%, rgba(56,189,248,0.32), transparent 55%), radial-gradient(circle at 20% 75%, rgba(59,130,246,0.22), transparent 50%), linear-gradient(180deg, #06132B 0%, #0D234A 48%, #030712 100%)',
          }}
        />
        <svg viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full opacity-55" aria-hidden="true">
          <defs>
            <linearGradient id="crystalFacet" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.55" />
              <stop offset="55%" stopColor="#38BDF8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <polygon points="300,120 455,310 300,560 145,310" fill="url(#crystalFacet)" stroke="#7DD3FC" strokeOpacity="0.4" strokeWidth="1.5" />
          <polygon points="300,120 385,310 300,560 215,310" fill="none" stroke="#BAE6FD" strokeOpacity="0.35" strokeWidth="1" />
          <polygon points="70,640 160,520 220,740 80,820" fill="url(#crystalFacet)" opacity="0.5" />
          <polygon points="530,620 440,510 390,740 520,820" fill="url(#crystalFacet)" opacity="0.5" />
          <circle cx="150" cy="240" r="2.4" fill="#E0F2FE" opacity="0.8" />
          <circle cx="465" cy="210" r="2.2" fill="#7DD3FC" opacity="0.85" />
          <circle cx="490" cy="520" r="2" fill="#E0F2FE" opacity="0.7" />
        </svg>
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-black/75" />
      </div>
    );
  }

  // 3. Store 5,000 Coins: بلاط الزمرد الإمبراطوري (bg_emerald_palace)
  if (key === 'bg_emerald_palace') {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#03100B]">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 42%, rgba(16,185,129,0.34), transparent 56%), radial-gradient(circle at 75% 20%, rgba(212,175,55,0.25), transparent 46%), linear-gradient(180deg, #042117 0%, #093526 48%, #020A07 100%)',
          }}
        />
        <svg viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full opacity-55" aria-hidden="true">
          <circle cx="300" cy="360" r="240" fill="none" stroke="#34D399" strokeOpacity="0.22" strokeWidth="2" />
          <circle cx="300" cy="360" r="180" fill="none" stroke="#FDE047" strokeOpacity="0.28" strokeWidth="1.5" strokeDasharray="8 6" />
          <polygon points="300,150 370,290 300,430 230,290" fill="#10B981" fillOpacity="0.16" stroke="#A7F3D0" strokeOpacity="0.45" strokeWidth="1.5" />
          <path d="M90 880 C160 660, 230 620, 300 620 C370 620, 440 660, 510 880" fill="none" stroke="#FCD34D" strokeOpacity="0.32" strokeWidth="2" />
        </svg>
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-black/75" />
      </div>
    );
  }

  // 4. Store 5,000 Coins: عرش الياقوت الأحمر (bg_ruby_throne)
  if (key === 'bg_ruby_throne') {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#100308]">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 42%, rgba(244,63,94,0.34), transparent 56%), radial-gradient(circle at 50% 70%, rgba(245,158,11,0.24), transparent 50%), linear-gradient(180deg, #2B0714 0%, #430A1E 45%, #0B0205 100%)',
          }}
        />
        <svg viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full opacity-55" aria-hidden="true">
          <path d="M0 0 C110 210, 90 480, 0 760 L0 0 Z" fill="#881337" fillOpacity="0.35" />
          <path d="M600 0 C490 210, 510 480, 600 760 L600 0 Z" fill="#881337" fillOpacity="0.35" />
          <polygon points="300,170 400,295 300,455 200,295" fill="#FB7185" fillOpacity="0.16" stroke="#FDE047" strokeOpacity="0.45" strokeWidth="1.5" />
          <circle cx="300" cy="310" r="190" fill="none" stroke="#F59E0B" strokeOpacity="0.22" strokeWidth="1.5" />
        </svg>
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-black/75" />
      </div>
    );
  }

  // 5. Store 5,000 Coins: سماء المجرة الذهبية (bg_celestial_gold)
  if (key === 'bg_celestial_gold') {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#080414]">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 38%, rgba(168,85,247,0.34), transparent 56%), radial-gradient(circle at 30% 68%, rgba(245,158,11,0.28), transparent 48%), linear-gradient(180deg, #160A31 0%, #26124A 48%, #06030E 100%)',
          }}
        />
        <svg viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full opacity-65" aria-hidden="true">
          <ellipse cx="300" cy="380" rx="260" ry="95" transform="rotate(-18 300 380)" fill="none" stroke="#FDE047" strokeOpacity="0.34" strokeWidth="1.8" />
          <ellipse cx="300" cy="380" rx="210" ry="70" transform="rotate(14 300 380)" fill="none" stroke="#C084FC" strokeOpacity="0.35" strokeWidth="1.2" />
          <circle cx="300" cy="380" r="46" fill="#FDE047" fillOpacity="0.2" />
          <circle cx="115" cy="180" r="2.4" fill="#FEF08A" />
          <circle cx="485" cy="215" r="2.8" fill="#E9D5FF" />
          <circle cx="150" cy="590" r="2" fill="#FDE047" />
          <circle cx="465" cy="610" r="2.6" fill="#FEF08A" />
          <circle cx="360" cy="150" r="1.8" fill="#FFFFFF" />
        </svg>
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-black/75" />
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
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 52% 62%, rgba(196, 132, 32, 0.34) 0%, rgba(92, 56, 12, 0.24) 36%, rgba(14, 11, 7, 0.96) 76%), linear-gradient(180deg, #0D0B08 0%, #171108 48%, #090705 100%)',
        }}
      />

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

        <g transform="translate(80, 290)" opacity="0.88">
          <path
            d="M190 95 L140 20 L185 75 L165 10 L215 65 L230 0 L248 65 L295 25 L268 85 L345 62 L292 122 Z"
            fill="url(#goldHorn)"
          />
          <path
            d="M155 170 C190 115, 295 105, 360 155 C395 182, 412 225, 390 250 C340 245, 300 225, 270 245 C235 268, 220 325, 245 385 L150 385 C135 315, 130 220, 155 170 Z"
            fill="url(#goldHorn)"
            opacity="0.72"
          />
          <path
            d="M240 255 C285 245, 355 262, 372 292 C335 305, 285 292, 248 310 Z"
            fill="#92400E"
            opacity="0.78"
          />
          <ellipse cx="268" cy="182" rx="18" ry="8" fill="#FEF08A" />
          <ellipse cx="271" cy="182" rx="5" ry="7" fill="#451A03" />
          <path
            d="M50 315 C95 215, 145 190, 175 210 C150 280, 160 365, 200 440 L35 440 Z"
            fill="url(#goldHorn)"
            opacity="0.45"
          />
        </g>

        <circle cx="110" cy="480" r="2.2" fill="#FEF08A" opacity="0.7" />
        <circle cx="475" cy="430" r="2.6" fill="#FDE047" opacity="0.65" />
        <circle cx="420" cy="610" r="1.8" fill="#FBBF24" opacity="0.7" />
        <circle cx="165" cy="680" r="2.4" fill="#FEF08A" opacity="0.55" />
        <circle cx="515" cy="560" r="2" fill="#F59E0B" opacity="0.65" />
        <circle cx="240" cy="410" r="1.6" fill="#FEF08A" opacity="0.6" />
      </svg>

      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/20 to-black/75" />
    </div>
  );
};
