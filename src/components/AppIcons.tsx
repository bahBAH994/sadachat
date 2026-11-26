import React, { useId } from 'react';
import type { SVGProps } from 'react';

type AppIconProps = SVGProps<SVGSVGElement>;

const useGradientId = (name: string) => `${name}-${useId().replace(/:/g, '')}`;

export const CoinIcon: React.FC<AppIconProps> = ({ className, ...props }) => {
  const id = useGradientId('coin');
  return (
    <svg viewBox="0 0 48 48" width="1em" height="1em" className={className} aria-hidden="true" focusable="false" {...props}>
      <defs>
        <radialGradient id={`${id}-face`} cx="32%" cy="24%" r="78%">
          <stop stopColor="#FEF9C3" />
          <stop offset=".35" stopColor="#FDE047" />
          <stop offset=".72" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#B45309" />
        </radialGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FFF7AE" />
          <stop offset=".45" stopColor="#FBBF24" />
          <stop offset="1" stopColor="#92400E" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FFF" stopOpacity=".95" />
          <stop offset="1" stopColor="#FFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="26.5" rx="20" ry="19" fill="#78350F" opacity=".45" />
      <circle cx="24" cy="23" r="20" fill={`url(#${id}-edge)`} stroke="#92400E" strokeWidth="1.5" />
      <circle cx="24" cy="21.5" r="16.5" fill={`url(#${id}-face)`} stroke="#FFF1A8" strokeWidth="1.5" />
      <circle cx="24" cy="21.5" r="13.5" fill="none" stroke="#B45309" strokeOpacity=".58" strokeWidth="1" />
      <path d="m18 24 1.8-7 4.2 3 4.2-3 1.8 7-6 4-6-4Z" fill="#B45309" stroke="#FFF2A6" strokeWidth="1" strokeLinejoin="round" />
      <path d="M22 24h4v5h-4z" fill="#92400E" />
      <path d="M11 13c3.1-4.1 7.7-6.2 12.2-6.5" fill="none" stroke={`url(#${id}-shine)`} strokeWidth="2.2" strokeLinecap="round" />
      <path d="m14 10 1.1 2.2 2.3 1.1-2.3 1.1-1.1 2.3-1.1-2.3-2.2-1.1 2.2-1.1L14 10Z" fill="#FFF" />
    </svg>
  );
};

export const DiamondIcon: React.FC<AppIconProps> = ({ className, ...props }) => {
  const id = useGradientId('diamond');
  return (
    <svg viewBox="0 0 48 48" width="1em" height="1em" className={className} aria-hidden="true" focusable="false" {...props}>
      <defs>
        <linearGradient id={`${id}-body`} x1=".15" y1=".08" x2=".82" y2=".95">
          <stop stopColor="#CFFAFE" />
          <stop offset=".38" stopColor="#67E8F9" />
          <stop offset="1" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id={`${id}-facet`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FFF" stopOpacity=".95" />
          <stop offset="1" stopColor="#BAE6FD" stopOpacity=".1" />
        </linearGradient>
      </defs>
      <path d="m8 17 7-9h18l7 9-16 24L8 17Z" fill={`url(#${id}-body)`} stroke="#E0FBFF" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m8 17 10 1 6-10 6 10 10-1M18 18l6 23 6-23M8 17h32" fill="none" stroke="#E0FBFF" strokeOpacity=".8" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="m15 8 3 10H8l7-10Z" fill={`url(#${id}-facet)`} opacity=".95" />
      <path d="m24 8 6 10H18l6-10Z" fill="#FFF" fillOpacity=".42" />
      <path d="m30 18 10-1-16 24 6-23Z" fill="#0369A1" fillOpacity=".25" />
      <path d="m13 14 2.5-3.5" stroke="#FFF" strokeWidth="2" strokeLinecap="round" />
      <path d="m37 7 .9 2.1L40 10l-2.1.9L37 13l-.9-2.1L34 10l2.1-.9L37 7Z" fill="#FFF" />
    </svg>
  );
};

export const GiftIcon: React.FC<AppIconProps> = ({ className, ...props }) => {
  const id = useGradientId('gift');
  return (
    <svg viewBox="0 0 48 48" width="1em" height="1em" className={className} aria-hidden="true" focusable="false" {...props}>
      <defs>
        <linearGradient id={`${id}-box`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FB7185" />
          <stop offset=".48" stopColor="#E11D48" />
          <stop offset="1" stopColor="#9F1239" />
        </linearGradient>
        <linearGradient id={`${id}-ribbon`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FEF08A" />
          <stop offset=".5" stopColor="#FACC15" />
          <stop offset="1" stopColor="#CA8A04" />
        </linearGradient>
      </defs>
      <rect x="8" y="20" width="32" height="22" rx="3" fill={`url(#${id}-box)`} stroke="#FDA4AF" strokeWidth="1.4" />
      <rect x="6" y="17" width="36" height="8" rx="2" fill="#BE123C" stroke="#FDA4AF" strokeWidth="1.2" />
      <path d="M21 17h6v25h-6zM6 18h36v5H6z" fill={`url(#${id}-ribbon)`} />
      <path d="M24 17c-8 0-12-3-10-7 2-4 8-1 10 7Zm0 0c8 0 12-3 10-7-2-4-8-1-10 7Z" fill="none" stroke={`url(#${id}-ribbon)`} strokeWidth="3" strokeLinejoin="round" />
      <path d="M11 28v9M37 28v9" stroke="#FDA4AF" strokeOpacity=".65" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M10 19h8" stroke="#FFF" strokeOpacity=".65" strokeWidth="1.3" strokeLinecap="round" />
      <path d="m35 8 .8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8.8-1.8Z" fill="#FFF" />
    </svg>
  );
};

export const CrownIcon: React.FC<AppIconProps> = ({ className, ...props }) => {
  const id = useGradientId('crown');
  return (
    <svg viewBox="0 0 48 48" width="1em" height="1em" className={className} aria-hidden="true" focusable="false" {...props}>
      <defs>
        <linearGradient id={`${id}-gold`} x1=".1" y1="0" x2=".85" y2="1">
          <stop stopColor="#FEF08A" />
          <stop offset=".42" stopColor="#FACC15" />
          <stop offset="1" stopColor="#B45309" />
        </linearGradient>
        <radialGradient id={`${id}-gem`} cx="30%" cy="20%" r="90%">
          <stop stopColor="#FCA5A5" />
          <stop offset="1" stopColor="#BE123C" />
        </radialGradient>
        <radialGradient id={`${id}-blue`} cx="30%" cy="20%" r="90%">
          <stop stopColor="#BAE6FD" />
          <stop offset="1" stopColor="#1D4ED8" />
        </radialGradient>
      </defs>
      <path d="m6 15 10 8 8-15 8 15 10-8-4 23H10L6 15Z" fill={`url(#${id}-gold)`} stroke="#FFF2A6" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 34h28l1 5H9l1-5Z" fill="#B45309" stroke="#FDE68A" strokeWidth="1" />
      <circle cx="16" cy="23" r="3.3" fill={`url(#${id}-gem)`} stroke="#FFE4E6" strokeWidth=".8" />
      <circle cx="24" cy="14" r="3.5" fill={`url(#${id}-blue)`} stroke="#DBEAFE" strokeWidth=".8" />
      <circle cx="32" cy="23" r="3.3" fill={`url(#${id}-gem)`} stroke="#FFE4E6" strokeWidth=".8" />
      <path d="m11 18 2 2M37 18l-2 2M24 5v2" stroke="#FFF" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 30h24" stroke="#FFF7B2" strokeOpacity=".85" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
};

export const TrophyIcon: React.FC<AppIconProps> = ({ className, ...props }) => {
  const id = useGradientId('trophy');
  return (
    <svg viewBox="0 0 48 48" width="1em" height="1em" className={className} aria-hidden="true" focusable="false" {...props}>
      <defs>
        <linearGradient id={`${id}-gold`} x1=".1" y1="0" x2=".9" y2="1">
          <stop stopColor="#FEF3A5" />
          <stop offset=".42" stopColor="#FACC15" />
          <stop offset="1" stopColor="#A16207" />
        </linearGradient>
        <linearGradient id={`${id}-base`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#334155" />
          <stop offset="1" stopColor="#0F172A" />
        </linearGradient>
      </defs>
      <path d="M13 7h22v12c0 9-4.5 14-11 14s-11-5-11-14V7Z" fill={`url(#${id}-gold)`} stroke="#FFF1A8" strokeWidth="1.4" />
      <path d="M13 11H6v5c0 7 4 11 10 11M35 11h7v5c0 7-4 11-10 11" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M21 32h6v6h-6z" fill="#CA8A04" />
      <path d="M15 38h18l4 5H11l4-5Z" fill={`url(#${id}-base)`} stroke="#64748B" strokeWidth="1" />
      <path d="m24 12 1.8 4 4.4.4-3.3 2.9 1 4.3-3.9-2.2-3.9 2.2 1-4.3-3.3-2.9 4.4-.4 1.8-4Z" fill="#FFF7C2" stroke="#F59E0B" strokeWidth=".8" strokeLinejoin="round" />
      <path d="M16 9h6" stroke="#FFF" strokeOpacity=".8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

export const WheelIcon: React.FC<AppIconProps> = ({ className, ...props }) => {
  const id = useGradientId('wheel');
  return (
    <svg viewBox="0 0 48 48" width="1em" height="1em" className={className} aria-hidden="true" focusable="false" {...props}>
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FEF08A" />
          <stop offset="1" stopColor="#B45309" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="27" r="18" fill="#78350F" opacity=".55" />
      <path d="M24 25V7A18 18 0 0 1 39.6 16L24 25Z" fill="#047857" />
      <path d="m24 25 15.6-9A18 18 0 0 1 39.6 34L24 25Z" fill="#E11D48" />
      <path d="m24 25 15.6 9A18 18 0 0 1 24 43V25Z" fill="#D97706" />
      <path d="M24 25v18A18 18 0 0 1 8.4 34L24 25Z" fill="#047857" />
      <path d="m24 25-15.6 9A18 18 0 0 1 8.4 16L24 25Z" fill="#E11D48" />
      <path d="m24 25-15.6-9A18 18 0 0 1 24 7v18Z" fill="#FBBF24" />
      <circle cx="24" cy="25" r="18" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="3" />
      <path d="M24 8v34M8.4 16l31.2 18M39.6 16 8.4 34" stroke="#FFF3C4" strokeOpacity=".8" strokeWidth="1.2" />
      <circle cx="24" cy="25" r="4.3" fill={`url(#${id}-gold)`} stroke="#FFF7C2" strokeWidth="1" />
      <path d="M18 3h12l-2.4 9h-7.2L18 3Z" fill="#E11D48" stroke="#FDA4AF" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M21 5h4" stroke="#FFF" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
};

export const MicIcon: React.FC<AppIconProps> = ({ className, ...props }) => {
  const id = useGradientId('mic');
  return (
    <svg viewBox="0 0 48 48" width="1em" height="1em" className={className} aria-hidden="true" focusable="false" {...props}>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#F8FAFC" />
          <stop offset=".35" stopColor="#CBD5E1" />
          <stop offset=".72" stopColor="#D4AF37" />
          <stop offset="1" stopColor="#854D0E" />
        </linearGradient>
        <linearGradient id={`${id}-grill`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#64748B" />
          <stop offset=".5" stopColor="#F8FAFC" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
      </defs>
      <rect x="17" y="4" width="14" height="27" rx="7" fill={`url(#${id}-body)`} stroke="#FFF7D6" strokeWidth="1.2" />
      <path d="M19 11h10M19 15h10M19 19h10M19 23h10" stroke={`url(#${id}-grill)`} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 22v2a13 13 0 0 0 26 0v-2M24 37v6M17 43h14" fill="none" stroke={`url(#${id}-body)`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 7c1.2-1.5 2.5-2 4-2" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="35" cy="12" r="2" fill="#FFF" />
      <path d="m35 7 .5 1.5L37 9l-1.5.5L35 11l-.5-1.5L33 9l1.5-.5L35 7Z" fill="#FDE68A" />
    </svg>
  );
};

export const AgencyIcon: React.FC<AppIconProps> = ({ className, ...props }) => {
  const id = useGradientId('agency');
  return (
    <svg viewBox="0 0 48 48" width="1em" height="1em" className={className} aria-hidden="true" focusable="false" {...props}>
      <defs>
        <linearGradient id={`${id}-shield`} x1=".1" y1="0" x2=".9" y2="1">
          <stop stopColor="#1E3A8A" />
          <stop offset=".52" stopColor="#172554" />
          <stop offset="1" stopColor="#0B1120" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FEF08A" />
          <stop offset=".5" stopColor="#FACC15" />
          <stop offset="1" stopColor="#A16207" />
        </linearGradient>
      </defs>
      <path d="M24 4 41 10v12c0 11-7 18-17 23C14 40 7 33 7 22V10l17-6Z" fill={`url(#${id}-shield)`} stroke={`url(#${id}-gold)`} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M24 9 36 13v9c0 8-5 13.5-12 17.5C17 35.5 12 30 12 22v-9l12-4Z" fill="none" stroke="#FDE68A" strokeOpacity=".55" strokeWidth="1" />
      <path d="m24 13 2.8 6 6.5.6-4.8 4.3 1.4 6.4-5.9-3.3-5.9 3.3 1.4-6.4-4.8-4.3 6.5-.6 2.8-6Z" fill={`url(#${id}-gold)`} stroke="#FFF7C2" strokeWidth="1" strokeLinejoin="round" />
      <path d="M11 13 8 12M37 13l3-1M24 7v3" stroke="#FFF" strokeOpacity=".8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

export const WalletIcon: React.FC<AppIconProps> = ({ className, ...props }) => {
  const id = useGradientId('wallet');
  return (
    <svg viewBox="0 0 48 48" width="1em" height="1em" className={className} aria-hidden="true" focusable="false" {...props}>
      <defs>
        <linearGradient id={`${id}-leather`} x1=".08" y1=".05" x2=".92" y2=".95">
          <stop stopColor="#334155" />
          <stop offset=".48" stopColor="#172554" />
          <stop offset="1" stopColor="#0B1120" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FFF7AE" />
          <stop offset=".48" stopColor="#FACC15" />
          <stop offset="1" stopColor="#A16207" />
        </linearGradient>
      </defs>
      <path d="M8 13.5A4.5 4.5 0 0 1 12.5 9H37a3 3 0 0 1 3 3v3H13a5 5 0 0 0-5 5v-6.5Z" fill="#64748B" stroke="#CBD5E1" strokeWidth="1.2" />
      <rect x="6" y="14" width="36" height="29" rx="6" fill={`url(#${id}-leather)`} stroke="#CBD5E1" strokeWidth="1.5" />
      <path d="M28 22h13v13H28a6.5 6.5 0 0 1 0-13Z" fill="#1E293B" stroke={`url(#${id}-gold)`} strokeWidth="2" />
      <circle cx="31" cy="28.5" r="2" fill={`url(#${id}-gold)`} />
      <path d="M11 19h11M11 38h15" stroke="#E2E8F0" strokeOpacity=".65" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 17c3-1.6 6.2-1.8 9-1.5" stroke="#FFF" strokeOpacity=".8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

export const PartyIcon: React.FC<AppIconProps> = ({ className, ...props }) => {
  const id = useGradientId('party');
  return (
    <svg viewBox="0 0 48 48" width="1em" height="1em" className={className} aria-hidden="true" focusable="false" {...props}>
      <defs>
        <linearGradient id={`${id}-gold`} x1=".1" y1="0" x2=".9" y2="1">
          <stop stopColor="#FEF08A" />
          <stop offset=".45" stopColor="#FACC15" />
          <stop offset="1" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id={`${id}-ruby`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FB7185" />
          <stop offset=".55" stopColor="#E11D48" />
          <stop offset="1" stopColor="#881337" />
        </linearGradient>
      </defs>
      <path d="m8 39 5-14 11 9-16 5Z" fill={`url(#${id}-gold)`} stroke="#FFF1A8" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="m24 34 11-23 6 6-23 11 6 6Z" fill={`url(#${id}-ruby)`} stroke="#FDA4AF" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m13 25 6 6M30 21l5 5M34 14l4 4" stroke="#FFF" strokeOpacity=".8" strokeWidth="1.3" strokeLinecap="round" />
      <path d="m10 11 1.2 3.2 3.3 1.2-3.3 1.2L10 20l-1.2-3.4-3.3-1.2 3.3-1.2L10 11ZM37 29l1.2 2.8 2.8 1.2-2.8 1.2L37 37l-1.2-2.8L33 33l2.8-1.2L37 29Z" fill={`url(#${id}-gold)`} stroke="#FFF7C2" strokeWidth=".7" />
      <circle cx="22" cy="12" r="2" fill="#FFF" />
      <path d="M22 7v2M17 12h2M25 12h2" stroke="#FFF" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
};

export const FriendsIcon: React.FC<AppIconProps> = ({ className, ...props }) => {
  const id = useGradientId('friends');
  return (
    <svg viewBox="0 0 48 48" width="1em" height="1em" className={className} aria-hidden="true" focusable="false" {...props}>
      <defs>
        <linearGradient id={`${id}-blue`} x1=".1" y1="0" x2=".9" y2="1">
          <stop stopColor="#BAE6FD" />
          <stop offset=".48" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0369A1" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FEF08A" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <circle cx="18" cy="16" r="7" fill={`url(#${id}-blue)`} stroke="#E0F2FE" strokeWidth="1.5" />
      <circle cx="33" cy="18" r="5.5" fill={`url(#${id}-gold)`} stroke="#FFF7C2" strokeWidth="1.3" />
      <path d="M5 38c.5-8 5-12 13-12s12.5 4 13 12H5Z" fill={`url(#${id}-blue)`} stroke="#BAE6FD" strokeWidth="1.5" />
      <path d="M28 28c6.8-.7 11 2.7 12 9h-8" fill="#B45309" stroke={`url(#${id}-gold)`} strokeWidth="2" strokeLinejoin="round" />
      <path d="M13 14c1.2-2 2.8-2.7 4.5-2.8M30.5 16c.8-1.1 1.8-1.5 3-1.6" fill="none" stroke="#FFF" strokeWidth="1.4" strokeLinecap="round" />
      <path d="m23 8 .7 1.7 1.8.7-1.8.7L23 13l-.7-1.8-1.8-.7 1.8-.7L23 8Z" fill="#FFF" />
    </svg>
  );
};

export const InboxIcon: React.FC<AppIconProps> = ({ className, ...props }) => {
  const id = useGradientId('inbox');
  return (
    <svg viewBox="0 0 48 48" width="1em" height="1em" className={className} aria-hidden="true" focusable="false" {...props}>
      <defs>
        <linearGradient id={`${id}-blue`} x1=".1" y1="0" x2=".9" y2="1">
          <stop stopColor="#60A5FA" />
          <stop offset=".5" stopColor="#2563EB" />
          <stop offset="1" stopColor="#172554" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FEF08A" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <rect x="5" y="10" width="38" height="29" rx="5" fill={`url(#${id}-blue)`} stroke="#BFDBFE" strokeWidth="1.5" />
      <path d="m7 15 17 13 17-13" fill="none" stroke="#DBEAFE" strokeWidth="2" strokeLinejoin="round" />
      <path d="m7 37 13-11m21 11L28 26" fill="none" stroke="#93C5FD" strokeOpacity=".8" strokeWidth="1.5" />
      <path d="M18 29h12l-2.2 5h-7.6L18 29Z" fill={`url(#${id}-gold)`} stroke="#FFF7C2" strokeWidth="1" strokeLinejoin="round" />
      <path d="M11 14h10" stroke="#FFF" strokeOpacity=".8" strokeWidth="1.4" strokeLinecap="round" />
      <path d="m37 5 .8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8.8-1.8Z" fill="#FFF" />
    </svg>
  );
};

export const ProfileIcon: React.FC<AppIconProps> = ({ className, ...props }) => {
  const id = useGradientId('profile');
  return (
    <svg viewBox="0 0 48 48" width="1em" height="1em" className={className} aria-hidden="true" focusable="false" {...props}>
      <defs>
        <linearGradient id={`${id}-gold`} x1=".1" y1="0" x2=".9" y2="1">
          <stop stopColor="#FEF3A5" />
          <stop offset=".5" stopColor="#FACC15" />
          <stop offset="1" stopColor="#A16207" />
        </linearGradient>
        <linearGradient id={`${id}-user`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#F8FAFC" />
          <stop offset="1" stopColor="#94A3B8" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="20" fill="#172554" stroke={`url(#${id}-gold)`} strokeWidth="2.5" />
      <circle cx="24" cy="18" r="7" fill={`url(#${id}-user)`} stroke="#FFF" strokeOpacity=".8" strokeWidth="1" />
      <path d="M11 39c.8-8 5.3-12 13-12s12.2 4 13 12" fill={`url(#${id}-user)`} stroke="#E2E8F0" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 12c3.5-4 8-6 12-6" fill="none" stroke="#FFF" strokeOpacity=".85" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="37" cy="10" r="2" fill="#FFF" />
    </svg>
  );
};

export const SettingsIcon: React.FC<AppIconProps> = ({ className, ...props }) => {
  const id = useGradientId('settings');
  return (
    <svg viewBox="0 0 48 48" width="1em" height="1em" className={className} aria-hidden="true" focusable="false" {...props}>
      <defs>
        <linearGradient id={`${id}-metal`} x1=".08" y1=".05" x2=".92" y2=".95">
          <stop stopColor="#F8FAFC" />
          <stop offset=".35" stopColor="#CBD5E1" />
          <stop offset=".7" stopColor="#D4AF37" />
          <stop offset="1" stopColor="#64748B" />
        </linearGradient>
      </defs>
      <path d="m20 5 8 0 1.2 4.4a15 15 0 0 1 3.1 1.8l4.3-1.3 4 7-3.2 3.1a15 15 0 0 1 0 3.7l3.2 3.1-4 7-4.3-1.3a15 15 0 0 1-3.1 1.8L28 43h-8l-1.2-4.4a15 15 0 0 1-3.1-1.8l-4.3 1.3-4-7 3.2-3.1a15 15 0 0 1 0-3.7l-3.2-3.1 4-7 4.3 1.3a15 15 0 0 1 3.1-1.8L20 5Z" fill={`url(#${id}-metal)`} stroke="#F8FAFC" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="24" cy="24" r="8" fill="#1E293B" stroke="#FFF7C2" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="3.5" fill={`url(#${id}-metal)`} stroke="#FFF" strokeWidth="1" />
      <path d="M20 8h4" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};
