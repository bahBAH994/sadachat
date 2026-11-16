import React, { useState } from 'react';
import { User } from 'lucide-react';
import { resolveAsset } from '../lib/assets';

const FRAME_CLASSES: Record<string, string> = {
  frame_obsidian: 'ring-2 ring-[#D4AF37]/40 shadow-[0_0_12px_rgba(212,175,55,0.2)]',
  frame_crescent: 'ring-2 ring-[#F3D37A] shadow-[0_0_20px_rgba(243,211,122,0.5)]',
  frame_sapphire: 'ring-[3px] ring-sky-400 shadow-[0_0_24px_rgba(56,189,248,0.55)]',
  frame_imperial: 'ring-[3px] ring-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.75)]',
  frame_silver_7d:
    'ring-[3px] ring-slate-200 shadow-[0_0_22px_rgba(226,232,240,0.68)]',
  frame_gold_15d:
    'ring-[3px] ring-[#FCE9A6] shadow-[0_0_28px_rgba(243,211,122,0.85)]',
  frame_royal_30d:
    'ring-[4px] ring-amber-300 shadow-[0_0_36px_rgba(251,191,36,0.95)]',
};

interface AvatarWithFrameProps {
  src?: string | null;
  alt: string;
  frameId?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isSpeaking?: boolean;
}

const SIZE_MAP = {
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
}) => {
  const [failed, setFailed] = useState(false);
  const frameClass = FRAME_CLASSES[frameId || 'frame_obsidian'] || FRAME_CLASSES.frame_obsidian;
  const resolved = resolveAsset(src);

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      {isSpeaking && (
        <span className="absolute -inset-1.5 rounded-full border-2 border-[#F3D37A]/80 animate-ping pointer-events-none" />
      )}
      {!failed ? (
        <img
          src={resolved}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={`${SIZE_MAP[size]} rounded-full object-cover bg-[#0D1122] ${frameClass}`}
        />
      ) : (
        <div
          className={`${SIZE_MAP[size]} rounded-full bg-gradient-to-br from-[#1A2140] to-[#0A0D1C] flex items-center justify-center text-[#F3D37A] ${frameClass}`}
        >
          <User className="w-1/2 h-1/2" />
        </div>
      )}
    </div>
  );
};
