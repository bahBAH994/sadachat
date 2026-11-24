import React from 'react';

interface GenderBadgeProps {
  gender?: 'female' | 'male' | null;
}

export const GenderBadge: React.FC<GenderBadgeProps> = ({ gender }) => {
  if (!gender) return null;

  const isFemale = gender === 'female';
  return (
    <span
      title={isFemale ? 'أنثى' : 'ذكر'}
      aria-label={isFemale ? 'أنثى' : 'ذكر'}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[11px] font-black leading-none ${
        isFemale ? 'bg-pink-500/15 text-pink-500' : 'bg-blue-500/15 text-blue-500'
      }`}
    >
      {isFemale ? '♀' : '♂'}
    </span>
  );
};
